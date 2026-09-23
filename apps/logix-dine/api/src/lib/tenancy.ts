import type { Context, MiddlewareHandler } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbWithClient } from '../db';
import { appSchema } from '../db';
import {
  ROLE_PERMISSIONS, isAllOutletRole,
  type Permission, type RestaurantRole,
} from '@logixsoft/logix-dine/types/roles';
import type { AuthEnv } from './auth';
import { createAuth } from './auth';
import {
  extractSessionToken, getSessionPayload, setSessionPayload, isJwtToken,
  type SessionPayload, type MembershipEntry,
} from './cache';
import { verifySessionJwt } from './jwt';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kv(c: Context): any { return (c.env as any)?.CACHE; }

export function getSecret(c: Context): string {
  const env = (c.env as any) || {};
  return (
    env.BETTER_AUTH_SECRET ||
    'logix_dine_secret_key_2026_super_secure_random_hash_session_cookie_auth'
  );
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
 * Build a complete SessionPayload from DB.
 * Called only on cache miss (first request after login, or after eviction).
 * Fetches all memberships + ALL permitted outletIds (including for OWNER) in one shot.
 */
export async function buildSessionPayload(
  c: Context,
): Promise<SessionPayload | null> {
  const { auth, close: closeAuth } = createAuth(c.env);
  let authUser: any = null;
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    authUser = session?.user ?? null;
  } finally {
    await closeAuth();
  }
  if (!authUser) return null;

  const { db, close } = dbFromEnv(c);
  try {
    const members = await db
      .select()
      .from(appSchema.restaurantMember)
      .where(eq(appSchema.restaurantMember.userId, authUser.id));

    const memberships: MembershipEntry[] = await Promise.all(
      members.map(async (m: any) => {
        const allOutlets = isAllOutletRole(m.role as RestaurantRole);
        let outletIds: string[] = [];
        if (allOutlets) {
          // For OWNER / ALL_OUTLET_ROLES: Fetch all active outlets of their restaurant
          const rows = await db
            .select({ id: appSchema.restaurantOutlet.id })
            .from(appSchema.restaurantOutlet)
            .where(eq(appSchema.restaurantOutlet.restaurantId, m.restaurantId));
          outletIds = rows.map((r: any) => r.id);
        } else {
          // For MANAGER / WAITER / KITCHEN: Fetch explicitly assigned outlets
          const rows = await db
            .select({ outletId: appSchema.memberOutletAccess.outletId })
            .from(appSchema.memberOutletAccess)
            .where(eq(appSchema.memberOutletAccess.memberId, m.id));
          outletIds = rows.map((r: any) => r.outletId);
        }
        return {
          restaurantId: m.restaurantId,
          memberId: m.id,
          role: m.role,
          outletIds,
          allOutlets,
        };
      }),
    );

    return {
      user: {
        id: authUser.id,
        name: authUser.name ?? null,
        email: authUser.email ?? null,
        phoneNumber: (authUser as any).phoneNumber ?? null,
        role: (authUser as any).role ?? 'CUSTOMER',
        phoneNumberVerified: (authUser as any).phoneNumberVerified ?? false,
      },
      memberships,
    };
  } finally {
    await close();
  }
}

/**
 * Resolve session payload via JWT or KV without hitting the database on the hot path.
 * 1. If Bearer or Cookie is a signed JWT, verify & decode in 0ms (0 DB, 0 KV).
 * 2. If it's a session token, fetch from KV in 1 read (0 DB).
 * 3. Fallback to buildSessionPayload only on cache miss.
 */
