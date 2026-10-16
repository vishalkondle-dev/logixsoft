"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Loader, Stack, Text } from "@mantine/core";
import { useRoomRouteGuard } from "../../../hooks/useRoomRouteGuard";
import { InvalidRoomError } from "../../../components/common/InvalidRoomError";

export default function LegacyRoomRedirectPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const rawRoomId = resolvedParams.roomId;
  const roomId = rawRoomId.startsWith("room_") ? rawRoomId : rawRoomId.toUpperCase();

  const { isValidating, isInvalidRoom, errorMessage, snapshot } = useRoomRouteGuard(roomId, "auction");

  useEffect(() => {
    if (!snapshot || isValidating || isInvalidRoom) return;

    const phase = snapshot.status;
    if (phase === "LOBBY" || (phase as string) === "PENDING") {
      router.replace(`/lobby/${roomId}`);
    } else if (phase === "LIVE" || phase === "PAUSED") {
      router.replace(`/auction/${roomId}`);
    } else if (phase === "ENDED" || phase === "COMPLETED") {
      router.replace(`/summary/${roomId}`);
    }
  }, [snapshot, roomId, router, isValidating, isInvalidRoom]);

  if (isInvalidRoom) {
    return <InvalidRoomError roomId={roomId} errorMessage={errorMessage || undefined} />;
  }

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
          Redirecting to Auction Flow...
        </Text>
        <Text size="xs" c="dimmed">
          Checking live status of room {roomId}
        </Text>
      </Stack>
    </Box>
  );
}
