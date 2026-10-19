"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Box,
  Stack,
  Group,
  SimpleGrid,
  Paper,
  Badge,
  Button,
  Tabs,
  Collapse,
  Text,
  Title,
  ThemeIcon,
  Divider,
  ScrollArea,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  Trophy,
  Medal,
  Users,
  Airplane,
  ArrowLeft,
  CurrencyInr,
  Check,
  Fire,
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  ClockCounterClockwise,
  Star,
} from "@phosphor-icons/react";
import { RoomSnapshot, FranchiseState, PurchasedPlayerRecord, PlayerRole } from "../../lib/types";
import { TeamIdentity } from "../teams/TeamIdentity";
import { CountryFlag } from "../common/CountryFlag";
import { formatRupees } from "../../lib/utils";
import { PlayerJerseyThumbnail } from "./PlayerJerseyShowcase";

interface AuctionReviewReportProps {
  snapshot: RoomSnapshot;
  onRestart?: () => void;
}

export const AuctionReviewReport: React.FC<AuctionReviewReportProps> = ({
  snapshot,
  onRestart,
}) => {
  const [activeTab, setActiveTab] = useState<string | null>("squads");
  const [expandedFranchises, setExpandedFranchises] = useState<Record<string, boolean>>({
    CSK: true,
    MI: true,
    RCB: true,
    KKR: true,
  });

  const toggleFranchise = (code: string) => {
    setExpandedFranchises((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const teams = useMemo(() => {
    const list = Object.values(snapshot.teams || {});
    return list.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
  }, [snapshot.teams]);

  // Aggregate stats
  const { allPurchasedPlayers, totalSpent, mostExpensivePlayer, topRatedTeam } = useMemo(() => {
    const players: (PurchasedPlayerRecord & { franchiseCode: string; franchiseName: string })[] = [];
    let spent = 0;
    let topRating = -1;
    let bestTeam: FranchiseState | null = null;

    teams.forEach((t) => {
      spent += t.totalPurse - t.remainingPurse;
      if (t.averageRating !== null && t.averageRating > topRating) {
        topRating = t.averageRating;
        bestTeam = t;
      }
      (t.purchasedPlayers || []).forEach((p) => {
        players.push({
          ...p,
          franchiseCode: t.code,
          franchiseName: t.name,
        });
      });
    });

    players.sort((a, b) => b.purchasePrice - a.purchasePrice);
    const topBuy = players.length > 0 ? players[0] : null;

    return {
      allPurchasedPlayers: players,
      totalSpent: spent,
      mostExpensivePlayer: topBuy,
      topRatedTeam: bestTeam as FranchiseState | null,
    };
  }, [teams]);

  // Role categorizer
  const groupPlayersByRole = (players: PurchasedPlayerRecord[]) => {
    const groups: Record<PlayerRole, PurchasedPlayerRecord[]> = {
      BATTER: [],
      WICKETKEEPER: [],
      ALL_ROUNDER: [],
      BOWLER: [],
    };
    players.forEach((p) => {
      if (groups[p.role]) {
        groups[p.role].push(p);
      } else {
        groups.BATTER.push(p);
      }
    });
    return groups;
  };

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        minHeight: 0,
        backgroundColor: "var(--mantine-color-body)",
        userSelect: "none",
      }}
    >
      {/* Header Banner */}
      <Paper
        p="sm"
        withBorder
        radius={0}
        style={{
          borderTop: 0,
          borderLeft: 0,
          borderRight: 0,
          flexShrink: 0,
          background: "var(--mantine-color-dark-8)",
        }}
      >
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="sm">
            <ThemeIcon size={38} radius="md" color="yellow" variant="light">
              <Trophy size={22} weight="bold" />
            </ThemeIcon>
            <Box>
              <Group gap="xs">
                <Title order={4} style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
                  {snapshot.name}
                </Title>
                <Badge color="yellow" variant="light" size="xs">
                  AUCTION CONCLUDED
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Official Franchise Rosters, Financial Breakdown & 3-Pillar Squad Analytics
              </Text>
            </Box>
          </Group>

          <Group gap="xs">
            {onRestart && (
              <Tooltip label="New Auction" withArrow>
                <Box>
                  <ActionIcon
                    variant="default"
                    size="md"
                    radius="md"
                    hiddenFrom="sm"
                    onClick={onRestart}
                    aria-label="New Auction"
                  >
                    <ArrowsClockwise size={16} weight="bold" color="var(--mantine-color-blue-4)" />
                  </ActionIcon>
                  <Button
                    variant="default"
                    size="xs"
                    visibleFrom="sm"
                    leftSection={<ArrowsClockwise size={14} weight="bold" color="var(--mantine-color-blue-4)" />}
                    onClick={onRestart}
                    aria-label="New Auction"
                  >
                    New Auction
                  </Button>
                </Box>
              </Tooltip>
            )}
            <Tooltip label="Return to Arena" withArrow>
              <Box>
                <ActionIcon
                  component={Link}
                  href="/"
                  size="md"
                  radius="md"
                  color="orange"
                  hiddenFrom="sm"
                  aria-label="Return to Arena"
                >
                  <ArrowLeft size={16} weight="bold" />
                </ActionIcon>
                <Button
                  component={Link}
                  href="/"
                  size="xs"
                  color="orange"
                  visibleFrom="sm"
                  leftSection={<ArrowLeft size={14} weight="bold" />}
                  aria-label="Return to Arena"
                >
                  Return to Arena
                </Button>
              </Box>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      {/* Main Content Area */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} p="md">
        <Stack gap="md" style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Metric Cards Row */}
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            {/* 1. Total Purse Spent */}
            <Paper p="sm" radius="md" withBorder>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  Total Spent
                </Text>
                <ThemeIcon size="sm" variant="light" color="teal">
                  <CurrencyInr size={14} weight="bold" />
                </ThemeIcon>
              </Group>
              <Text fw={900} size="lg" ff="monospace" c="teal">
                {formatRupees(totalSpent)}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                Across all 10 franchises
              </Text>
            </Paper>

            {/* 2. Total Players Acquired */}
            <Paper p="sm" radius="md" withBorder>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  Players Acquired
                </Text>
                <ThemeIcon size="sm" variant="light" color="blue">
                  <Users size={14} weight="bold" />
                </ThemeIcon>
              </Group>
              <Text fw={900} size="lg" ff="monospace" c="blue">
                {allPurchasedPlayers.length}
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                Total squad recruits confirmed
              </Text>
            </Paper>

            {/* 3. Most Expensive Player */}
            <Paper p="sm" radius="md" withBorder>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  Record Purchase
                </Text>
                <ThemeIcon size="sm" variant="light" color="orange">
                  <Fire size={14} weight="fill" />
                </ThemeIcon>
              </Group>
              <Group gap="xs" wrap="nowrap" align="center">
                {mostExpensivePlayer && (
                  <PlayerJerseyThumbnail
                    teamCode={mostExpensivePlayer.franchiseCode}
                    lotNumber={mostExpensivePlayer.lotNumber}
                    playerName={mostExpensivePlayer.name}
                    side="back"
                    size={32}
                  />
                )}
                <Box style={{ minWidth: 0 }}>
                  <Text fw={900} size="sm" c="orange" truncate>
                    {mostExpensivePlayer ? mostExpensivePlayer.name : "None"}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace" mt={2}>
                    {mostExpensivePlayer ? (
                      <>
                        <Text span fw={700} c="bright">
                          {formatRupees(mostExpensivePlayer.purchasePrice)}
                        </Text>{" "}
                        •{" "}
                        <Text span fw={700} c="orange">
                          {mostExpensivePlayer.franchiseCode}
                        </Text>
                      </>
                    ) : (
                      "No bids completed"
                    )}
                  </Text>
                </Box>
              </Group>
            </Paper>

            {/* 4. Top Rated Franchise */}
            <Paper p="sm" radius="md" withBorder>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  Top Rated Squad
                </Text>
                <ThemeIcon size="sm" variant="light" color="grape">
                  <Medal size={14} weight="bold" />
                </ThemeIcon>
              </Group>
              <Text fw={900} size="sm" c="grape" truncate>
                {topRatedTeam ? topRatedTeam.name : "Evaluating..."}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace" mt={2}>
                {topRatedTeam?.averageRating ? (
                  <>
                    <Group gap={3} wrap="nowrap" component="span">
                      <Text span fw={700} c="bright">
                        {topRatedTeam.averageRating.toFixed(1)}
                      </Text>
                      <Star size={10} weight="fill" color="var(--mantine-color-yellow-4)" />
                    </Group>{" "}
                    • {topRatedTeam.purchasedPlayers.length} Players
                  </>
                ) : (
                  "Min 3 players required"
                )}
              </Text>
            </Paper>
          </SimpleGrid>

          {/* Mantine Tabs Controls */}
          <Tabs value={activeTab} onChange={setActiveTab} color="orange" radius="md">
            <Tabs.List mb="md">
              <Tabs.Tab value="squads" leftSection={<Users size={15} weight="bold" />}>
                <Box component="span" visibleFrom="xs">Franchise </Box>Squads ({teams.length})
              </Tabs.Tab>
              <Tabs.Tab value="leaderboard" leftSection={<Medal size={15} weight="bold" />}>
                Top Buys ({allPurchasedPlayers.length})
              </Tabs.Tab>
              <Tabs.Tab value="events" leftSection={<ClockCounterClockwise size={15} weight="bold" />}>
                <Box component="span" visibleFrom="xs">Auction </Box>Timeline
              </Tabs.Tab>
            </Tabs.List>

            {/* TAB 1: SQUADS & FRANCHISES */}
            <Tabs.Panel value="squads">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {teams.map((team, idx) => {
                  const isOpen = Boolean(expandedFranchises[team.code]);
                  const grouped = groupPlayersByRole(team.purchasedPlayers || []);
                  const spent = team.totalPurse - team.remainingPurse;

                  return (
                    <Paper key={team.code} radius="md" withBorder style={{ overflow: "hidden" }}>
                      {/* Franchise Header Accordion Bar */}
                      <Box
                        p="sm"
                        onClick={() => toggleFranchise(team.code)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: "var(--mantine-color-dark-7)",
                          transition: "background-color 150ms ease",
                        }}
                      >
                        {/* Desktop / Tablet Layout (>= sm) */}
                        <Group justify="space-between" wrap="nowrap" visibleFrom="sm">
                          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                            <Badge
                              size="sm"
                              variant="light"
                              color={
                                idx === 0
                                  ? "yellow"
                                  : idx === 1
                                    ? "gray"
                                    : idx === 2
                                      ? "orange"
                                      : "dark"
                              }
                            >
                              #{idx + 1}
                            </Badge>
                            <TeamIdentity code={team.code} size="md" />
                            <Box style={{ minWidth: 0 }}>
                              <Group gap={6} wrap="nowrap">
                                <Text fw={900} size="xs" truncate>
                                  {team.name}
                                </Text>
                                <Badge size="xs" variant="outline" color="gray">
                                  {team.controller}
                                </Badge>
                              </Group>
                              <Group gap="xs" mt={2}>
                                <Text size="xs" c="dimmed" ff="monospace">
                                  {team.purchasedPlayers.length}/{team.maxSquad || 25} Squad
                                </Text>
                                <Text size="xs" c="dimmed">
                                  •
                                </Text>
                                <Group gap={2}>
                                  <Airplane size={11} weight="fill" color="var(--mantine-color-yellow-5)" />
                                  <Text size="xs" c="dimmed" ff="monospace">
                                    {team.overseasCount}/{team.maxOverseas || 8}
                                  </Text>
                                </Group>
                              </Group>
                            </Box>
                          </Group>

                          <Group gap="md" wrap="nowrap" style={{ flexShrink: 0 }}>
                            <Box style={{ textAlign: "right" }}>
                              <Text fw={900} size="xs" ff="monospace" c="teal">
                                {formatRupees(team.remainingPurse)}
                              </Text>
                              <Text size="xs" c="dimmed">
                                Spent: {formatRupees(spent)}
                              </Text>
                            </Box>

                            {team.averageRating !== null && (
                              <Box style={{ textAlign: "right" }}>
                                <Badge size="md" color="grape" variant="light" rightSection={<Star size={10} weight="fill" />}>
                                  {team.averageRating.toFixed(1)}
                                </Badge>
                                {team.playersRating !== undefined && team.playersRating !== null && (
                                  <Text size="xs" c="dimmed" ff="monospace" mt={2}>
                                    P: {team.playersRating.toFixed(1)} • Bal:{" "}
                                    {team.squadBalanceRating ?? 100}%
                                  </Text>
                                )}
                              </Box>
                            )}

                            <ActionIcon variant="subtle" size="sm" color="gray">
                              {isOpen ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                            </ActionIcon>
                          </Group>
                        </Group>

                        {/* Mobile Clean 2-Row Stack Layout (< sm) */}
                        <Stack gap={6} hiddenFrom="sm">
                          <Group justify="space-between" wrap="nowrap">
                            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                              <Badge size="xs" variant="light" color={idx === 0 ? "yellow" : idx === 1 ? "gray" : idx === 2 ? "orange" : "dark"}>
                                #{idx + 1}
                              </Badge>
                              <TeamIdentity code={team.code} size="sm" />
                              <Text fw={900} size="xs" truncate style={{ maxWidth: 130 }}>
                                {team.name}
                              </Text>
                              <Badge size="xs" variant="outline" color="gray">
                                {team.controller}
                              </Badge>
                            </Group>

                            <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                              {team.averageRating !== null && (
                                <Badge size="sm" color="grape" variant="light" rightSection={<Star size={9} weight="fill" />}>
                                  {team.averageRating.toFixed(1)}
                                </Badge>
                              )}
                              <ActionIcon variant="subtle" size="sm" color="gray">
                                {isOpen ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                              </ActionIcon>
                            </Group>
                          </Group>

                          <Group justify="space-between" wrap="nowrap" pt={2} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <Group gap={6} wrap="nowrap">
                              <Text size="10px" c="dimmed" ff="monospace">
                                {team.purchasedPlayers.length}/{team.maxSquad || 25} Squad
                              </Text>
                              <Text size="10px" c="dimmed">•</Text>
                              <Group gap={2}>
                                <Airplane size={10} weight="fill" color="var(--mantine-color-yellow-5)" />
                                <Text size="10px" c="dimmed" ff="monospace">
                                  {team.overseasCount}/{team.maxOverseas || 8}
                                </Text>
                              </Group>
                            </Group>

                            <Group gap="xs" wrap="nowrap">
                              <Text size="10px" fw={800} ff="monospace" c="teal">
                                {formatRupees(team.remainingPurse)}
                              </Text>
                              {team.playersRating !== undefined && team.playersRating !== null && (
                                <Text size="10px" c="dimmed" ff="monospace">
                                  (P: {team.playersRating.toFixed(1)})
                                </Text>
                              )}
                            </Group>
                          </Group>
                        </Stack>
                      </Box>

                      {/* Purchased Players Grouped */}
                      <Collapse expanded={isOpen}>
                        <Box p="sm">
                          {team.purchasedPlayers.length === 0 ? (
                            <Text size="xs" c="dimmed" ta="center" fs="italic" py="sm">
                              No players acquired during this auction.
                            </Text>
                          ) : (
                            <Stack gap="xs">
                              {(
                                ["BATTER", "WICKETKEEPER", "ALL_ROUNDER", "BOWLER"] as PlayerRole[]
                              ).map((role) => {
                                const playersInRole = grouped[role];
                                if (playersInRole.length === 0) return null;

                                return (
                                  <Box key={role}>
                                    <Group justify="space-between" pb={2} mb={4} style={{ borderBottom: "1px solid var(--mantine-color-dark-5)" }}>
                                      <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
                                        {role}S
                                      </Text>
                                      <Badge size="xs" variant="default">
                                        {playersInRole.length}
                                      </Badge>
                                    </Group>

                                    <Stack gap={4}>
                                      {playersInRole.map((player) => (
                                        <Paper
                                          key={player.id || player.lotNumber}
                                          p={6}
                                          radius="xs"
                                          withBorder
                                          style={{
                                            backgroundColor: "var(--mantine-color-dark-6)",
                                          }}
                                        >
                                          <Group justify="space-between" wrap="nowrap">
                                            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                                              <PlayerJerseyThumbnail
                                                teamCode={team.code}
                                                lotNumber={player.lotNumber}
                                                playerName={player.name}
                                                side="back"
                                                size={30}
                                              />
                                              <Box style={{ minWidth: 0 }}>
                                                <Group gap={6} wrap="nowrap">
                                                  <Text size="xs" fw={700} truncate>
                                                    {player.name}
                                                  </Text>
                                                  {player.rating && (
                                                    <Badge size="xs" color="grape" variant="light" rightSection={<Star size={8} weight="fill" />}>
                                                      {player.rating}
                                                    </Badge>
                                                  )}
                                                  {player.isOverseas && (
                                                    <Tooltip label={`Overseas (${player.country})`}>
                                                      <Airplane size={12} weight="fill" color="var(--mantine-color-yellow-5)" />
                                                    </Tooltip>
                                                  )}
                                                  {player.isRetained && (
                                                    <Badge size="xs" color="violet" variant="filled">
                                                      Retained
                                                    </Badge>
                                                  )}
                                                </Group>
                                                <Text size="10px" c="dimmed" ff="monospace">
                                                  Lot #{player.lotNumber} • {player.country}
                                                </Text>
                                              </Box>
                                            </Group>
                                            <Text fw={700} size="xs" ff="monospace" c="teal">
                                              {formatRupees(player.purchasePrice)}
                                            </Text>
                                          </Group>
                                        </Paper>
                                      ))}
                                    </Stack>
                                  </Box>
                                );
                              })}
                            </Stack>
                          )}
                        </Box>
                      </Collapse>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Tabs.Panel>

            {/* TAB 2: TOP BUYS LEADERBOARD */}
            <Tabs.Panel value="leaderboard">
              <Paper radius="md" withBorder style={{ overflow: "hidden" }}>
                <Box p="sm" style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.05em" }}>
                      All Purchased Players (Ranked by Sale Price)
                    </Text>
                    <Badge variant="light" color="blue" size="sm">
                      {allPurchasedPlayers.length} total players
                    </Badge>
                  </Group>
                </Box>

                {allPurchasedPlayers.length === 0 ? (
                  <Box p="xl" ta="center">
                    <Text size="sm" c="dimmed" fs="italic">
                      No players were purchased in this auction.
                    </Text>
                  </Box>
                ) : (
                  <Stack gap={0}>
                    {allPurchasedPlayers.map((player, idx) => (
                      <Box
                        key={`${player.id}-${idx}`}
                        p="sm"
                        style={{
                          borderBottom: "1px solid var(--mantine-color-dark-5)",
                          backgroundColor:
                            idx % 2 === 0
                              ? "var(--mantine-color-dark-8)"
                              : "var(--mantine-color-dark-7)",
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                            <Badge
                              size="md"
                              variant="filled"
                              color={idx < 3 ? "yellow" : "dark"}
                              w={46}
                              px={4}
                              style={{ textAlign: "center", flexShrink: 0 }}
                            >
                              #{idx + 1}
                            </Badge>
                            <PlayerJerseyThumbnail
                              teamCode={player.franchiseCode}
                              lotNumber={player.lotNumber}
                              playerName={player.name}
                              side="back"
                              size={34}
                            />
                            <Box style={{ minWidth: 0 }}>
                              <Group gap="xs" wrap="nowrap">
                                <Text fw={700} size="sm" truncate>
                                  {player.name}
                                </Text>
                                {player.isOverseas && (
                                  <Tooltip label={`Overseas (${player.country})`}>
                                    <Airplane size={14} weight="fill" color="var(--mantine-color-yellow-5)" />
                                  </Tooltip>
                                )}
                                <Badge size="xs" variant="outline" color="gray">
                                  {player.role}
                                </Badge>
                              </Group>
                              <Group gap="xs" mt={2}>
                                <CountryFlag country={player.country} size="xs" />
                                <Text size="xs" c="dimmed" ff="monospace">
                                  {player.country} • Lot #{player.lotNumber}
                                </Text>
                              </Group>
                            </Box>
                          </Group>

                          <Group gap="md" wrap="nowrap" style={{ flexShrink: 0 }}>
                            <TeamIdentity code={player.franchiseCode} size="md" />
                            <Text fw={900} size="sm" ff="monospace" c="teal">
                              {formatRupees(player.purchasePrice)}
                            </Text>
                          </Group>
                        </Group>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Tabs.Panel>

            {/* TAB 3: TIMELINE & EVENTS */}
            <Tabs.Panel value="events">
              <Paper radius="md" withBorder style={{ overflow: "hidden" }}>
                <Box p="sm" style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                  <Group justify="space-between">
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.05em" }}>
                      Authoritative Event Stream
                    </Text>
                    <Badge variant="light" color="cyan" size="sm">
                      {snapshot.recentEvents?.length || 0} events recorded
                    </Badge>
                  </Group>
                </Box>

                <Box p="sm">
                  <Stack gap="xs">
                    {(snapshot.recentEvents || []).map((evt) => (
                      <Paper
                        key={evt.id || evt.sequence}
                        p="xs"
                        radius="sm"
                        withBorder
                        style={{ backgroundColor: "var(--mantine-color-dark-6)" }}
                      >
                        <Group justify="space-between" mb={2}>
                          <Text fw={700} size="xs">
                            {evt.title}
                          </Text>
                          <Text size="xs" c="dimmed" ff="monospace">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {evt.description}
                        </Text>
                        {evt.franchiseCode && (
                          <Group gap="xs" mt="xs">
                            <TeamIdentity code={evt.franchiseCode} size="sm" />
                            {evt.amount && (
                              <Text fw={700} size="xs" ff="monospace" c="teal">
                                {formatRupees(evt.amount)}
                              </Text>
                            )}
                          </Group>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </Paper>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </ScrollArea>
    </Box>
  );
};
