# IPL Auction Simulator — Architecture & Technical Specification

## 1. System Overview & Monorepo Structure

The IPL Auction Simulator is architected as a Cloudflare-first, high-density, real-time multiplayer application designed for live cricket auctions. The workspace organizes the system into two focused packages under `apps/ipl-auction/`:

```text
apps/ipl-auction/
├── api/                                # Cloudflare Worker + Durable Objects + D1 + Workers AI
│   ├── src/
│   │   ├── index.ts                    # Hono app entry point, routing, WebSocket upgrade
│   │   ├── durable-objects/
│   │   │   └── AuctionRoomDO.ts        # Authoritative room state machine, SQLite, timer alarms, WebSockets
│   │   ├── ai/
│   │   │   ├── clefFlash.ts            # @cf/cloudflare/clef-flash typed decision runner
│   │   │   ├── valuation.ts            # Hidden rating & franchise valuation heuristics
│   │   │   └── fallbackEngine.ts       # Deterministic rule-based fallback bidder
│   │   ├── auth/
│   │   │   ├── index.ts                # Better Auth configuration (Google OAuth + Guest sessions)
│   │   │   └── guestLinking.ts         # Identity migration and ownership preservation
│   │   ├── routes/
│   │   │   ├── rooms.ts                # Room creation, metadata, listing
│   │   │   ├── players.ts              # Player exploration, set ordering, search
│   │   │   ├── admin.ts                # Protected admin CRUD, live room control, audit logs
│   │   │   ├── import.ts               # Player ingestion pipeline & dataset management
│   │   │   └── auth.ts                 # Auth endpoints
│   │   ├── db/
│   │   │   ├── schema.ts               # D1 relational schema (Drizzle ORM)
│   │   │   └── seedData.ts             # Authentic IPL 2026 sets & player catalog
│   │   └── services/
│   │       ├── audioAnnouncements.ts   # Auctioneer voice phrase generator & sequence tracking
│   │       └── ratingService.ts        # Role-normalized ratings & squad average calculator
│   ├── wrangler.toml                   # Worker config, D1, DO migrations, Workers AI binding
│   └── package.json
└── web/                                # Next.js 16 (App Router), OpenNext for Cloudflare
    ├── app/
    │   ├── layout.tsx                  # Root layout, theme provider, query client, sound manager
    │   ├── page.tsx                    # Landing, lobby, join/create room modal, quick play
    │   ├── room/
    │   │   └── [roomId]/
    │   │       └── page.tsx            # Live Auction view (25/45/30 Desktop, Mobile Bottom Nav)
    │   └── admin/                      # Admin control center
    │       ├── layout.tsx              # Admin shell, sidebar, audit log banner
    │       ├── dashboard/page.tsx      # Metrics, active rooms, AI requests, quick stats
    │       ├── rooms/page.tsx          # Live room monitor, pause/resume/end actions
    │       ├── players/page.tsx        # Player table, CRUD, CSV/JSON import, stats, ratings
    │       ├── sets/page.tsx           # Set management & sequence inspection
    │       ├── teams/page.tsx          # Franchise budgets, limits, AI strategy settings
    │       ├── rulesets/page.tsx       # Bidding rules, purse presets, squad constraints
    │       ├── auctions/page.tsx       # Past auction history & completed squad logs
    │       ├── chat/page.tsx           # Live chat moderation
    │       ├── ai/page.tsx             # Clef-Flash prompt tuning & difficulty profiles
    │       ├── users/page.tsx          # User & role management
    │       ├── settings/page.tsx       # App flags & runtime configuration
    │       └── audit-logs/page.tsx     # Admin security and action audit trails
    ├── components/
    │   ├── auction/
    │   │   ├── AuctionWorkspace.tsx    # Center 45% workspace, current lot, timer, legal bids
    │   │   ├── BidControls.tsx         # Immediate action bid button, next bid increment
    │   │   ├── TimerDisplay.tsx        # Authoritative 10-second countdown with sync offset
    │   │   ├── UpcomingSetsDialog.tsx  # Drawer/sheet for set-wise player exploration
    │   │   └── PlayerIdentity.tsx      # CSS-only player badge & stats representation
    │   ├── teams/
    │   │   ├── TeamAccordions.tsx      # Left 25% teams list, purse, role squad breakdown
    │   │   ├── TeamIdentity.tsx        # CSS-only franchise typography & palette badge
    │   │   └── TeamAverageRating.tsx   # Displays rating after >=3 purchases (hidden individual)
    │   ├── activity/
    │   │   └── ActivityFeed.tsx        # Right 30% real-time auction event stream
    │   ├── chat/
    │   │   └── LiveChat.tsx            # Right 30% real-time WebSocket chat, unread badge, autoscroll
    │   ├── voice/
    │   │   └── VoiceManager.tsx        # Latest-event-wins audio synthesis with instant cancellation
    │   └── ui/                         # shadcn/ui & Radix compact components
    ├── hooks/
    │   ├── useAuctionRoom.ts           # WebSocket connection, state versioning, reconnect logic
    │   ├── useAuctionVoice.ts          # Speech synthesis controller with sequence abort
    │   └── useSyncTimer.ts             # Drift-free local countdown based on server timestamps
    ├── stores/
    │   └── auctionStore.ts             # Zustand room snapshot & selective updates
    ├── lib/
    │   ├── api.ts                      # Fetch client for API Worker
    │   ├── utils.ts                    # Compact formatting, currency (₹ Crores/Lakhs)
    │   └── types.ts                    # Shared protocol contracts & command schemas
    ├── wrangler.toml                   # OpenNext Cloudflare deployment config
    └── package.json
```

