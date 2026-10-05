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
import * as z from 'zod';
import { generateId } from '@logixsoft/helpers/crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { HealthResponseSchema } from '@logixsoft/logix-dine/schemas/health';
import {
  SendOtpRequestSchema,
  SendOtpResponseSchema,
  VerifyOtpRequestSchema,
  AuthUserSchema,
  AuthSessionSchema,
} from '@logixsoft/logix-dine/schemas/auth';
import { apiDoc, ErrorResponseSchema } from './lib/openapi';
import { createAuth, AUTH_BASE_PATH, type AuthEnv } from './lib/auth';
import { rateLimiter } from './lib/rate-limit';
import { toAuthSession, toAuthUser } from '@logixsoft/logix-dine/mappers/auth';
import { createDbWithClient } from './db';
import { user, verification } from '@logixsoft/logix-dine/schemas/auth-schema';
import { outletStaff } from '@logixsoft/logix-dine/schemas/pos-schema';
import { appSchema } from './db';
import './types'; // Hono ContextVariableMap declarations
import { onboardingRoutes } from './routes/onboarding';
import { restaurantRoutes } from './routes/restaurants';
import { outletRoutes } from './routes/outlets';
import { menuRoutes } from './routes/menu';
import { orderRoutes } from './routes/orders';
import { kitchenRoutes } from './routes/kitchen';
import { portalRoutes } from './routes/portal';
import { adminRoutes } from './routes/admin';
import { staffRoutes } from './routes/staff';
import { tableRoutes } from './routes/tables';
import { reportRoutes } from './routes/reports';
import { customerRoutes } from './routes/customers';
import { waiterRoutes } from './routes/waiter';
import { deliveryRoutes } from './routes/delivery';
import { reservationRoutes } from './routes/reservations';
import { inventoryRoutes } from './routes/inventory';
import feedbackRoutes from './routes/feedback';
import { rolesRouter } from './routes/roles';
import { webhookRoutes } from './routes/webhooks';
import { expenseRoutes } from './routes/expenses';
import { storeSessionPayload, resolveSessionPayload, getSecret } from './lib/tenancy';
import { signSessionJwt } from './lib/jwt';
import { extractSessionToken } from './lib/cache';

