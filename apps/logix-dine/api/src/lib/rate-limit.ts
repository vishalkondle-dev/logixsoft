import postgres from 'postgres';
import type { MiddlewareHandler } from 'hono';

interface RateLimiterOptions {
  /** Prefix for the rate-limit key (e.g. 'send-otp') — combined with client IP */
  keyPrefix: string;
  /** Max requests allowed within the window */
  max: number;
  /** Window in milliseconds (default 60s) */
  windowMs?: number;
}

const DEFAULT_WINDOW_MS = 60_000;

function resolveDbUrl(c: any): string {
  const hyperdriveUrl = c?.env?.HYPERDRIVE?.connectionString;
  return hyperdriveUrl || c?.env?.DATABASE_URL || '';
}

/**
 * Atomically bump a rate-limit counter for `key` using a sliding window.
 * Returns whether the request is allowed and the reset hint in seconds.
 */
async function hit(
  client: postgres.Sql,
  key: string,
  max: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const [row] = await client<{ count: number }[]>`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${crypto.randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN ${now} - "rateLimit"."lastRequest" < ${windowMs} THEN "rateLimit"."count" + 1
        ELSE 1
      END,
      "lastRequest" = ${now}
    RETURNING "count"
  `;

  const count = row?.count ?? 1;
  return { allowed: count <= max, retryAfterSec: Math.ceil(windowMs / 1000) };
}

/**
 * Per-IP rate limiter backed by Postgres (via Hyperdrive), so it holds
 * across all Worker isolates — unlike in-memory or better-auth's internal
 * limiter (which only fires on its own HTTP endpoints, not on auth.api.*
 * calls made from custom Hono routes).
 */
export function rateLimiter({ keyPrefix, max, windowMs = DEFAULT_WINDOW_MS }: RateLimiterOptions): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    const dbUrl = resolveDbUrl(c);
    if (!dbUrl) return next();

    const client = postgres(dbUrl, { max: 1 });
    try {
      const { allowed, retryAfterSec } = await hit(client, `${keyPrefix}:${ip}`, max, windowMs);
      if (!allowed) {
        return c.json(
          {
            success: false,
            message: `Too many requests. Please try again in ${retryAfterSec}s.`,
          },
          429
        );
      }
      return next();
    } finally {
      await client.end({ timeout: 2 }).catch(() => {});
    }
  };
}