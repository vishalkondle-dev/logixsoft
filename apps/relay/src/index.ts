import process from 'node:process';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { webhooksRouter } from './routes/webhooks';
import { becknRouter } from './routes/beckn';
import { ordersRouter } from './routes/orders';
import { catalogRouter } from './routes/catalog';
import { relayOpsRouter } from './routes/relay-ops';
import { logisticsRouter } from './routes/logistics';
import { reconciliationRouter } from './routes/reconciliation';
import { bridgeRouter } from './routes/bridge';
import { seedRelayDatabase } from './db/seed';
import { orderQueue } from './queue/order-queue';
import { desktopPosBridge } from './bridge/desktop-bridge';
import { relayOpenApiSpec } from './docs/openapi';
import './normalizer/worker';

export const app = new Hono();

// CORS Middleware
app.use('*', cors());

// High-precision Edge Timing Middleware (<5ms routing SLA tracking)
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(2);
  c.header('X-Response-Time', `${ms}ms`);
  c.header('X-Powered-By', 'Logix Relay Gateway v1.0');
});

// Health & System Info
app.get('/health', (c) => {
  return c.json({
    status: 'HEALTHY',
    service: 'Logix Relay Gateway',
    timestamp: new Date().toISOString(),
    queueDepth: orderQueue.getQueueDepth(),
    uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 0),
    activeChannels: ['SWIGGY', 'ZOMATO', 'MAGICPIN', 'ONDC', 'OWNLY', 'TOING'],
    endpoints: {
      health: '/health',
      docs: '/docs',
      openapi: '/openapi.json',
    },
  });
});

// OpenAPI Specification & Interactive Docs UI
app.get('/openapi.json', (c) => c.json(relayOpenApiSpec));
app.get('/docs', (c) =>
  c.html(`<!doctype html>
<html>
  <head>
    <title>Logix Relay Gateway — API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body { margin: 0; padding: 0; font-family: system-ui, sans-serif; }</style>
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`)
);
app.get('/api/docs', (c) => c.redirect('/docs'));

// Mount Routes
app.route('/webhooks', webhooksRouter);
app.route('/onboard/beckn/bpp', becknRouter);
app.route('/orders', ordersRouter);
app.route('/outlets', catalogRouter);
app.route('/relay', relayOpsRouter);
app.route('/logistics', logisticsRouter);
app.route('/reconciliation', reconciliationRouter);
app.route('/bridge', bridgeRouter);

// Export Cloudflare Durable Object classes
export { RelayBridgeDO } from './durable-objects/relay-bridge';

export default app;
