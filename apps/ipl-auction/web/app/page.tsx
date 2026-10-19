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
  UnstyledButton,
  Tooltip,
} from "@mantine/core";
import {
  Plus,
  Sparkle,
  Users,
  Globe,
  Lock,
  Eye,
  ArrowsClockwise,
  Broadcast,
  ArrowRight,
  Shield,
  Robot,
  Check,
} from "@phosphor-icons/react";
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
  const [selectedTeam, setSelectedTeam] = useState<string>("CSK");
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
      {/* Top Navigation Bar */}
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
          backgroundColor: "var(--ipl-nav-bg)",
          borderColor: "var(--ipl-border)",
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
                <Text size="10px" c="dimmed" ff="monospace">
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
                      <Shield size={14} weight="bold" />
                      <Box component="span" visibleFrom="sm">Admin</Box>
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
      <Box component="main" style={{ flex: 1, padding: "24px 12px" }}>
        <Container size="lg">
          <Stack gap="xl">
            {/* Streamlined Hero Section */}
            <Stack align="center" ta="center" gap="sm" style={{ maxWidth: 640, margin: "0 auto" }}>
              <Badge
                color="orange"
                variant="light"
                size="sm"
                leftSection={<Sparkle size={12} weight="fill" />}
              >
                IPL 2026 AUCTION SIMULATOR
              </Badge>

              <Title
                order={1}
                fw={900}
                style={{
                  fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                }}
              >
                Build Your Championship Squad
              </Title>

              <Text size="sm" c="dimmed" style={{ maxWidth: 500 }}>
                Real-time multiplayer cricket bidding with official 2026 purse limits,
                authentic retentions, and smart AI franchises.
              </Text>

              {/* Instant Quick Join Bar */}
              <Paper
                p={4}
                radius="xl"
                withBorder
                mt="xs"
                style={{
                  maxWidth: 420,
                  width: "100%",
                  backgroundColor: "var(--ipl-bg-card-subtle)",
                  boxShadow: "0 6px 20px -4px rgba(0,0,0,0.2)",
                  borderColor: "var(--ipl-border)",
                }}
              >
                <form onSubmit={handleJoinById}>
                  <Group gap={4} wrap="nowrap">
                    <TextInput
                      placeholder="Enter 6-digit room code..."
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                      maxLength={10}
                      variant="unstyled"
                      size="xs"
                      leftSection={<Lock size={14} weight="bold" color="var(--mantine-color-orange-5)" />}
                      style={{ flex: 1, paddingLeft: 4 }}
                      styles={{
                        input: {
                          fontFamily: "monospace",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--ipl-text-main)",
                        },
                      }}
                    />
                    <Button
                      type="submit"
                      size="xs"
                      radius="xl"
                      color="orange"
                      disabled={!roomIdInput.trim()}
                      rightSection={<ArrowRight size={13} weight="bold" />}
                    >
                      Join
                    </Button>
                  </Group>
                </form>
              </Paper>
            </Stack>

            {/* Main Action Grid: Host on Left (7 cols), Active Auctions on Right (5 cols) */}
            <SimpleGrid cols={{ base: 1, md: 12 }} spacing="lg">
              {/* Left Column: Host an Auction Room (7 cols) */}
              <Box style={{ gridColumn: "span 7" }}>
                <Paper p="lg" radius="lg" withBorder style={{ backgroundColor: "var(--ipl-bg-card)", height: "100%" }}>
                  <form onSubmit={handleCreateRoom}>
                    <Stack gap="md">
                      {/* Card Header */}
                      <Group justify="space-between" pb="xs" style={{ borderBottom: "1px solid var(--ipl-border)" }}>
                        <Group gap="xs">
                          <ThemeIcon size={32} radius="md" color="orange" variant="light">
                            <Plus size={16} weight="bold" />
                          </ThemeIcon>
                          <Box>
                            <Text fw={700} size="sm">
                              Host an Auction Room
                            </Text>
                            <Text size="xs" c="dimmed">
                              Configure settings and invite other managers
                            </Text>
                          </Box>
                        </Group>

                        <Badge size="xs" color={isPublic ? "teal" : "gray"} variant="light">
                          {isPublic ? "PUBLIC DIRECTORY" : "PRIVATE (CODE ONLY)"}
                        </Badge>
                      </Group>

                      {/* Name Row */}
                      {isAuthenticated && user?.name ? (
                        <Group justify="space-between" py={4} px="xs" style={{ borderRadius: 6, backgroundColor: "var(--ipl-bg-card-subtle)" }}>
                          <Text size="xs" c="dimmed">
                            Hosting as: <Text span fw={700} c="orange">{user.name}</Text>
                          </Text>
                          <Badge size="xs" color="teal" variant="light">Signed In</Badge>
                        </Group>
                      ) : (
                        <TextInput
                          label="Your Name *"
                          placeholder="Enter your name (e.g. Vishal)"
                          value={creatorName}
                          required
                          size="xs"
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
                        label="Auction Name"
                        placeholder="e.g. IPL 2026 Mega Auction"
                        value={roomName}
                        required
                        size="xs"
                        onChange={(e) => setRoomName(e.target.value)}
                      />

                      {/* Compact Franchise Selector */}
                      <Box>
                        <Group justify="space-between" mb={6}>
                          <Text size="xs" fw={600} c="dimmed">
                            Pick Your Franchise:{" "}
                            <Text span fw={700} c="bright">
                              {FRANCHISES.find((f) => f.code === selectedTeam)?.name}
                            </Text>
                          </Text>
                          <Badge size="xs" color="orange" variant="outline">
                            {selectedTeam}
                          </Badge>
                        </Group>

                        {/* 5x2 Compact Grid of Team Chips */}
                        <SimpleGrid cols={{ base: 5, xs: 5 }} spacing={6}>
                          {FRANCHISES.map((team) => {
                            const isSelected = selectedTeam === team.code;
                            const colors = FRANCHISE_COLORS[team.code];
                            return (
                              <UnstyledButton
                                key={team.code}
                                onClick={() => setSelectedTeam(team.code)}
                                style={{
                                  borderRadius: 8,
                                  padding: "6px 2px",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  backgroundColor: isSelected
                                    ? "rgba(234, 88, 12, 0.14)"
                                    : "var(--ipl-bg-card-subtle)",
                                  border: isSelected
                                    ? "1.5px solid var(--mantine-color-orange-6)"
                                    : "1px solid var(--ipl-border)",
                                  transition: "all 0.15s ease",
                                  cursor: "pointer",
                                }}
                              >
                                <Box
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    backgroundColor: colors?.hex || "#334155",
                                    color: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 10,
                                    fontWeight: 800,
                                    boxShadow: isSelected ? "0 2px 4px rgba(0,0,0,0.25)" : undefined,
                                  }}
                                >
                                  {team.code}
                                </Box>
                                <Text
                                  size="10px"
                                  fw={isSelected ? 700 : 500}
                                  c={isSelected ? "orange" : "dimmed"}
                                  truncate
                                  style={{ maxWidth: "100%", lineHeight: 1 }}
                                >
                                  {team.code}
                                </Text>
                              </UnstyledButton>
                            );
                          })}
                        </SimpleGrid>
                      </Box>

                      {/* Format Selector */}
                      <Box>
                        <Text size="xs" fw={600} c="dimmed" mb={4}>
                          Auction Format
                        </Text>
                        <SegmentedControl
                          fullWidth
                          size="xs"
                          value={rulesetType}
                          onChange={(val) => {
                            setRulesetType(val);
                            if (val === "SPRINT_XI") {
                              setEnableRetentions(false);
                            } else {
                              setEnableRetentions(true);
                            }
                          }}
                          data={[
                            { label: "🏆 Mega (₹120 Cr)", value: "MEGA" },
                            { label: "⚡ Mini", value: "MINI" },
                            { label: "🏏 Sprint XI (₹50 Cr)", value: "SPRINT_XI" },
                          ]}
                        />
                      </Box>

                      {/* Compact Controls Row: AI Difficulty & Visibility */}
                      <SimpleGrid cols={2} spacing="xs">
                        <Select
                          label="AI Bot Difficulty"
                          size="xs"
                          value={aiDifficulty}
                          onChange={(val) => setAiDifficulty(val || "normal")}
                          data={[
                            { value: "easy", label: "Easy (Cautious)" },
                            { value: "normal", label: "Normal (Realistic)" },
                            { value: "hard", label: "Hard (Aggressive)" },
                          ]}
                        />

                        <Select
                          label="Room Visibility"
                          size="xs"
                          value={isPublic ? "public" : "private"}
                          onChange={(val) => setIsPublic(val === "public")}
                          data={[
                            { value: "public", label: "Public (Listed)" },
                            { value: "private", label: "Private (Code Only)" },
                          ]}
                        />
                      </SimpleGrid>

                      {/* Clean Retentions Toggle (if format allows) */}
                      {rulesetType !== "SPRINT_XI" && (
                        <Group
                          justify="space-between"
                          px="xs"
                          py={6}
                          style={{
                            borderRadius: 6,
                            backgroundColor: "var(--ipl-bg-card-subtle)",
                            border: "1px solid var(--ipl-border)",
                          }}
                        >
                          <Group gap={6}>
                            <Text size="xs" fw={600}>
                              Official Retentions & RTM Cards
                            </Text>
                            <Tooltip
                              label="Allows teams to retain up to 6 players before bidding begins. Unused slots convert to Right to Match cards."
                              withArrow
                            >
                              <Text size="xs" c="dimmed" style={{ cursor: "help" }}>
                                ⓘ
                              </Text>
                            </Tooltip>
                          </Group>
                          <Switch
                            checked={enableRetentions}
                            onChange={(e) => setEnableRetentions(e.currentTarget.checked)}
                            size="xs"
                            color="orange"
                          />
                        </Group>
                      )}

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        color="orange"
                        size="sm"
                        fullWidth
                        loading={isCreating}
                        leftSection={<Plus size={16} weight="bold" />}
                        mt={4}
                      >
                        Create & Enter Auction Room
                      </Button>
                    </Stack>
                  </form>
                </Paper>
              </Box>

              {/* Right Column: Active Auctions Directory (5 cols) */}
              <Box style={{ gridColumn: "span 5" }}>
                <Paper
                  p="lg"
                  radius="lg"
                  withBorder
                  style={{
                    backgroundColor: "var(--ipl-bg-card)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Stack gap="sm" style={{ flex: 1 }}>
                    {/* Directory Header */}
                    <Group justify="space-between" pb="xs" style={{ borderBottom: "1px solid var(--ipl-border)" }}>
                      <Group gap="xs">
                        <ThemeIcon size={32} radius="md" color="teal" variant="light">
                          <Globe size={16} weight="bold" />
                        </ThemeIcon>
                        <Box>
                          <Group gap={6}>
                            <Text fw={700} size="sm">
                              Active Auctions
                            </Text>
                            <Badge size="xs" color="teal" variant="light">
                              {publicRooms.length}
                            </Badge>
                          </Group>
                          <Text size="11px" c="dimmed">
                            Join an open lobby or spectate
                          </Text>
                        </Box>
                      </Group>

                      <Group gap={4}>
                        <SegmentedControl
                          value={roomFilter}
                          onChange={setRoomFilter}
                          size="xs"
                          data={[
                            { label: "All", value: "ALL" },
                            { label: "Lobby", value: "LOBBY" },
                            { label: "Live", value: "LIVE" },
                          ]}
                        />
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          loading={isLoadingRooms}
                          onClick={loadPublicRooms}
                          title="Refresh"
                        >
                          <ArrowsClockwise size={14} weight="bold" />
                        </ActionIcon>
                      </Group>
                    </Group>

                    {/* Rooms List */}
                    {filteredRooms.length === 0 ? (
                      <Paper
                        p="xl"
                        radius="md"
                        withBorder
                        ta="center"
                        style={{
                          backgroundColor: "var(--ipl-bg-card-subtle)",
                          borderColor: "var(--ipl-border)",
                          margin: "auto 0",
                        }}
                      >
                        <Stack align="center" gap={6}>
                          <ThemeIcon size={36} radius="xl" color="gray" variant="light">
                            <Globe size={18} weight="bold" />
                          </ThemeIcon>
                          <Text fw={600} size="xs">
                            No public rooms found
                          </Text>
                          <Text size="11px" c="dimmed">
                            Create your own room to get started!
                          </Text>
                        </Stack>
                      </Paper>
                    ) : (
                      <Stack gap="xs" style={{ maxHeight: 420, overflowY: "auto", paddingRight: 2 }}>
                        {filteredRooms.map((room) => {
                          const isLobby = room.status === "LOBBY";
                          const isLive = room.status === "LIVE" || room.status === "PAUSED";
                          const isEnded = room.status === "ENDED" || room.status === "COMPLETED";

                          return (
                            <Paper
                              key={room.id}
                              p="xs"
                              radius="md"
                              withBorder
                              style={{
                                backgroundColor: "var(--ipl-bg-card-subtle)",
                                borderColor: "var(--ipl-border)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <Group justify="space-between" wrap="nowrap" align="center">
                                <Box style={{ minWidth: 0, flex: 1 }}>
                                  <Group gap={6} wrap="nowrap">
                                    <Badge
                                      size="xs"
                                      color={isLobby ? "teal" : isLive ? "red" : "gray"}
                                      variant={isLive ? "filled" : "light"}
                                      leftSection={isLive ? <Broadcast size={10} weight="bold" /> : undefined}
                                    >
                                      {room.status}
                                    </Badge>
                                    <Text fw={700} size="xs" truncate>
                                      {room.name}
                                    </Text>
                                  </Group>

                                  <Group gap={6} mt={3}>
                                    <Text size="11px" c="dimmed" ff="monospace">
                                      {room.id}
                                    </Text>
                                    <Text size="11px" c="dimmed">•</Text>
                                    <Text size="11px" c="dimmed">
                                      {room.ruleset}
                                    </Text>
                                    {room.creatorTeam && (
                                      <>
                                        <Text size="11px" c="dimmed">•</Text>
                                        <Badge size="xs" variant="outline" color="gray">
                                          {room.creatorTeam}
                                        </Badge>
                                      </>
                                    )}
                                    <Text size="11px" c="dimmed">•</Text>
                                    <Text size="11px" c="dimmed">
                                      {room.connectedCount || 1} online
                                    </Text>
                                  </Group>
                                </Box>

                                <Button
                                  size="xs"
                                  color={isLobby ? "teal" : isLive ? "orange" : "gray"}
                                  variant={isLobby ? "light" : "subtle"}
                                  onClick={() => {
                                    if (isLobby) router.push(`/lobby/${room.id}`);
                                    else if (isEnded) router.push(`/summary/${room.id}`);
                                    else router.push(`/auction/${room.id}`);
                                  }}
                                >
                                  {isLobby ? "Join" : isEnded ? "Summary" : "Spectate"}
                                </Button>
                              </Group>
                            </Paper>
                          );
                        })}
                      </Stack>
                    )}

                    {/* Quick Guide Card at bottom of right column */}
                    <Paper
                      p="xs"
                      radius="md"
                      withBorder
                      mt="auto"
                      style={{
                        backgroundColor: "var(--ipl-bg-card-subtle)",
                        borderColor: "var(--ipl-border)",
                      }}
                    >
                      <Text size="xs" fw={700} c="orange" mb={3}>
                        How It Works
                      </Text>
                      <Stack gap={2}>
                        <Text size="11px" c="dimmed">
                          1. Host a room or join instantly using a 6-digit code.
                        </Text>
                        <Text size="11px" c="dimmed">
                          2. Configure retentions in the lobby before bidding starts.
                        </Text>
                        <Text size="11px" c="dimmed">
                          3. Real-time paddle bidding against friends & AI franchises.
                        </Text>
                      </Stack>
                    </Paper>
                  </Stack>
                </Paper>
              </Box>
            </SimpleGrid>
          </Stack>
        </Container>
      </Box>

      {/* Clean Footer */}
      <Paper
        component="footer"
        radius={0}
        withBorder
        p="xs"
        style={{
          borderBottom: 0,
          borderLeft: 0,
          borderRight: 0,
          backgroundColor: "var(--ipl-nav-bg)",
          borderColor: "var(--ipl-border)",
        }}
      >
        <Container size="lg">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              IPL Auction Simulator 2026 • Official Rules & Purse Limits
            </Text>
            <Text size="xs" c="dimmed">
              Logixsoft
            </Text>
          </Group>
        </Container>
      </Paper>
    </Box>
  );
}
