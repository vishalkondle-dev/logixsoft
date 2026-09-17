import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { createOpenApiDocument, openApi } from 'hono-zod-openapi';
import { eq } from 'drizzle-orm';
import { HealthResponseSchema } from '@logixsoft/logix-dine/schemas/health';
import {
  SendOtpRequestSchema,
  SendOtpResponseSchema,
  VerifyOtpRequestSchema,
  AuthUserSchema,
  AuthSessionSchema,
} from '@logixsoft/logix-dine/schemas/auth';
import { createAuth, AUTH_BASE_PATH, type AuthEnv } from './lib/auth';
import { rateLimiter } from './lib/rate-limit';
import { toAuthSession, toAuthUser } from '@logixsoft/logix-dine/mappers/auth';
import { user } from '@logixsoft/logix-dine/schemas/auth-schema';

type Bindings = AuthEnv & {
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Helper to normalize mobile numbers to standard E.164 format (+91 for 10-digit Indian numbers)
function normalizePhone(input: string): string {
  const cleaned = input.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${digits}`;
}

// 1. Request ID Middleware
app.use('*', requestId());

// 2. Performance Timing
app.use('*', timing());

// 3. Logger Middleware
app.use('*', logger());

// 4. Secure Headers
app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
  })
);

// 5. CORS Middleware
const ALLOWED_ORIGINS = [
  'https://dine.logixsoft.in',
  'https://dine-api.logixsoft.in',
  'https://logixsoft.in',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3020',
];

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return ALLOWED_ORIGINS[0];
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      const frontendUrl = c.env?.FRONTEND_URL;
      if (frontendUrl && origin === frontendUrl) return origin;
      return ALLOWED_ORIGINS[0];
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'x-api-key'],
    exposeHeaders: ['Content-Length', 'Set-Cookie', 'X-Request-Id', 'Server-Timing'],
    maxAge: 86400,
  })
);

// 6. Trailing Slash Middleware
app.use('*', trimTrailingSlash());

// 7. Pretty JSON Middleware
app.use('*', prettyJSON());

// 8. Body Limit Middleware (5MB limit)
app.use(
  '*',
  bodyLimit({
    maxSize: 5 * 1024 * 1024,
    onError: (c) => {
      return c.json(
        {
          error: 'Payload Too Large',
          message: 'Request body exceeds 5MB limit',
        },
        413
      );
    },
  })
);

// Helper to obtain fresh Auth and DB instance per request
function getAuthInstance(c: any) {
  const hyperdriveUrl = c?.env?.HYPERDRIVE?.connectionString;
  const overrides: Partial<AuthEnv> = {
    ...(hyperdriveUrl ? { DATABASE_URL: hyperdriveUrl } : {}),
    ...(c?.env || {}),
  };
  return createAuth(overrides);
}

// -------------------------------------------------------------
// OpenAPI Route: Health Check
// -------------------------------------------------------------
app.get(
  '/health',
  openApi({
    tags: ['Health'],
    summary: 'Check API Health',
    description: 'Returns the health status and metadata for logix-dine-api',
    responses: {
      200: HealthResponseSchema,
    },
  }),
  (c) => {
    return c.var.res(200, {
      status: 'ok',
      service: 'logix-dine-api',
      timestamp: new Date().toISOString(),
    });
  }
);

// -------------------------------------------------------------
// Handlers for OTP and Session
// -------------------------------------------------------------
const handleSendOtp = async (c: any) => {
  const body = await c.req.json();
  const parsed = SendOtpRequestSchema.parse(body);
  const normalizedPhone = normalizePhone(parsed.phoneNumber);

  const { auth, db, close } = getAuthInstance(c);
  try {
    // 1. Check if user already exists
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.phoneNumber, normalizedPhone))
      .limit(1);

    const userExists = !!existingUser;

    // 2. Dispatch OTP via Better Auth phone number plugin (which invokes WhatsApp client)
    await auth.api.sendPhoneNumberOTP({
      body: {
        phoneNumber: normalizedPhone,
      },
    });

    return c.json({
      success: true,
      message: 'OTP sent successfully to your WhatsApp number',
      userExists,
    });
  } catch (err: any) {
    console.error('[send-otp] Error dispatching OTP:', err);
    return c.json(
      {
        success: false,
        message: err?.message || 'Failed to dispatch WhatsApp OTP',
        userExists: false,
      },
      500
    );
  } finally {
    await close();
  }
};

const handleVerifyOtp = async (c: any) => {
  const body = await c.req.json();
  const parsed = VerifyOtpRequestSchema.parse(body);
  const normalizedPhone = normalizePhone(parsed.phoneNumber);

  const { auth, db, close } = getAuthInstance(c);
  try {
    // 1. Call Better Auth to verify phone OTP and establish session
    const verifyRes = await auth.api.verifyPhoneNumber({
      body: {
        phoneNumber: normalizedPhone,
        code: parsed.otp,
      },
      asResponse: true,
    });

    if (!verifyRes.ok) {
      const errorData = (await verifyRes.json().catch(() => ({}))) as any;
      return c.json(
        {
          error: 'Verification Failed',
          message: errorData?.message || 'Invalid or expired verification code',
        },
        400
      );
    }

    // 2. If name is provided, update the user record in database
    if (parsed.name) {
      await db
        .update(user)
        .set({ name: parsed.name, phoneNumberVerified: true, updatedAt: new Date() })
        .where(eq(user.phoneNumber, normalizedPhone));

      try {
        await auth.api.updateUser({
          body: { name: parsed.name },
          headers: verifyRes.headers,
        });
      } catch (err) {
        console.warn('[updateUser] Note on updateUser:', err);
      }
    }

    // 3. Fetch established session details and fresh user record directly from database
    const sessionData = await auth.api.getSession({
      headers: verifyRes.headers,
    });

    const [freshUser] = await db
      .select()
      .from(user)
      .where(eq(user.phoneNumber, normalizedPhone))
      .limit(1);

    const responseHeaders = new Headers();
    // Forward all Set-Cookie headers from Better Auth
    verifyRes.headers.forEach((val: string, key: string) => {
      if (key.toLowerCase() === 'set-cookie') {
        responseHeaders.append('Set-Cookie', val);
      }
    });
    responseHeaders.set('Content-Type', 'application/json');

    const responseBody = toAuthSession(toAuthUser(freshUser, sessionData?.user, {
      name: parsed.name,
      phoneNumber: normalizedPhone,
    }), sessionData?.session);

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('[verify-otp] Error verifying OTP:', err);
    return c.json(
      {
        error: 'Authentication Error',
        message: err?.message || 'Could not verify OTP code',
      },
      500
    );
  } finally {
    await close();
  }
};

const handleGetMe = async (c: any) => {
  const { auth, db, close } = getAuthInstance(c);
  try {
    const sessionData = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!sessionData?.user) {
      return c.json({ user: null, session: null }, 401);
    }

    const [freshUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, sessionData.user.id))
      .limit(1);

    const sessionPayload = toAuthSession(
      toAuthUser(freshUser, sessionData.user),
      sessionData.session
    );

    return c.json({
      user: sessionPayload.user,
      session: sessionPayload.session,
    });
  } finally {
    await close();
  }
};

const handleBetterAuth = async (c: any) => {
  const { auth, close } = getAuthInstance(c);
  try {
    const response = await auth.handler(c.req.raw);
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    await close();
  }
};

// -------------------------------------------------------------
// Register routes under both /auth and /api/auth
// -------------------------------------------------------------
// OTP endpoints are rate-limited per IP (DB-backed, works across isolates)
app.post('/auth/phone/send-otp', rateLimiter({ keyPrefix: 'send-otp', max: 3 }), handleSendOtp);
app.post('/api/auth/phone/send-otp', rateLimiter({ keyPrefix: 'send-otp', max: 3 }), handleSendOtp);

app.post('/auth/phone/verify', rateLimiter({ keyPrefix: 'verify-otp', max: 10 }), handleVerifyOtp);
app.post('/api/auth/phone/verify', rateLimiter({ keyPrefix: 'verify-otp', max: 10 }), handleVerifyOtp);

app.get('/auth/me', handleGetMe);
app.get('/api/auth/me', handleGetMe);

app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, handleBetterAuth);
app.on(['GET', 'POST'], `/api${AUTH_BASE_PATH}/*`, handleBetterAuth);

// Register OpenAPI 3.1 specification at /doc
createOpenApiDocument(app, {
  info: {
    title: 'Logix Dine API',
    version: '1.0.0',
    description: 'OpenAPI specification for Logix Dine API service with WhatsApp OTP authentication',
  },
  servers: [
    {
      url: 'https://dine-api.logixsoft.in',
      description: 'Production server',
    },
    {
      url: 'http://localhost:8787',
      description: 'Local development server',
    },
  ],
});

// Interactive API Documentation via Scalar UI at /ui
app.get('/ui', (c) => {
  return c.html(`<!doctype html>
<html>
  <head>
    <title>Logix Dine API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body>
    <script id="api-reference" data-url="/doc"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`);
});

// 404 Not Found Handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `Cannot ${c.req.method} ${c.req.path}`,
      timestamp: new Date().toISOString(),
    },
    404
  );
});

// Global Error Handler
app.onError((err, c) => {
  console.error(`[logix-dine-api] Error on ${c.req.method} ${c.req.path}:`, err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  return c.json(
    {
      error: 'Internal Server Error',
      message,
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
    500
  );
});

export default app;
