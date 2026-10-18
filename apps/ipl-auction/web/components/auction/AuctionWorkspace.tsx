"use client";

import React, { useState } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { PlayerJerseyShowcase } from "./PlayerJerseyShowcase";
import { BidControls } from "./BidControls";
import { UpcomingSetsDialog } from "./UpcomingSetsDialog";
import { TeamSelectionModal } from "./TeamSelectionModal";
import { ManageRetentionsModal } from "./ManageRetentionsModal";
import { RTMDecisionPrompt } from "./RTMDecisionPrompt";
import { PlayerSoldCelebration } from "./PlayerSoldCelebration";
import { CountryFlag } from "../common/CountryFlag";
import { formatRupees, formatIndianNumber, calculateNextLegalBid, getBidIncrement } from "../../lib/utils";
import {
  playHammerSound,
  playTickSound,
  playGoingOnceSound,
  playGoingTwiceSound,
  playSoldGavelSound,
  getIsAudioUnlocked,
  unlockAudio,
  testAudioOutput,
} from "../../lib/auctionSound";
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
  ThemeIcon,
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
  User,
  SpeakerSimpleHigh,
} from "@phosphor-icons/react";
import { GiBilledCap } from "react-icons/gi";
import { getRoleIcon, getRoleMeta } from "../../lib/roleIcons";

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
  const { snapshot, myFranchise, isUpcomingDialogOpen, setIsUpcomingDialogOpen, voiceEnabled } = useAuctionStore();
  const [isTeamSelectModalOpen, setIsTeamSelectModalOpen] = useState(false);
  const [isRetentionsModalOpen, setIsRetentionsModalOpen] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [soldCelebration, setSoldCelebration] = useState<{
    opened: boolean;
    playerName: string;
    playerRole?: string;
    isOverseas?: boolean;
    franchiseCode: string;
    franchiseName?: string;
    amount: number;
  }>({
    opened: false,
    playerName: "",
    franchiseCode: "",
    amount: 0,
  });

  const hasPromptedTeamSelectRef = React.useRef(false);
  React.useEffect(() => {
    // Automatically present team selection modal on join if user hasn't selected a team
    if (snapshot && !myFranchise && !hasPromptedTeamSelectRef.current) {
      hasPromptedTeamSelectRef.current = true;
      setIsTeamSelectModalOpen(true);
    }
  }, [snapshot, myFranchise]);

  React.useEffect(() => {
    setAudioUnlocked(getIsAudioUnlocked());
    const handleUnlocked = () => setAudioUnlocked(true);
    window.addEventListener("auction-audio-unlocked", handleUnlocked);
    return () => window.removeEventListener("auction-audio-unlocked", handleUnlocked);
  }, []);

  const currentLot = snapshot?.currentLot || null;
  const isLive = snapshot?.status === "LIVE";
  const isPaused = snapshot?.status === "PAUSED";
  const isCompleted = snapshot?.status === "COMPLETED";
  const isLobby = snapshot?.status === "LOBBY";

  const lastSoldLotIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (currentLot?.status === "SOLD" && currentLot.id !== lastSoldLotIdRef.current) {
      lastSoldLotIdRef.current = currentLot.id;
      // Always play the authentic sold proclamation and gavel strike sound effect
      playSoldGavelSound();

      // Trigger paper blast celebration with winning team's logo and colors
      const winningFranchise = currentLot.soldToFranchise || currentLot.highestBidderFranchise || "IPL";
      const winningAmount = currentLot.finalPrice || currentLot.currentBid || currentLot.basePrice;
      setSoldCelebration({
        opened: true,
        playerName: currentLot.playerName,
        playerRole: currentLot.role,
        isOverseas: currentLot.isOverseas,
        franchiseCode: winningFranchise,
        franchiseName: snapshot?.teams?.[winningFranchise]?.name,
        amount: winningAmount,
      });
    }
  }, [currentLot?.status, currentLot?.id, currentLot?.soldToFranchise, currentLot?.highestBidderFranchise, currentLot?.finalPrice, currentLot?.currentBid, snapshot?.teams]);

  const userFranchiseState = myFranchise && snapshot?.teams ? snapshot.teams[myFranchise] : null;

  const handleCloseTeamSelect = (skipped: boolean = false) => {
    setIsTeamSelectModalOpen(false);
    // If auction was paused due to no humans, resume it once the user closes the modal / is ready
    if (snapshot?.status === "PAUSED" && snapshot?.pauseReason === "NO_HUMANS_CONNECTED") {
      onResumeAuction?.();
    }
  };

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

  const totalTimerDuration = snapshot?.timerDurationMs || (currentLot && currentLot.currentBid > 0 ? 10000 : 18000);
  const { secondsLeft, remainingMs, percentage, isUrgent } = useSyncTimer(
    isPaused ? null : snapshot?.timerDeadline || null,
    serverOffset,
    totalTimerDuration
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

        // When a player has an active bid, play the authentic countdown voice warnings
        if (currentLot && currentLot.currentBid > 0 && voiceEnabled) {
          if (secondsLeft === 2) {
            playGoingOnceSound();
          } else if (secondsLeft === 1) {
            playGoingTwiceSound();
          }
        }
      }
    } else {
      lastTickedSecondRef.current = null;
    }
  }, [secondsLeft, isPaused, snapshot?.timerDeadline, remainingMs, currentLot?.currentBid, voiceEnabled]);

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
        backgroundColor: "var(--ipl-bg-canvas)",
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
          bg="var(--ipl-bg-card-subtle)"
          style={{
            borderColor: "var(--ipl-border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Text size="9px" fw={800} tt="uppercase" c="dimmed">
            {isLobby ? "STATUS" : "LOT"}
          </Text>
          <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)">
            {isLobby ? "LOBBY" : `#${currentLot?.lotNumber || 1}`}
          </Text>
        </Paper>

        <Paper
          withBorder
          p="6px 14px"
          radius="md"
          bg="var(--ipl-bg-card-subtle)"
          style={{
            borderColor: "var(--ipl-border)",
            flex: 1,
            textAlign: "center",
            minWidth: 0,
          }}
        >
          <Text size="xs" fw={700} c="var(--mantine-color-text)" truncate>
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

      {/* Browser Autoplay / Audio Activation Banner */}
      {!audioUnlocked && (
        <Paper
          withBorder
          p="8px 14px"
          radius="md"
          style={{
            backgroundColor: "rgba(255, 146, 43, 0.12)",
            borderColor: "rgba(255, 146, 43, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            gap: 12,
          }}
          onClick={() => {
            unlockAudio();
            testAudioOutput();
          }}
        >
          <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
            <SpeakerSimpleHigh size={20} weight="bold" color="#ff922b" style={{ flexShrink: 0 }} />
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" fw={700} c="orange" truncate>
                🔊 Audio is waiting for browser activation. Tap to enable commentary &amp; gavel strikes!
              </Text>
              <Text size="10px" c="dimmed">
                Mobile / iPhone: Turn off physical Silent mode and raise media volume.
              </Text>
            </Box>
          </Group>
          <Button size="compact-xs" color="orange" variant="filled" style={{ flexShrink: 0 }}>
            Enable Sound
          </Button>
        </Paper>
      )}

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
                    backgroundColor: "var(--ipl-bg-card)",
                    borderColor: "var(--ipl-border)",
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
                          c="var(--mantine-color-text)"
                          fw={900}
                          lineClamp={1}
                          style={{
                            fontSize: "clamp(1.05rem, 2.2vw, 1.45rem)",
                            lineHeight: 1.2,
                          }}
                        >
                          {currentLot.playerName}
                        </Title>

                        {/* Right-aligned tags and flag: Icons only, no redundant text */}
                        <Group gap={6} align="center" wrap="nowrap">
                          {/* Capped / Uncapped Icon */}
                          <Tooltip
                            label={
                              currentLot.isCapped
                                ? "Capped Player (International Experience)"
                                : "Uncapped Player (Domestic/Emerging)"
                            }
                            withArrow
                          >
                            <ThemeIcon
                              size="sm"
                              radius="md"
                              variant={currentLot.isCapped ? "light" : "subtle"}
                              color={currentLot.isCapped ? "teal" : "gray"}
                            >
                              {currentLot.isCapped ? (
                                <GiBilledCap size={15} />
                              ) : (
                                <User size={13} weight="bold" />
                              )}
                            </ThemeIcon>
                          </Tooltip>

                          {/* Overseas Airplane Icon */}
                          {currentLot.isOverseas && (
                            <Tooltip label="Overseas Player (Foreign Slot)" withArrow>
                              <ThemeIcon size="sm" radius="md" variant="light" color="yellow">
                                <Airplane size={14} weight="fill" />
                              </ThemeIcon>
                            </Tooltip>
                          )}

                          {/* RTM Tag: Cards icon + Franchise Code */}
                          {hasRtm && (
                            <Tooltip
                              label={`Right to Match (RTM) available for ${currentLot.previousFranchise}`}
                              withArrow
                            >
                              <Badge
                                size="xs"
                                radius="md"
                                color="blue"
                                variant="light"
                                px={6}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                <Group gap={3} wrap="nowrap" align="center">
                                  <Cards size={12} weight="bold" />
                                  <span style={{ fontWeight: 800 }}>
                                    {currentLot.previousFranchise}
                                  </span>
                                </Group>
                              </Badge>
                            </Tooltip>
                          )}

                          <CountryFlag country={currentLot.country} size="xs" />
                        </Group>
                      </Group>

                      {/* Sub-header: Role Icon (Bat/Bowl/Gloves) + Batting/Bowling style */}
                      <Group gap="xs" mt={4} mb={6} align="center" wrap="nowrap">
                        <Tooltip label={roleMeta.label} withArrow>
                          <ThemeIcon
                            size="sm"
                            radius="md"
                            variant="filled"
                            color={roleMeta.color}
                            aria-label={roleMeta.label}
                          >
                            {roleIcon}
                          </ThemeIcon>
                        </Tooltip>
                        <Text size="xs" fw={700} c="var(--mantine-color-text)" truncate>
                          {formatBattingStyle(currentLot.battingStyle)}
                          {currentLot.bowlingStyle && currentLot.bowlingStyle !== "None"
                            ? ` • ${currentLot.bowlingStyle}`
                            : ""}
                        </Text>
                      </Group>
                    </Box>

                    {/* Stats Grid: Exactly 2 lines (3 cols x 2 rows) */}
                    <SimpleGrid cols={3} spacing={6} my={4}>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }} ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">MAT</Text>
                        <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)">{currentLot.matches}</Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }} ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">RUNS</Text>
                        <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)">{formatIndianNumber(currentLot.runs)}</Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }} ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">AVG</Text>
                        <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)">
                          {currentLot.battingAverage > 0 ? currentLot.battingAverage.toFixed(1) : "-"}
                        </Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }} ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">SR</Text>
                        <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)">
                          {currentLot.strikeRate > 0 ? currentLot.strikeRate.toFixed(1) : "-"}
                        </Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }} ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">WKTS</Text>
                        <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)">{currentLot.wickets}</Text>
                      </Paper>
                      <Paper withBorder p={{ base: "3px 4px", sm: "4px 8px" }} radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }} ta="center">
                        <Text size="9px" fw={700} c="dimmed" tt="uppercase">ECON</Text>
                        <Text size="xs" fw={900} ff="monospace" c="var(--mantine-color-text)">
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
                        backgroundColor: "var(--ipl-bg-card-subtle)",
                        borderColor: "var(--ipl-border)",
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap" gap={6}>
                        {/* Base Price */}
                        <Box style={{ flexShrink: 0 }}>
                          <Text size="9px" fw={700} c="dimmed" tt="uppercase">
                            Base Price
                          </Text>
                          <Text fz={{ base: "xs", sm: "sm" }} fw={900} ff="monospace" c="yellow.5">
                            {formatRupees(currentLot.basePrice)}
                          </Text>
                        </Box>

                        <Divider orientation="vertical" h={26} color="var(--ipl-border)" />

                        {/* Current / Highest Bid */}
                        <Group gap={8} justify="flex-end" align="center" wrap="nowrap">
                          <Box style={{ textAlign: "right" }}>
                            <Text size="9px" fw={700} c="dimmed" tt="uppercase">
                              {currentLot.highestBidderFranchise ? "Highest Bid" : "Opening Bid"}
                            </Text>
                            <Text fz={{ base: "sm", sm: "md" }} fw={900} ff="monospace" c="var(--mantine-color-text)">
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
              <Title order={3} c="var(--mantine-color-text)" fw={900}>
                {snapshot?.name || "IPL 2026 Live Auction Arena"}
              </Title>
              <Text size="xs" c="dimmed" mt={4}>
                {myFranchise
                  ? `You represent ${myFranchise}. Check upcoming player sets and start the auction when ready.`
                  : "Select or claim a franchise from the left panel before the auction begins."}
              </Text>
            </Box>

            <SimpleGrid cols={3} spacing="xs" w="100%">
              <Paper withBorder p="xs" radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }}>
                <Text size="10px" fw={700} c="dimmed" tt="uppercase">Format</Text>
                <Text size="xs" fw={800} c="var(--mantine-color-text)">
                  {snapshot?.ruleset === "SPRINT_XI" ? "Sprint XI" : snapshot?.ruleset === "CLASSIC" ? "Classic" : "Mega"}
                </Text>
              </Paper>
              <Paper withBorder p="xs" radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }}>
                <Text size="10px" fw={700} c="dimmed" tt="uppercase">Squad Size</Text>
                <Text size="xs" fw={800} c="var(--mantine-color-text)">
                  {snapshot?.ruleset === "SPRINT_XI" ? "11" : "18 - 25"}
                </Text>
              </Paper>
              <Paper withBorder p="xs" radius="md" bg="var(--ipl-bg-card-subtle)" style={{ borderColor: "var(--ipl-border)" }}>
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
            <Title order={4} c="var(--mantine-color-text)">
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
        onClose={() => handleCloseTeamSelect(false)}
        onSkip={() => handleCloseTeamSelect(true)}
        teams={snapshot?.teams || {}}
        onSelectTeam={(code) => {
          onClaimTeam?.(code);
          handleCloseTeamSelect(false);
        }}
        nextLegalBid={effectiveNextBid}
      />

      <PlayerSoldCelebration
        opened={soldCelebration.opened}
        onClose={() => setSoldCelebration((prev) => ({ ...prev, opened: false }))}
        playerName={soldCelebration.playerName}
        playerRole={soldCelebration.playerRole}
        isOverseas={soldCelebration.isOverseas}
        franchiseCode={soldCelebration.franchiseCode}
        franchiseName={soldCelebration.franchiseName}
        amount={soldCelebration.amount}
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
