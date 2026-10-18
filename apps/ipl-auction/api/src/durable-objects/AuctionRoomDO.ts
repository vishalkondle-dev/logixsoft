import { DurableObject } from "cloudflare:workers";
import {
  AuctionPhase,
  AuctionLot,
  FranchiseState,
  AuctionEvent,
  ChatMessage,
  RoomSnapshot,
  ClientCommand,
  ServerMessage,
  RetainedPlayerInfo,
  RTMState,
  MemberPresence,
  calculateNextLegalBid,
  getBidIncrement,
} from "../types/auction";
import {
  SEED_FRANCHISES,
  SEED_PLAYERS,
  SEED_SETS,
  OFFICIAL_FRANCHISE_RETENTIONS,
  RetentionCandidate,
  calculateRetentionDeduction,
  computeDynamicAuctionLots,
} from "../db/seedData";
import { calculateTeamAverageRating, calculateTeamOverallRating } from "../services/ratingService";
import { evaluateRosterBalance } from "../services/rosterBalanceService";
import { AudioAnnouncementService } from "../services/audioAnnouncements";
import { ClefFlashService, RTMDecisionContext } from "../ai/clefFlash";
import { calculatePlayerValuation } from "../ai/valuation";

export interface Env {
  AUCTION_ROOM: DurableObjectNamespace<AuctionRoomDO>;
  DB: D1Database;
  AI?: any;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export class AuctionRoomDO extends DurableObject<Env> {
  private roomId: string = "";
  private roomName: string = "IPL 2026 Live Auction";
  private creatorId: string = "host";
  private status: AuctionPhase = "LOBBY";
  private stateVersion: number = 1;
  private eventSequence: number = 1;
  private pauseReason: string | null = null;
  private timerDeadline: number | null = null;
  private currentTimerDurationMs: number = 18000;
  private remainingMsAtPause: number = 18000;
  private activeLotIndex: number = -1;
  private aiDifficulty: "easy" | "normal" | "hard" = "normal";
  private voiceEnabled: boolean = true;
  private isPublic: boolean = true;
  private creatorTeam: string | null = null;
  private bannedUserIds: Set<string> = new Set();

  private members: Map<string, MemberPresence> = new Map();
  private teams: Map<string, FranchiseState> = new Map();
  private lots: AuctionLot[] = [];
  private events: AuctionEvent[] = [];
  private chatMessages: ChatMessage[] = [];
  private aiPendingTimer: any = null;
  private activeTimer: any = null;
  private transitionTimer: any = null;
  private transitionDeadline: number = 0;
  private enableRetentions: boolean = true;
  private ruleset: "MEGA" | "CLASSIC" | "SPRINT_XI" = "MEGA";
  private rtmState: RTMState | null = null;
  private rtmTimer: any = null;
  private socketIps: Map<WebSocket, { clientIp: string; ipUserId: string }> = new Map();
  private socketSessionIds: Map<WebSocket, string> = new Map();
  private recentJoinTimes: Map<string, number> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.initDatabase();
      this.loadStateFromStorage();
    });
  }

  // --- SQLite Initialization ---
  private initDatabase() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS room_teams (
        code TEXT PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auction_lots (
        lot_number INTEGER PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchased_players (
        player_id TEXT PRIMARY KEY,
        franchise_code TEXT NOT NULL,
        lot_number INTEGER NOT NULL,
        price INTEGER NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auction_events (
        sequence INTEGER PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        sequence INTEGER PRIMARY KEY,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS banned_users (
        user_id TEXT PRIMARY KEY,
        banned_at INTEGER NOT NULL
      );
    `);
  }

  // --- State Hydration ---
  private loadStateFromStorage() {
    const stateRows = this.ctx.storage.sql.exec<{ key: string; value: string }>(
      "SELECT key, value FROM room_state"
    ).toArray();

    const stateMap = new Map<string, string>();
    for (const r of stateRows) stateMap.set(r.key, r.value);

    if (stateMap.has("roomId")) {
      this.roomId = stateMap.get("roomId")!;
      this.roomName = stateMap.get("roomName") || this.roomName;
      this.creatorId = stateMap.get("creatorId") || this.creatorId;
      this.status = (stateMap.get("status") as AuctionPhase) || "LOBBY";
      this.stateVersion = parseInt(stateMap.get("stateVersion") || "1", 10);
      this.eventSequence = parseInt(stateMap.get("eventSequence") || "1", 10);
      this.activeLotIndex = parseInt(stateMap.get("activeLotIndex") || "-1", 10);
      this.aiDifficulty = (stateMap.get("aiDifficulty") as any) || "normal";
      this.isPublic = stateMap.get("isPublic") !== "false";
      this.creatorTeam = stateMap.get("creatorTeam") || null;
      this.pauseReason = stateMap.get("pauseReason") || null;
      this.remainingMsAtPause = parseInt(stateMap.get("remainingMsAtPause") || "18000", 10);
      this.currentTimerDurationMs = parseInt(stateMap.get("currentTimerDurationMs") || "18000", 10);
      const deadlineStr = stateMap.get("timerDeadline");
      this.timerDeadline = deadlineStr ? parseInt(deadlineStr, 10) : null;
      this.enableRetentions = stateMap.get("enableRetentions") !== "false";
      this.ruleset = (stateMap.get("ruleset") as any) || "MEGA";
      if (stateMap.has("rtmState") && stateMap.get("rtmState")) {
        try {
          this.rtmState = JSON.parse(stateMap.get("rtmState")!);
          if (this.rtmState && this.rtmState.active) {
            if (Date.now() >= this.rtmState.timerDeadline) {
              console.log(`[AuctionRoomDO] Restored expired RTM for lot ${this.rtmState.lotNumber}. Resolving decline.`);
              setTimeout(async () => {
                await this.resolveRTM(false, "Timeout on Restore");
              }, 100);
            } else {
              const remaining = Math.max(500, this.rtmState.timerDeadline - Date.now());
              this.ctx.storage.setAlarm(Date.now() + remaining);
              if (this.rtmTimer) clearTimeout(this.rtmTimer);
              this.rtmTimer = setTimeout(async () => {
                await this.resolveRTM(false, "Timeout");
              }, remaining);
            }
          }
        } catch {
          this.rtmState = null;
        }
      }
    }

    // Load Banned Users
    const bannedRows = this.ctx.storage.sql.exec<{ user_id: string }>(
      "SELECT user_id FROM banned_users"
    ).toArray();
    this.bannedUserIds = new Set(bannedRows.map((r) => r.user_id));

    // Load Teams
    const teamRows = this.ctx.storage.sql.exec<{ code: string; data_json: string }>(
      "SELECT code, data_json FROM room_teams"
    ).toArray();

    if (teamRows.length > 0) {
      for (const r of teamRows) {
        const teamObj = JSON.parse(r.data_json);
        if (!teamObj.retainedPlayers) teamObj.retainedPlayers = [];
        if (teamObj.retentionSpent === undefined) teamObj.retentionSpent = 0;
        if (teamObj.rtmCardsRemaining === undefined) teamObj.rtmCardsRemaining = 0;
        this.teams.set(r.code, teamObj);
      }
    } else {
      this.initializeDefaultTeams();
    }

    // Load Lots
    const lotRows = this.ctx.storage.sql.exec<{ lot_number: number; data_json: string }>(
      "SELECT lot_number, data_json FROM auction_lots ORDER BY lot_number ASC"
    ).toArray();

    if (lotRows.length > 0) {
      const parsedLots: AuctionLot[] = lotRows.map((r) => JSON.parse(r.data_json));

      // Self-heal: check for duplicate lot numbers or duplicate player IDs
      const seenPlayerIds = new Set<string>();
      const seenLotNumbers = new Set<number>();
      let needsRepair = false;

      for (const l of parsedLots) {
        if (seenPlayerIds.has(l.playerId) || seenLotNumbers.has(l.lotNumber)) {
          needsRepair = true;
          break;
        }
        seenPlayerIds.add(l.playerId);
        seenLotNumbers.add(l.lotNumber);
      }

      if (needsRepair) {
        console.log(`[AuctionRoomDO] Repairing duplicate/corrupted lots in room ${this.roomId}`);
        const uniqueLots: AuctionLot[] = [];
        const dedupPlayerIds = new Set<string>();
        for (const l of parsedLots) {
          if (!dedupPlayerIds.has(l.playerId)) {
            dedupPlayerIds.add(l.playerId);
            uniqueLots.push(l);
          }
        }
        this.ctx.storage.sql.exec("DELETE FROM auction_lots");
        uniqueLots.forEach((l, idx) => {
          l.lotNumber = idx + 1;
          l.id = `lot_${l.lotNumber}`;
          this.saveLot(l);
        });
        this.lots = uniqueLots;
      } else {
        this.lots = parsedLots;
      }
    } else {
      this.initializeDefaultLots();
    }

    // Load Recent Events
    const eventRows = this.ctx.storage.sql.exec<{ sequence: number; data_json: string }>(
      "SELECT sequence, data_json FROM auction_events ORDER BY sequence DESC LIMIT 150"
    ).toArray();
    this.events = eventRows.map((r) => JSON.parse(r.data_json)).reverse();
    if (eventRows.length > 0) {
      this.eventSequence = Math.max(this.eventSequence, ...eventRows.map((r) => r.sequence));
    }

    // Load Recent Chat
    const chatRows = this.ctx.storage.sql.exec<{ sequence: number; data_json: string }>(
      "SELECT sequence, data_json FROM chat_messages ORDER BY sequence DESC LIMIT 100"
    ).toArray();
    this.chatMessages = chatRows.map((r) => JSON.parse(r.data_json)).reverse();
  }

  private initializeDefaultTeams() {
    for (const f of SEED_FRANCHISES) {
      let totalPurse = f.defaultPurse;
      let minSquad = f.minSquad;
      let maxSquad = f.maxSquad;
      let maxOverseas = f.maxOverseas;

      if (this.ruleset === "SPRINT_XI") {
        totalPurse = 500000000; // ₹50 Cr
        minSquad = 11;
        maxSquad = 11;
        maxOverseas = 4;
      } else {
        totalPurse = 1200000000; // ₹120 Cr (Mega & Classic)
        minSquad = 18;
        maxSquad = 25;
        maxOverseas = 8;
      }

      const state: FranchiseState = {
        code: f.code,
        name: f.name,
        shortName: f.shortName,
        primaryColor: f.primaryColor,
        secondaryColor: f.secondaryColor,
        totalPurse,
        remainingPurse: totalPurse,
        squadCount: 0,
        minSquad,
        maxSquad,
        overseasCount: 0,
        maxOverseas,
        controller: "AI",
        averageRating: null,
        purchasedPlayers: [],
        rtmCardsRemaining: this.ruleset === "MEGA" ? 6 : 0,
        retainedPlayers: [],
        retentionSpent: 0,
      };
      this.teams.set(f.code, state);
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
        f.code,
        JSON.stringify(state)
      );
    }
  }

  private initializeDefaultLots() {
    const allRetainedNames = new Set<string>();
    if (this.enableRetentions) {
      for (const team of this.teams.values()) {
        for (const p of team.retainedPlayers || team.purchasedPlayers || []) {
          allRetainedNames.add(p.name.trim().toLowerCase());
        }
      }
    }

    this.lots = computeDynamicAuctionLots(SEED_PLAYERS, SEED_SETS, allRetainedNames);

    this.ctx.storage.sql.exec("DELETE FROM auction_lots");
    for (const lot of this.lots) {
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO auction_lots (lot_number, data_json) VALUES (?, ?)",
        lot.lotNumber,
        JSON.stringify(lot)
      );
    }
  }

  private refreshLotsExcludingRetentions(allRetainedNames: Set<string>) {
    this.lots = computeDynamicAuctionLots(SEED_PLAYERS, SEED_SETS, allRetainedNames);
    this.ctx.storage.sql.exec("DELETE FROM auction_lots");
    for (const lot of this.lots) {
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO auction_lots (lot_number, data_json) VALUES (?, ?)",
        lot.lotNumber,
        JSON.stringify(lot)
      );
    }
  }

  private persistState() {
    const entries: [string, string][] = [
      ["roomId", this.roomId],
      ["roomName", this.roomName],
      ["creatorId", this.creatorId],
      ["status", this.status],
      ["stateVersion", String(this.stateVersion)],
      ["eventSequence", String(this.eventSequence)],
      ["activeLotIndex", String(this.activeLotIndex)],
      ["aiDifficulty", this.aiDifficulty],
      ["isPublic", this.isPublic ? "true" : "false"],
      ["creatorTeam", this.creatorTeam || ""],
      ["pauseReason", this.pauseReason || ""],
      ["remainingMsAtPause", String(this.remainingMsAtPause)],
      ["currentTimerDurationMs", String(this.currentTimerDurationMs)],
      ["timerDeadline", this.timerDeadline ? String(this.timerDeadline) : ""],
      ["enableRetentions", this.enableRetentions ? "true" : "false"],
      ["ruleset", this.ruleset],
      ["rtmState", this.rtmState ? JSON.stringify(this.rtmState) : ""],
    ];

    for (const [k, v] of entries) {
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO room_state (key, value) VALUES (?, ?)",
        k,
        v
      );
    }
  }

  // --- RPC Methods ---
  async initRoom(
    roomId: string,
    name: string,
    creatorId: string,
    aiDifficulty: "easy" | "normal" | "hard" = "normal",
    creatorTeam?: string,
    isPublic: boolean = true,
    enableRetentions: boolean = true,
    ruleset: "MEGA" | "CLASSIC" | "SPRINT_XI" = "MEGA"
  ): Promise<void> {
    this.roomId = roomId;
    this.roomName = name;
    this.creatorId = creatorId;
    this.aiDifficulty = aiDifficulty;
    this.isPublic = isPublic;
    this.creatorTeam = creatorTeam || null;
    this.ruleset = ruleset;
    this.enableRetentions = ruleset === "SPRINT_XI" ? false : enableRetentions;

    // Reset teams with ruleset specific purse and squad limits
    this.initializeDefaultTeams();

    // Requirement 1: while creating only allow creator to choose the team
    if (creatorTeam && this.teams.has(creatorTeam)) {
      const team = this.teams.get(creatorTeam)!;
      team.controller = "HUMAN";
      team.humanUserId = creatorId;
      team.humanDisplayName = "Creator";
      team.lastActiveAt = Date.now();
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
        team.code,
        JSON.stringify(team)
      );
    }

    // Default should be 0 retentions. Lobby starts with 0 retentions for all teams.
    this.initializeDefaultLots();

    this.persistState();
  }

  private async evaluateAndApplyAIBotRetentions() {
    if (!this.enableRetentions || this.ruleset === "SPRINT_XI") {
      return;
    }

    for (const [code, franchise] of this.teams.entries()) {
      // If controller is AI and team has 0 retentions, let AI evaluate its retentions
      if (franchise.controller !== "AI" || (franchise.retainedPlayers && franchise.retainedPlayers.length > 0)) {
        continue;
      }

      const official = OFFICIAL_FRANCHISE_RETENTIONS[code];
      if (!official || !official.candidates || official.candidates.length === 0) {
        continue;
      }

      const candidatesWithRatings = official.candidates.map((c) => {
        const found = SEED_PLAYERS.find((sp) => sp.name.trim().toLowerCase() === c.name.trim().toLowerCase());
        const rating = found?.hiddenRatingOverall || 75;
        return {
          id: c.id,
          name: c.name,
          role: c.role,
          country: c.country,
          isOverseas: c.isOverseas,
          isCapped: c.isCapped,
          officialPrice: c.officialPrice,
          matches: c.matches || 0,
          runs: c.runs || 0,
          battingAverage: c.battingAverage || 0,
          strikeRate: c.strikeRate || 0,
          wickets: c.wickets || 0,
          economy: c.economy || 0,
          rating,
        };
      });

      const decision = await ClefFlashService.decideFranchiseRetentions(this.env, {
        franchise: {
          code: franchise.code,
          name: franchise.name,
          totalPurse: franchise.totalPurse,
          remainingPurse: franchise.remainingPurse,
          maxSquad: franchise.maxSquad,
          minSquad: franchise.minSquad,
          maxOverseas: franchise.maxOverseas,
        },
        candidates: candidatesWithRatings,
        ruleset: this.ruleset,
      });

      const selectedCandidates = official.candidates.filter((c) => decision.retainedIds.includes(c.id));
      const { totalDeduction, rtmCards } = calculateRetentionDeduction(selectedCandidates, this.ruleset);

      const retainedInfos: RetainedPlayerInfo[] = selectedCandidates.map((c, idx) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        country: c.country,
        isOverseas: c.isOverseas,
        isCapped: c.isCapped,
        retentionPrice: c.officialPrice,
        slotNumber: idx + 1,
      }));

      franchise.retainedPlayers = retainedInfos;
      franchise.retentionSpent = totalDeduction;
      franchise.remainingPurse = Math.max(0, franchise.totalPurse - totalDeduction);
      franchise.rtmCardsRemaining = rtmCards;
      franchise.squadCount = selectedCandidates.length;
      franchise.overseasCount = selectedCandidates.filter((c) => c.isOverseas).length;
      franchise.purchasedPlayers = retainedInfos.map((r) => {
        const found = SEED_PLAYERS.find((sp) => sp.name.trim().toLowerCase() === r.name.trim().toLowerCase());
        return {
          id: r.id,
          name: r.name,
          role: r.role,
          country: r.country,
          isOverseas: r.isOverseas,
          purchasePrice: r.retentionPrice,
          lotNumber: 0,
          soldAt: Date.now(),
          isRetained: true,
          rating: found?.hiddenRatingOverall || 75,
        };
      });

      const squadForEval = franchise.purchasedPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isOverseas: p.isOverseas,
        overallRating: p.rating || 75,
      }));
      const evalResult = calculateTeamOverallRating(squadForEval, franchise.remainingPurse, franchise.totalPurse, this.ruleset);
      if (evalResult) {
        franchise.averageRating = evalResult.overallRating;
        franchise.playersRating = evalResult.playersRating;
        franchise.squadBalanceRating = evalResult.squadBalanceRating;
        franchise.purseBalanceRating = evalResult.purseBalanceRating;
      }

      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
        franchise.code,
        JSON.stringify(franchise)
      );

      this.recordActivityEvent(
        "RETENTIONS_UPDATED",
        "Retentions Finalized",
        decision.reason,
        franchise.code
      );
    }

    // Now refresh all lots excluding ALL retained players across all teams
    const allRetainedNames = new Set<string>();
    for (const t of this.teams.values()) {
      for (const p of t.retainedPlayers || []) {
        allRetainedNames.add(p.name.trim().toLowerCase());
      }
    }
    this.refreshLotsExcludingRetentions(allRetainedNames);
  }

  async getSnapshot(recipientFranchiseCode?: string): Promise<RoomSnapshot> {
    this.checkInactivityTimeouts();
    await this.ensureActiveLotProgression();
    return this.buildSnapshot(recipientFranchiseCode);
  }

  async getLots(): Promise<AuctionLot[]> {
    return this.lots.map(({ hiddenRatingOverall, ...safe }) => safe as AuctionLot);
  }

  async executeAdminAction(
    action: "pause" | "resume" | "end" | "reset",
    reason = "ADMIN_ACTION"
  ): Promise<{ success: boolean; status: string; snapshot: RoomSnapshot }> {
    if (action === "pause") {
      await this.pauseAuction(reason);
    } else if (action === "resume") {
      await this.resumeAuction(reason);
    } else if (action === "end") {
      await this.endAuction();
    } else if (action === "reset") {
      this.status = "LOBBY";
      this.activeLotIndex = 0;
      this.timerDeadline = null;
      this.pauseReason = null;
      if (this.activeTimer) { clearTimeout(this.activeTimer); this.activeTimer = null; }
      if (this.transitionTimer) { clearTimeout(this.transitionTimer); this.transitionTimer = null; }
      if (this.aiPendingTimer) { clearTimeout(this.aiPendingTimer); this.aiPendingTimer = null; }
      this.initializeDefaultTeams();
      this.initializeDefaultLots();
      this.stateVersion++;
      this.persistState();
      this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
    }
    return { success: true, status: this.status, snapshot: this.buildSnapshot() };
  }

  async getChatMessages(): Promise<ChatMessage[]> {
    return this.chatMessages;
  }

  async deleteChatMessage(messageId: string): Promise<boolean> {
    const idx = this.chatMessages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      this.chatMessages.splice(idx, 1);
      this.broadcast({ type: "CHAT_MESSAGE_DELETED", payload: { messageId } } as any);
      return true;
    }
    return false;
  }

  async sendAdminAnnouncement(text: string): Promise<ChatMessage> {
    const chatMsg: ChatMessage = {
      id: `admin_ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sequence: ++this.eventSequence,
      timestamp: Date.now(),
      userId: "admin_super",
      displayName: "🚨 IPL COMMISSIONER (ADMIN)",
      text: text.trim().slice(0, 400),
    };
    this.chatMessages.push(chatMsg);
    if (this.chatMessages.length > 100) this.chatMessages.shift();
    this.broadcast({ type: "CHAT_MESSAGE", payload: chatMsg });
    return chatMsg;
  }

  // --- WebSocket Connection Management (Hibernation API) ---
  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const clientIp =
      request.headers.get("x-client-ip") ||
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const ipUserId = `ip_${clientIp.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    try {
      (server as any).serializeAttachment({ clientIp, ipUserId });
    } catch {}
    this.socketIps.set(server, { clientIp, ipUserId });

    // Accept server websocket with hibernation
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data: ClientCommand = JSON.parse(message as string);
      await this.handleClientCommand(ws, data);
    } catch (err: any) {
      ws.send(JSON.stringify({ type: "ERROR", payload: { message: err?.message || "Invalid command payload" } }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.socketIps.delete(ws);
    const sessId = this.socketSessionIds.get(ws);
    if (sessId && this.members.has(sessId)) {
      this.members.delete(sessId);
    }
    this.socketSessionIds.delete(ws);

    const activeSockets = this.ctx.getWebSockets().filter((s) => s !== ws && s.readyState === WebSocket.OPEN);
    if (activeSockets.length === 0) {
      for (const m of this.members.values()) {
        m.connected = false;
      }
      this.checkHumanPresenceAndAutoPause("Last User");
    } else {
      this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
    }
  }

  // --- Client Command Routing ---
  private async handleClientCommand(ws: WebSocket, command: ClientCommand): Promise<void> {
    switch (command.type) {
      case "JOIN_ROOM": {
        let attachmentInfo: { clientIp?: string; ipUserId?: string } | null = null;
        try {
          attachmentInfo = (ws as any).deserializeAttachment?.() || null;
        } catch {}
        if (!attachmentInfo) {
          attachmentInfo = this.socketIps.get(ws) || null;
        }

        const clientIp = attachmentInfo?.clientIp || "127.0.0.1";
        // User identity distinct by client IP address
        const ipUserId = attachmentInfo?.ipUserId || `ip_${clientIp.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const userId = command.userId && command.userId.startsWith("ip_") ? command.userId : ipUserId;

        // Requirement 4: Banned users cannot join
        if (this.bannedUserIds.has(userId)) {
          ws.send(JSON.stringify({
            type: "BANNED_FROM_ROOM",
            payload: { reason: "You have been banned from this room by the host." }
          }));
          ws.close(4003, "Banned by host");
          return;
        }

        this.socketSessionIds.set(ws, command.sessionId);

        let claimedFranchise = command.claimedFranchise || null;

        // Check if any team in this room already belongs to this userId
        for (const t of this.teams.values()) {
          if (t.humanUserId === userId) {
            claimedFranchise = t.code;
            t.controller = "HUMAN";
            t.lastActiveAt = Date.now();
            break;
          }
        }

        // If user sent a saved claimedFranchise from storage and that team has no other human owner, reclaim it
        if (!claimedFranchise && command.claimedFranchise) {
          const t = this.teams.get(command.claimedFranchise);
          if (t && (!t.humanUserId || t.humanUserId === userId)) {
            t.controller = "HUMAN";
            t.humanUserId = userId;
            t.humanDisplayName = command.displayName || "Player";
            t.lastActiveAt = Date.now();
            claimedFranchise = t.code;
            this.ctx.storage.sql.exec(
              "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
              t.code,
              JSON.stringify(t)
            );
          }
        }

        const presence: MemberPresence = {
          sessionId: command.sessionId,
          userId,
          displayName: command.displayName || "Participant",
          isGuest: command.isGuest,
          claimedFranchise,
          connected: true,
          lastSeen: Date.now(),
        };
        this.members.set(command.sessionId, presence);

        await this.ensureActiveLotProgression();

        // Send Authoritative Snapshot
        ws.send(JSON.stringify({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() }));

        // Identify user with deterministic IP userId
        ws.send(
          JSON.stringify({
            type: "USER_IDENTIFIED",
            payload: {
              userId,
              clientIp,
            },
          })
        );

        // Broadcast updated snapshot to all room participants
        this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });

        // Broadcast join event
        this.broadcast({
          type: "USER_CONNECTED",
          payload: {
            userId: presence.userId,
            displayName: presence.displayName,
            connectedHumanCount: this.getConnectedHumanCount(),
          },
        });

        const now = Date.now();
        const lastJoinTime = this.recentJoinTimes.get(userId) || 0;
        if (now - lastJoinTime > 120_000) {
          this.recentJoinTimes.set(userId, now);
          this.recordActivityEvent(
            "USER_CONNECTED",
            `${presence.displayName} Joined`,
            `${presence.displayName} joined the room`
          );
        }

        // Resume if paused solely because of zero human presence, only if user already has a claimed franchise
        if (this.status === "PAUSED" && this.pauseReason === "NO_HUMANS_CONNECTED") {
          if (claimedFranchise) {
            await this.resumeAuction("SYSTEM_AUTO_RESUME");
          } else {
            console.log(`[Auto-Pause Preserved] Participant ${presence.displayName} joined without a team. Waiting for team selection modal.`);
          }
        }
        break;
      }

      case "UPDATE_DISPLAY_NAME": {
        const newName = command.displayName?.trim();
        if (!newName) break;

        const targetSessionId = command.sessionId || this.socketSessionIds.get(ws);
        if (!targetSessionId) break;

        const presence = this.members.get(targetSessionId);
        if (presence) {
          const oldName = presence.displayName;
          presence.displayName = newName;

          // If user owns a team, update team's humanDisplayName
          for (const team of this.teams.values()) {
            if (team.humanUserId === presence.userId) {
              team.humanDisplayName = newName;
              this.ctx.storage.sql.exec(
                "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
                team.code,
                JSON.stringify(team)
              );
              this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
              break;
            }
          }

          if (oldName !== newName) {
            const now = Date.now();
            const lastJoinTime = this.recentJoinTimes.get(presence.userId) || 0;
            if (oldName && oldName !== "Participant" && oldName !== "Player") {
              this.recordActivityEvent(
                "USER_CONNECTED",
                `${newName}`,
                `${oldName} is now known as ${newName}`
              );
            } else if (now - lastJoinTime > 120_000) {
              this.recentJoinTimes.set(presence.userId, now);
              this.recordActivityEvent(
                "USER_CONNECTED",
                `${newName} Joined`,
                `${newName} joined the room`
              );
            }
            this.broadcast({
              type: "USER_CONNECTED",
              payload: {
                userId: presence.userId,
                displayName: newName,
                connectedHumanCount: this.getConnectedHumanCount(),
              },
            });
            this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
          }
        }
        break;
      }

      // Requirement 4 & 5: anyone can take over from bots (ONLY bots)
      case "TAKE_OVER_TEAM":
      case "CLAIM_TEAM": {
        let userId = command.userId;
        if (!userId) {
          for (const m of this.members.values()) {
            if (m.connected) {
              userId = m.userId;
              break;
            }
          }
        }
        if (!userId) return;

        if (this.bannedUserIds.has(userId)) {
          ws.send(JSON.stringify({
            type: "BANNED_FROM_ROOM",
            payload: { reason: "You have been banned from this room by the host." }
          }));
          return;
        }

        const team = this.teams.get(command.franchiseCode);
        if (!team) return;

        // RULE: Once I claim the team, I should not be able to claim a different team inside that room!
        for (const existingTeam of this.teams.values()) {
          if (
            existingTeam.code !== command.franchiseCode &&
            existingTeam.controller === "HUMAN" &&
            existingTeam.humanUserId === userId
          ) {
            ws.send(JSON.stringify({
              type: "BID_REJECTED",
              payload: {
                reason: `You have already claimed ${existingTeam.name} (${existingTeam.code}). You cannot claim a different franchise in this room.`,
                stateVersion: this.stateVersion,
              },
            }));
            return;
          }
        }

        // Requirement 4: ONLY bots can be taken over. If claimed by another human, reject!
        if (team.controller === "HUMAN" && team.humanUserId && team.humanUserId !== userId) {
          ws.send(JSON.stringify({
            type: "BID_REJECTED",
            payload: {
              reason: `${team.name} is already claimed by another participant (${team.humanDisplayName || "Human"}). You can only take over AI bot teams.`,
              stateVersion: this.stateVersion,
            },
          }));
          return;
        }

        const isTakeover = team.controller === "AI";
        team.controller = "HUMAN";
        team.humanUserId = userId;
        team.humanDisplayName = "Player";
        team.lastActiveAt = Date.now();

        for (const m of this.members.values()) {
          if (m.userId === userId) {
            m.claimedFranchise = team.code;
            team.humanDisplayName = m.displayName || team.humanDisplayName;
          }
        }

        this.ctx.storage.sql.exec(
          "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
          team.code,
          JSON.stringify(team)
        );

        this.stateVersion++;
        this.persistState();

        this.recordActivityEvent(
          "USER_CONNECTED",
          isTakeover ? "Franchise Taken Over" : "Franchise Claimed",
          `${team.humanDisplayName} took over ${team.name} (${team.code}) from AI`,
          team.code
        );

        this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
        break;
      }

      // Requirement 4: Creator can assign to bots from user
      case "REASSIGN_TO_BOT": {
        let senderId = command.userId;
        if (!senderId) {
          for (const m of this.members.values()) {
            if (m.connected) {
              senderId = m.userId;
              break;
            }
          }
        }

        const team = this.teams.get(command.franchiseCode);
        if (!team) return;

        let sIp = ws ? this.socketIps.get(ws) : null;
        if (!sIp && ws) {
          try {
            const att = (ws as any).deserializeAttachment?.();
            if (att) sIp = att;
          } catch {}
        }
        const sessId = ws ? this.socketSessionIds.get(ws) : null;
        const member = sessId ? this.members.get(sessId) : null;
        const memberUserId = member ? member.userId : null;
        const effectiveUserId = senderId || memberUserId || (sIp ? sIp.ipUserId : null);

        const isOwnerOfTeam = Boolean(
          (member && member.claimedFranchise === command.franchiseCode) ||
          (team.humanUserId && (
            team.humanUserId === senderId ||
            team.humanUserId === command.userId ||
            team.humanUserId === effectiveUserId ||
            (sIp && team.humanUserId === sIp.ipUserId)
          ))
        );
        const isAuthorizedHost =
          isOwnerOfTeam ||
          command.isCreator === true ||
          senderId === this.creatorId ||
          command.userId === this.creatorId ||
          effectiveUserId === this.creatorId ||
          (sIp && sIp.ipUserId === this.creatorId) ||
          this.creatorId === "official_host" ||
          this.creatorId === "guest_creator" ||
          this.creatorId === "host" ||
          (this.creatorTeam && this.creatorTeam === command.franchiseCode) ||
          (this.creatorTeam && member && member.claimedFranchise === this.creatorTeam) ||
          (this.getConnectedHumanCount() <= 1);

        if (!isAuthorizedHost) {
          ws.send(JSON.stringify({
            type: "BID_REJECTED",
            payload: {
              reason: "Only the auction creator/host or franchise owner can reassign franchises to AI bots.",
              stateVersion: this.stateVersion,
            },
          }));
          return;
        }

        const previousOwner = team.humanDisplayName || team.humanUserId || "Participant";
        const previousUid = team.humanUserId;

        team.controller = "AI";
        team.humanUserId = undefined;
        team.humanDisplayName = undefined;
        team.lastActiveAt = undefined;

        for (const m of this.members.values()) {
          if (m.userId === previousUid || m.claimedFranchise === team.code) {
            m.claimedFranchise = null;
          }
        }

        this.ctx.storage.sql.exec(
          "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
          team.code,
          JSON.stringify(team)
        );

        this.stateVersion++;
        this.persistState();

        this.recordActivityEvent(
          "USER_DISCONNECTED",
          "Reassigned to Bot",
          `Host reassigned ${team.name} (${team.code}) from ${previousOwner} to AI Bot`,
          team.code
        );

        this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
        this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
        break;
      }

      // Requirement 4: Creator can ban user from joining to that room
      case "BAN_USER": {
        let senderId = command.userId;
        if (!senderId) {
          for (const m of this.members.values()) {
            if (m.connected) {
              senderId = m.userId;
              break;
            }
          }
        }

        const isAuthorizedHost =
          senderId === this.creatorId ||
          command.userId === this.creatorId ||
          this.creatorId === "official_host" ||
          this.creatorId === "guest_creator" ||
          this.creatorId === "host";

        if (!isAuthorizedHost) {
          ws.send(JSON.stringify({
            type: "BID_REJECTED",
            payload: {
              reason: "Only the auction creator/host can ban participants.",
              stateVersion: this.stateVersion,
            },
          }));
          return;
        }

        const targetUserId = command.targetUserId;
        if (!targetUserId || targetUserId === this.creatorId) {
          ws.send(JSON.stringify({
            type: "BID_REJECTED",
            payload: {
              reason: "Cannot ban room host or invalid user.",
              stateVersion: this.stateVersion,
            },
          }));
          return;
        }

        // Add to banned list & SQLite
        this.bannedUserIds.add(targetUserId);
        this.ctx.storage.sql.exec(
          "INSERT OR REPLACE INTO banned_users (user_id, banned_at) VALUES (?, ?)",
          targetUserId,
          Date.now()
        );

        // Reassign any team owned by banned user to AI
        for (const team of this.teams.values()) {
          if (team.humanUserId === targetUserId) {
            team.controller = "AI";
            team.humanUserId = undefined;
            team.humanDisplayName = undefined;
            team.lastActiveAt = undefined;
            this.ctx.storage.sql.exec(
              "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
              team.code,
              JSON.stringify(team)
            );
            this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
          }
        }

        // Disconnect sockets belonging to banned user
        const sockets = this.ctx.getWebSockets();
        for (const s of sockets) {
          for (const m of this.members.values()) {
            if (m.userId === targetUserId) {
              try {
                s.send(JSON.stringify({
                  type: "BANNED_FROM_ROOM",
                  payload: { reason: command.reason || "You have been banned from this room by the host." }
                }));
                s.close(4003, "Banned by host");
              } catch (e) {}
            }
          }
        }

        this.stateVersion++;
        this.persistState();

        this.recordActivityEvent(
          "USER_DISCONNECTED",
          "Participant Banned",
          `Host banned a participant from this auction room`,
          command.franchiseCode
        );
        this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
        break;
      }

      // Host can kick / remove participant from the room
      case "KICK_USER": {
        let senderId = command.userId;
        if (!senderId) {
          for (const m of this.members.values()) {
            if (m.connected) {
              senderId = m.userId;
              break;
            }
          }
        }

        const isAuthorizedHost =
          senderId === this.creatorId ||
          command.userId === this.creatorId ||
          this.creatorId === "official_host" ||
          this.creatorId === "guest_creator" ||
          this.creatorId === "host";

        if (!isAuthorizedHost) {
          ws.send(JSON.stringify({
            type: "BID_REJECTED",
            payload: {
              reason: "Only the auction creator/host can remove participants.",
              stateVersion: this.stateVersion,
            },
          }));
          return;
        }

        const targetUserId = command.targetUserId;
        if (!targetUserId || targetUserId === this.creatorId) {
          ws.send(JSON.stringify({
            type: "BID_REJECTED",
            payload: {
              reason: "Cannot remove room host or invalid user.",
              stateVersion: this.stateVersion,
            },
          }));
          return;
        }

        // Reassign any team owned by kicked user to AI
        for (const team of this.teams.values()) {
          if (team.humanUserId === targetUserId) {
            team.controller = "AI";
            team.humanUserId = undefined;
            team.humanDisplayName = undefined;
            team.lastActiveAt = undefined;
            this.ctx.storage.sql.exec(
              "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
              team.code,
              JSON.stringify(team)
            );
            this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
          }
        }

        let targetName = "Participant";
        for (const [sessId, m] of this.members.entries()) {
          if (m.userId === targetUserId) {
            targetName = m.displayName;
            this.members.delete(sessId);
          }
        }

        // Disconnect sockets belonging to kicked user
        const sockets = this.ctx.getWebSockets();
        for (const s of sockets) {
          const sIp = this.socketIps.get(s);
          const sessId = this.socketSessionIds.get(s);
          if ((sIp && sIp.ipUserId === targetUserId) || (sessId && this.members.get(sessId)?.userId === targetUserId)) {
            try {
              s.send(JSON.stringify({
                type: "KICKED_FROM_ROOM",
                payload: { reason: command.reason || "You were removed from the lobby by the host." }
              }));
              s.close(4004, "Kicked by host");
            } catch (e) {}
          }
        }

        this.recordActivityEvent(
          "USER_DISCONNECTED",
          "Participant Removed",
          `Host removed ${targetName} from the lobby`
        );

        this.stateVersion++;
        this.persistState();
        this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
        break;
      }

      case "RELEASE_TEAM": {
        const sessId = this.socketSessionIds.get(ws);
        const member = sessId ? this.members.get(sessId) : null;
        let senderId = command.userId || (member ? member.userId : null);
        const sIp = this.socketIps.get(ws);
        if (!senderId && sIp) {
          senderId = sIp.ipUserId;
        }

        for (const team of this.teams.values()) {
          const isUserTeam =
            (command.franchiseCode && team.code === command.franchiseCode) ||
            (team.humanUserId && (
              team.humanUserId === senderId ||
              team.humanUserId === command.userId ||
              (sIp && team.humanUserId === sIp.ipUserId)
            ));

          if (team.controller === "HUMAN" && (isUserTeam || (!command.franchiseCode && !command.userId))) {
            team.controller = "AI";
            team.humanUserId = undefined;
            team.humanDisplayName = undefined;
            team.lastActiveAt = undefined;
            this.ctx.storage.sql.exec(
              "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
              team.code,
              JSON.stringify(team)
            );
            this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
          }
        }
        this.stateVersion++;
        this.persistState();
        this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
        break;
      }

      case "START_AUCTION": {
        if (this.status === "LOBBY") {
          await this.startAuction();
        } else if (this.status === "PAUSED") {
          await this.resumeAuction("MANUAL_HOST_RESUME");
        }
        break;
      }

      case "PLACE_BID": {
        // Track activity timestamp for bidding team
        const biddingTeam = this.teams.get(command.franchiseCode);
        if (biddingTeam) {
          biddingTeam.lastActiveAt = Date.now();
        }
        await this.handlePlaceBid(command.amount, command.franchiseCode, command.lotId, command.stateVersion, ws);
        break;
      }

      case "PAUSE_AUCTION": {
        await this.pauseAuction(command.reason || "MANUAL_HOST_PAUSE");
        break;
      }

      case "RESUME_AUCTION": {
        await this.resumeAuction("MANUAL_HOST_RESUME");
        break;
      }

      case "END_AUCTION": {
        await this.endAuction();
        break;
      }

      case "SEND_CHAT": {
        this.handleSendChat(
          command.text,
          command.userId,
          command.displayName,
          command.franchiseCode,
          command.isGuest
        );
        break;
      }

      case "REQUEST_SNAPSHOT": {
        this.checkInactivityTimeouts();
        ws.send(JSON.stringify({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() }));
        break;
      }

      case "SET_RETENTIONS": {
        let senderId = command.userId;
        if (!senderId) {
          for (const m of this.members.values()) {
            if (m.connected) {
              senderId = m.userId;
              break;
            }
          }
        }
        await this.handleSetRetentions(command.franchiseCode, command.playerIds, senderId, ws, command.isCreator);
        break;
      }

      case "RTM_DECISION": {
        let senderId = command.userId;
        if (!senderId) {
          for (const m of this.members.values()) {
            if (m.connected) {
              senderId = m.userId;
              break;
            }
          }
        }
        await this.handleRtmDecision(command.exercise, senderId, ws);
        break;
      }
    }
  }

  // --- Authoritative Auction State Machine ---
  async startAuction() {
    if (this.status === "LIVE") return;

    // Requirement: If retentions enabled, bot teams evaluate and decide retentions before live bidding commences!
    if (this.enableRetentions && this.ruleset !== "SPRINT_XI") {
      await this.evaluateAndApplyAIBotRetentions();
    }

    this.status = "LIVE";
    this.pauseReason = null;
    this.stateVersion++;
    this.persistState();

    // Broadcast authoritative snapshot revealing all finalized rosters to clients
    this.broadcast({
      type: "ROOM_SNAPSHOT",
      payload: this.buildSnapshot(),
    });

    await this.startActiveLot();
  }

  private selectNextLotIndex(): number {
    // 1. Identify which set we are currently in (or starting with)
    const currentSetId =
      this.activeLotIndex >= 0 && this.activeLotIndex < this.lots.length
        ? this.lots[this.activeLotIndex]?.setId
        : null;

    // Check if there are remaining PENDING lots in the current set
    if (currentSetId) {
      const pendingIndicesInCurrentSet: number[] = [];
      for (let i = 0; i < this.lots.length; i++) {
        if (this.lots[i].setId === currentSetId && this.lots[i].status === "PENDING") {
          pendingIndicesInCurrentSet.push(i);
        }
      }

      if (pendingIndicesInCurrentSet.length > 0) {
        // Requirement 1: Players in current set should be picked randomly, not in sequence
        const randomChoice = Math.floor(Math.random() * pendingIndicesInCurrentSet.length);
        return pendingIndicesInCurrentSet[randomChoice];
      }
    }

    // 2. Current set is exhausted (or auction is just starting).
    // Find the next set in SEED_SETS order that has PENDING lots!
    for (const setInfo of SEED_SETS) {
      const pendingIndicesInNextSet: number[] = [];
      for (let i = 0; i < this.lots.length; i++) {
        if (this.lots[i].setId === setInfo.id && this.lots[i].status === "PENDING") {
          pendingIndicesInNextSet.push(i);
        }
      }

      if (pendingIndicesInNextSet.length > 0) {
        // If advancing from a previous set, record a SET_STARTED activity event
        if (currentSetId && currentSetId !== setInfo.id) {
          this.recordActivityEvent(
            "SET_STARTED",
            `Starting Set: ${setInfo.setName} (${setInfo.setCode})`,
            `Completed previous set. Now auctioning ${setInfo.setName} (${pendingIndicesInNextSet.length} player(s) available).`,
            undefined,
            undefined,
            undefined
          );
        }
        // Requirement 1: Pick a random player from the new set
        const randomChoice = Math.floor(Math.random() * pendingIndicesInNextSet.length);
        return pendingIndicesInNextSet[randomChoice];
      }
    }

    // No pending lots left in any set!
    return -1;
  }

  private async startActiveLot() {
    if (this.status !== "LIVE") return;

    const teamsList = Array.from(this.teams.values());
    const allTeamsFull = teamsList.length > 0 && teamsList.every(
      (team) => team.purchasedPlayers.length >= (team.maxSquad || 25)
    );

    if (allTeamsFull) {
      console.log(`[AutoEnd] Auction ending: all teams full (${allTeamsFull}) in room ${this.roomId}`);
      await this.endAuction();
      return;
    }

    const nextIdx = this.selectNextLotIndex();
    if (nextIdx === -1) {
      console.log(`[AutoEnd] Reached end of player catalog in room ${this.roomId}. Ending auction.`);
      await this.endAuction();
      return;
    }

    this.activeLotIndex = nextIdx;
    const currentLot = this.lots[this.activeLotIndex];
    // Retain original catalog lotNumber: do NOT overwrite with completedLots + 1
    currentLot.status = "ACTIVE";
    currentLot.currentBid = 0;
    currentLot.highestBidderFranchise = null;

    // Authoritative Opening Bid Window (18 seconds for opening lot to give ample time for audio announcement, inspection, and human bidding)
    const openingDurationMs = 18000;
    this.currentTimerDurationMs = openingDurationMs;
    this.timerDeadline = Date.now() + openingDurationMs;
    await this.ctx.storage.setAlarm(this.timerDeadline);

    if (this.activeTimer) clearTimeout(this.activeTimer);
    this.activeTimer = setTimeout(async () => {
      await this.alarm();
    }, openingDurationMs);

    this.stateVersion++;
    this.persistState();
    this.saveLot(currentLot);

    // Announce player start
    const ann = AudioAnnouncementService.createLotStartAnnouncement(
      currentLot.lotNumber,
      currentLot.playerName,
      currentLot.country,
      currentLot.role,
      currentLot.basePrice
    );

    const { nextBid, increment } = calculateNextLegalBid(currentLot.currentBid, currentLot.basePrice);

    this.broadcast({
      type: "PLAYER_STARTED",
      payload: {
        lot: this.sanitizeLot(currentLot),
        timerDeadline: this.timerDeadline,
        timerDurationMs: openingDurationMs,
        nextLegalBid: nextBid,
        bidIncrement: increment,
        stateVersion: this.stateVersion,
      },
    });

    this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: ann });

    this.recordActivityEvent(
      "PLAYER_STARTED",
      `Lot #${currentLot.lotNumber}: ${currentLot.playerName}`,
      `Bidding opened for ${currentLot.playerName} (${currentLot.role.replace(/_/g, " ")}) at base price of ₹${(currentLot.basePrice / 100000).toFixed(0)} Lakh`,
      undefined,
      currentLot.basePrice,
      currentLot.lotNumber
    );

    // Schedule AI evaluation for opening bid
    this.scheduleAIEvaluation();
  }

  private async handlePlaceBid(
    amount: number,
    franchiseCode: string,
    lotId: string,
    clientStateVersion: number,
    ws?: WebSocket
  ): Promise<boolean> {
    if (this.status !== "LIVE") {
      ws?.send(JSON.stringify({ type: "BID_REJECTED", payload: { reason: "Auction is not currently live.", stateVersion: this.stateVersion } }));
      return false;
    }

    // Guard: Bidding is strictly locked during Right to Match (RTM) decision window
    if (this.rtmState && this.rtmState.active) {
      ws?.send(
        JSON.stringify({
          type: "BID_REJECTED",
          payload: {
            reason: "Right to Match (RTM) decision is in progress. The hammer has closed and no further bids can be placed.",
            stateVersion: this.stateVersion,
          },
        })
      );
      return false;
    }

    const currentLot = this.lots[this.activeLotIndex];
    if (!currentLot || currentLot.id !== lotId || currentLot.status !== "ACTIVE") {
      ws?.send(JSON.stringify({ type: "BID_REJECTED", payload: { reason: "Active auction lot has changed.", stateVersion: this.stateVersion } }));
      return false;
    }

    // Check timer expiration
    if (this.timerDeadline && Date.now() >= this.timerDeadline) {
      ws?.send(JSON.stringify({ type: "BID_REJECTED", payload: { reason: "Bid submitted after timer deadline expired.", stateVersion: this.stateVersion } }));
      return false;
    }

    const team = this.teams.get(franchiseCode);
    if (!team) {
      ws?.send(JSON.stringify({ type: "BID_REJECTED", payload: { reason: "Franchise not found.", stateVersion: this.stateVersion } }));
      return false;
    }

    // Cannot bid against oneself
    if (currentLot.highestBidderFranchise === franchiseCode) {
      ws?.send(JSON.stringify({ type: "BID_REJECTED", payload: { reason: "Your franchise already holds the highest bid.", stateVersion: this.stateVersion } }));
      return false;
    }

    // Roster balance & role lookahead reservation check
    const balanceCheck = evaluateRosterBalance(team, currentLot, this.ruleset);
    if (!balanceCheck.allowed) {
      ws?.send(JSON.stringify({
        type: "BID_REJECTED",
        payload: {
          reason: balanceCheck.reason || "Bid violates roster balance constraints.",
          stateVersion: this.stateVersion,
        },
      }));
      return false;
    }

    // Legal increment validation
    const { nextBid } = calculateNextLegalBid(currentLot.currentBid, currentLot.basePrice);
    if (amount < nextBid) {
      ws?.send(JSON.stringify({ type: "BID_REJECTED", payload: { reason: `Bid of ₹${amount} is below next legal bid of ₹${nextBid}.`, stateVersion: this.stateVersion } }));
      return false;
    }

    // Reserve calculation: Team must maintain enough purse to fill squad to minimum size
    const spotsRemainingAfterPurchase = Math.max(0, team.minSquad - team.squadCount - 1);
    const minReserveNeeded = spotsRemainingAfterPurchase * 3000000; // ₹30 Lakh base per remaining spot
    if (team.remainingPurse - amount < minReserveNeeded) {
      ws?.send(JSON.stringify({
        type: "BID_REJECTED",
        payload: {
          reason: `Insufficient purse reserve. You must reserve at least ₹${minReserveNeeded / 100000} Lakh to fill minimum ${team.minSquad} squad slots.`,
          stateVersion: this.stateVersion,
        },
      }));
      return false;
    }

    // ACCEPT BID
    currentLot.currentBid = amount;
    currentLot.highestBidderFranchise = franchiseCode;
    this.stateVersion++;

    // RESET TIMER TO EXACTLY 10 SECONDS FOR COUNTER-BIDDING
    const counterBidDurationMs = 10000;
    this.currentTimerDurationMs = counterBidDurationMs;
    this.timerDeadline = Date.now() + counterBidDurationMs;
    await this.ctx.storage.setAlarm(this.timerDeadline);

    if (this.activeTimer) clearTimeout(this.activeTimer);
    this.activeTimer = setTimeout(async () => {
      await this.alarm();
    }, counterBidDurationMs);

    this.saveLot(currentLot);
    this.persistState();

    // Record Activity Event & Broadcast
    this.recordActivityEvent(
      "BID_ACCEPTED",
      "Bid Accepted",
      `${team.name} placed bid of ₹${amount.toLocaleString("en-IN")}`,
      franchiseCode,
      amount,
      currentLot.lotNumber
    );

    const { nextBid: updatedNextBid, increment: updatedIncrement } = calculateNextLegalBid(currentLot.currentBid, currentLot.basePrice);

    this.broadcast({
      type: "BID_ACCEPTED",
      payload: {
        lotId: currentLot.id,
        amount,
        franchiseCode,
        timerDeadline: this.timerDeadline,
        timerDurationMs: counterBidDurationMs,
        nextLegalBid: updatedNextBid,
        bidIncrement: updatedIncrement,
        stateVersion: this.stateVersion,
      },
    });

    this.broadcast({
      type: "TIMER_RESET",
      payload: {
        timerDeadline: this.timerDeadline,
        timerDurationMs: counterBidDurationMs,
        remainingMs: counterBidDurationMs,
      },
    });

    // Voice announcement
    const voiceAnn = AudioAnnouncementService.createBidAnnouncement(amount, team.name, currentLot.playerName);
    this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: voiceAnn });

    // Schedule AI counter-bid
    this.scheduleAIEvaluation();
    return true;
  }

  // --- Timer Alarm Expiration Handler ---
  async alarm(): Promise<void> {
    if (this.status !== "LIVE") return;

    if (this.rtmState && this.rtmState.active) {
      if (Date.now() >= this.rtmState.timerDeadline) {
        console.log(`[RTM Alarm Timeout] RTM decision deadline expired for ${this.rtmState.eligibleFranchise}. Resolving decline.`);
        await this.resolveRTM(false, "Alarm Timeout");
        return;
      }
      const remaining = Math.max(300, this.rtmState.timerDeadline - Date.now());
      await this.ctx.storage.setAlarm(Date.now() + remaining);
      return;
    }

    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }

    try {
      await this.ctx.storage.deleteAlarm();
    } catch (e) {
      // ignore
    }

    if (this.activeLotIndex >= this.lots.length) {
      this.status = "COMPLETED";
      this.persistState();
      this.broadcast({ type: "AUCTION_COMPLETED", payload: { summary: {}, stateVersion: ++this.stateVersion } });
      return;
    }

    const currentLot = this.lots[this.activeLotIndex];
    if (!currentLot) return;

    if (currentLot.status === "PENDING") {
      await this.startActiveLot();
      return;
    }

    if (currentLot.status === "SOLD" || currentLot.status === "UNSOLD") {
      // Guard: Ensure full 4.0s celebratory transition period has elapsed before advancing to next lot!
      if (this.transitionDeadline && Date.now() < this.transitionDeadline - 350) {
        const remaining = Math.max(350, this.transitionDeadline - Date.now());
        if (this.transitionTimer) clearTimeout(this.transitionTimer);
        this.transitionTimer = setTimeout(async () => { await this.alarm(); }, remaining);
        await this.ctx.storage.setAlarm(Date.now() + remaining);
        return;
      }
      this.transitionDeadline = 0;
      await this.startActiveLot();
      return;
    }

    if (currentLot.status !== "ACTIVE") return;

    // Guard: Prevent premature lot settlement if timer deadline hasn't elapsed!
    if (this.timerDeadline && Date.now() < this.timerDeadline - 400) {
      const remaining = Math.max(400, this.timerDeadline - Date.now());
      console.log(`[Premature Alarm Ignored] Lot #${currentLot.lotNumber} has ${remaining}ms remaining.`);
      if (this.activeTimer) clearTimeout(this.activeTimer);
      this.activeTimer = setTimeout(async () => { await this.alarm(); }, remaining);
      await this.ctx.storage.setAlarm(Date.now() + remaining);
      return;
    }

    // Settle Current Lot
    if (currentLot.currentBid > 0 && currentLot.highestBidderFranchise) {
      // Check RTM eligibility before finalizing sale
      if (this.enableRetentions && currentLot.previousFranchise) {
        const formerCode = currentLot.previousFranchise;
        const highestBidderCode = currentLot.highestBidderFranchise;
        const formerTeam = this.teams.get(formerCode);

        if (
          formerTeam &&
          formerCode !== highestBidderCode &&
          formerTeam.rtmCardsRemaining > 0 &&
          formerTeam.squadCount < formerTeam.maxSquad &&
          (!currentLot.isOverseas || formerTeam.overseasCount < formerTeam.maxOverseas) &&
          formerTeam.remainingPurse >= currentLot.currentBid
        ) {
          const spotsRemainingAfterPurchase = Math.max(0, formerTeam.minSquad - (formerTeam.squadCount + 1));
          const minReserveNeeded = spotsRemainingAfterPurchase * 3000000;
          if (formerTeam.remainingPurse - currentLot.currentBid >= minReserveNeeded) {
            await this.triggerRTM(currentLot, formerTeam, highestBidderCode);
            return;
          }
        }
      }

      await this.finalizeSold(currentLot, currentLot.highestBidderFranchise, currentLot.currentBid, false);
    } else {
      await this.finalizeUnsold(currentLot);
    }
  }

  private async triggerRTM(currentLot: AuctionLot, formerTeam: FranchiseState, highestBidderCode: string) {
    // Clear any pending AI evaluations and active lot timers immediately
    if (this.aiPendingTimer) {
      clearTimeout(this.aiPendingTimer);
      this.aiPendingTimer = null;
    }
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }

    const isHuman = formerTeam.controller === "HUMAN";
    const highestTeam = this.teams.get(highestBidderCode);
    const highestTeamName = highestTeam?.name || highestBidderCode;

    this.rtmState = {
      active: true,
      lotId: currentLot.id,
      lotNumber: currentLot.lotNumber,
      playerName: currentLot.playerName,
      playerRole: currentLot.role,
      isOverseas: currentLot.isOverseas,
      highestBidderFranchise: highestBidderCode,
      finalBidAmount: currentLot.currentBid,
      eligibleFranchise: formerTeam.code,
      eligibleFranchiseOwnerId: formerTeam.humanUserId,
      isEligibleHuman: isHuman,
      timerDeadline: Date.now() + 10000,
      status: "PENDING_DECISION",
    };

    this.timerDeadline = this.rtmState.timerDeadline;
    await this.ctx.storage.setAlarm(this.rtmState.timerDeadline);

    this.stateVersion++;
    this.persistState();

    this.broadcast({
      type: "RTM_PROMPT",
      payload: this.rtmState,
    });

    const promptAnn = AudioAnnouncementService.createRtmPromptAnnouncement(
      formerTeam.name,
      currentLot.playerName,
      currentLot.currentBid
    );
    this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: promptAnn });

    this.recordActivityEvent(
      "RTM_TRIGGERED",
      "Right to Match (RTM) Triggered!",
      `${formerTeam.name} has the Right to Match ₹${currentLot.currentBid.toLocaleString("en-IN")} (highest bid by ${highestTeamName}) for their former player ${currentLot.playerName}!`,
      formerTeam.code,
      currentLot.currentBid,
      currentLot.lotNumber
    );

    if (isHuman) {
      if (this.rtmTimer) clearTimeout(this.rtmTimer);
      this.rtmTimer = setTimeout(async () => {
        try {
          if (this.rtmState && this.rtmState.active && this.rtmState.status === "PENDING_DECISION") {
            console.log(`[RTM Timeout] Human owner for ${formerTeam.code} timed out. Defaulting to decline.`);
            await this.resolveRTM(false, "Timeout");
          }
        } catch (err) {
          console.error("[RTM Timeout Error]", err);
          await this.resolveRTM(false, "Fallback Timeout");
        }
      }, 10000);
    } else {
      const delay = Math.floor(Math.random() * 800) + 1800;
      const rtmContext = this.buildRTMContext(formerTeam, currentLot, highestBidderCode);
      const rtmDecisionPromise = ClefFlashService.decideRTM(this.env, rtmContext);

      if (this.rtmTimer) clearTimeout(this.rtmTimer);
      this.rtmTimer = setTimeout(async () => {
        try {
          const decision = await rtmDecisionPromise;
          console.log(`[RTM AI Decision] ${formerTeam.code} for ${currentLot.playerName}:`, decision);
          await this.resolveRTM(decision.exercise, decision.reason);
        } catch (err) {
          console.error("[RTM AI Bot Error]", err);
          await this.resolveRTM(false, "AI Bot Fallback");
        }
      }, delay);
    }
  }

  private buildRTMContext(
    formerTeam: FranchiseState,
    currentLot: AuctionLot,
    highestBidderCode: string
  ): RTMDecisionContext {
    const purchased = formerTeam.purchasedPlayers || [];
    const batters = purchased.filter((p) => p.role === "BATTER").map((p) => p.name);
    const bowlers = purchased.filter((p) => p.role === "BOWLER").map((p) => p.name);
    const allRounders = purchased.filter((p) => p.role === "ALL_ROUNDER").map((p) => p.name);
    const wicketkeepers = purchased.filter((p) => p.role === "WICKETKEEPER").map((p) => p.name);

    const roleCounts = {
      BATTER: batters.length,
      BOWLER: bowlers.length,
      ALL_ROUNDER: allRounders.length,
      WICKETKEEPER: wicketkeepers.length,
    };

    const neededRoles: string[] = [];
    if (roleCounts.WICKETKEEPER < 1) neededRoles.push("WICKETKEEPER");
    if (roleCounts.BATTER < 4) neededRoles.push("BATTER");
    if (roleCounts.BOWLER < 5) neededRoles.push("BOWLER");
    if (roleCounts.ALL_ROUNDER < 2) neededRoles.push("ALL_ROUNDER");

    const spotsRemainingAfterPurchase = Math.max(0, formerTeam.minSquad - (formerTeam.squadCount + 1));
    const purseAfterMatch = formerTeam.remainingPurse - currentLot.currentBid;
    const budgetPerRemainingSlotAfterMatch =
      spotsRemainingAfterPurchase > 0 ? purseAfterMatch / spotsRemainingAfterPurchase : purseAfterMatch;

    const allTeamsObj: Record<string, FranchiseState> = {};
    for (const [k, v] of this.teams.entries()) allTeamsObj[k] = v;

    const fairValuationCeiling = calculatePlayerValuation(
      currentLot,
      formerTeam,
      this.aiDifficulty,
      Math.max(1, this.lots.length - this.activeLotIndex),
      this.lots.length,
      allTeamsObj
    );

    return {
      player: {
        name: currentLot.playerName,
        role: currentLot.role,
        country: currentLot.country,
        isOverseas: currentLot.isOverseas,
        isCapped: currentLot.isCapped,
        battingStyle: currentLot.battingStyle,
        bowlingStyle: currentLot.bowlingStyle,
        matches: currentLot.matches,
        runs: currentLot.runs,
        battingAverage: currentLot.battingAverage,
        strikeRate: currentLot.strikeRate,
        wickets: currentLot.wickets,
        economy: currentLot.economy,
        rating: currentLot.hiddenRatingOverall || 75,
        basePrice: currentLot.basePrice,
      },
      rtmValue: {
        finalBid: currentLot.currentBid,
        highestBidderCode,
      },
      formerTeam: {
        code: formerTeam.code,
        name: formerTeam.name,
        totalPurse: formerTeam.totalPurse,
        remainingPurse: formerTeam.remainingPurse,
        purseAfterMatch,
        squadCount: formerTeam.squadCount,
        minSquad: formerTeam.minSquad,
        maxSquad: formerTeam.maxSquad,
        overseasCount: formerTeam.overseasCount,
        maxOverseas: formerTeam.maxOverseas,
        rtmCardsRemaining: formerTeam.rtmCardsRemaining,
        currentSquad: {
          batters,
          bowlers,
          allRounders,
          wicketkeepers,
        },
        roleCounts,
        neededRoles,
        fairValuationCeiling,
        budgetPerRemainingSlotAfterMatch,
      },
      difficulty: this.aiDifficulty,
      lotsRemaining: Math.max(1, this.lots.length - this.activeLotIndex),
      totalLots: this.lots.length,
    };
  }

  private async resolveRTM(exercise: boolean, source: string = "") {
    if (!this.rtmState || !this.rtmState.active) return;
    if (this.rtmTimer) {
      clearTimeout(this.rtmTimer);
      this.rtmTimer = null;
    }

    const currentLot = this.lots[this.activeLotIndex];
    if (!currentLot || currentLot.id !== this.rtmState.lotId) {
      this.rtmState = null;
      return;
    }

    const formerTeam = this.teams.get(this.rtmState.eligibleFranchise);
    const highestTeam = this.teams.get(this.rtmState.highestBidderFranchise);
    const amount = this.rtmState.finalBidAmount;

    if (exercise && formerTeam) {
      this.rtmState.status = "MATCHED";
      formerTeam.rtmCardsRemaining = Math.max(0, formerTeam.rtmCardsRemaining - 1);

      const reasonDetail = source ? ` (${source})` : "";
      this.recordActivityEvent(
        "RTM_MATCHED",
        "RTM Exercised!",
        `${formerTeam.name} exercised Right to Match (RTM) card and matched ₹${amount.toLocaleString("en-IN")} to retain ${currentLot.playerName}! (${formerTeam.rtmCardsRemaining} RTM card(s) left)${reasonDetail}`,
        formerTeam.code,
        amount,
        currentLot.lotNumber
      );

      const rtmVoice = AudioAnnouncementService.createRtmExercisedAnnouncement(
        formerTeam.name,
        currentLot.playerName,
        amount
      );
      this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: rtmVoice });

      this.broadcast({
        type: "RTM_RESOLVED",
        payload: {
          lotId: currentLot.id,
          exercised: true,
          winningFranchise: formerTeam.code,
          amount,
          stateVersion: ++this.stateVersion,
        },
      });

      this.rtmState = null;
      this.persistState();

      await this.finalizeSold(currentLot, formerTeam.code, amount, true);
    } else {
      this.rtmState.status = "DECLINED";
      const formerName = formerTeam?.name || this.rtmState.eligibleFranchise;
      const winnerName = highestTeam?.name || this.rtmState.highestBidderFranchise;

      const reasonDetail = source ? ` (${source})` : "";
      this.recordActivityEvent(
        "RTM_DECLINED",
        "RTM Declined",
        `${formerName} declined to exercise Right to Match card${reasonDetail}. ${currentLot.playerName} awarded to ${winnerName} for ₹${amount.toLocaleString("en-IN")}.`,
        highestTeam?.code,
        amount,
        currentLot.lotNumber
      );

      const rtmVoice = AudioAnnouncementService.createRtmDeclinedAnnouncement(
        formerName,
        winnerName,
        currentLot.playerName
      );
      this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: rtmVoice });

      const winnerFranchiseCode = highestTeam ? highestTeam.code : this.rtmState.highestBidderFranchise;

      this.broadcast({
        type: "RTM_RESOLVED",
        payload: {
          lotId: currentLot.id,
          exercised: false,
          winningFranchise: winnerFranchiseCode,
          amount,
          stateVersion: ++this.stateVersion,
        },
      });

      this.rtmState = null;
      this.persistState();

      await this.finalizeSold(currentLot, winnerFranchiseCode, amount, false);
    }
  }

  private async finalizeSold(currentLot: AuctionLot, winningCode: string, price: number, isRtmMatch: boolean) {
    const winningFranchise = this.teams.get(winningCode)!;
    currentLot.status = "SOLD";
    currentLot.soldToFranchise = winningFranchise.code;
    currentLot.finalPrice = price;

    winningFranchise.remainingPurse -= currentLot.finalPrice;
    winningFranchise.squadCount += 1;
    if (currentLot.isOverseas) {
      winningFranchise.overseasCount += 1;
    }

    const playerLot = this.lots.find((l) => l.playerId === currentLot.playerId);
    const playerRating = currentLot.hiddenRatingOverall || playerLot?.hiddenRatingOverall || 70;

    const purchasedRecord = {
      id: currentLot.playerId,
      name: currentLot.playerName,
      role: currentLot.role,
      country: currentLot.country,
      isOverseas: currentLot.isOverseas,
      purchasePrice: currentLot.finalPrice,
      lotNumber: currentLot.lotNumber,
      soldAt: Date.now(),
      isRtmMatch,
      rating: playerRating,
    };
    winningFranchise.purchasedPlayers.push(purchasedRecord);

    const squadForEval = winningFranchise.purchasedPlayers.map((p) => {
      const found = this.lots.find((l) => l.playerId === p.id);
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        isOverseas: p.isOverseas,
        overallRating: p.rating || found?.hiddenRatingOverall || 70,
      };
    });
    const evalResult = calculateTeamOverallRating(squadForEval, winningFranchise.remainingPurse, winningFranchise.totalPurse, this.ruleset);
    if (evalResult) {
      winningFranchise.averageRating = evalResult.overallRating;
      winningFranchise.playersRating = evalResult.playersRating;
      winningFranchise.squadBalanceRating = evalResult.squadBalanceRating;
      winningFranchise.purseBalanceRating = evalResult.purseBalanceRating;
    }

    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
      winningFranchise.code,
      JSON.stringify(winningFranchise)
    );

    this.saveLot(currentLot);
    this.stateVersion++;
    this.persistState();

    if (!isRtmMatch) {
      const soldAnn = AudioAnnouncementService.createSoldAnnouncement(
        currentLot.playerName,
        winningFranchise.name,
        currentLot.finalPrice
      );
      this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: soldAnn });

      this.recordActivityEvent(
        "PLAYER_SOLD",
        "Player Sold!",
        `${currentLot.playerName} sold to ${winningFranchise.name} for ₹${currentLot.finalPrice.toLocaleString("en-IN")}`,
        winningFranchise.code,
        currentLot.finalPrice,
        currentLot.lotNumber
      );
    }

    const nextLot = this.lots[this.activeLotIndex + 1] || null;
    const nextPlayerBasePrice = nextLot ? nextLot.basePrice : 0;
    const nextPlayerIncrement = nextLot ? getBidIncrement(nextLot.basePrice) : 0;

    this.broadcast({
      type: "PLAYER_SOLD",
      payload: {
        lotId: currentLot.id,
        playerName: currentLot.playerName,
        franchiseCode: winningFranchise.code,
        amount: currentLot.finalPrice,
        nextLegalBid: nextPlayerBasePrice,
        bidIncrement: nextPlayerIncrement,
        nextPlayerName: nextLot?.playerName,
        stateVersion: this.stateVersion,
      },
    });

    this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: winningFranchise } });
    if (winningFranchise.averageRating !== null) {
      this.broadcast({
        type: "TEAM_RATING_UPDATED",
        payload: { franchiseCode: winningFranchise.code, averageRating: winningFranchise.averageRating },
      });
    }

    await this.checkCompletionOrAdvance();
  }

  private async finalizeUnsold(currentLot: AuctionLot) {
    currentLot.status = "UNSOLD";
    this.saveLot(currentLot);
    this.stateVersion++;
    this.persistState();

    const unsoldAnn = AudioAnnouncementService.createUnsoldAnnouncement(currentLot.playerName);

    const nextLot = this.lots[this.activeLotIndex + 1] || null;
    const nextPlayerBasePrice = nextLot ? nextLot.basePrice : 0;
    const nextPlayerIncrement = nextLot ? getBidIncrement(nextLot.basePrice) : 0;

    this.broadcast({
      type: "PLAYER_UNSOLD",
      payload: {
        lotId: currentLot.id,
        playerName: currentLot.playerName,
        nextLegalBid: nextPlayerBasePrice,
        bidIncrement: nextPlayerIncrement,
        nextPlayerName: nextLot?.playerName,
        stateVersion: this.stateVersion,
      },
    });

    this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: unsoldAnn });

    this.recordActivityEvent(
      "PLAYER_UNSOLD",
      "Player Unsold",
      `${currentLot.playerName} went unsold with no valid bids placed`,
      undefined,
      undefined,
      currentLot.lotNumber
    );

    await this.checkCompletionOrAdvance();
  }

  private async checkCompletionOrAdvance() {
    const teamsList = Array.from(this.teams.values());
    const allTeamsFull = teamsList.length > 0 && teamsList.every(
      (team) => team.purchasedPlayers.length >= (team.maxSquad || 25)
    );

    if (allTeamsFull) {
      console.log(`[AutoEnd] All franchises reached maximum squad capacity (25 players) in room ${this.roomId}. Automatically ending auction.`);
      this.recordActivityEvent(
        "AUCTION_COMPLETED",
        "Auction Concluded Automatically",
        "All franchises have reached maximum squad capacity (25 players). Auction has concluded.",
        undefined,
        undefined,
        undefined
      );
      await this.endAuction();
      return;
    }

    const hasPendingLots = this.lots.some((l) => l.status === "PENDING");
    if (!hasPendingLots) {
      console.log(`[AutoEnd] Reached end of player catalog in room ${this.roomId}. Ending auction.`);
      await this.endAuction();
      return;
    }

    this.transitionDeadline = Date.now() + 4000;
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(async () => {
      await this.alarm();
    }, 4000);
    await this.ctx.storage.setAlarm(Date.now() + 4000);
  }

  private async handleSetRetentions(
    franchiseCode: string,
    playerIds: string[],
    userId?: string,
    ws?: WebSocket,
    isCreatorFlag?: boolean
  ) {
    if (this.status !== "LOBBY") {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Retentions can only be configured in the Lobby." } }));
      return;
    }

    if (!this.enableRetentions || this.ruleset === "SPRINT_XI") {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Retentions are disabled for this room." } }));
      return;
    }

    const team = this.teams.get(franchiseCode);
    if (!team) {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Franchise not found." } }));
      return;
    }

    let sIp = ws ? this.socketIps.get(ws) : null;
    if (!sIp && ws) {
      try {
        const att = (ws as any).deserializeAttachment?.();
        if (att) sIp = att;
      } catch {}
    }
    const sessId = ws ? this.socketSessionIds.get(ws) : null;
    const member = sessId ? this.members.get(sessId) : null;
    const memberUserId = member ? member.userId : null;
    const effectiveUserId = userId || memberUserId || (sIp ? sIp.ipUserId : null);

    const isOwner = Boolean(
      (member && member.claimedFranchise === franchiseCode) ||
      (team.humanUserId && (
        team.humanUserId === effectiveUserId ||
        team.humanUserId === userId ||
        (member && team.humanUserId === memberUserId) ||
        (sIp && team.humanUserId === sIp.ipUserId)
      )) ||
      (this.creatorTeam && this.creatorTeam === franchiseCode && (isCreatorFlag || this.creatorId === userId || this.creatorId === effectiveUserId))
    );

    const isHost = Boolean(
      isCreatorFlag ||
      this.creatorId === effectiveUserId ||
      this.creatorId === userId ||
      (member && this.creatorId === memberUserId) ||
      (sIp && this.creatorId === sIp.ipUserId) ||
      this.creatorId === "official_host" ||
      this.creatorId === "host" ||
      this.creatorId === "guest_creator" ||
      (this.creatorTeam && member && member.claimedFranchise === this.creatorTeam) ||
      (this.creatorTeam && team.code === this.creatorTeam) ||
      (this.getConnectedHumanCount() <= 1)
    );

    if (!isOwner && !isHost) {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Not authorized to modify retentions for this franchise." } }));
      return;
    }

    const officialInfo = OFFICIAL_FRANCHISE_RETENTIONS[franchiseCode];
    if (!officialInfo) {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "No candidate data for franchise." } }));
      return;
    }

    const selectedCandidates = officialInfo.candidates.filter((c) => playerIds.includes(c.id));
    const cappedCount = selectedCandidates.filter((c) => c.isCapped).length;
    const uncappedCount = selectedCandidates.filter((c) => !c.isCapped).length;
    const overseasCount = selectedCandidates.filter((c) => c.isOverseas).length;

    if (this.ruleset === "MEGA") {
      if (selectedCandidates.length > 6) {
        ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Mega Auction allows a maximum of 6 retentions." } }));
        return;
      }
      if (cappedCount > 5) {
        ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Mega Auction allows a maximum of 5 capped retentions." } }));
        return;
      }
      if (uncappedCount > 2) {
        ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Mega Auction allows a maximum of 2 uncapped retentions." } }));
        return;
      }
    } else if (this.ruleset === "CLASSIC") {
      if (selectedCandidates.length > 11) {
        ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Classic Auction allows a maximum of 11 retentions." } }));
        return;
      }
    } else {
      const maxSquad = team.maxSquad || 25;
      if (selectedCandidates.length > maxSquad) {
        ws?.send(JSON.stringify({ type: "ERROR", payload: { message: `Maximum ${maxSquad} retentions allowed.` } }));
        return;
      }
    }

    const maxOverseas = team.maxOverseas || 8;
    if (overseasCount > maxOverseas) {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: `Maximum ${maxOverseas} overseas retentions allowed.` } }));
      return;
    }

    const { totalDeduction, rtmCards } = calculateRetentionDeduction(selectedCandidates, this.ruleset);
    if (totalDeduction > team.totalPurse) {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Retention cost exceeds franchise purse." } }));
      return;
    }

    const retainedInfos: RetainedPlayerInfo[] = selectedCandidates.map((c, idx) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      country: c.country,
      isOverseas: c.isOverseas,
      isCapped: c.isCapped,
      retentionPrice: c.officialPrice,
      slotNumber: idx + 1,
    }));

    team.retainedPlayers = retainedInfos;
    team.retentionSpent = totalDeduction;
    team.remainingPurse = Math.max(0, team.totalPurse - totalDeduction);
    team.rtmCardsRemaining = rtmCards;
    team.squadCount = selectedCandidates.length;
    team.overseasCount = overseasCount;
    team.purchasedPlayers = retainedInfos.map((r) => {
      const found = SEED_PLAYERS.find((sp) => sp.name.trim().toLowerCase() === r.name.trim().toLowerCase());
      return {
        id: r.id,
        name: r.name,
        role: r.role,
        country: r.country,
        isOverseas: r.isOverseas,
        purchasePrice: r.retentionPrice,
        lotNumber: 0,
        soldAt: Date.now(),
        isRetained: true,
        rating: found?.hiddenRatingOverall || 75,
      };
    });

    const squadForEval = team.purchasedPlayers.map((p) => {
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        isOverseas: p.isOverseas,
        overallRating: p.rating || 75,
      };
    });
    const evalResult = calculateTeamOverallRating(squadForEval, team.remainingPurse, team.totalPurse, this.ruleset);
    if (evalResult) {
      team.averageRating = evalResult.overallRating;
      team.playersRating = evalResult.playersRating;
      team.squadBalanceRating = evalResult.squadBalanceRating;
      team.purseBalanceRating = evalResult.purseBalanceRating;
    }

    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
      team.code,
      JSON.stringify(team)
    );

    this.stateVersion++;
    this.persistState();

    // Dynamically update available auction lots
    const allRetainedNames = new Set<string>();
    for (const t of this.teams.values()) {
      for (const p of t.retainedPlayers || []) {
        allRetainedNames.add(p.name.trim().toLowerCase());
      }
    }
    this.refreshLotsExcludingRetentions(allRetainedNames);

    this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
    this.broadcast({ type: "ROOM_SNAPSHOT", payload: this.buildSnapshot() });
    if (this.status !== "LOBBY") {
      this.recordActivityEvent(
        "RETENTIONS_UPDATED",
        "Retentions Configured",
        `${team.name} configured retentions: ${selectedCandidates.length} retained (₹${(totalDeduction / 10000000).toFixed(1)} Cr), ${rtmCards} RTM card(s) available.`,
        team.code
      );
    }

    ws?.send(
      JSON.stringify({
        type: "RETENTIONS_SAVED",
        payload: {
          franchiseCode: team.code,
          retainedCount: selectedCandidates.length,
          totalDeduction,
          rtmCards,
        },
      })
    );
  }

  private async handleRtmDecision(exercise: boolean, userId?: string, ws?: WebSocket) {
    if (!this.rtmState || !this.rtmState.active || this.rtmState.status !== "PENDING_DECISION") {
      ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "No active RTM prompt pending." } }));
      return;
    }

    const eligibleTeam = this.teams.get(this.rtmState.eligibleFranchise);
    if (!eligibleTeam) return;

    if (eligibleTeam.controller === "HUMAN" && eligibleTeam.humanUserId) {
      if (userId && eligibleTeam.humanUserId !== userId && this.creatorId !== userId) {
        ws?.send(JSON.stringify({ type: "ERROR", payload: { message: "Only franchise owner or host can decide RTM." } }));
        return;
      }
    }

    await this.resolveRTM(exercise, "Human Owner Decision");
  }

  // --- No-Human Presence Rule ---
  private checkHumanPresenceAndAutoPause(departedUser: string) {
    const humanCount = this.getConnectedHumanCount();
    if (humanCount === 0 && this.status === "LIVE") {
      const currentLot = this.lots[this.activeLotIndex];
      if (currentLot && (currentLot.status === "SOLD" || currentLot.status === "UNSOLD")) {
        this.remainingMsAtPause = 3500;
      } else {
        this.remainingMsAtPause = this.timerDeadline ? Math.max(1000, this.timerDeadline - Date.now()) : 10000;
      }
      this.status = "PAUSED";
      this.pauseReason = "NO_HUMANS_CONNECTED";
      this.ctx.storage.deleteAlarm();

      if (this.activeTimer) { clearTimeout(this.activeTimer); this.activeTimer = null; }
      if (this.transitionTimer) { clearTimeout(this.transitionTimer); this.transitionTimer = null; }
      if (this.aiPendingTimer) { clearTimeout(this.aiPendingTimer); this.aiPendingTimer = null; }

      this.stateVersion++;
      this.persistState();

      this.broadcast({
        type: "AUCTION_PAUSED",
        payload: {
          reason: "All human participants disconnected. Auction paused automatically to preserve room state.",
          remainingMs: this.remainingMsAtPause,
          stateVersion: this.stateVersion,
        },
      });

      const ann = AudioAnnouncementService.createPauseAnnouncement("NO_HUMANS_CONNECTED");
      this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: ann });
    }
  }

  private async pauseAuction(reason: string) {
    if (this.status !== "LIVE") return;
    const currentLot = this.lots[this.activeLotIndex];
    if (currentLot && (currentLot.status === "SOLD" || currentLot.status === "UNSOLD")) {
      this.remainingMsAtPause = 3500;
    } else {
      this.remainingMsAtPause = this.timerDeadline ? Math.max(1000, this.timerDeadline - Date.now()) : 10000;
    }
    this.status = "PAUSED";
    this.pauseReason = reason;
    await this.ctx.storage.deleteAlarm();

    if (this.activeTimer) { clearTimeout(this.activeTimer); this.activeTimer = null; }
    if (this.transitionTimer) { clearTimeout(this.transitionTimer); this.transitionTimer = null; }
    if (this.aiPendingTimer) { clearTimeout(this.aiPendingTimer); this.aiPendingTimer = null; }

    this.stateVersion++;
    this.persistState();

    this.broadcast({
      type: "AUCTION_PAUSED",
      payload: {
        reason: reason === "MANUAL_HOST_PAUSE" ? "Auction paused by room host." : reason,
        remainingMs: this.remainingMsAtPause,
        stateVersion: this.stateVersion,
      },
    });

    const ann = AudioAnnouncementService.createPauseAnnouncement(reason);
    this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: ann });

    this.recordActivityEvent(
      "AUCTION_PAUSED",
      "Auction Paused",
      reason === "MANUAL_HOST_PAUSE" ? "Auction paused by host." : reason
    );
  }

  private async resumeAuction(reason: string) {
    if (this.status !== "PAUSED") return;
    this.status = "LIVE";
    this.pauseReason = null;

    if (this.activeLotIndex >= this.lots.length) {
      this.status = "COMPLETED";
      this.persistState();
      this.broadcast({ type: "AUCTION_COMPLETED", payload: { summary: {}, stateVersion: ++this.stateVersion } });
      return;
    }

    const currentLot = this.lots[this.activeLotIndex];
    if (!currentLot) return;

    if (currentLot.status === "SOLD" || currentLot.status === "UNSOLD") {
      this.activeLotIndex++;
      this.stateVersion++;
      this.persistState();
      this.broadcast({
        type: "AUCTION_RESUMED",
        payload: {
          timerDeadline: Date.now() + 10000,
          stateVersion: this.stateVersion,
        },
      });
      await this.startActiveLot();
      return;
    }

    if (currentLot.status === "PENDING") {
      this.stateVersion++;
      this.persistState();
      this.broadcast({
        type: "AUCTION_RESUMED",
        payload: {
          timerDeadline: Date.now() + 10000,
          stateVersion: this.stateVersion,
        },
      });
      await this.startActiveLot();
      return;
    }

    // Active bidding lot: resume countdown
    // Ensure generous breathing room upon resume so human users aren't immediately timed out!
    const minResidualMs = (currentLot.currentBid === 0) ? 10000 : 5000;
    const effectiveRemaining = Math.max(minResidualMs, this.remainingMsAtPause);
    this.currentTimerDurationMs = Math.max(effectiveRemaining, this.currentTimerDurationMs);
    this.timerDeadline = Date.now() + effectiveRemaining;
    await this.ctx.storage.setAlarm(this.timerDeadline);

    if (this.activeTimer) clearTimeout(this.activeTimer);
    this.activeTimer = setTimeout(async () => {
      await this.alarm();
    }, effectiveRemaining);

    this.stateVersion++;
    this.persistState();

    this.broadcast({
      type: "AUCTION_RESUMED",
      payload: {
        timerDeadline: this.timerDeadline,
        timerDurationMs: this.currentTimerDurationMs,
        stateVersion: this.stateVersion,
      },
    });

    const ann = AudioAnnouncementService.createResumeAnnouncement();
    this.broadcast({ type: "VOICE_ANNOUNCEMENT", payload: ann });

    this.recordActivityEvent(
      "AUCTION_RESUMED",
      "Auction Resumed",
      `Auction resumed (${reason})`
    );

    this.scheduleAIEvaluation();
  }

  private async ensureActiveLotProgression() {
    if (this.status !== "LIVE") return;

    // Check if an RTM decision has expired while waiting
    if (this.rtmState && this.rtmState.active) {
      if (Date.now() >= this.rtmState.timerDeadline) {
        console.log(`[AutoRecover] Resolving expired RTM decision for ${this.rtmState.eligibleFranchise}`);
        await this.resolveRTM(false, "Timeout in ensureActiveLotProgression");
        return;
      }
      return;
    }

    if (this.activeLotIndex >= this.lots.length) return;
    const currentLot = this.lots[this.activeLotIndex];
    if (!currentLot) return;
    if ((currentLot.status === "SOLD" || currentLot.status === "UNSOLD") && !this.transitionTimer && !this.activeTimer) {
      console.log(`[AutoRecover] Advancing orphaned settled lot ${currentLot.lotNumber} in room ${this.roomId}`);
      this.activeLotIndex++;
      await this.startActiveLot();
    }
  }

  private async endAuction() {
    this.status = "ENDED";
    this.pauseReason = null;
    await this.ctx.storage.deleteAlarm();
    if (this.activeTimer) { clearTimeout(this.activeTimer); this.activeTimer = null; }
    if (this.transitionTimer) { clearTimeout(this.transitionTimer); this.transitionTimer = null; }
    if (this.aiPendingTimer) { clearTimeout(this.aiPendingTimer); this.aiPendingTimer = null; }
    this.stateVersion++;
    this.persistState();

    this.recordActivityEvent(
      "AUCTION_COMPLETED",
      "Auction Concluded",
      "The auction has officially ended. Final review and reports are now available.",
      undefined,
      undefined,
      undefined
    );

    this.broadcast({
      type: "AUCTION_ENDED",
      payload: { stateVersion: this.stateVersion },
    });

    // Authoritative snapshot broadcast so every connected client transitions to Report view in real time
    this.broadcast({
      type: "ROOM_SNAPSHOT",
      payload: this.buildSnapshot(),
    });
  }

  // --- AI Bidding Scheduling ---
  private scheduleAIEvaluation() {
    if (this.status !== "LIVE") return;
    if (this.rtmState && this.rtmState.active) return;
    const currentLot = this.lots[this.activeLotIndex];
    if (!currentLot || currentLot.status !== "ACTIVE") return;

    const currentVersion = this.stateVersion;
    const { nextBid } = calculateNextLegalBid(currentLot.currentBid, currentLot.basePrice);

    const isOpeningBid = currentLot.currentBid === 0;
    let delay: number;
    if (isOpeningBid) {
      // Opening bid (18s window): Give human users a fair window of 3.5s - 10.0s before AI bot raises opening paddle
      // This allows humans to inspect the player, hear the start of announcement, and bid first if they want!
      const roll = Math.random();
      if (roll < 0.40) {
        delay = Math.floor(Math.random() * 2000) + 3500; // 3.5s - 5.5s
      } else if (roll < 0.80) {
        delay = Math.floor(Math.random() * 2500) + 5500; // 5.5s - 8.0s
      } else {
        delay = Math.floor(Math.random() * 3000) + 8500; // 8.5s - 11.5s
      }
    } else {
      // Active counter-bidding (10s timer):
      // 1. Snappy counter-bid (~30%): 400ms - 1300ms
      // 2. Deliberate evaluation (~45%): 1800ms - 3800ms
      // 3. Buzzer counter-bid (~25%): 5000ms - 6500ms
      const roll = Math.random();
      if (roll < 0.30) {
        delay = Math.floor(Math.random() * 900) + 400; // 0.4s - 1.3s
      } else if (roll < 0.75) {
        delay = Math.floor(Math.random() * 2000) + 1800; // 1.8s - 3.8s
      } else {
        delay = Math.floor(Math.random() * 1500) + 5000; // 5.0s - 6.5s
      }
    }

    // Safety: ensure delay leaves at least 2500ms for Clef-Flash evaluation before timer deadline
    if (this.timerDeadline) {
      const remainingTime = this.timerDeadline - Date.now();
      if (remainingTime > 3000) {
        delay = Math.min(delay, remainingTime - 2500);
      }
    }

    if (this.aiPendingTimer) clearTimeout(this.aiPendingTimer);
    this.aiPendingTimer = setTimeout(async () => {
      // Re-verify that state has not transitioned
      if (this.status !== "LIVE" || this.stateVersion !== currentVersion) return;
      if (this.rtmState && this.rtmState.active) return;
      if (this.activeLotIndex >= this.lots.length) return;
      const lotNow = this.lots[this.activeLotIndex];
      if (lotNow.id !== currentLot.id || lotNow.status !== "ACTIVE") return;
      if (this.timerDeadline && Date.now() >= this.timerDeadline) return;

      const teamsObj: Record<string, FranchiseState> = {};
      for (const [k, v] of this.teams.entries()) teamsObj[k] = v;

      const aiDecision = await ClefFlashService.decideNextBid(
        this.env,
        lotNow,
        teamsObj,
        nextBid,
        this.aiDifficulty,
        this.lots.length - this.activeLotIndex,
        this.lots.length
      );

      if (aiDecision.shouldBid && aiDecision.bidderFranchiseCode) {
        // Submit AI bid through standard authoritative placeBid engine
        await this.handlePlaceBid(nextBid, aiDecision.bidderFranchiseCode, lotNow.id, currentVersion);
      }
    }, delay);
  }

  // --- Chat & Events ---
  private handleSendChat(
    text: string,
    senderUserId?: string,
    senderDisplayName?: string,
    senderFranchiseCode?: string,
    senderIsGuest?: boolean
  ) {
    if (!text || text.trim().length === 0) return;
    const cleanText = text.trim().slice(0, 300);

    // Find if the sender controls any franchise in this room
    let franchiseCode: string | undefined = senderFranchiseCode;
    let franchiseName: string | undefined = undefined;

    if (!franchiseCode && senderUserId) {
      for (const t of this.teams.values()) {
        if (t.controller === "HUMAN" && t.humanUserId === senderUserId) {
          franchiseCode = t.code;
          franchiseName = t.name;
          break;
        }
      }
    } else if (franchiseCode) {
      franchiseName = this.teams.get(franchiseCode)?.name;
    }

    // Requirement 5:
    // Chat should show the name of the team if one of the team sent message.
    // If participant with logged in sent message then show name.
    // If guest sent message without login then show as Participant.
    let displayName = "Participant";
    if (franchiseCode && franchiseName) {
      displayName = franchiseName;
    } else if (!senderIsGuest && senderDisplayName && senderDisplayName !== "Participant" && senderDisplayName !== "Auction Player") {
      displayName = senderDisplayName;
    } else {
      displayName = "Participant";
    }

    const chatMsg: ChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sequence: ++this.eventSequence,
      timestamp: Date.now(),
      userId: senderUserId || "user",
      displayName,
      franchiseCode,
      isGuest: senderIsGuest,
      text: cleanText,
    };

    this.chatMessages.push(chatMsg);
    if (this.chatMessages.length > 100) this.chatMessages.shift();

    this.ctx.storage.sql.exec(
      "INSERT INTO chat_messages (sequence, data_json) VALUES (?, ?)",
      chatMsg.sequence,
      JSON.stringify(chatMsg)
    );

    this.broadcast({ type: "CHAT_MESSAGE", payload: chatMsg });
  }

  // --- Helpers ---
  private recordActivityEvent(
    type: string,
    title: string,
    description: string,
    franchiseCode?: string,
    amount?: number,
    lotNumber?: number
  ) {
    const event: AuctionEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      sequence: ++this.eventSequence,
      timestamp: Date.now(),
      title,
      description,
      franchiseCode,
      amount,
      lotNumber,
    };

    this.events.push(event);
    if (this.events.length > 200) this.events.shift();

    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO auction_events (sequence, data_json) VALUES (?, ?)",
      event.sequence,
      JSON.stringify(event)
    );

    this.broadcast({ type: "ACTIVITY_EVENT", payload: event });
  }

  private saveLot(lot: AuctionLot) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO auction_lots (lot_number, data_json) VALUES (?, ?)",
      lot.lotNumber,
      JSON.stringify(lot)
    );
  }

  private sanitizeLot(lot: AuctionLot): AuctionLot {
    // STRICT PRIVACY: Remove hidden ratings from client-facing payload
    const { hiddenRatingOverall, hiddenRatingBatting, hiddenRatingBowling, hiddenRatingKeeping, ...safeLot } = lot;
    return safeLot as AuctionLot;
  }

  private getConnectedHumanCount(): number {
    return this.ctx.getWebSockets().filter((s) => s.readyState === WebSocket.OPEN).length;
  }

  private checkInactivityTimeouts() {
    const now = Date.now();
    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

    for (const team of this.teams.values()) {
      if (team.controller === "HUMAN" && team.humanUserId) {
        const lastActive = team.lastActiveAt || 0;
        if (lastActive > 0 && now - lastActive > INACTIVITY_LIMIT_MS) {
          console.log(`[InactivityTimeout] Team ${team.name} (${team.code}) was inactive for > 15m. Automatically reassigning to AI.`);
          const prevUser = team.humanDisplayName || "Participant";
          const prevUid = team.humanUserId;

          team.controller = "AI";
          team.humanUserId = undefined;
          team.humanDisplayName = undefined;
          team.lastActiveAt = undefined;

          for (const m of this.members.values()) {
            if (m.userId === prevUid || m.claimedFranchise === team.code) {
              m.claimedFranchise = null;
            }
          }

          this.ctx.storage.sql.exec(
            "INSERT OR REPLACE INTO room_teams (code, data_json) VALUES (?, ?)",
            team.code,
            JSON.stringify(team)
          );

          this.broadcast({ type: "TEAM_UPDATED", payload: { franchise: team } });
          this.recordActivityEvent(
            "USER_DISCONNECTED",
            "Auto-Reassigned to AI",
            `${team.name} was automatically reassigned to AI due to 15 minutes of inactivity (${prevUser})`,
            team.code
          );
        }
      }
    }
  }

  private buildSnapshot(recipientFranchiseCode?: string): RoomSnapshot {
    const isLobby = this.status === "LOBBY";
    const currentLot = isLobby || this.activeLotIndex < 0 ? null : (this.lots[this.activeLotIndex] || null);
    let nextBid = 0;
    let increment = 500000;

    if (currentLot && !isLobby) {
      if (currentLot.status === "SOLD" || currentLot.status === "UNSOLD") {
        nextBid = 0;
        increment = 0;
      } else {
        const legal = calculateNextLegalBid(currentLot.currentBid, currentLot.basePrice);
        nextBid = legal.nextBid;
        increment = legal.increment;
      }
    }

    const teamsObj: Record<string, FranchiseState> = {};
    for (const [code, state] of this.teams.entries()) {
      if (isLobby && code !== recipientFranchiseCode) {
        // Requirement: In lobby no one should be able to see other teams retentions
        teamsObj[code] = {
          ...state,
          retainedPlayers: [],
          purchasedPlayers: [],
          retentionSpent: 0,
          remainingPurse: state.totalPurse,
          rtmCardsRemaining: this.ruleset === "MEGA" ? 6 : 0,
          squadCount: 0,
          overseasCount: 0,
        };
      } else {
        teamsObj[code] = state;
      }
    }

    const completedLots = isLobby
      ? 0
      : this.lots.filter((l) => l.status === "SOLD" || l.status === "UNSOLD").length;

    const membersMap = new Map<string, MemberPresence>();
    for (const m of this.members.values()) {
      if (m.connected) {
        membersMap.set(m.userId, m);
      }
    }

    const validRtmState =
      this.rtmState && this.rtmState.active && Date.now() < this.rtmState.timerDeadline
        ? this.rtmState
        : null;

    return {
      roomId: this.roomId,
      name: this.roomName,
      creatorId: this.creatorId,
      status: this.status,
      stateVersion: this.stateVersion,
      pauseReason: this.pauseReason || undefined,
      serverTime: Date.now(),
      timerDeadline: isLobby ? null : this.timerDeadline,
      timerDurationMs: this.currentTimerDurationMs || (currentLot?.currentBid ? 10000 : 18000),
      currentLot: currentLot ? this.sanitizeLot(currentLot) : null,
      nextLegalBid: isLobby ? 0 : nextBid,
      bidIncrement: isLobby ? 0 : increment,
      teams: teamsObj,
      recentEvents: this.events.slice(-60),
      recentChat: this.chatMessages.slice(-50),
      connectedHumanCount: this.getConnectedHumanCount(),
      totalLots: this.lots.length,
      completedLots,
      isPublic: this.isPublic,
      creatorTeam: this.creatorTeam || undefined,
      enableRetentions: this.enableRetentions,
      rtmState: validRtmState,
      ruleset: this.ruleset,
      members: Array.from(membersMap.values()),
    };
  }

  private broadcast(message: ServerMessage) {
    const isLobby = this.status === "LOBBY";
    const sockets = this.ctx.getWebSockets();

    if (isLobby && (message.type === "ROOM_SNAPSHOT" || message.type === "TEAM_UPDATED")) {
      for (const ws of sockets) {
        try {
          const sessId = this.socketSessionIds.get(ws);
          const member = sessId ? this.members.get(sessId) : null;
          const myFranchise = member?.claimedFranchise || undefined;

          if (message.type === "ROOM_SNAPSHOT") {
            const sanitizedSnapshot = this.buildSnapshot(myFranchise);
            ws.send(JSON.stringify({ type: "ROOM_SNAPSHOT", payload: sanitizedSnapshot }));
          } else if (message.type === "TEAM_UPDATED") {
            const t = message.payload.franchise;
            if (t.code === myFranchise) {
              ws.send(JSON.stringify(message));
            } else {
              const maskedTeam = {
                ...t,
                retainedPlayers: [],
                purchasedPlayers: [],
                retentionSpent: 0,
                remainingPurse: t.totalPurse,
                rtmCardsRemaining: this.ruleset === "MEGA" ? 6 : 0,
                squadCount: 0,
                overseasCount: 0,
              };
              ws.send(JSON.stringify({ type: "TEAM_UPDATED", payload: { franchise: maskedTeam } }));
            }
          }
        } catch (e) {
          // Socket closed
        }
      }
      return;
    }

    const serialized = JSON.stringify(message);
    for (const ws of sockets) {
      try {
        ws.send(serialized);
      } catch (e) {
        // Socket closed
      }
    }
  }
}