type Bindings = AuthEnv & {
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
  OUTLET_ROOM?: DurableObjectNamespace;
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

/**
 * Extract the session cookie from a Better Auth response as a request
 * `Cookie` header. Better Auth's api methods need the REQUEST cookie —
 * passing response headers (which only carry Set-Cookie) silently
 * resolves no session.
 */
function sessionCookieHeader(res: Response): Headers | undefined {
  const setCookie = res.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  if (!cookiePair) return undefined;
  const headers = new Headers();
  headers.set('cookie', cookiePair);
  return headers;
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
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'x-api-key', 'X-Restaurant-Id', 'X-Outlet-Id'],
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

    // DEV: When bypass is enabled, overwrite the stored OTP with 123456
    const isBypass = (c.env?.DEV_OTP_BYPASS ?? process.env.DEV_OTP_BYPASS) === 'true';
    if (isBypass) {
      await db
        .update(verification)
        .set({ value: '123456:0', updatedAt: new Date() })
        .where(eq(verification.identifier, normalizedPhone));
    }

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
    // DEV: When bypass is enabled, ensure OTP 123456 exists and is valid
    const isBypass = (c.env?.DEV_OTP_BYPASS ?? process.env.DEV_OTP_BYPASS) === 'true';
    if (isBypass && parsed.otp === '123456') {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
      const [existingV] = await db
        .select()
        .from(verification)
        .where(eq(verification.identifier, normalizedPhone));
      if (existingV) {
        await db
          .update(verification)
          .set({ value: '123456:0', expiresAt, updatedAt: now })
          .where(eq(verification.identifier, normalizedPhone));
      } else {
        await db.insert(verification).values({
          id: generateId('ver'),
          identifier: normalizedPhone,
          value: '123456:0',
          expiresAt,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

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
          headers: sessionCookieHeader(verifyRes),
        });
      } catch (err) {
        console.warn('[updateUser] Note on updateUser:', err);
      }
    }

    // 3. Fetch established session: pass the session cookie as a REQUEST
    //    header — verifyRes.headers only carries Set-Cookie (response), and
    //    getSession/auth calls need the Cookie header to resolve a session.
    const sessionCookieHeaders = sessionCookieHeader(verifyRes);
    const sessionData = sessionCookieHeaders
      ? await auth.api.getSession({ headers: sessionCookieHeaders })
      : await auth.api.getSession();

    const [freshUser] = await db
      .select()
      .from(user)
      .where(eq(user.phoneNumber, normalizedPhone))
      .limit(1);

    // Auto-link staff records for this phone number.
    // When staff are added by phone before logging in, their userId is linked on first OTP login.
    if (freshUser) {
      const posDb = createDbWithClient({
        connectionString: (c.env?.HYPERDRIVE?.connectionString) || c.env?.DATABASE_URL || '',
        schema: appSchema,
        maxConnections: 1,
      });
      try {
        await posDb.db
          .update(outletStaff)
          .set({ userId: freshUser.id, updatedAt: new Date(), updatedBy: normalizedPhone })
          .where(and(eq(outletStaff.phone, normalizedPhone), isNull(outletStaff.userId)));
      } catch (err) {
        console.warn('[verify-otp] Could not auto-link staff:', err);
      } finally {
        await posDb.close();
      }
    }

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

    // Store session payload in KV synchronously before responding —
    // this ensures the very next request from the client hits the cache.
    const sessionToken = extractSessionToken(
      [...verifyRes.headers.entries()]
        .filter(([k]) => k.toLowerCase() === 'set-cookie')
        .map(([, v]) => v)
        .join('; ')
    );
    if (sessionToken) {
      await storeSessionPayload(c, sessionToken, freshUser).catch((err) =>
        console.warn('[verify-otp] storeSessionPayload failed:', err)
      );
    }

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
app.post(
  '/auth/phone/send-otp',
  apiDoc({
    tags: ['Auth'],
    summary: 'Send WhatsApp OTP',
    description: 'Dispatches a 6-digit one-time password to the specified WhatsApp phone number for login or registration.',
    body: SendOtpRequestSchema,
    responses: {
      200: SendOtpResponseSchema,
      500: ErrorResponseSchema,
    },
  }),
  rateLimiter({ keyPrefix: 'send-otp', max: 3 }),
  handleSendOtp
);
app.post('/api/auth/phone/send-otp', rateLimiter({ keyPrefix: 'send-otp', max: 3 }), handleSendOtp);

app.post(
  '/auth/phone/verify',
  apiDoc({
    tags: ['Auth'],
    summary: 'Verify WhatsApp OTP',
    description: 'Verifies the WhatsApp OTP, signs the user in or completes registration, establishes a session cookie, and returns the active session.',
    body: VerifyOtpRequestSchema,
    responses: {
      200: AuthSessionSchema,
      400: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  }),
  rateLimiter({ keyPrefix: 'verify-otp', max: 10 }),
  handleVerifyOtp
);
app.post('/api/auth/phone/verify', rateLimiter({ keyPrefix: 'verify-otp', max: 10 }), handleVerifyOtp);

app.get(
  '/auth/me',
  apiDoc({
    tags: ['Auth'],
    summary: 'Get Current Authenticated User & Session',
    description: 'Returns the currently authenticated user profile and active session based on session cookies.',
    security: [{ cookieAuth: [] }],
    responses: {
      200: AuthSessionSchema,
      401: z.object({ user: z.null(), session: z.null() }),
    },
  }),
  handleGetMe
);
app.get('/api/auth/me', handleGetMe);

// ─── WebSocket Ticket ─────────────────────────────────────────────────────────
// Must be registered BEFORE the Better Auth catch-all (/auth/*) below.
// Issues a short-lived (2 min) signed JWT for WebSocket authentication.
// Browsers cannot set Cookie headers on cross-origin WS upgrades, so we pass
// the ticket as ?token= which resolveSessionPayload() already supports.
const handleWsTicket = async (c: any) => {
  const { payload } = await resolveSessionPayload(c);
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const secret = getSecret(c);
  const ticket = await signSessionJwt(payload, secret, 120); // 2-minute TTL
  return c.json({ ticket });
};

const WsTicketResponseSchema = z.object({
  ticket: z.string().describe('Short-lived signed JWT session ticket for WebSocket authentication'),
});

app.get(
  '/auth/ws-ticket',
  apiDoc({
    tags: ['Auth'],
    summary: 'Issue WebSocket Authentication Ticket',
    description: 'Issues a short-lived (2 min) signed JWT for authenticating WebSocket connections without cookies.',
    responses: {
      200: WsTicketResponseSchema,
      401: ErrorResponseSchema,
    },
  }),
  handleWsTicket
);
app.get(
  '/api/auth/ws-ticket',
  apiDoc({
    tags: ['Auth'],
    summary: 'Issue WebSocket Authentication Ticket (API Prefix)',
    description: 'Issues a short-lived (2 min) signed JWT for authenticating WebSocket connections without cookies.',
    responses: {
      200: WsTicketResponseSchema,
      401: ErrorResponseSchema,
    },
  }),
  handleWsTicket
);

app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, handleBetterAuth);
app.on(['GET', 'POST'], `/api${AUTH_BASE_PATH}/*`, handleBetterAuth);

// -------------------------------------------------------------
// POS / Billing routes (dual-mount /xxx and /api/xxx)
// -------------------------------------------------------------
app.route('/onboarding', onboardingRoutes);
app.route('/api/onboarding', onboardingRoutes);

app.route('/restaurants', restaurantRoutes);
app.route('/api/restaurants', restaurantRoutes);

app.route('/outlets', outletRoutes);
app.route('/api/outlets', outletRoutes);

app.route('/menu', menuRoutes);
app.route('/api/menu', menuRoutes);

app.route('/orders', orderRoutes);
app.route('/api/orders', orderRoutes);

app.route('/kitchen', kitchenRoutes);
app.route('/api/kitchen', kitchenRoutes);

app.route('/portal', portalRoutes);
app.route('/api/portal', portalRoutes);

app.route('/admin', adminRoutes);
app.route('/api/admin', adminRoutes);

app.route('/staff', staffRoutes);
app.route('/api/staff', staffRoutes);

app.route('/tables', tableRoutes);
app.route('/api/tables', tableRoutes);

app.route('/reports', reportRoutes);
app.route('/api/reports', reportRoutes);

app.route('/customers', customerRoutes);
app.route('/api/customers', customerRoutes);

app.route('/waiter', waiterRoutes);
app.route('/api/waiter', waiterRoutes);

app.route('/delivery', deliveryRoutes);
app.route('/api/delivery', deliveryRoutes);

app.route('/reservations', reservationRoutes);
app.route('/api/reservations', reservationRoutes);

app.route('/inventory', inventoryRoutes);
app.route('/api/inventory', inventoryRoutes);

app.route('/feedback', feedbackRoutes);
app.route('/api/feedback', feedbackRoutes);

app.route('/roles', rolesRouter);
app.route('/api/roles', rolesRouter);

app.route('/webhooks', webhookRoutes);
app.route('/api/webhooks', webhookRoutes);

app.route('/expenses', expenseRoutes);
app.route('/api/expenses', expenseRoutes);



// Real-time Outlet Live Sync via Durable Objects
const handleLiveWs = async (c: any) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  const outletId = c.req.param('outletId');
  if (!outletId) {
    return c.text('Outlet ID required', 400);
  }

  const { payload } = await resolveSessionPayload(c);
  if (!payload) {
    return c.text('Unauthorized: Valid session required', 401);
  }

  const hasOutletAccess = payload.memberships?.some((m: any) => m.outletIds.includes(outletId));
  if (!hasOutletAccess && payload.user.role !== 'CUSTOMER') {
    return c.text('Forbidden: You do not have access to this outlet', 403);
  }

  const doNamespace = c.env.OUTLET_ROOM;
  if (!doNamespace) {
    return c.text('Durable Objects not configured', 503);
  }

  const id = doNamespace.idFromName(outletId);
  const stub = doNamespace.get(id);

  return stub.fetch(c.req.raw);
};

