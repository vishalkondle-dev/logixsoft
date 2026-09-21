export type SyncTopic = 'TABLES' | 'ORDERS' | 'KITCHEN' | 'CUSTOMER' | 'ALL';

export interface SyncEvent {
  topic: SyncTopic;
  type: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Broadcast an event to a customer-specific Durable Object room based on their mobile number.
 */
export async function broadcastToCustomer(
  env: { OUTLET_ROOM?: DurableObjectNamespace },
  customerPhone: string | null | undefined,
  event: SyncEvent
): Promise<void> {
  if (!customerPhone || !env.OUTLET_ROOM) return;

  const rawDigits = customerPhone.replace(/\D/g, '').slice(-10);
  if (!rawDigits) return;

  try {
    const id = env.OUTLET_ROOM.idFromName(`customer:${rawDigits}`);
    const stub = env.OUTLET_ROOM.get(id);

    const payload = {
      ...event,
      customerPhone: rawDigits,
      timestamp: event.timestamp || Date.now(),
    };

    const res = await stub.fetch('http://do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`[broadcastToCustomer] DO returned status ${res.status}`);
    }
  } catch (err) {
    console.error(`[broadcastToCustomer] Failed to broadcast to customer ${rawDigits}:`, err);
  }
}

/**
 * Broadcast an event to all connected WebSockets in an outlet room via Durable Object,
 * and optionally also to the customer's room if customerPhone is provided.
 * Fire-and-forget; catches any errors so the primary HTTP response is never broken.
 */
export async function broadcastToOutlet(
  env: { OUTLET_ROOM?: DurableObjectNamespace },
  outletId: string | null | undefined,
  event: SyncEvent,
  customerPhone?: string | null | undefined
): Promise<void> {
  if (outletId && env.OUTLET_ROOM) {
    try {
      const id = env.OUTLET_ROOM.idFromName(outletId);
      const stub = env.OUTLET_ROOM.get(id);

      const payload = {
        ...event,
        outletId,
        timestamp: event.timestamp || Date.now(),
      };

      const res = await stub.fetch('http://do/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn(`[broadcastToOutlet] DO returned status ${res.status}`);
      }
    } catch (err) {
      console.error(`[broadcastToOutlet] Failed to broadcast to outlet ${outletId}:`, err);
    }
  }

  // Also notify the customer's Durable Object room if customer phone is attached
  const phoneToNotify = customerPhone || (event.data?.customerPhone as string | undefined);
  if (phoneToNotify && env.OUTLET_ROOM) {
    await broadcastToCustomer(env, phoneToNotify, event);
  }
}

