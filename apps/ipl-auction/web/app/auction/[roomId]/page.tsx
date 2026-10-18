"use client";

import React, { use } from "react";
import {
  Box,
  Stack,
  Group,
  Loader,
  Text,
  Badge,
  UnstyledButton,
  Paper,
} from "@mantine/core";
import { Broadcast, ChatCenteredText } from "@phosphor-icons/react";
import { useRoomRouteGuard } from "../../../hooks/useRoomRouteGuard";
import { useAuctionRoom } from "../../../hooks/useAuctionRoom";
import { useAuctionVoice } from "../../../hooks/useAuctionVoice";
import { useAuctionStore } from "../../../stores/auctionStore";
import { useAuthStore } from "../../../stores/authStore";
import { TopNavBar } from "../../../components/layout/TopNavBar";
import { MobileBottomNav } from "../../../components/layout/MobileBottomNav";
import { TeamAccordions } from "../../../components/teams/TeamAccordions";
import { AuctionWorkspace } from "../../../components/auction/AuctionWorkspace";
import { ActivityFeed } from "../../../components/activity/ActivityFeed";
import { LiveChat } from "../../../components/chat/LiveChat";
import { CurrentSetPlayersList } from "../../../components/auction/CurrentSetPlayersList";
import { JoinNameModal } from "../../../components/auth/JoinNameModal";
import { InvalidRoomError } from "../../../components/common/InvalidRoomError";

