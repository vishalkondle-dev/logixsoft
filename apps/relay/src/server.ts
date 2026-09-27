import { serve } from '@hono/node-server';
import { app } from './index';
import { config } from './config';

const port = config.port;

console.log(`Starting Logix Relay Gateway on port ${port}...`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`🚀 Logix Relay Gateway listening at http://localhost:${info.port}`);
    console.log(`   - Edge Webhook Ingress: http://localhost:${info.port}/webhooks`);
    console.log(`   - ONDC Beckn v1.2 BPP: http://localhost:${info.port}/onboard/beckn/bpp`);
    console.log(`   - Order Controls: http://localhost:${info.port}/orders`);
    console.log(`   - 86'ing Fan-Out SLA: http://localhost:${info.port}/relay/inventory/item-status`);
    console.log(`   - 3PL Logistics Router: http://localhost:${info.port}/logistics/quote`);
    console.log(`   - Financial Reconciliation: http://localhost:${info.port}/reconciliation`);
    console.log(`   - Desktop POS Bridge: http://localhost:${info.port}/bridge/events`);
  }
);
