"use client";

import React, { use } from "react";
import { Box, Loader, Stack, Text, Paper } from "@mantine/core";
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
      <Box
        style={{
          minHeight: "100dvh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--mantine-color-body)",
        }}
      >
        <Stack align="center" gap="xs">
          <Loader size="lg" color="orange" />
          <Text size="sm" fw={700} ff="monospace">
            Generating Post-Auction Summary...
          </Text>
          <Text size="xs" c="dimmed">
            Compiling team squads and awards for {roomId}
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "var(--mantine-color-body)",
        userSelect: "none",
      }}
    >
      <TopNavBar roomId={roomId} roomName={snapshot?.name} />
      <Box component="main" style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        <AuctionReviewReport snapshot={snapshot} onRestart={startAuction} />
      </Box>
    </Box>
  );
}
