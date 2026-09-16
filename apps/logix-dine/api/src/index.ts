import { Hono } from 'hono';

type Bindings = {
  // Bindings for Cloudflare Workers (e.g. KV, D1, Queues, Environment variables)
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
  });
});

export default app;
