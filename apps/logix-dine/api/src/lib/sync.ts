export type SyncTopic = 'TABLES' | 'ORDERS' | 'KITCHEN' | 'ALL';

export interface SyncEvent {
  topic: SyncTopic;
  type: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Broadcast an event to all connected WebSockets in an outlet room via Durable Object.
 * Fire-and-forget; catches any errors so the primary HTTP response is never broken.
 */
export async function broadcastToOutlet(
  env: { OUTLET_ROOM?: DurableObjectNamespace },
  outletId: string | null | undefined,
  event: SyncEvent
): Promise<void> {
  if (!outletId || !env.OUTLET_ROOM) return;

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
