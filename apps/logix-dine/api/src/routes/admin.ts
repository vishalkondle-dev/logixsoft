import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import * as z from 'zod';
import { createDbWithClient, appSchema } from '../db';
import { requireAdmin } from '../lib/tenancy';
import { RestaurantSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

export const AdminUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  role: z.string(),
  createdAt: z.any(),
});

// GET /admin/restaurants
app.get(
  '/restaurants',
  apiDoc({
    tags: ['Admin'],
    summary: 'List All Restaurants (Admin)',
    description: 'Returns all restaurants across the platform (superadmin only).',
    responses: {
      200: z.array(RestaurantSchema),
      403: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurants = await db.select().from(appSchema.restaurant);
    return c.json(restaurants.map(toRestaurant));
  } finally {
    await close();
  }
});

// GET /admin/users
app.get(
  '/users',
  apiDoc({
    tags: ['Admin'],
    summary: 'List All Users (Admin)',
    description: 'Returns all users registered on the platform (superadmin only).',
    responses: {
      200: z.array(AdminUserSchema),
      403: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
  const { db, close } = getDb(c);
  try {
    const users = await db
      .select({
        id: appSchema.user.id,
        name: appSchema.user.name,
        phoneNumber: appSchema.user.phoneNumber,
        role: appSchema.user.role,
        createdAt: appSchema.user.createdAt,
      })
      .from(appSchema.user);
    return c.json(users);
  } finally {
    await close();
  }
});

// PATCH /admin/users/:id/role
app.patch(
  '/users/:id/role',
  apiDoc({
    tags: ['Admin'],
    summary: 'Update User Role (Admin)',
    description: 'Updates a platform user role (ADMIN, OWNER, CUSTOMER).',
    params: z.object({ id: z.string() }),
    body: z.object({
      role: z.enum(['ADMIN', 'OWNER', 'CUSTOMER']),
    }),
    responses: {
      200: z.object({
        id: z.string(),
        name: z.string().nullable(),
        role: z.string(),
      }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireAdmin(),
  async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { role } = body;
  if (!role || !['ADMIN', 'OWNER', 'CUSTOMER'].includes(role)) {
    return c.json({ error: 'Validation Error', message: 'role must be ADMIN, OWNER, or CUSTOMER' }, 400);
  }

  const { db, close } = getDb(c);
  try {
    await db
      .update(appSchema.user)
      .set({ role, updatedAt: new Date() })
      .where(eq(appSchema.user.id, userId));
    const [updated] = await db
      .select({ id: appSchema.user.id, name: appSchema.user.name, role: appSchema.user.role })
      .from(appSchema.user)
      .where(eq(appSchema.user.id, userId));
    if (!updated) return c.json({ error: 'Not Found' }, 404);
    return c.json(updated);
  } finally {
    await close();
  }
});

export { app as adminRoutes };
