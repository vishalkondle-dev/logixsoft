import { Hono } from 'hono';
import { eq, and, or } from 'drizzle-orm';
import * as z from 'zod';
import { createDbWithClient, appSchema } from '../db';
import { requirePermission, requireAuth, requireMembership, buildSessionPayload, resolveSessionPayload } from '../lib/tenancy';
import { isAllOutletRole } from '@logixsoft/logix-dine/types/roles';
import type { RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import { RestaurantSchema, UpdateRestaurantSchema } from '@logixsoft/logix-dine/schemas/pos';
import { toRestaurant } from '@logixsoft/logix-dine/mappers/pos';
import type { AuthEnv } from '../lib/auth';
import { invalidateRestaurant, setSessionPayload } from '../lib/cache';
import { apiDoc, ErrorResponseSchema } from '../lib/openapi';

const app = new Hono<{ Bindings: AuthEnv }>();

function getDb(c: any) {
  const url = c.env?.HYPERDRIVE?.connectionString || c.env?.DATABASE_URL || '';
  return createDbWithClient({ connectionString: url, schema: appSchema, maxConnections: 1 });
}

function kv(c: any) { return c.env?.CACHE; }

// GET /restaurants/me
app.get(
  '/me',
  apiDoc({
    tags: ['Restaurants'],
    summary: 'Get Current Restaurant',
    description: 'Fetches details of the currently selected restaurant (scoped by X-Restaurant-Id header).',
    responses: {
      200: RestaurantSchema,
      404: ErrorResponseSchema,
    },
  }),
  requireMembership(),
  async (c) => {
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
app.get(
  '/',
  apiDoc({
    tags: ['Restaurants'],
    summary: 'List User Restaurants',
    description: 'Lists all restaurants where the current authenticated user has active membership.',
    responses: {
      200: z.array(RestaurantSchema),
    },
  }),
  requireAuth(),
  async (c) => {
  const user = c.get('sessionUser') as any;
  const { db, close } = getDb(c);
  try {
    if (user?.role === 'ADMIN') {
      // Platform superadmin has strictly only the ADMIN role and is not a member of any restaurant
      return c.json([]);
    }

    const phone = user?.phoneNumber ?? null;
    const staffConditions = [eq(appSchema.outletStaff.userId, user.id)];
    if (phone) {
      staffConditions.push(eq(appSchema.outletStaff.phone, phone));
    }
    const staffRows = await db
      .select({ restaurantId: appSchema.outletStaff.restaurantId })
      .from(appSchema.outletStaff)
      .where(and(or(...staffConditions), eq(appSchema.outletStaff.status, 'ACTIVE')));

    const restaurantIds = Array.from(new Set(staffRows.map((m: any) => m.restaurantId)));
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
app.get(
  '/my-role',
  apiDoc({
    tags: ['Restaurants'],
    summary: 'Get Role in Current Restaurant',
    description: 'Returns role and accessible outlet IDs for current restaurant session.',
    responses: {
      200: z.object({
        role: z.string(),
        roleName: z.string().optional(),
        permissions: z.array(z.string()).optional(),
        outletIds: z.array(z.string()),
        allOutlets: z.boolean(),
      }),
    },
  }),
  requireAuth(),
  async (c) => {
    const sessionUser = c.get('sessionUser') as any;
    if (!sessionUser) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const restaurantId = c.req.header('X-Restaurant-Id');
    if (!restaurantId) {
      return c.json({ error: 'Bad Request', message: 'X-Restaurant-Id header required' }, 400);
    }

    if (sessionUser.role === 'ADMIN') {
      return c.json({
        role: 'ADMIN',
        roleName: 'Platform Admin',
        permissions: ['*'],
        outletIds: [],
        allOutlets: true,
      });
    }

    // Always fetch fresh memberships from DB for real-time role accuracy
    const freshPayload = await buildSessionPayload(c, sessionUser);
    if (!freshPayload) {
      return c.json({ error: 'Unauthorized', message: 'Failed to resolve user session' }, 401);
    }

    // Update KV cache synchronously with fresh payload so subsequent API requests immediately reflect the new role
    const { token } = await resolveSessionPayload(c);
    if (token && c.env?.CACHE) {
      await setSessionPayload(c.env.CACHE, token, freshPayload).catch(() => {});
    }

    const membership = freshPayload.memberships.find((m) => m.restaurantId === restaurantId);
    if (!membership) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this restaurant' }, 403);
    }

    return c.json({
      role: membership.role,
      roleName: membership.roleName || membership.role,
      permissions: membership.permissions ?? [],
      outletIds: membership.outletIds ?? [],
      allOutlets: !!membership.allOutlets,
    });
  });

// PUT /restaurants/:id
app.put(
  '/:id',
  apiDoc({
    tags: ['Restaurants'],
    summary: 'Update Restaurant Details',
    description: 'Updates restaurant name, address, or contact phone.',
    params: z.object({ id: z.string() }),
    body: UpdateRestaurantSchema,
    responses: {
      200: RestaurantSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  }),
  requirePermission('restaurant:write'),
  async (c) => {
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
