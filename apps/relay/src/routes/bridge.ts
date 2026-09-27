import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { desktopPosBridge, type DesktopBridgeEvent } from '../bridge/desktop-bridge';
import { generateId } from '@logixsoft/helpers/crypto';
import type { CanonicalOrder } from '@logixsoft/relay-schema';

export const bridgeRouter = new Hono();

// ─── GET /bridge/events (SSE Stream for Desktop PC POS) ───────────────────────
bridgeRouter.get('/events', (c) => {
  return streamSSE(c, async (stream) => {
    // Send connected welcome event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        status: 'CONNECTED',
        bridge: 'Logix Relay Desktop POS Bridge',
        timestamp: Date.now(),
      }),
    });

    const unsubscribe = desktopPosBridge.subscribe(async (event: DesktopBridgeEvent) => {
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
          id: event.id,
        });
      } catch (err) {
        // Stream may have disconnected
      }
    });

    stream.onAbort(() => {
      unsubscribe();
    });

    // Keep-alive heartbeat every 15 seconds
    while (true) {
      await stream.sleep(15000);
      try {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      } catch {
        unsubscribe();
        break;
      }
    }
  });
});

// ─── GET /bridge/ws (Cloudflare Durable Object WebSocket for POS & KDS) ────────
bridgeRouter.get('/ws', async (c) => {
  const outletId = c.req.query('outletId') || 'outlet_default';
  const relayBridgeDO = (c.env as any)?.RELAY_BRIDGE;

  if (relayBridgeDO) {
    const id = relayBridgeDO.idFromName(outletId);
    const stub = relayBridgeDO.get(id);
    return stub.fetch(c.req.raw);
  }

  // Fallback info if running outside of Cloudflare Workers DO environment
  return c.json(
    {
      error: 'DURABLE_OBJECTS_NOT_BOUND',
      message: 'WebSocket endpoint requires Cloudflare Workers RELAY_BRIDGE Durable Object binding. Use /bridge/events SSE for Node runtime.',
    },
    501
  );
});

// ─── GET /bridge/stats ────────────────────────────────────────────────────────
bridgeRouter.get('/stats', async (c) => {
  const outletId = c.req.query('outletId') || 'outlet_default';
  const relayBridgeDO = (c.env as any)?.RELAY_BRIDGE;

  if (relayBridgeDO) {
    const id = relayBridgeDO.idFromName(outletId);
    const stub = relayBridgeDO.get(id);
    const res = await stub.fetch(new Request('http://internal/stats'));
    return c.newResponse(res.body, res.status, Object.fromEntries(res.headers));
  }

  return c.json({
    activeConnections: desktopPosBridge.getHistory().length,
    mode: 'MEMORY_SSE',
  });
});

// ─── POST /bridge/simulate-order ──────────────────────────────────────────────
bridgeRouter.post('/simulate-order', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const channel = body.channel || 'SWIGGY';
  const orderId = generateId('ord');
  const channelOrderId = body.channelOrderId || `MOCK-${Date.now().toString().slice(-4)}`;

  const mockOrder: CanonicalOrder = {
    id: orderId,
    outletId: body.outletId || 'outlet_default',
    channelCode: channel,
    channelOrderId,
    displayOrderId: `${channel.slice(0, 3)}-${channelOrderId.slice(-4)}`,
    status: 'ORDER_PLACED',
    orderType: 'DELIVERY',
    prepTimeMinutes: 20,
    customer: {
      name: body.customerName || 'Rahul Sharma',
      phone: body.customerPhone || '+919876543210',
      address: {
        line1: 'Flat 402, Green Glen Layout, Bellandur',
        landmark: 'Near Sobha Iris',
        city: 'Bangalore',
        pincode: '560103',
      },
    },
    items: [
      {
        id: 'item_hyd_dum_biryani',
        channelItemId: 'sw_item_101',
        name: 'Hyderabadi Chicken Dum Biryani',
        quantity: 2,
        basePrice: 320,
        totalPrice: 640,
        foodType: 'NON_VEG',
        selectedVariants: [{ id: 'var_regular', name: 'Regular', price: 0 }],
        selectedAddons: [{ id: 'addon_extra_raita', name: 'Burani Garlic Raita', price: 35 }],
        itemInstructions: 'Make it spicy with extra salan',
      },
    ],
    pricing: {
      subtotal: 675,
      packagingCharge: 30,
      deliveryCharge: 0,
      taxes: [
        { label: 'CGST 2.5%', rate: 2.5, amount: 16.88 },
        { label: 'SGST 2.5%', rate: 2.5, amount: 16.88 },
      ],
      totalTax: 33.76,
      discount: 50,
      totalAmount: 688.76,
      customerPaid: 688.76,
      channelCommissionPercent: 18,
      channelCommission: 121.5,
      channelCommissionGst: 21.87,
      fixedOrderFee: 0,
      paymentGatewayFee: 0,
      tcsTds: 6.75,
      netSettlementAmount: 538.64,
    },
    specialInstructions: 'Please do not ring bell, baby is sleeping',
    placedAt: new Date().toISOString(),
  };

  // Broadcast event
  const bridgeEvent = desktopPosBridge.broadcastIncomingDeliveryOrder(mockOrder);

  // Simulate Electron desktop execution
  let chimeCalled = false;
  let printCalled = false;
  let printOptionsPassed: any = null;

  const mockPCBridge = {
    playChime: () => {
      chimeCalled = true;
    },
    printReceipt: async (options: any) => {
      printCalled = true;
      printOptionsPassed = options;
      return { success: true, printerName: 'Everycom 58mm Thermal' };
    },
  };

  const clientResult = await desktopPosBridge.handleClientEvent(bridgeEvent, mockPCBridge);

  return c.json({
    success: true,
    message: 'Desktop POS Bridge event simulated successfully',
    bridgeEvent,
    desktopVerification: {
      audioChimeTriggered: chimeCalled,
      silentThermalPrintTriggered: printCalled,
      silentOptionPassed: printOptionsPassed?.silent === true,
      ticketType: printOptionsPassed?.type,
      clientResult,
    },
  });
});

// ─── GET /bridge/history ──────────────────────────────────────────────────────
bridgeRouter.get('/history', (c) => {
  return c.json({
    total: desktopPosBridge.getHistory().length,
    events: desktopPosBridge.getHistory(),
  });
});
