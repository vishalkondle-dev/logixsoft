"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground space-y-4">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <span className="text-2xl">🏏</span>
      </div>
      <div className="text-center space-y-1">
        <p className="font-mono text-sm font-bold text-foreground">Redirecting to Auction Flow...</p>
        <p className="text-xs text-muted-foreground">Checking live status of room {roomId}</p>
      </div>
    </div>
  );
}
