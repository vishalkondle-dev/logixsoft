"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuctionStore } from "../stores/auctionStore";
import { useAuthStore } from "../stores/authStore";
import { ServerMessage } from "../lib/types";
import { playSoldGavelSound } from "../lib/auctionSound";

export function useAuctionRoom(roomId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);

  const { user, isAuthenticated } = useAuthStore();

  const {
    setSnapshot,
    applyBidAccepted,
    applyTimerReset,
    applyPlayerStarted,
    applyPlayerSold,
    applyPlayerUnsold,
    applyTeamUpdated,
    applyTeamRatingUpdated,
    applyChatMessage,
    applyActivityEvent,
    applyVoiceAnnouncement,
    applyAuctionPaused,
    applyAuctionResumed,
    applyAuctionCompleted,
    applyRtmPrompt,
    applyRtmResolved,
    myFranchise,
    setMyFranchise,
  } = useAuctionStore();

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ipl_auction_ip_user_id") || "";
    }
    return "";
  });

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: any) => {
        if (data?.userId) {
          setCurrentUserId(data.userId);
          try {
            localStorage.setItem("ipl_auction_ip_user_id", data.userId);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const getPersistentUserId = useCallback((): string => {
    if (typeof window === "undefined") return "guest";
    const key = "ipl_auction_user_id";
    let uid = localStorage.getItem(key);
    if (!uid) {
      uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(key, uid);
    }
    return uid;
  }, []);

  const getClaimedFranchiseForRoom = useCallback((rId: string): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`ipl_claimed_team_${rId}`);
  }, []);

  const setClaimedFranchiseForRoom = useCallback((rId: string, code: string | null) => {
    if (typeof window === "undefined") return;
    if (code) {
      localStorage.setItem(`ipl_claimed_team_${rId}`, code);
    } else {
      localStorage.removeItem(`ipl_claimed_team_${rId}`);
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomId) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "auction.logixsoft.in";
    const defaultWsUrl = `${protocol}//${host}`;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || defaultWsUrl;
    const fullWsUrl = `${wsUrl}/api/rooms/${roomId}/ws`;

    try {
      const socket = new WebSocket(fullWsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        // Authoritative Handshake with IP-based user identity and saved franchise
        const storedIpUid = typeof window !== "undefined" ? localStorage.getItem("ipl_auction_ip_user_id") : null;
        const userId = currentUserId && currentUserId.startsWith("ip_") ? currentUserId : (storedIpUid || getPersistentUserId());
        const savedTeam = getClaimedFranchiseForRoom(roomId);
        const storedName = typeof window !== "undefined" ? localStorage.getItem("ipl_auction_user_name") : null;
        const displayName = isAuthenticated && user?.name ? user.name : (storedName || "Participant");
        const sessId = sessionIdRef.current || `sess_${Math.random().toString(36).substring(2, 9)}`;
        sessionIdRef.current = sessId;
        const joinPayload = {
          type: "JOIN_ROOM",
          roomId,
          sessionId: sessId,
          userId,
          displayName,
          claimedFranchise: savedTeam || undefined,
          isGuest: !isAuthenticated,
        };
        socket.send(JSON.stringify(joinPayload));
      };

      socket.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (err) {
          console.error("Failed to parse incoming WebSocket message:", err);
        }
      };

      socket.onerror = (e) => {
        console.warn("WebSocket error occurred:", e);
        setConnectionError("Connection issue detected.");
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Resilient automatic reconnection
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };
    } catch (err: any) {
      setConnectionError(err?.message || "Failed to establish WebSocket");
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [roomId]);

  const handleServerMessage = (message: any) => {
    switch (message.type) {
      case "USER_IDENTIFIED": {
        const { userId } = message.payload;
        if (userId) {
          setCurrentUserId(userId);
          try {
            localStorage.setItem("ipl_auction_ip_user_id", userId);
          } catch {}
        }
        break;
      }

      case "ROOM_SNAPSHOT": {
        const snapshot = message.payload;
        setSnapshot(snapshot);
        // Calculate server clock offset
        const localNow = Date.now();
        if (snapshot.serverTime) {
          setServerTimeOffset(snapshot.serverTime - localNow);
        }

        // Restore claimed franchise if already owned or saved in localStorage
        const storedIp = typeof window !== "undefined" ? localStorage.getItem("ipl_auction_ip_user_id") : null;
        const myUid = snapshot.currentUserId || currentUserId || storedIp || getPersistentUserId();
        const savedTeam = getClaimedFranchiseForRoom(roomId);
        let myTeamCode: string | null = null;
        for (const t of Object.values(snapshot.teams || {})) {
          const team = t as { code: string; humanUserId?: string; controller?: string };
          if (team.humanUserId === myUid) {
            myTeamCode = team.code;
            break;
          }
        }
        if (!myTeamCode && savedTeam && snapshot.teams?.[savedTeam]?.controller === "HUMAN") {
          myTeamCode = savedTeam;
        }
        if (myTeamCode) {
          setMyFranchise(myTeamCode);
          setClaimedFranchiseForRoom(roomId, myTeamCode);
        }
        break;
      }

      case "ERROR": {
        console.error("[AuctionRoom WS Error]", message.payload?.message);
        if (typeof window !== "undefined" && message.payload?.message) {
          alert(`Auction Error: ${message.payload.message}`);
        }
        break;
      }

      case "RETENTIONS_SAVED": {
        console.log("[AuctionRoom] Retentions successfully saved on server:", message.payload);
        if (message.payload?.franchise) {
          applyTeamUpdated(message.payload.franchise);
        }
        break;
      }

      case "BID_ACCEPTED": {
        const p = message.payload;
        applyBidAccepted(p.lotId, p.amount, p.franchiseCode, p.timerDeadline, p.nextLegalBid, p.bidIncrement, p.stateVersion, p.timerDurationMs);
        break;
      }

      case "TIMER_RESET": {
        applyTimerReset(message.payload.timerDeadline, message.payload.timerDurationMs);
        break;
      }

      case "PLAYER_STARTED": {
        const p = message.payload;
        applyPlayerStarted(p.lot, p.timerDeadline, p.nextLegalBid, p.bidIncrement, p.stateVersion, p.timerDurationMs);
        break;
      }

      case "PLAYER_SOLD": {
        const p = message.payload;
        playSoldGavelSound();
        applyPlayerSold(p.lotId, p.playerName, p.franchiseCode, p.amount, p.nextLegalBid, p.bidIncrement, p.stateVersion);
        break;
      }

      case "PLAYER_UNSOLD": {
        const p = message.payload;
        applyPlayerUnsold(p.lotId, p.playerName, p.nextLegalBid, p.bidIncrement, p.stateVersion);
        break;
      }

      case "TEAM_UPDATED": {
        applyTeamUpdated(message.payload.franchise);
        break;
      }

      case "TEAM_RATING_UPDATED": {
        applyTeamRatingUpdated(message.payload.franchiseCode, message.payload.averageRating);
        break;
      }

      case "CHAT_MESSAGE": {
        applyChatMessage(message.payload);
        break;
      }

      case "ACTIVITY_EVENT": {
        applyActivityEvent(message.payload);
        break;
      }

      case "VOICE_ANNOUNCEMENT": {
        applyVoiceAnnouncement(message.payload);
        break;
      }

      case "AUCTION_PAUSED": {
        applyAuctionPaused(message.payload.reason, message.payload.remainingMs, message.payload.stateVersion);
        break;
      }

      case "AUCTION_RESUMED": {
        applyAuctionResumed(message.payload.timerDeadline, message.payload.stateVersion, message.payload.timerDurationMs);
        break;
      }

      case "AUCTION_ENDED":
      case "AUCTION_COMPLETED": {
        applyAuctionCompleted(message.payload.stateVersion);
        break;
      }

      case "RTM_PROMPT": {
        applyRtmPrompt(message.payload);
        break;
      }

      case "RTM_RESOLVED": {
        const p = message.payload;
        applyRtmResolved(p.lotId, p.exercised, p.winningFranchise, p.amount, p.stateVersion);
        break;
      }

      case "BANNED_FROM_ROOM": {
        setConnectionError("You have been banned from this room by the host.");
        alert("You have been banned from this room by the host.");
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
        break;
      }

      case "KICKED_FROM_ROOM": {
        setConnectionError("You were removed from the lobby by the host.");
        alert("You were removed from the lobby by the host.");
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
        break;
      }
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Command Dispatchers
  const placeBid = useCallback((amount: number, franchiseCode: string, lotId: string, stateVersion: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "PLACE_BID",
          amount,
          franchiseCode,
          lotId,
          stateVersion,
        })
      );
    }
  }, []);

  const claimTeam = useCallback((franchiseCode: string) => {
    const userId = currentUserId || getPersistentUserId();
    setClaimedFranchiseForRoom(roomId, franchiseCode);
    setMyFranchise(franchiseCode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CLAIM_TEAM", franchiseCode, userId }));
    }
  }, [roomId, setMyFranchise, currentUserId, getPersistentUserId, setClaimedFranchiseForRoom]);

  const takeOverTeam = useCallback((franchiseCode: string) => {
    const userId = currentUserId || getPersistentUserId();
    setClaimedFranchiseForRoom(roomId, franchiseCode);
    setMyFranchise(franchiseCode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "TAKE_OVER_TEAM", franchiseCode, userId }));
    }
  }, [roomId, setMyFranchise, currentUserId, getPersistentUserId, setClaimedFranchiseForRoom]);

  const reassignToBot = useCallback((franchiseCode: string) => {
    const userId = currentUserId || getPersistentUserId();
    const isCreator = typeof window !== "undefined" && localStorage.getItem(`ipl_room_creator_${roomId}`) === "true";
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "REASSIGN_TO_BOT", franchiseCode, userId, isCreator }));
    }
  }, [currentUserId, getPersistentUserId, roomId]);

  const banUser = useCallback((targetUserId: string, franchiseCode?: string, reason?: string) => {
    const userId = currentUserId || getPersistentUserId();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "BAN_USER", targetUserId, franchiseCode, reason, userId }));
    }
  }, [currentUserId, getPersistentUserId]);

  const kickUser = useCallback((targetUserId: string, reason?: string) => {
    const userId = currentUserId || getPersistentUserId();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "KICK_USER", targetUserId, reason, userId }));
    }
  }, [currentUserId, getPersistentUserId]);

  const releaseTeam = useCallback(() => {
    const userId = currentUserId || getPersistentUserId();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "RELEASE_TEAM", userId, franchiseCode: myFranchise }));
    }
    setMyFranchise(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`ipl_claimed_team_${roomId}`);
    }
  }, [currentUserId, getPersistentUserId, myFranchise, roomId, setMyFranchise]);

  const startAuction = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "START_AUCTION" }));
    }
  }, []);

  const pauseAuction = useCallback((reason?: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "PAUSE_AUCTION", reason }));
    }
  }, []);

  const resumeAuction = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "RESUME_AUCTION" }));
    }
  }, []);

  const endAuction = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "END_AUCTION" }));
    }
  }, []);

  const sendChat = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const storedName = typeof window !== "undefined" ? localStorage.getItem("ipl_auction_user_name") : null;
      const displayName = isAuthenticated && user?.name ? user.name : (storedName || "Participant");
      wsRef.current.send(JSON.stringify({
        type: "SEND_CHAT",
        text,
        userId: currentUserId,
        displayName,
        franchiseCode: myFranchise || undefined,
        isGuest: !isAuthenticated,
      }));
    }
  }, [currentUserId, myFranchise, user, isAuthenticated]);

  const setRetentions = useCallback((franchiseCode: string, playerIds: string[]) => {
    const userId = currentUserId || getPersistentUserId();
    const isCreator = typeof window !== "undefined" && localStorage.getItem(`ipl_room_creator_${roomId}`) === "true";
    setClaimedFranchiseForRoom(roomId, franchiseCode);
    setMyFranchise(franchiseCode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "SET_RETENTIONS", franchiseCode, playerIds, userId, isCreator }));
    }
  }, [currentUserId, getPersistentUserId, roomId, setMyFranchise, setClaimedFranchiseForRoom]);

  const decideRtm = useCallback((exercise: boolean) => {
    const userId = currentUserId || getPersistentUserId();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "RTM_DECISION", exercise, userId }));
    }
  }, [currentUserId, getPersistentUserId]);

  const updateDisplayName = useCallback((name: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "UPDATE_DISPLAY_NAME",
          sessionId: sessionIdRef.current,
          displayName: name,
          userId: currentUserId || getPersistentUserId(),
        })
      );
    }
  }, [currentUserId, getPersistentUserId]);

  return {
    isConnected,
    connectionError,
    serverTimeOffset,
    placeBid,
    claimTeam,
    takeOverTeam,
    reassignToBot,
    banUser,
    kickUser,
    releaseTeam,
    startAuction,
    pauseAuction,
    resumeAuction,
    endAuction,
    sendChat,
    setRetentions,
    decideRtm,
    updateDisplayName,
    currentUserId: currentUserId || getPersistentUserId(),
  };
}
