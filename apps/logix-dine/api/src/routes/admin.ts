import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbWithClient, appSchema } from '../db';
import { requireAdmin } from '../lib/tenancy';
import { toRestaurant } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';

const app = new Hono<{ Bindings: AuthEnv & { HYPERDRIVE?: { connectionString: string } } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// GET /admin/restaurants
app.get('/restaurants', requireAdmin(), async (c) => {
  const { db, close } = getDb(c);
  try {
    const restaurants = await db.select().from(appSchema.restaurant);
    return c.json(restaurants.map(toRestaurant));
  } finally {
    await close();
  }
});

// GET /admin/users
app.get('/users', requireAdmin(), async (c) => {
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
app.patch('/users/:id/role', requireAdmin(), async (c) => {
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
