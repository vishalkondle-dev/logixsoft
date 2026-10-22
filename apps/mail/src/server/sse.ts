import { Response } from "express";
import { queryD1 } from "./d1";

interface SSEClient {
  id: string;
  userId: string;
  res: Response;
}

const clients = new Set<SSEClient>();
let lastKnownMaxCreatedAt = Math.floor(Date.now() / 1000);

export function addSSEClient(id: string, userId: string, res: Response) {
  const client: SSEClient = { id, userId, res };
  clients.add(client);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: "live", clientCount: clients.size })}\n\n`);

  res.on("close", () => {
    clients.delete(client);
  });
}

export function broadcastSSE(event: string, data: any, targetUserId?: string) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (!targetUserId || client.userId === targetUserId) {
      try {
        client.res.write(payload);
      } catch (err) {
        clients.delete(client);
      }
    }
  }
}

// Background sync worker: watches D1 messages table for newly arrived emails
export function startSSEHeartbeatAndWatcher() {
  // Keep-alive ping every 15s to keep connections healthy
  setInterval(() => {
    for (const client of clients) {
      try {
        client.res.write(`: keepalive ${Date.now()}\n\n`);
      } catch (err) {
        clients.delete(client);
      }
    }
  }, 15000);

  // Poll D1 on the server side every 3 seconds to catch any emails written directly by the edge worker
  setInterval(async () => {
    if (clients.size === 0) return;
    try {
      const rows = await queryD1<{ id: string; user_id: string; from_addr: string; to_addr: string; subject: string; created_at: number }>(
        `SELECT id, user_id, from_addr, to_addr, subject, created_at FROM messages WHERE created_at > ? ORDER BY created_at ASC LIMIT 10`,
        [lastKnownMaxCreatedAt]
      );

      if (rows && rows.length > 0) {
        for (const row of rows) {
          if (row.created_at > lastKnownMaxCreatedAt) {
            lastKnownMaxCreatedAt = row.created_at;
          }
          broadcastSSE("new_email", row);
        }
      }
    } catch (err) {
      // Ignore background D1 transient check errors
    }
  }, 3000);
}
