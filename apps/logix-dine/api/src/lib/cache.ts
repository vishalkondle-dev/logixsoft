/**
 * KV-backed cache layer for logix-dine-api.
 *
 * All keys are namespaced by restaurantId so that cross-tenant pollution is
 * impossible even if prefix-deletion is used for invalidation.
 *
 * TTLs (all configurable here):
 *   bootstrap / categories / items → 60 s  (menu changes are rare mid-service)
 *   restaurant info                → 300 s
 *   reports                        → 300 s  (tolerate 5-min stale on analytics)
 *   staff / tables / outlets       → 60 s
 *
 * Invalidation strategy: delete exact keys + every key matching a prefix.
 * KV list() is used for prefix deletion — keep prefixes short.
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

// ─── Key builders ─────────────────────────────────────────────────────────────

export const CacheKey = {
  bootstrap:  (r: string, o: string) => `bs:${r}:${o}`,
  categories: (r: string, o: string) => `cats:${r}:${o}`,
  items:      (r: string, o: string) => `items:${r}:${o}`,
  restaurant: (r: string)            => `rest:${r}`,
  outlets:    (r: string)            => `outlets:${r}`,
  staff:      (r: string)            => `staff:${r}`,
  tables:     (r: string, o: string | null | undefined) =>
    `tables:${r}:${o ?? 'all'}`,
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
  try {
    await kv.delete(key);
  } catch {}
}

/**
 * Delete all KV keys matching a prefix.
 * KV list() is eventually consistent — fine for cache invalidation.
 */
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

// ─── Invalidation helpers (call these from mutating routes) ──────────────────

/**
 * Invalidate all menu-related caches for a restaurant.
 * Call after any category or item CUD operation.
 */
export async function invalidateMenu(kv: KVNamespace, restaurantId: string): Promise<void> {
  await Promise.all([
    cacheDelPrefix(kv, CacheKey.bsPrefix(restaurantId)),
    cacheDelPrefix(kv, CacheKey.menuPrefix(restaurantId)),
    cacheDelPrefix(kv, CacheKey.itemsPrefix(restaurantId)),
  ]);
}

/**
 * Invalidate report caches for a restaurant.
 * Call after order settle or void.
 */
export async function invalidateReports(kv: KVNamespace, restaurantId: string): Promise<void> {
  await cacheDelPrefix(kv, CacheKey.reportPrefix(restaurantId));
}

/**
 * Invalidate table caches for a restaurant.
 * Call after table CUD or toggle.
 */
export async function invalidateTables(kv: KVNamespace, restaurantId: string): Promise<void> {
  await cacheDelPrefix(kv, CacheKey.tablesPrefix(restaurantId));
}

/**
 * Invalidate outlet + restaurant caches.
 * Call after outlet CUD or restaurant update.
 */
export async function invalidateRestaurant(kv: KVNamespace, restaurantId: string): Promise<void> {
  await Promise.all([
    cacheDel(kv, CacheKey.restaurant(restaurantId)),
    cacheDel(kv, CacheKey.outlets(restaurantId)),
  ]);
}

/**
 * Invalidate staff cache.
 * Call after invite / update / remove.
 */
export async function invalidateStaff(kv: KVNamespace, restaurantId: string): Promise<void> {
  await cacheDel(kv, CacheKey.staff(restaurantId));
}
