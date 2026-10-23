import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import bcrypt from "bcryptjs";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").default("user"),
  avatarUrl: text("avatar_url"),
  statusMessage: text("status_message"),
  bio: text("bio"),
  signature: text("signature"),
  soundEnabled: integer("sound_enabled").default(1),
  disabled: integer("disabled").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const authSchema = { user, session, account, verification };

export type AuthInstance = ReturnType<typeof createBetterAuth>;

export function createBetterAuth(env: {
  DB: D1Database;
  JWT_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  DOMAIN?: string;
}) {
  const db = drizzle(env.DB, { schema: authSchema });
  const secret = env.BETTER_AUTH_SECRET || env.JWT_SECRET || "logixsoft_better_auth_secret_key_2026_edge";
  const domain = env.DOMAIN || "logixsoft.in";
  const baseURL = `https://email.${domain}`;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret,
    baseURL,
    plugins: [
      bearer(),
    ],
    emailAndPassword: {
      enabled: true,
      password: {
        hash: async (password: string) => {
          return bcrypt.hashSync(password, 10);
        },
        verify: async ({ hash, password }: { hash: string; password: string }) => {
          try {
            if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
              return bcrypt.compareSync(password, hash);
            }
          } catch (e) {
            console.error("Password verification error:", e);
          }
          return false;
        },
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "user" },
        avatarUrl: { type: "string", required: false },
        statusMessage: { type: "string", required: false },
        bio: { type: "string", required: false },
        signature: { type: "string", required: false },
        soundEnabled: { type: "number", defaultValue: 1 },
        disabled: { type: "number", defaultValue: 0 },
      },
    },
  });
}
