import { Hono } from 'hono';
import { orderQueue } from '../queue/order-queue';
import { adapterRegistry } from '../adapters';
import { relayStore } from '../db';
import type { ChannelCode } from '@logixsoft/relay-schema';

export const webhooksRouter = new Hono();

/**
 * Universal Inbound Webhook Ingestor with Fast-Ack SLA (<300ms).
 */
async function handleWebhookIngest(
  c: any,
  channelCode: ChannelCode,
  eventType: 'ORDER_PLACED' | 'ORDER_CANCELLED' | 'RIDER_UPDATE' | 'STATUS_UPDATE',
  channelOrderIdExtractor: (body: any) => string
) {
  const startTime = performance.now();
  const rawBody = await c.req.text();
  let parsedBody: any = {};

  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    parsedBody = {};
  }

  // 1. Signature Verification
  const adapter = adapterRegistry.get(channelCode);
  const outletId = parsedBody.outlet_id || parsedBody.restaurant_id || parsedBody.res_id || 'outlet_default';
  const integration = await relayStore.getOutletIntegration(outletId, channelCode);
  const secret = integration?.credentials?.webhookSecret || integration?.credentials?.apiSecret || 'test_secret';

  const isValid = await adapter.verifyWebhook(c.req.raw, rawBody, secret);
  if (!isValid) {
    return c.json({ error: 'Unauthorized', message: 'HMAC signature verification failed' }, 401);
  }

  // 2. Extract channel order ID
  const channelOrderId = channelOrderIdExtractor(parsedBody);

  // 3. Enqueue to distributed / in-memory buffer with idempotency key
  const headersObj: Record<string, string> = {};
  c.req.raw.headers.forEach((val: string, key: string) => {
    headersObj[key] = val;
  });

  let executionCtx: any = undefined;
  try {
    executionCtx = c.executionCtx;
  } catch {
    // Standard Node or test environment without Cloudflare execution context
  }

  const enqueueResult = orderQueue.enqueue(
    channelCode,
    channelOrderId,
    eventType,
    parsedBody,
    headersObj,
    executionCtx,
    c.env
  );

  const totalAckLatencyMs = Number((performance.now() - startTime).toFixed(2));

  // 4. Return Fast-Ack (<300ms SLA, typically <5ms)
  return c.json(
    {
      status: 'SUCCESS',
      message: enqueueResult.isDuplicate ? 'Duplicate webhook acknowledged' : 'Webhook accepted and queued',
      channelCode,
      channelOrderId,
      jobId: enqueueResult.jobId,
      idempotencyKey: enqueueResult.idempotencyKey,
      isDuplicate: enqueueResult.isDuplicate,
      ackLatencyMs: totalAckLatencyMs,
      slaPassed: totalAckLatencyMs < 300,
    },
    200
  );
}

// ─── Swiggy Webhooks ──────────────────────────────────────────────────────────
webhooksRouter.post('/swiggy/order', (c) =>
  handleWebhookIngest(c, 'SWIGGY', 'ORDER_PLACED', (body) => {
    return String(body.order_id || body.order?.order_id || body.id || `sw_${Date.now()}`);
  })
);

webhooksRouter.post('/swiggy/status', (c) =>
  handleWebhookIngest(c, 'SWIGGY', 'RIDER_UPDATE', (body) => {
    return String(body.order_id || body.order?.order_id || body.id || `sw_${Date.now()}`);
  })
);

// ─── Zomato Webhooks ──────────────────────────────────────────────────────────
webhooksRouter.post('/zomato/order', (c) =>
  handleWebhookIngest(c, 'ZOMATO', 'ORDER_PLACED', (body) => {
    return String(body.order_id || body.order_data?.order_id || body.id || `zom_${Date.now()}`);
  })
);

webhooksRouter.post('/zomato/status', (c) =>
  handleWebhookIngest(c, 'ZOMATO', 'RIDER_UPDATE', (body) => {
    return String(body.order_id || body.order_data?.order_id || body.id || `zom_${Date.now()}`);
  })
);

// ─── Magicpin Webhooks ────────────────────────────────────────────────────────
webhooksRouter.post('/magicpin/order', (c) =>
  handleWebhookIngest(c, 'MAGICPIN', 'ORDER_PLACED', (body) => {
    return String(body.order_id || body.data?.order_id || body.id || `mp_${Date.now()}`);
  })
);

// ─── Direct Channels (Ownly / Toing) Webhooks ────────────────────────────────
webhooksRouter.post('/ownly/order', (c) =>
  handleWebhookIngest(c, 'OWNLY', 'ORDER_PLACED', (body) => {
    return String(body.order_id || body.order?.order_id || body.id || `own_${Date.now()}`);
  })
);

webhooksRouter.post('/toing/order', (c) =>
  handleWebhookIngest(c, 'TOING', 'ORDER_PLACED', (body) => {
    return String(body.order_id || body.order?.order_id || body.id || `toi_${Date.now()}`);
  })
);
