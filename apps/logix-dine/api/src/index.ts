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
import { HealthResponseSchema } from '@logixsoft/logix-dine/schemas/health';

type Bindings = {
  // Bindings for Cloudflare Workers (e.g. KV, D1, Queues, Environment variables)
  ENVIRONMENT?: string;
  FRONTEND_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 1. Request ID Middleware: Generates unique UUID for each request & sets X-Request-Id
app.use('*', requestId());

// 2. Performance Timing: Adds Server-Timing headers
app.use('*', timing());

// 3. Logger Middleware: Logs request methods, paths, status codes, and execution duration
app.use('*', logger());

// 4. Secure Headers: Protects against common web vulnerabilities
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
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-api-key'],
    exposeHeaders: ['Content-Length', 'X-Request-Id', 'Server-Timing'],
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

// OpenAPI: Health Check Route
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

// Register OpenAPI 3.1 specification at /doc
createOpenApiDocument(app, {
  info: {
    title: 'Logix Dine API',
    version: '1.0.0',
    description: 'OpenAPI specification for Logix Dine API service',
  },
  servers: [
    {
      url: 'https://dine-api.logixsoft.in',
      description: 'Production server',
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
