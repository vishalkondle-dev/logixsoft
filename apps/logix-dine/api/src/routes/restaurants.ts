import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, requireAuth } from '../lib/tenancy';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import { UpdateRestaurantSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { invalidateRestaurant } from '../lib/cache';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) { return c.env?.CACHE; }

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

// GET /restaurants — list all restaurants the user is a member of (auth only, no restaurant context needed)
app.get('/', requireAuth(), async (c) => {
  const user = c.get('sessionUser') as any;
  const { db, close } = getDb(c);
  try {
    const members = await db
      .select({ restaurantId: appSchema.restaurantMember.restaurantId })
      .from(appSchema.restaurantMember)
      .where(eq(appSchema.restaurantMember.userId, user.id));

    const restaurantIds = members.map((m: any) => m.restaurantId);
    if (!restaurantIds.length) return c.json([]);

    // Fetch every restaurant this user has a membership row for — NOT just
    // ones they own. A staff member (MANAGER/WAITER/KITCHEN) is never the
    // restaurant's ownerUserId, so filtering on ownerUserId here would wrongly
    // return an empty list for every non-owner login (this was the actual
    // v1/v2 bug: it happened to work only because every member was also
    // the owner back then).
    const restaurants = await Promise.all(
      restaurantIds.map(async (id: string) => {
        const [r] = await db.select().from(appSchema.restaurant).where(eq(appSchema.restaurant.id, id)).limit(1);
        return r;
      }),
    );

    return c.json(restaurants.filter(Boolean).map(toRestaurant));
  } finally {
    await close();
  }
});

// GET /restaurants/my-role — the caller's role + outlet access in the current restaurant.
// Used by the web to decide which nav/pages to show (KITCHEN -> /kitchen, etc.)
// without needing a full /staff list call (which requires member:read, staff-only).
app.get('/my-role', requirePermission('restaurant:read'), async (c) => {
  const tenant = c.get('tenant');
  const { db, close } = getDb(c);
  try {
    if (!tenant.member) {
      // Platform ADMIN impersonation path — treat as OWNER, all outlets.
      return c.json({ role: tenant.role, outletIds: [] as string[], allOutlets: true });
    }
    if (isAllOutletRole(tenant.role as RestaurantRole)) {
      return c.json({ role: tenant.role, outletIds: [] as string[], allOutlets: true });
    }
    const rows = await db
      .select({ outletId: appSchema.memberOutletAccess.outletId })
      .from(appSchema.memberOutletAccess)
      .where(eq(appSchema.memberOutletAccess.memberId, (tenant.member as any).id));
    return c.json({ role: tenant.role, outletIds: rows.map((r: any) => r.outletId), allOutlets: false });
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
    await invalidateRestaurant(kv(c), restaurantId);
    return c.json(toRestaurant(updated));
  } finally {
    await close();
  }
});

export { app as restaurantRoutes };
