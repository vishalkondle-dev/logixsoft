import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { CONFIG } from "./config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { queryD1, executeD1 } from "./d1";
import { getFromR2, deleteFromR2 } from "./r2";
import {
  requireAuth,
  requireAdmin,
  generateToken,
  comparePassword,
  hashPassword,
  AuthenticatedRequest,
} from "./auth";
import { addSSEClient, broadcastSSE, startSSEHeartbeatAndWatcher } from "./sse";
import { sendEmailViaCloudflare } from "./emailSender";
import { summarizeEmail, generateQuickReplies, draftEmailWithAI } from "./ai";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "25mb" }));

// ----------------------------------------------------
// REALTIME SERVER-SENT EVENTS
// ----------------------------------------------------
app.get("/api/events", (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.headers.authorization?.replace("Bearer ", "");
  let userId = "guest";
  if (token) {
    try {
      const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;
      userId = decoded.id || "guest";
    } catch (e) {}
  }

  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  addSSEClient(clientId, userId, res);
});

// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const users = await queryD1<{
      id: string;
      email: string;
      name: string;
      password_hash: string;
      role: "admin" | "user";
      disabled: number;
    }>(`SELECT id, email, name, password_hash, role, disabled FROM users WHERE email = ? LIMIT 1`, [email.toLowerCase().trim()]);

    const user = users[0];
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.disabled) {
      res.status(403).json({ error: "This account has been disabled. Contact admin." });
      return;
    }

    const matches = comparePassword(password, user.password_hash);
    if (!matches) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Login failed" });
  }
});

