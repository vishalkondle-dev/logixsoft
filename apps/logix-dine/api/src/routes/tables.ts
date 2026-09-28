import { Hono } from 'hono';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, assertOutletAccess } from '../lib/tenancy';
import { toPosTable } from '@logixsoft/logix-dine/mappers/pos';
import { PosTableSchema } from '@logixsoft/logix-dine/schemas/pos';
import type { AuthEnv } from '../lib/auth';
import * as z from 'zod';
import { cacheGet, cacheSet, invalidateTables, CacheKey, TTL } from '../lib/cache';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { getDb } from '../lib/order-helpers';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();
function kv(c: any) { return c.env?.CACHE; }

const CreateTableSchema = z.object({
  outletId: z.string(),
  name: z.string().min(1).max(50),
  section: z.string().max(50).optional(),
  capacity: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
});

const UpdateTableSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  section: z.string().max(50).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const TransferTableSchema = z.object({
  outletId: z.string(),
  fromTableNo: z.string().min(1),
  toTableNo: z.string().min(1),
});

// ─── GET /tables/list ─────────────────────────────────────────────────────────
async function handleListTables(c: any) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const outletId = c.req.query('outletId');
  if (outletId && !assertOutletAccess(tenant, outletId)) {
    return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${outletId}'` }, 403);
  }

  const includeInactive = c.req.query('includeInactive') === 'true';
  const cacheKey = CacheKey.tables(restaurantId, outletId, includeInactive);

  const cached = await cacheGet<ReturnType<typeof toPosTable>[]>(kv(c), cacheKey);
  if (cached) return c.json(cached);

  const { db, close } = getDb(c);
  try {
    const conditions = [
      eq(appSchema.posTable.restaurantId, restaurantId),
    ];
    if (!includeInactive) {
      conditions.push(eq(appSchema.posTable.active, true));
    }
    if (outletId) {
      conditions.push(eq(appSchema.posTable.outletId, outletId));
    } else if (!tenant.allOutlets && tenant.role !== 'OWNER' && tenant.role !== 'ADMIN') {
      conditions.push(inArray(appSchema.posTable.outletId, tenant.outletIds || ['__none__']));
    }
    const tables = await db.select().from(appSchema.posTable).where(and(...conditions));
    const result = tables.map(toPosTable);
    await cacheSet(kv(c), cacheKey, result, TTL.tables);
    return c.json(result);
  } finally {
    await close();
  }
}

app.get(
  '/',
  apiDoc({
    tags: ['Tables'],
    summary: 'List Dining Tables',
    description: 'Retrieves all active dining tables for the restaurant or filtered by outletId.',
    query: z.object({ outletId: z.string().optional(), includeInactive: z.string().optional() }),
    responses: { 200: z.array(PosTableSchema) },
  }),
  requirePermission('table:read'),
  handleListTables
);

app.get(
  '/list',
  requirePermission('table:read'),
  handleListTables
);

// ─── POST /tables/create & POST /tables ───────────────────────────────────────
async function handleCreateTable(c: any) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = tenant.phone || tenant.phoneNumber || '';
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateTableSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  if (!assertOutletAccess(tenant, parsed.data.outletId)) {
    return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${parsed.data.outletId}'` }, 403);
  }

  const { db, close } = getDb(c);
  try {
    const id = generateId('tbl');
    const now = new Date();
    await db.insert(appSchema.posTable).values({
      id,
      restaurantId,
      outletId: parsed.data.outletId,
      name: parsed.data.name,
      section: parsed.data.section ?? null,
      capacity: parsed.data.capacity ?? 4,
      sortOrder: parsed.data.sortOrder ?? 0,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: actorPhone,
      updatedBy: actorPhone,
    });

    const [created] = await db.select().from(appSchema.posTable).where(eq(appSchema.posTable.id, id));
    await invalidateTables(kv(c), restaurantId);
    broadcastToOutlet(c.env, parsed.data.outletId, {
      topic: 'TABLES',
      type: 'TABLE_CREATED',
      data: { tableId: id },
    });
    return c.json(toPosTable(created), 201);
  } finally {
    await close();
  }
}

app.post(
  '/',
  apiDoc({
    tags: ['Tables'],
    summary: 'Create Dining Table',
    description: 'Creates a new dining table in the specified outlet.',
    body: CreateTableSchema,
    responses: { 201: PosTableSchema, 400: ErrorResponseSchema },
  }),
  requirePermission('table:write'),
  handleCreateTable
);

app.post(
  '/create',
  requirePermission('table:write'),
  handleCreateTable
);

