import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { trimTrailingSlash } from 'hono/trailing-slash';

type Bindings = {
  // Bindings for Cloudflare Workers (e.g. KV, D1, Queues, Environment variables)
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 1. Request ID Middleware: Generates a unique UUID for each request & sets X-Request-Id header
app.use('*', requestId());

// 2. Performance Timing: Adds Server-Timing headers to inspect API latency
app.use('*', timing());

// 3. Logger Middleware: Logs request methods, paths, status codes, and execution duration
app.use('*', logger());

// 4. Secure Headers: Protects against common web vulnerabilities (XSS, Clickjacking, MIME-sniffing)
app.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
  })
);

// 5. CORS Middleware: Configures Cross-Origin Resource Sharing for web & mobile apps
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://dine.logixsoft.in',
  'https://dine-api.logixsoft.in',
  'https://logixsoft.in',
];

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return '*';
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      const frontendUrl = c.env?.FRONTEND_URL;
      if (frontendUrl && origin === frontendUrl) return origin;
      return origin; // Permissive for API consumers & dev environments
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-api-key'],
    exposeHeaders: ['Content-Length', 'X-Request-Id', 'Server-Timing'],
    maxAge: 86400,
  })
);

// 6. Trailing Slash Middleware: Normalizes URLs by trimming trailing slashes
app.use('*', trimTrailingSlash());

// 7. Pretty JSON Middleware: Formats JSON responses when requested via ?pretty
app.use('*', prettyJSON());

// 8. Body Limit Middleware: Prevents large payload denial-of-service (5MB limit)
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

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'logix-dine-api',
    timestamp: new Date().toISOString(),
  });
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
