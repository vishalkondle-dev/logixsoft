import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { RESTAURANT_ROLES } from '@logixsoft/logix-dine/types/roles';
import { RestaurantMemberSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurantMember } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import * as z from 'zod';
import { cacheGet, cacheSet, invalidateStaff, CacheKey, TTL } from '../lib/cache';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) { return c.env?.CACHE; }

function normalizePhone(input: string): string {
  const cleaned = input.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return cleaned.startsWith('+') ? cleaned : `+${digits}`;
}

const InviteStaffSchema = z.object({
  phone: z.string().min(6).max(20),
  role: z.string().min(1).refine((r) => r.toUpperCase() !== 'OWNER', {
    message: 'Cannot invite a member with role OWNER. Ownership transfer is managed separately.',
  }),
  outletIds: z.array(z.string()).min(1, 'At least one outlet must be assigned'),
});

const UpdateStaffSchema = z.object({
  role: z.string().min(1).refine((r) => r.toUpperCase() !== 'OWNER', {
    message: 'Cannot change a member role to OWNER.',
  }).optional(),
  outletIds: z.array(z.string()).optional(),
});

export const RestaurantMemberWithOutletsSchema = RestaurantMemberSchema.extend({
  outletIds: z.array(z.string()),
});

async function memberWithOutlets(db: any, restaurantId: string, memberId?: string) {
  const whereClause = memberId
    ? and(eq(appSchema.restaurantMember.restaurantId, restaurantId), eq(appSchema.restaurantMember.id, memberId))
    : eq(appSchema.restaurantMember.restaurantId, restaurantId);

  const members = await db.select().from(appSchema.restaurantMember).where(whereClause);
  const memberIds = members.map((m: any) => m.id);
  if (!memberIds.length) return [];

  const accessRows = await db
    .select()
    .from(appSchema.memberOutletAccess)
    .where(inArray(appSchema.memberOutletAccess.memberId, memberIds));
  const byMember = new Map<string, string[]>();
  for (const row of accessRows) {
    if (!memberIds.includes(row.memberId)) continue;
    const list = byMember.get(row.memberId) ?? [];
    list.push(row.outletId);
    byMember.set(row.memberId, list);
  }

  let roleNameMap = new Map<string, string>();
  try {
    const roles = await db
      .select({ id: appSchema.restaurantRole.id, name: appSchema.restaurantRole.name })
      .from(appSchema.restaurantRole)
      .where(eq(appSchema.restaurantRole.restaurantId, restaurantId));
    for (const r of roles) {
      roleNameMap.set(r.id, r.name);
      roleNameMap.set(r.name, r.name);
    }
  } catch {}

  return members.map((m: any) => ({
    ...toRestaurantMember(m),
    roleName: roleNameMap.get(m.role) || m.role,
    outletIds: byMember.get(m.id) ?? [],
  }));
}

// GET /staff — list all members (with outlet access) for the current restaurant
app.get(
  '/',
  apiDoc({
    tags: ['Staff'],
    summary: 'List Staff Members',
    description: 'Lists all staff members and their assigned outlet IDs for the current restaurant.',
    responses: {
      200: z.array(RestaurantMemberWithOutletsSchema),
    },
  }),
  requirePermission('member:read'),
  async (c) => {
  const { restaurantId } = c.get('tenant');

  const cached = await cacheGet<any[]>(kv(c), CacheKey.staff(restaurantId));
  if (cached) return c.json(cached);

  const { db, close } = getDb(c);
  try {
    const result = await memberWithOutlets(db, restaurantId);
    const filtered = result.filter((m: any) => m.role !== 'OWNER');
    await cacheSet(kv(c), CacheKey.staff(restaurantId), filtered, TTL.staff);
    return c.json(filtered);
  } finally {
    await close();
  }
});

