import { CONFIG } from "./config";
import { executeD1 } from "./d1";
import { broadcastSSE } from "./sse";

export interface SendEmailPayload {
  userId: string;
  fromAddress: string; // e.g. "support@logixsoft.in" or "admin@logixsoft.in"
  fromName?: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  inReplyTo?: string;
  referencesHeader?: string;
}

export async function sendEmailViaCloudflare(payload: SendEmailPayload) {
  const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
  const fromDomain = payload.fromAddress.split("@")[1]?.toLowerCase();

  // Validate domain belongs to logixsoft.in or configured domain
  if (fromDomain !== CONFIG.DOMAIN) {
    throw new Error(`Sending domain must be @${CONFIG.DOMAIN}`);
  }

  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/email/sending/send`;

  const requestBody: any = {
    to: toList,
    from: {
      address: payload.fromAddress,
      name: payload.fromName || payload.fromAddress.split("@")[0],
    },
    subject: payload.subject,
    html: payload.html,
    text: payload.text || payload.html.replace(/<[^>]*>/g, ""),
  };

  if (payload.cc && payload.cc.length > 0) requestBody.cc = payload.cc;
  if (payload.bcc && payload.bcc.length > 0) requestBody.bcc = payload.bcc;

  const headers: Record<string, string> = {};
  if (payload.inReplyTo) headers["In-Reply-To"] = payload.inReplyTo;
  if (payload.referencesHeader) headers["References"] = payload.referencesHeader;
  if (Object.keys(headers).length > 0) {
    requestBody.headers = headers;
  }

  const response = await fetch(cfUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const data = (await response.json()) as any;
  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message || "Failed to send email via Cloudflare";
    console.error("Cloudflare Email Sending Error:", data.errors);
    throw new Error(errorMsg);
  }

  const messageId = data.result?.message_id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Math.floor(Date.now() / 1000);
  const snippet = payload.text ? payload.text.slice(0, 120) : payload.html.replace(/<[^>]*>/g, "").slice(0, 120);

  // Save to D1 database under messages table
  try {
    await executeD1(
      `INSERT INTO messages (
        id, user_id, direction, provider_message_id, from_addr, to_addr, cc_addr, bcc_addr,
        subject, snippet, status, created_at, read, starred, text_body, html_body, in_reply_to, references_header
      ) VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, 'sent', ?, 1, 0, ?, ?, ?, ?)`,
      [
        messageId,
        payload.userId,
        messageId,
        `"${payload.fromName || payload.fromAddress.split("@")[0]}" <${payload.fromAddress}>`,
        toList.join(", "),
        payload.cc ? payload.cc.join(", ") : null,
        payload.bcc ? payload.bcc.join(", ") : null,
        payload.subject,
        snippet,
        now,
        payload.text || snippet,
        payload.html,
        payload.inReplyTo || null,
        payload.referencesHeader || null,
      ]
    );
  } catch (err: any) {
    console.warn("Could not save outbound message to D1:", err.message);
  }

  // Realtime broadcast to UI
  broadcastSSE("message_sent", {
    id: messageId,
    from_addr: payload.fromAddress,
    to_addr: toList.join(", "),
    subject: payload.subject,
    snippet,
    created_at: now,
  });

  return { success: true, messageId, queued: data.result?.queued || [] };
}