app.get('/live/outlets/:outletId', handleLiveWs);
app.get('/api/live/outlets/:outletId', handleLiveWs);

// Real-time Customer Live Sync via Durable Objects
const handleCustomerLiveWs = async (c: any) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  const phone = c.req.param('phone');
  if (!phone) {
    return c.text('Customer Phone required', 400);
  }

  const rawDigits = phone.replace(/\D/g, '').slice(-10);
  if (!rawDigits) {
    return c.text('Invalid phone number', 400);
  }

  const { payload } = await resolveSessionPayload(c);
  if (!payload) {
    return c.text('Unauthorized: Valid session required', 401);
  }

  const callerPhone = (payload.user.phoneNumber || '').replace(/\D/g, '').slice(-10);
  const isStaffOrOwner = payload.memberships && payload.memberships.length > 0;
  if (callerPhone !== rawDigits && !isStaffOrOwner) {
    return c.text('Forbidden: You can only subscribe to your own customer updates', 403);
  }

  const doNamespace = c.env.OUTLET_ROOM;
  if (!doNamespace) {
    return c.text('Durable Objects not configured', 503);
  }

  const id = doNamespace.idFromName(`customer:${rawDigits}`);
  const stub = doNamespace.get(id);

  return stub.fetch(c.req.raw);
};

