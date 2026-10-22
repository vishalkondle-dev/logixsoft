-- Schema for LogixMail Cloudflare D1 Database

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user' NOT NULL,
  disabled INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mailboxes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  domain_id TEXT REFERENCES domains(id) ON DELETE CASCADE,
  local_part TEXT NOT NULL,
  display_name TEXT,
  type TEXT DEFAULT 'personal',
  disabled INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mailbox_aliases (
  id TEXT PRIMARY KEY NOT NULL,
  mailbox_id TEXT NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  local_part TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  mailbox_id TEXT REFERENCES mailboxes(id) ON DELETE SET NULL,
  direction TEXT DEFAULT 'inbound' NOT NULL,
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  cc_addr TEXT,
  bcc_addr TEXT,
  subject TEXT,
  snippet TEXT,
  text_body TEXT,
  html_body TEXT,
  raw_r2_key TEXT,
  status TEXT DEFAULT 'received' NOT NULL,
  thread_id TEXT,
  read INTEGER DEFAULT 0 NOT NULL,
  starred INTEGER DEFAULT 0 NOT NULL,
  in_reply_to TEXT,
  spam_verdict TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL
);

-- Indexes for ultra-fast querying
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_starred ON messages(starred);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
CREATE INDEX IF NOT EXISTS idx_mailboxes_user ON mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_aliases_mailbox ON mailbox_aliases(mailbox_id);

-- Initial Domain Seed
INSERT OR IGNORE INTO domains (id, hostname, created_at)
VALUES ('dom_logixsoft_in', 'logixsoft.in', 1729600000);

-- Initial Users Seed
-- Admin: admin@logixsoft.in (Password: Vammavg@1605)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, disabled, created_at)
VALUES (
  'usr_admin_logixsoft',
  'admin@logixsoft.in',
  '$2b$10$H.rv5RMcDoroBw/5GyVV8.xqfQ8SZGTi7n6KnB40/TpUcbmkgCr8O',
  'Admin',
  'admin',
  0,
  1729600000
);

-- Agent: agent@logixsoft.in (Password: Agent@123)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, disabled, created_at)
VALUES (
  'usr_agent_logixsoft',
  'agent@logixsoft.in',
  '$2b$10$bMeplV6TD2KC.H8khRmkVOF2727Rz/D1.Tw4SYqULNwW9b1ySmRBm',
  'Support Agent',
  'user',
  0,
  1729600000
);

-- Initial Mailboxes & Aliases
INSERT OR IGNORE INTO mailboxes (id, user_id, domain_id, local_part, display_name, type, disabled, created_at)
VALUES 
  ('mbx_admin', 'usr_admin_logixsoft', 'dom_logixsoft_in', 'admin', 'Admin Team', 'personal', 0, 1729600000),
  ('mbx_agent', 'usr_agent_logixsoft', 'dom_logixsoft_in', 'agent', 'Support Agent', 'personal', 0, 1729600000),
  ('mbx_support', 'usr_admin_logixsoft', 'dom_logixsoft_in', 'support', 'Support Desk', 'custom', 0, 1729600000),
  ('mbx_info', 'usr_admin_logixsoft', 'dom_logixsoft_in', 'info', 'General Info', 'custom', 0, 1729600000);

-- Welcome Email Seed
INSERT OR IGNORE INTO messages (
  id, user_id, mailbox_id, direction, from_addr, to_addr, subject, snippet, 
  text_body, html_body, status, read, starred, created_at
) VALUES (
  'msg_welcome_1',
  'usr_admin_logixsoft',
  'mbx_admin',
  'inbound',
  'system@cloudflare.com',
  'admin@logixsoft.in',
  'Welcome to LogixMail on Cloudflare Workers',
  'Your custom domain webmail suite is now fully active with unlimited addresses on logixsoft.in.',
  'Welcome to LogixMail! Your Cloudflare edge webmail is running with D1 database, R2 storage, and Workers Email Routing.',
  '<div style="font-family: sans-serif; line-height: 1.6; color: #1f2937;">
    <h2 style="color: #0ca678;">Welcome to LogixMail</h2>
    <p>Your Cloudflare edge email system on <strong>logixsoft.in</strong> is active and healthy!</p>
    <ul>
      <li><strong>Cloudflare D1:</strong> Edge serverless database</li>
      <li><strong>Cloudflare R2:</strong> Zero-egress storage for attachments & raw MIME</li>
      <li><strong>Email Routing:</strong> Unlimited catch-all routing for any @logixsoft.in address</li>
      <li><strong>Email Sending:</strong> High-deliverability outbound sending</li>
    </ul>
    <p>Enjoy your new edge webmail suite!</p>
  </div>',
  'received',
  0,
  1,
  1729600000
);
