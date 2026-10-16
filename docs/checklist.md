# IPL Auction Simulator — Implementation Checklist

## Phase 1: Workspace & Core Configuration
- [x] Workspace verification and monorepo setup (`apps/ipl-auction/web` and `apps/ipl-auction/api`).
- [x] Configure `api/package.json` with Hono, Cloudflare Workers types, Drizzle ORM, Zod, Better Auth.
- [x] Configure `web/package.json` with Next.js 16, React 19, Tailwind CSS, Lucide React, Zustand, TanStack Query, Radix UI.
- [x] Setup `api/wrangler.toml` with D1, Durable Objects, SQLite migration tags, and Workers AI bindings.
- [x] Setup `web/wrangler.toml` and OpenNext configuration.

## Phase 2: Authentic IPL 2026 Dataset & Ingestion Pipeline
- [x] D1 database schema (`players`, `player_sets`, `franchises`, `rulesets`, `room_metadata`, `audit_logs`).
- [x] Built-in authentic IPL 2026 sets seed catalog (BA1, AL1, WK1, FA1, SP1, UBA1, UAL1, etc.) with real players (Cameron Green, Quinton de Kock, Devon Conway, David Miller, etc.).
- [x] Ingestion pipeline with validation, duplicate detection, pagination tracker, and error logging.
- [x] Role-normalized hidden ratings calculator (strict privacy: hidden individual ratings, team average after $\ge 3$ players).

## Phase 3: Cloudflare Durable Object Room Engine (`AuctionRoomDO`)
- [x] SQLite schema inside DO (`room_state`, `room_members`, `room_teams`, `auction_lots`, `bids`, `chat_messages`, `ai_decisions`).
- [x] Authoritative state transitions: PENDING -> ACTIVE -> SOLD / UNSOLD.
- [x] 10-second timer countdown and reset on valid bid using DO alarms (`ctx.storage.setAlarm`).
- [x] No-human presence detection: auto-freeze timer when 0 humans remain, auto-resume on reconnect.
- [x] Host controls: Pause, Resume, End auction, assign teams.

## Phase 4: Clef-Flash Workers AI & AI Bidding Engine
- [x] Cloudflare `@cf/cloudflare/clef-flash` typed decision integration (`noul` for should_bid, `choice` for bidder).
- [x] Compact state generation (hidden valuation, squad shortages, future scarcity, difficulty).
- [x] Realism delay scheduling and authoritative bid validation.
- [x] Deterministic fallback bidder when Workers AI is slow, offline, or local.

## Phase 5: WebSockets, Real-time Multiplayer & Chat
- [x] WebSocket Hibernation API handlers (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`).
- [x] Typed WebSocket protocol (Commands & Server Events with Zod validation).
- [x] Real-time state broadcasting with versioning, sequence numbers, and snapshot recovery.
- [x] Real-time chat with franchise badges, unread tracking, and auto-scroll.
- [x] Real-time activity event stream.

## Phase 6: Modern Compact UI & Responsive Layouts
- [x] 3-Column Desktop Grid (`25fr 45fr 30fr`) with independent scrollable regions and viewport constraint (`100dvh`).
- [x] Left column (25%): 10 Franchise accordions, purse remaining, overseas slot indicator, team average rating.
- [x] Center column (45%): Main auction card, 10s countdown, legal bid increment, visible Bid button, sold/unsold alerts.
- [x] Right column (30%): Activity feed & Live Chat tabs.
- [x] Upcoming players drawer/sheet with set grouping, search, and filters.
- [x] Mobile bottom navigation: `[TEAMS] | [AUCTION] | [ACTIVITY]` with persistent WebSocket connection.
- [x] CSS-only text placeholders (`<TeamIdentity />` and `<PlayerIdentity />`).

## Phase 7: Voice Announcements & Sound Architecture
- [x] Auctioneer announcements for lot start, new bids, sold/unsold, pause/resume.
- [x] Latest-event-wins cancellation (`speechSynthesis.cancel()`, AbortController).
- [x] Monotonic sequence validation, mute controls, volume slider, autoplay resume.

## Phase 8: Authentication & Guest Linking
- [x] Better Auth setup with Google OAuth and secure guest sessions.
- [x] Guest-to-account linking preserving room ownership, team claim, and history upon sign-in.
- [x] Server-enforced admin role checks (`role = 'admin'`).

## Phase 9: Admin Dashboard (`/admin`)
- [x] 12 Admin sections: Dashboard, Users, Rooms (live pause/resume/end), Teams, Players (CRUD + Import), Sets, Rulesets, Auctions, Chat, AI, Settings, Audit Logs.
- [x] Responsive data tables with search, sort, filter, pagination, and confirmation dialogs.

## Phase 10: Testing, Verification & Production Build
- [x] Vitest unit & integration tests (timer countdown, accepted bid reset, sold/unsold settlement, 0-human pause, guest linking, rating privacy).
- [x] Typecheck and linting across web and api.
- [x] Full production build verified with Next.js 16 and OpenNext.
