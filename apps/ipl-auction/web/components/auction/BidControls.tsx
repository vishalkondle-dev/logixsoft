"use client";

import React, { useState } from "react";
import { formatRupees } from "../../lib/utils";
import { FranchiseState, AuctionLot } from "../../lib/types";
import { evaluateRosterBalance } from "../../lib/rosterBalance";
import {
  Paper,
  Box,
  Group,
  Stack,
  Text,
  Button,
  Badge,
  Divider,
  Progress,
} from "@mantine/core";
import {
  Gavel,
  TrendUp,
  Wallet,
  Clock,
  WarningCircle,
  Shield,
  ShieldWarning,
  Check,
} from "@phosphor-icons/react";

interface BidControlsProps {
  currentBid: number;
  nextLegalBid: number;
  bidIncrement: number;
  highestBidderCode: string | null;
  myFranchise: FranchiseState | null;
  currentLot?: AuctionLot | null;
  ruleset?: "MEGA" | "CLASSIC" | "SPRINT_XI";
  timerSeconds?: number | null;
  timerPercentage?: number;
  isUrgent?: boolean;
  isPaused?: boolean;
  isRtmActive?: boolean;
  onPlaceBid: (amount: number) => void;
  onSelectTeamRequest?: () => void;
  isLive: boolean;
  className?: string;
}

