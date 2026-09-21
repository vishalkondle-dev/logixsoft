import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission } from '../lib/tenancy';
import {
  CreateOutletSchema,
  UpdateOutletSchema,
  RestaurantOutletSchema,
} from '@logixsoft/logix-dine/schemas/pos';
import { toOutlet } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema, SuccessResponseSchema } from '../lib/openapi';
import { invalidateRestaurant } from '../lib/cache';

const app = new Hono<{ Bindings: AuthEnv }>();

function kv(c: any) { return c.env?.CACHE; }

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// GET /outlets
app.get(
  '/',
  apiDoc({
    tags: ['Outlets'],
    summary: 'List Restaurant Outlets',
    description: 'Returns all outlets for the active restaurant.',
    responses: { 200: z.array(RestaurantOutletSchema) },
  }),
  requirePermission('outlet:read'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const { db, close } = getDb(c);
  try {
    const outlets = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
    return c.json(outlets.map(toOutlet));
  } finally {
    await close();
  }
});

// POST /outlets
app.post(
  '/',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Create Restaurant Outlet',
    description: 'Creates a new branch/outlet for the active restaurant.',
    body: CreateOutletSchema,
    responses: {
      201: RestaurantOutletSchema,
      400: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateOutletSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    const now = new Date();
    const id = generateId('outlet');
    await db.insert(appSchema.restaurantOutlet).values({
      id,
      restaurantId,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      upiId: parsed.data.upiId ?? null,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, id));
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json(toOutlet(outlet), 201);
  } finally {
    await close();
  }
});

// PUT /outlets/:id
app.put(
  '/:id',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Update Restaurant Outlet',
    description: 'Updates outlet name, address, phone number, or upiId.',
    params: z.object({ id: z.string() }),
    body: UpdateOutletSchema,
    responses: {
      200: RestaurantOutletSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const outletId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateOutletSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    await db
      .update(appSchema.restaurantOutlet)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(
        eq(appSchema.restaurantOutlet.id, outletId),
        eq(appSchema.restaurantOutlet.restaurantId, restaurantId),
      ));
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId));
    if (!outlet) return c.json({ error: 'Not Found' }, 404);
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json(toOutlet(outlet));
  } finally {
    await close();
  }
});

// DELETE /outlets/:id
app.delete(
  '/:id',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Delete Restaurant Outlet',
    description: 'Deletes an outlet (default outlet cannot be deleted).',
    params: z.object({ id: z.string() }),
    responses: {
      200: SuccessResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const outletId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(and(
        eq(appSchema.restaurantOutlet.id, outletId),
        eq(appSchema.restaurantOutlet.restaurantId, restaurantId),
      ));
    if (!outlet) return c.json({ error: 'Not Found' }, 404);
    if (outlet.isDefault) {
      return c.json({ error: 'Forbidden', message: 'Cannot delete the default outlet. Set another outlet as default first.' }, 403);
    }
    await db
      .delete(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId));
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json({ success: true });
  } finally {
    await close();
  }
});

// PATCH /outlets/:id/set-default
app.patch(
  '/:id/set-default',
  apiDoc({
    tags: ['Outlets'],
    summary: 'Set Outlet as Default',
    description: 'Sets this outlet as the default outlet for the restaurant.',
    params: z.object({ id: z.string() }),
    responses: {
      200: RestaurantOutletSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('outlet:write'),
  async (c) => {
  const { restaurantId } = c.get('tenant');
  const outletId = c.req.param('id');
  const { db, close } = getDb(c);
  try {
    await db.transaction(async (tx) => {
      // Unset all defaults
      await tx
        .update(appSchema.restaurantOutlet)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(appSchema.restaurantOutlet.restaurantId, restaurantId));
      // Set this one as default
      await tx
        .update(appSchema.restaurantOutlet)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(
          eq(appSchema.restaurantOutlet.id, outletId),
          eq(appSchema.restaurantOutlet.restaurantId, restaurantId),
        ));
    });
    const [outlet] = await db
      .select()
      .from(appSchema.restaurantOutlet)
      .where(eq(appSchema.restaurantOutlet.id, outletId));
    if (!outlet) return c.json({ error: 'Not Found' }, 404);
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json(toOutlet(outlet));
  } finally {
    await close();
  }
});

export { app as outletRoutes };
