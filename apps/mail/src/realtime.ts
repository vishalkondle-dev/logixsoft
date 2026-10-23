import { DurableObject } from "cloudflare:workers";

interface SSESession {
  id: string;
  userId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

export class RealtimeHubDO extends DurableObject {
  private sessions = new Set<SSESession>();
  private heartbeatTimer: any = null;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      const encoder = new TextEncoder();
      const ping = encoder.encode(`: keepalive ${Date.now()}\n\n`);
      for (const session of this.sessions) {
        try {
          session.controller.enqueue(ping);
        } catch {
          this.sessions.delete(session);
        }
      }
    }, 15000);
  }

  async broadcast(event: string, data: any, targetUserId?: string): Promise<{ delivered: number }> {
    const encoder = new TextEncoder();
    const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    let delivered = 0;

    for (const session of this.sessions) {
      if (!targetUserId || session.userId === targetUserId) {
        try {
          session.controller.enqueue(payload);
          delivered++;
        } catch {
          this.sessions.delete(session);
        }
      }
    }

    return { delivered };
  }

  async handleSSE(request: Request, userId: string): Promise<Response> {
    const encoder = new TextEncoder();
    const sessionId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let sessionObj: SSESession;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        sessionObj = { id: sessionId, userId, controller };
        this.sessions.add(sessionObj);

        // Immediately send connected event
        controller.enqueue(
          encoder.encode(
            `event: connected\ndata: ${JSON.stringify({ status: "live", clientCount: this.sessions.size })}\n\n`
          )
        );
      },
      cancel: () => {
        if (sessionObj) {
          this.sessions.delete(sessionObj);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/broadcast") {
      const { event, data, targetUserId } = (await request.json()) as any;
      const res = await this.broadcast(event, data, targetUserId);
      return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
    }
    return new Response("RealtimeHubDO Active", { status: 200 });
  }
}
