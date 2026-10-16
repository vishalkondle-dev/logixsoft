"use client";

import React, { useState } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { PlayerJerseyShowcase } from "./PlayerJerseyShowcase";
import { BidControls } from "./BidControls";
import { UpcomingSetsDialog } from "./UpcomingSetsDialog";
import { TeamSelectionModal } from "./TeamSelectionModal";
import { ManageRetentionsModal } from "./ManageRetentionsModal";
import { RTMDecisionPrompt } from "./RTMDecisionPrompt";
import { CountryFlag } from "../common/CountryFlag";
import { formatRupees, formatIndianNumber, calculateNextLegalBid, getBidIncrement } from "../../lib/utils";
import { playHammerSound } from "../../lib/auctionSound";
import { useSyncTimer } from "../../hooks/useSyncTimer";
import {
  Box,
  Stack,
  Group,
  Paper,
  Text,
  Title,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Divider,
  Center,
} from "@mantine/core";
import {
  Cards,
  Play,
  Pause,
  Square,
  Trophy,
  Fire,
  Airplane,
  Shield,
  Gavel,
} from "@phosphor-icons/react";
import { GiBilledCap } from "react-icons/gi";
import { getRoleIcon, getRoleMeta } from "../../lib/roleIcons";

function playTickSound(second: number) {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = second === 1 ? 1250 : second === 2 ? 1000 : 800;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch (err) {}
}

const getShortRole = (role?: string) => {
  if (!role) return "BAT";
  const upper = role.toUpperCase();
  if (
    upper.includes("ALL-ROUNDER") ||
    upper.includes("ALL ROUNDER") ||
    upper.includes("ALL_ROUNDER") ||
    upper === "AR"
  ) {
    return "AR";
  }
  if (upper.includes("WICKET") || upper.includes("KEEPER") || upper === "WK") {
    return "WK";
  }
  if (upper.includes("BOWLER") || upper === "BOWL") {
    return "BOWL";
  }
  if (upper.includes("BATSMAN") || upper.includes("BATTER") || upper === "BAT") {
    return "BAT";
  }
  return role.replace(/_/g, " ").slice(0, 4).toUpperCase();
};

const formatBattingStyle = (style?: string) => {
  if (!style) return "RHB";
  const upper = style.toUpperCase();
  if (upper.includes("RIGHT")) return "RHB";
  if (upper.includes("LEFT")) return "LHB";
  return style;
};

interface AuctionWorkspaceProps {
  onPlaceBid: (amount: number) => void;
  onStartAuction: () => void;
  onPauseAuction: (reason?: string) => void;
  onResumeAuction: () => void;
  onEndAuction: () => void;
  onClaimTeam?: (code: string) => void;
  onSetRetentions?: (franchiseCode: string, playerIds: string[]) => void;
  onDecideRtm?: (exercise: boolean) => void;
  serverOffset?: number;
  className?: string;
}

