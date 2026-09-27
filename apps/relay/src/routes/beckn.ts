import { Hono } from 'hono';
import { OndcBecknAdapter } from '../adapters/ondc';
import { relayStore } from '../db';
import { signBecknMessage } from '../crypto/ed25519';
import { desktopPosBridge } from '../bridge/desktop-bridge';
import { syncCanonicalOrderToLogixDine } from '../dine/sync-dine';
import type { OutletCatalog } from '@logixsoft/relay-schema';

export const becknRouter = new Hono();
const ondcAdapter = new OndcBecknAdapter();

async function getBppContext(outletId = 'outlet_default') {
  let intg = await relayStore.getOutletIntegration(outletId, 'ONDC');
  if (!intg) {
    intg = await relayStore.getOutletIntegration('outlet_default', 'ONDC');
  }

  let catalog = await relayStore.getOutletMenu(outletId);
  if (!catalog) {
    catalog = await relayStore.getOutletMenu('outlet_default');
  }

  if (!catalog) {
    catalog = {
      outletId: 'outlet_default',
      name: 'Logix Dine Outlet',
      categories: [],
      operatingHours: [],
      slotTimings: [],
      packagingCharges: { itemLevelDefault: 10, orderLevelDefault: 20, maxPackagingCharge: 100 },
      taxSlabs: [{ id: 'gst5', name: 'GST 5%', ratePercent: 5, cgstPercent: 2.5, sgstPercent: 2.5 }],
      channelMarkupSettings: [],
    };
  }

  const credentials = intg?.credentials || {
    subscriberId: 'bpp.logixsoft.in',
    uniqueKeyId: 'key-1',
    signingPrivateKey: '',
    signingPublicKey: '',
    bppUri: 'https://relay.logixsoft.in/onboard/beckn/bpp',
  };

  return { intg, catalog: catalog as OutletCatalog, credentials };
}

function signAndRespond(c: any, responseBody: any, credentials: any) {
  const rawBody = JSON.stringify(responseBody);
  let authHeader = '';

  if (credentials.signingPrivateKey) {
    try {
      const signed = signBecknMessage(
        rawBody,
        credentials.subscriberId || 'bpp.logixsoft.in',
        credentials.uniqueKeyId || 'key-1',
        credentials.signingPrivateKey
      );
      authHeader = signed.authorizationHeader;
    } catch (err) {
      console.warn('[BecknRouter] Ed25519 signing fallback:', err);
    }
  }

  if (authHeader) {
    c.header('Authorization', authHeader);
    c.header('X-Gateway-Authorization', authHeader);
  }

  return c.json(responseBody, 200);
}

// ─── POST /onboard/beckn/bpp/search ───────────────────────────────────────────
becknRouter.post('/search', async (c) => {
  const body = await c.req.json();
  const context = body.context || {};
  const { catalog, credentials } = await getBppContext(context.bpp_id || 'outlet_default');

  const onSearchResponse = ondcAdapter.buildOnSearchResponse(context, catalog, credentials);
  return signAndRespond(c, onSearchResponse, credentials);
});

// ─── POST /onboard/beckn/bpp/select ───────────────────────────────────────────
becknRouter.post('/select', async (c) => {
  const body = await c.req.json();
  const context = body.context || {};
  const message = body.message || {};
  const { catalog, credentials } = await getBppContext(context.bpp_id || 'outlet_default');

  const onSelectResponse = ondcAdapter.buildOnSelectResponse(context, message, catalog, credentials);
  return signAndRespond(c, onSelectResponse, credentials);
});

// ─── POST /onboard/beckn/bpp/init ─────────────────────────────────────────────
becknRouter.post('/init', async (c) => {
  const body = await c.req.json();
  const context = body.context || {};
  const message = body.message || {};
  const { credentials } = await getBppContext(context.bpp_id || 'outlet_default');

  const onInitResponse = ondcAdapter.buildOnInitResponse(context, message, credentials);
  return signAndRespond(c, onInitResponse, credentials);
});

