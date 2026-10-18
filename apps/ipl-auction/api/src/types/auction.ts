export type AuctionPhase = "LOBBY" | "LIVE" | "PAUSED" | "ENDED" | "COMPLETED";

export type PlayerRole = "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";

export interface RetainedPlayerInfo {
  id: string;
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  isCapped: boolean;
  retentionPrice: number; // in Rupees
  slotNumber: number; // 1 to 6
}

export interface RTMState {
  active: boolean;
  lotId: string;
  lotNumber: number;
  playerName: string;
  playerRole: PlayerRole;
  isOverseas: boolean;
  highestBidderFranchise: string; // The team that placed the highest hammer bid (Team X)
  finalBidAmount: number; // Amount to match (₹Y)
  eligibleFranchise: string; // Player's former team holding RTM card (Team Z)
  eligibleFranchiseOwnerId?: string;
  isEligibleHuman: boolean;
  timerDeadline: number; // 10s countdown to decide RTM
  status: "PENDING_DECISION" | "MATCHED" | "DECLINED";
}

export interface FranchiseState {
  code: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  totalPurse: number;
  remainingPurse: number;
  squadCount: number;
  minSquad: number;
  maxSquad: number;
  overseasCount: number;
  maxOverseas: number;
  controller: "HUMAN" | "AI";
  humanUserId?: string;
  humanDisplayName?: string;
  lastActiveAt?: number;
  averageRating: number | null; // Overall team score: Players Rating (60%) + Squad Balance (25%) + Purse Health (15%)
  playersRating?: number | null;
  squadBalanceRating?: number | null;
  purseBalanceRating?: number | null;
  bestXIRating?: number | null;
  benchRating?: number | null;
  depthBonus?: number | null;
  bestXIPlayerIds?: string[];
  impactSubPlayerId?: string | null;
  purchasedPlayers: PurchasedPlayerRecord[];
  rtmCardsRemaining: number;
  retainedPlayers: RetainedPlayerInfo[];
  retentionSpent: number;
}

export interface PurchasedPlayerRecord {
  id: string;
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  purchasePrice: number;
  lotNumber: number;
  soldAt: number;
  isRetained?: boolean;
  isRtmMatch?: boolean;
  rating?: number;
}

export interface AuctionLot {
  id: string;
  lotNumber: number;
  setId: string;
  setCode: string;
  setName: string;
  orderInSet: number;
  playerId: string;
  playerName: string;
  country: string;
  isOverseas: boolean;
  role: PlayerRole;
  battingStyle: string;
  bowlingStyle: string;
  basePrice: number;
  matches: number;
  runs: number;
  battingAverage: number;
  strikeRate: number;
  wickets: number;
  economy: number;
  isCapped: boolean;
  previousFranchise?: string | null;
  lastYearPrice?: number | null;
  // Hidden ratings: NEVER exposed to client in public messages!
  hiddenRatingOverall?: number;
  hiddenRatingBatting?: number;
  hiddenRatingBowling?: number;
  hiddenRatingKeeping?: number;
  // Lot Status
  status: "PENDING" | "ACTIVE" | "SOLD" | "UNSOLD";
  currentBid: number;
  highestBidderFranchise: string | null;
  soldToFranchise: string | null;
  finalPrice: number | null;
}

export interface AuctionEvent {
  id: string;
  type: string;
  sequence: number;
  timestamp: number;
  title: string;
  description: string;
  franchiseCode?: string;
  amount?: number;
  lotNumber?: number;
}

export interface ChatMessage {
  id: string;
  sequence: number;
  timestamp: number;
  userId: string;
  displayName: string;
  franchiseCode?: string;
  text: string;
  isGuest?: boolean;
}

export interface VoiceAnnouncementPayload {
  sequence: number;
  timestamp: number;
  eventType: "PLAYER_ANNOUNCED" | "NEW_BID" | "SOLD" | "UNSOLD" | "PAUSED" | "RESUMED";
  text: string;
  playerName?: string;
  amount?: number;
  franchiseName?: string;
}

export interface RoomSnapshot {
  roomId: string;
  name: string;
  creatorId: string;
  status: AuctionPhase;
  stateVersion: number;
  pauseReason?: string;
  serverTime: number;
  timerDeadline: number | null;
  timerDurationMs: number;
  currentLot: AuctionLot | null;
  nextLegalBid: number;
  bidIncrement: number;
  teams: Record<string, FranchiseState>;
  recentEvents: AuctionEvent[];
  recentChat: ChatMessage[];
  connectedHumanCount: number;
  totalLots: number;
  completedLots: number;
  isPublic?: boolean;
  creatorTeam?: string;
  enableRetentions?: boolean;
  rtmState?: RTMState | null;
  ruleset?: "MEGA" | "CLASSIC" | "SPRINT_XI";
  currentUserId?: string;
  clientIp?: string;
  members?: MemberPresence[];
}

export interface MemberPresence {
  sessionId: string;
  userId: string;
  displayName: string;
  isGuest: boolean;
  claimedFranchise: string | null;
  connected: boolean;
  lastSeen: number;
}

