import { Hono } from 'hono';
import { logisticsBroker } from '../logistics/broker';
import { sendCustomerRiderTrackingWhatsApp } from '../logistics/whatsapp';
import { relayStore } from '../db';
import type { LogisticsQuoteRequest, LogisticsProviderCode } from '@logixsoft/relay-schema';

export const logisticsRouter = new Hono();

// ─── POST /logistics/quote ────────────────────────────────────────────────────
logisticsRouter.post('/quote', async (c) => {
  const body = await c.req.json();
  const quoteReq: LogisticsQuoteRequest = {
    pickupCoords: body.pickupCoords || { latitude: 12.9352, longitude: 77.6245, address: 'Koramangala 5th Block' },
    dropCoords: body.dropCoords || { latitude: 12.9716, longitude: 77.5946, address: 'MG Road' },
    orderValue: Number(body.orderValue || 450),
    packageWeight: Number(body.packageWeight || 1.2),
    orderId: body.orderId,
  };

  const quotes = await logisticsBroker.getQuotes(quoteReq);
  return c.json(quotes);
});

// ─── POST /logistics/dispatch ─────────────────────────────────────────────────
logisticsRouter.post('/dispatch', async (c) => {
  const body = await c.req.json();
  const orderId = body.orderId;
  const preferredProvider = body.preferredProvider as LogisticsProviderCode | undefined;

  if (!orderId) {
    return c.json({ error: 'Bad Request', message: 'orderId is required' }, 400);
  }

  const result = await logisticsBroker.dispatch({
    orderId,
    preferredProvider,
    pickupContact: body.pickupContact,
    dropContact: body.dropContact,
  });

  // Trigger initial WhatsApp tracking update
  await sendCustomerRiderTrackingWhatsApp({
    orderId,
    waybillNumber: result.waybillNumber,
    providerCode: result.providerCode,
    status: 'RIDER_ASSIGNED',
    riderName: result.riderName,
    riderPhone: result.riderPhone,
    trackingUrl: result.trackingUrl,
  });

  return c.json(result);
});

// ─── GET /logistics/track/:id ─────────────────────────────────────────────────
logisticsRouter.get('/track/:id', async (c) => {
  const id = c.req.param('id');
  const trackingInfo = await logisticsBroker.track(id);
  return c.json(trackingInfo);
});

// ─── POST /logistics/webhook/:provider ────────────────────────────────────────
logisticsRouter.post('/webhook/:provider', async (c) => {
  const provider = c.req.param('provider').toUpperCase() as LogisticsProviderCode;
  const body = await c.req.json();

  const waybillNumber = body.waybill_number || body.waybill || body.awb || body.order_id;
  const status = body.status || 'RIDER_ASSIGNED';

  // Update dispatch status in database
  if (waybillNumber) {
    await relayStore.updateLogisticsStatus(waybillNumber, status, {
      riderName: body.rider_name,
      riderPhone: body.rider_phone,
      trackingUrl: body.tracking_url,
    });
  }

  // Dispatch real-time WhatsApp live tracking link to customer
  const waResult = await sendCustomerRiderTrackingWhatsApp({
    orderId: body.order_id,
    waybillNumber: waybillNumber || 'WB-DEFAULT',
    providerCode: provider,
    status,
    riderName: body.rider_name,
    riderPhone: body.rider_phone,
    latitude: body.latitude ? Number(body.latitude) : undefined,
    longitude: body.longitude ? Number(body.longitude) : undefined,
    etaMinutes: body.eta_minutes ? Number(body.eta_minutes) : undefined,
    trackingUrl: body.tracking_url,
    customerPhone: body.customer_phone,
    customerName: body.customer_name,
  });

  return c.json({
    success: true,
    provider,
    waybillNumber,
    status,
    whatsAppNotification: waResult,
  });
});
