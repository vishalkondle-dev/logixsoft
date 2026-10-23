import { DurableObject } from "cloudflare:workers";
import { inspectEmailWithClef, calculateClefRiskScore } from "./clef";

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
  }

  private ensureHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.sessions.size === 0) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        return;
      }
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

  /**
   * Realtime Inbound Email Processor:
   * 1. Checks if Clef intelligence has already run.
   *    If it has already run, skip running again ("if its already ran then no need").
   * 2. If not run yet, automatically executes Clef-Flash intelligence.
   * 3. Calculates risk score.
   *    If risk > 75%, automatically moves the email to the 'junk' folder (status = 'junk').
   * 4. Updates D1 database.
   * 5. Broadcasts real-time events to all connected clients.
   */
  async handleInboundEmail(email: {
    id: string;
    from_addr: string;
    to_addr: string;
    subject: string;
    snippet?: string;
    text_body?: string;
    html_body?: string;
    created_at: number;
    clef_analysis?: any;
    spam_verdict?: string | null;
    status?: string;
  }): Promise<{ status: string; riskScore: number; clefAnalysis: any }> {
    let clefAnalysis = email.clef_analysis;
    let spamVerdict = email.spam_verdict;
    let currentStatus = email.status || "received";

    // 1. Check if Clef intelligence already ran
    if (!clefAnalysis) {
      try {
        const row = (await (this.env as any).DB.prepare(
          "SELECT clef_analysis, spam_verdict, status FROM messages WHERE id = ? LIMIT 1"
        )
          .bind(email.id)
          .first()) as { clef_analysis: string | null; spam_verdict: string | null; status: string } | null;

        if (row && row.clef_analysis) {
          try {
            clefAnalysis = JSON.parse(row.clef_analysis);
            spamVerdict = row.spam_verdict;
            currentStatus = row.status;
          } catch {}
        }
      } catch (err: any) {
        console.warn("RealtimeHubDO check existing clef error:", err.message);
      }
    }

    // 2. If NOT already run, automatically run Clef-Flash intelligence
    if (!clefAnalysis) {
      try {
        clefAnalysis = await inspectEmailWithClef(this.env, {
          from: email.from_addr,
          to: email.to_addr,
          subject: email.subject,
          body: email.text_body || email.html_body || email.snippet || "",
        });
        spamVerdict = clefAnalysis?.validity?.category || null;
      } catch (clefErr: any) {
        console.warn("RealtimeHubDO Clef execution error:", clefErr.message);
      }
    }

    // 3. Calculate risk score & determine if email belongs in 'junk' (> 75% risk)
    const riskScore = calculateClefRiskScore(clefAnalysis);
    let finalStatus = currentStatus;
    if (riskScore > 75) {
      finalStatus = "junk";
    } else if (finalStatus === "junk" && riskScore <= 50) {
      finalStatus = "received";
    }

    // 4. Update D1 database
    try {
      await (this.env as any).DB.prepare(
        "UPDATE messages SET clef_analysis = ?, spam_verdict = ?, status = ? WHERE id = ?"
      )
        .bind(
          clefAnalysis ? (typeof clefAnalysis === "string" ? clefAnalysis : JSON.stringify(clefAnalysis)) : null,
          spamVerdict,
          finalStatus,
          email.id
        )
        .run();
    } catch (dbErr: any) {
      console.error("RealtimeHubDO failed to update message status:", dbErr.message);
    }

    // 5. Broadcast real-time new_email event
    const serializedClef = clefAnalysis
      ? typeof clefAnalysis === "string"
        ? clefAnalysis
        : JSON.stringify(clefAnalysis)
      : null;

    await this.broadcast("new_email", {
      ...email,
      status: finalStatus,
      spam_verdict: spamVerdict,
      clef_analysis: serializedClef,
      risk_score: riskScore,
    });

    return { status: finalStatus, riskScore, clefAnalysis };
  }

  /**
   * Audit & sweep: moves existing high-risk emails (>75%) to junk, and inspects any uninspected
   */
  async sweepJunkAndUninspected(): Promise<{ audited: number; movedToJunk: number }> {
    let movedToJunk = 0;
    let audited = 0;

    try {
      // 1. Move any messages that already have phishing/cold junk verdict but are not marked junk
      const updateRes = await (this.env as any).DB.prepare(
        `UPDATE messages SET status = 'junk'
         WHERE status != 'trashed' AND status != 'junk'
         AND (spam_verdict = 'phishing_scam' OR spam_verdict = 'junk_cold_outreach')`
      ).run();
      movedToJunk += updateRes?.meta?.changes || 0;

      // 2. Fetch up to 25 uninspected inbound messages
      const uninspected = await (this.env as any).DB.prepare(
        `SELECT id, from_addr, to_addr, subject, snippet, text_body, html_body, status, created_at
         FROM messages
         WHERE clef_analysis IS NULL AND direction = 'inbound' AND status != 'trashed'
         ORDER BY created_at DESC LIMIT 25`
      ).all();

      const messages = (uninspected.results || []) as any[];
      for (const msg of messages) {
        try {
          const analysis = await inspectEmailWithClef(this.env, {
            from: msg.from_addr,
            to: msg.to_addr,
            subject: msg.subject,
            body: msg.text_body || msg.html_body || msg.snippet || "",
          });
          const score = calculateClefRiskScore(analysis);
          const newStatus = score > 75 ? "junk" : msg.status;
          await (this.env as any).DB.prepare(
            "UPDATE messages SET clef_analysis = ?, spam_verdict = ?, status = ? WHERE id = ?"
          )
            .bind(JSON.stringify(analysis), analysis.validity?.category || null, newStatus, msg.id)
            .run();

          audited++;
          if (newStatus === "junk") movedToJunk++;
        } catch (e: any) {
          console.warn(`Sweep error for message ${msg.id}:`, e.message);
        }
      }
    } catch (err: any) {
      console.error("RealtimeHubDO sweep error:", err);
    }

    return { audited, movedToJunk };
  }

  async handleSSE(request: Request, userId: string): Promise<Response> {
    const encoder = new TextEncoder();
    const sessionId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let sessionObj: SSESession;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        sessionObj = { id: sessionId, userId, controller };
        this.sessions.add(sessionObj);
        this.ensureHeartbeat();

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
    if (url.pathname === "/inbound-email") {
      const email = (await request.json()) as any;
      const res = await this.handleInboundEmail(email);
      return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/sweep-junk") {
      const res = await this.sweepJunkAndUninspected();
      return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
    }
    return new Response("RealtimeHubDO Active", { status: 200 });
  }
}
