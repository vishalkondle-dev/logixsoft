import type { Context, MiddlewareHandler } from 'hono';
import { eq, and, or, inArray, isNull } from 'drizzle-orm';
import { createDbWithClient } from '../db';
import { appSchema } from '../db';
import {
  ROLE_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, hasPermission, isAllOutletRole,
  type Permission, type RestaurantRole,
} from '@logixsoft/logix-dine/types/roles';
import type { AuthEnv } from './auth';
import { createAuth } from './auth';
import {
  extractSessionToken, getSessionPayload, setSessionPayload, isJwtToken,
  deleteSessionPayload, type SessionPayload, type MembershipEntry, type KVNamespace,
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
  userOverride?: any,
): Promise<SessionPayload | null> {
  let authUser: any = userOverride ?? null;
  if (!authUser) {
    const { auth, close: closeAuth } = createAuth(c.env);
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      authUser = session?.user ?? null;
    } finally {
      await closeAuth();
    }
  }
  if (!authUser) return null;

  // Platform ADMIN has strictly only the ADMIN role and is decoupled from any restaurant
  if (authUser.role === 'ADMIN') {
    return {
      user: {
        id: authUser.id,
        name: authUser.name ?? null,
        email: authUser.email ?? null,
        phoneNumber: (authUser as any).phoneNumber ?? null,
        role: 'ADMIN',
        phoneNumberVerified: (authUser as any).phoneNumberVerified ?? false,
      },
      memberships: [],
    };
  }

  const { db, close } = dbFromEnv(c);
  try {
    const phone = authUser.phoneNumber ?? null;
    const staffConditions = [eq(appSchema.outletStaff.userId, authUser.id)];
    if (phone) {
      staffConditions.push(eq(appSchema.outletStaff.phone, phone));
    }
    const staffRows = await db
      .select()
      .from(appSchema.outletStaff)
      .where(and(or(...staffConditions), eq(appSchema.outletStaff.status, 'ACTIVE')));

    // Auto-link any staff rows matching phone to this authUser
    for (const s of staffRows) {
      if (!s.userId) {
        await db
          .update(appSchema.outletStaff)
          .set({ userId: authUser.id, name: s.name || authUser.name, updatedAt: new Date() })
          .where(eq(appSchema.outletStaff.id, s.id))
          .catch(() => {});
      }
    }

    // Group staff rows by restaurantId
    const restaurantIds = Array.from(new Set(staffRows.map((s: any) => s.restaurantId as string)));
    const staffByRestaurant = new Map<string, any[]>();
    for (const s of staffRows) {
      const list = staffByRestaurant.get(s.restaurantId) ?? [];
      list.push(s);
      staffByRestaurant.set(s.restaurantId, list);
    }

    // Batch fetch custom roles for all restaurants the user belongs to
    const roleDefinitionsMap = new Map<string, { permissions: string[]; allOutlets: boolean; name: string }>();
    if (restaurantIds.length > 0) {
      try {
        const roles = await db
          .select()
          .from(appSchema.restaurantRole)
          .where(inArray(appSchema.restaurantRole.restaurantId, restaurantIds));
        for (const r of roles) {
          const perms = Array.isArray(r.permissions) ? (r.permissions as string[]) : [];
          roleDefinitionsMap.set(`${r.restaurantId}:${r.id}`, { permissions: perms, allOutlets: r.allOutlets, name: r.name });
          roleDefinitionsMap.set(`${r.restaurantId}:${r.name}`, { permissions: perms, allOutlets: r.allOutlets, name: r.name });
          roleDefinitionsMap.set(`${r.restaurantId}:${r.name.toUpperCase()}`, { permissions: perms, allOutlets: r.allOutlets, name: r.name });
        }
      } catch (err) {
        console.warn('[buildSessionPayload] error querying restaurantRole:', err);
      }
    }

    const memberships: MembershipEntry[] = await Promise.all(
      restaurantIds.map(async (restId) => {
        const rowsForRest = staffByRestaurant.get(restId)!;
        const primaryRow = rowsForRest[0];
        const rawRole = (primaryRow.role || '').trim();
        const roleUpper = rawRole.toUpperCase();
        const customRole = roleDefinitionsMap.get(`${restId}:${rawRole}`) ||
                           roleDefinitionsMap.get(`${restId}:${roleUpper}`);
        const isOwner = roleUpper === 'OWNER';
        const hasNullOutlet = rowsForRest.some((r) => r.outletId === null);
        const allOutlets = isOwner || hasNullOutlet || Boolean(customRole?.allOutlets) || isAllOutletRole(rawRole);

        // Resolve permissions:
        let permissions: string[] = [];
        if (isOwner) {
          permissions = ['*'];
        } else if (customRole) {
          permissions = customRole.permissions;
        } else if (DEFAULT_ROLE_PERMISSIONS[roleUpper as keyof typeof DEFAULT_ROLE_PERMISSIONS]) {
          permissions = [...DEFAULT_ROLE_PERMISSIONS[roleUpper as keyof typeof DEFAULT_ROLE_PERMISSIONS]];
        } else {
          permissions = (ROLE_PERMISSIONS[roleUpper as keyof typeof ROLE_PERMISSIONS] as string[]) || [];
        }

        let outletIds: string[] = [];
        if (allOutlets) {
          // For OWNER / ALL_OUTLET_ROLES: Fetch all active outlets of their restaurant
          const outletRows = await db
            .select({ id: appSchema.restaurantOutlet.id })
            .from(appSchema.restaurantOutlet)
            .where(eq(appSchema.restaurantOutlet.restaurantId, restId));
          outletIds = outletRows.map((r: any) => r.id);
        } else {
          // Explicitly assigned outlets from outletStaff rows
          outletIds = Array.from(new Set(rowsForRest.map((r: any) => r.outletId).filter(Boolean)));
        }

        return {
          restaurantId: restId,
          memberId: primaryRow.id,
          role: primaryRow.role,
          roleName: customRole?.name || primaryRow.role,
          permissions,
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
export async function storeSessionPayload(c: Context, token: string, userObj?: any): Promise<void> {
  try {
    const payload = await buildSessionPayload(c, userObj);
    if (payload) await setSessionPayload(kv(c), token, payload);
  } catch (err) {
    console.warn('[storeSessionPayload] failed:', err);
  }
}

/**
 * Invalidate cached session payloads in Cloudflare KV for one or more staff members.
 * Resolves user IDs from either userId or phone number, queries all active session
 * tokens from PostgreSQL `session` table, and evicts them from Cloudflare KV.
 * This guarantees the user's next API request fetches fresh role and outlet permissions from DB.
 */
export async function invalidateStaffSessions(
  db: any,
  kvNamespace: KVNamespace | undefined | null,
  targets: Array<{ phone?: string | null; userId?: string | null }>
): Promise<void> {
  if (!kvNamespace || !targets || targets.length === 0) return;
  try {
    const userIds = new Set<string>();
    const phoneVariations = new Set<string>();

    for (const t of targets) {
      if (t.userId) userIds.add(t.userId);
      if (t.phone) {
        const raw = t.phone.trim();
        const digits = raw.replace(/\D/g, '');
        if (raw) phoneVariations.add(raw);
        if (digits) {
          phoneVariations.add(digits);
          if (digits.length === 10) {
            phoneVariations.add(`+91${digits}`);
            phoneVariations.add(`91${digits}`);
          } else if (digits.length > 10) {
            phoneVariations.add(`+${digits}`);
            phoneVariations.add(digits.slice(-10));
          }
        }
      }
    }

    if (phoneVariations.size > 0) {
      const usersByPhone = await db
        .select({ id: appSchema.user.id })
        .from(appSchema.user)
        .where(inArray(appSchema.user.phoneNumber, Array.from(phoneVariations)));
      for (const u of usersByPhone) {
        userIds.add(u.id);
      }
    }

    if (userIds.size === 0) return;

    const sessions = await db
      .select({ token: appSchema.session.token })
      .from(appSchema.session)
      .where(inArray(appSchema.session.userId, Array.from(userIds)));

    const deletePromises: Promise<void>[] = [];
    for (const s of sessions) {
      deletePromises.push(deleteSessionPayload(kvNamespace, s.token));
      if (s.token && s.token.includes('.')) {
        deletePromises.push(deleteSessionPayload(kvNamespace, s.token.split('.')[0]));
      }
    }

    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('[invalidateStaffSessions] Failed to invalidate sessions in KV:', err);
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
  if (tenant?.role === 'ADMIN' || tenant?.allOutlets || tenant?.role === 'OWNER') return true;
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
    .select({ id: appSchema.outletStaff.id })
    .from(appSchema.outletStaff)
    .where(and(
      eq(appSchema.outletStaff.id, memberId),
      or(eq(appSchema.outletStaff.outletId, outletId), isNull(appSchema.outletStaff.outletId)),
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

// ─── requireMembership ────────────────────────────────────────────────────────

export function requireMembership(): MiddlewareHandler {
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
      const existingMembership = memberships.find((m) => m.restaurantId === restaurantId);
      c.set('tenant', {
        restaurantId,
        role: existingMembership?.role || 'OWNER',
        roleName: existingMembership?.roleName || 'OWNER',
        permissions: existingMembership?.permissions || ['*'],
        member: existingMembership ? { id: existingMembership.memberId, restaurantId, role: existingMembership.role, userId: user.id } : null,
        outletId: headerOutletId,
        outletIds: existingMembership?.outletIds?.length ? existingMembership.outletIds : (headerOutletId ? [headerOutletId] : []),
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

    // Strict Outlet scope check
    if (headerOutletId && !membership.allOutlets && membership.role?.toUpperCase() !== 'OWNER') {
      if (!membership.outletIds.includes(headerOutletId)) {
        return c.json({
          error: 'Forbidden',
          message: `You do not have access to outlet '${headerOutletId}'`,
        }, 403);
      }
    }

    const userPerms = membership.permissions || ROLE_PERMISSIONS[membership.role as keyof typeof ROLE_PERMISSIONS] || [];

    c.set('tenant', {
      restaurantId,
      role: membership.role,
      roleName: membership.roleName || membership.role,
      permissions: userPerms,
      member: { id: membership.memberId, restaurantId, role: membership.role, userId: user.id },
      outletId: headerOutletId,
      outletIds: membership.outletIds,
      allOutlets: membership.allOutlets,
    });
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
      const existingMembership = memberships.find((m) => m.restaurantId === restaurantId);
      c.set('tenant', {
        restaurantId,
        role: existingMembership?.role || 'OWNER',
        roleName: existingMembership?.roleName || 'OWNER',
        permissions: existingMembership?.permissions || ['*'],
        member: existingMembership ? { id: existingMembership.memberId, restaurantId, role: existingMembership.role, userId: user.id } : null,
        outletId: headerOutletId,
        outletIds: existingMembership?.outletIds?.length ? existingMembership.outletIds : (headerOutletId ? [headerOutletId] : []),
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

    // Permission check — pure in-memory (ZERO DB, ZERO KV)
    const userPerms = membership.permissions || ROLE_PERMISSIONS[membership.role as keyof typeof ROLE_PERMISSIONS] || [];
    if (!hasPermission(userPerms, permission)) {
      return c.json({
        error: 'Forbidden',
        message: `Permission '${permission}' required`,
        requiredPermission: permission,
      }, 403);
    }

    // Strict Outlet scope check (bypassed if role has allOutlets access or is OWNER)
    if (headerOutletId && !membership.allOutlets && membership.role?.toUpperCase() !== 'OWNER') {
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
      roleName: membership.roleName || membership.role,
      permissions: userPerms,
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
      const existingMembership = memberships.find((m) => m.restaurantId === restaurantId);
      c.set('tenant', {
        restaurantId,
        role: existingMembership?.role || 'OWNER',
        roleName: existingMembership?.roleName || 'OWNER',
        permissions: existingMembership?.permissions || ['*'],
        member: existingMembership ? { id: existingMembership.memberId, restaurantId, role: existingMembership.role, userId: user.id } : null,
        outletId: headerOutletId,
        outletIds: existingMembership?.outletIds?.length ? existingMembership.outletIds : (headerOutletId ? [headerOutletId] : []),
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

    // Role check — in-memory (OWNER always authorized)
    if (membership.role !== 'OWNER' && !rolesArray.includes(membership.role)) {
      return c.json({
        error: 'Forbidden',
        message: `Role '${membership.role}' not authorized. Required: ${rolesArray.join(', ')}`,
      }, 403);
    }

    // Strict Outlet scope check (bypassed if role has allOutlets access or is OWNER)
    if (headerOutletId && !membership.allOutlets && membership.role?.toUpperCase() !== 'OWNER') {
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
      roleName: membership.roleName || membership.role,
      permissions: membership.permissions || [],
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