app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// ALIASES & MAILBOXES
// ----------------------------------------------------
app.get("/api/aliases", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "admin";

    let aliases: any[] = [];
    if (isAdmin) {
      // Admin sees all configured aliases across the domain
      const mailboxes = await queryD1(`SELECT id, local_part, display_name, user_id FROM mailboxes`);
      const extraAliases = await queryD1(`SELECT id, local_part, mailbox_id FROM mailbox_aliases`);
      
      const mapped = mailboxes.map((m: any) => ({
        id: m.id,
        address: `${m.local_part}@${CONFIG.DOMAIN}`,
        displayName: m.display_name || m.local_part,
        isPrimary: true,
      }));

      const mappedExtra = extraAliases.map((a: any) => ({
        id: a.id,
        address: `${a.local_part}@${CONFIG.DOMAIN}`,
        displayName: a.local_part,
        isPrimary: false,
      }));

      aliases = [...mapped, ...mappedExtra];
    } else {
      // Normal user sees aliases tied to their mailboxes
      const userMailboxes = await queryD1(`SELECT id, local_part, display_name FROM mailboxes WHERE user_id = ?`, [userId]);
      aliases = userMailboxes.map((m: any) => ({
        id: m.id,
        address: `${m.local_part}@${CONFIG.DOMAIN}`,
        displayName: m.display_name || m.local_part,
        isPrimary: true,
      }));
    }

    // Always include admin@logixsoft.in and catch-all if admin
    if (aliases.length === 0) {
      aliases.push({
        id: "default_alias",
        address: req.user!.email,
        displayName: req.user!.name,
        isPrimary: true,
      });
    }

    res.json({ aliases, domain: CONFIG.DOMAIN });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// MESSAGES & INBOX
// ----------------------------------------------------
app.get("/api/folders/counts", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "usr_admin_logixsoft";
    const rows = await queryD1<any>(
      `SELECT
        COUNT(CASE WHEN m.direction = 'inbound' AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'deleted_permanently', 'junk', 'spam') THEN 1 END) as inbox,
        COUNT(CASE WHEN m.direction = 'outbound' AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'deleted_permanently') THEN 1 END) as sent,
        COUNT(CASE WHEN m.starred = 1 AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'deleted_permanently', 'junk', 'spam') THEN 1 END) as starred,
        COUNT(CASE WHEN COALESCE(ums.status, m.status) IN ('junk', 'spam') THEN 1 END) as junk,
        COUNT(CASE WHEN COALESCE(ums.status, m.status) = 'trashed' THEN 1 END) as trash
      FROM messages m
      LEFT JOIN user_message_status ums ON ums.message_id = m.id AND ums.user_id = ?
      WHERE (ums.status IS NULL OR ums.status != 'deleted_permanently')`,
      [userId]
    );

    const r = rows[0];
    res.json({
      counts: {
        inbox: r?.inbox || 0,
        sent: r?.sent || 0,
        starred: r?.starred || 0,
        junk: r?.junk || 0,
        trash: r?.trash || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "usr_admin_logixsoft";
    const folder = (req.query.folder as string) || "inbox";
    const alias = req.query.alias as string;
    const search = req.query.search as string;

    let sql = `SELECT m.id, m.user_id, m.direction, m.from_addr, m.to_addr, m.cc_addr, m.subject, m.snippet, COALESCE(ums.status, m.status) as status, m.created_at, m.read, m.starred, m.in_reply_to, m.spam_verdict FROM messages m
      LEFT JOIN user_message_status ums ON ums.message_id = m.id AND ums.user_id = ?
      WHERE (ums.status IS NULL OR ums.status != 'deleted_permanently')`;
    const params: any[] = [userId];

    if (!search || !search.trim()) {
      if (folder === "inbox") {
        sql += ` AND m.direction = 'inbound' AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'junk', 'spam')`;
      } else if (folder === "sent") {
        sql += ` AND m.direction = 'outbound' AND COALESCE(ums.status, m.status) != 'trashed'`;
      } else if (folder === "starred") {
        sql += ` AND m.starred = 1 AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'junk', 'spam')`;
      } else if (folder === "junk") {
        sql += ` AND (COALESCE(ums.status, m.status) = 'junk' OR COALESCE(ums.status, m.status) = 'spam')`;
      } else if (folder === "trash") {
        sql += ` AND COALESCE(ums.status, m.status) = 'trashed'`;
      }
    } else {
      sql += ` AND COALESCE(ums.status, m.status) != 'trashed'`;
    }

    if (alias && alias !== "all") {
      sql += ` AND (m.to_addr LIKE ? OR m.from_addr LIKE ?)`;
      params.push(`%${alias}%`, `%${alias}%`);
    }

    if (search) {
      sql += ` AND (m.subject LIKE ? OR m.from_addr LIKE ? OR m.snippet LIKE ? OR m.text_body LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT 100`;

    const messages = await queryD1(sql, params);

    const countsRows = await queryD1<any>(
      `SELECT
        COUNT(CASE WHEN m.direction = 'inbound' AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'deleted_permanently', 'junk', 'spam') THEN 1 END) as inbox,
        COUNT(CASE WHEN m.direction = 'outbound' AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'deleted_permanently') THEN 1 END) as sent,
        COUNT(CASE WHEN m.starred = 1 AND COALESCE(ums.status, m.status) NOT IN ('trashed', 'deleted_permanently', 'junk', 'spam') THEN 1 END) as starred,
        COUNT(CASE WHEN COALESCE(ums.status, m.status) IN ('junk', 'spam') THEN 1 END) as junk,
        COUNT(CASE WHEN COALESCE(ums.status, m.status) = 'trashed' THEN 1 END) as trash
      FROM messages m
      LEFT JOIN user_message_status ums ON ums.message_id = m.id AND ums.user_id = ?
      WHERE (ums.status IS NULL OR ums.status != 'deleted_permanently')`,
      [userId]
    ).catch(() => []);

    const cr = countsRows[0];
    const folder_counts = {
      inbox: cr?.inbox || 0,
      sent: cr?.sent || 0,
      starred: cr?.starred || 0,
      junk: cr?.junk || 0,
      trash: cr?.trash || 0,
    };

    res.json({ messages, folder_counts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/messages/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "usr_admin_logixsoft";
    const messages = await queryD1(
      `SELECT m.*, COALESCE(ums.status, m.status) as status
       FROM messages m
       LEFT JOIN user_message_status ums ON ums.message_id = m.id AND ums.user_id = ?
       WHERE m.id = ? AND (ums.status IS NULL OR ums.status != 'deleted_permanently') LIMIT 1`,
      [userId, id]
    );
    if (!messages || messages.length === 0) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const message: any = messages[0];

    // Mark as read automatically
    if (!message.read) {
      await executeD1(`UPDATE messages SET read = 1 WHERE id = ?`, [id]);
      message.read = 1;
    }

    // Fetch attachments metadata if any
    const attachments = await queryD1(`SELECT * FROM message_attachments WHERE message_id = ?`, [id]).catch(() => []);

    res.json({ message, attachments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages/:id/read", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { read } = req.body;
    const readVal = read ? 1 : 0;
    await executeD1(`UPDATE messages SET read = ? WHERE id = ?`, [readVal, id]);
    broadcastSSE("message_updated", { id, read: readVal });
    res.json({ success: true, read: !!read });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages/:id/restore", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "usr_admin_logixsoft";
    await executeD1(`DELETE FROM user_message_status WHERE user_id = ? AND message_id = ?`, [userId, id]);
    broadcastSSE("message_updated", { id, status: "received" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/messages/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "usr_admin_logixsoft";
    const now = Math.floor(Date.now() / 1000);
    await executeD1(
      `INSERT OR REPLACE INTO user_message_status (user_id, message_id, status, updated_at) VALUES (?, ?, 'deleted_permanently', ?)`,
      [userId, id, now]
    );
    broadcastSSE("message_deleted", { id });
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages/:id/star", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { starred } = req.body;
    await executeD1(`UPDATE messages SET starred = ? WHERE id = ?`, [starred ? 1 : 0, id]);
    broadcastSSE("message_updated", { id, starred: starred ? 1 : 0 });
    res.json({ success: true, starred: !!starred });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages/:id/trash", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "usr_admin_logixsoft";
    const now = Math.floor(Date.now() / 1000);
    await executeD1(
      `INSERT OR REPLACE INTO user_message_status (user_id, message_id, status, updated_at) VALUES (?, ?, 'trashed', ?)`,
      [userId, id, now]
    );
    broadcastSSE("message_updated", { id, status: "trashed" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages/:id/junk", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "usr_admin_logixsoft";
    const now = Math.floor(Date.now() / 1000);
    await executeD1(
      `INSERT OR REPLACE INTO user_message_status (user_id, message_id, status, updated_at) VALUES (?, ?, 'junk', ?)`,
      [userId, id, now]
    );
    broadcastSSE("message_updated", { id, status: "junk" });
    res.json({ success: true, status: "junk" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages/:id/not-junk", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "usr_admin_logixsoft";
    await executeD1(`DELETE FROM user_message_status WHERE user_id = ? AND message_id = ?`, [userId, id]);
    broadcastSSE("message_updated", { id, status: "received" });
    res.json({ success: true, status: "received" });
    res.json({ success: true, status: "received" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SEND EMAIL
// ----------------------------------------------------
app.post("/api/messages/send", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromAddress, fromName, to, cc, bcc, subject, html, text, inReplyTo, referencesHeader, attachments } = req.body;

    if (!fromAddress || !to || !subject || !html) {
      res.status(400).json({ error: "Missing required fields (fromAddress, to, subject, html)" });
      return;
    }

    const result = await sendEmailViaCloudflare({
      userId: req.user!.id,
      fromAddress: fromAddress.trim(),
      fromName: fromName || req.user!.name,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      inReplyTo,
      referencesHeader,
      attachments,
    });

    res.json(result);
  } catch (err: any) {
    console.error("Send email error:", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
});

// ----------------------------------------------------
// INBOUND EMAIL WEBHOOK (From Cloudflare Worker / Webhook)
// ----------------------------------------------------
app.post("/api/inbound/webhook", async (req: Request, res: Response) => {
  try {
    const { from, to, subject, html, text, messageId, inReplyTo, cc } = req.body;
    if (!from || !to) {
      res.status(400).json({ error: "from and to are required" });
      return;
    }

    const id = messageId || `in_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    const snippet = text ? text.slice(0, 120) : (html || "").replace(/<[^>]*>/g, "").slice(0, 120);

    // Default to admin user for inbound or find matching mailbox user
    const mailboxes = await queryD1<{ user_id: string }>(
      `SELECT user_id FROM mailboxes WHERE local_part = ? LIMIT 1`,
      [to.split("@")[0].toLowerCase()]
    );
    const targetUserId = mailboxes[0]?.user_id || "usr_3ny6fn8E0UGlG4SGZ47hS"; // admin fallback

    await executeD1(
      `INSERT INTO messages (
        id, user_id, direction, provider_message_id, from_addr, to_addr, cc_addr,
        subject, snippet, status, created_at, read, starred, text_body, html_body, in_reply_to
      ) VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, ?, 'received', ?, 0, 0, ?, ?, ?)`,
      [
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
        inReplyTo || null,
      ]
    );

    // Push instant real-time event to connected UI clients
    broadcastSSE("new_email", {
      id,
      from_addr: from,
      to_addr: to,
      subject: subject || "(no subject)",
      snippet,
      created_at: now,
      read: 0,
    });

    res.json({ success: true, id });
  } catch (err: any) {
    console.error("Inbound webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ATTACHMENT ENDPOINTS (DOWNLOAD, PREVIEW, REMOVE)
// ----------------------------------------------------
function inferMimeType(filename: string, fallback?: string): string {
  if (fallback && fallback !== "application/octet-stream" && fallback.includes("/")) {
    return fallback;
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".ts": "text/plain; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return mimeMap[ext] || fallback || "application/octet-stream";
}

app.get("/api/attachments/:id/download", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await queryD1<{
      id: string;
      message_id: string;
      filename: string;
      content_type: string;
      mime_type: string;
      r2_key: string;
    }>(`SELECT * FROM message_attachments WHERE id = ? LIMIT 1`, [id]);

    const att = rows[0];
    if (!att) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (!att.r2_key) {
      res.status(404).json({ error: "Attachment file key missing in database" });
      return;
    }

    const fileData = await getFromR2(att.r2_key);
    if (!fileData) {
      res.status(404).json({ error: "File not found in R2 storage" });
      return;
    }

    const filename = att.filename || "attachment";
    const mimeType = inferMimeType(filename, att.mime_type || att.content_type || fileData.contentType);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(fileData.buffer);
  } catch (err: any) {
    console.error("Download attachment error:", err);
    res.status(500).json({ error: err.message || "Failed to download attachment" });
  }
});

app.get("/api/attachments/:id/preview", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await queryD1<{
      id: string;
      message_id: string;
      filename: string;
      content_type: string;
      mime_type: string;
      r2_key: string;
    }>(`SELECT * FROM message_attachments WHERE id = ? LIMIT 1`, [id]);

    const att = rows[0];
    if (!att) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    if (!att.r2_key) {
      res.status(404).json({ error: "Attachment file key missing in database" });
      return;
    }

    const fileData = await getFromR2(att.r2_key);
    if (!fileData) {
      res.status(404).json({ error: "File not found in R2 storage" });
      return;
    }

    const filename = att.filename || "attachment";
    const mimeType = inferMimeType(filename, att.mime_type || att.content_type || fileData.contentType);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(fileData.buffer);
  } catch (err: any) {
    console.error("Preview attachment error:", err);
    res.status(500).json({ error: err.message || "Failed to preview attachment" });
  }
});

app.delete("/api/attachments/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.status(403).json({ error: "Removing attachments from messages is not allowed" });
});

// ----------------------------------------------------
// AI ASSISTANT ENDPOINTS
// ----------------------------------------------------
app.post("/api/ai/summarize", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subject, body } = req.body;
    if (!body) {
      res.status(400).json({ error: "body is required" });
      return;
    }
    const summary = await summarizeEmail(subject || "Email", body);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/quick-replies", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subject, body } = req.body;
    const replies = await generateQuickReplies(subject || "Email", body || "");
    res.json({ replies });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/draft", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, tone, recipient, subject, from, senderName } = req.body;
    if (!prompt && !subject) {
      res.status(400).json({ error: "Either prompt or subject is required" });
      return;
    }
    const draft = await draftEmailWithAI(
      prompt || "",
      tone || "professional",
      recipient || "",
      subject || "",
      from || req.user?.email || "",
      senderName || "",
      req.user?.name || ""
    );
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ADMIN MODULE (admin@logixsoft.in)
// ----------------------------------------------------
app.get("/api/admin/users", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await queryD1<{
      id: string;
      email: string;
      name: string;
      role: string;
      disabled: number;
      created_at: number;
    }>(`SELECT id, email, name, role, disabled, created_at FROM users ORDER BY created_at DESC`);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/users", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: "email, name, and password are required" });
      return;
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const passHash = hashPassword(password);
    const now = Math.floor(Date.now() / 1000);

    await executeD1(
      `INSERT INTO users (id, email, password_hash, name, role, disabled, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [id, email.toLowerCase().trim(), passHash, name.trim(), role || "user", now]
    );

    // Also auto-create a default mailbox for the user if it's on our domain
    if (email.endsWith(`@${CONFIG.DOMAIN}`)) {
      const localPart = email.split("@")[0].toLowerCase();
      const mbxId = `mbx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const domainRow = await queryD1<{ id: string }>(`SELECT id FROM domains WHERE hostname = ? LIMIT 1`, [CONFIG.DOMAIN]);
      const domainId = domainRow[0]?.id || "dom_4ThXVyjCGFQxKEaITDFb8";

      await executeD1(
        `INSERT INTO mailboxes (id, user_id, domain_id, local_part, display_name, created_at, type, disabled) VALUES (?, ?, ?, ?, ?, ?, 'personal', 0)`,
        [mbxId, id, domainId, localPart, name, now]
      ).catch(() => {});
    }

    res.json({ success: true, user: { id, email, name, role: role || "user" } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/users/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { disabled, role, password } = req.body;

    if (disabled !== undefined) {
      await executeD1(`UPDATE users SET disabled = ? WHERE id = ?`, [disabled ? 1 : 0, id]);
    }
    if (role !== undefined) {
      await executeD1(`UPDATE users SET role = ? WHERE id = ?`, [role, id]);
    }
    if (password) {
      const passHash = hashPassword(password);
      await executeD1(`UPDATE users SET password_hash = ? WHERE id = ?`, [passHash, id]);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/aliases", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mailboxes = await queryD1(
      `SELECT m.id, m.local_part, m.display_name, m.created_at, u.name as user_name, u.email as user_email
       FROM mailboxes m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC`
    );
    const customAliases = await queryD1(
      `SELECT a.id, a.local_part, a.created_at, m.local_part as mailbox_local_part, u.email as user_email
       FROM mailbox_aliases a
       LEFT JOIN mailboxes m ON a.mailbox_id = m.id
       LEFT JOIN users u ON m.user_id = u.id ORDER BY a.created_at DESC`
    );

    res.json({
      domain: CONFIG.DOMAIN,
      mailboxes: mailboxes.map((m: any) => ({
        id: m.id,
        address: `${m.local_part}@${CONFIG.DOMAIN}`,
        displayName: m.display_name || m.local_part,
        userName: m.user_name || "Unassigned",
        userEmail: m.user_email || "N/A",
        createdAt: m.created_at,
      })),
      customAliases: customAliases.map((a: any) => ({
        id: a.id,
        address: `${a.local_part}@${CONFIG.DOMAIN}`,
        targetAddress: a.mailbox_local_part ? `${a.mailbox_local_part}@${CONFIG.DOMAIN}` : "None",
        userEmail: a.user_email || "N/A",
        createdAt: a.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/aliases", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { localPart, userId, displayName } = req.body;
    if (!localPart) {
      res.status(400).json({ error: "localPart is required (e.g. 'support' or 'billing')" });
      return;
    }

    const cleanLocal = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const now = Math.floor(Date.now() / 1000);
    const domainRow = await queryD1<{ id: string }>(`SELECT id FROM domains WHERE hostname = ? LIMIT 1`, [CONFIG.DOMAIN]);
    const domainId = domainRow[0]?.id || "dom_4ThXVyjCGFQxKEaITDFb8";
    const mbxId = `mbx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    await executeD1(
      `INSERT INTO mailboxes (id, user_id, domain_id, local_part, display_name, created_at, type, disabled) VALUES (?, ?, ?, ?, ?, ?, 'custom', 0)`,
      [mbxId, userId || req.user!.id, domainId, cleanLocal, displayName || cleanLocal, now]
    );

    res.json({
      success: true,
      alias: {
        id: mbxId,
        address: `${cleanLocal}@${CONFIG.DOMAIN}`,
        displayName: displayName || cleanLocal,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/stats", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const msgCount = await queryD1<{ count: number }>(`SELECT count(*) as count FROM messages`);
    const userCount = await queryD1<{ count: number }>(`SELECT count(*) as count FROM users`);
    const mbxCount = await queryD1<{ count: number }>(`SELECT count(*) as count FROM mailboxes`);

    res.json({
      totalMessages: msgCount[0]?.count || 0,
      totalUsers: userCount[0]?.count || 0,
      totalAliases: mbxCount[0]?.count || 0,
      domain: CONFIG.DOMAIN,
      sendingStatus: "active",
      routingStatus: "catch-all enabled",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// STATIC FRONTEND ASSETS & PWA SUPPORT
// ----------------------------------------------------
const clientDistPath = path.resolve(__dirname, "../../dist/client");

app.get("/manifest.webmanifest", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.sendFile(path.join(clientDistPath, "manifest.webmanifest"), { dotfiles: "allow" });
});

app.get("/sw.js", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Service-Worker-Allowed", "/");
  res.sendFile(path.join(clientDistPath, "sw.js"), { dotfiles: "allow" });
});

app.use(express.static(clientDistPath, { dotfiles: "allow" }));

app.use((req: Request, res: Response) => {
  // If API route not found, 404
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "Endpoint not found" });
    return;
  }
  // Otherwise serve React SPA index.html
  res.sendFile(path.join(clientDistPath, "index.html"), { dotfiles: "allow" }, (err) => {
    if (err) {
      res.status(200).send("LogixMail API Server is running. Frontend build in progress...");
    }
  });
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
app.listen(CONFIG.PORT, "0.0.0.0", () => {
  console.log(`[Server] LogixMail Server listening on http://127.0.0.1:${CONFIG.PORT}`);
  console.log(`[Server] Routed via cloudflared on https://email.logixsoft.in`);
  startSSEHeartbeatAndWatcher();
});
