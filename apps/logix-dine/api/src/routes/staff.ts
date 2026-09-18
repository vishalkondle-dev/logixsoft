import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission } from '../lib/tenancy';
import { RESTAURANT_ROLES } from '@logixsoft/logix-dine/types/roles';
import { toRestaurantMember } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import * as z from 'zod';

const app = new Hono<{ Bindings: AuthEnv & { HYPERDRIVE?: { connectionString: string } } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function normalizePhone(input: string): string {
  const cleaned = input.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return cleaned.startsWith('+') ? cleaned : `+${digits}`;
}

const InviteStaffSchema = z.object({
  phone: z.string().min(6).max(20),
  role: z.enum(RESTAURANT_ROLES.filter((r) => r !== 'OWNER') as [string, ...string[]]),
  outletIds: z.array(z.string()).min(1, 'At least one outlet must be assigned'),
});

const UpdateStaffSchema = z.object({
  role: z.enum(RESTAURANT_ROLES.filter((r) => r !== 'OWNER') as [string, ...string[]]).optional(),
  outletIds: z.array(z.string()).optional(),
});

async function memberWithOutlets(db: any, restaurantId: string, memberId?: string) {
  const whereClause = memberId
    ? and(eq(appSchema.restaurantMember.restaurantId, restaurantId), eq(appSchema.restaurantMember.id, memberId))
    : eq(appSchema.restaurantMember.restaurantId, restaurantId);

  const members = await db.select().from(appSchema.restaurantMember).where(whereClause);
  const memberIds = members.map((m: any) => m.id);
  if (!memberIds.length) return [];

  const accessRows = await db.select().from(appSchema.memberOutletAccess);
  const byMember = new Map<string, string[]>();
  for (const row of accessRows) {
    if (!memberIds.includes(row.memberId)) continue;
    const list = byMember.get(row.memberId) ?? [];
    list.push(row.outletId);
    byMember.set(row.memberId, list);
  }

  return members.map((m: any) => ({
    ...toRestaurantMember(m),
    outletIds: byMember.get(m.id) ?? [],
  }));
}

// GET /staff — list all members (with outlet access) for the current restaurant
app.get('/', requirePermission('member:read'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const { db, close } = getDb(c);
  try {
    const result = await memberWithOutlets(db, restaurantId);
    // Exclude OWNER from the staff list — owner manages staff, isn't "staff"
    return c.json(result.filter((m: any) => m.role !== 'OWNER'));
  } finally {
    await close();
  }
});

// POST /staff/invite — create a PENDING member row + outlet access, notify by WhatsApp
app.post('/invite', requirePermission('member:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
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

    // Validate outlets belong to this restaurant
    const outlets = await db
      .select({ id: appSchema.restaurantOutlet.id })
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
    const validOutletIds = new Set(outlets.map((o: any) => o.id));
    for (const oid of outletIds) {
      if (!validOutletIds.has(oid)) {
        return c.json({ error: 'Bad Request', message: `Outlet ${oid} does not belong to this restaurant` }, 400);
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
    return c.json(created, 201);
  } finally {
    await close();
  }
});

// PUT /staff/:id — update role and/or outlet assignments
app.put('/:id', requirePermission('member:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
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
    return c.json(updated);
  } finally {
    await close();
  }
});

// DELETE /staff/:id — remove a member (cascades to memberOutletAccess)
app.delete('/:id', requirePermission('member:write'), async (c) => {
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
    return c.json({ success: true });
  } finally {
    await close();
  }
});

export { app as staffRoutes };