app.get('/live/customers/:phone', handleCustomerLiveWs);
app.get('/api/live/customers/:phone', handleCustomerLiveWs);

// Register OpenAPI 3.1 specification at /doc
const openApiDoc = createOpenApiDocument(
  app,
  {
    info: {
      title: 'Logix Dine API',
      version: '2.0.0',
      description: 'Comprehensive OpenAPI 3.1 specification for Logix Dine restaurant management platform, featuring feature-driven endpoints for POS orders, Kitchen Display System (KDS), Customer Self-Service Portal, Waiter floor assistance, Delivery & Rider fleet dispatch, Menu management, and WhatsApp OTP authentication.',
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
    tags: [
      { name: 'Health', description: 'API health and uptime status' },
      { name: 'Auth', description: 'WhatsApp OTP authentication, WebSocket tickets, and user sessions' },
      { name: 'Orders', description: 'POS table orders, rounds, settlement, WhatsApp bills, and order lifecycle' },
      { name: 'Kitchen', description: 'Kitchen Display System (KDS) tickets, item preparation, and order fulfillment' },
      { name: 'Waiter', description: 'Waiter assistance requests, table calls, and floor service status' },
      { name: 'Delivery', description: 'Delivery orders, rider assignment, dispatch, and OTP verification' },
      { name: 'Customer Portal', description: 'Customer self-service ordering, table QR scans, menu browsing, live tracking, and waiter calls' },
      { name: 'Tables', description: 'Dining table management, layout, and occupancy tracking' },
      { name: 'Menu', description: 'Menu categories and item catalogue management' },
      { name: 'Restaurants', description: 'Restaurant profiles and membership roles' },
      { name: 'Outlets', description: 'Restaurant outlet / branch management' },
      { name: 'Staff', description: 'Staff members, roles, and invitation management' },
      { name: 'Customers', description: 'Customer CRM, lifetime metrics, order history, tags, and notes' },
      { name: 'Reports', description: 'Financial analytics, daily sales, item sales, and tax reports' },
      { name: 'Inventory', description: 'Raw materials, recipes (BOM), stock ledger, purchases, and food cost margins' },
      { name: 'Onboarding', description: 'Initial restaurant registration and setup' },
      { name: 'Admin', description: 'Platform administration and system role management' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'Session cookie created upon successful OTP verification',
        },
        restaurantHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-restaurant-id',
          description: 'Active restaurant context identifier',
        },
        outletHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-outlet-id',
          description: 'Active outlet context identifier',
        },
      },
    },
  },
  { addRoute: false }
);