// Client Commands
export type ClientCommand =
  | { type: "JOIN_ROOM"; roomId: string; sessionId: string; userId?: string; displayName: string; isGuest: boolean; claimedFranchise?: string }
  | { type: "CLAIM_TEAM"; franchiseCode: string; userId?: string }
  | { type: "TAKE_OVER_TEAM"; franchiseCode: string; userId?: string }
  | { type: "REASSIGN_TO_BOT"; franchiseCode: string; userId?: string; isCreator?: boolean }
  | { type: "BAN_USER"; targetUserId: string; franchiseCode?: string; reason?: string; userId?: string }
  | { type: "KICK_USER"; targetUserId: string; reason?: string; userId?: string }
  | { type: "RELEASE_TEAM"; franchiseCode?: string; userId?: string }
  | { type: "UPDATE_DISPLAY_NAME"; displayName: string; sessionId?: string; userId?: string }
  | { type: "START_AUCTION" }
  | { type: "PLACE_BID"; amount: number; franchiseCode: string; lotId: string; stateVersion: number }
  | { type: "PAUSE_AUCTION"; reason?: string }
  | { type: "RESUME_AUCTION" }
  | { type: "END_AUCTION" }
  | { type: "SEND_CHAT"; text: string; userId?: string; displayName?: string; franchiseCode?: string; isGuest?: boolean }
  | { type: "REQUEST_SNAPSHOT" }
  | { type: "REQUEST_UPCOMING_SETS" }
  | { type: "SET_RETENTIONS"; franchiseCode: string; playerIds: string[]; userId?: string; isCreator?: boolean }
  | { type: "RTM_DECISION"; exercise: boolean; userId?: string };

// Server Events
export type ServerMessage =
  | { type: "ROOM_SNAPSHOT"; payload: RoomSnapshot }
  | { type: "USER_IDENTIFIED"; payload: { userId: string; clientIp: string } }
  | { type: "KICKED_FROM_ROOM"; payload: { reason: string } }
  | { type: "BANNED_FROM_ROOM"; payload: { reason: string } }
  | { type: "ERROR"; payload: { message: string } }
  | { type: "RETENTIONS_SAVED"; payload: any }
  | { type: "ROOM_UPDATED"; payload: { status: AuctionPhase; pauseReason?: string; stateVersion: number } }
  | { type: "PLAYER_STARTED"; payload: { lot: AuctionLot; timerDeadline: number; timerDurationMs?: number; nextLegalBid?: number; bidIncrement?: number; stateVersion: number } }
  | { type: "BID_ACCEPTED"; payload: { lotId: string; amount: number; franchiseCode: string; timerDeadline: number; timerDurationMs?: number; nextLegalBid: number; bidIncrement?: number; stateVersion: number } }
  | { type: "BID_REJECTED"; payload: { reason: string; stateVersion: number } }
  | { type: "TIMER_RESET"; payload: { timerDeadline: number; timerDurationMs?: number; remainingMs: number } }
  | { type: "PLAYER_SOLD"; payload: { lotId: string; playerName: string; franchiseCode: string; amount: number; nextLegalBid?: number; bidIncrement?: number; nextPlayerName?: string; stateVersion: number } }
  | { type: "PLAYER_UNSOLD"; payload: { lotId: string; playerName: string; nextLegalBid?: number; bidIncrement?: number; nextPlayerName?: string; stateVersion: number } }
  | { type: "TEAM_UPDATED"; payload: { franchise: FranchiseState } }
  | { type: "TEAM_RATING_UPDATED"; payload: { franchiseCode: string; averageRating: number } }
  | { type: "ACTIVITY_EVENT"; payload: AuctionEvent }
  | { type: "CHAT_MESSAGE"; payload: ChatMessage }
  | { type: "USER_CONNECTED"; payload: { userId: string; displayName: string; connectedHumanCount: number } }
  | { type: "USER_DISCONNECTED"; payload: { userId: string; displayName: string; connectedHumanCount: number } }
  | { type: "AUCTION_PAUSED"; payload: { reason: string; remainingMs: number; stateVersion: number } }
  | { type: "AUCTION_RESUMED"; payload: { timerDeadline: number; timerDurationMs?: number; stateVersion: number } }
  | { type: "AUCTION_ENDED"; payload: { stateVersion: number } }
  | { type: "AUCTION_COMPLETED"; payload: { summary: any; stateVersion: number } }
  | { type: "VOICE_ANNOUNCEMENT"; payload: VoiceAnnouncementPayload }
  | { type: "BANNED_FROM_ROOM"; payload: { reason: string } }
  | { type: "RTM_PROMPT"; payload: RTMState }
  | { type: "RTM_RESOLVED"; payload: { lotId: string; exercised: boolean; winningFranchise: string; amount: number; stateVersion: number } }
  | { type: "ERROR"; payload: { message: string } };

export function getBidIncrement(bidAmount: number): number {
  if (bidAmount < 10000000) {
    return 500000; // ₹5 Lakh (< ₹1 Cr)
  } else if (bidAmount < 20000000) {
    return 1000000; // ₹10 Lakh (₹1 Cr - ₹2 Cr)
  } else if (bidAmount < 50000000) {
    return 2000000; // ₹20 Lakh (₹2 Cr - ₹5 Cr)
  } else {
    return 5000000; // ₹50 Lakh (>= ₹5 Cr)
  }
}

export function calculateNextLegalBid(currentBid: number, basePrice: number): { nextBid: number; increment: number } {
  if (currentBid <= 0) {
    return { nextBid: basePrice, increment: getBidIncrement(basePrice) };
  }
  const increment = getBidIncrement(currentBid);
  return { nextBid: currentBid + increment, increment };
}