// ─── POST /tables/update/:id & PUT /tables/:id ────────────────────────────────
async function handleUpdateTable(c: any, tableId: string) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = tenant.phone || tenant.phoneNumber || '';
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateTableSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select()
      .from(appSchema.posTable)
      .where(and(eq(appSchema.posTable.id, tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);

    if (!assertOutletAccess(tenant, existing.outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${existing.outletId}'` }, 403);
    }

    await db
      .update(appSchema.posTable)
      .set({ ...parsed.data, updatedAt: new Date(), updatedBy: actorPhone })
      .where(eq(appSchema.posTable.id, tableId));

    const [updated] = await db.select().from(appSchema.posTable).where(eq(appSchema.posTable.id, tableId));
    await invalidateTables(kv(c), restaurantId);
    broadcastToOutlet(c.env, existing.outletId, {
      topic: 'TABLES',
      type: 'TABLE_UPDATED',
      data: { tableId },
    });
    return c.json(toPosTable(updated));
  } finally {
    await close();
  }
}

app.put(
  '/:id',
  apiDoc({
    tags: ['Tables'],
    summary: 'Update Dining Table',
    description: 'Updates table details (name, section, capacity).',
    body: UpdateTableSchema,
    responses: { 200: PosTableSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('table:write'),
  async (c) => handleUpdateTable(c, c.req.param('id'))
);

app.post(
  '/update/:id',
  requirePermission('table:write'),
  async (c) => handleUpdateTable(c, c.req.param('id'))
);

// ─── POST /tables/toggle-active/:id & PATCH /tables/:id/toggle ────────────────
async function handleToggleTable(c: any, tableId: string) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = tenant.phone || tenant.phoneNumber || '';

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select()
      .from(appSchema.posTable)
      .where(and(eq(appSchema.posTable.id, tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);

    if (!assertOutletAccess(tenant, existing.outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${existing.outletId}'` }, 403);
    }

    await db
      .update(appSchema.posTable)
      .set({ active: !existing.active, updatedAt: new Date(), updatedBy: actorPhone })
      .where(eq(appSchema.posTable.id, tableId));

    const [updated] = await db.select().from(appSchema.posTable).where(eq(appSchema.posTable.id, tableId));
    await invalidateTables(kv(c), restaurantId);
    broadcastToOutlet(c.env, existing.outletId, {
      topic: 'TABLES',
      type: 'TABLE_TOGGLED',
      data: { tableId, active: !existing.active },
    });
    return c.json(toPosTable(updated));
  } finally {
    await close();
  }
}

app.patch(
  '/:id/toggle',
  apiDoc({
    tags: ['Tables'],
    summary: 'Toggle Table Active Status',
    description: 'Flips table active/inactive.',
    responses: { 200: PosTableSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('table:write'),
  async (c) => handleToggleTable(c, c.req.param('id'))
);

app.post(
  '/toggle-active/:id',
  requirePermission('table:write'),
  async (c) => handleToggleTable(c, c.req.param('id'))
);

// ─── POST /tables/delete/:id & DELETE /tables/:id ─────────────────────────────
async function handleDeleteTable(c: any, tableId: string) {
  const tenant = c.get('tenant');
  const { restaurantId } = tenant;
  const actorPhone = tenant.phone || tenant.phoneNumber || '';

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select({ id: appSchema.posTable.id, outletId: appSchema.posTable.outletId })
      .from(appSchema.posTable)
      .where(and(eq(appSchema.posTable.id, tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);

    if (!assertOutletAccess(tenant, existing.outletId)) {
      return c.json({ error: 'Forbidden', message: `You do not have access to outlet '${existing.outletId}'` }, 403);
    }

    await db
      .update(appSchema.posTable)
      .set({ active: false, updatedAt: new Date(), updatedBy: actorPhone })
      .where(eq(appSchema.posTable.id, tableId));

    await invalidateTables(kv(c), restaurantId);
    broadcastToOutlet(c.env, existing.outletId, {
      topic: 'TABLES',
      type: 'TABLE_DELETED',
      data: { tableId },
    });
    return c.json({ success: true });
  } finally {
    await close();
  }
}

app.delete(
  '/:id',
  apiDoc({
    tags: ['Tables'],
    summary: 'Delete Dining Table',
    description: 'Soft-deletes table.',
    responses: { 200: SuccessResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('table:write'),
  async (c) => handleDeleteTable(c, c.req.param('id'))
);

app.post(
  '/delete/:id',
  requirePermission('table:write'),
  async (c) => handleDeleteTable(c, c.req.param('id'))
);

// ─── POST /tables/transfer ────────────────────────────────────────────────────
app.post(
  '/transfer',
  apiDoc({
    tags: ['Tables'],
    summary: 'Transfer Table Order',
    description: 'Transfers an active dine-in order from one table to another table.',
    body: TransferTableSchema,
    responses: { 200: SuccessResponseSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema },
  }),
  requirePermission('order:create'),
  async (c) => {
    const tenant = c.get('tenant');
    const { restaurantId } = tenant;
    const body = await c.req.json().catch(() => ({}));
    const parsed = TransferTableSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

    const { outletId, fromTableNo, toTableNo } = parsed.data;
    if (!assertOutletAccess(tenant, outletId)) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
    }

    const { db, close } = getDb(c);
    try {
      const [activeOrder] = await db
        .select()
        .from(appSchema.saleOrder)
        .where(
          and(
            eq(appSchema.saleOrder.restaurantId, restaurantId),
            eq(appSchema.saleOrder.outletId, outletId),
            eq(appSchema.saleOrder.tableNo, fromTableNo),
            eq(appSchema.saleOrder.status, 'OPEN'),
            isNull(appSchema.saleOrder.tableFreedAt)
          )
        )
        .limit(1);

      if (!activeOrder) {
        return c.json({ error: 'Not Found', message: `No active order found on table ${fromTableNo}` }, 404);
      }

      await db
        .update(appSchema.saleOrder)
        .set({ tableNo: toTableNo, updatedAt: new Date() })
        .where(eq(appSchema.saleOrder.id, activeOrder.id));

      broadcastToOutlet(c.env, outletId, {
        topic: 'TABLES',
        type: 'TABLE_TRANSFERRED',
        data: { orderId: activeOrder.id, fromTableNo, toTableNo },
      });

      return c.json({ success: true, message: `Order transferred from ${fromTableNo} to ${toTableNo}` });
    } finally {
      await close();
    }
  }
);

export { app as tableRoutes };
