import { test, expect } from '@playwright/test';
import app from '../apps/relay/src/index';
import { signHmacSha256 } from '../apps/relay/src/crypto/hmac';
import { relayStore } from '../apps/relay/src/db';
import { seedRelayDatabase } from '../apps/relay/src/db/seed';
import { generateEd25519KeyPair } from '../apps/relay/src/crypto/ed25519';

async function request(method: string, path: string, body?: any, headers?: Record<string, string>) {
  const reqInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    reqInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await app.request(`http://localhost${path}`, reqInit);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, json, text };
}

test.describe('Logix Relay Gateway Integration Tests', () => {
  const outletId = 'outlet_default';

  test.beforeAll(async () => {
    await seedRelayDatabase(outletId);
  });

  // 1. Inbound Webhooks Fast-Ack SLA (<300ms) & HMAC verification
  test('Inbound Webhook Fast-Ack SLA (<300ms) and HMAC signature check', async () => {
    const secret = 'swiggy_webhook_secret_xyz123';
    const orderId = `SW_PLAYWRIGHT_${Date.now()}`;
    const payload = {
      order_id: orderId,
      restaurant_id: outletId,
      order: {
        order_id: orderId,
        status: 'ORDER_PLACED',
        customer: { name: 'Kavita Krishnan', phone: '+919876500001' },
        cart: {
          items: [{ item_id: 'item_hyd_dum_biryani', name: 'Dum Biryani', quantity: 2, price: 320, sub_total: 640 }],
        },
        bill_details: { sub_total: 640, packaging_charge: 30, total_tax: 32, discount: 0 },
        total_amount: 702,
        created_at: new Date().toISOString(),
      },
    };

    const raw = JSON.stringify(payload);
    const signature = signHmacSha256(raw, secret);

    // Invalid signature check
    const badRes = await request('POST', '/webhooks/swiggy/order', raw, { 'x-swiggy-signature': 'bad_sig' });
    expect(badRes.status).toBe(401);

    // Valid signature check & SLA
    const start = performance.now();
    const res = await request('POST', '/webhooks/swiggy/order', raw, { 'x-swiggy-signature': signature });
    const latency = performance.now() - start;

    expect(res.status).toBe(200);
    expect(res.json.status).toBe('SUCCESS');
    expect(res.json.slaPassed).toBe(true);
    expect(res.json.ackLatencyMs).toBeLessThan(300);
    expect(latency).toBeLessThan(300);

    // Wait for worker normalizer to inject into POS stream
    await new Promise((r) => setTimeout(r, 60));
    const canonical = await relayStore.getOrderByChannelOrderId('SWIGGY', orderId);
    expect(canonical).not.toBeNull();
    expect(canonical?.pricing.totalAmount).toBe(702);
  });

  // 2. Real-time 86'ing Sub-Second Fan-Out (<1500ms SLA)
  test('Sub-second item 86ing fan-out to all channels (<1500ms SLA)', async () => {
    const res = await request('POST', '/relay/inventory/item-status', {
      outletId,
      itemId: 'item_paneer_biryani',
      isInStock: false,
    });

    expect(res.status).toBe(200);
    expect(res.json.completedWithinSla).toBe(true);
    expect(res.json.totalLatencyMs).toBeLessThan(1500);
    expect(res.json.successfulChannels).toBeGreaterThanOrEqual(4);
  });

  // 3. ONDC Beckn Protocol BPP flow (search -> select -> init -> confirm -> status)
  test('ONDC Beckn BPP End-to-End protocol suite', async () => {
    const context = {
      domain: 'nic2004:52110',
      country: 'IND',
      city: 'std:080',
      core_version: '1.2.0',
      bap_id: 'buyer.ondc.org',
      bap_uri: 'https://buyer.ondc.org',
      bpp_id: 'bpp.logixsoft.in',
      bpp_uri: 'https://relay.logixsoft.in/onboard/beckn/bpp',
      transaction_id: `txn_pw_${Date.now()}`,
      message_id: `msg_pw_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    // 1. Search
    const searchRes = await request('POST', '/onboard/beckn/bpp/search', {
      context: { ...context, action: 'search' },
      message: { intent: {} },
    });
    expect(searchRes.status).toBe(200);
    expect(searchRes.json.context.action).toBe('on_search');

    // 2. Select
    const selectRes = await request('POST', '/onboard/beckn/bpp/select', {
      context: { ...context, action: 'select' },
      message: { order: { items: [{ id: 'item_hyd_dum_biryani', quantity: { count: 1 } }] } },
    });
    expect(selectRes.status).toBe(200);
    expect(selectRes.json.message.order.quote.breakup.length).toBeGreaterThan(0);

    // 3. Init
    const initRes = await request('POST', '/onboard/beckn/bpp/init', {
      context: { ...context, action: 'init' },
      message: { order: { billing: { name: 'Siddharth Roy', phone: '+919112233445' } } },
    });
    expect(initRes.status).toBe(200);

    // 4. Confirm
    const ondcId = `ONDC_PW_${Date.now()}`;
    const confirmRes = await request('POST', '/onboard/beckn/bpp/confirm', {
      context: { ...context, action: 'confirm' },
      message: { order: { id: ondcId, billing: { name: 'Siddharth Roy', phone: '+919112233445' }, items: [{ id: 'item_hyd_dum_biryani', quantity: { count: 1 } }] } },
    });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.json.message.order.state).toBe('Accepted');

    // 5. Status
    const statusRes = await request('POST', '/onboard/beckn/bpp/status', {
      context: { ...context, action: 'status' },
      message: { order_id: ondcId },
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.json.message.order.state).toBeDefined();
  });

  // 4. 3PL Logistics Broker & WhatsApp Customer Live Tracking
  test('3PL Multi-Carrier Quote, Dispatch, and WhatsApp tracking link', async () => {
    // Quote
    const quoteRes = await request('POST', '/logistics/quote', {
      pickupCoords: { latitude: 12.9352, longitude: 77.6245 },
      dropCoords: { latitude: 12.9716, longitude: 77.5946 },
      orderValue: 500,
    });
    expect(quoteRes.status).toBe(200);
    expect(quoteRes.json.quotes.length).toBeGreaterThanOrEqual(4);
    expect(quoteRes.json.cheapest).toBeDefined();
    expect(quoteRes.json.fastest).toBeDefined();

    // Dispatch
    const dispRes = await request('POST', '/logistics/dispatch', {
      orderId: 'ord_pw_123',
      preferredProvider: 'SHADOWFAX',
    });
    expect(dispRes.status).toBe(200);
    expect(dispRes.json.waybillNumber).toContain('WB-SHA-');
    expect(dispRes.json.trackingUrl).toBeDefined();
  });

  // 5. Financial Reconciliation & Commission Deductions Audit
  test('Reconciliation CSV parsing, ledger audit, and penalty discrepancy detection', async () => {
    const csvContent = [
      'order_id,gross_amount,commission,taxes,other_deductions,net_payout,payout_reference',
      `UNKNOWN_ORD_001,500,90,16.20,100,293.80,UTR-DISP-001`,
    ].join('\n');

    const res = await request('POST', '/reconciliation/upload-settlement', {
      outletId,
      channelCode: 'SWIGGY',
      csvContent,
    });

    expect(res.status).toBe(200);
    expect(res.json.summary.auditStatus).toBe('DISCREPANCIES_DETECTED');
    expect(res.json.summary.flaggedOrders).toBe(1);
    expect(res.json.summary.discrepancies.length).toBeGreaterThanOrEqual(1);
  });

  // 6. Desktop POS Bridge: Audio chime & Silent Thermal KOT print
  test('Desktop POS Bridge triggers audio chime and logixDinePC.printReceipt({ silent: true })', async () => {
    const res = await request('POST', '/bridge/simulate-order', {
      outletId,
      channel: 'ZOMATO',
      customerName: 'Meera Nambiar',
      customerPhone: '+919988001122',
    });

    expect(res.status).toBe(200);
    expect(res.json.desktopVerification.audioChimeTriggered).toBe(true);
    expect(res.json.desktopVerification.silentThermalPrintTriggered).toBe(true);
    expect(res.json.desktopVerification.silentOptionPassed).toBe(true);
    expect(res.json.desktopVerification.ticketType).toBe('KOT');
  });
});
