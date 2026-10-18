"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { fetchApi } from "../../lib/api";
import { formatRupees } from "../../lib/utils";
import { CountryFlag } from "../common/CountryFlag";
import { AuctionLot } from "../../lib/types";
import {
  Box,
  Stack,
  Group,
  Paper,
  Text,
  Badge,
  ScrollArea,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import {
  Cards,
  Fire,
  Airplane,
} from "@phosphor-icons/react";
import { getRoleIcon, getRoleMeta } from "../../lib/roleIcons";

interface CurrentSetPlayersListProps {
  roomId: string;
  className?: string;
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

export const CurrentSetPlayersList: React.FC<CurrentSetPlayersListProps> = ({
  roomId,
  className,
}) => {
  const { snapshot } = useAuctionStore();
  const currentLot = snapshot?.currentLot;
  const [allLots, setAllLots] = useState<AuctionLot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;

    const loadLots = async () => {
      try {
        const res = await fetchApi<{ lots: AuctionLot[] }>(`/api/rooms/${roomId}/lots`);
        if (!isCancelled && res?.lots && Array.isArray(res.lots)) {
          setAllLots(res.lots);
        }
      } catch (err) {
        console.error("Failed to load room lots:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadLots();
    return () => {
      isCancelled = true;
    };
  }, [roomId, currentLot?.lotNumber, currentLot?.status]);

  const currentSetCode = currentLot?.setCode || allLots[0]?.setCode || "BA1";
  const currentSetName = currentLot?.setName || allLots[0]?.setName || "Capped Batters (BA1)";

  const setPlayers = useMemo(() => {
    const seenPlayerIds = new Set<string>();
    const dedupLots: AuctionLot[] = [];
    for (const lot of allLots) {
      const key = lot.playerId || lot.id || String(lot.lotNumber);
      if (!seenPlayerIds.has(key)) {
        seenPlayerIds.add(key);
        dedupLots.push(lot);
      }
    }

    const list = dedupLots.filter(
      (l) => (l.setCode && l.setCode === currentSetCode) || (l.setId && currentLot?.setId && l.setId === currentLot.setId)
    );

    return list.map((lot) => {
      const isCurrent =
        currentLot &&
        (lot.id === currentLot.id ||
          (currentLot.playerId && lot.playerId === currentLot.playerId) ||
          (lot.lotNumber === currentLot.lotNumber && lot.playerName === currentLot.playerName));

      if (isCurrent) {
        return {
          ...lot,
          status: currentLot.status,
          currentBid: currentLot.currentBid,
          highestBidderFranchise: currentLot.highestBidderFranchise,
          soldToFranchise: currentLot.soldToFranchise,
          finalPrice: currentLot.finalPrice,
        };
      }
      return lot;
    });
  }, [allLots, currentSetCode, currentLot]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentLot?.id, currentLot?.lotNumber]);

  const soldCount = setPlayers.filter((p) => p.status === "SOLD").length;

  return (
    <Box
      h="100%"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "var(--ipl-bg-canvas)",
        userSelect: "none",
      }}
    >
      {/* Header */}
      <Box
        px="xs"
        py={8}
        style={{
          borderBottom: "1px solid var(--ipl-border)",
          backgroundColor: "var(--ipl-bg-card-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <Cards size={16} weight="bold" color="#f59f00" />
          <Text size="xs" fw={800} c="var(--mantine-color-text)" truncate title={currentSetName}>
            {currentSetName}
          </Text>
        </Group>

        <Badge size="xs" variant="light" color="indigo">
          {soldCount}/{setPlayers.length} Sold
        </Badge>
      </Box>

      {/* Players List */}
      <ScrollArea style={{ flex: 1 }} p="xs">
        {setPlayers.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic" ta="center" py="xl">
            {isLoading ? "Loading set players..." : "No players in this set."}
          </Text>
        ) : (
          <Stack gap={6}>
            {setPlayers.map((player) => {
              const isLive =
                currentLot &&
                (player.id === currentLot.id ||
                  (currentLot.playerId && player.playerId === currentLot.playerId) ||
                  (player.lotNumber === currentLot.lotNumber && player.playerName === currentLot.playerName)) &&
                currentLot.status === "ACTIVE";
              const isSold = player.status === "SOLD";
              const isUnsold = player.status === "UNSOLD";

              return (
                <Paper
                  key={player.id || player.playerId || String(player.lotNumber)}
                  ref={isLive ? activeItemRef : undefined}
                  withBorder
                  p="6px 8px"
                  radius="md"
                  bg={
                    isLive
                      ? "rgba(245, 159, 0, 0.12)"
                      : isSold
                      ? "var(--ipl-bg-card-subtle)"
                      : "var(--ipl-bg-card)"
                  }
                  style={{
                    borderColor: isLive ? "rgba(245, 159, 0, 0.6)" : "var(--ipl-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text size="10px" fw={700} ff="monospace" c="dimmed" w={22}>
                      #{player.lotNumber}
                    </Text>
                    <CountryFlag country={player.country} size="xs" showLabel={false} />
                    {player.isOverseas && <Airplane size={12} weight="fill" color="#f59f00" />}
                    <Text size="xs" fw={isLive ? 900 : 700} c={isLive ? "yellow.5" : "var(--mantine-color-text)"} truncate>
                      {player.playerName}
                    </Text>
                    <Tooltip label={getRoleMeta(player.role).label} withArrow>
                      <ThemeIcon
                        size="xs"
                        radius="xs"
                        variant="light"
                        color={getRoleMeta(player.role).color}
                      >
                        {getRoleIcon(player.role, 11)}
                      </ThemeIcon>
                    </Tooltip>
                  </Group>

                  <Group gap={6} wrap="nowrap">
                    {isLive ? (
                      <Badge size="xs" color="yellow" variant="filled" leftSection={<Fire size={10} weight="fill" />}>
                        LIVE
                      </Badge>
                    ) : isSold ? (
                      <Badge size="xs" color="teal" variant="light">
                        {player.soldToFranchise} {formatRupees(player.finalPrice || player.basePrice)}
                      </Badge>
                    ) : isUnsold ? (
                      <Badge size="xs" color="red" variant="light">
                        UNSOLD
                      </Badge>
                    ) : (
                      <Text size="10px" ff="monospace" c="dimmed">
                        {formatRupees(player.basePrice)}
                      </Text>
                    )}
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </ScrollArea>
    </Box>
  );
};
