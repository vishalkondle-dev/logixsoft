import { DurableObject } from 'cloudflare:workers';

export interface SyncMessage {
  type: string;
  topic: 'TABLES' | 'ORDERS' | 'KITCHEN' | 'ALL';
  outletId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export class OutletRoomDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade request
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Cloudflare WebSocket Hibernation API
      this.ctx.acceptWebSocket(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Broadcast message to all connected WebSockets in this outlet room
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const payload = await request.text();
        const sockets = this.ctx.getWebSockets();
        let delivered = 0;

        for (const ws of sockets) {
          try {
            ws.send(payload);
            delivered++;
          } catch (err) {
            console.error('[OutletRoomDO] Failed to send to socket:', err);
          }
        }

        return new Response(
          JSON.stringify({ success: true, delivered, total: sockets.length }),
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

    // Health / stats endpoint
    if (url.pathname === '/stats') {
      return new Response(
        JSON.stringify({
          activeConnections: this.ctx.getWebSockets().length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === 'string') {
      try {
        const data = JSON.parse(message);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        if (message === 'ping') {
          ws.send('pong');
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    try {
      ws.close(code, 'Closed by client');
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('[OutletRoomDO] WebSocket error:', error);
  }
}
