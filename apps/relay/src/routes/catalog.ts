import { Hono } from 'hono';
import { relayStore } from '../db';
import { adapterRegistry } from '../adapters';
import { updateItemStockFanOut } from '../inventory/fanout';
import { updateStoreStatusFanOut } from '../inventory/store-pause';
import type { ChannelCode, SyncResult } from '@logixsoft/relay-schema';

export const catalogRouter = new Hono();

// ─── POST /outlets/:id/menu/publish ───────────────────────────────────────────
catalogRouter.post('/:id/menu/publish', async (c) => {
  const outletId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const targetChannels: ChannelCode[] = body.channels || ['SWIGGY', 'ZOMATO', 'MAGICPIN', 'ONDC', 'OWNLY', 'TOING'];

  let menu = await relayStore.getOutletMenu(outletId);
  if (!menu) {
    if (body.catalog || body.menu || body.categories) {
      const rawCatalog = body.catalog || body.menu || { outletId, name: 'Main Menu', categories: body.categories || [] };
      await relayStore.saveOutletMenu(outletId, 'Main Menu', rawCatalog);
      menu = rawCatalog;
    } else {
      return c.json({ error: 'Not Found', message: `No catalog found for outlet ${outletId}` }, 404);
    }
  }

  const results: SyncResult[] = [];

  for (const code of targetChannels) {
    if (!adapterRegistry.has(code)) continue;
    const adapter = adapterRegistry.get(code);
    const intg = await relayStore.getOutletIntegration(outletId, code);

    try {
      const syncRes = await adapter.publishMenu(outletId, menu, intg?.credentials || {});
      results.push(syncRes);
    } catch (err: any) {
      results.push({
        success: false,
        channelCode: code,
        outletId,
        itemsSynced: 0,
        categoriesSynced: 0,
        errors: [err.message],
        timestamp: new Date().toISOString(),
      });
    }
  }

  const allSuccess = results.every((r) => r.success);
  return c.json({
    success: allSuccess,
    outletId,
    totalChannelsPublished: results.length,
    results,
  });
});

// ─── POST /outlets/:id/item-stock ─────────────────────────────────────────────
catalogRouter.post('/:id/item-stock', async (c) => {
  const outletId = c.req.param('id');
  const body = await c.req.json();
  const itemId = body.itemId;
  const inStock = Boolean(body.inStock);

  if (!itemId) {
    return c.json({ error: 'Bad Request', message: 'itemId is required' }, 400);
  }

  const result = await updateItemStockFanOut({ outletId, itemId, inStock });
  return c.json(result);
});

// OpenAPI Spec Alias: POST /outlets/{outletId}/items/{itemId}/status
catalogRouter.post('/:id/items/:itemId/status', async (c) => {
  const outletId = c.req.param('id');
  const itemId = c.req.param('itemId');
  const body = await c.req.json().catch(() => ({}));
  const inStock = body.inStock !== undefined ? Boolean(body.inStock) : body.status !== 'OUT_OF_STOCK';
  const reason = body.reason;

  const result = await updateItemStockFanOut({ outletId, itemId, inStock, reason });
  return c.json(result);
});

// ─── POST /outlets/:id/store-status ───────────────────────────────────────────
catalogRouter.post('/:id/store-status', async (c) => {
  const outletId = c.req.param('id');
  const body = await c.req.json();
  const isOnline = Boolean(body.isOnline);
  const reason = body.reason;
  const durationMinutes = body.durationMinutes;

  const result = await updateStoreStatusFanOut({
    outletId,
    isOnline,
    reason,
    durationMinutes,
  });

  return c.json(result);
});

// OpenAPI Spec Alias: POST /outlets/{outletId}/status
catalogRouter.post('/:id/status', async (c) => {
  const outletId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const isOnline = body.isOnline !== undefined ? Boolean(body.isOnline) : (body.status === 'ONLINE' || body.status === 'OPEN');
  const reason = body.reason;
  const durationMinutes = body.durationMinutes;

  const result = await updateStoreStatusFanOut({
    outletId,
    isOnline,
    reason,
    durationMinutes,
  });

  return c.json(result);
});

// ─── Helper: Mask sensitive credentials for UI display ────────────────────────
function maskCredentials(creds: any) {
  if (!creds) return {};
  const masked: any = { ...creds };
  if (masked.apiKey && typeof masked.apiKey === 'string') {
    masked.apiKey = masked.apiKey.length > 8 ? `${masked.apiKey.slice(0, 4)}****${masked.apiKey.slice(-4)}` : '****';
  }
  if (masked.apiSecret) masked.apiSecret = '****************';
  if (masked.webhookSecret) masked.webhookSecret = '****************';
  return masked;
}

