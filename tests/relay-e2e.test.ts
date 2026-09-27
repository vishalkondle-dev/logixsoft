import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import app from '../apps/relay/src/index';
import { signHmacSha256 } from '../apps/relay/src/crypto/hmac';
import { relayStore } from '../apps/relay/src/db';
import { seedRelayDatabase } from '../apps/relay/src/db/seed';
import { desktopPosBridge } from '../apps/relay/src/bridge/desktop-bridge';
import { generateEd25519KeyPair, signBecknMessage } from '../apps/relay/src/crypto/ed25519';

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

describe('Logix Relay Gateway — Unified Verification Suite', () => {
  const outletId = 'outlet_default';

  before(async () => {
    await seedRelayDatabase(outletId);
  });

  // ─── Test 1: Inbound Webhooks & Fast-Ack SLA (<300ms) ───────────────────────
  describe('Module 2: Inbound Webhook Ingestion & Idempotency Buffer', () => {
    it('should reject Swiggy webhook when HMAC signature is invalid', async () => {
      const payload = {
        order_id: 'SW_TEST_991',
        restaurant_id: outletId,
        order: { order_id: 'SW_TEST_991', status: 'ORDER_PLACED', items: [] },
      };
      const res = await request('POST', '/webhooks/swiggy/order', payload, {
        'x-swiggy-signature': 'invalid_hex_signature',
      });
      assert.equal(res.status, 401);
      assert.match(res.json.message, /signature verification failed/i);
    });

    it('should verify Swiggy HMAC signature and acknowledge in <300ms SLA', async () => {
      const secret = 'swiggy_webhook_secret_xyz123';
      const orderId = `SW_ORD_${Date.now()}`;
      const payload = {
        order_id: orderId,
        restaurant_id: outletId,
        order: {
          order_id: orderId,
          status: 'ORDER_PLACED',
          customer: { name: 'Aarav Patel', phone: '+919988776655' },
          delivery_address: {
            line1: 'Flat 304, Palm Grove Apartments',
            landmark: 'Near Wipro Park',
            city: 'Bangalore',
            pincode: '560034',
          },
          cart: {
            items: [
              {
                item_id: 'item_hyd_dum_biryani',
                name: 'Hyderabadi Chicken Dum Biryani',
                quantity: 2,
                price: 320,
                sub_total: 640,
                is_veg: false,
                variants: [{ id: 'var_regular', name: 'Regular', price: 0 }],
                addons: [{ id: 'addon_extra_salan', name: 'Extra Mirchi Ka Salan', price: 40 }],
              },
            ],
          },
          bill_details: {
            sub_total: 680,
            packaging_charge: 30,
            delivery_charge: 0,
            total_tax: 34,
            discount: 50,
          },
          total_amount: 694,
          created_at: new Date().toISOString(),
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = signHmacSha256(rawBody, secret);

      const start = performance.now();
      const res = await request('POST', '/webhooks/swiggy/order', rawBody, {
        'x-swiggy-signature': signature,
      });
      const clientLatency = performance.now() - start;

      assert.equal(res.status, 200);
      assert.equal(res.json.status, 'SUCCESS');
      assert.equal(res.json.channelCode, 'SWIGGY');
      assert.equal(res.json.channelOrderId, orderId);
      assert.equal(res.json.slaPassed, true);
      assert.ok(res.json.ackLatencyMs < 300, `Expected ackLatencyMs < 300ms, got ${res.json.ackLatencyMs}`);
      assert.ok(clientLatency < 300, `Expected client latency < 300ms, got ${clientLatency}ms`);

      // De-duplication test: Re-send same webhook payload
      const dupRes = await request('POST', '/webhooks/swiggy/order', rawBody, {
        'x-swiggy-signature': signature,
      });
      assert.equal(dupRes.status, 200);
      assert.equal(dupRes.json.isDuplicate, true);
    });

    it('should verify Zomato webhook HMAC and inject normalized order into POS stream', async () => {
      const secret = 'zomato_webhook_secret_abc456';
      const orderId = `ZOM_ORD_${Date.now()}`;
      const payload = {
        res_id: outletId,
        order_data: {
          order_id: orderId,
          status: 'placed',
          prep_time: 25,
          customer: { name: 'Priya Sharma', phone: '+919876543210' },
          delivery_details: {
            address: {
              address_line1: 'House 12, 4th Main, HSR Layout',
              landmark: 'Near BDA Complex',
              city: 'Bangalore',
              zipcode: '560102',
            },
          },
          order_items: [
            {
              item_id: 'item_paneer_biryani',
              dish_name: 'Paneer Makhani Dum Biryani',
              quantity: 1,
              price: 280,
              food_type: 'veg',
            },
          ],
          bill_details: {
            subtotal: 280,
            packaging_charge: 20,
            tax: 14,
            discount: 0,
          },
          total_price: 314,
          created_time: new Date().toISOString(),
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = signHmacSha256(rawBody, secret);

      const res = await request('POST', '/webhooks/zomato/order', rawBody, {
        'x-zomato-signature': signature,
      });

      assert.equal(res.status, 200);
      assert.equal(res.json.channelCode, 'ZOMATO');
      assert.equal(res.json.channelOrderId, orderId);
      assert.ok(res.json.ackLatencyMs < 300);

      // Wait 50ms for worker normalizer to process queue
      await new Promise((r) => setTimeout(r, 60));

      const canonical = await relayStore.getOrderByChannelOrderId('ZOMATO', orderId);
      assert.ok(canonical, 'Expected order to be stored in canonical database');
      assert.equal(canonical.channelCode, 'ZOMATO');
      assert.equal(canonical.channelOrderId, orderId);
      assert.equal(canonical.customer.name, 'Priya Sharma');
      assert.equal(canonical.items.length, 1);
      assert.equal(canonical.items[0].name, 'Paneer Makhani Dum Biryani');
      assert.equal(canonical.pricing.totalAmount, 314);
    });

    it('should verify Magicpin webhook HMAC and ingest normalized order with voucher discounts', async () => {
      const secret = 'magicpin_secret_7711';
      const orderId = `MP_ORD_${Date.now()}`;
      const payload = {
        outlet_id: outletId,
        order_id: orderId,
        data: {
          order_id: orderId,
          status: 'ORDER_PLACED',
          prep_time_mins: 20,
          user: {
            name: 'Rohan Verma',
            phone: '+919845012345',
            email: 'rohan.v@example.com',
          },
          delivery_address: {
            line1: '#45, 2nd Cross, Koramangala 4th Block',
            landmark: 'Near Sony World Signal',
            city: 'Bangalore',
            pincode: '560034',
          },
          items: [
            {
              item_id: 'item_chicken_tikka',
              item_name: 'Classic Chicken Tikka (6 Pcs)',
              quantity: 1,
              price: 290,
              food_type: 'NON_VEG',
            },
            {
              item_id: 'item_dahi_ke_kebab',
              item_name: 'Dahi Ke Kebab (4 Pcs)',
              quantity: 1,
              price: 240,
              food_type: 'VEG',
            },
          ],
          packing_charges: 30,
          delivery_charges: 0,
          taxes: 26.5,
          voucher_discount: 100,
          merchant_discount: 0,
          amount_paid_by_customer: 486.5,
          created_at: new Date().toISOString(),
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = signHmacSha256(rawBody, secret);

      const res = await request('POST', '/webhooks/magicpin/order', rawBody, {
        'x-magicpin-signature': signature,
      });

      assert.equal(res.status, 200);
      assert.equal(res.json.channelCode, 'MAGICPIN');
      assert.equal(res.json.channelOrderId, orderId);
      assert.ok(res.json.ackLatencyMs < 300);

      // Wait 60ms for worker normalizer
      await new Promise((r) => setTimeout(r, 60));

      const canonical = await relayStore.getOrderByChannelOrderId('MAGICPIN', orderId);
      assert.ok(canonical, 'Expected Magicpin order to be stored in canonical database');
      assert.equal(canonical.channelCode, 'MAGICPIN');
      assert.equal(canonical.channelOrderId, orderId);
      assert.equal(canonical.customer.name, 'Rohan Verma');
      assert.equal(canonical.items.length, 2);
      assert.equal(canonical.pricing.totalAmount, 486.5);
      assert.equal(canonical.pricing.discount, 100);
      assert.equal(canonical.pricing.channelCommissionPercent, 10);
      assert.equal(canonical.pricing.channelCommission, 53.0);
    });
  });

  // ─── Test 2: Real-Time 86'ing & Store Pause Engine ───────────────────────────
  describe('Module 4: Real-time 86\'ing (Out-of-Stock) & Store Pause Engine', () => {
    it('should fan out item stock updates to all active channels in <1500ms SLA', async () => {
      const start = performance.now();
      const res = await request('POST', '/relay/inventory/item-status', {
        outletId,
        itemId: 'item_hyd_dum_biryani',
        isInStock: false, // 86'ed
      });
      const clientLatency = performance.now() - start;

      assert.equal(res.status, 200);
      assert.equal(res.json.completedWithinSla, true);
      assert.ok(
        res.json.totalLatencyMs < 1500,
        `Expected totalLatencyMs < 1500ms, got ${res.json.totalLatencyMs}ms`
      );
      assert.ok(clientLatency < 1500, `Client latency was ${clientLatency}ms`);
      assert.equal(res.json.inStock, false);
      assert.ok(res.json.channelResults.length >= 4);

      // Verify each channel response
      const swiggyResult = res.json.channelResults.find((c: any) => c.channelCode === 'SWIGGY');
      const zomatoResult = res.json.channelResults.find((c: any) => c.channelCode === 'ZOMATO');
      assert.ok(swiggyResult?.success);
      assert.ok(zomatoResult?.success);
    });

    it('should toggle store online/offline across all platforms during rush hour', async () => {
      const res = await request('POST', '/relay/store/status', {
        outletId,
        isOnline: false,
        reason: 'Kitchen surge / High order volume',
        durationMinutes: 30,
      });

      assert.equal(res.status, 200);
      assert.equal(res.json.isOnline, false);
      assert.equal(res.json.reason, 'Kitchen surge / High order volume');
      assert.ok(res.json.successfulChannels > 0);

      // Verify resume back online
      const resumeRes = await request('POST', '/relay/store/status', {
        outletId,
        isOnline: true,
      });
      assert.equal(resumeRes.status, 200);
      assert.equal(resumeRes.json.isOnline, true);
    });
  });

  // ─── Test 3: ONDC Beckn Protocol v1.2 BPP Flow ──────────────────────────────
  describe('Module 3: ONDC Beckn Protocol Adapter (v1.2 BPP - Seller App)', () => {
    const transactionId = `txn_${Date.now()}`;
    const messageId = `msg_${Date.now()}`;
    const ondcKeyPair = generateEd25519KeyPair();

    function getBecknContext(action: string) {
      return {
        domain: 'nic2004:52110',
        country: 'IND',
        city: 'std:080',
        action,
        core_version: '1.2.0',
        bap_id: 'buyerapp.ondc.org',
        bap_uri: 'https://buyerapp.ondc.org/protocol/v1',
        bpp_id: 'bpp.logixsoft.in',
        bpp_uri: 'https://relay.logixsoft.in/onboard/beckn/bpp',
        transaction_id: transactionId,
        message_id: messageId,
        timestamp: new Date().toISOString(),
      };
    }

    it('should handle /search and return catalog with descriptors and pricing', async () => {
      const searchPayload = {
        context: getBecknContext('search'),
        message: {
          intent: {
            fulfillment: { type: 'Delivery' },
            item: { descriptor: { name: 'Biryani' } },
          },
        },
      };

      const res = await request('POST', '/onboard/beckn/bpp/search', searchPayload);
      assert.equal(res.status, 200);
      assert.equal(res.json.context.action, 'on_search');
      assert.ok(res.json.message.catalog['bpp/providers'].length > 0);

      const items = res.json.message.catalog['bpp/providers'][0].items;
      assert.ok(items.length > 0);
      assert.ok(items.some((i: any) => i.descriptor.name.includes('Biryani')));
      assert.ok(res.headers.get('authorization')?.includes('ed25519'));
    });

    it('should handle /select and return quote with food tax and itemized packaging charges', async () => {
      const selectPayload = {
        context: getBecknContext('select'),
        message: {
          order: {
            provider: { id: outletId },
            items: [
              {
                id: 'item_hyd_dum_biryani',
                quantity: { count: 2 },
              },
            ],
          },
        },
      };

      const res = await request('POST', '/onboard/beckn/bpp/select', selectPayload);
      assert.equal(res.status, 200);
      assert.equal(res.json.context.action, 'on_select');

      const quote = res.json.message.order.quote;
      assert.ok(quote);
      assert.ok(Number(quote.price.value) > 600);

      // Verify itemized breakup
      const breakup = quote.breakup;
      const packing = breakup.find((b: any) => b['@ondc/org/title_type'] === 'packing');
      const tax = breakup.find((b: any) => b['@ondc/org/title_type'] === 'tax');
      const delivery = breakup.find((b: any) => b['@ondc/org/title_type'] === 'delivery');

      assert.ok(packing, 'Packaging charges must be itemized');
      assert.ok(tax, 'GST must be itemized');
      assert.ok(delivery, 'Delivery fee must be itemized');
    });

    it('should handle /init and return billing and settlement terms', async () => {
      const initPayload = {
        context: getBecknContext('init'),
        message: {
          order: {
            provider: { id: outletId },
            billing: {
              name: 'Karan Mehra',
              phone: '+919811223344',
              email: 'karan@example.com',
            },
            fulfillments: [
              {
                id: 'ful_delivery',
                type: 'Delivery',
                end: {
                  location: {
                    address: {
                      door: '302',
                      building: 'Regency Heights',
                      street: '100ft Road, Indiranagar',
                      city: 'Bangalore',
                      area_code: '560038',
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const res = await request('POST', '/onboard/beckn/bpp/init', initPayload);
      assert.equal(res.status, 200);
      assert.equal(res.json.context.action, 'on_init');
      assert.equal(res.json.message.order.payment.type, 'ON-ORDER');
    });

    let ondcOrderId = `ONDC_ORD_${Date.now()}`;

    it('should handle /confirm, place canonical order, and return Accepted state', async () => {
      const confirmPayload = {
        context: getBecknContext('confirm'),
        message: {
          order: {
            id: ondcOrderId,
            state: 'Created',
            billing: {
              name: 'Karan Mehra',
              phone: '+919811223344',
            },
            items: [
              {
                id: 'item_hyd_dum_biryani',
                quantity: { count: 1 },
              },
            ],
            quote: {
              price: { currency: 'INR', value: '385.00' },
              breakup: [
                {
                  title: 'Hyderabadi Chicken Dum Biryani',
                  price: { value: '320.00' },
                  '@ondc/org/title_type': 'item',
                },
                {
                  title: 'Tax',
                  price: { value: '16.00' },
                  '@ondc/org/title_type': 'tax',
                },
                {
                  title: 'Packing',
                  price: { value: '20.00' },
                  '@ondc/org/title_type': 'packing',
                },
                {
                  title: 'Delivery',
                  price: { value: '29.00' },
                  '@ondc/org/title_type': 'delivery',
                },
              ],
            },
          },
        },
      };

      const res = await request('POST', '/onboard/beckn/bpp/confirm', confirmPayload);
      assert.equal(res.status, 200);
      assert.equal(res.json.context.action, 'on_confirm');
      assert.equal(res.json.message.order.state, 'Accepted');

      // Verify canonical order created
      const canonical = await relayStore.getOrderByChannelOrderId('ONDC', ondcOrderId);
      assert.ok(canonical);
      assert.equal(canonical.channelCode, 'ONDC');
      assert.equal(canonical.pricing.totalAmount, 385);
    });

    it('should handle /status and /track feeds', async () => {
      const statusPayload = {
        context: getBecknContext('status'),
        message: { order_id: ondcOrderId },
      };
      const statusRes = await request('POST', '/onboard/beckn/bpp/status', statusPayload);
      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.json.context.action, 'on_status');
      assert.ok(statusRes.json.message.order.state);

      const trackPayload = {
        context: getBecknContext('track'),
        message: { order_id: ondcOrderId },
      };
      const trackRes = await request('POST', '/onboard/beckn/bpp/track', trackPayload);
      assert.equal(trackRes.status, 200);
      assert.equal(trackRes.json.context.action, 'on_track');
      assert.ok(trackRes.json.message.tracking.url);
    });
  });

  // ─── Test 4: 3PL Multi-Carrier Logistics Broker & WhatsApp Live Tracking ────
  describe('Module 5: 3PL On-Demand Logistics Router (For Direct Orders)', () => {
    it('should query multi-carrier live quotes and identify cheapest and fastest options', async () => {
      const quoteReq = {
        pickupCoords: { latitude: 12.9352, longitude: 77.6245, address: 'Koramangala 5th Block' },
        dropCoords: { latitude: 12.9716, longitude: 77.5946, address: 'MG Road' }, // ~5.5 km
        orderValue: 550,
        packageWeight: 1.5,
      };

      const res = await request('POST', '/logistics/quote', quoteReq);
      assert.equal(res.status, 200);
      assert.ok(res.json.quotes.length >= 4);

      const providers = res.json.quotes.map((q: any) => q.providerCode);
      assert.ok(providers.includes('SHADOWFAX'));
      assert.ok(providers.includes('DUNZO'));
      assert.ok(providers.includes('PORTER'));
      assert.ok(providers.includes('BORZO'));

      assert.ok(res.json.cheapest, 'Must tag cheapest carrier option');
      assert.ok(res.json.fastest, 'Must tag fastest carrier option');
      assert.ok(res.json.recommended, 'Must offer recommended carrier option');
    });

    it('should dispatch 3PL rider, generate waybill, and trigger WhatsApp live tracking', async () => {
      // Create a test order first
      const testOrder = {
        orderId: `ord_direct_${Date.now()}`,
        preferredProvider: 'SHADOWFAX',
      };

      const dispatchRes = await request('POST', '/logistics/dispatch', testOrder);
      assert.equal(dispatchRes.status, 200);
      assert.equal(dispatchRes.json.success, true);
      assert.equal(dispatchRes.json.providerCode, 'SHADOWFAX');
      assert.ok(dispatchRes.json.waybillNumber.startsWith('WB-SHA-'));
      assert.ok(dispatchRes.json.trackingUrl);

      // Verify tracking endpoint
      const trackRes = await request('GET', `/logistics/track/${dispatchRes.json.waybillNumber}`);
      assert.equal(trackRes.status, 200);
      assert.equal(trackRes.json.status, 'RIDER_ASSIGNED');
      assert.ok(trackRes.json.riderName);

      // Simulate 3PL Webhook update (Out for delivery)
      const webhookRes = await request('POST', '/logistics/webhook/shadowfax', {
        waybill_number: dispatchRes.json.waybillNumber,
        status: 'OUT_FOR_DELIVERY',
        rider_name: 'Ramesh Kumar',
        rider_phone: '+919876543110',
        latitude: 12.9512,
        longitude: 77.6112,
        eta_minutes: 12,
        customer_phone: '+919876543210',
        customer_name: 'Rahul',
      });

      assert.equal(webhookRes.status, 200);
      assert.equal(webhookRes.json.status, 'OUT_FOR_DELIVERY');
      assert.ok(webhookRes.json.whatsAppNotification);
    });
  });

  // ─── Test 5: Financial Reconciliation & Payout Auditing ─────────────────────
  describe('Module 6: Financial Reconciliation & Commission Auditing', () => {
    it('should audit weekly settlement CSV, match ledger, and flag discrepancies', async () => {
      // 1. Create a known canonical order to cross-reference
      const reconciledOrderId = `SW_REC_${Date.now()}`;
      const payload = {
        order_id: reconciledOrderId,
        restaurant_id: outletId,
        order: {
          order_id: reconciledOrderId,
          status: 'DELIVERED',
          cart: {
            items: [{ item_id: 'i1', name: 'Dum Biryani', quantity: 1, price: 300, sub_total: 300, is_veg: false }],
          },
          bill_details: { sub_total: 300, packaging_charge: 20, total_tax: 15, discount: 0 },
          total_amount: 335,
          created_at: new Date().toISOString(),
        },
      };
      const raw = JSON.stringify(payload);
      const sig = signHmacSha256(raw, 'swiggy_webhook_secret_xyz123');
      await request('POST', '/webhooks/swiggy/order', raw, { 'x-swiggy-signature': sig });
      await new Promise((r) => setTimeout(r, 60)); // allow ingestion

      // 2. Prepare weekly settlement CSV containing:
      // Row 1: Valid matched order (reconciledOrderId)
      // Row 2: Order with unauthorized cancellation penalty (other_deductions = 100)
      // Row 3: Order not found in POS records
      const csvData = [
        'order_id,gross_amount,commission,taxes,other_deductions,net_payout,payout_reference',
        `${reconciledOrderId},335,54.00,9.72,0,268.28,UTR-SWIGGY-WEEK-38`,
        `SW_DISPUTE_001,400,72.00,12.96,150.00,165.04,UTR-SWIGGY-WEEK-38`,
        `SW_UNKNOWN_999,250,45.00,8.10,0,196.90,UTR-SWIGGY-WEEK-38`,
      ].join('\n');

      const auditRes = await request('POST', '/reconciliation/upload-settlement', {
        outletId,
        channelCode: 'SWIGGY',
        csvContent: csvData,
      });

      assert.equal(auditRes.status, 200);
      const summary = auditRes.json.summary;
      assert.equal(summary.totalOrdersInFile, 3);
      assert.equal(summary.matchedOrders, 1);
      assert.equal(summary.flaggedOrders, 2);
      assert.equal(summary.auditStatus, 'DISCREPANCIES_DETECTED');
      assert.ok(summary.discrepancies.length >= 2);

      // Verify specific flagged discrepancies
      const unauthPenalty = summary.discrepancies.find((d: any) => d.type === 'UNAUTHORIZED_DEDUCTION');
      const unknownOrder = summary.discrepancies.find((d: any) => d.type === 'ORDER_NOT_FOUND');

      assert.ok(unknownOrder, 'Must flag orders not found in POS database');
      assert.ok(summary.netDiscrepancyAmount > 0);

      // Check discrepancies query endpoint
      const listRes = await request('GET', `/reconciliation/discrepancies?outletId=${outletId}`);
      assert.equal(listRes.status, 200);
      assert.ok(listRes.json.total >= 1);
    });
  });

  // ─── Test 6: Desktop POS Bridge (Thermal Silent Print & Audio Chime) ────────
  describe('Desktop POS Bridge: Thermal Silent Print & Audio Chime Verification', () => {
    it('should trigger desktop audio chime and silent thermal KOT printing via logixDinePC.printReceipt({ silent: true })', async () => {
      const res = await request('POST', '/bridge/simulate-order', {
        outletId,
        channel: 'SWIGGY',
        channelOrderId: 'SW_KOT_7788',
        customerName: 'Ananya Roy',
        customerPhone: '+919876543210',
      });

      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);

      const desktopVerification = res.json.desktopVerification;
      assert.equal(
        desktopVerification.audioChimeTriggered,
        true,
        'Incoming order must trigger desktop audio chime notification'
      );
      assert.equal(
        desktopVerification.silentThermalPrintTriggered,
        true,
        'Incoming order must trigger silent thermal printing'
      );
      assert.equal(
        desktopVerification.silentOptionPassed,
        true,
        'Options passed to logixDinePC.printReceipt must have { silent: true }'
      );
      assert.equal(
        desktopVerification.ticketType,
        'KOT',
        'Ticket type must be KOT (Kitchen Order Ticket)'
      );

      // Verify thermal print payload contents
      const printReceipt = res.json.bridgeEvent.printReceipt;
      assert.equal(printReceipt.silent, true);
      assert.equal(printReceipt.type, 'KOT');
      assert.equal(printReceipt.channel, 'SWIGGY');
      assert.ok(printReceipt.items.length > 0);
      assert.equal(printReceipt.items[0].name, 'Hyderabadi Chicken Dum Biryani');
      assert.equal(printReceipt.items[0].qty, 2);
      assert.equal(printReceipt.customer.name, 'Ananya Roy');
    });
  });

  // ─── Outbound Order Controls ────────────────────────────────────────────────
  describe('Outbound Order Controls (Accept / Reject / Ready / Dispatch)', () => {
    it('should progress order lifecycle: ACCEPT -> READY -> DISPATCH', async () => {
      // Find an order in ORDER_PLACED status or create a fresh one
      const placedOrders = await relayStore.listOrders({ outletId, status: 'ORDER_PLACED' });
      let targetOrderId: string;
      if (placedOrders.length > 0) {
        targetOrderId = placedOrders[0].id;
      } else {
        const freshOrder: any = {
          id: `ord_cycle_${Date.now()}`,
          outletId,
          channelCode: 'SWIGGY',
          channelOrderId: `SW_CYCLE_${Date.now()}`,
          displayOrderId: 'SW-9988',
          status: 'ORDER_PLACED',
          orderType: 'DELIVERY',
          prepTimeMinutes: 20,
          customer: { name: 'Lifecycle Tester', phone: '+919999999999' },
          items: [
            {
              id: 'i1',
              channelItemId: 'c1',
              name: 'Biryani',
              quantity: 1,
              basePrice: 200,
              totalPrice: 200,
              foodType: 'VEG',
              selectedVariants: [],
              selectedAddons: [],
            },
          ],
          pricing: {
            subtotal: 200,
            packagingCharge: 20,
            deliveryCharge: 0,
            taxes: [],
            totalTax: 10,
            discount: 0,
            totalAmount: 230,
            customerPaid: 230,
            channelCommissionPercent: 18,
            channelCommission: 36,
            channelCommissionGst: 6.48,
            fixedOrderFee: 0,
            paymentGatewayFee: 0,
            tcsTds: 2,
            netSettlementAmount: 185.52,
          },
          placedAt: new Date().toISOString(),
        };
        await relayStore.saveOrder(freshOrder);
        targetOrderId = freshOrder.id;
      }

      // Accept
      const acceptRes = await request('POST', `/orders/${targetOrderId}/accept`, { prepTimeMinutes: 20 });
      assert.equal(acceptRes.status, 200);
      assert.equal(acceptRes.json.status, 'ORDER_ACCEPTED');

      // Ready
      const readyRes = await request('POST', `/orders/${targetOrderId}/ready`);
      assert.equal(readyRes.status, 200);
      assert.equal(readyRes.json.status, 'FOOD_READY');

      // Dispatch
      const dispatchRes = await request('POST', `/orders/${targetOrderId}/dispatch`, {
        riderType: '3PL',
        preferredProvider: 'DUNZO',
      });
      assert.equal(dispatchRes.status, 200);
      assert.equal(dispatchRes.json.status, 'DISPATCHED');
    });
  });
});
