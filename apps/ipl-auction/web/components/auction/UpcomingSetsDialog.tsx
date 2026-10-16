"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatRupees } from "../../lib/utils";
import { fetchApi } from "../../lib/api";
import { PlayerIdentity } from "./PlayerIdentity";
import { CountryFlag } from "../common/CountryFlag";
import { PlayerRole } from "../../lib/types";
import {
  Modal,
  Box,
  Group,
  Stack,
  Text,
  Title,
  TextInput,
  Select,
  Button,
  Badge,
  Paper,
  ScrollArea,
  Collapse,
  UnstyledButton,
} from "@mantine/core";
import {
  Cards,
  MagnifyingGlass,
  Fire,
  Check,
  Airplane,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";

interface SetItem {
  id: string;
  setNumber: number;
  setCode: string;
  setName: string;
  displayOrder: number;
  description: string;
  playerCount?: number;
}

interface PlayerItem {
  globalNumber: number;
  id: string;
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  battingStyle?: string;
  bowlingStyle?: string;
  basePrice: number;
  setId: string;
  setCode?: string;
  status?: "PENDING" | "ACTIVE" | "SOLD" | "UNSOLD";
  soldToFranchise?: string | null;
  finalPrice?: number | null;
}

interface UpcomingSetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentSetCode?: string;
  roomId?: string;
}

