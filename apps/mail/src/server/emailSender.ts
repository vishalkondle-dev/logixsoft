import { CONFIG } from "./config";
import { queryD1, executeD1 } from "./d1";
import { broadcastSSE } from "./sse";
import { uploadToR2 } from "./r2";

export interface OutboundAttachment {
  name: string;
  type?: string;
  size?: number;
  base64: string;
}

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
  attachments?: OutboundAttachment[];
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

  // Map attachments for Cloudflare Email Sending REST API
  if (payload.attachments && payload.attachments.length > 0) {
    requestBody.attachments = payload.attachments.map((att) => ({
      content: att.base64.includes(",") ? att.base64.split(",")[1] : att.base64,
      filename: att.name,
      type: att.type || "application/octet-stream",
      disposition: "attachment",
    }));
  }

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
    let validUserId: string | null = null;
    if (payload.userId) {
      try {
        const uRows = await queryD1<{ id: string }>("SELECT id FROM users WHERE id = ? LIMIT 1", [payload.userId]);
        if (uRows.length > 0) {
          validUserId = uRows[0].id;
        } else {
          const emailRows = await queryD1<{ id: string }>("SELECT id FROM users WHERE email = ? LIMIT 1", [payload.fromAddress.toLowerCase()]);
          if (emailRows.length > 0) {
            validUserId = emailRows[0].id;
          }
        }
      } catch {}
    }

    try {
      await executeD1(
        `INSERT INTO messages (
          id, user_id, direction, provider_message_id, from_addr, to_addr, cc_addr, bcc_addr,
          subject, snippet, status, created_at, read, starred, text_body, html_body, in_reply_to, references_header
        ) VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, 'sent', ?, 1, 0, ?, ?, ?, ?)`,
        [
          messageId,
          validUserId,
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
    } catch (insertErr: any) {
      if (insertErr.message?.includes("FOREIGN KEY") || insertErr.message?.includes("SQLITE_CONSTRAINT")) {
        console.warn("Retrying message insert with NULL user_id due to FK constraint:", insertErr.message);
        await executeD1(
          `INSERT INTO messages (
            id, user_id, direction, provider_message_id, from_addr, to_addr, cc_addr, bcc_addr,
            subject, snippet, status, created_at, read, starred, text_body, html_body, in_reply_to, references_header
          ) VALUES (?, NULL, 'outbound', ?, ?, ?, ?, ?, ?, ?, 'sent', ?, 1, 0, ?, ?, ?, ?)`,
          [
            messageId,
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
      } else {
        throw insertErr;
      }
    }

    // Save attachments to R2 & D1
    if (payload.attachments && payload.attachments.length > 0) {
      for (const att of payload.attachments) {
        try {
          const rawBase64 = att.base64.includes(",") ? att.base64.split(",")[1] : att.base64;
          const buffer = Buffer.from(rawBase64, "base64");
          const r2Key = `attachments/${messageId}/${att.name}`;
          await uploadToR2(r2Key, buffer, att.type || "application/octet-stream");

          const attId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const sizeBytes = att.size || buffer.length;
          const mimeType = att.type || "application/octet-stream";

          await executeD1(
            `INSERT INTO message_attachments (id, message_id, filename, content_type, mime_type, size, size_bytes, r2_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [attId, messageId, att.name, mimeType, mimeType, sizeBytes, sizeBytes, r2Key]
          );
        } catch (attErr: any) {
          console.warn(`Could not save attachment ${att.name}:`, attErr.message);
        }
      }
    }
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
