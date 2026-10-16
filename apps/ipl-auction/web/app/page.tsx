"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Paper,
  Stack,
  Group,
  SimpleGrid,
  Title,
  Text,
  Badge,
  Button,
  TextInput,
  Select,
  Switch,
  ActionIcon,
  ThemeIcon,
  SegmentedControl,
  Divider,
  UnstyledButton,
  Tooltip,
} from "@mantine/core";
import {
  IconGavel,
  IconPlus,
  IconSparkles,
  IconUsers,
  IconWorld,
  IconLock,
  IconEye,
  IconRefresh,
  IconBroadcast,
  IconArrowRight,
  IconShield,
  IconRobot,
  IconCheck,
} from "@tabler/icons-react";
import { fetchApi } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { UserMenu } from "../components/auth/UserMenu";
import { AuthModal } from "../components/auth/AuthModal";
import { ThemeToggle } from "../components/layout/ThemeToggle";
import { FRANCHISE_COLORS } from "../lib/utils";

const FRANCHISES = [
  { code: "CSK", name: "Chennai Super Kings" },
  { code: "MI", name: "Mumbai Indians" },
  { code: "RCB", name: "Royal Challengers Bengaluru" },
  { code: "KKR", name: "Kolkata Knight Riders" },
  { code: "SRH", name: "Sunrisers Hyderabad" },
  { code: "DC", name: "Delhi Capitals" },
  { code: "RR", name: "Rajasthan Royals" },
  { code: "GT", name: "Gujarat Titans" },
  { code: "LSG", name: "Lucknow Super Giants" },
  { code: "PBKS", name: "Punjab Kings" },
];

