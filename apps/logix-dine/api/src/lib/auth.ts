import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins';
import { sendWhatsAppOtp } from '@logixsoft/wa';
import { createDbWithClient, type Database } from '../db';
import { authSchema } from '@logixsoft/logix-dine/schemas/auth-schema';

export interface AuthEnv {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  API_URL?: string;
  FRONTEND_URL?: string;
  NODE_ENV?: string;
  WA_API_URL?: string;
  WA_API_KEY?: string;
  HYPERDRIVE?: {
    connectionString: string;
  };
  /** DEV ONLY: when 'true', skips WhatsApp send and accepts OTP 123456 for any number. */
  DEV_OTP_BYPASS?: string;
}

export const AUTH_BASE_PATH = '/auth';

const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3020'];
const PROD_ORIGINS = [
  'https://dine.logixsoft.in',
  'https://dine-api.logixsoft.in',
  'https://logixsoft.in',
];

function readEnv(overrides?: Partial<AuthEnv>): {
  databaseUrl: string;
  secret: string;
  apiUrl: string;
  frontendUrl: string;
  isProd: boolean;
  waApiUrl: string;
  waApiKey?: string;
  devOtpBypass: boolean;
} {
  const env = { ...(typeof process !== 'undefined' ? process.env : {}), ...overrides } as any;

  const isProd = env.NODE_ENV === 'production';
  const databaseUrl =
    overrides?.HYPERDRIVE?.connectionString ||
    env.HYPERDRIVE?.connectionString ||
    env.DATABASE_URL ||
    'postgresql://payment_user:payment_pass_logixsoft_2026@127.0.0.1:5432/payment';

  const secret =
    env.BETTER_AUTH_SECRET ||
    'logix_dine_secret_key_2026_super_secure_random_hash_session_cookie_auth';

  const apiUrl =
    env.API_URL || (isProd ? 'https://dine-api.logixsoft.in' : 'http://localhost:8787');

  const frontendUrl =
    env.FRONTEND_URL || (isProd ? 'https://dine.logixsoft.in' : 'http://localhost:3000');

  const waApiUrl = env.WA_API_URL || 'https://wa.logixsoft.in';
  const waApiKey = env.WA_API_KEY;
  const devOtpBypass = env.DEV_OTP_BYPASS === 'true';

  return {
    databaseUrl,
    secret,
    apiUrl,
    frontendUrl,
    isProd,
    waApiUrl,
    waApiKey,
    devOtpBypass,
  };
}

export function createAuth(overrides?: Partial<AuthEnv>) {
  const cfg = readEnv(overrides);

  const { db, close } = createDbWithClient({
    connectionString: cfg.databaseUrl,
    schema: authSchema,
    maxConnections: 1,
  });

  const auth = betterAuth({
    appName: 'Logix Dine',
    baseURL: cfg.apiUrl,
    basePath: AUTH_BASE_PATH,
    secret: cfg.secret,

    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
      cookiePrefix: 'logix-dine',
      crossSubDomainCookies: {
        enabled: cfg.isProd,
        domain: cfg.isProd ? '.logixsoft.in' : undefined,
      },
      defaultCookieAttributes: {
        secure: cfg.isProd,
        sameSite: cfg.isProd ? 'none' : 'lax',
        domain: cfg.isProd ? '.logixsoft.in' : undefined,
      },
    },

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
    }),

    trustedOrigins: Array.from(
      new Set([...(cfg.isProd ? PROD_ORIGINS : DEV_ORIGINS), cfg.frontendUrl])
    ),

    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'CUSTOMER',
          required: false,
          input: false,
        },
        phoneNumber: {
          type: 'string',
          required: false,
        },
        phoneNumberVerified: {
          type: 'boolean',
          defaultValue: false,
          required: false,
        },
      },
    },

    session: {
      cookieCache: {
        enabled: false,
      },
    },

    rateLimit: {
      // NOTE: better-auth's built-in limiter only fires on its own HTTP
      // endpoints (auth.handler). Our custom /auth/phone/* routes call
      // auth.api.* internally, so rate limiting is enforced in the Hono
      // middleware layer instead (see src/lib/rate-limit.ts).
      enabled: false,
    },

    plugins: [
      phoneNumber({
        sendOTP: async ({ phoneNumber: targetPhone, code }) => {
          // When DEV_OTP_BYPASS is enabled, skip WhatsApp — bypass code is set in handleSendOtp
          if (cfg.devOtpBypass) return;

          // Normalize phone number (strip spaces/dashes, default to +91 if 10 digits)
          const digitsOnly = targetPhone.replace(/\D/g, '');
          const normalizedPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

          await sendWhatsAppOtp(
            normalizedPhone,
            code,
            { appName: 'Logix Dine' },
            {
              url: cfg.waApiUrl,
              apiKey: cfg.waApiKey,
            }
          );
        },
        signUpOnVerification: {
          getTempEmail: (phone) => `${phone.replace(/\D/g, '')}@logix-dine.local`,
          getTempName: (phone) => `User ${phone}`,
        },
      }),
    ],
  });

  return { auth, db, close };
}

export type Auth = ReturnType<typeof createAuth>['auth'];