export const UpcomingSetsDialog: React.FC<UpcomingSetsDialogProps> = ({
  isOpen,
  onClose,
  currentSetCode = "BA1",
  roomId,
}) => {
  const [sets, setSets] = useState<SetItem[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [openSets, setOpenSets] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const setsRes = await fetchApi<{ sets: SetItem[] }>("/api/players/sets");
        const loadedSets = (setsRes.sets || []).sort((a, b) => a.displayOrder - b.displayOrder);
        setSets(loadedSets);

        let playersList: PlayerItem[] = [];

        if (roomId) {
          try {
            const roomLotsRes = await fetchApi<{ lots: any[] }>(`/api/rooms/${roomId}/lots`);
            if (roomLotsRes.lots && roomLotsRes.lots.length > 0) {
              playersList = roomLotsRes.lots.map((lot) => ({
                globalNumber: lot.orderInSet || lot.lotNumber,
                id: lot.id,
                name: lot.playerName,
                role: lot.role,
                country: lot.country,
                isOverseas: lot.isOverseas,
                battingStyle: lot.battingStyle,
                bowlingStyle: lot.bowlingStyle,
                basePrice: lot.basePrice,
                setId: lot.setId,
                setCode: lot.setCode,
                status: lot.status,
                soldToFranchise: lot.soldToFranchise,
                finalPrice: lot.finalPrice,
              }));
            }
          } catch {}
        }

        if (playersList.length === 0) {
          const playersRes = await fetchApi<{ players: any[] }>("/api/players");
          let counter = 1;
          playersList = (playersRes.players || []).map((p: any) => ({
            globalNumber: counter++,
            id: p.id,
            name: p.name,
            role: p.role,
            country: p.country,
            isOverseas: p.isOverseas,
            battingStyle: p.battingStyle,
            bowlingStyle: p.bowlingStyle,
            basePrice: p.basePrice,
            setId: p.setId,
            setCode: p.setCode,
            status: "PENDING",
          }));
        }

        setAllPlayers(playersList);

        const currentSet = loadedSets.find((s) => s.setCode === currentSetCode) || loadedSets[0];
        if (currentSet) {
          setOpenSets({ [currentSet.id]: true });
        }
      } catch (err) {
        console.error("Failed to load upcoming sets catalog:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, currentSetCode, roomId]);

  useEffect(() => {
    if (!searchQuery && roleFilter === "ALL") return;

    const newOpenState: Record<string, boolean> = {};
    const query = searchQuery.toLowerCase();

    for (const p of allPlayers) {
      const matchQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.country.toLowerCase().includes(query);
      const matchRole = roleFilter === "ALL" || p.role === roleFilter;

      if (matchQuery && matchRole) {
        newOpenState[p.setId] = true;
      }
    }
    setOpenSets((prev) => ({ ...prev, ...newOpenState }));
  }, [searchQuery, roleFilter, allPlayers]);

  const toggleSet = (setId: string) => {
    setOpenSets((prev) => ({
      ...prev,
      [setId]: !prev[setId],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    sets.forEach((s) => (next[s.id] = true));
    setOpenSets(next);
  };

  const collapseAll = () => {
    setOpenSets({});
  };

  const setGroups = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return sets
      .map((s) => {
        const playersInSet = allPlayers
          .filter((p) => p.setId === s.id)
          .filter((p) => {
            const matchQuery =
              !query ||
              p.name.toLowerCase().includes(query) ||
              p.country.toLowerCase().includes(query);
            const matchRole = roleFilter === "ALL" || p.role === roleFilter;
            return matchQuery && matchRole;
          });

        const isCurrent = s.setCode === currentSetCode;
        const allInSet = allPlayers.filter((p) => p.setId === s.id);
        const isCompleted =
          allInSet.length > 0 &&
          allInSet.every((p) => p.status === "SOLD" || p.status === "UNSOLD");

        return {
          ...s,
          players: playersInSet,
          totalInSet: allInSet.length,
          isCurrent,
          isCompleted,
        };
      })
      .filter((s) => (searchQuery || roleFilter !== "ALL" ? s.players.length > 0 : s.totalInSet > 0));
  }, [sets, allPlayers, searchQuery, roleFilter, currentSetCode]);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="xl"
      radius="xl"
      title={
        <Group gap="xs">
          <Cards size={20} color="#748ffc" />
          <Box>
            <Title order={4} fw={800} c="white">
              Upcoming Auction Sets & Players
            </Title>
            <Text size="10px" c="dimmed">
              Sets proceed in sequential order • Players within sets are dynamically nominated
            </Text>
          </Box>
        </Group>
      }
      styles={{
        content: {
          backgroundColor: "#0b1024",
          border: "1px solid rgba(79, 70, 229, 0.4)",
        },
      }}
    >
      <Stack gap="sm">
        {/* Toolbar */}
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs" style={{ flex: 1, minWidth: 260 }}>
            <TextInput
              size="xs"
              placeholder="Search player, country..."
              leftSection={<MagnifyingGlass size={14} weight="bold" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              size="xs"
              value={roleFilter}
              onChange={(val) => setRoleFilter(val || "ALL")}
              data={[
                { value: "ALL", label: "All Roles" },
                { value: "BATTER", label: "Batters" },
                { value: "BOWLER", label: "Bowlers" },
                { value: "ALL_ROUNDER", label: "All-rounders" },
                { value: "WICKETKEEPER", label: "Wicketkeepers" },
              ]}
              style={{ width: 130 }}
            />
          </Group>

          <Group gap="xs">
            <Button size="compact-xs" variant="default" onClick={expandAll}>
              Expand All
            </Button>
            <Button size="compact-xs" variant="default" onClick={collapseAll}>
              Collapse All
            </Button>
          </Group>
        </Group>

        {/* Sets List */}
        <ScrollArea h={480} type="auto">
          {isLoading ? (
            <Text size="xs" c="dimmed" ta="center" py="xl">
              Loading auction sets and dynamic catalog...
            </Text>
          ) : (
            <Stack gap="xs">
              {setGroups.map((s) => {
                const isSetOpen = !!openSets[s.id];
                const playerCount = s.players.length;

                return (
                  <Paper
                    key={s.id}
                    withBorder
                    radius="md"
                    style={{
                      overflow: "hidden",
                      backgroundColor: s.isCurrent ? "rgba(245, 159, 0, 0.06)" : "rgba(15, 23, 42, 0.6)",
                      borderColor: s.isCurrent ? "rgba(245, 159, 0, 0.4)" : "rgba(79, 70, 229, 0.2)",
                    }}
                  >
                    <UnstyledButton
                      onClick={() => toggleSet(s.id)}
                      p="xs"
                      w="100%"
                      style={{ display: "block" }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <Badge size="xs" variant="filled" color="dark">
                            {s.setCode}
                          </Badge>
                          <Text size="xs" fw={800} c="white" truncate>
                            {s.setName}
                          </Text>
                          {s.isCurrent && (
                            <Badge size="xs" color="yellow" variant="light" leftSection={<Fire size={10} weight="fill" />}>
                              LIVE NOW
                            </Badge>
                          )}
                          {s.isCompleted && (
                            <Badge size="xs" color="teal" variant="light" leftSection={<Check size={10} weight="bold" />}>
                              COMPLETED
                            </Badge>
                          )}
                        </Group>

                        <Group gap="xs" wrap="nowrap">
                          <Text size="10px" c="dimmed" ff="monospace">
                            {playerCount} {playerCount === 1 ? "player" : "players"}
                          </Text>
                          {isSetOpen ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
                        </Group>
                      </Group>
                    </UnstyledButton>

                    <Collapse expanded={isSetOpen}>
                      <Box p="xs" style={{ borderTop: "1px solid rgba(79, 70, 229, 0.2)", backgroundColor: "rgba(0,0,0,0.2)" }}>
                        {s.players.length === 0 ? (
                          <Text size="xs" c="dimmed" fs="italic" ta="center" py="xs">
                            No players match the filter in this set.
                          </Text>
                        ) : (
                          <Stack gap={4}>
                            {s.players.map((p) => {
                              const formattedNum = String(p.globalNumber).padStart(3, "0");
                              return (
                                <Paper
                                  key={p.id}
                                  withBorder
                                  p="xs"
                                  radius="sm"
                                  bg={
                                    p.status === "ACTIVE"
                                      ? "rgba(245, 159, 0, 0.1)"
                                      : p.status === "SOLD"
                                      ? "rgba(16, 185, 129, 0.08)"
                                      : "dark.8"
                                  }
                                  style={{
                                    borderColor:
                                      p.status === "ACTIVE"
                                        ? "rgba(245, 159, 0, 0.4)"
                                        : "rgba(255, 255, 255, 0.08)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                  }}
                                >
                                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                                    <Text size="xs" fw={700} ff="monospace" c="dimmed" w={32}>
                                      #{formattedNum}
                                    </Text>
                                    <PlayerIdentity
                                      name={p.name}
                                      role={p.role}
                                      country={p.country}
                                      isOverseas={p.isOverseas}
                                      size="sm"
                                    />
                                    <Box style={{ minWidth: 0 }}>
                                      <Group gap={4} wrap="nowrap">
                                        <Text size="xs" fw={700} c="white" truncate>
                                          {p.name}
                                        </Text>
                                        {p.isOverseas && <Airplane size={12} weight="fill" color="#f59f00" />}
                                      </Group>
                                      <Group gap={4} wrap="nowrap">
                                        <CountryFlag country={p.country} size="xs" />
                                        <Text size="10px" c="dimmed">
                                          {p.country} • {p.role.replace(/_/g, " ")}
                                        </Text>
                                      </Group>
                                    </Box>
                                  </Group>

                                  <Group gap="xs" wrap="nowrap">
                                    <Box style={{ textAlign: "right" }}>
                                      <Text size="xs" fw={800} ff="monospace" c="teal.4">
                                        {formatRupees(p.basePrice)}
                                      </Text>
                                      <Text size="9px" c="dimmed">
                                        Base
                                      </Text>
                                    </Box>

                                    <Box w={75}>
                                      {p.status === "ACTIVE" && (
                                        <Badge size="xs" color="yellow" variant="light">
                                          IN AUCTION
                                        </Badge>
                                      )}
                                      {p.status === "SOLD" && (
                                        <Badge size="xs" color="teal" variant="light">
                                          {p.soldToFranchise || "SOLD"}
                                        </Badge>
                                      )}
                                      {p.status === "UNSOLD" && (
                                        <Badge size="xs" color="red" variant="light">
                                          UNSOLD
                                        </Badge>
                                      )}
                                      {(!p.status || p.status === "PENDING") && (
                                        <Text size="10px" c="dimmed">
                                          Upcoming
                                        </Text>
                                      )}
                                    </Box>
                                  </Group>
                                </Paper>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>
                    </Collapse>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </ScrollArea>
      </Stack>
    </Modal>
  );
};
