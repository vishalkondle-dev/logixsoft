import { parseDuration } from './date';

/**
 * Cache entry stored in memory or persistence.
 */
export interface CacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  expiresAt?: number; // Epoch timestamp in milliseconds
}

/**
 * Options for setting a cache value.
 */
export interface SetOptions {
  /**
   * Time to live in seconds, or as a duration string (e.g. '30s', '5m', '2h', '1d').
   */
  ttl?: number | string;

  /**
   * Expire in seconds (Redis EX compatibility).
   */
  ex?: number;

  /**
   * Expire in milliseconds (Redis PX compatibility).
   */
  px?: number;

  /**
   * Only set the key if it does NOT already exist (Redis NX).
   */
  nx?: boolean;

  /**
   * Only set the key if it ALREADY exists (Redis XX).
   */
  xx?: boolean;
}

/**
 * Health and operational statistics of the Durable Object Cache.
 */
export interface CacheStats {
  keysCount: number;
  hashesCount: number;
  uptimeSeconds: number;
  hits: number;
  misses: number;
  memoryEntries: number;
}

/**
 * Minimal stub interface compatible with Cloudflare Workers DurableObjectStub.
 */
export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL | string, init?: RequestInit): Promise<Response>;
}

/**
 * Minimal namespace interface compatible with Cloudflare Workers DurableObjectNamespace.
 */
export interface DurableObjectNamespaceLike {
  idFromName(name: string): any;
  idFromString(id: string): any;
  get(id: any): DurableObjectStubLike;
}

/**
 * Options for initializing the DurableObjectCacheClient.
 */
export interface DurableObjectCacheClientOptions {
  /**
   * The Durable Object namespace binding from your Cloudflare Worker environment (e.g. `env.CACHE`).
   */
  namespace?: DurableObjectNamespaceLike;

  /**
   * Durable Object instance name to connect to (default: 'global').
   * Partitioning by name (e.g. tenant ID or region) allows isolated cache namespaces.
   */
  name?: string;

  /**
   * Direct DurableObjectStub instance if already resolved.
   */
  stub?: DurableObjectStubLike;

  /**
   * Base HTTP URL if connecting to the Durable Object Cache over HTTP/REST from an external service.
   */
  url?: string;

  /**
   * Optional bearer token or secret for authentication when accessing over public HTTP.
   */
  authToken?: string;

  /**
   * Custom fetch implementation (defaults to global fetch).
   */
  fetch?: typeof fetch;
}

function calculateExpiresAt(options?: SetOptions): number | undefined {
  if (!options) return undefined;

  const now = Date.now();

  if (options.px !== undefined) {
    return now + Math.max(1, options.px);
  }

  if (options.ex !== undefined) {
    return now + Math.max(1, options.ex) * 1000;
  }

  if (options.ttl !== undefined) {
    if (typeof options.ttl === 'number') {
      return now + Math.max(1, options.ttl) * 1000;
    }
    const ms = parseDuration(options.ttl);
    return ms > 0 ? now + ms : undefined;
  }

  return undefined;
}

