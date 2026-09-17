import type { Context, MiddlewareHandler } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbWithClient } from '../db';
import { appSchema } from '../db';
import { ROLE_PERMISSIONS, type Permission } from '@logixsoft/logix-dine/types/roles';
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

/**
 * Require an authenticated session.
 * Sets c.var.sessionUser on success.
 */
export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    c.set('sessionUser', user);
    await next();
  };
}

/**
 * Require a specific permission on a restaurant.
 * Reads X-Restaurant-Id header, looks up restaurantMember, checks ROLE_PERMISSIONS.
 * ADMIN bypasses membership check entirely.
 * Sets c.var.tenant = { restaurantId, role, member }.
 */
export function requirePermission(permission: Permission): MiddlewareHandler {
  return async (c, next) => {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    c.set('sessionUser', user);

    // Platform ADMIN bypasses all restaurant checks
    if ((user as any).role === 'ADMIN') {
      const restaurantId = c.req.header('X-Restaurant-Id') ?? '';
      c.set('tenant', { restaurantId, role: 'OWNER', member: null });
      return next();
    }

    const restaurantId = c.req.header('X-Restaurant-Id');
    if (!restaurantId) {
      return c.json({ error: 'Bad Request', message: 'X-Restaurant-Id header required' }, 400);
    }

    const overrides = { ...(c.env as AuthEnv) };
    const hyperdriveUrl = (c.env as any)?.HYPERDRIVE?.connectionString;
    if (hyperdriveUrl) overrides.DATABASE_URL = hyperdriveUrl;

    const { db, close } = createDbWithClient({
      connectionString: overrides.DATABASE_URL || '',
      schema: appSchema,
      maxConnections: 1,
    });

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

      c.set('tenant', { restaurantId, role: member.role, member });
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
    await next();
  };
}
