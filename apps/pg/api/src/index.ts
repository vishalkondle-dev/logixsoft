import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth, AUTH_BASE_PATH } from './lib/auth';
import { createDbWithClient, type Database } from './db';
import { authSchema } from './db/auth-schema';
import { pgSchema } from './db/schema';
import { createOrdersRouter } from './routes/orders';
import { createWebhooksRouter } from './routes/webhooks';
import { createMerchantRouter } from './routes/merchant';
import { createMandatesRouter } from './routes/mandates';

type Bindings = {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  API_URL?: string;
  FRONTEND_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3020',
  'http://localhost:3100',
  'https://payment.logixsoft.in',
  'https://payment-api.logixsoft.in',
  'https://pg.logixsoft.in',
];

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return '*';
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      const extra = c.env?.FRONTEND_URL || process.env.FRONTEND_URL;
      return extra && origin === extra ? origin : origin; // Permissive in dev/sandbox
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'x-api-key', 'x-verify'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 86400,
  })
);

app.get('/health', (c) => c.json({ version: '0.0.1', service: 'pg-api', status: 'ok' }));

app.get('/', (c) => {
  const error = c.req.query('error');
  if (error) {
    return c.redirect(`https://payment.logixsoft.in/login?error=${encodeURIComponent(error)}`);
  }
  return c.redirect('https://payment.logixsoft.in');
});

// Helper to get fresh DB client per request (uses Hyperdrive on Cloudflare Workers, fallback locally)
function getDbConnection(c?: any): { db: Database; close: () => Promise<void> } {
  const hyperdriveUrl = c?.env?.HYPERDRIVE?.connectionString;
  const connectionString =
    hyperdriveUrl ||
    c?.env?.DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://payment_user:payment_pass_logixsoft_2026@127.0.0.1:5432/payment';

  const schema = { ...authSchema, ...pgSchema };
  return createDbWithClient({
    connectionString,
    schema,
    maxConnections: 1,
  });
}

function getAuthInstance(c?: any) {
  const hyperdriveUrl = c?.env?.HYPERDRIVE?.connectionString;
  const overrides = {
    ...(hyperdriveUrl ? { DATABASE_URL: hyperdriveUrl } : {}),
    ...(c?.env || {}),
  };
  return createAuth(overrides);
}

// better-auth endpoint
app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, async (c) => {
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
});

// Mount modular sub-routers
app.route(
  '/api/v1/orders',
  createOrdersRouter(
    (c) => getDbConnection(c),
    (c) => getAuthInstance(c)
  )
);
app.route('/api/v1/webhooks', createWebhooksRouter((c) => getDbConnection(c)));
app.route(
  '/api/v1/merchant',
  createMerchantRouter(
    (c) => getDbConnection(c),
    (c) => getAuthInstance(c)
  )
);
app.route(
  '/api/v1/mandates',
  createMandatesRouter(
    (c) => getDbConnection(c),
    (c) => getAuthInstance(c)
  )
);

app.onError((err, c) => {
  console.error('[pg-api] unhandled error', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  return c.json({ error: 'Internal Server Error', message }, 500);
});

export default app;

