import { create } from "zustand";
import { RoomSnapshot, FranchiseState, AuctionLot, AuctionEvent, ChatMessage, VoiceAnnouncementPayload } from "../lib/types";

interface AuctionStoreState {
  snapshot: RoomSnapshot | null;
  activeMobileTab: "teams" | "auction" | "activity";
  activityTab: "activity" | "chat";
  myFranchise: string | null;
  voiceEnabled: boolean;
  voiceVolume: number;
  unreadChatCount: number;
  unreadActivityCount: number;
  isUpcomingDialogOpen: boolean;
  isScrolledToBottom: boolean;
  lastVoiceAnnouncement: VoiceAnnouncementPayload | null;

  setSnapshot: (snapshot: RoomSnapshot) => void;
  setActiveMobileTab: (tab: "teams" | "auction" | "activity") => void;
  setActivityTab: (tab: "activity" | "chat") => void;
  setMyFranchise: (code: string | null) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceVolume: (volume: number) => void;
  setIsUpcomingDialogOpen: (open: boolean) => void;
  setIsScrolledToBottom: (isBottom: boolean) => void;
  resetUnreadChat: () => void;
  resetUnreadActivity: () => void;
  applyBidAccepted: (lotId: string, amount: number, franchiseCode: string, timerDeadline: number, nextLegalBid: number, bidIncrement: number | undefined, stateVersion: number) => void;
  applyTimerReset: (timerDeadline: number) => void;
  applyPlayerStarted: (lot: AuctionLot, timerDeadline: number, nextLegalBid: number | undefined, bidIncrement: number | undefined, stateVersion: number) => void;
  applyPlayerSold: (lotId: string, playerName: string, franchiseCode: string, amount: number, nextLegalBid: number | undefined, bidIncrement: number | undefined, stateVersion: number) => void;
  applyPlayerUnsold: (lotId: string, playerName: string, nextLegalBid: number | undefined, bidIncrement: number | undefined, stateVersion: number) => void;
  applyTeamUpdated: (franchise: FranchiseState) => void;
  applyTeamRatingUpdated: (franchiseCode: string, averageRating: number) => void;
  applyChatMessage: (msg: ChatMessage) => void;
  applyActivityEvent: (event: AuctionEvent) => void;
  applyVoiceAnnouncement: (ann: VoiceAnnouncementPayload) => void;
  applyAuctionPaused: (reason: string, remainingMs: number, stateVersion: number) => void;
  applyAuctionResumed: (timerDeadline: number, stateVersion: number) => void;
  applyAuctionCompleted: (stateVersion: number) => void;
  applyRtmPrompt: (rtmState: any) => void;
  applyRtmResolved: (lotId: string, exercised: boolean, winningFranchise: string, amount: number, stateVersion: number) => void;
}