// Filter out redundant /api/ prefix duplicate routes from the documentation so only canonical paths appear
const cleanOpenApiDoc = {
  ...openApiDoc,
  paths: Object.fromEntries(
    Object.entries(openApiDoc.paths || {}).filter(([p]) => !p.startsWith('/api/'))
  ),
};

app.get('/doc', (c) => c.json(cleanOpenApiDoc, 200));
app.get('/api/doc', (c) => c.json(cleanOpenApiDoc, 200));

// Interactive API Documentation via Scalar UI at /ui and /api/ui
const scalarHtml = `<!doctype html>
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
</html>`;

app.get('/ui', (c) => c.html(scalarHtml));
app.get('/api/ui', (c) => c.html(scalarHtml));

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

export { OutletRoomDO } from './durable-objects/outlet-room';

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    console.log('[Scheduled] Cron triggered at:', new Date().toISOString(), event?.cron);
    const { createDbWithClient } = await import('./db');
    const { sendOutletDailyClosingReport, getTodayISTDateString } = await import('./lib/closing-report');
    const hyperdriveUrl = (env as any)?.HYPERDRIVE?.connectionString;
    const dbUrl = hyperdriveUrl || (env as any)?.DATABASE_URL || '';
    const { db, close } = createDbWithClient({ connectionString: dbUrl, schema: appSchema, maxConnections: 1 });
    try {
      const activeOutlets = await db
        .select({
          id: appSchema.restaurantOutlet.id,
          restaurantId: appSchema.restaurantOutlet.restaurantId,
          name: appSchema.restaurantOutlet.name,
          phone: appSchema.restaurantOutlet.phone,
          status: appSchema.restaurantOutlet.status,
          whatsappSettings: appSchema.restaurantOutlet.whatsappSettings,
        })
        .from(appSchema.restaurantOutlet)
        .where(eq(appSchema.restaurantOutlet.status, 'ACTIVE'));

      console.log(`[Scheduled] Processing EOD closing reports for ${activeOutlets.length} active outlet(s)...`);
      const todayIST = getTodayISTDateString();

      for (const outlet of activeOutlets) {
        try {
          const ws = (outlet.whatsappSettings as any) || {};
          const enabled = ws.enabled !== false && ws.sendDailyClosingReport !== false;
          if (!enabled) {
            console.log(`[Scheduled] Skipping outlet ${outlet.name} (${outlet.id}) - closing report disabled`);
            continue;
          }

          const targetPhone = ws.ownerClosingReportPhone || outlet.phone;
          if (!targetPhone) {
            console.log(`[Scheduled] Skipping outlet ${outlet.name} (${outlet.id}) - no phone found`);
            continue;
          }

          console.log(`[Scheduled] Dispatching closing report to ${targetPhone} for ${outlet.name}...`);
          const res = await sendOutletDailyClosingReport(
            db,
            env,
            outlet.restaurantId,
            outlet.id,
            targetPhone,
            todayIST
          );
          console.log(`[Scheduled] Successfully dispatched closing report to ${res.recipientPhone}`);
        } catch (outletErr) {
          console.error(`[Scheduled] Failed to dispatch closing report for outlet ${outlet.id}:`, outletErr);
        }
      }
    } catch (cronErr) {
      console.error('[Scheduled] Fatal error in scheduled cron runner:', cronErr);
    } finally {
      await close();
    }
  },
};

