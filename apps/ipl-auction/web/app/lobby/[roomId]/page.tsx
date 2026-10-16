"use client";

import React, { use, useState } from "react";
import {
  Box,
  Stack,
  Group,
  SimpleGrid,
  Paper,
  Badge,
  Button,
  ActionIcon,
  Text,
  Title,
  Loader,
  ScrollArea,
  Divider,
  UnstyledButton,
  Tooltip,
  SegmentedControl,
  ThemeIcon,
} from "@mantine/core";
import {
  Users,
  Shield,
  Crown,
  Play,
  Robot,
  UserCircleMinus,
  UserCheck,
  Sparkle,
  Copy,
  Check,
  ChatCenteredText,
  Broadcast,
  Cards,
  Clock,
  Coins,
  CaretRight,
  SignOut,
} from "@phosphor-icons/react";
import { useRoomRouteGuard } from "../../../hooks/useRoomRouteGuard";
import { useAuctionRoom } from "../../../hooks/useAuctionRoom";
import { useAuctionStore } from "../../../stores/auctionStore";
import { useAuthStore } from "../../../stores/authStore";
import { TopNavBar } from "../../../components/layout/TopNavBar";
import { InvalidRoomError } from "../../../components/common/InvalidRoomError";
import { JoinNameModal } from "../../../components/auth/JoinNameModal";
import { LiveChat } from "../../../components/chat/LiveChat";
import { ActivityFeed } from "../../../components/activity/ActivityFeed";
import { ManageRetentionsModal } from "../../../components/auction/ManageRetentionsModal";