// ─── GET /outlets/:id/integrations (List all channel integrations) ─────────────
catalogRouter.get('/:id/integrations', async (c) => {
  const outletId = c.req.param('id');
  const integrations = await relayStore.listOutletIntegrations(outletId);
  const channels = await relayStore.listChannels();

  const formatted = channels.map((ch: any) => {
    const existing = integrations.find((i: any) => i.channelCode === ch.code);
    return {
      channelCode: ch.code,
      channelName: ch.name,
      isActiveChannel: ch.isActive,
      isConfigured: Boolean(existing),
      merchantStoreId: existing?.merchantStoreId || null,
      isOnline: existing?.isOnline ?? false,
      autoAcceptOrders: existing?.autoAcceptOrders ?? false,
      defaultPrepMinutes: existing?.defaultPrepMinutes ?? 20,
      channelPriceMarkupPercent: existing?.channelPriceMarkupPercent ?? 0.0,
      credentials: existing?.credentials ? maskCredentials(existing.credentials) : null,
      updatedAt: existing?.updatedAt || null,
    };
  });

  return c.json({
    outletId,
    integrations: formatted,
  });
});

// ─── GET /outlets/:id/integrations/:channelCode ───────────────────────────────
catalogRouter.get('/:id/integrations/:channelCode', async (c) => {
  const outletId = c.req.param('id');
  const channelCode = c.req.param('channelCode').toUpperCase() as ChannelCode;
  const integration = await relayStore.getOutletIntegration(outletId, channelCode);

  if (!integration) {
    return c.json({ error: 'Not Found', message: `No integration configured for ${channelCode}` }, 404);
  }

  return c.json({
    ...integration,
    credentials: maskCredentials(integration.credentials),
  });
});

// ─── POST /outlets/:id/integrations (Save/Configure Channel Keys) ──────────────
catalogRouter.post('/:id/integrations', async (c) => {
  const outletId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const channelCode = body.channelCode?.toUpperCase() as ChannelCode;

  if (!channelCode) {
    return c.json({ error: 'Bad Request', message: 'channelCode is required (SWIGGY, ZOMATO, MAGICPIN, ONDC)' }, 400);
  }

  // Preserve existing secret values if user didn't re-enter masked placeholder
  const existing = await relayStore.getOutletIntegration(outletId, channelCode);
  const incomingCreds = body.credentials || {};
  const mergedCreds = { ...(existing?.credentials || {}), ...incomingCreds };

  if (incomingCreds.apiSecret && incomingCreds.apiSecret.includes('****')) {
    mergedCreds.apiSecret = existing?.credentials?.apiSecret;
  }
  if (incomingCreds.webhookSecret && incomingCreds.webhookSecret.includes('****')) {
    mergedCreds.webhookSecret = existing?.credentials?.webhookSecret;
  }

  const saved = await relayStore.saveOutletIntegration({
    outletId,
    channelCode,
    merchantStoreId: body.merchantStoreId || existing?.merchantStoreId || `store_${outletId}`,
    credentials: mergedCreds,
    isOnline: body.isOnline ?? existing?.isOnline ?? true,
    autoAcceptOrders: body.autoAcceptOrders ?? existing?.autoAcceptOrders ?? false,
    defaultPrepMinutes: body.defaultPrepMinutes ?? existing?.defaultPrepMinutes ?? 20,
    channelPriceMarkupPercent: body.channelPriceMarkupPercent ?? existing?.channelPriceMarkupPercent ?? 0.0,
  });

  return c.json({
    success: true,
    message: `Successfully configured credentials for ${channelCode}`,
    integration: {
      ...saved,
      credentials: maskCredentials(saved.credentials),
    },
  });
});

// ─── GET /outlets/:id/webhook-urls (Partner Webhook Instructions) ──────────────
catalogRouter.get('/:id/webhook-urls', (c) => {
  const baseUrl = (c.env as any)?.API_URL || 'https://relay.logixsoft.in';

  return c.json({
    instructions: 'Copy and paste these webhook URLs into your respective Partner Portals:',
    webhooks: {
      SWIGGY: {
        partnerPortal: 'Swiggy POS Partner Portal -> Webhook Configuration',
        orderWebhookUrl: `${baseUrl}/webhooks/swiggy/order`,
        riderStatusWebhookUrl: `${baseUrl}/webhooks/swiggy/status`,
        requiredHeaders: 'x-swiggy-signature',
      },
      ZOMATO: {
        partnerPortal: 'Zomato Food Partner Dashboard -> API & Webhooks',
        orderWebhookUrl: `${baseUrl}/webhooks/zomato/order`,
        riderStatusWebhookUrl: `${baseUrl}/webhooks/zomato/status`,
        requiredHeaders: 'x-zomato-signature',
      },
      MAGICPIN: {
        partnerPortal: 'Magicpin Merchant Console -> Integrations',
        orderWebhookUrl: `${baseUrl}/webhooks/magicpin/order`,
      },
      ONDC: {
        protocol: 'ONDC Beckn Protocol v1.2 Seller BPP',
        bppUri: `${baseUrl}/onboard/beckn/bpp`,
        supportedActions: ['/search', '/select', '/init', '/confirm', '/status', '/track', '/cancel'],
      },
      DIRECT_D2C: {
        ownlyWebhookUrl: `${baseUrl}/webhooks/ownly/order`,
        toingWebhookUrl: `${baseUrl}/webhooks/toing/order`,
      },
    },
  });
});

