import { Hono } from "hono";
import { cors } from "hono/cors";
import bcrypt from "bcryptjs";
import PostalMime from "postal-mime";
import { RealtimeHubDO } from "./realtime";
import { signJwt, verifyJwt, type AuthUser } from "./jwt";
import { inferMimeType } from "./mime";
import { summarizeEmail, generateQuickReplies, draftEmailWithAI } from "./ai";

export { RealtimeHubDO };

export interface Env {
  ATTACHMENTS: R2Bucket;
  DB: D1Database;
  EMAIL?: SendEmail;
  AI: Ai;
  ASSETS: Fetcher;
  DOMAIN: string;
  JWT_SECRET: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  REALTIME_HUB: DurableObjectNamespace<RealtimeHubDO>;
}

type Variables = {
  user?: AuthUser;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global CORS
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ----------------------------------------------------
// AUTH MIDDLEWARE
// ----------------------------------------------------
async function authMiddleware(c: any, next: () => Promise<void>) {
  let token: string | undefined;

  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    token = c.req.query("token");
  }

  if (!token) {
    return c.json({ error: "Missing or invalid authorization token" }, 401);
  }

  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) {
    return c.json({ error: "Session expired or invalid" }, 401);
  }

  c.set("user", user);
  await next();
}

async function adminMiddleware(c: any, next: () => Promise<void>) {
  await authMiddleware(c, async () => {
    const user = c.get("user") as AuthUser;
    if (user?.role !== "admin" && user?.email !== "admin@logixsoft.in") {
      return c.json({ error: "Admin privilege required" }, 403);
    }
    await next();
  });
}

// ----------------------------------------------------
// REALTIME SERVER-SENT EVENTS
// ----------------------------------------------------
app.get("/api/events", async (c) => {
  let token = c.req.query("token") || c.req.header("Authorization")?.replace("Bearer ", "");
  let userId = "guest";

  if (token) {
    const user = await verifyJwt(token, c.env.JWT_SECRET);
    if (user) {
      userId = user.id;
    }
  }

  const hubId = c.env.REALTIME_HUB.idFromName("global");
  const hub = c.env.REALTIME_HUB.get(hubId);
  return hub.handleSSE(c.req.raw, userId);
});

// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------
app.post("/api/auth/login", async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const user = await c.env.DB.prepare(
      "SELECT id, email, name, password_hash, role, disabled FROM users WHERE email = ? LIMIT 1"
    )
      .bind(cleanEmail)
      .first<{
        id: string;
        email: string;
        name: string;
        password_hash: string;
        role: "admin" | "user";
        disabled: number;
      }>();

    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    if (user.disabled) {
      return c.json({ error: "This account has been disabled. Contact admin." }, 403);
    }

    const matches = bcrypt.compareSync(password, user.password_hash);
    if (!matches) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = await signJwt(authUser, c.env.JWT_SECRET);

    return c.json({
      token,
      user: authUser,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return c.json({ error: err.message || "Login failed" }, 500);
  }
});

app.get("/api/auth/me", authMiddleware, async (c) => {
  return c.json({ user: c.get("user") });
});

