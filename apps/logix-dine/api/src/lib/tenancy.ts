import type { Context, MiddlewareHandler } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbWithClient } from '../db';
import { appSchema } from '../db';
import { ROLE_PERMISSIONS, isAllOutletRole, type Permission, type RestaurantRole } from '@logixsoft/logix-dine/types/roles';
import type { AuthEnv } from './auth';
import { createAuth } from './auth';

/** Get session user from better-auth. Returns null if unauthenticated. */
async function getSessionUser(c: Context) {
  const { auth, close } = createAuth(c.env);
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return session?.user ?? null;
  } finally {
    await close();
  }
}

function dbFromEnv(c: Context) {
  const overrides = { ...(c.env as AuthEnv) };
  const hyperdriveUrl = (c.env as any)?.HYPERDRIVE?.connectionString;
  if (hyperdriveUrl) overrides.DATABASE_URL = hyperdriveUrl;
  return createDbWithClient({
    connectionString: overrides.DATABASE_URL || '',
    schema: appSchema,
    maxConnections: 1,
  });
}

/**
 * Require an authenticated session.
 * Sets c.var.sessionUser and c.var.actorPhone on success.
 */
export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    c.set('sessionUser', user);
    c.set('actorPhone', (user as any).phoneNumber ?? null);
    await next();
  };
}

/**
 * Check whether a member has access to a given outlet.
 * OWNER (or any role in ALL_OUTLET_ROLES) always has access — no rows needed.
 * Other roles need a matching memberOutletAccess row.
 */
export async function hasOutletAccess(
  db: ReturnType<typeof dbFromEnv>['db'],
  memberId: string,
  role: string,
  outletId: string,
): Promise<boolean> {
  if (isAllOutletRole(role as RestaurantRole)) return true;
  const [row] = await db
    .select({ id: appSchema.memberOutletAccess.id })
    .from(appSchema.memberOutletAccess)
    .where(
      and(
        eq(appSchema.memberOutletAccess.memberId, memberId),
        eq(appSchema.memberOutletAccess.outletId, outletId),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Require a specific permission on a restaurant.
 * Reads X-Restaurant-Id header, looks up restaurantMember, checks ROLE_PERMISSIONS.
 * If X-Outlet-Id header is present, also enforces outlet-scoped access for
 * non-OWNER roles (MANAGER/WAITER/KITCHEN need a memberOutletAccess row).
 * ADMIN (platform role) bypasses membership + outlet checks entirely.
 * Sets c.var.tenant = { restaurantId, role, member, outletId } and c.var.actorPhone.
 */
export function requirePermission(permission: Permission): MiddlewareHandler {
  return async (c, next) => {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    c.set('sessionUser', user);
    c.set('actorPhone', (user as any).phoneNumber ?? null);

    const headerOutletId = c.req.header('X-Outlet-Id') || null;

    // Platform ADMIN bypasses all restaurant + outlet checks
    if ((user as any).role === 'ADMIN') {
      const restaurantId = c.req.header('X-Restaurant-Id') ?? '';
      c.set('tenant', { restaurantId, role: 'OWNER', member: null, outletId: headerOutletId });
      return next();
    }

    const restaurantId = c.req.header('X-Restaurant-Id');
    if (!restaurantId) {
      return c.json({ error: 'Bad Request', message: 'X-Restaurant-Id header required' }, 400);
    }

    const { db, close } = dbFromEnv(c);

    try {
      // Verify restaurant exists
      const [rest] = await db
        .select({ id: appSchema.restaurant.id })
        .from(appSchema.restaurant)
        .where(eq(appSchema.restaurant.id, restaurantId))
        .limit(1);

      if (!rest) return c.json({ error: 'Not Found', message: 'Restaurant not found' }, 404);

      // Look up membership
      const [member] = await db
        .select()
        .from(appSchema.restaurantMember)
        .where(
          and(
            eq(appSchema.restaurantMember.restaurantId, restaurantId),
            eq(appSchema.restaurantMember.userId, user.id),
          ),
        )
        .limit(1);

      if (!member) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this restaurant' }, 403);
      }

      // Check permission
      const rolePerms = ROLE_PERMISSIONS[member.role as keyof typeof ROLE_PERMISSIONS] ?? [];
      if (!(rolePerms as readonly string[]).includes(permission)) {
        return c.json({ error: 'Forbidden', message: `Permission '${permission}' required` }, 403);
      }

      // Outlet scope check — only enforced when the caller specified an outlet
      if (headerOutletId) {
        const allowed = await hasOutletAccess(db, member.id, member.role, headerOutletId);
        if (!allowed) {
          return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
        }
      }

      c.set('tenant', { restaurantId, role: member.role, member, outletId: headerOutletId });
      await next();
    } finally {
      await close();
    }
  };
}

/**
 * Require platform ADMIN role.
 */
export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    if ((user as any).role !== 'ADMIN') {
      return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403);
    }
    c.set('sessionUser', user);
    c.set('actorPhone', (user as any).phoneNumber ?? null);
    await next();
  };
}