export const BidControls: React.FC<BidControlsProps> = ({
  currentBid,
  nextLegalBid,
  bidIncrement,
  highestBidderCode,
  myFranchise,
  currentLot,
  ruleset = "MEGA",
  timerSeconds,
  timerPercentage = 100,
  isUrgent = false,
  isPaused = false,
  isRtmActive = false,
  onPlaceBid,
  onSelectTeamRequest,
  isLive,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isHighestBidder = myFranchise && highestBidderCode === myFranchise.code;
  const hasSufficientPurse = myFranchise ? myFranchise.remainingPurse >= nextLegalBid : false;

  const spotsRemaining = myFranchise ? Math.max(0, myFranchise.minSquad - myFranchise.squadCount - 1) : 0;
  const reserveNeeded = spotsRemaining * 3000000;
  const canAffordWithReserve = myFranchise
    ? myFranchise.remainingPurse - nextLegalBid >= reserveNeeded
    : false;

  const isSquadFull = myFranchise ? myFranchise.squadCount >= myFranchise.maxSquad : false;

  const rosterCheck =
    myFranchise && currentLot
      ? evaluateRosterBalance(myFranchise, currentLot, ruleset)
      : { allowed: true, reason: undefined };

  const isRosterRestricted = !rosterCheck.allowed;

  const canBid =
    isLive &&
    !isRtmActive &&
    myFranchise &&
    !isHighestBidder &&
    hasSufficientPurse &&
    canAffordWithReserve &&
    !isSquadFull &&
    !isRosterRestricted;

  const handleClickBid = () => {
    if (!myFranchise) {
      onSelectTeamRequest?.();
      return;
    }
    if (!canBid || isSubmitting) return;
    setIsSubmitting(true);
    onPlaceBid(nextLegalBid);
    setTimeout(() => setIsSubmitting(false), 400);
  };

  const progressColor = isRtmActive
    ? "grape"
    : isPaused
    ? "yellow"
    : isUrgent
    ? "red"
    : (timerPercentage ?? 100) > 50
    ? "blue"
    : "orange";

  return (
    <Paper
      withBorder
      radius="xl"
      p={{ base: "xs", sm: "sm" }}
      shadow="xl"
      pos="relative"
      className={className}
      style={{
        backgroundColor: "var(--ipl-bid-card-bg)",
        borderColor: "var(--ipl-border)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Top Countdown Bar */}
      <Box pos="absolute" top={0} left={0} right={0}>
        <Progress
          value={isPaused ? 50 : (timerPercentage ?? 100)}
          color={progressColor}
          size={4}
          radius={0}
        />
      </Box>

      <Stack gap="xs" mt={4}>
        {/* Top Metric Row */}
        <Group justify="space-between" wrap="nowrap" align="center" gap={6}>
          {/* Time Left */}
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Clock
              size={20}
              weight="bold"
              color={isRtmActive ? "#cc5de8" : isUrgent ? "#fa5252" : "#748ffc"}
            />
            <Box style={{ minWidth: 0 }}>
              <Text size="9px" c="dimmed" fw={700} tt="uppercase" truncate>
                {isRtmActive ? "RTM" : "Timer"}
              </Text>
              <Text
                size="xs"
                fw={900}
                ff="monospace"
                c={isRtmActive ? "grape.3" : isPaused ? "yellow.4" : isUrgent ? "red.4" : "var(--mantine-color-text)"}
                truncate
              >
                {isRtmActive ? `${timerSeconds ?? 0}s` : isPaused ? "PAUSED" : `${timerSeconds ?? 0}s`}
              </Text>
            </Box>
          </Group>

          <Divider orientation="vertical" h={24} color="var(--ipl-border)" />

          {/* Next Increment */}
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <TrendUp size={20} weight="bold" color="#748ffc" />
            <Box style={{ minWidth: 0 }}>
              <Text size="9px" c="dimmed" fw={700} tt="uppercase" truncate>
                Increment
              </Text>
              <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)" truncate>
                +{formatRupees(bidIncrement)}
              </Text>
            </Box>
          </Group>

          <Divider orientation="vertical" h={24} color="var(--ipl-border)" />

          {/* Your Purse */}
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Wallet size={20} weight="bold" color="#748ffc" />
            <Box style={{ minWidth: 0 }}>
              <Text size="9px" c="dimmed" fw={700} tt="uppercase" truncate>
                Purse
              </Text>
              <Text
                size="xs"
                fw={900}
                ff="monospace"
                c={
                  myFranchise
                    ? myFranchise.remainingPurse < nextLegalBid
                      ? "red.4"
                      : "teal.4"
                    : "dimmed"
                }
                truncate
              >
                {myFranchise ? formatRupees(myFranchise.remainingPurse) : "—"}
              </Text>
            </Box>
          </Group>
        </Group>

        {/* Action Button */}
        {isRtmActive ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            disabled
            color="grape"
            variant="light"
            leftSection={<ShieldWarning size={18} weight="bold" />}
          >
            <Box component="span" visibleFrom="sm">Right to Match (RTM) In Progress — </Box>
            Bidding Locked
          </Button>
        ) : !myFranchise ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            onClick={handleClickBid}
            leftSection={<Shield size={20} weight="bold" color="#ffffff" />}
            styles={{
              root: {
                fontWeight: 900,
                letterSpacing: "0.02em",
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
                transition: "all 0.15s ease",
              },
            }}
          >
            <Text component="span" size="sm" fw={900} c="#ffffff">
              Select Franchise to Place Bid {nextLegalBid > 0 ? `(${formatRupees(nextLegalBid)})` : ""}
            </Text>
          </Button>
        ) : isHighestBidder ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            disabled
            color="teal"
            variant="light"
            leftSection={<Check size={18} weight="bold" />}
          >
            <span className="hidden sm:inline">You Hold the </span>Highest Bid
          </Button>
        ) : isRosterRestricted ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            disabled
            color="orange"
            variant="light"
            leftSection={<WarningCircle size={18} weight="bold" />}
          >
            {rosterCheck.reason || "Maximum role quota reached"}
          </Button>
        ) : !canAffordWithReserve ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            disabled
            color="orange"
            variant="light"
            leftSection={<ShieldWarning size={18} weight="bold" />}
          >
            <span className="hidden sm:inline">Must reserve {formatRupees(reserveNeeded)} for squad</span>
            <span className="sm:hidden">Reserve {formatRupees(reserveNeeded)}</span>
          </Button>
        ) : isSquadFull ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            disabled
            color="red"
            variant="light"
            leftSection={<WarningCircle size={18} weight="bold" />}
          >
            Max Squad Limit ({myFranchise.maxSquad})
          </Button>
        ) : !hasSufficientPurse ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            disabled
            color="red"
            variant="light"
            leftSection={<WarningCircle size={18} weight="bold" />}
          >
            Insufficient Purse Balance
          </Button>
        ) : !isLive ? (
          <Button
            fullWidth
            size="md"
            radius="md"
            disabled
            variant="default"
            leftSection={<Gavel size={18} weight="bold" />}
          >
            {nextLegalBid > 0
              ? `Next Lot: ${formatRupees(nextLegalBid)}`
              : "Lot Transition In Progress"}
          </Button>
        ) : (
          <Button
            fullWidth
            size="md"
            radius="md"
            loading={isSubmitting}
            variant="gradient"
            gradient={{ from: "blue.6", to: "indigo.7", deg: 90 }}
            leftSection={<Gavel size={20} weight="bold" />}
            onClick={handleClickBid}
            style={{ fontWeight: 900, letterSpacing: "0.04em", fontSize: 15 }}
          >
            Bid {formatRupees(nextLegalBid)} ({myFranchise.code})
          </Button>
        )}
      </Stack>
    </Paper>
  );
};
