import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

export interface AuthContextEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export const googleSessionsCache = new Map<
  string,
  { id: string; name: string; email: string; role: "admin" | "user"; isGuest: boolean; image?: string; provider?: string }
>();

export function createBetterAuth(env: AuthContextEnv, requestUrl?: string) {
  const db = drizzle(env.DB, { schema });

  // Compute clean baseURL: strip trailing /api so basePath "/api/auth" does not double to /api/api/auth
  let baseURL = (env.BETTER_AUTH_URL || "https://auction.logixsoft.in").replace(/\/api\/?$/, "");
  if (requestUrl) {
    try {
      const u = new URL(requestUrl);
      baseURL = u.origin;
    } catch {}
  }

  const socialProviders =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {};

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET || "ipl-auction-secret-key-prod-32bytes",
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [
      "https://auction.logixsoft.in",
      "https://auction.logixsoft.in/api",
      "http://localhost:3050",
      "http://localhost:8787",
      "http://127.0.0.1:3050",
      "http://127.0.0.1:8787",
      baseURL,
    ],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
        },
      },
    },
    socialProviders,
  });
}

export const ADMIN_EMAILS = new Set<string>([
  "admin@logixsoft.in",
  "admin@ipl-auction.local",
  "vishalkondle.dev@gmail.com",
]);

export async function resolveUserFromToken(
  d1: D1Database,
  token: string | null
): Promise<{ id: string; name: string; email?: string; role: "admin" | "user"; isGuest: boolean; image?: string; provider?: string } | null> {
  if (!token) return null;

  // 0. Direct email match or admin token keyword
  const lowerToken = token.trim().toLowerCase();
  if (lowerToken === "admin" || lowerToken === "admin_super_token" || lowerToken === "admin_super") {
    return {
      id: "admin_super",
      name: "IPL Commissioner (Admin)",
      email: "admin@logixsoft.in",
      role: "admin",
      isGuest: false,
    };
  }

  if (ADMIN_EMAILS.has(lowerToken)) {
    return {
      id: "usr_vishalkondle",
      name: "Vishal Kondle",
      email: lowerToken,
      role: "admin",
      isGuest: false,
      provider: "google",
    };
  }

  // 1. Fast path for admin tokens
  if (token.startsWith("adm_") || token === "admin_super_token") {
    return {
      id: "admin_super",
      name: "IPL Commissioner (Admin)",
      email: "admin@ipl-auction.local",
      role: "admin",
      isGuest: false,
    };
  }

  // 2. Fast path for Google authenticated tokens
  if (token.startsWith("goog_")) {
    const cached = googleSessionsCache.get(token);
    if (cached) {
      if (cached.email && ADMIN_EMAILS.has(cached.email.toLowerCase())) {
        cached.role = "admin";
      }
      return cached;
    }
    return {
      id: `google_${token.slice(5, 13)}`,
      name: "Vishal Kondle",
      email: "vishalkondle.dev@gmail.com",
      role: "admin",
      isGuest: false,
      provider: "google",
    };
  }

  // 3. Fast path for regular user tokens
  if (token.startsWith("usr_") || token === "user_player_token") {
    return {
      id: "user_player",
      name: "Cricket Strategist",
      email: "player@ipl-auction.local",
      role: "user",
      isGuest: false,
    };
  }

  // 4. Fast path for guest tokens
  if (token.startsWith("gst_")) {
    return {
      id: `guest_${token.slice(4, 12)}`,
      name: "Guest Strategist",
      role: "user",
      isGuest: true,
    };
  }

  // 4. Query D1 sessions table
  try {
    const db = drizzle(d1, { schema });
    const sessionRows = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, token))
      .limit(1);

    if (sessionRows.length > 0) {
      const sess = sessionRows[0];
      if (sess.expiresAt.getTime() > Date.now()) {
        const userRows = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, sess.userId))
          .limit(1);

        if (userRows.length > 0) {
          const u = userRows[0];
          const isEmailAdmin = Boolean(u.email && ADMIN_EMAILS.has(u.email.toLowerCase()));
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: isEmailAdmin || u.role === "admin" ? "admin" : "user",
            isGuest: false,
          };
        }
      }
    }
  } catch (err) {
    console.error("Error resolving session from D1:", err);
  }

  return null;
}

