import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// --- Better Auth Schema Tables ---
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"), // "user" | "admin"
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const guestIdentities = sqliteTable("guest_identities", {
  id: text("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  displayName: text("display_name").notNull(),
  claimedFranchise: text("claimed_franchise"),
  linkedUserId: text("linked_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// --- Franchise Definitions ---
export const franchises = sqliteTable("franchises", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // CSK, MI, RCB, KKR, SRH, DC, RR, GT, LSG, PBKS
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  defaultPurse: integer("default_purse").notNull().default(1200000000), // ₹120 Crore (in Rupees)
  minSquad: integer("min_squad").notNull().default(18),
  maxSquad: integer("max_squad").notNull().default(25),
  maxOverseas: integer("max_overseas").notNull().default(8),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// --- Player Database & Hidden Ratings ---
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  isOverseas: integer("is_overseas", { mode: "boolean" }).notNull().default(false),
  role: text("role").notNull(), // "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER"
  battingStyle: text("batting_style"),
  bowlingStyle: text("bowling_style"),
  basePrice: integer("base_price").notNull(), // in Rupees (e.g. 20000000 for 2 Cr)
  matches: integer("matches").notNull().default(0),
  runs: integer("runs").notNull().default(0),
  battingAverage: real("batting_average").notNull().default(0),
  strikeRate: real("strike_rate").notNull().default(0),
  wickets: integer("wickets").notNull().default(0),
  economy: real("economy").notNull().default(0),
  isCapped: integer("is_capped", { mode: "boolean" }).notNull().default(true),
  // Hidden ratings (never exposed publicly in client APIs)
  hiddenRatingBatting: real("hidden_rating_batting").notNull().default(50),
  hiddenRatingBowling: real("hidden_rating_bowling").notNull().default(50),
  hiddenRatingKeeping: real("hidden_rating_keeping").notNull().default(50),
  hiddenRatingOverall: real("hidden_rating_overall").notNull().default(50),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// --- Auction Sets & Ordering ---
export const playerSets = sqliteTable("player_sets", {
  id: text("id").primaryKey(),
  setNumber: integer("set_number").notNull(),
  setCode: text("set_code").notNull().unique(), // e.g., "BA1", "AL1", "WK1", "FA1", "SP1"
  setName: text("set_name").notNull(),
  displayOrder: integer("display_order").notNull(),
  description: text("description"),
});

export const playerSetMembers = sqliteTable("player_set_members", {
  id: text("id").primaryKey(),
  setId: text("set_id").notNull().references(() => playerSets.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  orderInSet: integer("order_in_set").notNull(),
});

// --- Rulesets ---
export const rulesets = sqliteTable("rulesets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("MEGA"), // "MEGA" | "MINI" | "CUSTOM"
  startingPurse: integer("starting_purse").notNull().default(1200000000),
  minSquad: integer("min_squad").notNull().default(18),
  maxSquad: integer("max_squad").notNull().default(25),
  maxOverseas: integer("max_overseas").notNull().default(8),
  timerSeconds: integer("timer_seconds").notNull().default(10),
  bidIncrementRulesJson: text("bid_increment_rules_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// --- Room Metadata & Global Auction Records ---
export const roomMetadata = sqliteTable("room_metadata", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  creatorId: text("creator_id").notNull(),
  creatorIsGuest: integer("creator_is_guest", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("LOBBY"), // "LOBBY" | "LIVE" | "PAUSED" | "ENDED"
  rulesetId: text("ruleset_id").notNull().references(() => rulesets.id),
  rulesetSnapshotJson: text("ruleset_snapshot_json").notNull(),
  aiDifficulty: text("ai_difficulty").notNull().default("normal"), // "easy" | "normal" | "hard"
  voiceEnabled: integer("voice_enabled", { mode: "boolean" }).notNull().default(true),
  spectatorAllowed: integer("spectator_allowed", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
});

export const completedAuctions = sqliteTable("completed_auctions", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  totalPurseSpent: integer("total_purse_spent").notNull(),
  totalPlayersSold: integer("total_players_sold").notNull(),
  totalPlayersUnsold: integer("total_players_unsold").notNull(),
  summaryJson: text("summary_json").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
});

// --- Administration & Auditing ---
export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  detailsJson: text("details_json"),
  ipAddress: text("ip_address"),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
});

export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  status: text("status").notNull().default("PENDING"),
  totalPages: integer("total_pages").notNull().default(0),
  pagesSuccess: integer("pages_success").notNull().default(0),
  pagesFailed: integer("pages_failed").notNull().default(0),
  totalImported: integer("total_imported").notNull().default(0),
  logsJson: text("logs_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const applicationSettings = sqliteTable("application_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