export async function resolveSessionPayload(c: Context): Promise<{ payload: SessionPayload | null; token: string | null }> {
  const cookieHeader = c.req.header('Cookie') || c.req.header('cookie') || '';
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  const queryToken = c.req.query('token');
  const token = queryToken || extractSessionToken(cookieHeader, authHeader);

  if (!token) {
    const payload = await buildSessionPayload(c);
    return { payload, token: null };
  }

  // 1. JWT verification path: ZERO DB, ZERO KV
  if (isJwtToken(token)) {
    const secret = getSecret(c);
    const jwtPayload = await verifySessionJwt(token, secret);
    if (jwtPayload) {
      return { payload: jwtPayload, token };
    }
  }

  // 2. KV session cache path: ZERO DB
  const kvCache = kv(c);
  let payload: SessionPayload | null = kvCache ? await getSessionPayload(kvCache, token) : null;

  // 3. Cache miss: DB fallback, populate KV for subsequent requests
  if (!payload) {
    payload = await buildSessionPayload(c);
    if (payload && kvCache) {
      await setSessionPayload(kvCache, token, payload).catch(() => {});
    }
  }

  return { payload, token };
}

/**
 * Called from handleVerifyOtp after successful login.
 * Stores the complete session payload in KV so every subsequent request
 * is a single KV read with zero DB queries in the hot path.
 */
export async function storeSessionPayload(c: Context, token: string): Promise<void> {
  try {
    const payload = await buildSessionPayload(c);
    if (payload) await setSessionPayload(kv(c), token, payload);
  } catch (err) {
    console.warn('[storeSessionPayload] failed:', err);
  }
}

/**
 * Synchronous in-memory outlet permission check (ZERO DB CALLS).
 * Enforces that ANY role (including OWNER) can only act on outlets
 * they actually have permission for in their active restaurant session.
 */
export function assertOutletAccess(
  tenant: { role?: string; outletIds?: string[]; allOutlets?: boolean } | null | undefined,
  outletId: string | null | undefined,
): boolean {
  if (!outletId) return false;
  if (tenant?.role === 'ADMIN') return true;
  const allowed = tenant?.outletIds;
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(outletId);
}

// ─── hasOutletAccess — backward compatibility fallback ────────────────────────

export async function hasOutletAccess(
  db: any,
  memberId: string,
  role: string,
  outletId: string,
): Promise<boolean> {
  if (isAllOutletRole(role as RestaurantRole)) return true;
  const [row] = await db
    .select({ id: appSchema.memberOutletAccess.id })
    .from(appSchema.memberOutletAccess)
    .where(and(
      eq(appSchema.memberOutletAccess.memberId, memberId),
      eq(appSchema.memberOutletAccess.outletId, outletId),
    ))
    .limit(1);
  return !!row;
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const { payload } = await resolveSessionPayload(c);
    if (!payload) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    c.set('sessionUser', payload.user);
    c.set('actorPhone', payload.user.phoneNumber ?? null);
    c.set('memberships', payload.memberships);
    await next();
  };
}

// ─── requirePermission ────────────────────────────────────────────────────────

export function requirePermission(permission: Permission): MiddlewareHandler {
  return async (c, next) => {
    const { payload } = await resolveSessionPayload(c);
    if (!payload) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const { user, memberships } = payload;
    c.set('sessionUser', user);
    c.set('actorPhone', user.phoneNumber ?? null);
    c.set('memberships', memberships);

    const headerOutletId = c.req.header('X-Outlet-Id') || null;

    // Platform ADMIN bypasses everything
    if (user.role === 'ADMIN') {
      const restaurantId = c.req.header('X-Restaurant-Id') ?? '';
      c.set('tenant', {
        restaurantId,
        role: 'OWNER',
        member: null,
        outletId: headerOutletId,
        outletIds: headerOutletId ? [headerOutletId] : [],
        allOutlets: true,
      });
      return next();
    }

    const restaurantId = c.req.header('X-Restaurant-Id');
    if (!restaurantId) {
      return c.json({ error: 'Bad Request', message: 'X-Restaurant-Id header required' }, 400);
    }

    // ── Pure in-memory from here — ZERO DB, ZERO KV ───────────────────────────
    const membership = memberships.find((m) => m.restaurantId === restaurantId);
    if (!membership) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this restaurant' }, 403);
    }

    // Permission check — in-memory
    const rolePerms = ROLE_PERMISSIONS[membership.role as keyof typeof ROLE_PERMISSIONS] ?? [];
    if (!(rolePerms as readonly string[]).includes(permission)) {
      return c.json({ error: 'Forbidden', message: `Permission '${permission}' required` }, 403);
    }

    // Strict Outlet scope check for EVERY role (including OWNER)
    if (headerOutletId) {
      if (!membership.outletIds.includes(headerOutletId)) {
        return c.json({
          error: 'Forbidden',
          message: `You do not have access to outlet '${headerOutletId}'`,
        }, 403);
      }
    }

    c.set('tenant', {
      restaurantId,
      role: membership.role,
      member: { id: membership.memberId, restaurantId, role: membership.role, userId: user.id },
      outletId: headerOutletId,
      outletIds: membership.outletIds,
      allOutlets: membership.allOutlets,
    });
    await next();
  };
}

