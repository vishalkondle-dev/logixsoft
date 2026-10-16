"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuctionStore } from "../stores/auctionStore";
import { RoomSnapshot } from "../lib/types";

export type ExpectedRouteType = "lobby" | "auction" | "summary";

export function useRoomRouteGuard(roomId: string, expectedPage: ExpectedRouteType) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(true);
  const [isInvalidRoom, setIsInvalidRoom] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { snapshot, setSnapshot } = useAuctionStore();

  // Initial HTTP probe to check room existence and current phase
  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;

    async function probeRoom() {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (isCancelled) return;

        if (res.status === 404) {
          setIsInvalidRoom(true);
          setErrorMessage("This auction room does not exist.");
          setIsValidating(false);
          return;
        }

        if (!res.ok) {
          setIsInvalidRoom(true);
          setErrorMessage(`Error contacting auction server (${res.status})`);
          setIsValidating(false);
          return;
        }

        const data = await res.json();
        if (isCancelled) return;

        if (!data?.valid || !data?.snapshot) {
          setIsInvalidRoom(true);
          setErrorMessage(data?.error || "Invalid auction room ID");
          setIsValidating(false);
          return;
        }

        const snap: RoomSnapshot = data.snapshot;
        setSnapshot(snap);
        setIsValidating(false);

        // Check if current page is valid for this phase
        const phase = snap.status;
        if (phase === "LOBBY" || (phase as string) === "PENDING") {
          if (expectedPage !== "lobby") {
            router.replace(`/lobby/${roomId}`);
          }
        } else if (phase === "LIVE" || phase === "PAUSED") {
          if (expectedPage !== "auction") {
            router.replace(`/auction/${roomId}`);
          }
        } else if (phase === "ENDED" || phase === "COMPLETED") {
          if (expectedPage !== "summary") {
            router.replace(`/summary/${roomId}`);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setIsInvalidRoom(true);
          setErrorMessage(err?.message || "Failed to reach auction arena");
          setIsValidating(false);
        }
      }
    }

    probeRoom();

    return () => {
      isCancelled = true;
    };
  }, [roomId, expectedPage, router, setSnapshot]);

  // Reactive subscription to WebSocket state changes (e.g. host starts auction or auction completes)
  useEffect(() => {
    if (!snapshot || isValidating || isInvalidRoom) return;

    const phase = snapshot.status;
    if (phase === "LOBBY" || (phase as string) === "PENDING") {
      if (expectedPage !== "lobby") {
        router.replace(`/lobby/${roomId}`);
      }
    } else if (phase === "LIVE" || phase === "PAUSED") {
      if (expectedPage !== "auction") {
        router.replace(`/auction/${roomId}`);
      }
    } else if (phase === "ENDED" || phase === "COMPLETED") {
      if (expectedPage !== "summary") {
        router.replace(`/summary/${roomId}`);
      }
    }
  }, [snapshot?.status, expectedPage, roomId, router, isValidating, isInvalidRoom]);

  return {
    isValidating,
    isInvalidRoom,
    errorMessage,
    snapshot,
  };
}
