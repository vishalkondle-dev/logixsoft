import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission } from '../lib/tenancy';
import { UpdateRestaurantSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';

const app = new Hono<{ Bindings: AuthEnv & { HYPERDRIVE?: { connectionString: string } } }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

// GET /restaurants/me
app.get('/me', requirePermission('restaurant:read'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const { db, close } = getDb(c);
  try {
    const [rest] = await db
      .select()
      .from(appSchema.restaurant)
      .where(eq(appSchema.restaurant.id, restaurantId))
      .limit(1);
    if (!rest) return c.json({ error: 'Not Found' }, 404);
    return c.json(toRestaurant(rest));
  } finally {
    await close();
  }
});

// GET /restaurants — list all restaurants the user is a member of
app.get('/', requirePermission('restaurant:read'), async (c) => {
  const user = c.get('sessionUser') as any;
  const { db, close } = getDb(c);
  try {
    const members = await db
      .select({ restaurantId: appSchema.restaurantMember.restaurantId })
      .from(appSchema.restaurantMember)
      .where(eq(appSchema.restaurantMember.userId, user.id));

    const restaurantIds = members.map((m: any) => m.restaurantId);
    if (!restaurantIds.length) return c.json([]);

    const restaurants = await db
      .select()
      .from(appSchema.restaurant)
      .where(eq(appSchema.restaurant.ownerUserId, user.id));

    return c.json(restaurants.map(toRestaurant));
  } finally {
    await close();
  }
});

// PUT /restaurants/:id
app.put('/:id', requirePermission('restaurant:write'), async (c) => {
  const { restaurantId } = c.get('tenant');
  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateRestaurantSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation Error', issues: parsed.error.issues }, 400);

  const { db, close } = getDb(c);
  try {
    await db
      .update(appSchema.restaurant)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(appSchema.restaurant.id, restaurantId));

    const [updated] = await db
      .select()
      .from(appSchema.restaurant)
      .where(eq(appSchema.restaurant.id, restaurantId));
    return c.json(toRestaurant(updated));
  } finally {
    await close();
  }
});

export { app as restaurantRoutes };
