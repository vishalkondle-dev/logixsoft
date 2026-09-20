import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission } from '../lib/tenancy';
import { toPosTable } from '@logixsoft/logix-dine/mappers/pos';
import { PosTableSchema } from '@logixsoft/logix-dine/schemas/pos';
import type { AuthEnv } from '../lib/auth';
import * as z from 'zod';
import { cacheGet, cacheSet, invalidateTables, CacheKey, TTL } from '../lib/cache';
import { broadcastToOutlet } from '../lib/sync';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv & { OUTLET_ROOM?: DurableObjectNamespace } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

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

// GET /tables — list active tables for tenant, optionally filtered by outletId
app.get(
  '/',
  apiDoc({
    tags: ['Tables'],
    summary: 'List Dining Tables',
    description: 'Retrieves all active dining tables for the restaurant or filtered by outletId.',
    query: z.object({
      outletId: z.string().optional(),
    }),
    responses: {
      200: z.array(PosTableSchema),
    },
  }),
  requirePermission('table:read'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const outletId = c.req.query('outletId');
  const cacheKey = CacheKey.tables(restaurantId, outletId);

  const cached = await cacheGet<ReturnType<typeof toPosTable>[]>(kv(c), cacheKey);
  if (cached) return c.json(cached);

  const { db, close } = getDb(c);
  try {
    const where = outletId
      ? and(eq(appSchema.posTable.restaurantId, restaurantId), eq(appSchema.posTable.outletId, outletId))
      : eq(appSchema.posTable.restaurantId, restaurantId);
    const tables = await db.select().from(appSchema.posTable).where(where);
    const result = tables.map(toPosTable);
    await cacheSet(kv(c), cacheKey, result, TTL.tables);
    return c.json(result);
  } finally {
    await close();
  }
});

// POST /tables — create a table
app.post(
  '/',
  apiDoc({
    tags: ['Tables'],
    summary: 'Create Dining Table',
    description: 'Creates a new dining table in the specified outlet.',
    body: CreateTableSchema,
    responses: {
      201: PosTableSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
  }),
  requirePermission('table:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const actorPhone = c.get('actorPhone');
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateTableSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
  }

  const { db, close } = getDb(c);
  try {
    const [outlet] = await db
      .select({ id: appSchema.restaurantOutlet.id })
      .from(appSchema.restaurantOutlet)
      .where(and(eq(appSchema.restaurantOutlet.id, parsed.data.outletId), eq(appSchema.restaurantOutlet.restaurantId, restaurantId)));
    if (!outlet) return c.json({ error: 'Not Found', message: 'Outlet not found' }, 404);

    const [dup] = await db
      .select({ id: appSchema.posTable.id })
      .from(appSchema.posTable)
      .where(and(eq(appSchema.posTable.outletId, parsed.data.outletId), eq(appSchema.posTable.name, parsed.data.name)));
    if (dup) return c.json({ error: 'Conflict', message: 'A table with this name already exists in this outlet' }, 409);

    const id = generateId('table');
    const now = new Date();
    await db.insert(appSchema.posTable).values({
      id,
      restaurantId,
      outletId: parsed.data.outletId,
      name: parsed.data.name,
      section: parsed.data.section ?? null,
      capacity: parsed.data.capacity ?? null,
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
});

// PUT /tables/:id — update a table
app.put(
  '/:id',
  apiDoc({
    tags: ['Tables'],
    summary: 'Update Dining Table',
    description: 'Updates table name, section, capacity, or sort order.',
    params: z.object({ id: z.string() }),
    body: UpdateTableSchema,
    responses: {
      200: PosTableSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('table:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const actorPhone = c.get('actorPhone');
  const tableId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateTableSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);
  }

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select()
      .from(appSchema.posTable)
      .where(and(eq(appSchema.posTable.id, tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);

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
});

// PATCH /tables/:id/toggle — flip active/inactive
app.patch(
  '/:id/toggle',
  apiDoc({
    tags: ['Tables'],
    summary: 'Toggle Table Active Status',
    description: 'Toggles a dining table between active and inactive states.',
    params: z.object({ id: z.string() }),
    responses: {
      200: PosTableSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('table:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const actorPhone = c.get('actorPhone');
  const tableId = c.req.param('id');

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select()
      .from(appSchema.posTable)
      .where(and(eq(appSchema.posTable.id, tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);

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
});

// DELETE /tables/:id — soft-delete (set active=false, preserves order history)
app.delete(
  '/:id',
  apiDoc({
    tags: ['Tables'],
    summary: 'Soft Delete Dining Table',
    description: 'Deactivates the dining table to preserve order history.',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('table:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const actorPhone = c.get('actorPhone');
  const tableId = c.req.param('id');

  const { db, close } = getDb(c);
  try {
    const [existing] = await db
      .select({ id: appSchema.posTable.id, outletId: appSchema.posTable.outletId })
      .from(appSchema.posTable)
      .where(and(eq(appSchema.posTable.id, tableId), eq(appSchema.posTable.restaurantId, restaurantId)));
    if (!existing) return c.json({ error: 'Not Found' }, 404);

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
});

export { app as tableRoutes };
