import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { CONFIG } from "./config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { queryD1, executeD1 } from "./d1";
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
app.get("/api/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folder = (req.query.folder as string) || "inbox";
    const alias = req.query.alias as string;
    const search = req.query.search as string;

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

    const messages = await queryD1(sql, params);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/messages/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const messages = await queryD1(`SELECT * FROM messages WHERE id = ? LIMIT 1`, [id]);
    if (!messages || messages.length === 0) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const message = messages[0];

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
    await executeD1(`UPDATE messages SET status = 'trashed' WHERE id = ?`, [id]);
    broadcastSSE("message_updated", { id, status: "trashed" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SEND EMAIL
// ----------------------------------------------------
app.post("/api/messages/send", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromAddress, fromName, to, cc, bcc, subject, html, text, inReplyTo, referencesHeader } = req.body;

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
    const { prompt, tone, recipient } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    const draft = await draftEmailWithAI(prompt, tone || "professional", recipient);
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
// STATIC FRONTEND ASSETS
// ----------------------------------------------------
const clientDistPath = path.resolve(__dirname, "../../dist/client");
app.use(express.static(clientDistPath));

app.use((req: Request, res: Response) => {
  // If API route not found, 404
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "Endpoint not found" });
    return;
  }
  // Otherwise serve React SPA index.html
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) {
      res.status(200).send("LogixMail API Server is running. Frontend build in progress...");
    }
  });
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
app.listen(CONFIG.PORT, "0.0.0.0", () => {
  console.log(`🚀 LogixMail Server listening on http://127.0.0.1:${CONFIG.PORT}`);
  console.log(`🌐 Routed via cloudflared on https://email.logixsoft.in`);
  startSSEHeartbeatAndWatcher();
});
