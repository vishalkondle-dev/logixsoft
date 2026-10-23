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
  avatar_url TEXT,
  status_message TEXT,
  bio TEXT,
  signature TEXT,
  sound_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Better Auth Core Tables
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  status_message TEXT,
  bio TEXT,
  signature TEXT,
  sound_enabled INTEGER DEFAULT 1,
  disabled INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

-- Sync trigger: keep Better Auth 'user' table synchronized with 'users' table
CREATE TRIGGER IF NOT EXISTS sync_user_to_users
AFTER INSERT ON user
BEGIN
  INSERT OR IGNORE INTO users (id, email, password_hash, name, role, disabled, created_at)
  VALUES (NEW.id, NEW.email, 'better_auth', NEW.name, COALESCE(NEW.role, 'user'), COALESCE(NEW.disabled, 0), NEW.created_at);
END;

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
  clef_analysis TEXT,
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

CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS message_labels (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE(message_id, label_id)
);

-- Per-user message state (user-specific trashed, deleted_permanently, junk)
CREATE TABLE IF NOT EXISTS user_message_status (
  user_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, message_id)
);

-- Indexes for ultra-fast querying
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_starred ON messages(starred);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
CREATE INDEX IF NOT EXISTS idx_mailboxes_user ON mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_aliases_mailbox ON mailbox_aliases(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_message_labels_msg ON message_labels(message_id);
CREATE INDEX IF NOT EXISTS idx_message_labels_lbl ON message_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_labels_user ON labels(user_id);

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