// ─── requireRole ───────────────────────────────────────────────────────────────

export function requireRole(allowedRoles: RestaurantRole | readonly RestaurantRole[]): MiddlewareHandler {
  const rolesArray = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]) as readonly string[];
  return async (c, next) => {
    const { payload } = await resolveSessionPayload(c);
    if (!payload) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    const { user, memberships } = payload;
    c.set('sessionUser', user);
    c.set('actorPhone', user.phoneNumber ?? null);
    c.set('memberships', memberships);

    const headerOutletId = c.req.header('X-Outlet-Id') || null;

    // Platform ADMIN bypasses everything
    if (user.role === 'ADMIN') {
      const restaurantId = c.req.header('X-Restaurant-Id') ?? '';
      c.set('tenant', {
        restaurantId,
        role: 'OWNER',
        member: null,
        outletId: headerOutletId,
        outletIds: headerOutletId ? [headerOutletId] : [],
        allOutlets: true,
      });
      return next();
    }

    const restaurantId = c.req.header('X-Restaurant-Id');
    if (!restaurantId) {
      return c.json({ error: 'Bad Request', message: 'X-Restaurant-Id header required' }, 400);
    }

    const membership = memberships.find((m) => m.restaurantId === restaurantId);
    if (!membership) {
      return c.json({ error: 'Forbidden', message: 'You do not have access to this restaurant' }, 403);
    }

    // Role check — in-memory
    if (!rolesArray.includes(membership.role)) {
      return c.json({
        error: 'Forbidden',
        message: `Role '${membership.role}' not authorized. Required: ${rolesArray.join(', ')}`,
      }, 403);
    }

    // Strict Outlet scope check
    if (headerOutletId) {
      if (!membership.outletIds.includes(headerOutletId)) {
        return c.json({
          error: 'Forbidden',
          message: `You do not have access to outlet '${headerOutletId}'`,
        }, 403);
      }
    }

    c.set('tenant', {
      restaurantId,
      role: membership.role,
      member: { id: membership.memberId, restaurantId, role: membership.role, userId: user.id },
      outletId: headerOutletId,
      outletIds: membership.outletIds,
      allOutlets: membership.allOutlets,
    });
    await next();
  };
}

// ─── Role-Based Convenience Middlewares ───────────────────────────────────────

export const requireOwner = (): MiddlewareHandler => requireRole(['OWNER']);
export const requireManager = (): MiddlewareHandler => requireRole(['OWNER', 'MANAGER']);
export const requireWaiter = (): MiddlewareHandler => requireRole(['OWNER', 'MANAGER', 'WAITER']);
export const requireKitchen = (): MiddlewareHandler => requireRole(['OWNER', 'MANAGER', 'KITCHEN']);

// ─── requireAdmin ─────────────────────────────────────────────────────────────

export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    const { payload } = await resolveSessionPayload(c);
    if (!payload) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }
    if (payload.user.role !== 'ADMIN') {
      return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403);
    }
    c.set('sessionUser', payload.user);
    c.set('actorPhone', payload.user.phoneNumber ?? null);
    c.set('memberships', payload.memberships);
    await next();
  };
}

