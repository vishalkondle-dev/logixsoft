import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
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

const AddStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  phone: z.string().min(6).max(20),
  role: z.string().min(1).refine((r) => r.toUpperCase() !== 'OWNER', {
    message: 'Cannot assign role OWNER to staff. Ownership is managed separately.',
  }),
  outletIds: z.array(z.string()).min(1, 'At least one outlet must be assigned'),
});

const UpdateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).refine((r) => r.toUpperCase() !== 'OWNER', {
    message: 'Cannot change staff role to OWNER.',
  }).optional(),
  outletIds: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const StaffResponseSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  userId: z.string().nullable(),
  phone: z.string(),
  name: z.string().nullable(),
  role: z.string(),
  roleName: z.string().optional(),
  status: z.string(),
  outletIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

async function getStaffList(db: any, restaurantId: string, staffId?: string) {
  let targetPhone: string | null = null;
  if (staffId) {
    const [target] = await db
      .select({ phone: appSchema.outletStaff.phone })
      .from(appSchema.outletStaff)
      .where(and(eq(appSchema.outletStaff.restaurantId, restaurantId), eq(appSchema.outletStaff.id, staffId)))
      .limit(1);
    if (!target) return [];
    targetPhone = target.phone;
  }

  const whereClause = targetPhone
    ? and(eq(appSchema.outletStaff.restaurantId, restaurantId), eq(appSchema.outletStaff.phone, targetPhone))
    : eq(appSchema.outletStaff.restaurantId, restaurantId);

  const rows = await db.select().from(appSchema.outletStaff).where(whereClause);
  if (!rows.length) return [];

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

  const byPhone = new Map<string, any>();
  for (const row of rows) {
    if (row.role === 'OWNER') continue;
    const existing = byPhone.get(row.phone);
    if (!existing) {
      byPhone.set(row.phone, {
        id: row.id,
        restaurantId: row.restaurantId,
        userId: row.userId ?? null,
        phone: row.phone,
        name: row.name ?? null,
        role: row.role,
        roleName: roleNameMap.get(row.role) || row.role,
        status: row.status,
        outletIds: row.outletId ? [row.outletId] : [],
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      });
    } else {
      if (row.outletId && !existing.outletIds.includes(row.outletId)) {
        existing.outletIds.push(row.outletId);
      }
      if (!existing.name && row.name) existing.name = row.name;
    }
  }

  return Array.from(byPhone.values());
}

// Handler for adding staff
async function handleAddStaff(c: any) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = AddStaffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
  }
  const { role, outletIds, name } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select({ id: appSchema.outletStaff.id })
      .from(appSchema.outletStaff)
      .where(and(eq(appSchema.outletStaff.restaurantId, restaurantId), eq(appSchema.outletStaff.phone, phone)))
      .limit(1);
    if (existing) {
      return c.json({ error: 'Conflict', message: 'A staff member with this phone number already exists' }, 409);
    }

    // Validate outlets belong to this restaurant and caller has access
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

    // Check if user account already exists in user table
    const [existingUser] = await db
      .select({ id: appSchema.user.id, name: appSchema.user.name })
      .from(appSchema.user)
      .where(eq(appSchema.user.phoneNumber, phone))
      .limit(1);

    const displayName = name?.trim() || existingUser?.name || null;
    const now = new Date();
    let primaryId = '';

    await db.transaction(async (tx: any) => {
      for (const outletId of outletIds) {
        const id = generateId('staff');
        if (!primaryId) primaryId = id;
        await tx.insert(appSchema.outletStaff).values({
          id,
          restaurantId,
          outletId,
          userId: existingUser?.id ?? null,
          phone,
          name: displayName,
          role,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
          createdBy: actorPhone,
          updatedBy: actorPhone,
        });
      }
    });

    // Best-effort informational WhatsApp message
    try {
      const { sendWhatsAppText } = await import('@logixsoft/wa');
      const digitsOnly = phone.replace(/\D/g, '');
      const [rest] = await db
        .select({ name: appSchema.restaurant.name })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId));
      await sendWhatsAppText(
        digitsOnly,
        `Hi ${displayName || 'there'}, you have been added as ${role} at ${rest?.name ?? 'our restaurant'}. Sign in with this mobile number at dine.logixsoft.in to access the system.`,
        undefined,
        { url: c.env?.WA_API_URL, apiKey: c.env?.WA_API_KEY }
      ).catch(() => {});
    } catch (err) {
      console.warn('[staff/add] WhatsApp notification skipped:', err);
    }

    const [created] = await getStaffList(db, restaurantId, primaryId);
    await invalidateStaff(kv(c), restaurantId);
    return c.json(created, 201);
  } finally {
    await close();
  }
}

// GET /staff — list all staff for the current restaurant
app.get(
  '/',
  apiDoc({
    tags: ['Staff'],
    summary: 'List Staff Members',
    description: 'Lists all staff members and their assigned outlet IDs for the current restaurant.',
    responses: {
      200: z.array(StaffResponseSchema),
    },
  }),
  requirePermission('member:read'),
  async (c) => {
    const { restaurantId } = c.get('tenant');

    const cached = await cacheGet<any[]>(kv(c), CacheKey.staff(restaurantId));
    if (cached) return c.json(cached);

    const { db, close } = getDb(c);
    try {
      const result = await getStaffList(db, restaurantId);
      await cacheSet(kv(c), CacheKey.staff(restaurantId), result, TTL.staff);
      return c.json(result);
    } finally {
      await close();
    }
  }
);

