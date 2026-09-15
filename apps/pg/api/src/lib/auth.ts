import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDbWithClient } from '../db';
import { authSchema } from '../db/auth-schema';
import { pgSchema } from '../db/schema';

export interface AuthEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  API_URL?: string;
  FRONTEND_URL?: string;
  NODE_ENV?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export const AUTH_BASE_PATH = '/auth';

const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3020', 'http://localhost:3100'];
const PROD_ORIGINS = ['https://payment.logixsoft.in', 'https://payment-api.logixsoft.in', 'https://pg.logixsoft.in'];

function readEnv(overrides?: Partial<AuthEnv>): AuthEnv {
  const env = { ...(process.env as unknown as Record<string, string | undefined>), ...overrides };

  const missing = (['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const).filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required auth environment variable(s): ${missing.join(', ')}. ` +
      'Set them with `wrangler secret put <NAME>`, or in .dev.vars for local dev.'
    );
  }

  return {
    DATABASE_URL: env.DATABASE_URL!,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET!,
    API_URL: env.API_URL,
    FRONTEND_URL: env.FRONTEND_URL,
    NODE_ENV: env.NODE_ENV,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  };
}

export function createAuth(overrides?: Partial<AuthEnv>) {
  const env = readEnv(overrides);

  const isProd = env.NODE_ENV === 'production';
  const baseURL =
    env.API_URL || (isProd ? 'https://payment-api.logixsoft.in' : 'http://localhost:3031');
  const frontendUrl = env.FRONTEND_URL || (isProd ? PROD_ORIGINS[0] : DEV_ORIGINS[0]);

  // Strictly Google OAuth only (no email/password registration)
  const socialProviders = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    }
    : {};

  const schema = { ...authSchema, ...pgSchema };
  const { db, close } = createDbWithClient({
    connectionString: env.DATABASE_URL,
    schema,
    maxConnections: 1,
  });

  const auth = betterAuth({
    appName: 'Logixsoft PG',
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,

    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
    },

    database: drizzleAdapter(db, { provider: 'pg', schema }),

    trustedOrigins: Array.from(new Set([...(isProd ? PROD_ORIGINS : DEV_ORIGINS), frontendUrl])),

    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'MERCHANT',
          required: false,
          input: false,
        },
      },
    },

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },

    rateLimit: {
      enabled: false,
    },

    socialProviders,
  });

  return { auth, db, close };
}