---

## 2. Authoritative Real-Time Architecture

### Durable Object (`AuctionRoomDO`)
Each auction room is governed by a single dedicated Cloudflare Durable Object instance with persistent SQLite storage:
1. **Single Source of Truth**: All mutations (bidding, lot advancement, timer transitions, chat, presence) must execute through the DO.
2. **WebSockets with Hibernation**: Client connections use `ctx.acceptWebSocket(ws)` and tags. Sleeping DOs wake on WebSocket message or alarm.
3. **SQLite Persistence**: State persists atomically across restarts:
   - `room_state`: Current phase, active lot ID, current bid, leader franchise, server timestamp, state version.
   - `room_members`: Session IDs, user IDs, claimed franchise, connection state, last ping.
   - `room_teams`: Franchise budgets, player counts, overseas counts, AI/human flag.
   - `auction_lots`: Source set order, lot order, player ID, status (PENDING, ACTIVE, SOLD, UNSOLD), winning price, winning franchise.
   - `bids`: Complete audit trail of every accepted bid, timestamp, bidder, amount.
   - `chat_messages`: Ordered message log with user ID, franchise, text, timestamp.
4. **Alarms for Timer Expiry**: When a player is put up or a bid accepted, `ctx.storage.setAlarm(deadlineTimestamp)` is invoked. When alarm fires, the DO authoritatively settles the lot as SOLD or UNSOLD.

### No-Human Presence Rule & Grace Period
- If `connectedHumanCount == 0`:
  1. The DO freezes the countdown, capturing `remainingMs = deadline - Date.now()`.
  2. Cancels pending AI bid timers.
  3. Records `pause_reason = "NO_HUMANS_CONNECTED"`.
  4. Broadcasts `AUCTION_PAUSED` with reason.
- When any human reconnects:
  1. If paused due to `NO_HUMANS_CONNECTED`, computes `newDeadline = Date.now() + remainingMs`.
  2. Resumes alarm and broadcasts `AUCTION_RESUMED`.
  3. Manual pauses by room creator or admin require explicit host resume action.

---

## 3. Clef-Flash AI Decision Engine