interface PublicRoomItem {
  id: string;
  name: string;
  status: "LOBBY" | "LIVE" | "PAUSED" | "ENDED" | "COMPLETED";
  ruleset: string;
  aiDifficulty: string;
  creatorId: string;
  creatorTeam?: string;
  connectedCount: number;
  botTeamsCount: number;
  humanTeamsCount: number;
  totalLots?: number;
  completedLots?: number;
  createdAt: number;
}

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin } = useAuthStore();
  const [roomIdInput, setRoomIdInput] = useState("");
  const [creatorName, setCreatorName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ipl_auction_user_name") || "";
    }
    return "";
  });
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState("IPL 2026 Mega Auction");
  const [rulesetType, setRulesetType] = useState<string>("MEGA");
  const [aiDifficulty, setAiDifficulty] = useState<string>("normal");
  const [selectedTeam, setSelectedTeam] = useState<string>("MI");
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [enableRetentions, setEnableRetentions] = useState<boolean>(true);

  // Public Rooms State
  const [publicRooms, setPublicRooms] = useState<PublicRoomItem[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);
  const [roomFilter, setRoomFilter] = useState<string>("ALL");

  const loadPublicRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const data = await fetchApi<{ rooms: PublicRoomItem[] }>("/api/rooms");
      if (data && Array.isArray(data.rooms)) {
        setPublicRooms(data.rooms);
      }
    } catch (err) {
      console.error("Failed to fetch public rooms:", err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    loadPublicRooms();
    const interval = setInterval(loadPublicRooms, 12000);
    return () => clearInterval(interval);
  }, [loadPublicRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated && !creatorName.trim()) {
      alert("Please enter your name to create an auction room.");
      return;
    }
    const finalName = isAuthenticated && user?.name ? user.name : creatorName.trim();
    try {
      localStorage.setItem("ipl_auction_user_name", finalName);
    } catch {}

    setIsCreating(true);
    try {
      let uid =
        typeof window !== "undefined"
          ? localStorage.getItem("ipl_auction_ip_user_id") ||
            localStorage.getItem("ipl_auction_user_id")
          : null;
      if (!uid && typeof window !== "undefined") {
        uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("ipl_auction_user_id", uid);
      }

      const res = await fetchApi<{ roomId: string; isPublic: boolean; creatorTeam?: string }>(
        "/api/rooms",
        {
          method: "POST",
          body: JSON.stringify({
            name: roomName,
            ruleset: rulesetType,
            aiDifficulty,
            creatorTeam: selectedTeam,
            creatorId: uid || undefined,
            creatorName: finalName,
            isPublic,
            enableRetentions,
          }),
        }
      );

      if (res.roomId) {
        if (selectedTeam) {
          try {
            localStorage.setItem(`ipl_claimed_team_${res.roomId}`, selectedTeam);
            localStorage.setItem(`ipl_room_creator_${res.roomId}`, "true");
          } catch {}
        }
        router.push(`/lobby/${res.roomId}`);
      }
    } catch (err) {
      console.error("Failed to create room:", err);
      const fallbackLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const fallbackDigits = "123456789";
      let fallbackId = "";
      for (let i = 0; i < 3; i++) {
        fallbackId += fallbackLetters.charAt(Math.floor(Math.random() * fallbackLetters.length));
        fallbackId += fallbackDigits.charAt(Math.floor(Math.random() * fallbackDigits.length));
      }
      if (selectedTeam) {
        try {
          localStorage.setItem(`ipl_claimed_team_${fallbackId}`, selectedTeam);
          localStorage.setItem(`ipl_room_creator_${fallbackId}`, "true");
        } catch {}
      }
      router.push(`/lobby/${fallbackId}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinById = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomIdInput.trim();
    if (trimmed) {
      const targetId = trimmed.startsWith("room_") ? trimmed : trimmed.toUpperCase();
      try {
        const res = await fetch(`/api/rooms/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          const phase = data?.snapshot?.status;
          if (phase === "LIVE" || phase === "PAUSED") {
            router.push(`/auction/${targetId}`);
            return;
          }
          if (phase === "ENDED" || phase === "COMPLETED") {
            router.push(`/summary/${targetId}`);
            return;
          }
        }
      } catch {}
      router.push(`/lobby/${targetId}`);
    }
  };

  // Filter public rooms
  const filteredRooms = publicRooms.filter((r) => {
    if (roomFilter === "LOBBY") return r.status === "LOBBY";
    if (roomFilter === "LIVE")
      return (
        r.status === "LIVE" ||
        r.status === "PAUSED" ||
        r.status === "ENDED" ||
        r.status === "COMPLETED"
      );
    return true;
  });

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "var(--mantine-color-body)",
      }}
    >
      {/* Top Header */}
      <Paper
        component="header"
        radius={0}
        withBorder
        p="xs"
        style={{
          borderTop: 0,
          borderLeft: 0,
          borderRight: 0,
          position: "sticky",
          top: 0,
          zIndex: 40,
          backgroundColor: "var(--mantine-color-dark-8)",
        }}
      >
        <Container size="lg">
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon
                size={32}
                radius="md"
                variant="gradient"
                gradient={{ from: "orange", to: "red", deg: 45 }}
              >
                <Text fw={900} size="xs" c="white">
                  IPL
                </Text>
              </ThemeIcon>
              <Box>
                <Text fw={900} size="xs" style={{ letterSpacing: "-0.01em" }}>
                  AUCTION SIMULATOR
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  2026 OFFICIAL RULES
                </Text>
              </Box>
            </Group>

            <Group gap="xs">
              <ThemeToggle />
              {isAdmin && (
                <Tooltip label="Admin Panel" withArrow>
                  <Button
                    component="a"
                    href="/admin/dashboard"
                    size="xs"
                    variant="light"
                    color="yellow"
                    aria-label="Admin Panel"
                  >
                    <Group gap={6} wrap="nowrap">
                      <IconShield size={14} />
                      <Box component="span" visibleFrom="lg">Admin</Box>
                    </Group>
                  </Button>
                </Tooltip>
              )}
              <UserMenu />
              <AuthModal />
            </Group>
          </Group>
        </Container>
      </Paper>

      {/* Main Content */}
      <Box component="main" style={{ flex: 1, padding: "16px 12px" }}>
        <Container size="lg">
          <Stack gap="xl">
            {/* Hero Section */}
            <Stack align="center" ta="center" gap="xs" style={{ maxWidth: 680, margin: "0 auto" }}>
              <Badge
                color="orange"
                variant="light"
                size="md"
                leftSection={<IconSparkles size={14} />}
              >
                <Box component="span" hiddenFrom="xs">Workers AI Engine</Box>
                <Box component="span" visibleFrom="xs">Cloudflare Workers AI + Clef-Flash Decision Engine</Box>
              </Badge>

              <Title
                order={1}
                fw={900}
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2.75rem)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                }}
              >
                The Definitive Real-Time Cricket Auction
              </Title>

              <Text size="sm" c="dimmed" style={{ maxWidth: 540 }}>
                Authentic IPL 2026 player shortlist & sets. Authoritative 10-second hammer countdowns,
                multiplayer WebSockets with Durable Object state persistence, and competitive Clef-Flash AI franchisees.
              </Text>
            </Stack>

            {/* Section 1: Create Room & Join by Code */}
            <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
              {/* Create Room Form (2 Cols on lg) */}
              <Box style={{ gridColumn: "span 2" }}>
                <Paper p="lg" radius="lg" withBorder>
                  <form onSubmit={handleCreateRoom}>
                    <Stack gap="md">
                      <Group justify="space-between" pb="xs" style={{ borderBottom: "1px solid var(--mantine-color-dark-4)" }}>
                        <Group gap="xs">
                          <ThemeIcon size={34} radius="md" color="orange" variant="light">
                            <IconPlus size={18} />
                          </ThemeIcon>
                          <Box>
                            <Text fw={700} size="sm">
                              Host Multiplayer Auction
                            </Text>
                            <Text size="xs" c="dimmed">
                              Configure your room, pick your franchise, and invite players.
                            </Text>
                          </Box>
                        </Group>

                        <Badge
                          color={isPublic ? "teal" : "gray"}
                          variant="light"
                          size="xs"
                        >
                          {isPublic ? "PUBLIC ROOM" : "PRIVATE ROOM"}
                        </Badge>
                      </Group>

                      {/* Creator Name */}
                      {isAuthenticated && user?.name ? (
                        <Paper p="xs" radius="md" withBorder style={{ backgroundColor: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                          <Group justify="space-between">
                            <Box>
                              <Text size="xs" c="dimmed">
                                Hosting as:
                              </Text>
                              <Text size="sm" fw={700} c="teal">
                                {user.name}
                              </Text>
                            </Box>
                            <Badge size="xs" color="teal" variant="light">
                              Signed in via Google
                            </Badge>
                          </Group>
                        </Paper>
                      ) : (
                        <TextInput
                          label="Your Name *"
                          placeholder="Enter your name (mandatory to host or join)"
                          value={creatorName}
                          required
                          onChange={(e) => {
                            setCreatorName(e.target.value);
                            try {
                              localStorage.setItem("ipl_auction_user_name", e.target.value);
                            } catch {}
                          }}
                        />
                      )}

                      {/* Room Name */}
                      <TextInput
                        label="Auction Room Name"
                        placeholder="e.g. IPL 2026 Mega Auction"
                        value={roomName}
                        required
                        onChange={(e) => setRoomName(e.target.value)}
                      />

                      {/* Creator Team Choice */}
                      <Box>
                        <Group justify="space-between" mb={6}>
                          <Text size="xs" fw={700} c="dimmed">
                            Choose Your Franchise{" "}
                            <Text span c="orange" fw={400}>
                              (Creator plays as this team)
                            </Text>
                          </Text>
                          <Text size="xs" ff="monospace" c="dimmed">
                            Selected:{" "}
                            <Text span fw={700} c="bright">
                              {selectedTeam}
                            </Text>
                          </Text>
                        </Group>

                        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
                          {FRANCHISES.map((team) => {
                            const isSelected = selectedTeam === team.code;
                            const styling = FRANCHISE_COLORS[team.code];
                            return (
                              <Paper
                                key={team.code}
                                component="button"
                                type="button"
                                p="xs"
                                radius="md"
                                withBorder
                                onClick={() => setSelectedTeam(team.code)}
                                style={{
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  backgroundColor: isSelected
                                    ? "rgba(234, 88, 12, 0.12)"
                                    : "var(--mantine-color-dark-7)",
                                  borderColor: isSelected
                                    ? "var(--mantine-color-orange-5)"
                                    : undefined,
                                  boxShadow: isSelected
                                    ? "0 0 0 1px var(--mantine-color-orange-5)"
                                    : undefined,
                                  textAlign: "left",
                                }}
                              >
                                <Box
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 6,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 900,
                                    fontSize: 11,
                                    flexShrink: 0,
                                    color: "#fff",
                                    backgroundColor: styling?.hex || "#334155",
                                  }}
                                >
                                  {team.code}
                                </Box>
                                <Box style={{ minWidth: 0, flex: 1 }}>
                                  <Text size="xs" fw={700} truncate>
                                    {team.code}
                                  </Text>
                                  <Text size="xs" c="dimmed" truncate>
                                    {team.name.split(" ")[0]}
                                  </Text>
                                </Box>
                                {isSelected && (
                                  <IconCheck size={14} color="var(--mantine-color-orange-5)" />
                                )}
                              </Paper>
                            );
                          })}
                        </SimpleGrid>
                      </Box>

                      {/* Ruleset, AI Difficulty & Visibility */}
                      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                        <Select
                          label="Auction Type"
                          value={rulesetType}
                          onChange={(val) => {
                            const nextVal = val || "MEGA";
                            setRulesetType(nextVal);
                            if (nextVal === "SPRINT_XI") {
                              setEnableRetentions(false);
                            } else {
                              setEnableRetentions(true);
                            }
                          }}
                          data={[
                            { value: "MEGA", label: "Mega (₹120 Cr, Max 6 Retentions)" },
                            { value: "CLASSIC", label: "Classic (₹120 Cr, Max 11 Retentions)" },
                            {
                              value: "SPRINT_XI",
                              label: "Sprint XI (₹50 Cr, 11 Players, 0 Retentions)",
                            },
                          ]}
                        />

                        <Select
                          label="AI Franchise Difficulty"
                          value={aiDifficulty}
                          onChange={(val) => setAiDifficulty(val || "normal")}
                          data={[
                            { value: "easy", label: "Easy (Conservative)" },
                            { value: "normal", label: "Normal (Realistic)" },
                            { value: "hard", label: "Hard (Aggressive)" },
                          ]}
                        />

                        <Box>
                          <Text size="xs" fw={500} mb={4}>
                            Visibility
                          </Text>
                          <Button
                            variant="default"
                            fullWidth
                            size="sm"
                            leftSection={
                              isPublic ? (
                                <IconWorld size={14} color="var(--mantine-color-teal-4)" />
                              ) : (
                                <IconLock size={14} />
                              )
                            }
                            onClick={() => setIsPublic(!isPublic)}
                          >
                            {isPublic ? "Public Directory" : "Private (Code Only)"}
                          </Button>
                        </Box>
                      </SimpleGrid>

                      {/* Retentions & RTM Switch */}
                      <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" style={{ minWidth: 0 }}>
                            <ThemeIcon size={32} radius="md" color="yellow" variant="light">
                              <Text fw={900} size="xs">
                                RTM
                              </Text>
                            </ThemeIcon>
                            <Box style={{ minWidth: 0 }}>
                              <Group gap="xs" wrap="wrap">
                                <Text fw={700} size="xs">
                                  Enable Official Retentions & Right to Match (RTM)
                                </Text>
                                <Badge size="xs" color="yellow" variant="light">
                                  {rulesetType === "SPRINT_XI"
                                    ? "Disabled in Sprint XI"
                                    : rulesetType === "MEGA"
                                      ? "Max 6 Retentions"
                                      : "Max 11 Retentions"}
                                </Badge>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {rulesetType === "SPRINT_XI"
                                  ? "Sprint XI mode forbids retentions and RTM cards."
                                  : rulesetType === "MEGA"
                                    ? "Teams retain up to 6 players with slabs. Unused cards become RTM."
                                    : "Teams retain up to 11 players. Unused slots become RTM cards."}
                              </Text>
                            </Box>
                          </Group>

                          <Switch
                            checked={enableRetentions && rulesetType !== "SPRINT_XI"}
                            disabled={rulesetType === "SPRINT_XI"}
                            onChange={(e) => setEnableRetentions(e.currentTarget.checked)}
                            color="orange"
                          />
                        </Group>
                      </Paper>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        color="orange"
                        size="md"
                        fullWidth
                        loading={isCreating}
                        leftSection={<IconPlus size={16} />}
                      >
                        Create & Enter Auction Room
                      </Button>
                    </Stack>
                  </form>
                </Paper>
              </Box>

              {/* Join with Room Code Card */}
              <Box>
                <Paper
                  p="lg"
                  radius="lg"
                  withBorder
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Stack gap="md">
                    <Group gap="xs" pb="xs" style={{ borderBottom: "1px solid var(--mantine-color-dark-4)" }}>
                      <ThemeIcon size={34} radius="md" color="blue" variant="light">
                        <IconLock size={18} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={700} size="sm">
                          Join with Room Code
                        </Text>
                        <Text size="xs" c="dimmed">
                          Got an invite code? Enter it below.
                        </Text>
                      </Box>
                    </Group>

                    <Text size="xs" c="dimmed">
                      Connect directly to an existing private or custom room hosted by your friend or community organizer.
                    </Text>

                    <form onSubmit={handleJoinById}>
                      <Stack gap="sm">
                        <TextInput
                          label="Room Code"
                          placeholder="e.g. A1C2E3 or K4K9S1"
                          maxLength={10}
                          value={roomIdInput}
                          onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                          styles={{ input: { textTransform: "uppercase", fontFamily: "monospace" } }}
                        />

                        <Button
                          type="submit"
                          variant="default"
                          size="sm"
                          fullWidth
                          disabled={!roomIdInput.trim()}
                          rightSection={<IconArrowRight size={14} />}
                        >
                          Join Room
                        </Button>
                      </Stack>
                    </form>
                  </Stack>

                  <Paper p="xs" radius="md" withBorder mt="md" style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                    <Group gap="xs">
                      <IconWorld size={14} color="var(--mantine-color-orange-5)" />
                      <Text size="xs" fw={600}>
                        Want to browse games?
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>
                      Check the Public Directory below to find games waiting for participants!
                    </Text>
                  </Paper>
                </Paper>
              </Box>
            </SimpleGrid>

            {/* Section 2: Public Auctions Directory */}
            <Stack gap="md">
              <Group justify="space-between" align="flex-end" wrap="wrap">
                <Box>
                  <Group gap="xs">
                    <IconWorld size={20} color="var(--mantine-color-orange-5)" />
                    <Title order={3} fw={900}>
                      Public Auctions Directory
                    </Title>
                    <Badge color="orange" variant="light" size="sm">
                      {publicRooms.length} {publicRooms.length === 1 ? "Room" : "Rooms"} Available
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    Join rooms in the lobby before the auction starts, or watch and spectate live auctions.
                  </Text>
                </Box>

                <Group gap="xs">
                  <SegmentedControl
                    value={roomFilter}
                    onChange={setRoomFilter}
                    size="xs"
                    data={[
                      { label: `All (${publicRooms.length})`, value: "ALL" },
                      {
                        label: `Lobby (${publicRooms.filter((r) => r.status === "LOBBY").length})`,
                        value: "LOBBY",
                      },
                      {
                        label: `Live (${publicRooms.filter((r) => r.status !== "LOBBY").length})`,
                        value: "LIVE",
                      },
                    ]}
                  />

                  <ActionIcon
                    variant="default"
                    size="md"
                    loading={isLoadingRooms}
                    onClick={loadPublicRooms}
                    title="Refresh Room Directory"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Group>
              </Group>

              {/* Rooms Grid */}
              {filteredRooms.length === 0 ? (
                <Paper p="xl" radius="lg" withBorder ta="center">
                  <Stack align="center" gap="xs">
                    <IconWorld size={32} color="var(--mantine-color-dimmed)" />
                    <Text fw={700} size="sm">
                      No public rooms found in this category
                    </Text>
                    <Text size="xs" c="dimmed">
                      Be the first to create an open room using the form above!
                    </Text>
                  </Stack>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
                  {filteredRooms.map((room) => {
                    const isLobby = room.status === "LOBBY";
                    const isLive = room.status === "LIVE" || room.status === "PAUSED";
                    const isEnded = room.status === "ENDED" || room.status === "COMPLETED";

                    return (
                      <Paper
                        key={room.id}
                        p="md"
                        radius="lg"
                        withBorder
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 16,
                        }}
                      >
                        <Stack gap="xs">
                          {/* Status & Ruleset */}
                          <Group justify="space-between">
                            <Badge
                              size="xs"
                              color={isLobby ? "teal" : isLive ? "yellow" : "gray"}
                              variant="light"
                              leftSection={isLive ? <IconBroadcast size={10} /> : undefined}
                            >
                              {room.status}
                            </Badge>

                            <Text size="xs" c="dimmed" ff="monospace">
                              {room.ruleset} AUCTION
                            </Text>
                          </Group>

                          <Box>
                            <Text fw={700} size="sm" lineClamp={1}>
                              {room.name}
                            </Text>
                            <Text size="xs" c="dimmed" ff="monospace">
                              ID: {room.id}
                            </Text>
                          </Box>

                          {/* Info Badges */}
                          <SimpleGrid cols={2} spacing="xs">
                            <Paper p={6} radius="sm" withBorder style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                              <Group gap={6} wrap="nowrap">
                                <IconUsers size={14} color="var(--mantine-color-blue-4)" />
                                <Box style={{ minWidth: 0 }}>
                                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                    Online
                                  </Text>
                                  <Text size="xs" fw={700} truncate>
                                    {room.connectedCount || 1} Human(s)
                                  </Text>
                                </Box>
                              </Group>
                            </Paper>

                            <Paper p={6} radius="sm" withBorder style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                              <Group gap={6} wrap="nowrap">
                                <IconRobot size={14} color="var(--mantine-color-teal-4)" />
                                <Box style={{ minWidth: 0 }}>
                                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                    Bot Teams
                                  </Text>
                                  <Text size="xs" fw={700} truncate>
                                    {room.botTeamsCount !== undefined
                                      ? `${room.botTeamsCount} Available`
                                      : "AI Driven"}
                                  </Text>
                                </Box>
                              </Group>
                            </Paper>
                          </SimpleGrid>

                          {/* Host Info */}
                          {room.creatorTeam && (
                            <Group justify="space-between" px={2}>
                              <Text size="xs" c="dimmed">
                                Host Playing As:
                              </Text>
                              <Badge size="xs" color="gray" variant="filled">
                                {room.creatorTeam}
                              </Badge>
                            </Group>
                          )}
                        </Stack>

                        {/* Action Button */}
                        <Box>
                          {isLobby ? (
                            <Button
                              color="teal"
                              size="xs"
                              fullWidth
                              leftSection={<IconPlus size={14} />}
                              onClick={() => router.push(`/lobby/${room.id}`)}
                            >
                              Join Lobby
                            </Button>
                          ) : isEnded ? (
                            <Button
                              variant="default"
                              size="xs"
                              fullWidth
                              leftSection={<IconEye size={14} color="var(--mantine-color-yellow-4)" />}
                              onClick={() => router.push(`/summary/${room.id}`)}
                            >
                              View Summary
                            </Button>
                          ) : (
                            <Button
                              color="orange"
                              size="xs"
                              fullWidth
                              leftSection={<IconEye size={14} />}
                              onClick={() => router.push(`/auction/${room.id}`)}
                            >
                              Enter Auction Arena
                            </Button>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Paper
        component="footer"
        radius={0}
        withBorder
        p="xs"
        style={{
          borderBottom: 0,
          borderLeft: 0,
          borderRight: 0,
          backgroundColor: "var(--mantine-color-dark-8)",
        }}
      >
        <Container size="lg">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Cloudflare Durable Objects • Workers AI • Next.js 16
            </Text>
            <Text size="xs" c="dimmed">
              IPL Auction Simulator V2 (Mantine UI)
            </Text>
          </Group>
        </Container>
      </Paper>
    </Box>
  );
}
