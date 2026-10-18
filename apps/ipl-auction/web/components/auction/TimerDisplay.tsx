"use client";

import React, { useEffect, useRef } from "react";
import { useSyncTimer } from "../../hooks/useSyncTimer";
import { Box, Group, Text, Progress, Badge } from "@mantine/core";
import { Clock, Warning } from "@phosphor-icons/react";
import { playTickSound } from "../../lib/auctionSound";

interface TimerDisplayProps {
  timerDeadline: number | null;
  serverOffset?: number;
  isPaused?: boolean;
  compact?: boolean;
  className?: string;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  timerDeadline,
  serverOffset = 0,
  isPaused = false,
  compact = false,
  className,
}) => {
  const { secondsLeft, remainingMs, percentage, isUrgent, isExpired } = useSyncTimer(
    isPaused ? null : timerDeadline,
    serverOffset
  );

  const lastTickedSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused || !timerDeadline || remainingMs <= 0) {
      lastTickedSecondRef.current = null;
      return;
    }

    if (secondsLeft >= 1 && secondsLeft <= 3) {
      if (lastTickedSecondRef.current !== secondsLeft) {
        lastTickedSecondRef.current = secondsLeft;
        playTickSound(secondsLeft);
      }
    } else {
      lastTickedSecondRef.current = null;
    }
  }, [secondsLeft, isPaused, timerDeadline, remainingMs]);

  const progressColor = isPaused
    ? "yellow"
    : isUrgent
    ? "red"
    : percentage > 50
    ? "blue"
    : "orange";

  return (
    <Box w="100%" className={className}>
      <Group justify="space-between" mb={compact ? 2 : 4}>
        <Group gap={4}>
          <Clock size={compact ? 14 : 16} weight="bold" color="#748ffc" />
          {!compact && (
            <Text size="11px" fw={800} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.05em" }}>
              {isPaused ? "Countdown Paused" : "Hammer Countdown"}
            </Text>
          )}
        </Group>

        <Group gap={4}>
          {isUrgent && !isPaused && <Warning size={14} weight="fill" color="#fa5252" />}
          <Text
            size={compact ? "xs" : "sm"}
            fw={900}
            ff="monospace"
            c={isPaused ? "yellow.4" : isUrgent ? "red.5" : "white"}
          >
            {isPaused ? "PAUSED" : `${secondsLeft}s`}
          </Text>
        </Group>
      </Group>

      <Progress
        value={isPaused ? 50 : percentage}
        color={progressColor}
        size={compact ? "xs" : "sm"}
        radius="xl"
        animated={isUrgent && !isPaused}
      />
    </Box>
  );
};