### Integration Protocol
When a new lot opens or a bid is accepted:
1. DO evaluates which AI franchises are legally eligible (have sufficient purse, squad space, overseas slot).
2. If eligible AI teams exist, the DO prepares a compact JSON state:
   - `player`: role, basePrice, isOverseas, hiddenRating, roleScarcity.
   - `auction`: currentBid, nextLegalBid, phase, lotsRemaining.
   - `teams`: per-team budget, remaining squad need, role shortage, aggressiveness.
3. Invokes `@cf/cloudflare/clef-flash` using typed questions:
   ```typescript
   {
     model: "clef-flash",
     state: JSON.stringify(decisionState),
     questions: {
       should_bid: {
         type: "noul",
         instructions: "Should an eligible AI franchise place the next legal bid?"
       },
       bidder: {
         type: "choice",
         instructions: "Which eligible AI franchise has the strongest reason to bid?",
         criteria: eligibleFranchiseCriteria
       }
     }
   }
   ```
4. If Clef-Flash decides `should_bid === "yes"` and specifies a `bidder`:
   - Checks if state version matches.
   - Schedules bid submission with realistic human-like jitter (1.2s to 3.8s) before the 10s deadline.
   - Submits through the exact same `placeBid()` validation engine.
5. **Deterministic Fallback**: If Workers AI latency exceeds 2.5s or encounters an error, a heuristic fallback determines bid actions immediately.

---

## 4. IPL 2026 Dataset & Set Preservation

1. **Set Organization**:
   - Set 1: BA1 (Capped Batters — Green, Conway, Fraser-McGurk, Miller, Shaw, etc.)
   - Set 2: AL1 (Capped All-rounders — Livingstone, Hasaranga, V. Iyer, Ravindra, etc.)
   - Set 3: WK1 (Capped Wicketkeepers — de Kock, Allen, Bairstow, Gurbaz, etc.)
   - Set 4: FA1 (Capped Fast Bowlers — Coetzee, Pathirana, Nortje, Henry, etc.)
   - Set 5: SP1 (Capped Spinners — Bishnoi, Theekshana, Chahar, Hosein, etc.)
   - Sets 6–10: Uncapped Sets (UBA1, UAL1, UWK1, UFA1, USP1)
   - Subsequent sets: Accelerated and specialized rounds.
2. **Hidden Ratings Privacy**:
   - `battingRating`, `bowlingRating`, `keepingRating`, `overallRating` calculated from verified stats.
   - Ratings are **never** included in client-facing API responses or WebSocket broadcasts.
   - Once a franchise purchases $\ge 3$ players, the server computes $\text{Team Average} = \frac{1}{N}\sum \text{Player Rating}$ and broadcasts only the aggregate team rating.

---

## 5. UI Layout Specifications

- **Desktop (Viewport $\ge 1024$px)**:
  - Three columns: `grid-template-columns: 25fr 45fr 30fr; height: 100dvh`.
  - Column 1 (25%): 10 Franchise accordions with squad limits, purse, overseas counter, and team ratings.
  - Column 2 (45%): Main auction card, big countdown timer, current bid, next bid button, upcoming players sheet launcher.
  - Column 3 (30%): Tabbed Activity Feed & Live Chat with sticky input and unread indicator.
- **Mobile (Viewport $< 1024$px)**:
  - Fixed bottom navigation bar: `[TEAMS] | [AUCTION] | [ACTIVITY]`.
  - Auction tab is default. Bid controls positioned above bottom bar with safe-area spacing.
  - Persistent WebSocket connection across tab changes.

---

## 6. Voice Announcements (Latest-Event-Wins)

- Monotonic sequence identifier `announcementSeq`.
- Whenever an announcement arrives:
  1. `window.speechSynthesis.cancel()`.
  2. Pending audio tags or fetch streams aborted via `AbortController`.
  3. Stale sequence IDs discarded.
  4. Only the newest announcement plays.