// POST /staff/invite — create a PENDING member row + outlet access, notify by WhatsApp
app.post(
  '/invite',
  apiDoc({
    tags: ['Staff'],
    summary: 'Invite Staff Member',
    description: 'Invites a new staff member by phone with specific role and outlet access.',
    body: InviteStaffSchema,
    responses: {
      201: RestaurantMemberWithOutletsSchema,
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requirePermission('member:write'),
  async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = InviteStaffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
  }
  const { role, outletIds } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);

  const { db, close } = getDb(c);
  try {
    // Guard uniqueness in application logic (see schema note): one member
    // row per (restaurantId, phone), regardless of invite status.
    const [existing] = await db
      .select({ id: appSchema.restaurantMember.id })
      .from(appSchema.restaurantMember)
      .where(and(eq(appSchema.restaurantMember.restaurantId, restaurantId), eq(appSchema.restaurantMember.phone, phone)))
      .limit(1);
    if (existing) {
      return c.json({ error: 'Conflict', message: 'This phone number is already a staff member' }, 409);
    }

    // Validate outlets belong to this restaurant and the caller has permission to assign them
    const outlets = await db
      .select({ id: appSchema.restaurantOutlet.id })
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
    const validOutletIds = new Set(outlets.map((o: any) => o.id));
    for (const oid of outletIds) {
      if (!validOutletIds.has(oid) || !assertOutletAccess(tenant, oid)) {
        return c.json({ error: 'Forbidden', message: `You do not have permission to assign outlet '${oid}'` }, 403);
      }
    }

    // Check if a user already exists for this phone (they may log in before or after invite)
    const [existingUser] = await db
      .select({ id: appSchema.user.id })
      .from(appSchema.user)
      .where(eq(appSchema.user.phoneNumber, phone))
      .limit(1);

    const memberId = generateId('member');
    const now = new Date();

    await db.transaction(async (tx: any) => {
      await tx.insert(appSchema.restaurantMember).values({
        id: memberId,
        restaurantId,
        userId: existingUser?.id ?? null,
        phone,
        role,
        inviteStatus: existingUser ? 'ACCEPTED' : 'PENDING',
        createdAt: now,
        updatedAt: now,
        createdBy: actorPhone,
        updatedBy: actorPhone,
      });

      for (const outletId of outletIds) {
        await tx.insert(appSchema.memberOutletAccess).values({
          id: generateId('moa'),
          memberId,
          outletId,
          createdAt: now,
          createdBy: actorPhone,
        });
      }
    });

    // Best-effort WhatsApp notification — never block the invite on send failure.
    // Genuine user-triggered send (owner clicked Invite), not a test/debug ping.
    try {
      const { sendWhatsAppText } = await import('@logixsoft/wa');
      const digitsOnly = phone.replace(/\D/g, '');
      const [rest] = await db
        .select({ name: appSchema.restaurant.name })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId));
      await sendWhatsAppText(
        digitsOnly,
        `You've been invited to join ${rest?.name ?? 'a restaurant'} on Logix Dine as ${role}. Open dine.logixsoft.in and sign in with this number to get started.`,
        undefined,
        { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
      ).catch(() => {});
    } catch (err) {
      console.warn('[staff/invite] WhatsApp notification skipped:', err);
    }

    const [created] = await memberWithOutlets(db, restaurantId, memberId);
    await invalidateStaff(kv(c), restaurantId);
    return c.json(created, 201);
  } finally {
    await close();
  }
});

// PUT /staff/:id — update role and/or outlet assignments
app.put(
  '/:id',
  apiDoc({
    tags: ['Staff'],
    summary: 'Update Staff Member',
    description: 'Updates role and/or assigned outlet IDs for a staff member.',
    params: z.object({ id: z.string() }),
    body: UpdateStaffSchema,
    responses: {
      200: RestaurantMemberWithOutletsSchema,
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('member:write'),
  async (c) => {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = c.get('actorPhone');
  const memberId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
  }

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select()
      .from(appSchema.restaurantMember)
      .where(and(eq(appSchema.restaurantMember.id, memberId), eq(appSchema.restaurantMember.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);
    if (existing.role === 'OWNER') return c.json({ error: 'Forbidden', message: 'Cannot modify the owner' }, 403);

    if (parsed.data.outletIds) {
      for (const oid of parsed.data.outletIds) {
        if (!assertOutletAccess(tenant, oid)) {
          return c.json({ error: 'Forbidden', message: `You do not have permission to assign outlet '${oid}'` }, 403);
        }
      }
    }

    const now = new Date();
    await db.transaction(async (tx: any) => {
      if (parsed.data.role) {
        await tx
          .update(appSchema.restaurantMember)
          .set({ role: parsed.data.role, updatedAt: now, updatedBy: actorPhone })
          .where(eq(appSchema.restaurantMember.id, memberId));
      }

      if (parsed.data.outletIds) {
        await tx.delete(appSchema.memberOutletAccess).where(eq(appSchema.memberOutletAccess.memberId, memberId));
        for (const outletId of parsed.data.outletIds) {
          await tx.insert(appSchema.memberOutletAccess).values({
            id: generateId('moa'),
            memberId,
            outletId,
            createdAt: now,
            createdBy: actorPhone,
          });
        }
      }
    });

    const [updated] = await memberWithOutlets(db, restaurantId, memberId);
    await invalidateStaff(kv(c), restaurantId);
    return c.json(updated);
  } finally {
    await close();
  }
});

// DELETE /staff/:id — remove a member (cascades to memberOutletAccess)
app.delete(
  '/:id',
  apiDoc({
    tags: ['Staff'],
    summary: 'Remove Staff Member',
    description: 'Removes a staff member and their outlet access.',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('member:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const memberId = c.req.param('id');

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select({ id: appSchema.restaurantMember.id, role: appSchema.restaurantMember.role })
      .from(appSchema.restaurantMember)
      .where(and(eq(appSchema.restaurantMember.id, memberId), eq(appSchema.restaurantMember.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);
    if (existing.role === 'OWNER') return c.json({ error: 'Forbidden', message: 'Cannot remove the owner' }, 403);

    await db.delete(appSchema.restaurantMember).where(eq(appSchema.restaurantMember.id, memberId));
    await invalidateStaff(kv(c), restaurantId);
    return c.json({ success: true });
  } finally {
    await close();
  }
});

export { app as staffRoutes };