export default function AuctionPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = use(params);
  const rawRoomId = resolvedParams.roomId;
  const roomId = rawRoomId.startsWith("room_") ? rawRoomId : rawRoomId.toUpperCase();

  // Validate room status and auto-redirect if phase doesn't match
  const { isValidating, isInvalidRoom, errorMessage } = useRoomRouteGuard(roomId, "auction");

  const {
    isConnected,
    serverTimeOffset,
    placeBid,
    claimTeam,
    takeOverTeam,
    reassignToBot,
    banUser,
    startAuction,
    pauseAuction,
    resumeAuction,
    endAuction,
    sendChat,
    setRetentions,
    decideRtm,
    updateDisplayName,
    currentUserId,
  } = useAuctionRoom(roomId);

  // Initialize latest-event-wins voice listener
  useAuctionVoice();

  const { isAuthenticated } = useAuthStore();
  const [guestName, setGuestName] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ipl_auction_user_name");
    }
    return null;
  });

  const {
    snapshot,
    myFranchise,
    activeMobileTab,
    activityTab,
    setActivityTab,
    unreadChatCount,
    unreadActivityCount,
  } = useAuctionStore();

  const isCreatorStored =
    typeof window !== "undefined" && localStorage.getItem(`ipl_room_creator_${roomId}`) === "true";
  const isCreator = Boolean(
    (snapshot?.creatorId && snapshot?.creatorId === currentUserId) || isCreatorStored
  );

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
            Entering Auction Arena...
          </Text>
          <Text size="xs" c="dimmed">
            Connecting to room {roomId}
          </Text>
        </Stack>
      </Box>
    );
  }

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
      {/* Compact Top Navigation Bar */}
      <TopNavBar roomId={roomId} roomName={snapshot?.name} />

      {/* Main Responsive Grid Area */}
      <Box component="main" style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        {/* DESKTOP VIEW (>= 1024px): 25fr 45fr 30fr Grid */}
        <Box
          className="hidden lg:grid"
          style={{
            gridTemplateColumns: "25fr 45fr 30fr",
            height: "100%",
            width: "100%",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* LEFT COLUMN: 25% - Teams & 1-Click Bot Takeover */}
          <Box
            component="section"
            style={{
              height: "100%",
              overflow: "hidden",
              minHeight: 0,
              borderRight: "1px solid var(--ipl-border)",
            }}
          >
            <TeamAccordions
              onClaimTeam={claimTeam}
              onTakeOverTeam={takeOverTeam}
              onReassignToBot={reassignToBot}
              onBanUser={banUser}
              isCreator={isCreator}
              currentUserId={currentUserId}
            />
          </Box>

          {/* CENTER COLUMN: 45% - Main Auction Workspace */}
          <Box
            component="section"
            style={{
              height: "100%",
              overflow: "hidden",
              minHeight: 0,
              borderRight: "1px solid var(--ipl-border)",
            }}
          >
            <AuctionWorkspace
              onPlaceBid={(amount) => {
                if (snapshot?.currentLot && myFranchise) {
                  placeBid(amount, myFranchise, snapshot.currentLot.id, snapshot.stateVersion);
                }
              }}
              onStartAuction={startAuction}
              onPauseAuction={pauseAuction}
              onResumeAuction={resumeAuction}
              onEndAuction={endAuction}
              onClaimTeam={claimTeam}
              onSetRetentions={setRetentions}
              onDecideRtm={decideRtm}
              serverOffset={serverTimeOffset}
            />
          </Box>

          {/* RIGHT COLUMN: 30% - Upper (Activity / Chat), Lower (Current Set Players) */}
          <Box
            component="section"
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: 0,
              backgroundColor: "transparent",
            }}
          >
            {/* Upper Part: Activity & Live Chat */}
            <Box
              style={{
                height: "52%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                minHeight: 0,
                borderBottom: "1px solid var(--ipl-border)",
              }}
            >
              {/* Activity & Chat Tab Header */}
              <Paper
                p={4}
                radius={0}
                style={{
                  borderTop: 0,
                  borderLeft: 0,
                  borderRight: 0,
                  borderBottom: "1px solid var(--ipl-border)",
                  backgroundColor: "var(--ipl-bg-card-subtle)",
                }}
              >
                <Group gap={4}>
                  <UnstyledButton
                    onClick={() => setActivityTab("activity")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor:
                        activityTab === "activity"
                          ? "var(--ipl-bg-card)"
                          : "transparent",
                      color:
                        activityTab === "activity"
                          ? "var(--mantine-color-text)"
                          : "var(--mantine-color-dimmed)",
                      border:
                        activityTab === "activity"
                          ? "1px solid var(--ipl-border)"
                          : "1px solid transparent",
                    }}
                  >
                    <Broadcast size={14} color="var(--mantine-color-blue-4)" />
                    <span>Activity</span>
                    {unreadActivityCount > 0 && activityTab !== "activity" && (
                      <Badge size="xs" color="blue" variant="filled">
                        {unreadActivityCount}
                      </Badge>
                    )}
                  </UnstyledButton>

                  <UnstyledButton
                    onClick={() => setActivityTab("chat")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor:
                        activityTab === "chat"
                          ? "var(--ipl-bg-card)"
                          : "transparent",
                      color:
                        activityTab === "chat"
                          ? "var(--mantine-color-text)"
                          : "var(--mantine-color-dimmed)",
                      border:
                        activityTab === "chat"
                          ? "1px solid var(--ipl-border)"
                          : "1px solid transparent",
                    }}
                  >
                    <ChatCenteredText size={14} color="var(--mantine-color-indigo-4)" />
                    <span>Live Chat</span>
                    {unreadChatCount > 0 && activityTab !== "chat" && (
                      <Badge size="xs" color="red" variant="filled">
                        {unreadChatCount}
                      </Badge>
                    )}
                  </UnstyledButton>
                </Group>
              </Paper>

              {/* Active Sub-tab View */}
              <Box style={{ flex: 1, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
                {activityTab === "activity" ? (
                  <ActivityFeed />
                ) : (
                  <LiveChat onSendMessage={sendChat} isConnected={isConnected} />
                )}
              </Box>
            </Box>

            {/* Lower Part: Current Set Players List */}
            <Box style={{ height: "48%", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <CurrentSetPlayersList roomId={roomId} />
            </Box>
          </Box>
        </Box>

        {/* MOBILE VIEW (< 1024px) */}
        <Box
          className="lg:hidden"
          style={{
            height: "100%",
            width: "100%",
            overflow: "hidden",
            minHeight: 0,
            paddingBottom: 56,
          }}
        >
          {activeMobileTab === "teams" && (
            <Box style={{ height: "100%", overflow: "hidden", minHeight: 0 }}>
              <TeamAccordions
                onClaimTeam={claimTeam}
                onTakeOverTeam={takeOverTeam}
                onReassignToBot={reassignToBot}
                onBanUser={banUser}
                isCreator={isCreator}
                currentUserId={currentUserId}
              />
            </Box>
          )}

          {activeMobileTab === "auction" && (
            <Box style={{ height: "100%", overflow: "hidden", minHeight: 0, maxWidth: 860, margin: "0 auto" }}>
              <AuctionWorkspace
                onPlaceBid={(amount) => {
                  if (snapshot?.currentLot && myFranchise) {
                    placeBid(amount, myFranchise, snapshot.currentLot.id, snapshot.stateVersion);
                  }
                }}
                onStartAuction={startAuction}
                onPauseAuction={pauseAuction}
                onResumeAuction={resumeAuction}
                onEndAuction={endAuction}
                onClaimTeam={claimTeam}
                onSetRetentions={setRetentions}
                onDecideRtm={decideRtm}
                serverOffset={serverTimeOffset}
              />
            </Box>
          )}

          {activeMobileTab === "activity" && (
            <Box style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <Box
                style={{
                  height: "55%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  minHeight: 0,
                  borderBottom: "1px solid var(--ipl-border)",
                }}
              >
                <Paper
                  p={4}
                  radius={0}
                  style={{
                    borderTop: 0,
                    borderLeft: 0,
                    borderRight: 0,
                    borderBottom: "1px solid var(--ipl-border)",
                    backgroundColor: "var(--ipl-bg-card-subtle)",
                  }}
                >
                  <Group grow gap={4}>
                    <UnstyledButton
                      onClick={() => setActivityTab("activity")}
                      style={{
                        textAlign: "center",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        backgroundColor:
                          activityTab === "activity"
                            ? "var(--ipl-bg-card)"
                            : "transparent",
                        color:
                          activityTab === "activity"
                            ? "var(--mantine-color-text)"
                            : "var(--mantine-color-dimmed)",
                      }}
                    >
                      Activity
                    </UnstyledButton>
                    <UnstyledButton
                      onClick={() => setActivityTab("chat")}
                      style={{
                        textAlign: "center",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        backgroundColor:
                          activityTab === "chat"
                            ? "var(--ipl-bg-card)"
                            : "transparent",
                        color:
                          activityTab === "chat"
                            ? "var(--mantine-color-text)"
                            : "var(--mantine-color-dimmed)",
                      }}
                    >
                      Live Chat {unreadChatCount > 0 && `(${unreadChatCount})`}
                    </UnstyledButton>
                  </Group>
                </Paper>

                <Box style={{ flex: 1, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
                  {activityTab === "activity" ? (
                    <ActivityFeed />
                  ) : (
                    <LiveChat onSendMessage={sendChat} isConnected={isConnected} />
                  )}
                </Box>
              </Box>

              <Box style={{ height: "45%", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                <CurrentSetPlayersList roomId={roomId} />
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Mandatory Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Mandatory Guest Name Entry Modal */}
      <JoinNameModal
        isOpen={!isAuthenticated && !guestName}
        onSetName={(name) => {
          setGuestName(name);
          updateDisplayName(name);
        }}
      />
    </Box>
  );
}
