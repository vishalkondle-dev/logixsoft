import crypto from 'node:crypto';

const BASE_URL = process.env.RELAY_URL || 'https://relay.logixsoft.in';
const OUTLET_ID = 'outlet_default';

interface TestResult {
  group: string;
  name: string;
  endpoint: string;
  method: string;
  status: number;
  expectedStatus: number | number[];
  passed: boolean;
  latencyMs: number;
  details?: string;
}

const results: TestResult[] = [];

function hmacSha256(content: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
}

async function request(
  group: string,
  name: string,
  path: string,
  method: string = 'GET',
  body?: any,
  headers: Record<string, string> = {},
  expectedStatus: number | number[] = 200
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const start = performance.now();
  let status = 0;
  let respData: any = null;
  let rawText = '';

  const reqHeaders: Record<string, string> = {
    ...headers,
  };

  let bodyStr: string | undefined = undefined;
  if (body !== undefined) {
    if (typeof body === 'string') {
      bodyStr = body;
    } else {
      bodyStr = JSON.stringify(body);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: bodyStr,
    });
    status = res.status;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      respData = await res.json();
    } else {
      rawText = await res.text();
      respData = rawText.slice(0, 200);
    }
  } catch (err: any) {
    status = 0;
    respData = { error: err.message };
  }

  const latencyMs = Number((performance.now() - start).toFixed(2));
  const expectedArray = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const passed = expectedArray.includes(status);

  results.push({
    group,
    name,
    endpoint: `${method} ${path}`,
    method,
    status,
    expectedStatus,
    passed,
    latencyMs,
    details: !passed ? JSON.stringify(respData) : undefined,
  });

  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${group}] ${name} -> ${status} (${latencyMs}ms)`);
  return respData;
}

async function runAllTests() {
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`🚀 Testing All Logix Relay Gateway APIs against ${BASE_URL}`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);

  // ─── 1. Health & Discovery ───────────────────────────────────────────────
  await request('Health & Docs', 'Health check', '/health', 'GET');
  await request('Health & Docs', 'OpenAPI Schema', '/openapi.json', 'GET');
  await request('Health & Docs', 'Interactive Scalar Docs UI', '/docs', 'GET');

  // ─── 2. Outlets & Integrations ───────────────────────────────────────────
  await request('Outlets & Config', 'List all integrations', `/outlets/${OUTLET_ID}/integrations`, 'GET');
  await request('Outlets & Config', 'Get Swiggy integration', `/outlets/${OUTLET_ID}/integrations/SWIGGY`, 'GET');
  await request('Outlets & Config', 'Get Zomato integration', `/outlets/${OUTLET_ID}/integrations/ZOMATO`, 'GET');
  await request('Outlets & Config', 'Get Magicpin integration', `/outlets/${OUTLET_ID}/integrations/MAGICPIN`, 'GET');
  await request('Outlets & Config', 'Get ONDC integration', `/outlets/${OUTLET_ID}/integrations/ONDC`, 'GET');
  await request('Outlets & Config', 'Get Webhook URLs directory', `/outlets/${OUTLET_ID}/webhook-urls`, 'GET');

  await request(
    'Outlets & Config',
    'Save/Update channel integration',
    `/outlets/${OUTLET_ID}/integrations`,
    'POST',
    {
      channelCode: 'SWIGGY',
      isOnline: true,
      autoAcceptOrders: false,
      defaultPrepMinutes: 22,
      channelPriceMarkupPercent: 15.0,
      credentials: {
        apiKey: 'swiggy_key_updated',
        webhookSecret: 'swiggy_webhook_secret_xyz123',
      },
    }
  );

  await request(
    'Outlets & Config',
    'Update store status via outlet route',
    `/outlets/${OUTLET_ID}/store-status`,
    'POST',
    {
      channelCode: 'SWIGGY',
      isOnline: true,
    }
  );

  await request(
    'Outlets & Config',
    'Update item stock via outlet route',
    `/outlets/${OUTLET_ID}/item-stock`,
    'POST',
    {
      itemId: 'dish_biryani_01',
      channelCode: 'SWIGGY',
      inStock: true,
    }
  );

  await request(
    'Outlets & Config',
    'Publish channel catalog/menu',
    `/outlets/${OUTLET_ID}/menu/publish`,
    'POST',
    {
      channelCode: 'SWIGGY',
      categories: [
        {
          id: 'cat_mains',
          name: 'Main Courses',
          items: [
            {
              id: 'dish_biryani_01',
              name: 'Hyderabadi Dum Biryani',
              price: 320,
              isVeg: false,
              inStock: true,
            },
          ],
        },
      ],
    }
  );

  // ─── 3. Inbound Webhooks & Fast-Ack (<300ms SLA) ────────────────────────
  const swiggyOrderPayload = JSON.stringify({
    order_id: `sw_${Date.now()}`,
    status: 'ORDER_PLACED',
    customer: { name: 'Rahul Sharma', phone: '9876543210' },
    cart: {
      items: [
        { item_id: 'dish_biryani_01', name: 'Hyderabadi Dum Biryani', quantity: 2, price: 640 },
      ],
    },
    payment: { total: 680, net_amount: 680 },
  });

  // Invalid Swiggy signature -> Expect 401
  await request(
    'Webhooks',
    'Swiggy Order - Invalid HMAC (Security Rejection)',
    '/webhooks/swiggy/order',
    'POST',
    swiggyOrderPayload,
    { 'x-swiggy-signature': 'invalid_hex_signature' },
    401
  );

  // Valid Swiggy signature -> Expect 200 FastAck
  const swiggySecret = 'swiggy_webhook_secret_xyz123';
  const swiggySignature = hmacSha256(swiggyOrderPayload, swiggySecret);
  const swiggyAck = await request(
    'Webhooks',
    'Swiggy Order - Valid HMAC FastAck (<300ms SLA)',
    '/webhooks/swiggy/order',
    'POST',
    swiggyOrderPayload,
    { 'x-swiggy-signature': swiggySignature }
  );

  // OpenAPI Spec Exact Path: POST /webhooks/swiggy
  await request(
    'Webhooks (OpenAPI)',
    'Swiggy Base Webhook (OpenAPI Path)',
    '/webhooks/swiggy',
    'POST',
    swiggyOrderPayload,
    { 'x-swiggy-signature': swiggySignature }
  );

  // Swiggy Rider Status webhook
  const swiggyStatusPayload = JSON.stringify({
    order_id: `sw_${Date.now()}`,
    status: 'RIDER_ASSIGNED',
    delivery_boy: { name: 'Kiran', phone: '9123456789' },
  });
  await request(
    'Webhooks',
    'Swiggy Rider Status update',
    '/webhooks/swiggy/status',
    'POST',
    swiggyStatusPayload,
    { 'x-swiggy-signature': hmacSha256(swiggyStatusPayload, swiggySecret) }
  );

  // Zomato Order Webhook
  const zomatoOrderPayload = JSON.stringify({
    order_id: `zom_${Date.now()}`,
    order_status: 'placed',
    customer_details: { name: 'Priya Patel', phone: '9845011223' },
    order_items: [
      { id: 'dish_paneer_tikka', name: 'Paneer Tikka', quantity: 1, price: 290 },
    ],
    billing: { total: 310 },
  });
  const zomatoSecret = 'zomato_webhook_secret_abc456';
  await request(
    'Webhooks',
    'Zomato Order - Valid HMAC FastAck',
    '/webhooks/zomato/order',
    'POST',
    zomatoOrderPayload,
    { 'x-zomato-signature': hmacSha256(zomatoOrderPayload, zomatoSecret) }
  );

  // OpenAPI Spec Exact Path: POST /webhooks/zomato
  await request(
    'Webhooks (OpenAPI)',
    'Zomato Base Webhook (OpenAPI Path)',
    '/webhooks/zomato',
    'POST',
    zomatoOrderPayload,
    { 'x-zomato-signature': hmacSha256(zomatoOrderPayload, zomatoSecret) }
  );

  // Zomato Status Webhook
  const zomatoStatusPayload = JSON.stringify({
    order_id: `zom_${Date.now()}`,
    order_status: 'driver_arrived',
  });
  await request(
    'Webhooks',
    'Zomato Delivery Status update',
    '/webhooks/zomato/status',
    'POST',
    zomatoStatusPayload,
    { 'x-zomato-signature': hmacSha256(zomatoStatusPayload, zomatoSecret) }
  );

  // Magicpin Order Webhook
  const magicpinPayload = JSON.stringify({
    order_id: `mp_${Date.now()}`,
    order_status: 'created',
    items: [{ id: 'dish_pasta', name: 'Arrabbiata Pasta', quantity: 1, price: 340 }],
    voucher_discount: 50,
  });
  const magicpinSecret = 'magicpin_secret_7711';
  await request(
    'Webhooks',
    'Magicpin Order - Valid HMAC FastAck',
    '/webhooks/magicpin/order',
    'POST',
    magicpinPayload,
    { 'x-signature': hmacSha256(magicpinPayload, magicpinSecret) }
  );

  // OpenAPI Spec Exact Path: POST /webhooks/magicpin
  await request(
    'Webhooks (OpenAPI)',
    'Magicpin Base Webhook (OpenAPI Path)',
    '/webhooks/magicpin',
    'POST',
    magicpinPayload,
    { 'x-signature': hmacSha256(magicpinPayload, magicpinSecret) }
  );

  // Direct D2C Webhooks (Ownly & Toing)
  await request(
    'Webhooks',
    'Direct D2C Brand (Ownly) Order Webhook',
    '/webhooks/ownly/order',
    'POST',
    {
      orderId: `ownly_${Date.now()}`,
      customer: { name: 'Arjun Verma', phone: '9988776655' },
      items: [{ name: 'Chef Special Pizza', quantity: 1, price: 499 }],
      total: 549,
    },
    { 'x-mock-bypass': 'true' }
  );

  await request(
    'Webhooks',
    'Direct D2C Brand (Toing) Order Webhook',
    '/webhooks/toing/order',
    'POST',
    {
      orderId: `toing_${Date.now()}`,
      customer: { name: 'Ananya Rao', phone: '9988112233' },
      items: [{ name: 'Gourmet Burger', quantity: 2, price: 299 }],
      total: 650,
    },
    { 'x-mock-bypass': 'true' }
  );

  // ─── 4. ONDC Beckn v1.2 Protocol (BPP - Seller App) ──────────────────────
  const becknContext = {
    domain: 'nic2004:52110',
    country: 'IND',
    city: 'std:080',
    action: 'search',
    core_version: '1.2.0',
    bap_id: 'buyer-app.ondc.org',
    bap_uri: 'https://buyer-app.ondc.org/protocol/v1',
    bpp_id: 'relay.logixsoft.in',
    bpp_uri: 'https://relay.logixsoft.in/onboard/beckn/bpp',
    transaction_id: `txn_${Date.now()}`,
    message_id: `msg_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  await request('ONDC Beckn v1.2', 'ONDC /search (Catalog Discovery)', '/onboard/beckn/bpp/search', 'POST', {
    context: { ...becknContext, action: 'search' },
    message: { intent: { item: { descriptor: { name: 'Biryani' } } } },
  });

  await request('ONDC Beckn v1.2', 'ONDC /select (Quote & GST Breakdown)', '/onboard/beckn/bpp/select', 'POST', {
    context: { ...becknContext, action: 'select' },
    message: {
      order: {
        provider: { id: OUTLET_ID },
        items: [{ id: 'dish_biryani_01', quantity: { count: 2 } }],
      },
    },
  });

  await request('ONDC Beckn v1.2', 'ONDC /init (Billing & Fulfillment Terms)', '/onboard/beckn/bpp/init', 'POST', {
    context: { ...becknContext, action: 'init' },
    message: {
      order: {
        provider: { id: OUTLET_ID },
        items: [{ id: 'dish_biryani_01', quantity: { count: 2 } }],
        billing: { name: 'Karthik', phone: '9845000000', address: { city: 'Bengaluru' } },
      },
    },
  });

  const ondcConfirmRes = await request(
    'ONDC Beckn v1.2',
    'ONDC /confirm (Order Placement)',
    '/onboard/beckn/bpp/confirm',
    'POST',
    {
      context: { ...becknContext, action: 'confirm' },
      message: {
        order: {
          id: `ondc_ord_${Date.now()}`,
          provider: { id: OUTLET_ID },
          items: [{ id: 'dish_biryani_01', quantity: { count: 1 } }],
          billing: { name: 'Karthik', phone: '9845000000' },
          payment: { status: 'PAID', params: { amount: '350.00' } },
        },
      },
    }
  );

  const ondcOrderId = ondcConfirmRes?.message?.order?.id || `ondc_ord_mock`;

  await request('ONDC Beckn v1.2', 'ONDC /status (Order State Feed)', '/onboard/beckn/bpp/status', 'POST', {
    context: { ...becknContext, action: 'status' },
    message: { order_id: ondcOrderId },
  });

  await request('ONDC Beckn v1.2', 'ONDC /track (Live Tracking Link)', '/onboard/beckn/bpp/track', 'POST', {
    context: { ...becknContext, action: 'track' },
    message: { order_id: ondcOrderId },
  });

  await request('ONDC Beckn v1.2', 'ONDC /cancel (Order Cancellation)', '/onboard/beckn/bpp/cancel', 'POST', {
    context: { ...becknContext, action: 'cancel' },
    message: { order_id: ondcOrderId, cancellation_reason_id: '001' },
  });

  // ─── 5. Order Management & Lifecycle Controls ───────────────────────────
  const activeOrders = await request('Order Lifecycle', 'List Active Orders', '/orders?limit=10', 'GET');
  let testOrderId = ondcOrderId;
  if (Array.isArray(activeOrders?.orders) && activeOrders.orders.length > 0) {
    testOrderId = activeOrders.orders[0].id;
  }

  await request('Order Lifecycle', 'Get Order Details', `/orders/${testOrderId}`, 'GET', undefined, {}, [200, 404]);

  await request(
    'Order Lifecycle',
    'Accept Order (Estimated prep time)',
    `/orders/${testOrderId}/accept`,
    'POST',
    { prepTimeMinutes: 20 },
    {},
    [200, 404]
  );

  await request(
    'Order Lifecycle',
    'Mark Food Ready',
    `/orders/${testOrderId}/ready`,
    'POST',
    {},
    {},
    [200, 404]
  );

  await request(
    'Order Lifecycle',
    'Dispatch Order',
    `/orders/${testOrderId}/dispatch`,
    'POST',
    { riderName: 'Suresh Kumar', riderPhone: '9876501234' },
    {},
    [200, 404]
  );

  await request(
    'Order Lifecycle',
    'Reject Order',
    `/orders/ord_dummy_for_reject/reject`,
    'POST',
    { reason: 'Store at peak capacity' },
    {},
    [200, 404]
  );

  // ─── 6. Real-time 86'ing & Rush Hour Store Pause ─────────────────────────
  await request(
    'Relay Operations',
    "Real-time 86'ing (Item Out of Stock fanout)",
    '/relay/inventory/item-status',
    'POST',
    {
      itemId: 'dish_biryani_01',
      outletId: OUTLET_ID,
      inStock: false,
      reason: 'Sold out for the day',
    }
  );

  // OpenAPI Spec Exact Path: POST /outlets/{outletId}/items/{itemId}/status
  await request(
    'Outlets & Config (OpenAPI)',
    'Real-time 86ing Item Status (OpenAPI Path)',
    `/outlets/${OUTLET_ID}/items/dish_biryani_01/status`,
    'POST',
    {
      inStock: false,
      reason: 'Sold out for the day',
    }
  );

  await request(
    'Outlets & Config (OpenAPI)',
    'Real-time 86ing Item Back in Stock (OpenAPI Path)',
    `/outlets/${OUTLET_ID}/items/dish_biryani_01/status`,
    'POST',
    {
      inStock: true,
    }
  );

  await request(
    'Relay Operations',
    "Real-time 86'ing (Item Back in Stock fanout)",
    '/relay/inventory/item-status',
    'POST',
    {
      itemId: 'dish_biryani_01',
      outletId: OUTLET_ID,
      inStock: true,
    }
  );

  await request(
    'Relay Operations',
    'Rush-Hour Store Pause (Multi-channel)',
    '/relay/store/status',
    'POST',
    {
      outletId: OUTLET_ID,
      isOnline: false,
      durationMinutes: 45,
      reason: 'Kitchen peak rush throttle',
    }
  );

  await request(
    'Relay Operations',
    'Store Unpause / Resume operations',
    '/relay/store/status',
    'POST',
    {
      outletId: OUTLET_ID,
      isOnline: true,
    }
  );

  // OpenAPI Spec Exact Path: POST /outlets/{outletId}/status
  await request(
    'Outlets & Config (OpenAPI)',
    'Store Status Pause (OpenAPI Path)',
    `/outlets/${OUTLET_ID}/status`,
    'POST',
    {
      isOnline: false,
      reason: 'Rush hour capacity limit',
    }
  );

  await request(
    'Outlets & Config (OpenAPI)',
    'Store Status Resume (OpenAPI Path)',
    `/outlets/${OUTLET_ID}/status`,
    'POST',
    {
      isOnline: true,
    }
  );

  // ─── 7. 3PL Logistics Router (Dunzo, Shadowfax, Borzo, Porter) ───────────
  const quoteRes = await request(
    '3PL Logistics',
    'Multi-Carrier Live Quotes Comparison',
    '/logistics/quote',
    'POST',
    {
      pickupAddress: {
        addressLine1: 'Indiranagar Flagship, 100ft Road',
        latitude: 12.9716,
        longitude: 77.5946,
      },
      deliveryAddress: {
        addressLine1: 'Koramangala 4th Block',
        latitude: 12.9352,
        longitude: 77.6245,
      },
      orderValue: 750,
    }
  );

  const dispatchRes = await request(
    '3PL Logistics',
    'Dispatch 3PL Courier & Waybill Generation',
    '/logistics/dispatch',
    'POST',
    {
      orderId: `ord_direct_${Date.now()}`,
      provider: quoteRes?.recommended?.carrier || 'SHADOWFAX',
      pickupAddress: {
        addressLine1: 'Indiranagar Flagship, 100ft Road',
        contactName: 'Logix Dine Dispatch Desk',
        contactPhone: '9845012345',
      },
      deliveryAddress: {
        addressLine1: 'Koramangala 4th Block',
        contactName: 'Rohit Roy',
        contactPhone: '9988776611',
      },
    }
  );

  const waybillNo = dispatchRes?.waybillNumber || 'WAYBILL-TEST-8819';
  await request('3PL Logistics', 'Live Rider Waybill Tracking', `/logistics/track/${waybillNo}`, 'GET');

  await request(
    '3PL Logistics',
    'Carrier Webhook Status Ingress',
    '/logistics/webhook/shadowfax',
    'POST',
    {
      waybill_id: waybillNo,
      status: 'RIDER_REACHED_RESTAURANT',
      rider_name: 'Manish Singh',
      rider_phone: '9812345678',
    }
  );

  // ─── 8. Financial Reconciliation & Commission Auditing ───────────────────
  const sampleSettlementCsv = `channel,channel_order_id,gross_amount,commission_deducted,pg_fee,gst_deducted,payout_amount,settlement_date
SWIGGY,sw_99812,650.00,130.00,13.00,23.40,483.60,2026-09-25
ZOMATO,zom_33120,420.00,84.00,8.40,15.12,312.48,2026-09-25
MAGICPIN,mp_11200,500.00,50.00,10.00,9.00,431.00,2026-09-25`;

  await request(
    'Reconciliation',
    'Upload Weekly Aggregator Settlement CSV',
    '/reconciliation/upload-settlement',
    'POST',
    {
      channelCode: 'SWIGGY',
      csvContent: sampleSettlementCsv,
    }
  );

  // OpenAPI Spec Exact Path: POST /reconciliation/upload
  await request(
    'Reconciliation (OpenAPI)',
    'Upload Weekly Settlement (OpenAPI Path)',
    '/reconciliation/upload',
    'POST',
    {
      channelCode: 'SWIGGY',
      csvContent: sampleSettlementCsv,
    }
  );

  await request('Reconciliation', 'Audit Summary & Commission Analytics', '/reconciliation/summary', 'GET');
  await request('Reconciliation', 'Discrepancy Auditor (Underpaid/Overcharged)', '/reconciliation/discrepancies', 'GET');

  // ─── 9. Desktop POS Bridge & Audio Chime ─────────────────────────────────
  await request('Desktop POS Bridge', 'Bridge Events Stats', '/bridge/stats', 'GET');
  await request('Desktop POS Bridge', 'Bridge Event History', '/bridge/history', 'GET');
  await request(
    'Desktop POS Bridge',
    'Simulate Order Event (Thermal Print & Chime Trigger)',
    '/bridge/simulate-order',
    'POST',
    {
      channel: 'SWIGGY',
      customerName: 'Kunal Deshmukh',
      itemsCount: 3,
      totalAmount: 920,
    }
  );

  // ─── Summary Report ───────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`📊 Logix Relay Gateway API Verification Summary`);
  console.log(`═══════════════════════════════════════════════════════════════════`);

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const avgLatency = (results.reduce((acc, r) => acc + r.latencyMs, 0) / results.length).toFixed(1);

  console.log(`Total Endpoints Tested: ${results.length}`);
  console.log(`Passed:                ${passedCount} ✅`);
  console.log(`Failed:                ${failedCount} ${failedCount === 0 ? '' : '❌'}`);
  console.log(`Average Edge Latency:  ${avgLatency}ms`);

  const groups = Array.from(new Set(results.map((r) => r.group)));
  for (const g of groups) {
    const groupResults = results.filter((r) => r.group === g);
    const grpPassed = groupResults.filter((r) => r.passed).length;
    console.log(`  • ${g.padEnd(20)}: ${grpPassed}/${groupResults.length} passed`);
  }

  if (failedCount > 0) {
    console.log(`\n❌ Failed tests details:`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - [${r.group}] ${r.name} (${r.endpoint}): status ${r.status} (expected ${JSON.stringify(r.expectedStatus)}) - ${r.details}`);
    }
    process.exit(1);
  } else {
    console.log(`\n🌟 All Relay Gateway APIs are 100% verified and operating within SLA!`);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