// ----------------------------------------------------
// ALIASES & MAILBOXES
// ----------------------------------------------------
app.get("/api/aliases", authMiddleware, async (c) => {
  try {
    const user = c.get("user") as AuthUser;
    const isAdmin = user.role === "admin";
    const domain = c.env.DOMAIN || "logixsoft.in";

    let aliases: any[] = [];
    if (isAdmin) {
      const mailboxesResult = await c.env.DB.prepare(
        "SELECT id, local_part, display_name, user_id FROM mailboxes"
      ).all<{ id: string; local_part: string; display_name: string; user_id: string }>();

      const extraAliasesResult = await c.env.DB.prepare(
        "SELECT id, local_part, mailbox_id FROM mailbox_aliases"
      ).all<{ id: string; local_part: string; mailbox_id: string }>();

      const mapped = (mailboxesResult.results || []).map((m: any) => ({
        id: m.id,
        address: `${m.local_part}@${domain}`,
        displayName: m.display_name || m.local_part,
        isPrimary: true,
      }));

      const mappedExtra = (extraAliasesResult.results || []).map((a: any) => ({
        id: a.id,
        address: `${a.local_part}@${domain}`,
        displayName: a.local_part,
        isPrimary: false,
      }));

      aliases = [...mapped, ...mappedExtra];
    } else {
      const userMailboxes = await c.env.DB.prepare(
        "SELECT id, local_part, display_name FROM mailboxes WHERE user_id = ?"
      )
        .bind(user.id)
        .all<{ id: string; local_part: string; display_name: string }>();

      aliases = (userMailboxes.results || []).map((m: any) => ({
        id: m.id,
        address: `${m.local_part}@${domain}`,
        displayName: m.display_name || m.local_part,
        isPrimary: true,
      }));
    }

    if (aliases.length === 0) {
      aliases.push({
        id: "default_alias",
        address: user.email,
        displayName: user.name,
        isPrimary: true,
      });
    }

    return c.json({ aliases, domain });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ----------------------------------------------------
// MESSAGES & INBOX
// ----------------------------------------------------
app.get("/api/messages", authMiddleware, async (c) => {
  try {
    const folder = c.req.query("folder") || "inbox";
    const alias = c.req.query("alias");
    const search = c.req.query("search");

    let sql = `SELECT id, user_id, direction, from_addr, to_addr, cc_addr, subject, snippet, status, created_at, read, starred, in_reply_to, spam_verdict FROM messages WHERE 1=1`;
    const params: any[] = [];

    if (folder === "inbox") {
      sql += ` AND direction = 'inbound' AND status != 'trashed'`;
    } else if (folder === "sent") {
      sql += ` AND direction = 'outbound' AND status != 'trashed'`;
    } else if (folder === "starred") {
      sql += ` AND starred = 1 AND status != 'trashed'`;
    } else if (folder === "trash") {
      sql += ` AND status = 'trashed'`;
    }

    if (alias && alias !== "all") {
      sql += ` AND (to_addr LIKE ? OR from_addr LIKE ?)`;
      params.push(`%${alias}%`, `%${alias}%`);
    }

    if (search) {
      sql += ` AND (subject LIKE ? OR from_addr LIKE ? OR snippet LIKE ? OR text_body LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const res = await c.env.DB.prepare(sql).bind(...params).all();
    return c.json({ messages: res.results || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/messages/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const message = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ? LIMIT 1")
      .bind(id)
      .first<any>();

    if (!message) {
      return c.json({ error: "Message not found" }, 404);
    }

    // Mark as read automatically
    if (!message.read) {
      await c.env.DB.prepare("UPDATE messages SET read = 1 WHERE id = ?").bind(id).run();
      message.read = 1;
    }

    // Fetch attachments metadata
    const attachments = await c.env.DB.prepare(
      "SELECT * FROM message_attachments WHERE message_id = ?"
    )
      .bind(id)
      .all<any>()
      .then((r: any) => r.results || [])
      .catch(() => []);

    return c.json({ message, attachments });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/messages/:id/star", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const { starred } = await c.req.json().catch(() => ({}));
    await c.env.DB.prepare("UPDATE messages SET starred = ? WHERE id = ?")
      .bind(starred ? 1 : 0, id)
      .run();

    const hub = c.env.REALTIME_HUB.get(c.env.REALTIME_HUB.idFromName("global"));
    await hub.broadcast("message_updated", { id, starred: starred ? 1 : 0 });

    return c.json({ success: true, starred: !!starred });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/messages/:id/trash", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE messages SET status = 'trashed' WHERE id = ?").bind(id).run();

    const hub = c.env.REALTIME_HUB.get(c.env.REALTIME_HUB.idFromName("global"));
    await hub.broadcast("message_updated", { id, status: "trashed" });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ----------------------------------------------------
// SEND EMAIL
// ----------------------------------------------------
app.post("/api/messages/send", authMiddleware, async (c) => {
  try {
    const user = c.get("user") as AuthUser;
    const {
      fromAddress,
      fromName,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      inReplyTo,
      referencesHeader,
      attachments,
    } = await c.req.json();

    if (!fromAddress || !to || !subject || !html) {
      return c.json({ error: "Missing required fields (fromAddress, to, subject, html)" }, 400);
    }

    const toList = Array.isArray(to) ? to : [to];
    const fromDomain = fromAddress.split("@")[1]?.toLowerCase();
    const domain = c.env.DOMAIN || "logixsoft.in";

    if (fromDomain !== domain) {
      return c.json({ error: `Sending domain must be @${domain}` }, 400);
    }

    // 1. Send email via Cloudflare Email Sending REST API
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${c.env.CF_ACCOUNT_ID}/email/sending/send`;
    const requestBody: any = {
      to: toList,
      from: {
        address: fromAddress.trim(),
        name: fromName || user.name || fromAddress.split("@")[0],
      },
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    };

    if (cc && cc.length > 0) requestBody.cc = cc;
    if (bcc && bcc.length > 0) requestBody.bcc = bcc;

    if (attachments && attachments.length > 0) {
      requestBody.attachments = attachments.map((att: any) => ({
        content: att.base64.includes(",") ? att.base64.split(",")[1] : att.base64,
        filename: att.name,
        type: att.type || "application/octet-stream",
        disposition: "attachment",
      }));
    }

    const headers: Record<string, string> = {};
    if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
    if (referencesHeader) headers["References"] = referencesHeader;
    if (Object.keys(headers).length > 0) requestBody.headers = headers;

    const cfRes = await fetch(cfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const cfData = (await cfRes.json()) as any;
    if (!cfData.success) {
      const errorMsg = cfData.errors?.[0]?.message || "Failed to send email via Cloudflare";
      console.error("Cloudflare Email Sending Error:", cfData.errors);
      return c.json({ error: errorMsg }, 500);
    }

    const rawProviderId =
      cfData.result?.message_id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const messageId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    const snippet = text
      ? text.slice(0, 120)
      : html.replace(/<[^>]*>/g, "").slice(0, 120);

    // 2. Insert into D1 messages table
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO messages (
        id, user_id, direction, provider_message_id, from_addr, to_addr, cc_addr, bcc_addr,
        subject, snippet, status, created_at, read, starred, text_body, html_body, in_reply_to, references_header
      ) VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, 'sent', ?, 1, 0, ?, ?, ?, ?)`
    )
      .bind(
        messageId,
        user.id,
        rawProviderId,
        `"${fromName || user.name}" <${fromAddress}>`,
        toList.join(", "),
        cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : null,
        bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc) : null,
        subject,
        snippet,
        now,
        text || snippet,
        html,
        inReplyTo || null,
        referencesHeader || null
      )
      .run();

    // 3. Save attachments to R2 & D1
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        try {
          const rawBase64 = att.base64.includes(",") ? att.base64.split(",")[1] : att.base64;
          const binaryStr = atob(rawBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

          const r2Key = `attachments/${messageId}/${att.name}`;
          await c.env.ATTACHMENTS.put(r2Key, bytes, {
            httpMetadata: { contentType: att.type || "application/octet-stream" },
          });

          const attId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const sizeBytes = att.size || bytes.length;
          const mimeType = att.type || "application/octet-stream";

          await c.env.DB.prepare(
            `INSERT INTO message_attachments (id, message_id, filename, content_type, mime_type, size, size_bytes, r2_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(attId, messageId, att.name, mimeType, mimeType, sizeBytes, sizeBytes, r2Key)
            .run();
        } catch (attErr: any) {
          console.warn(`Could not save attachment ${att.name}:`, attErr.message);
        }
      }
    }

    // 4. Realtime broadcast to UI
    const hub = c.env.REALTIME_HUB.get(c.env.REALTIME_HUB.idFromName("global"));
    await hub.broadcast("message_sent", {
      id: messageId,
      from_addr: fromAddress,
      to_addr: toList.join(", "),
      subject,
      snippet,
      created_at: now,
    });

    return c.json({ success: true, messageId });
  } catch (err: any) {
    console.error("Send email error:", err);
    return c.json({ error: err.message || "Failed to send email" }, 500);
  }
});

// ----------------------------------------------------
// INBOUND EMAIL WEBHOOK (Webhook fallback)
// ----------------------------------------------------
app.post("/api/inbound/webhook", async (c) => {
  try {
    const { from, to, subject, html, text, messageId, inReplyTo, cc } = await c.req.json();
    if (!from || !to) {
      return c.json({ error: "from and to are required" }, 400);
    }

    const id = messageId || `in_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    const snippet = text
      ? text.slice(0, 120)
      : (html || "").replace(/<[^>]*>/g, "").slice(0, 120);

    const localPart = to.split("@")[0].toLowerCase();
    const mbx = await c.env.DB.prepare("SELECT user_id FROM mailboxes WHERE local_part = ? LIMIT 1")
      .bind(localPart)
      .first<{ user_id: string }>();

    const targetUserId = mbx?.user_id || "usr_admin_logixsoft";

    await c.env.DB.prepare(
      `INSERT INTO messages (
        id, user_id, direction, provider_message_id, from_addr, to_addr, cc_addr,
        subject, snippet, status, created_at, read, starred, text_body, html_body, in_reply_to
      ) VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, ?, 'received', ?, 0, 0, ?, ?, ?)`
    )
      .bind(
        id,
        targetUserId,
        id,
        from,
        to,
        cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : null,
        subject || "(no subject)",
        snippet,
        now,
        text || snippet,
        html || `<p>${text || ""}</p>`,
        inReplyTo || null
      )
      .run();

    const hub = c.env.REALTIME_HUB.get(c.env.REALTIME_HUB.idFromName("global"));
    await hub.broadcast("new_email", {
      id,
      from_addr: from,
      to_addr: to,
      subject: subject || "(no subject)",
      snippet,
      created_at: now,
      read: 0,
    });

    return c.json({ success: true, id });
  } catch (err: any) {
    console.error("Inbound webhook error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// ----------------------------------------------------
// ATTACHMENTS (DOWNLOAD, PREVIEW, REMOVE)
// ----------------------------------------------------
app.get("/api/attachments/:id/download", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const att = await c.env.DB.prepare(
      "SELECT id, message_id, filename, content_type, mime_type, r2_key FROM message_attachments WHERE id = ? LIMIT 1"
    )
      .bind(id)
      .first<any>();

    if (!att || !att.r2_key) {
      return c.json({ error: "Attachment not found" }, 404);
    }

    const object = await c.env.ATTACHMENTS.get(att.r2_key);
    if (!object) {
      return c.json({ error: "File not found in storage" }, 404);
    }

    const filename = att.filename || "attachment";
    const mimeType = inferMimeType(
      filename,
      att.mime_type || att.content_type || object.httpMetadata?.contentType
    );

    return new Response(object.body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/attachments/:id/preview", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const att = await c.env.DB.prepare(
      "SELECT id, message_id, filename, content_type, mime_type, r2_key FROM message_attachments WHERE id = ? LIMIT 1"
    )
      .bind(id)
      .first<any>();

    if (!att || !att.r2_key) {
      return c.json({ error: "Attachment not found" }, 404);
    }

    const object = await c.env.ATTACHMENTS.get(att.r2_key);
    if (!object) {
      return c.json({ error: "File not found in storage" }, 404);
    }

    const filename = att.filename || "attachment";
    const mimeType = inferMimeType(
      filename,
      att.mime_type || att.content_type || object.httpMetadata?.contentType
    );

    return new Response(object.body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete("/api/attachments/:id", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const att = await c.env.DB.prepare(
      "SELECT id, message_id, filename, r2_key FROM message_attachments WHERE id = ? LIMIT 1"
    )
      .bind(id)
      .first<any>();

    if (!att) {
      return c.json({ error: "Attachment not found" }, 404);
    }

    if (att.r2_key) {
      await c.env.ATTACHMENTS.delete(att.r2_key).catch(() => {});
    }

    await c.env.DB.prepare("DELETE FROM message_attachments WHERE id = ?").bind(id).run();

    return c.json({
      success: true,
      id,
      messageId: att.message_id,
      filename: att.filename,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ----------------------------------------------------
// AI ASSISTANT ENDPOINTS
// ----------------------------------------------------
app.post("/api/ai/summarize", authMiddleware, async (c) => {
  try {
    const { subject, body } = await c.req.json();
    if (!body) return c.json({ error: "body is required" }, 400);

    const summary = await summarizeEmail(c.env, subject || "Email", body);
    return c.json({ summary });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/ai/quick-replies", authMiddleware, async (c) => {
  try {
    const { subject, body } = await c.req.json();
    const replies = await generateQuickReplies(c.env, subject || "Email", body || "");
    return c.json({ replies });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/ai/draft", authMiddleware, async (c) => {
  try {
    const user = c.get("user") as AuthUser;
    const { prompt, tone, recipient, subject, from, senderName } = await c.req.json();
    if (!prompt && !subject) {
      return c.json({ error: "Either prompt or subject is required" }, 400);
    }

    const draft = await draftEmailWithAI(
      c.env,
      prompt || "",
      tone || "professional",
      recipient || "",
      subject || "",
      from || user?.email || "",
      senderName || "",
      user?.name || ""
    );
    return c.json(draft);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ----------------------------------------------------
// ADMIN MODULE
// ----------------------------------------------------
app.get("/api/admin/users", adminMiddleware, async (c) => {
  try {
    const users = await c.env.DB.prepare(
      "SELECT id, email, name, role, disabled, created_at FROM users ORDER BY created_at DESC"
    ).all<any>();
    return c.json({ users: users.results || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/admin/users", adminMiddleware, async (c) => {
  try {
    const { email, name, password, role } = await c.req.json();
    if (!email || !name || !password) {
      return c.json({ error: "email, name, and password are required" }, 400);
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const passHash = bcrypt.hashSync(password, 10);
    const now = Math.floor(Date.now() / 1000);
    const cleanEmail = email.toLowerCase().trim();

    await c.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, name, role, disabled, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)"
    )
      .bind(id, cleanEmail, passHash, name.trim(), role || "user", now)
      .run();

    const domain = c.env.DOMAIN || "logixsoft.in";
    if (cleanEmail.endsWith(`@${domain}`)) {
      const localPart = cleanEmail.split("@")[0];
      const mbxId = `mbx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const domainRow = await c.env.DB.prepare(
        "SELECT id FROM domains WHERE hostname = ? LIMIT 1"
      )
        .bind(domain)
        .first<{ id: string }>();

      const domainId = domainRow?.id || "dom_logixsoft_in";
      await c.env.DB.prepare(
        "INSERT INTO mailboxes (id, user_id, domain_id, local_part, display_name, created_at, type, disabled) VALUES (?, ?, ?, ?, ?, ?, 'personal', 0)"
      )
        .bind(mbxId, id, domainId, localPart, name, now)
        .run()
        .catch(() => {});
    }

    return c.json({ success: true, user: { id, email: cleanEmail, name, role: role || "user" } });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.patch("/api/admin/users/:id", adminMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const { disabled, role, password } = await c.req.json();

    if (disabled !== undefined) {
      await c.env.DB.prepare("UPDATE users SET disabled = ? WHERE id = ?")
        .bind(disabled ? 1 : 0, id)
        .run();
    }
    if (role !== undefined) {
      await c.env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();
    }
    if (password) {
      const passHash = bcrypt.hashSync(password, 10);
      await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(passHash, id)
        .run();
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/admin/aliases", adminMiddleware, async (c) => {
  try {
    const domain = c.env.DOMAIN || "logixsoft.in";
    const mailboxes = await c.env.DB.prepare(
      `SELECT m.id, m.local_part, m.display_name, m.created_at, u.name as user_name, u.email as user_email
       FROM mailboxes m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC`
    ).all<any>();

    const customAliases = await c.env.DB.prepare(
      `SELECT a.id, a.local_part, a.created_at, m.local_part as mailbox_local_part, u.email as user_email
       FROM mailbox_aliases a
       LEFT JOIN mailboxes m ON a.mailbox_id = m.id
       LEFT JOIN users u ON m.user_id = u.id ORDER BY a.created_at DESC`
    ).all<any>();

    return c.json({
      domain,
      mailboxes: (mailboxes.results || []).map((m: any) => ({
        id: m.id,
        address: `${m.local_part}@${domain}`,
        displayName: m.display_name || m.local_part,
        userName: m.user_name || "Unassigned",
        userEmail: m.user_email || "N/A",
        createdAt: m.created_at,
      })),
      customAliases: (customAliases.results || []).map((a: any) => ({
        id: a.id,
        address: `${a.local_part}@${domain}`,
        targetAddress: a.mailbox_local_part ? `${a.mailbox_local_part}@${domain}` : "None",
        userEmail: a.user_email || "N/A",
        createdAt: a.created_at,
      })),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/admin/aliases", adminMiddleware, async (c) => {
  try {
    const user = c.get("user") as AuthUser;
    const { localPart, userId, displayName } = await c.req.json();
    if (!localPart) {
      return c.json({ error: "localPart is required (e.g. 'support' or 'billing')" }, 400);
    }

    const cleanLocal = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const now = Math.floor(Date.now() / 1000);
    const domain = c.env.DOMAIN || "logixsoft.in";

    const domainRow = await c.env.DB.prepare("SELECT id FROM domains WHERE hostname = ? LIMIT 1")
      .bind(domain)
      .first<{ id: string }>();

    const domainId = domainRow?.id || "dom_logixsoft_in";
    const mbxId = `mbx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await c.env.DB.prepare(
      "INSERT INTO mailboxes (id, user_id, domain_id, local_part, display_name, created_at, type, disabled) VALUES (?, ?, ?, ?, ?, ?, 'custom', 0)"
    )
      .bind(mbxId, userId || user.id, domainId, cleanLocal, displayName || cleanLocal, now)
      .run();

    return c.json({
      success: true,
      alias: {
        id: mbxId,
        address: `${cleanLocal}@${domain}`,
        displayName: displayName || cleanLocal,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/admin/stats", adminMiddleware, async (c) => {
  try {
    const msgCount = await c.env.DB.prepare("SELECT count(*) as count FROM messages").first<{ count: number }>();
    const userCount = await c.env.DB.prepare("SELECT count(*) as count FROM users").first<{ count: number }>();
    const mbxCount = await c.env.DB.prepare("SELECT count(*) as count FROM mailboxes").first<{ count: number }>();

    return c.json({
      totalMessages: msgCount?.count || 0,
      totalUsers: userCount?.count || 0,
      totalAliases: mbxCount?.count || 0,
      domain: c.env.DOMAIN || "logixsoft.in",
      sendingStatus: "active",
      routingStatus: "catch-all enabled",
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ----------------------------------------------------
// STATIC SPA FALLBACK
// ----------------------------------------------------
app.all("*", async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Endpoint not found" }, 404);
  }
  // Let Workers Assets serve the static frontend or index.html
  return c.env.ASSETS.fetch(c.req.raw);
});

// ----------------------------------------------------
// WORKER DEFAULT EXPORT (Fetch + Inbound Email)
// ----------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      const from = message.from;
      const to = message.to;
      const raw = await new Response(message.raw).arrayBuffer();
      const parsed = await PostalMime.parse(raw);

      const rawProviderId =
        message.headers.get("message-id") ||
        parsed.messageId ||
        `in_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const messageId = `in_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const now = Math.floor(Date.now() / 1000);
      const text = parsed.text || "";
      const html = parsed.html || (text ? `<p>${text}</p>` : "");
      const snippet = text
        ? text.slice(0, 120)
        : html.replace(/<[^>]*>/g, "").slice(0, 120);

      const localPart = to.split("@")[0].toLowerCase();
      const mbx = await env.DB.prepare("SELECT user_id FROM mailboxes WHERE local_part = ? LIMIT 1")
        .bind(localPart)
        .first<{ user_id: string }>();

      const targetUserId = mbx?.user_id || "usr_admin_logixsoft";
      const subject = parsed.subject || "(no subject)";
      const inReplyTo = message.headers.get("in-reply-to") || null;

      // 1. Insert message into D1
      await env.DB.prepare(
        `INSERT OR REPLACE INTO messages (
          id, user_id, direction, provider_message_id, from_addr, to_addr,
          subject, snippet, status, created_at, read, starred, text_body, html_body, in_reply_to
        ) VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, 'received', ?, 0, 0, ?, ?, ?)`
      )
        .bind(
          messageId,
          targetUserId,
          rawProviderId,
          from,
          to,
          subject,
          snippet,
          now,
          text || snippet,
          html,
          inReplyTo
        )
        .run();

      // 2. Store attachments in R2 & D1
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const att of parsed.attachments) {
          try {
            const attFilename = att.filename || `attachment_${Date.now()}`;
            const r2Key = `attachments/${messageId}/${attFilename}`;
            const mimeType = att.mimeType || "application/octet-stream";

            await env.ATTACHMENTS.put(r2Key, att.content, {
              httpMetadata: { contentType: mimeType },
            });

            const attId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const sizeBytes = att.content
              ? typeof att.content === "string"
                ? att.content.length
                : (att.content as ArrayBuffer).byteLength
              : 0;

            await env.DB.prepare(
              `INSERT INTO message_attachments (id, message_id, filename, content_type, mime_type, size, size_bytes, r2_key)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(attId, messageId, attFilename, mimeType, mimeType, sizeBytes, sizeBytes, r2Key)
              .run();
          } catch (attErr: any) {
            console.error(`Error saving inbound attachment ${att.filename}:`, attErr);
          }
        }
      }

      // 3. Broadcast real-time new_email event
      const hub = env.REALTIME_HUB.get(env.REALTIME_HUB.idFromName("global"));
      await hub.broadcast("new_email", {
        id: messageId,
        from_addr: from,
        to_addr: to,
        subject,
        snippet,
        created_at: now,
        read: 0,
      });

      // 4. Optionally forward to verified external address if sent to support
      if (to.toLowerCase().includes("support@logixsoft.in")) {
        try {
          await message.forward("vishalkondle.dev@gmail.com");
        } catch (fwdErr: any) {
          console.warn("Could not forward support email:", fwdErr?.message);
        }
      }
    } catch (err: any) {
      console.error("Error processing inbound email in Worker:", err);
    }
  },
};
