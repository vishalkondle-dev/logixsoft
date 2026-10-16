"use client";

import React, { use } from "react";
import { useRoomRouteGuard } from "../../../hooks/useRoomRouteGuard";
import { useAuctionRoom } from "../../../hooks/useAuctionRoom";
import { useAuctionStore } from "../../../stores/auctionStore";
import { TopNavBar } from "../../../components/layout/TopNavBar";
import { AuctionReviewReport } from "../../../components/auction/AuctionReviewReport";
import { InvalidRoomError } from "../../../components/common/InvalidRoomError";

export default function SummaryPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = use(params);
  const rawRoomId = resolvedParams.roomId;
  const roomId = rawRoomId.startsWith("room_") ? rawRoomId : rawRoomId.toUpperCase();

  // Validate room status: only available for ended/completed rooms
  // If lobby -> redirects to /lobby/[roomId]
  // If live/paused -> redirects to /auction/[roomId]
  const { isValidating, isInvalidRoom, errorMessage } = useRoomRouteGuard(roomId, "summary");

  const { startAuction } = useAuctionRoom(roomId);
  const { snapshot } = useAuctionStore();

  // If probing or invalid
  if (isInvalidRoom) {
    return <InvalidRoomError roomId={roomId} errorMessage={errorMessage || undefined} />;
  }

  if (isValidating || !snapshot) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground space-y-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <span className="text-2xl">🏆</span>
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono text-sm font-bold text-foreground">Generating Post-Auction Summary...</p>
          <p className="text-xs text-muted-foreground">Compiling team squads and awards for {roomId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground select-none">
      <TopNavBar roomId={roomId} roomName={snapshot?.name} />
      <main className="flex-1 overflow-hidden min-h-0 relative">
        <AuctionReviewReport snapshot={snapshot} onRestart={startAuction} />
      </main>
    </div>
  );
}