function matchesPattern(key: string, pattern?: string): boolean {
  if (!pattern || pattern === '*') return true;
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`).test(key);
}

/**
 * Cloudflare Durable Object implementing a high-performance, in-memory Redis-like cache.
 *
 * Deploy inside any Cloudflare Worker by declaring this class in your `wrangler.toml`:
 * ```toml
 * [durable_objects]
 * bindings = [{ name = "CACHE", class_name = "RedisDurableObject" }]
 *
 * [[migrations]]
 * tag = "v1"
 * new_classes = ["RedisDurableObject"]
 * ```
 */
export class RedisDurableObject {
  private store = new Map<string, CacheEntry>();
  private hashes = new Map<string, Map<string, CacheEntry>>();
  private startTime = Date.now();
  private hits = 0;
  private misses = 0;
  private state?: any;
  private env?: any;

  constructor(state?: any, env?: any) {
    this.state = state;
    this.env = env;
  }

  private isExpired(entry?: CacheEntry): boolean {
    if (!entry) return true;
    if (entry.expiresAt === undefined) return false;
    return entry.expiresAt <= Date.now();
  }

  private cleanKey(key: string): void {
    const entry = this.store.get(key);
    if (entry && this.isExpired(entry)) {
      this.store.delete(key);
    }
  }

  // --- Core Cache Operations (RPC & Internal) ---

  async get<T = unknown>(key: string): Promise<T | null> {
    this.cleanKey(key);
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<boolean> {
    this.cleanKey(key);
    const exists = this.store.has(key);

    if (options?.nx && exists) return false;
    if (options?.xx && !exists) return false;

    const expiresAt = calculateExpiresAt(options);

    this.store.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt,
    });

    return true;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted++;
      }
      if (this.hashes.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      this.cleanKey(key);
      if (this.store.has(key) || this.hashes.has(key)) {
        count++;
      }
    }
    return count;
  }

  async incr(key: string, by: number = 1): Promise<number> {
    this.cleanKey(key);
    const entry = this.store.get(key);
    let currentVal = 0;

    if (entry) {
      const num = Number(entry.value);
      if (isNaN(num)) {
        throw new Error('ERR value is not an integer or out of range');
      }
      currentVal = num;
    }

    const newVal = currentVal + by;
    this.store.set(key, {
      value: newVal,
      createdAt: entry?.createdAt ?? Date.now(),
      expiresAt: entry?.expiresAt,
    });

    return newVal;
  }

  async decr(key: string, by: number = 1): Promise<number> {
    return this.incr(key, -by);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    this.cleanKey(key);
    const entry = this.store.get(key);
    if (!entry) return false;

    entry.expiresAt = Date.now() + Math.max(1, seconds) * 1000;
    this.store.set(key, entry);
    return true;
  }

  async ttl(key: string): Promise<number> {
    this.cleanKey(key);
    const entry = this.store.get(key);
    if (!entry) return -2; // Key does not exist
    if (entry.expiresAt === undefined) return -1; // Key exists with no expiry

    const remainingSeconds = Math.round((entry.expiresAt - Date.now()) / 1000);
    return Math.max(0, remainingSeconds);
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  async mset(entries: Record<string, any>, options?: SetOptions): Promise<boolean> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value, options);
    }
    return true;
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const hash = this.hashes.get(key);
    if (!hash) {
      this.misses++;
      return null;
    }
    const entry = hash.get(field);
    if (!entry || this.isExpired(entry)) {
      if (entry) hash.delete(field);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  async hset<T = unknown>(key: string, field: string, value: T): Promise<boolean> {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    const isNew = !hash.has(field);
    hash.set(field, {
      value,
      createdAt: Date.now(),
    });
    return isNew;
  }

  async hgetall<T = unknown>(key: string): Promise<Record<string, T>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};

    const result: Record<string, T> = {};
    for (const [field, entry] of hash.entries()) {
      if (!this.isExpired(entry)) {
        result[field] = entry.value as T;
      } else {
        hash.delete(field);
      }
    }
    return result;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let count = 0;
    for (const f of fields) {
      if (hash.delete(f)) count++;
    }
    return count;
  }

  async keys(pattern?: string): Promise<string[]> {
    const now = Date.now();
    const result: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt === undefined || entry.expiresAt > now) {
        if (matchesPattern(key, pattern)) {
          result.push(key);
        }
      } else {
        this.store.delete(key);
      }
    }

    return result;
  }

  async flush(): Promise<boolean> {
    this.store.clear();
    this.hashes.clear();
    return true;
  }

  async stats(): Promise<CacheStats> {
    return {
      keysCount: this.store.size,
      hashesCount: this.hashes.size,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      hits: this.hits,
      misses: this.misses,
      memoryEntries: this.store.size + this.hashes.size,
    };
  }

  // --- HTTP Interface (for REST / fetch dispatch) ---

  async fetch(request: Request): Promise<Response> {
    // Optional Bearer token check
    const requiredToken = this.env?.CACHE_AUTH_TOKEN;
    if (requiredToken) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${requiredToken}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === 'GET' && path === '/stats') {
        const data = await this.stats();
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

      switch (path) {
        case '/get': {
          const data = await this.get(body.key);
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/set': {
          const ok = await this.set(body.key, body.value, body.options);
          return new Response(JSON.stringify({ success: true, data: ok }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/del': {
          const count = await this.del(...(body.keys || [body.key]));
          return new Response(JSON.stringify({ success: true, data: count }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/exists': {
          const count = await this.exists(...(body.keys || [body.key]));
          return new Response(JSON.stringify({ success: true, data: count }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/incr': {
          const val = await this.incr(body.key, body.by ?? 1);
          return new Response(JSON.stringify({ success: true, data: val }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/decr': {
          const val = await this.decr(body.key, body.by ?? 1);
          return new Response(JSON.stringify({ success: true, data: val }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/expire': {
          const ok = await this.expire(body.key, body.seconds);
          return new Response(JSON.stringify({ success: true, data: ok }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/ttl': {
          const val = await this.ttl(body.key);
          return new Response(JSON.stringify({ success: true, data: val }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/mget': {
          const data = await this.mget(body.keys || []);
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/mset': {
          const ok = await this.mset(body.entries || {}, body.options);
          return new Response(JSON.stringify({ success: true, data: ok }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/hget': {
          const data = await this.hget(body.key, body.field);
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/hset': {
          const ok = await this.hset(body.key, body.field, body.value);
          return new Response(JSON.stringify({ success: true, data: ok }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/hgetall': {
          const data = await this.hgetall(body.key);
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/hdel': {
          const count = await this.hdel(body.key, ...(body.fields || [body.field]));
          return new Response(JSON.stringify({ success: true, data: count }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/keys': {
          const keys = await this.keys(body.pattern);
          return new Response(JSON.stringify({ success: true, data: keys }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        case '/flush': {
          await this.flush();
          return new Response(JSON.stringify({ success: true, data: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        default:
          return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
      }
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

/**
 * Alias for RedisDurableObject.
 */
export const CacheDurableObject = RedisDurableObject;

/**
 * Client for interacting with the Redis-like Durable Object Cache.
 *
 * Supports both:
 * 1. Direct Cloudflare Worker DO namespace bindings (`env.CACHE`)
 * 2. Remote HTTP requests over fetch.
 *
 * @example
 * ```ts
 * // Inside a Cloudflare Worker:
 * const cache = createCacheClient({ namespace: env.CACHE });
 * await cache.set('user:101', { name: 'Vishal' }, { ttl: '15m' });
 * const user = await cache.get('user:101');
 * ```
 */
export class DurableObjectCacheClient {
  private stub?: DurableObjectStubLike;
  private url?: string;
  private authToken?: string;
  private customFetch: typeof fetch;

  constructor(options: DurableObjectCacheClientOptions) {
    this.customFetch = options.fetch ?? (typeof fetch !== 'undefined' ? fetch : (null as any));
    this.authToken = options.authToken;

    if (options.stub) {
      this.stub = options.stub;
    } else if (options.namespace) {
      const name = options.name ?? 'global';
      const id = options.namespace.idFromName(name);
      this.stub = options.namespace.get(id);
    } else if (options.url) {
      this.url = options.url.replace(/\/+$/, '');
    } else {
      throw new Error(
        'DurableObjectCacheClient requires either a namespace, a stub, or a url.'
      );
    }
  }

  private async call<T = unknown>(path: string, body?: any): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    let response: Response;

    if (this.stub) {
      response = await this.stub.fetch(`http://durable-object${path}`, {
        method: body ? 'POST' : 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } else if (this.url) {
      response = await this.customFetch(`${this.url}${path}`, {
        method: body ? 'POST' : 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } else {
      throw new Error('No valid transport configured for CacheClient');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cache error (${response.status}): ${errorText}`);
    }

    const json = await response.json();
    return json.data as T;
  }

  /**
   * Retrieves a value by key. Returns `null` if the key does not exist or has expired.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    return this.call<T | null>('/get', { key });
  }

  /**
   * Sets a value in the cache with optional TTL.
   */
  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<boolean> {
    return this.call<boolean>('/set', { key, value, options });
  }

  /**
   * Deletes one or more keys from the cache.
   * Returns the count of deleted keys.
   */
  async del(...keys: string[]): Promise<number> {
    return this.call<number>('/del', { keys });
  }

  /**
   * Checks if one or more keys exist in the cache.
   * Returns the count of existing keys.
   */
  async exists(...keys: string[]): Promise<number> {
    return this.call<number>('/exists', { keys });
  }

  /**
   * Atomically increments the number stored at key by `by` (default 1).
   */
  async incr(key: string, by: number = 1): Promise<number> {
    return this.call<number>('/incr', { key, by });
  }

  /**
   * Atomically decrements the number stored at key by `by` (default 1).
   */
  async decr(key: string, by: number = 1): Promise<number> {
    return this.call<number>('/decr', { key, by });
  }

  /**
   * Sets a timeout on key in seconds.
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    return this.call<boolean>('/expire', { key, seconds });
  }

  /**
   * Returns the remaining time to live of a key in seconds.
   * -2 if the key does not exist.
   * -1 if the key exists but has no expiration.
   */
  async ttl(key: string): Promise<number> {
    return this.call<number>('/ttl', { key });
  }

  /**
   * Returns the values of all specified keys.
   */
  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    return this.call<(T | null)[]>('/mget', { keys });
  }

  /**
   * Sets multiple keys and values simultaneously.
   */
  async mset(entries: Record<string, any>, options?: SetOptions): Promise<boolean> {
    return this.call<boolean>('/mset', { entries, options });
  }

  /**
   * Retrieves a field from a hash stored at key.
   */
  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    return this.call<T | null>('/hget', { key, field });
  }

  /**
   * Sets a field in a hash stored at key.
   */
  async hset<T = unknown>(key: string, field: string, value: T): Promise<boolean> {
    return this.call<boolean>('/hset', { key, field, value });
  }

  /**
   * Returns all fields and values of the hash stored at key.
   */
  async hgetall<T = unknown>(key: string): Promise<Record<string, T>> {
    return this.call<Record<string, T>>('/hgetall', { key });
  }

  /**
   * Deletes one or more fields from a hash stored at key.
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.call<number>('/hdel', { key, fields });
  }

  /**
   * Returns all keys matching pattern (e.g. 'user:*').
   */
  async keys(pattern?: string): Promise<string[]> {
    return this.call<string[]>('/keys', { pattern });
  }

  /**
   * Removes all keys from the cache.
   */
  async flush(): Promise<boolean> {
    return this.call<boolean>('/flush');
  }

  /**
   * Returns cache metrics, hits, misses, and uptime.
   */
  async stats(): Promise<CacheStats> {
    return this.call<CacheStats>('/stats');
  }

  /**
   * Cache-aside pattern helper: Returns cached value if present,
   * otherwise executes fetcher, caches the result with the given TTL, and returns it.
   *
   * @example
   * ```ts
   * const product = await cache.remember(`product:${id}`, '1h', async () => {
   *   return await db.products.findUnique({ where: { id } });
   * });
   * ```
   */
  async remember<T>(
    key: string,
    ttl: number | string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetcher();
    if (fresh !== undefined) {
      await this.set(key, fresh, { ttl });
    }
    return fresh;
  }
}

/**
 * Creates an instance of DurableObjectCacheClient.
 *
 * @example
 * ```ts
 * // Using Worker DO Binding:
 * export const cache = createCacheClient({ namespace: env.CACHE });
 *
 * // Using Remote URL:
 * export const cache = createCacheClient({ url: 'https://cache.mycompany.workers.dev', authToken: 'secret' });
 * ```
 */
export function createCacheClient(
  options: DurableObjectCacheClientOptions
): DurableObjectCacheClient {
  return new DurableObjectCacheClient(options);
}