// ─── POST /onboard/beckn/bpp/confirm ──────────────────────────────────────────
becknRouter.post('/confirm', async (c) => {
  const body = await c.req.json();
  const context = body.context || {};
  const message = body.message || {};
  const { credentials } = await getBppContext(context.bpp_id || 'outlet_default');

  // Parse into Canonical Universal Order
  const canonicalOrder = await ondcAdapter.parseOrder(body);
  await relayStore.saveOrder(canonicalOrder);

  // Broadcast to Desktop POS (trigger silent print + audio chime)
  desktopPosBridge.broadcastIncomingDeliveryOrder(canonicalOrder);

  // Sync to Logix Dine Postgres tables (saleOrder and deliveryOrder)
  await syncCanonicalOrderToLogixDine(canonicalOrder, c.env);

  const onConfirmResponse = ondcAdapter.buildOnConfirmResponse(context, message, credentials);
  return signAndRespond(c, onConfirmResponse, credentials);
});

// ─── POST /onboard/beckn/bpp/status ───────────────────────────────────────────
becknRouter.post('/status', async (c) => {
  const body = await c.req.json();
  const context = body.context || {};
  const message = body.message || {};
  const orderId = message.order_id || message.order?.id;
  const { credentials } = await getBppContext(context.bpp_id || 'outlet_default');

  const order = (orderId ? await relayStore.getOrderByChannelOrderId('ONDC', orderId) : null) || {
    id: 'ord_mock',
    channelOrderId: orderId || 'ONDC_TEST_001',
    status: 'ORDER_ACCEPTED',
    channelCode: 'ONDC',
  };

  const onStatusResponse = ondcAdapter.buildOnStatusResponse(context, order as any, credentials);
  return signAndRespond(c, onStatusResponse, credentials);
});

// ─── POST /onboard/beckn/bpp/track ────────────────────────────────────────────
becknRouter.post('/track', async (c) => {
  const body = await c.req.json();
  const context = body.context || {};
  const message = body.message || {};
  const orderId = message.order_id || message.order?.id;
  const { credentials } = await getBppContext(context.bpp_id || 'outlet_default');

  const order = (orderId ? await relayStore.getOrderByChannelOrderId('ONDC', orderId) : null) || {
    id: 'ord_mock',
    channelOrderId: orderId || 'ONDC_TEST_001',
    status: 'DISPATCHED',
    channelCode: 'ONDC',
    rider: {
      trackingUrl: `https://track.logixsoft.in/ondc/${orderId}`,
      latitude: 12.9716,
      longitude: 77.5946,
    },
  };

  const onTrackResponse = ondcAdapter.buildOnTrackResponse(context, order as any, credentials);
  return signAndRespond(c, onTrackResponse, credentials);
});

// ─── POST /onboard/beckn/bpp/cancel ───────────────────────────────────────────
becknRouter.post('/cancel', async (c) => {
  const body = await c.req.json();
  const context = body.context || {};
  const message = body.message || {};
  const orderId = message.order_id || message.order?.id;
  const reasonCode = message.cancellation_reason_id || '001';
  const { credentials } = await getBppContext(context.bpp_id || 'outlet_default');

  if (orderId) {
    const existing = await relayStore.getOrderByChannelOrderId('ONDC', orderId);
    if (existing) {
      await relayStore.updateOrderStatus(existing.id, 'CANCELLED', 'BECKN_CANCEL', { reasonCode });
    }
  }

  const onCancelResponse = ondcAdapter.buildOnCancelResponse(context, orderId, reasonCode, credentials);
  return signAndRespond(c, onCancelResponse, credentials);
});

// Wildcard fallback router based on context.action
becknRouter.post('/*', async (c) => {
  const path = c.req.path;
  const action = path.split('/').pop();
  if (['search', 'select', 'init', 'confirm', 'status', 'track', 'cancel'].includes(action || '')) {
    // Already covered
  }
  return c.json({
    message: { ack: { status: 'ACK' } },
  });
});
