"use client";

import React, { useState } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { TeamIdentity } from "./TeamIdentity";
import { TeamAverageRating } from "./TeamAverageRating";
import { formatRupees } from "../../lib/utils";
import {
  Box,
  Stack,
  Group,
  Paper,
  Badge,
  Text,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Button,
  Collapse,
  UnstyledButton,
  ThemeIcon,
} from "@mantine/core";
import {
  CaretDown,
  CaretUp,
  User,
  Robot,
  Fire,
  Airplane,
  Shield,
  UserMinus,
  UserCircleMinus,
  Lightning,
  UserCheck,
} from "@phosphor-icons/react";
import { PurchasedPlayerRecord } from "../../lib/types";

interface TeamAccordionsProps {
  onClaimTeam: (code: string) => void;
  onTakeOverTeam?: (code: string) => void;
  onReassignToBot?: (code: string) => void;
  onBanUser?: (targetUserId: string, franchiseCode: string) => void;
  isCreator?: boolean;
  currentUserId?: string;
  className?: string;
}

export const TeamAccordions: React.FC<TeamAccordionsProps> = ({
  onClaimTeam,
  onTakeOverTeam,
  onReassignToBot,
  onBanUser,
  isCreator,
  currentUserId,
  className,
}) => {
  const { snapshot, myFranchise, setMyFranchise } = useAuctionStore();
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({
    CSK: true,
  });

  const toggleExpand = (code: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const teamsList = snapshot?.teams ? Object.values(snapshot.teams) : [];
  const currentLeaderCode = snapshot?.currentLot?.highestBidderFranchise;

  const handleClaim = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    if (myFranchise) return;
    onClaimTeam(code);
    setMyFranchise(code);
  };

  return (
    <Box
      h="100%"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "rgba(11, 16, 36, 0.4)",
        borderRight: "1px solid rgba(79, 70, 229, 0.2)",
      }}
      className={className}
    >
      {/* Top Header */}
      <Box
        p="xs"
        style={{
          borderBottom: "1px solid rgba(79, 70, 229, 0.2)",
          backgroundColor: "#0d132a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Group gap={6}>
          <Shield size={16} weight="bold" color="#748ffc" />
          <Text size="xs" fw={800} tt="uppercase" c="white" style={{ letterSpacing: "0.05em" }}>
            Franchises ({teamsList.length})
          </Text>
        </Group>

        <Group gap={4}>
          <Text size="10px" c="dimmed">
            Squad: {teamsList[0]?.minSquad || 18}–{teamsList[0]?.maxSquad || 25} • Max {teamsList[0]?.maxOverseas || 8}
          </Text>
          <Airplane size={12} weight="fill" color="#f59f00" />
        </Group>
      </Box>

      {/* Accordions List */}
      <ScrollArea style={{ flex: 1 }} p="xs">
        <Stack gap="xs">
          {teamsList.map((team) => {
            const isMyFranchise = myFranchise === team.code;
            const isLeading = currentLeaderCode === team.code;
            const isExpanded = Boolean(expandedTeams[team.code]);

            const batters = team.purchasedPlayers.filter((p) => p.role === "BATTER");
            const keepers = team.purchasedPlayers.filter((p) => p.role === "WICKETKEEPER");
            const allRounders = team.purchasedPlayers.filter((p) => p.role === "ALL_ROUNDER");
            const bowlers = team.purchasedPlayers.filter((p) => p.role === "BOWLER");

            return (
              <Paper
                key={team.code}
                withBorder
                radius="md"
                style={{
                  overflow: "hidden",
                  backgroundColor: isMyFranchise
                    ? "rgba(59, 130, 246, 0.08)"
                    : isLeading
                    ? "rgba(245, 159, 0, 0.08)"
                    : "rgba(15, 23, 42, 0.6)",
                  borderColor: isMyFranchise
                    ? "rgba(59, 130, 246, 0.5)"
                    : isLeading
                    ? "rgba(245, 159, 0, 0.5)"
                    : "rgba(79, 70, 229, 0.2)",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Header Row */}
                <UnstyledButton
                  onClick={() => toggleExpand(team.code)}
                  p="xs"
                  w="100%"
                  style={{ display: "block", userSelect: "none" }}
                >
                  <Group justify="space-between" wrap="nowrap" mb={4}>
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <TeamIdentity code={team.code} size="sm" />
                      <Text size="xs" fw={900} c="white" truncate>
                        {team.shortName}
                      </Text>
                      {isMyFranchise && (
                        <Tooltip label="Your Claimed Franchise" withArrow>
                          <ThemeIcon size="xs" radius="sm" color="blue" variant="filled">
                            <UserCheck size={11} weight="bold" />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                      {isLeading && (
                        <Tooltip label="Currently Highest Bidder" withArrow>
                          <ThemeIcon size="xs" radius="sm" color="yellow" variant="light">
                            <Fire size={11} weight="fill" color="#f59f00" />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                    </Group>

                    <Group gap="xs" wrap="nowrap">
                      <Text size="xs" fw={900} ff="monospace" c="teal.4">
                        {formatRupees(team.remainingPurse)}
                      </Text>
                      {isExpanded ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
                    </Group>
                  </Group>

                  {/* Subtitle / Details */}
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={6} wrap="nowrap" align="center">
                      <Tooltip
                        label={team.controller === "HUMAN" ? "Human Controller" : "AI Bot Controller"}
                        withArrow
                      >
                        <ThemeIcon
                          size="xs"
                          radius="sm"
                          variant="subtle"
                          color={team.controller === "HUMAN" ? "blue" : "gray"}
                        >
                          {team.controller === "HUMAN" ? (
                            <User size={11} weight="bold" />
                          ) : (
                            <Robot size={11} weight="bold" />
                          )}
                        </ThemeIcon>
                      </Tooltip>
                      <Text size="10px" c="dimmed">
                        • {team.squadCount}/{team.maxSquad}
                      </Text>
                      <Group gap={2} wrap="nowrap">
                        <Airplane size={10} weight="fill" color="#f59f00" />
                        <Text size="10px" c="dimmed">
                          {team.overseasCount}/{team.maxOverseas}
                        </Text>
                      </Group>
                    </Group>

                    <Group gap={6} wrap="nowrap">
                      <TeamAverageRating
                        rating={team.averageRating}
                        playerCount={team.squadCount}
                        playersRating={team.playersRating}
                        squadBalanceRating={team.squadBalanceRating}
                        purseBalanceRating={team.purseBalanceRating}
                      />

                      {!myFranchise && team.controller === "AI" && (
                        <Tooltip label="Claim Franchise" withArrow>
                          <Button
                            size="compact-xs"
                            color="teal"
                            variant="light"
                            aria-label="Claim Franchise"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onTakeOverTeam) {
                                onTakeOverTeam(team.code);
                              } else {
                                handleClaim(e, team.code);
                              }
                            }}
                          >
                            <Group gap={4} wrap="nowrap">
                              <Lightning size={10} weight="fill" />
                              <Box component="span" visibleFrom="xs">Claim</Box>
                            </Group>
                          </Button>
                        </Tooltip>
                      )}

                      {isCreator && team.controller === "HUMAN" && team.code !== myFranchise && (
                        <Group gap={2} wrap="nowrap">
                          <ActionIcon
                            size="xs"
                            color="yellow"
                            variant="subtle"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Reassign ${team.name} back to AI Bot?`)) {
                                onReassignToBot?.(team.code);
                              }
                            }}
                          >
                            <UserMinus size={12} weight="bold" />
                          </ActionIcon>
                          <ActionIcon
                            size="xs"
                            color="red"
                            variant="subtle"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Ban ${team.humanDisplayName || "user"} from this room?`)) {
                                onBanUser?.(team.humanUserId!, team.code);
                              }
                            }}
                          >
                            <UserCircleMinus size={12} weight="bold" />
                          </ActionIcon>
                        </Group>
                      )}
                    </Group>
                  </Group>
                </UnstyledButton>

                {/* Expanded Squad View */}
                <Collapse expanded={isExpanded}>
                  <Box p="xs" style={{ borderTop: "1px solid rgba(79, 70, 229, 0.2)", backgroundColor: "rgba(0,0,0,0.25)" }}>
                    {team.purchasedPlayers.length === 0 ? (
                      <Text size="xs" c="dimmed" fs="italic" ta="center" py="xs">
                        No players acquired yet.
                      </Text>
                    ) : (
                      <Stack gap="xs">
                        {batters.length > 0 && <SquadGroup title="Batters" players={batters} />}
                        {keepers.length > 0 && <SquadGroup title="Wicketkeepers" players={keepers} />}
                        {allRounders.length > 0 && <SquadGroup title="All-rounders" players={allRounders} />}
                        {bowlers.length > 0 && <SquadGroup title="Bowlers" players={bowlers} />}
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Stack>
      </ScrollArea>
    </Box>
  );
};

function SquadGroup({ title, players }: { title: string; players: PurchasedPlayerRecord[] }) {
  return (
    <Box>
      <Text size="10px" fw={800} tt="uppercase" c="dimmed" mb={4}>
        {title} ({players.length})
      </Text>
      <Stack gap={4}>
        {players.map((p) => (
          <Paper
            key={p.id}
            withBorder
            p="4px 8px"
            radius="sm"
            bg="dark.8"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <Text size="xs" fw={600} truncate c="white">
                {p.name}
              </Text>
              {p.rating && (
                <Badge size="xs" color="grape" variant="light">
                  {p.rating}★
                </Badge>
              )}
              {p.isOverseas && <Airplane size={12} weight="fill" color="#f59f00" />}
              {p.isRetained && (
                <Badge size="xs" color="violet" variant="filled">
                  R
                </Badge>
              )}
              {p.isRtmMatch && (
                <Badge size="xs" color="yellow" variant="light">
                  RTM
                </Badge>
              )}
            </Group>
            <Text size="xs" fw={700} ff="monospace" c="dimmed">
              {formatRupees(p.purchasePrice)}
            </Text>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