export const useAuctionStore = create<AuctionStoreState>((set) => ({
  snapshot: null,
  activeMobileTab: "auction", // Mandatory default per prompt
  activityTab: "activity",
  myFranchise: null,
  voiceEnabled: true,
  voiceVolume: 0.8,
  unreadChatCount: 0,
  unreadActivityCount: 0,
  isUpcomingDialogOpen: false,
  isScrolledToBottom: true,
  lastVoiceAnnouncement: null,

  setSnapshot: (snapshot) => set({ snapshot }),
  setActiveMobileTab: (tab) => set({ activeMobileTab: tab }),
  setActivityTab: (tab) => set({ activityTab: tab }),
  setMyFranchise: (code) => set({ myFranchise: code }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setVoiceVolume: (volume) => set({ voiceVolume: volume }),
  setIsUpcomingDialogOpen: (open) => set({ isUpcomingDialogOpen: open }),
  setIsScrolledToBottom: (isBottom) => set({ isScrolledToBottom: isBottom }),
  resetUnreadChat: () => set({ unreadChatCount: 0 }),
  resetUnreadActivity: () => set({ unreadActivityCount: 0 }),

  applyBidAccepted: (lotId, amount, franchiseCode, timerDeadline, nextLegalBid, bidIncrement, stateVersion) =>
    set((state) => {
      if (!state.snapshot || !state.snapshot.currentLot) return state;
      const updatedLot = {
        ...state.snapshot.currentLot,
        currentBid: amount,
        highestBidderFranchise: franchiseCode,
      };
      return {
        snapshot: {
          ...state.snapshot,
          stateVersion,
          timerDeadline,
          nextLegalBid,
          bidIncrement: bidIncrement !== undefined ? bidIncrement : state.snapshot.bidIncrement,
          currentLot: updatedLot,
        },
      };
    }),

  applyTimerReset: (timerDeadline) =>
    set((state) => {
      if (!state.snapshot) return state;
      return {
        snapshot: {
          ...state.snapshot,
          timerDeadline,
        },
      };
    }),

  applyPlayerStarted: (lot, timerDeadline, nextLegalBid, bidIncrement, stateVersion) =>
    set((state) => {
      if (!state.snapshot) return state;
      return {
        snapshot: {
          ...state.snapshot,
          status: "LIVE",
          stateVersion,
          timerDeadline,
          nextLegalBid: nextLegalBid !== undefined ? nextLegalBid : (lot.basePrice || state.snapshot.nextLegalBid),
          bidIncrement: bidIncrement !== undefined ? bidIncrement : state.snapshot.bidIncrement,
          currentLot: lot,
          completedLots: lot.lotNumber - 1,
          rtmState: null,
        },
      };
    }),

  applyPlayerSold: (lotId, playerName, franchiseCode, amount, nextLegalBid, bidIncrement, stateVersion) =>
    set((state) => {
      if (!state.snapshot) return state;
      const currentLot = state.snapshot.currentLot
        ? {
            ...state.snapshot.currentLot,
            status: "SOLD" as const,
            soldToFranchise: franchiseCode,
            finalPrice: amount,
          }
        : null;
      return {
        snapshot: {
          ...state.snapshot,
          stateVersion,
          currentLot,
          nextLegalBid: nextLegalBid !== undefined ? nextLegalBid : state.snapshot.nextLegalBid,
          bidIncrement: bidIncrement !== undefined ? bidIncrement : state.snapshot.bidIncrement,
          rtmState: null,
        },
      };
    }),

  applyPlayerUnsold: (lotId, playerName, nextLegalBid, bidIncrement, stateVersion) =>
    set((state) => {
      if (!state.snapshot) return state;
      const currentLot = state.snapshot.currentLot
        ? {
            ...state.snapshot.currentLot,
            status: "UNSOLD" as const,
          }
        : null;
      return {
        snapshot: {
          ...state.snapshot,
          stateVersion,
          currentLot,
          nextLegalBid: nextLegalBid !== undefined ? nextLegalBid : state.snapshot.nextLegalBid,
          bidIncrement: bidIncrement !== undefined ? bidIncrement : state.snapshot.bidIncrement,
          rtmState: null,
        },
      };
    }),

  applyTeamUpdated: (franchise) =>
    set((state) => {
      if (!state.snapshot) return state;
      const isMyTeamLost = franchise.controller === "AI" && state.myFranchise === franchise.code;
      if (isMyTeamLost && typeof window !== "undefined") {
        try {
          localStorage.removeItem(`ipl_claimed_team_${state.snapshot.roomId}`);
        } catch {}
      }
      return {
        myFranchise: isMyTeamLost ? null : state.myFranchise,
        snapshot: {
          ...state.snapshot,
          teams: {
            ...state.snapshot.teams,
            [franchise.code]: franchise,
          },
        },
      };
    }),

  applyTeamRatingUpdated: (franchiseCode, averageRating) =>
    set((state) => {
      if (!state.snapshot) return state;
      const existing = state.snapshot.teams[franchiseCode];
      if (!existing) return state;
      return {
        snapshot: {
          ...state.snapshot,
          teams: {
            ...state.snapshot.teams,
            [franchiseCode]: {
              ...existing,
              averageRating,
            },
          },
        },
      };
    }),

  applyChatMessage: (msg) =>
    set((state) => {
      if (!state.snapshot) return state;
      const isViewingChat = state.activityTab === "chat" && (state.activeMobileTab === "activity" || typeof window !== "undefined" && window.innerWidth >= 1024);
      return {
        snapshot: {
          ...state.snapshot,
          recentChat: [...state.snapshot.recentChat.slice(-49), msg],
        },
        unreadChatCount: isViewingChat ? 0 : state.unreadChatCount + 1,
      };
    }),

  applyActivityEvent: (event) =>
    set((state) => {
      if (!state.snapshot) return state;
      if (
        state.snapshot.recentEvents.some(
          (e) => (event.sequence && e.sequence === event.sequence) || (event.id && e.id === event.id)
        )
      ) {
        return state;
      }
      return {
        snapshot: {
          ...state.snapshot,
          recentEvents: [...state.snapshot.recentEvents.slice(-99), event],
        },
        unreadActivityCount: state.activityTab === "activity" ? 0 : state.unreadActivityCount + 1,
      };
    }),

  applyVoiceAnnouncement: (ann) => set({ lastVoiceAnnouncement: ann }),

  applyAuctionPaused: (reason, remainingMs, stateVersion) =>
    set((state) => {
      if (!state.snapshot) return state;
      return {
        snapshot: {
          ...state.snapshot,
          status: "PAUSED",
          pauseReason: reason,
          stateVersion,
        },
      };
    }),

  applyAuctionResumed: (timerDeadline, stateVersion) =>
    set((state) => {
      if (!state.snapshot) return state;
      return {
        snapshot: {
          ...state.snapshot,
          status: "LIVE",
          pauseReason: undefined,
          timerDeadline,
          stateVersion,
        },
      };
    }),

  applyAuctionCompleted: (stateVersion) =>
    set((state) => {
      if (!state.snapshot) return state;
      return {
        snapshot: {
          ...state.snapshot,
          status: "COMPLETED",
          stateVersion,
        },
      };
    }),

  applyRtmPrompt: (rtmState) =>
    set((state) => {
      if (!state.snapshot) return state;
      return {
        snapshot: {
          ...state.snapshot,
          rtmState,
        },
      };
    }),

  applyRtmResolved: (lotId, exercised, winningFranchise, amount, stateVersion) =>
    set((state) => {
      if (!state.snapshot) return state;
      return {
        snapshot: {
          ...state.snapshot,
          rtmState: null,
          stateVersion,
        },
      };
    }),
}));
