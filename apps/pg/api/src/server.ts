import { serve } from '@hono/node-server';
import app from './index';

const port = Number(process.env.PORT) || 3031;

console.log(`[pg-api] Payment API running on http://127.0.0.1:${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: '127.0.0.1',
});

