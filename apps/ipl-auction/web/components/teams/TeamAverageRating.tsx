"use client";

import React from "react";
import { Badge, Tooltip, Text, Group } from "@mantine/core";

interface TeamAverageRatingProps {
  rating: number | null;
  playerCount: number;
  playersRating?: number | null;
  squadBalanceRating?: number | null;
  purseBalanceRating?: number | null;
  className?: string;
}

export const TeamAverageRating: React.FC<TeamAverageRatingProps> = ({
  rating,
  playerCount,
  playersRating,
  squadBalanceRating,
  purseBalanceRating,
  className,
}) => {
  if (playerCount < 2 || rating === null) {
    return (
      <Tooltip label="Squad rating calculates after 2 purchases" withArrow position="top">
        <Text size="xs" c="dimmed" fs="italic" style={{ userSelect: "none" }} className={className}>
          --
        </Text>
      </Tooltip>
    );
  }

  const color = rating >= 85 ? "teal" : rating >= 75 ? "blue" : "yellow";

  const tooltip =
    playersRating !== undefined && playersRating !== null
      ? `Overall Team Score: ${rating.toFixed(1)} / 100 [Player Stats: ${playersRating.toFixed(1)} | Squad Balance: ${squadBalanceRating ?? 100}% | Purse Health: ${purseBalanceRating ?? 100}%]`
      : `Overall Team Score: ${rating.toFixed(1)} / 100 (${playerCount} players)`;

  return (
    <Tooltip label={tooltip} withArrow position="top">
      <Badge
        color={color}
        variant="light"
        size="sm"
        radius="xs"
        className={className}
        style={{ fontFamily: "monospace", fontWeight: 800 }}
      >
        <Group gap={4} wrap="nowrap">
          <span style={{ fontSize: 9, opacity: 0.8 }}>SCORE</span>
          <span>{rating.toFixed(1)}</span>
        </Group>
      </Badge>
    </Tooltip>
  );
};
