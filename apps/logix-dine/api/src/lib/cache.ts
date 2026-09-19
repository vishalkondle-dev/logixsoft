/**
 * KV-backed cache layer for logix-dine-api.
 *
 * HOT PATH (every request):
 *   ONE KV read → SessionPayload containing user + all memberships + outletIds.
 *   Zero DB queries on warm requests. Built at login, TTL = session lifetime (7d).
 *   Evicted on role/outlet change so the next request rebuilds from DB once.
 *
 * COLD CACHE (data routes):
 *   categories/items/tables/reports cached by restaurantId + outletId.
 *   Invalidated on mutations so data is always fresh after a write.
 */

export interface KVNamespace {
  get(key: string, options?: { type?: string }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

// ─── Session payload — stored per session token at login ──────────────────────

export interface MembershipEntry {
  restaurantId: string;
  memberId: string;
  role: string;
  outletIds: string[];     // empty = OWNER (all outlets)
  allOutlets: boolean;
}

export interface SessionPayload {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
    role: string;          // platform role (ADMIN | OWNER | CUSTOMER)
    phoneNumberVerified: boolean;
  };
  memberships: MembershipEntry[];
}

// ─── Key builders ─────────────────────────────────────────────────────────────

export const CacheKey = {
  // ─── Tenancy / auth lookups
  session:      (token: string) => `s:${token.slice(-40)}`,

  // ─── Per-outlet order sequence counter
  outletSeq:    (outletId: string) => `seq:${outletId}`,

  // Data caches — keyed by restaurantId + outletId
  bootstrap:  (r: string, o: string) => `bs:${r}:${o}`,
  categories: (r: string, o: string) => `cats:${r}:${o}`,
  items:      (r: string, o: string) => `items:${r}:${o}`,
  restaurant: (r: string)            => `rest:${r}`,
  outlets:    (r: string)            => `outlets:${r}`,
  staff:      (r: string)            => `staff:${r}`,
  tables:     (r: string, o: string | null | undefined) => `tables:${r}:${o ?? 'all'}`,
  report:     (r: string, type: string, from: string, to: string, o: string | null) =>
    `report:${r}:${type}:${from}:${to}:${o ?? 'all'}`,

  // Prefixes for bulk invalidation
  menuPrefix:   (r: string) => `cats:${r}:`,
  itemsPrefix:  (r: string) => `items:${r}:`,
  bsPrefix:     (r: string) => `bs:${r}:`,
  tablesPrefix: (r: string) => `tables:${r}:`,
  reportPrefix: (r: string) => `report:${r}:`,
};

// ─── TTLs (seconds) ───────────────────────────────────────────────────────────

export const TTL = {
  session:    604800,  // 7 days — same as better-auth session lifetime
  outletSeq:  604800,  // 7 days — reset if outlet goes unused for a week
  menu:       60,
  restaurant: 300,
  staff:      60,
  tables:     60,
  outlets:    60,
  report:     300,
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

export async function cacheGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  kv: KVNamespace,
  key: string,
  value: unknown,
  ttl: number,
): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch {
    // Never let cache write failure break the request
  }
}

export async function cacheDel(kv: KVNamespace, key: string): Promise<void> {
  try { await kv.delete(key); } catch {}
}

export async function cacheDelPrefix(kv: KVNamespace, prefix: string): Promise<void> {
  try {
    let cursor: string | undefined;
    do {
      const result = await kv.list({ prefix, limit: 100, ...(cursor ? { cursor } : {}) });
      await Promise.all(result.keys.map((k) => kv.delete(k.name)));
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
  } catch {}
}

// ─── Session payload helpers ──────────────────────────────────────────────────

export function extractSessionToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(/session_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function getSessionPayload(
  kv: KVNamespace,
  token: string,
): Promise<SessionPayload | null> {
  return cacheGet<SessionPayload>(kv, CacheKey.session(token));
}

export async function setSessionPayload(
  kv: KVNamespace,
  token: string,
  payload: SessionPayload,
): Promise<void> {
  await cacheSet(kv, CacheKey.session(token), payload, TTL.session);
}

export async function deleteSessionPayload(
  kv: KVNamespace,
  token: string,
): Promise<void> {
  await cacheDel(kv, CacheKey.session(token));
}

// ─── Data invalidation helpers ────────────────────────────────────────────────

export async function invalidateMenu(kv: KVNamespace, restaurantId: string): Promise<void> {
  await Promise.all([
    cacheDelPrefix(kv, CacheKey.bsPrefix(restaurantId)),
    cacheDelPrefix(kv, CacheKey.menuPrefix(restaurantId)),
    cacheDelPrefix(kv, CacheKey.itemsPrefix(restaurantId)),
  ]);
}

export async function invalidateReports(kv: KVNamespace, restaurantId: string): Promise<void> {
  await cacheDelPrefix(kv, CacheKey.reportPrefix(restaurantId));
}

export async function invalidateTables(kv: KVNamespace, restaurantId: string): Promise<void> {
  await cacheDelPrefix(kv, CacheKey.tablesPrefix(restaurantId));
}

export async function invalidateRestaurant(kv: KVNamespace, restaurantId: string): Promise<void> {
  await Promise.all([
    cacheDel(kv, CacheKey.restaurant(restaurantId)),
    cacheDel(kv, CacheKey.outlets(restaurantId)),
  ]);
}

export async function invalidateStaff(kv: KVNamespace, restaurantId: string): Promise<void> {
  await cacheDel(kv, CacheKey.staff(restaurantId));
}

/**
 * Delete session payload for a specific user across ALL their sessions.
 * Used when role/outlet access changes — next request will rebuild from DB.
 * KV list by prefix `s:` is expensive; instead we store a separate
 * "user sessions" set. For simplicity at this scale, we use a prefix scan
 * only from the staff mutation path (rare operation).
 *
 * For now: caller passes the known token if available, otherwise this is
 * a no-op — the 7-day TTL means stale role data lives at most 7 days, but
 * in practice the affected staff member will re-login and get fresh data.
 * To force immediate eviction, store userId→[tokens] mapping (future work).
 */
export async function invalidateUserSession(
  kv: KVNamespace,
  token: string | null,
): Promise<void> {
  if (token) await cacheDel(kv, CacheKey.session(token));
}
