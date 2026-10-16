-- Better Auth Tables
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_identities (
  id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  claimed_franchise TEXT,
  linked_user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- Core Auction Tables
CREATE TABLE IF NOT EXISTS franchises (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  default_purse INTEGER NOT NULL DEFAULT 1200000000,
  min_squad INTEGER NOT NULL DEFAULT 18,
  max_squad INTEGER NOT NULL DEFAULT 25,
  max_overseas INTEGER NOT NULL DEFAULT 8,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  is_overseas INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  batting_style TEXT,
  bowling_style TEXT,
  base_price INTEGER NOT NULL,
  matches INTEGER NOT NULL DEFAULT 0,
  runs INTEGER NOT NULL DEFAULT 0,
  batting_average REAL NOT NULL DEFAULT 0,
  strike_rate REAL NOT NULL DEFAULT 0,
  wickets INTEGER NOT NULL DEFAULT 0,
  economy REAL NOT NULL DEFAULT 0,
  is_capped INTEGER NOT NULL DEFAULT 1,
  hidden_rating_batting REAL NOT NULL DEFAULT 50,
  hidden_rating_bowling REAL NOT NULL DEFAULT 50,
  hidden_rating_keeping REAL NOT NULL DEFAULT 50,
  hidden_rating_overall REAL NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_sets (
  id TEXT PRIMARY KEY,
  set_number INTEGER NOT NULL,
  set_code TEXT NOT NULL UNIQUE,
  set_name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS player_set_members (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES player_sets(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  order_in_set INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rulesets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'MEGA',
  starting_purse INTEGER NOT NULL DEFAULT 1200000000,
  min_squad INTEGER NOT NULL DEFAULT 18,
  max_squad INTEGER NOT NULL DEFAULT 25,
  max_overseas INTEGER NOT NULL DEFAULT 8,
  timer_seconds INTEGER NOT NULL DEFAULT 10,
  bid_increment_rules_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_metadata (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  creator_is_guest INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'LOBBY',
  ruleset_id TEXT REFERENCES rulesets(id),
  ruleset_snapshot_json TEXT NOT NULL,
  ai_difficulty TEXT NOT NULL DEFAULT 'normal',
  voice_enabled INTEGER NOT NULL DEFAULT 1,
  spectator_allowed INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE IF NOT EXISTS completed_auctions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  total_purse_spent INTEGER NOT NULL,
  total_players_sold INTEGER NOT NULL,
  total_players_unsold INTEGER NOT NULL,
  summary_json TEXT NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT,
  ip_address TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  total_pages INTEGER NOT NULL DEFAULT 0,
  pages_success INTEGER NOT NULL DEFAULT 0,
  pages_failed INTEGER NOT NULL DEFAULT 0,
  total_imported INTEGER NOT NULL DEFAULT 0,
  logs_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS application_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Seed default Admin and standard User accounts
INSERT OR IGNORE INTO users (id, name, email, email_verified, image, role, created_at, updated_at)
VALUES 
  ('admin_super', 'IPL Commissioner (Admin)', 'admin@ipl-auction.local', 1, NULL, 'admin', 1700000000000, 1700000000000),
  ('user_player', 'Cricket Strategist', 'player@ipl-auction.local', 1, NULL, 'user', 1700000000000, 1700000000000);
