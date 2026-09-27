/**
 * Universal base class compatible with Cloudflare Workers Durable Objects and Node runtimes.
 * Provides access to `this.ctx` (state/websockets) and `this.env` (bindings).
 */
class BaseDurableObject {
  protected ctx: {
    acceptWebSocket: (ws: any) => void;
    getWebSockets: () => any[];
    [key: string]: any;
  };
  protected env: any;

  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }
}

export interface RelaySyncMessage {
  type: 'ORDER_PLACED' | 'ORDER_UPDATED' | 'RIDER_ASSIGNED' | 'ORDER_CANCELLED' | 'PING';
  outletId: string;
  orderId?: string;
  displayOrderId?: string;
  channelCode?: string;
  timestamp: number;
  data?: any;
}

/**
 * Cloudflare Durable Object for coordinated real-time POS & KDS terminal connections.
 * Guarantees that all POS stations for a specific outlet connect to a single, stateful coordinator
 * regardless of which global Cloudflare edge node ingests the webhook.
 */
export class RelayBridgeDO extends BaseDurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade for Desktop POS / Web KDS
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = typeof (globalThis as any).WebSocketPair !== 'undefined'
        ? new (globalThis as any).WebSocketPair()
        : [{}, {}];
      const [client, server] = Object.values(pair);

      // Cloudflare WebSocket Hibernation API: zero CPU cost while idle
      if (this.ctx && typeof this.ctx.acceptWebSocket === 'function') {
        this.ctx.acceptWebSocket(server);
      }

      // Send initial handshake
      if (typeof (server as any).send === 'function') {
        (server as any).send(
          JSON.stringify({
            type: 'CONNECTED',
            timestamp: Date.now(),
            message: 'Connected to Logix Relay Edge Bridge',
          })
        );
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      } as any);
    }

    // 2. Broadcast order event to all connected POS / KDS sockets
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const payload = await request.text();
        const sockets = (this.ctx && typeof this.ctx.getWebSockets === 'function')
          ? this.ctx.getWebSockets()
          : [];
        let delivered = 0;

        for (const ws of sockets) {
          try {
            ws.send(payload);
            delivered++;
          } catch (err) {
            console.error('[RelayBridgeDO] Failed to deliver message to socket:', err);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            delivered,
            totalConnections: sockets.length,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Status and Active Connections
    if (url.pathname === '/stats') {
      const sockets = (this.ctx && typeof this.ctx.getWebSockets === 'function')
        ? this.ctx.getWebSockets()
        : [];
      return new Response(
        JSON.stringify({
          activeConnections: sockets.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(ws: any, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === 'string') {
      try {
        const data = JSON.parse(message);
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch {
        if (message === 'ping') {
          ws.send('pong');
        }
      }
    }
  }

  async webSocketClose(ws: any, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, 'Closed');
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: any, error: unknown): Promise<void> {
    console.error('[RelayBridgeDO] WebSocket error:', error);
  }
}