export default function LobbyPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = use(params);
  const rawRoomId = resolvedParams.roomId;
  const roomId = rawRoomId.startsWith("room_") ? rawRoomId : rawRoomId.toUpperCase();

  // Validate room status and auto-redirect if phase doesn't match
  const { isValidating, isInvalidRoom, errorMessage } = useRoomRouteGuard(roomId, "lobby");

  const {
    isConnected,
    startAuction,
    claimTeam,
    takeOverTeam,
    reassignToBot,
    kickUser,
    releaseTeam,
    sendChat,
    setRetentions,
    updateDisplayName,
    currentUserId,
  } = useAuctionRoom(roomId);

  const { isAuthenticated } = useAuthStore();
  const [guestName, setGuestName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ipl_auction_user_name");
    }
    return null;
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [mobileTab, setMobileTab] = useState<"teams" | "chat">("teams");
  const [sidebarTab, setSidebarTab] = useState<"chat" | "activity" | "rules">("chat");
  const [retentionTeamCode, setRetentionTeamCode] = useState<string | null>(null);

  const {
    snapshot,
    myFranchise,
    unreadChatCount,
    unreadActivityCount,
  } = useAuctionStore();

  const isCreatorStored =
    typeof window !== "undefined" && localStorage.getItem(`ipl_room_creator_${roomId}`) === "true";
  const isCreator = Boolean(
    (snapshot?.creatorId &&
      (snapshot.creatorId === currentUserId ||
        snapshot.creatorId === "host" ||
        snapshot.creatorId === "official_host" ||
        snapshot.creatorId === "guest_creator")) ||
      isCreatorStored
  );

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // If probing or invalid
  if (isInvalidRoom) {
    return <InvalidRoomError roomId={roomId} errorMessage={errorMessage || undefined} />;
  }

  if (isValidating || !snapshot) {
    return (
      <Box
        style={{
          minHeight: "100dvh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--mantine-color-body)",
        }}
      >
        <Stack align="center" gap="xs">
          <Loader size="lg" color="orange" />
          <Text size="sm" fw={700} ff="monospace">
            Preparing Auction Lobby...
          </Text>
          <Text size="xs" c="dimmed">
            Checking pitch and room code {roomId}
          </Text>
        </Stack>
      </Box>
    );
  }

  const teamsList = Object.values(snapshot.teams || {});
  const humanTeamsCount = teamsList.filter((t) => t.controller === "HUMAN").length;
  const botTeamsCount = teamsList.filter((t) => t.controller === "AI").length;

  const joinedMembers =
    snapshot.members && snapshot.members.length > 0
      ? snapshot.members
      : teamsList
          .filter((t) => t.controller === "HUMAN" && t.humanUserId)
          .map((t) => ({
            sessionId: t.humanUserId!,
            userId: t.humanUserId!,
            displayName: t.humanDisplayName || "Player",
            isGuest: !t.humanUserId?.startsWith("usr_"),
            claimedFranchise: t.code,
            connected: true,
            lastSeen: Date.now(),
          }));

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "var(--mantine-color-body)",
        userSelect: "none",
      }}
    >
      {/* Top Navigation Bar */}
      <TopNavBar roomId={roomId} roomName={snapshot.name} />

      {/* Mobile Tab Switcher (<lg) */}
      <Paper
        p={6}
        radius={0}
        hiddenFrom="lg"
        style={{
          borderBottom: "1px solid var(--mantine-color-dark-4)",
          backgroundColor: "var(--mantine-color-dark-8)",
        }}
      >
        <SegmentedControl
          value={mobileTab}
          onChange={(v) => setMobileTab(v as "teams" | "chat")}
          fullWidth
          size="xs"
          data={[
            {
              label: (
                <Group gap={6} justify="center">
                  <Shield size={14} />
                  <span>Franchises ({teamsList.length})</span>
                </Group>
              ),
              value: "teams",
            },
            {
              label: (
                <Group gap={6} justify="center">
                  <ChatCenteredText size={14} />
                  <span>Chat & Rules</span>
                  {unreadChatCount > 0 && (
                    <Badge size="xs" color="red" variant="filled" circle>
                      {unreadChatCount}
                    </Badge>
                  )}
                </Group>
              ),
              value: "chat",
            },
          ]}
        />
      </Paper>

      {/* Main Content Area */}
      <Box
        component="main"
        style={{
          flex: 1,
          overflow: "hidden",
          minHeight: 0,
          position: "relative",
        }}
        className="flex flex-col lg:flex-row"
      >
        {/* LEFT / CENTER COLUMN: Lobby Overview, Participants, and Teams */}
        <Box
          className={`lobby-column-teams ${mobileTab === "teams" ? "" : "lobby-hide-mobile"}`}
        >
          <ScrollArea
            style={{ flex: 1, height: "100%", minHeight: 0 }}
            p={{ base: "xs", sm: "md" }}
          >
            <Stack gap="md" style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 24 }}>
              {/* Welcome & Room Status Banner */}
              <Paper
                p={{ base: "xs", sm: "md" }}
                radius="lg"
                withBorder
                style={{
                  position: "relative",
                  overflow: "hidden",
                  background:
                    "linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(30, 41, 59, 0.4) 100%)",
                }}
              >
                <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                  <Stack gap={4} style={{ maxWidth: 650, minWidth: 0 }}>
                    <Group gap={6} wrap="wrap">
                      <Badge
                        color="yellow"
                        variant="light"
                        size="xs"
                        leftSection={<Clock size={11} />}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        <span className="hidden sm:inline">WAITING FOR HOST</span>
                        <span className="sm:hidden">LOBBY</span>
                      </Badge>
                      <Badge color="blue" variant="light" size="xs" style={{ whiteSpace: "nowrap" }}>
                        {snapshot.ruleset || "MEGA"}
                      </Badge>
                      {isCreator && (
                        <Tooltip label="Room Host" withArrow>
                          <ThemeIcon
                            color="teal"
                            variant="light"
                            size="xs"
                            radius="sm"
                          >
                            <Crown size={12} weight="bold" />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                    </Group>

                    <Title order={4} fw={900} style={{ letterSpacing: "-0.02em" }} lineClamp={1}>
                      {snapshot.name || "IPL 2026 Auction Arena"}
                    </Title>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      Claim your favorite franchise before the hammer falls. The host will start live bidding.
                    </Text>
                  </Stack>

                  {/* Share Invite Code Button: ActionIcon on mobile, Button on sm+ */}
                  <Tooltip label={copiedLink ? "Link Copied!" : "Share Room Link"} withArrow position="bottom">
                    <Box>
                      <ActionIcon
                        variant="default"
                        size="md"
                        radius="md"
                        hiddenFrom="sm"
                        onClick={handleCopyLink}
                        aria-label="Share Room Link"
                      >
                        {copiedLink ? (
                          <Check size={16} color="var(--mantine-color-teal-4)" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </ActionIcon>
                      <Button
                        variant="default"
                        size="xs"
                        visibleFrom="sm"
                        leftSection={
                          copiedLink ? (
                            <Check size={14} color="var(--mantine-color-teal-4)" />
                          ) : (
                            <Copy size={14} />
                          )
                        }
                        onClick={handleCopyLink}
                      >
                        {copiedLink ? "Copied!" : "Share Link"}
                      </Button>
                    </Box>
                  </Tooltip>
                </Group>
              </Paper>

              {/* JOINED PLAYERS & PARTICIPANTS PANEL */}
              <Paper p={{ base: "xs", sm: "md" }} radius="lg" withBorder>
                <Group justify="space-between" mb="xs">
                  <Group gap={6}>
                    <Users size={16} color="var(--mantine-color-blue-4)" />
                    <Text fw={700} size="xs">
                      Participants ({joinedMembers.length || snapshot.connectedHumanCount || 1})
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" ff="monospace" visibleFrom="sm">
                    {isCreator ? "👑 Manage participants below" : "Lobby Presence"}
                  </Text>
                </Group>

                <SimpleGrid cols={{ base: 2, sm: 2, md: 3 }} spacing="xs">
                  {joinedMembers.map((m, idx) => {
                    const isMe = m.userId === currentUserId;
                    const isHost = m.userId === snapshot.creatorId || (isCreator && isMe);
                    const team = m.claimedFranchise ? snapshot.teams?.[m.claimedFranchise] : null;

                    return (
                      <Paper
                        key={m.sessionId || idx}
                        p="xs"
                        radius="md"
                        withBorder
                        style={{
                          backgroundColor: isMe
                            ? "rgba(234, 88, 12, 0.08)"
                            : "var(--mantine-color-dark-7)",
                          borderColor: isMe ? "var(--mantine-color-orange-6)" : undefined,
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                            <Box
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyCenter: "center",
                                fontWeight: 900,
                                fontSize: 11,
                                flexShrink: 0,
                                color: "#fff",
                                backgroundColor: team ? team.primaryColor : "#4f46e5",
                              }}
                            >
                              <span style={{ margin: "auto" }}>
                                {m.displayName ? m.displayName.charAt(0).toUpperCase() : "P"}
                              </span>
                            </Box>

                            <Box style={{ minWidth: 0 }}>
                              <Text fw={700} size="xs" truncate>
                                {m.displayName || "Participant"}
                                {isMe && (
                                  <Text span c="orange" fw={700} ml={4}>
                                    (You)
                                  </Text>
                                )}
                              </Text>

                              <Group gap={4}>
                                {isHost ? (
                                  <Badge size="xs" color="yellow" variant="light" p={2}>
                                    <Crown size={10} /> Host
                                  </Badge>
                                ) : team ? (
                                  <Badge
                                    size="xs"
                                    style={{ backgroundColor: team.primaryColor, color: "#fff" }}
                                    p={2}
                                  >
                                    {team.code}
                                  </Badge>
                                ) : (
                                  <Text size="10px" c="dimmed">
                                    Spectator
                                  </Text>
                                )}
                              </Group>
                            </Box>
                          </Group>

                          {isCreator && !isHost && !isMe && (
                            <Tooltip label="Remove user from lobby">
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Remove ${m.displayName || "this user"}?`)) {
                                    kickUser(m.userId);
                                  }
                                }}
                              >
                                <UserCircleMinus size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Paper>

              {/* FRANCHISE SELECTION & TAKEOVER GRID */}
              <Box>
                <Group justify="space-between" mb="xs">
                  <Group gap={6}>
                    <Shield size={16} color="var(--mantine-color-orange-5)" />
                    <Text fw={700} size="sm">
                      Select Franchise (10 Teams)
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {humanTeamsCount} Human / {botTeamsCount} Bot
                  </Text>
                </Group>

                <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="xs">
                  {teamsList.map((team) => {
                    const isClaimedByMe = myFranchise === team.code;
                    const isBot = team.controller === "AI";
                    const isHuman = team.controller === "HUMAN";

                    return (
                      <Paper
                        key={team.code}
                        p="xs"
                        radius="md"
                        withBorder
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          backgroundColor: isClaimedByMe
                            ? "var(--mantine-color-dark-6)"
                            : "var(--mantine-color-dark-7)",
                          borderColor: isClaimedByMe
                            ? "var(--mantine-color-orange-5)"
                            : undefined,
                          boxShadow: isClaimedByMe ? "0 0 0 1px var(--mantine-color-orange-5)" : undefined,
                        }}
                      >
                        <Box
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            backgroundColor: team.primaryColor,
                          }}
                        />

                        <Box pt={2}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap" mb={4}>
                            <Box style={{ minWidth: 0 }}>
                              <Badge
                                size="xs"
                                style={{ backgroundColor: team.primaryColor, color: "#fff" }}
                              >
                                {team.code}
                              </Badge>
                              <Text fw={700} size="xs" truncate mt={2}>
                                {team.name}
                              </Text>
                            </Box>

                            {isHuman ? (
                              <Tooltip
                                label={
                                  isClaimedByMe
                                    ? "Claimed by You (Human Controller)"
                                    : `Claimed by ${team.humanDisplayName || "Human"}`
                                }
                                withArrow
                              >
                                <ThemeIcon
                                  size="xs"
                                  color="teal"
                                  variant="light"
                                  radius="sm"
                                  style={{ flexShrink: 0 }}
                                >
                                  <UserCheck size={13} weight="bold" />
                                </ThemeIcon>
                              </Tooltip>
                            ) : (
                              <Tooltip label="AI Bot Controller" withArrow>
                                <ThemeIcon
                                  size="xs"
                                  color="gray"
                                  variant="subtle"
                                  radius="sm"
                                  style={{ flexShrink: 0 }}
                                >
                                  <Robot size={13} weight="bold" />
                                </ThemeIcon>
                              </Tooltip>
                            )}
                          </Group>

                          <Stack gap={2} mb="xs">
                            <Group justify="space-between">
                              <Text size="10px" c="dimmed">
                                Purse:
                              </Text>
                              <Text size="xs" fw={700} ff="monospace" c="teal">
                                ₹{(team.remainingPurse / 10000000).toFixed(1)} Cr
                              </Text>
                            </Group>
                            {snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" && (
                              <Group justify="space-between">
                                <Text size="10px" c="dimmed">
                                  Retained:
                                </Text>
                                <Text size="10px" fw={700} ff="monospace" c="grape">
                                  {team.retainedPlayers?.length || 0} ({team.rtmCardsRemaining ?? 0} RTM)
                                </Text>
                              </Group>
                            )}
                          </Stack>
                        </Box>

                        {/* Action Buttons: 1-row compact design, no empty whitespace */}
                        <Box>
                          {isClaimedByMe ? (
                            <Group gap={4} wrap="nowrap">
                              {snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" ? (
                                <>
                                  <Button
                                    size="xs"
                                    color="grape"
                                    variant="light"
                                    style={{ flex: 1, minWidth: 0 }}
                                    px={6}
                                    leftSection={<Cards size={13} weight="bold" />}
                                    onClick={() => setRetentionTeamCode(team.code)}
                                  >
                                    <span className="hidden sm:inline">Retentions </span>(
                                    {team.retainedPlayers?.length || 0})
                                  </Button>
                                  <Tooltip label="Release Franchise" withArrow>
                                    <ActionIcon
                                      size="input-xs"
                                      color="red"
                                      variant="subtle"
                                      onClick={releaseTeam}
                                      aria-label="Release Franchise"
                                      style={{ flexShrink: 0 }}
                                    >
                                      <SignOut size={14} weight="bold" />
                                    </ActionIcon>
                                  </Tooltip>
                                </>
                              ) : (
                                <Button
                                  size="xs"
                                  color="red"
                                  variant="subtle"
                                  fullWidth
                                  leftSection={<SignOut size={13} weight="bold" />}
                                  onClick={releaseTeam}
                                >
                                  Release Franchise
                                </Button>
                              )}
                            </Group>
                          ) : isBot ? (
                            <Group gap={4} wrap="nowrap">
                              <Button
                                size="xs"
                                color="orange"
                                style={{ flex: 1, minWidth: 0 }}
                                px={6}
                                rightSection={<CaretRight size={13} weight="bold" />}
                                onClick={() => {
                                  if (myFranchise) {
                                    takeOverTeam(team.code);
                                  } else {
                                    claimTeam(team.code);
                                  }
                                }}
                              >
                                Claim
                              </Button>
                              {isCreator && snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" && (
                                <Tooltip label="Manage Retentions" withArrow>
                                  <ActionIcon
                                    size="input-xs"
                                    color="grape"
                                    variant="subtle"
                                    onClick={() => setRetentionTeamCode(team.code)}
                                    aria-label="Manage Retentions"
                                    style={{ flexShrink: 0 }}
                                  >
                                    <Cards size={14} weight="bold" />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </Group>
                          ) : isCreator ? (
                            <Group gap={4} wrap="nowrap">
                              <Paper
                                p="4px 6px"
                                radius="xs"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  backgroundColor: "var(--mantine-color-dark-8)",
                                }}
                              >
                                <Text size="10px" c="dimmed" truncate ta="center">
                                  {team.humanDisplayName || "Human"}
                                </Text>
                              </Paper>
                              {snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" && (
                                <Tooltip label="Manage Retentions" withArrow>
                                  <ActionIcon
                                    size="input-xs"
                                    color="grape"
                                    variant="subtle"
                                    onClick={() => setRetentionTeamCode(team.code)}
                                    aria-label="Manage Retentions"
                                    style={{ flexShrink: 0 }}
                                  >
                                    <Cards size={13} weight="bold" />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                              <Tooltip label="Reassign to AI Bot" withArrow>
                                <ActionIcon
                                  size="input-xs"
                                  variant="default"
                                  onClick={() => reassignToBot(team.code)}
                                  aria-label="Reassign to Bot"
                                  style={{ flexShrink: 0 }}
                                >
                                  <Robot size={13} weight="bold" />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          ) : (
                            <Paper
                              p={4}
                              radius="xs"
                              ta="center"
                              style={{ backgroundColor: "var(--mantine-color-dark-8)" }}
                            >
                              <Text size="10px" c="dimmed" truncate>
                                {team.humanDisplayName || "Player"}
                              </Text>
                            </Paper>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Box>
            </Stack>
          </ScrollArea>

          {/* Action Bar (Start Auction / Waiting for Host) */}
          <Paper
            p="xs"
            radius={0}
            style={{
              flexShrink: 0,
              borderTop: "1px solid var(--mantine-color-dark-4)",
              backgroundColor: "rgba(10, 14, 34, 0.95)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Box style={{ maxWidth: 1100, margin: "0 auto" }}>
              {isCreator ? (
                <Button
                  color="teal"
                  size="md"
                  fullWidth
                  leftSection={<Play size={18} weight="fill" />}
                  onClick={startAuction}
                >
                  Start Auction Now
                </Button>
              ) : (
                <Paper p={6} radius="md" ta="center" withBorder style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                  <Group justify="center" gap={6}>
                    <Loader size={12} color="yellow" />
                    <Text size="xs" fw={700} c="yellow">
                      Waiting for Host to start auction...
                    </Text>
                  </Group>
                </Paper>
              )}
            </Box>
          </Paper>
        </Box>

        {/* RIGHT COLUMN: Sidebar (Chat, Activity, Room Rules & Host Start Auction) */}
        <Box
          component="aside"
          className={`lobby-column-chat ${mobileTab === "chat" ? "" : "lobby-hide-mobile"}`}
        >
          {/* Subtabs Header */}
          <Paper
            p={4}
            radius={0}
            style={{
              borderTop: 0,
              borderLeft: 0,
              borderRight: 0,
              borderBottom: "1px solid var(--mantine-color-dark-5)",
              backgroundColor: "var(--mantine-color-dark-9)",
            }}
          >
            <Group grow gap={4}>
              <UnstyledButton
                onClick={() => setSidebarTab("chat")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor:
                    sidebarTab === "chat" ? "var(--mantine-color-dark-6)" : "transparent",
                  color:
                    sidebarTab === "chat"
                      ? "var(--mantine-color-white)"
                      : "var(--mantine-color-dimmed)",
                }}
              >
                <ChatCenteredText size={14} color="var(--mantine-color-indigo-4)" />
                <span>Live Chat</span>
                {unreadChatCount > 0 && sidebarTab !== "chat" && (
                  <Badge size="xs" color="red" variant="filled">
                    {unreadChatCount}
                  </Badge>
                )}
              </UnstyledButton>

              <UnstyledButton
                onClick={() => setSidebarTab("activity")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor:
                    sidebarTab === "activity" ? "var(--mantine-color-dark-6)" : "transparent",
                  color:
                    sidebarTab === "activity"
                      ? "var(--mantine-color-white)"
                      : "var(--mantine-color-dimmed)",
                }}
              >
                <Broadcast size={14} color="var(--mantine-color-blue-4)" />
                <span>Activity</span>
                {unreadActivityCount > 0 && sidebarTab !== "activity" && (
                  <Badge size="xs" color="blue" variant="filled">
                    {unreadActivityCount}
                  </Badge>
                )}
              </UnstyledButton>

              <UnstyledButton
                onClick={() => setSidebarTab("rules")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor:
                    sidebarTab === "rules" ? "var(--mantine-color-dark-6)" : "transparent",
                  color:
                    sidebarTab === "rules"
                      ? "var(--mantine-color-white)"
                      : "var(--mantine-color-dimmed)",
                }}
              >
                <Cards size={14} color="var(--mantine-color-teal-4)" />
                <span>Rules</span>
              </UnstyledButton>
            </Group>
          </Paper>

          {/* Subtab Content Area */}
          <Box style={{ flex: 1, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
            {sidebarTab === "chat" && (
              <LiveChat onSendMessage={sendChat} isConnected={isConnected} />
            )}

            {sidebarTab === "activity" && (
              <Box style={{ flex: 1, overflowY: "auto" }}>
                <ActivityFeed />
              </Box>
            )}

            {sidebarTab === "rules" && (
              <ScrollArea style={{ flex: 1 }} p="md">
                <Stack gap="md">
                  <Box>
                    <Text fw={700} size="sm">
                      Auction Specifications
                    </Text>
                    <Text size="xs" c="dimmed">
                      Official BCCI IPL 2026 Regulations applied to this room.
                    </Text>
                  </Box>

                  <Paper p="sm" radius="md" withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Group gap={6}>
                          <Coins size={14} color="var(--mantine-color-yellow-4)" />
                          <Text size="xs" c="dimmed">
                            Purse
                          </Text>
                        </Group>
                        <Text size="xs" fw={700} ff="monospace">
                          {snapshot.ruleset === "SPRINT_XI" ? "₹50 Crore" : "₹120 Crore"}
                        </Text>
                      </Group>
                      <Divider />
                      <Group justify="space-between">
                        <Group gap={6}>
                          <Users size={14} color="var(--mantine-color-blue-4)" />
                          <Text size="xs" c="dimmed">
                            Squad Size
                          </Text>
                        </Group>
                        <Text size="xs" fw={700} ff="monospace">
                          {snapshot.ruleset === "SPRINT_XI" ? "11 Players" : "18 – 25 Players"}
                        </Text>
                      </Group>
                      <Divider />
                      <Group justify="space-between">
                        <Group gap={6}>
                          <Clock size={14} color="var(--mantine-color-red-4)" />
                          <Text size="xs" c="dimmed">
                            Bid Timer
                          </Text>
                        </Group>
                        <Text size="xs" fw={700} ff="monospace">
                          10s per Increment
                        </Text>
                      </Group>
                      <Divider />
                      <Group justify="space-between">
                        <Group gap={6}>
                          <Sparkle size={14} color="var(--mantine-color-grape-4)" />
                          <Text size="xs" c="dimmed">
                            Sets
                          </Text>
                        </Group>
                        <Text size="xs" fw={700} ff="monospace">
                          {snapshot.totalLots || 472} Lots
                        </Text>
                      </Group>
                    </Stack>
                  </Paper>

                  <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "var(--mantine-color-dark-7)" }}>
                    <Text fw={700} size="xs" mb={2}>
                      Takeover Rule:
                    </Text>
                    <Text size="xs" c="dimmed">
                      Anyone in the arena can take over any AI bot franchise at any time.
                    </Text>
                  </Paper>
                </Stack>
              </ScrollArea>
            )}
          </Box>
        </Box>
      </Box>

      {/* Mandatory Guest Name Modal */}
      <JoinNameModal
        isOpen={!isAuthenticated && !guestName}
        onSetName={(name) => {
          setGuestName(name);
          updateDisplayName(name);
        }}
      />

      {/* Manage Retentions Modal (Lobby) */}
      {retentionTeamCode && snapshot?.teams?.[retentionTeamCode] && (
        <ManageRetentionsModal
          isOpen={Boolean(retentionTeamCode)}
          onClose={() => setRetentionTeamCode(null)}
          franchiseCode={retentionTeamCode}
          franchiseState={snapshot.teams[retentionTeamCode]}
          ruleset={snapshot.ruleset || "MEGA"}
          onSaveRetentions={(code, playerIds) => {
            setRetentions(code, playerIds);
            setRetentionTeamCode(null);
          }}
        />
      )}
    </Box>
  );
}