// POST /staff — add a staff member directly (immediate active status)
app.post(
  '/',
  apiDoc({
    tags: ['Staff'],
    summary: 'Add Staff Member',
    description: 'Adds a new staff member with assigned role and outlet access directly.',
    body: AddStaffSchema,
    responses: {
      201: StaffResponseSchema,
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requirePermission('member:write'),
  handleAddStaff
);

// POST /staff/invite — backwards compatibility endpoint pointing to handleAddStaff
app.post(
  '/invite',
  apiDoc({
    tags: ['Staff'],
    summary: 'Add/Invite Staff Member',
    description: 'Adds a new staff member directly (backward compatible route).',
    body: AddStaffSchema,
    responses: {
      201: StaffResponseSchema,
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requirePermission('member:write'),
  handleAddStaff
);

// PUT /staff/:id — update name, role, outlets, or status
app.put(
  '/:id',
  apiDoc({
    tags: ['Staff'],
    summary: 'Update Staff Member',
    description: 'Updates name, role, assigned outlet IDs, or active status for a staff member.',
    params: z.object({ id: z.string() }),
    body: UpdateStaffSchema,
    responses: {
      200: StaffResponseSchema,
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
    const staffId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateStaffSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
    }

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select()
        .from(appSchema.outletStaff)
        .where(and(eq(appSchema.outletStaff.id, staffId), eq(appSchema.outletStaff.restaurantId, restaurantId)))
        .limit(1);
      if (!existing) return c.json({ error: 'Not Found', message: 'Staff member not found' }, 404);
      if (existing.role === 'OWNER') return c.json({ error: 'Forbidden', message: 'Cannot modify the owner' }, 403);

      const targetPhone = existing.phone;

      if (parsed.data.outletIds) {
        for (const oid of parsed.data.outletIds) {
          if (!assertOutletAccess(tenant, oid)) {
            return c.json({ error: 'Forbidden', message: `You do not have permission to assign outlet '${oid}'` }, 403);
          }
        }
      }

      const now = new Date();
      await db.transaction(async (tx: any) => {
        const updateFields: any = { updatedAt: now, updatedBy: actorPhone };
        if (parsed.data.name !== undefined) updateFields.name = parsed.data.name.trim();
        if (parsed.data.role) updateFields.role = parsed.data.role;
        if (parsed.data.status) updateFields.status = parsed.data.status;

        // Apply field updates
        await tx
          .update(appSchema.outletStaff)
          .set(updateFields)
          .where(and(eq(appSchema.outletStaff.restaurantId, restaurantId), eq(appSchema.outletStaff.phone, targetPhone)));

        // If outletIds is supplied, synchronize outlet assignments
        if (parsed.data.outletIds && parsed.data.outletIds.length > 0) {
          const newOutletIds = parsed.data.outletIds;
          const currentRows = await tx
            .select()
            .from(appSchema.outletStaff)
            .where(and(eq(appSchema.outletStaff.restaurantId, restaurantId), eq(appSchema.outletStaff.phone, targetPhone)));

          const currentOutletIds = currentRows.map((r: any) => r.outletId).filter(Boolean);
          const toAdd = newOutletIds.filter((oid: string) => !currentOutletIds.includes(oid));
          const toRemove = currentOutletIds.filter((oid: string) => !newOutletIds.includes(oid));

          if (toRemove.length > 0) {
            await tx
              .delete(appSchema.outletStaff)
              .where(
                and(
                  eq(appSchema.outletStaff.restaurantId, restaurantId),
                  eq(appSchema.outletStaff.phone, targetPhone),
                  inArray(appSchema.outletStaff.outletId, toRemove)
                )
              );
          }

          for (const oid of toAdd) {
            await tx.insert(appSchema.outletStaff).values({
              id: generateId('staff'),
              restaurantId,
              outletId: oid,
              userId: existing.userId,
              phone: targetPhone,
              name: updateFields.name ?? existing.name,
              role: updateFields.role ?? existing.role,
              status: updateFields.status ?? existing.status,
              createdAt: now,
              updatedAt: now,
              createdBy: actorPhone,
              updatedBy: actorPhone,
            });
          }
        }
      });

      const [updated] = await getStaffList(db, restaurantId, staffId);
      await invalidateStaff(kv(c), restaurantId);
      return c.json(updated);
    } finally {
      await close();
    }
  }
);

// DELETE /staff/:id — remove a staff member
app.delete(
  '/:id',
  apiDoc({
    tags: ['Staff'],
    summary: 'Remove Staff Member',
    description: 'Removes a staff member and their outlet assignments.',
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
    const staffId = c.req.param('id');

    const { db, close } = getDb(c);
    try {
      const [existing] = await db
        .select({ id: appSchema.outletStaff.id, role: appSchema.outletStaff.role, phone: appSchema.outletStaff.phone })
        .from(appSchema.outletStaff)
        .where(and(eq(appSchema.outletStaff.id, staffId), eq(appSchema.outletStaff.restaurantId, restaurantId)))
        .limit(1);
      if (!existing) return c.json({ error: 'Not Found', message: 'Staff member not found' }, 404);
      if (existing.role === 'OWNER') return c.json({ error: 'Forbidden', message: 'Cannot remove the owner' }, 403);

      await db
        .delete(appSchema.outletStaff)
        .where(and(eq(appSchema.outletStaff.restaurantId, restaurantId), eq(appSchema.outletStaff.phone, existing.phone)));

      await invalidateStaff(kv(c), restaurantId);
      return c.json({ success: true, message: 'Staff member removed' });
    } finally {
      await close();
    }
  }
);

export { app as staffRoutes };
