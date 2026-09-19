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
  extractSessionToken, getSessionPayload, setSessionPayload, cacheSet, cacheGet, CacheKey, TTL,
  type SessionPayload, type MembershipEntry,
} from './cache';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kv(c: Context): any { return (c.env as any)?.CACHE; }

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
 * Fetches all memberships + outletIds in one shot.
 */
async function buildSessionPayload(
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
        if (!allOutlets) {
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

// ─── hasOutletAccess — used only on cache-miss path ───────────────────────────

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
    const cookieHeader = c.req.header('Cookie') || c.req.header('cookie') || '';
    const token = extractSessionToken(cookieHeader);

    let payload: SessionPayload | null = token ? await getSessionPayload(kv(c), token) : null;

    if (!payload) {
      payload = await buildSessionPayload(c);
      if (!payload) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
      if (token) setSessionPayload(kv(c), token, payload).catch(() => {});
    }

    c.set('sessionUser', payload.user);
    c.set('actorPhone', payload.user.phoneNumber ?? null);
    await next();
  };
}

// ─── requirePermission ────────────────────────────────────────────────────────

export function requirePermission(permission: Permission): MiddlewareHandler {
  return async (c, next) => {
    const cookieHeader = c.req.header('Cookie') || c.req.header('cookie') || '';
    const token = extractSessionToken(cookieHeader);

    // ── ONE KV read — warm path ───────────────────────────────────────────────
    let payload: SessionPayload | null = token ? await getSessionPayload(kv(c), token) : null;

    // Cache miss — build from DB once, store for next request
    if (!payload) {
      payload = await buildSessionPayload(c);
      if (!payload) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
      if (token) setSessionPayload(kv(c), token, payload).catch(() => {});
    }

    const { user, memberships } = payload;
    c.set('sessionUser', user);
    c.set('actorPhone', user.phoneNumber ?? null);

    const headerOutletId = c.req.header('X-Outlet-Id') || null;

    // Platform ADMIN bypasses everything
    if (user.role === 'ADMIN') {
      const restaurantId = c.req.header('X-Restaurant-Id') ?? '';
      c.set('tenant', { restaurantId, role: 'OWNER', member: null, outletId: headerOutletId });
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

    // Outlet scope check — array.includes(), no DB
    if (headerOutletId && !membership.allOutlets) {
      if (!membership.outletIds.includes(headerOutletId)) {
        return c.json({ error: 'Forbidden', message: 'You do not have access to this outlet' }, 403);
      }
    }

    c.set('tenant', {
      restaurantId,
      role: membership.role,
      member: { id: membership.memberId, restaurantId, role: membership.role, userId: user.id },
      outletId: headerOutletId,
    });
    await next();
  };
}

// ─── requireAdmin ─────────────────────────────────────────────────────────────

export function requireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    const cookieHeader = c.req.header('Cookie') || c.req.header('cookie') || '';
    const token = extractSessionToken(cookieHeader);
    let payload: SessionPayload | null = token ? await getSessionPayload(kv(c), token) : null;
    if (!payload) {
      payload = await buildSessionPayload(c);
      if (token && payload) setSessionPayload(kv(c), token, payload).catch(() => {});
    }
    if (!payload) return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    if (payload.user.role !== 'ADMIN') {
      return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403);
    }
    c.set('sessionUser', payload.user);
    c.set('actorPhone', payload.user.phoneNumber ?? null);
    await next();
  };
}
