import { sendMail, type SendMailOptions, type Attachment } from "./index";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rateLimits = new Map<string, { start: number; count: number }>();

function rateLimit(ip: string, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now - entry.start > windowMs) {
    rateLimits.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  if (entry.count > max) {
    return false;
  }
  return true;
}

interface Env {
  API_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_SECURE: string;
  SMTP_USER: string;
  SMTP_PASS: string;
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.headers.get("x-api-key") !== env.API_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!rateLimit(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: { to: string; subject: string; body: string; attachments?: Attachment[]; from?: string };
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, attachments, from } = payload;
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "to, subject and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!EMAIL_RE.test(to)) {
      return new Response(
        JSON.stringify({ error: "Invalid 'to' email address" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (attachments !== undefined) {
      if (!Array.isArray(attachments)) {
        return new Response(
          JSON.stringify({ error: "attachments must be an array" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      for (const att of attachments) {
        if (!att || typeof att.filename !== "string" || !att.filename ||
            typeof att.content !== "string" || !att.content) {
          return new Response(
            JSON.stringify({ error: "each attachment needs a filename and base64 content" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        let size: number;
        try {
          size = atob(att.content).length;
        } catch {
          return new Response(
            JSON.stringify({ error: `invalid base64 in attachment '${att.filename}'` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (size > MAX_ATTACHMENT_BYTES) {
          return new Response(
            JSON.stringify({ error: `attachment '${att.filename}' exceeds 20 MB` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    try {
      const messageId = await sendMail(
        {
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT),
          secure: env.SMTP_SECURE === "true",
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        {
          to,
          subject,
          html: body,
          from,
          attachments,
        }
      );
      return new Response(JSON.stringify({ messageId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error sending email:", error);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