export const AuctionWorkspace: React.FC<AuctionWorkspaceProps> = ({
  onPlaceBid,
  onStartAuction,
  onPauseAuction,
  onResumeAuction,
  onEndAuction,
  onClaimTeam,
  onSetRetentions,
  onDecideRtm,
  serverOffset = 0,
  className,
}) => {
  const { snapshot, myFranchise, isUpcomingDialogOpen, setIsUpcomingDialogOpen } = useAuctionStore();
  const [isTeamSelectModalOpen, setIsTeamSelectModalOpen] = useState(false);
  const [isRetentionsModalOpen, setIsRetentionsModalOpen] = useState(false);

  const currentLot = snapshot?.currentLot || null;
  const isLive = snapshot?.status === "LIVE";
  const isPaused = snapshot?.status === "PAUSED";
  const isCompleted = snapshot?.status === "COMPLETED";
  const isLobby = snapshot?.status === "LOBBY";

  const lastSoldLotIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (currentLot?.status === "SOLD" && currentLot.id !== lastSoldLotIdRef.current) {
      lastSoldLotIdRef.current = currentLot.id;
      playHammerSound();
    }
  }, [currentLot?.status, currentLot?.id]);

  const userFranchiseState = myFranchise && snapshot?.teams ? snapshot.teams[myFranchise] : null;

  let effectiveNextBid = 0;
  let effectiveIncrement = 500000;

  if (currentLot) {
    if (currentLot.status === "ACTIVE") {
      if (currentLot.currentBid <= 0) {
        effectiveNextBid = currentLot.basePrice;
        effectiveIncrement = getBidIncrement(currentLot.basePrice);
      } else {
        const calc = calculateNextLegalBid(currentLot.currentBid, currentLot.basePrice);
        effectiveNextBid = calc.nextBid;
        effectiveIncrement = calc.increment;
      }
    } else if (currentLot.status === "SOLD" || currentLot.status === "UNSOLD") {
      effectiveNextBid = snapshot?.nextLegalBid || 0;
      effectiveIncrement = snapshot?.bidIncrement || 500000;
    } else {
      effectiveNextBid = currentLot.basePrice;
      effectiveIncrement = getBidIncrement(currentLot.basePrice);
    }
  } else {
    effectiveNextBid = snapshot?.nextLegalBid || 0;
    effectiveIncrement = snapshot?.bidIncrement || 500000;
  }

  const { secondsLeft, remainingMs, percentage, isUrgent } = useSyncTimer(
    isPaused ? null : snapshot?.timerDeadline || null,
    serverOffset
  );

  const lastTickedSecondRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (isPaused || !snapshot?.timerDeadline || remainingMs <= 0) {
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
  }, [secondsLeft, isPaused, snapshot?.timerDeadline, remainingMs]);

  const previousTeam =
    currentLot?.previousFranchise && currentLot.previousFranchise !== "None"
      ? snapshot?.teams?.[currentLot.previousFranchise]
      : null;

  const hasRtm = Boolean(
    currentLot?.previousFranchise &&
      currentLot.previousFranchise !== "None" &&
      snapshot?.enableRetentions !== false &&
      snapshot?.ruleset !== "SPRINT_XI" &&
      (!previousTeam || previousTeam.rtmCardsRemaining > 0)
  );

  return (
    <Box
      h="100%"
      p={{ base: "xs", sm: "md" }}
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 8,
        backgroundColor: "#070b1a",
        overflowY: "auto",
        userSelect: "none",
      }}
    >
      {/* Sub-Header Bar */}
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Paper
          withBorder
          p="4px 10px"
          radius="md"
          bg="dark.8"
          style={{
            borderColor: "rgba(79, 70, 229, 0.4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Text size="9px" fw={800} tt="uppercase" c="dimmed">
            {isLobby ? "STATUS" : "LOT"}
          </Text>
          <Text size="xs" fw={900} ff="monospace" c="white">
            {isLobby ? "LOBBY" : `#${currentLot?.lotNumber || 1}`}
          </Text>
        </Paper>

        <Paper
          withBorder
          p="6px 14px"
          radius="md"
          bg="dark.8"
          style={{
            borderColor: "rgba(79, 70, 229, 0.4)",
            flex: 1,
            textAlign: "center",
            minWidth: 0,
          }}
        >
          <Text size="xs" fw={700} c="white" truncate>
            {isLobby ? "Pre-Auction Arena" : currentLot ? currentLot.setName : "IPL 2026 Live Auction"}
          </Text>
        </Paper>

        <Group gap={6} wrap="nowrap">
          <Tooltip label="Upcoming Players" withArrow position="bottom">
            <ActionIcon
              size="lg"
              variant="default"
              radius="md"
              onClick={() => setIsUpcomingDialogOpen(true)}
            >
              <Cards size={18} weight="bold" color="#748ffc" />
            </ActionIcon>
          </Tooltip>

          {isLive && (
            <Tooltip label="Pause Auction" withArrow position="bottom">
              <ActionIcon
                size="lg"
                color="yellow"
                variant="light"
                radius="md"
                onClick={() => onPauseAuction("MANUAL_HOST_PAUSE")}
              >
                <Pause size={18} weight="bold" />
              </ActionIcon>
            </Tooltip>
          )}

          {isPaused && (
            <Tooltip label="Resume Auction" withArrow position="bottom">
              <ActionIcon
                size="lg"
                color="teal"
                variant="light"
                radius="md"
                onClick={onResumeAuction}
              >
                <Play size={18} weight="fill" />
              </ActionIcon>
            </Tooltip>
          )}

          {(isLive || isPaused) && (
            <Tooltip label="End Auction" withArrow position="bottom">
              <ActionIcon
                size="lg"
                color="red"
                variant="light"
                radius="md"
                onClick={() => {
                  if (window.confirm("Are you sure you want to end the auction now?")) {
                    onEndAuction();
                  }
                }}
              >
                <Square size={16} weight="bold" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {/* RTM Banner */}
      {snapshot?.rtmState && snapshot.rtmState.active && (
        <RTMDecisionPrompt
          rtmState={snapshot.rtmState}
          myFranchise={myFranchise}
          myFranchiseState={userFranchiseState || undefined}
          onDecideRtm={(exercise) => onDecideRtm?.(exercise)}
        />
      )}

      {/* Main Display Area */}
      {!isLobby && currentLot && (isLive || isPaused) ? (
        <Box
          className="auction-landscape-layout"
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflow: "hidden" }}
        >
          {/* Left Column in Landscape: Player Showcase + Valuation */}
          <Box className="auction-landscape-left" style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0 }}>
            {/* Unified Redesigned Player Showcase & Auction Valuation Card */}
            {(() => {
              const roleMeta = getRoleMeta(currentLot.role);
              const roleIcon = getRoleIcon(currentLot.role, 12);

              return (
                <Paper
                  className="auction-player-card"
                  withBorder
                  radius="xl"
                  p={{ base: 8, sm: "md" }}
                  style={{
                    backgroundColor: "#0b1024",
                    borderColor: "rgba(79, 70, 229, 0.35)",
                    display: "flex",
                    alignItems: "stretch",
                    gap: 10,
                    position: "relative",
                  }}
                >
                  {/* Left Column: Clean 3D Jersey Showcase (Name removed) */}
                  <Box
                    w={{ base: 70, xs: 80, sm: 96, md: 118 }}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                  >
                    <PlayerJerseyShowcase
                      playerName={currentLot.playerName}
                      teamCode={currentLot.highestBidderFranchise}
                      soldToTeam={currentLot.soldToFranchise}
                      status={currentLot.status}
                      lotNumber={currentLot.lotNumber}
                      size="sm"
                    />
                  </Box>

                  {/* Right Column: Player Info, Tags on Right, 2-line Stats, and Pricing Bar */}
                  <Box style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    {/* Header: Player Name + Right-side Badges & Flag */}
                    <Box>
                      <Group justify="space-between" align="flex-start" wrap="wrap" gap={6}>
                        <Title
                          order={2}
                          c="white"
                          fw={900}
                          lineClamp={1}
                          style={{
                            fontSize: "clamp(1.05rem, 2.2vw, 1.45rem)",
                            lineHeight: 1.2,
                          }}
                        >
                          {currentLot.playerName}
                        </Title>

                        {/* Right-aligned tags and flag */}
                        <Group gap={6} align="center" wrap="wrap">
                          {currentLot.isCapped ? (
                            <Badge
                              size="xs"
                              color="teal"
                              variant="light"
                              leftSection={<GiBilledCap size={12} />}
                              px={6}
                            >
                              CAPPED
                            </Badge>
                          ) : (
                            <Badge size="xs" color="gray" variant="light" px={6}>
                              UNCAPPED
                            </Badge>
                          )}
                          {currentLot.isOverseas && (
                            <Badge
                              size="xs"
                              color="yellow"
                              variant="light"
                              leftSection={<Airplane size={11} weight="fill" />}
                              px={6}
                            >
                              OVERSEAS
                            </Badge>
                          )}
                          {hasRtm && (
                            <Badge size="xs" color="blue" variant="light" px={6}>
                              RTM: {currentLot.previousFranchise}
                            </Badge>
                          )}
                          <CountryFlag country={currentLot.country} size="xs" />
                        </Group>
                      </Group>

                      {/* Sub-header: Role Badge with bat/bowl/gloves icon + Batting/Bowling style */}
                      <Group gap="xs" mt={4} mb={6} align="center" wrap="wrap">
                        <Badge
                          color={roleMeta.color}
                          size="sm"
                          variant="filled"
                          leftSection={roleIcon}
                          style={{ fontWeight: 800, textTransform: "uppercase" }}
                        >
                          {roleMeta.label}
                        </Badge>
                        <Text size="xs" c="dimmed" truncate>
                          {formatBattingStyle(currentLot.battingStyle)}
                          {currentLot.bowlingStyle && currentLot.bowlingStyle !== "None"
                            ? ` • ${currentLot.bowlingStyle}`
                            : ""}
                        </Text>
                      </Group>
                    </Box>

                    {/* Stats Grid: Exactly 2 lines (3 cols x 2 rows) */}
                    <SimpleGrid cols={3} spacing={6} my={4}>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="dark.8" ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">MAT</Text>
                        <Text size="xs" fw={900} ff="monospace" c="white">{currentLot.matches}</Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="dark.8" ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">RUNS</Text>
                        <Text size="xs" fw={900} ff="monospace" c="white">{formatIndianNumber(currentLot.runs)}</Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="dark.8" ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">AVG</Text>
                        <Text size="xs" fw={900} ff="monospace" c="white">
                          {currentLot.battingAverage > 0 ? currentLot.battingAverage.toFixed(1) : "-"}
                        </Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="dark.8" ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">SR</Text>
                        <Text size="xs" fw={900} ff="monospace" c="white">
                          {currentLot.strikeRate > 0 ? currentLot.strikeRate.toFixed(1) : "-"}
                        </Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="dark.8" ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">WKTS</Text>
                        <Text size="xs" fw={900} ff="monospace" c="white">{currentLot.wickets}</Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="dark.8" ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">ECON</Text>
                        <Text size="xs" fw={900} ff="monospace" c="white">
                          {currentLot.economy > 0 ? currentLot.economy.toFixed(1) : "-"}
                        </Text>
                      </Paper>
                    </SimpleGrid>

                    {/* Integrated Valuation Bar: Base Price & Current Highest Bid */}
                    <Paper
                      withBorder
                      radius="lg"
                      p={{ base: "6px 8px", sm: "6px 12px" }}
                      mt={4}
                      style={{
                        backgroundColor: "rgba(11, 16, 36, 0.75)",
                        borderColor: "rgba(79, 70, 229, 0.35)",
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap" gap={6}>
                        {/* Base Price */}
                        <Box style={{ flexShrink: 0 }}>
                          <Text size="9px" fw={700} c="dimmed" tt="uppercase">
                            Base Price
                          </Text>
                          <Text fz={{ base: "xs", sm: "sm" }} fw={900} ff="monospace" c="yellow.4">
                            {formatRupees(currentLot.basePrice)}
                          </Text>
                        </Box>

                        <Divider orientation="vertical" h={26} color="dark.4" />

                        {/* Current / Highest Bid */}
                        <Group gap={8} justify="flex-end" align="center" wrap="nowrap">
                          <Box style={{ textAlign: "right" }}>
                            <Text size="9px" fw={700} c="dimmed" tt="uppercase">
                              {currentLot.highestBidderFranchise ? "Highest Bid" : "Opening Bid"}
                            </Text>
                            <Text fz={{ base: "sm", sm: "md" }} fw={900} ff="monospace" c="white">
                              {currentLot.currentBid > 0
                                ? formatRupees(currentLot.currentBid)
                                : formatRupees(currentLot.basePrice)}
                            </Text>
                          </Box>

                          {currentLot.highestBidderFranchise && (
                            <Badge
                              size="md"
                              color="yellow"
                              variant="filled"
                              leftSection={<Fire size={12} weight="fill" />}
                            >
                              {currentLot.highestBidderFranchise}
                            </Badge>
                          )}
                        </Group>
                      </Group>
                    </Paper>
                  </Box>
                </Paper>
              );
            })()}
          </Box>

          {/* Right Column in Landscape: Bid Controls */}
          <Box className="auction-landscape-right" style={{ flexShrink: 0 }}>
            <BidControls
              currentBid={currentLot?.currentBid || 0}
              nextLegalBid={effectiveNextBid}
              bidIncrement={effectiveIncrement}
              highestBidderCode={currentLot?.highestBidderFranchise || null}
              myFranchise={userFranchiseState}
              currentLot={currentLot}
              ruleset={snapshot?.ruleset}
              onPlaceBid={onPlaceBid}
              onSelectTeamRequest={() => setIsTeamSelectModalOpen(true)}
              isLive={isLive && currentLot?.status === "ACTIVE" && !Boolean(snapshot?.rtmState?.active)}
              isRtmActive={Boolean(snapshot?.rtmState?.active)}
              timerSeconds={secondsLeft}
              timerPercentage={percentage}
              isUrgent={isUrgent}
              isPaused={isPaused}
            />
          </Box>
        </Box>
      ) : isLobby ? (
        /* Pre-Auction Lobby Waiting Screen */
        <Center style={{ flex: 1 }}>
          <Stack gap="md" align="center" style={{ maxWidth: 440, textAlign: "center" }}>
            <Paper p="lg" radius="xl" bg="rgba(76, 110, 245, 0.1)" withBorder style={{ borderColor: "rgba(76, 110, 245, 0.3)" }}>
              <Gavel size={36} weight="bold" color="#748ffc" />
            </Paper>

            <Box>
              <Badge color="yellow" variant="light" size="sm" mb={4}>
                LOBBY • WAITING TO START
              </Badge>
              <Title order={3} c="white" fw={900}>
                {snapshot?.name || "IPL 2026 Live Auction Arena"}
              </Title>
              <Text size="xs" c="dimmed" mt={4}>
                {myFranchise
                  ? `You represent ${myFranchise}. Check upcoming player sets and start the auction when ready.`
                  : "Select or claim a franchise from the left panel before the auction begins."}
              </Text>
            </Box>

            <SimpleGrid cols={3} spacing="xs" w="100%">
              <Paper withBorder p="xs" radius="md" bg="dark.8">
                <Text size="10px" fw={700} c="dimmed" tt="uppercase">Format</Text>
                <Text size="xs" fw={800} c="white">
                  {snapshot?.ruleset === "SPRINT_XI" ? "Sprint XI" : snapshot?.ruleset === "CLASSIC" ? "Classic" : "Mega"}
                </Text>
              </Paper>
              <Paper withBorder p="xs" radius="md" bg="dark.8">
                <Text size="10px" fw={700} c="dimmed" tt="uppercase">Squad Size</Text>
                <Text size="xs" fw={800} c="white">
                  {snapshot?.ruleset === "SPRINT_XI" ? "11" : "18 - 25"}
                </Text>
              </Paper>
              <Paper withBorder p="xs" radius="md" bg="dark.8">
                <Text size="10px" fw={700} c="dimmed" tt="uppercase">Total Purse</Text>
                <Text size="xs" fw={800} ff="monospace" c="teal.4">
                  {snapshot?.ruleset === "SPRINT_XI" ? "₹50 Cr" : "₹120 Cr"}
                </Text>
              </Paper>
            </SimpleGrid>

            <Group gap="xs" mt="xs" wrap="wrap" justify="center">
              <Tooltip label="Upcoming Players" withArrow>
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => setIsUpcomingDialogOpen(true)}
                  aria-label="Upcoming Players"
                >
                  <Group gap={6} wrap="nowrap">
                    <Cards size={14} weight="bold" />
                    <Box component="span" visibleFrom="xs">Upcoming Players</Box>
                  </Group>
                </Button>
              </Tooltip>

              {myFranchise && snapshot?.enableRetentions && snapshot?.ruleset !== "SPRINT_XI" && (
                <Tooltip label="Configure Retentions" withArrow>
                  <Button
                    variant="light"
                    color="yellow"
                    size="xs"
                    onClick={() => setIsRetentionsModalOpen(true)}
                    aria-label="Configure Retentions"
                  >
                    <Group gap={6} wrap="nowrap">
                      <Shield size={14} weight="bold" />
                      <Box component="span" visibleFrom="xs">Configure Retentions</Box>
                    </Group>
                  </Button>
                </Tooltip>
              )}

              <Button
                color="teal"
                size="xs"
                onClick={onStartAuction}
              >
                <Group gap={6} wrap="nowrap">
                  <Play size={14} weight="fill" />
                  <span>Start Auction</span>
                </Group>
              </Button>
            </Group>
          </Stack>
        </Center>
      ) : (
        <Center style={{ flex: 1 }}>
          <Stack gap="xs" align="center" style={{ textAlign: "center" }}>
            <Trophy size={40} weight="bold" color="#748ffc" />
            <Title order={4} c="white">
              {isCompleted ? "Auction Completed!" : "Auction Arena"}
            </Title>
            <Text size="xs" c="dimmed">
              {isCompleted ? "All player sets have concluded." : "Waiting for auction lot to open..."}
            </Text>
          </Stack>
        </Center>
      )}

      <TeamSelectionModal
        isOpen={isTeamSelectModalOpen}
        onClose={() => setIsTeamSelectModalOpen(false)}
        teams={snapshot?.teams || {}}
        onSelectTeam={(code) => onClaimTeam?.(code)}
        nextLegalBid={effectiveNextBid}
      />

      <UpcomingSetsDialog
        isOpen={isUpcomingDialogOpen}
        onClose={() => setIsUpcomingDialogOpen(false)}
        currentSetCode={currentLot?.setCode || "BA1"}
        roomId={snapshot?.roomId}
      />

      {myFranchise && snapshot?.ruleset !== "SPRINT_XI" && (
        <ManageRetentionsModal
          isOpen={isRetentionsModalOpen}
          onClose={() => setIsRetentionsModalOpen(false)}
          franchiseCode={myFranchise}
          franchiseState={userFranchiseState || undefined}
          ruleset={snapshot?.ruleset || "MEGA"}
          onSaveRetentions={(code, playerIds) => onSetRetentions?.(code, playerIds)}
        />
      )}
    </Box>
  );
};
