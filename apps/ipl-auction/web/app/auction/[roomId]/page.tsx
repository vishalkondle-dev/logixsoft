"use client";

import React, { use } from "react";
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
import { cn } from "../../../lib/utils";
import { Activity, MessageSquare } from "lucide-react";

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

  const { user, isAuthenticated } = useAuthStore();
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

  const isCreatorStored = typeof window !== "undefined" && localStorage.getItem(`ipl_room_creator_${roomId}`) === "true";
  const isCreator = Boolean((snapshot?.creatorId && snapshot?.creatorId === currentUserId) || isCreatorStored);

  // If probing or invalid
  if (isInvalidRoom) {
    return <InvalidRoomError roomId={roomId} errorMessage={errorMessage || undefined} />;
  }

  if (isValidating || !snapshot) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground space-y-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <span className="text-2xl">🔨</span>
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono text-sm font-bold text-foreground">Entering Auction Arena...</p>
          <p className="text-xs text-muted-foreground">Connecting to room {roomId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground select-none">
      {/* Compact Top Navigation Bar */}
      <TopNavBar roomId={roomId} roomName={snapshot?.name} />

      {/* Main Responsive Grid Area */}
      <main className="flex-1 overflow-hidden min-h-0 relative">
        {/* DESKTOP VIEW (>= 1024px): 25fr 45fr 30fr Grid */}
        <div className="hidden lg:grid grid-cols-[25fr_45fr_30fr] h-full w-full overflow-hidden min-h-0 divide-x divide-border/80">
          {/* LEFT COLUMN: 25% - Teams & 1-Click Bot Takeover */}
          <section className="h-full overflow-hidden min-h-0">
            <TeamAccordions
              onClaimTeam={claimTeam}
              onTakeOverTeam={takeOverTeam}
              onReassignToBot={reassignToBot}
              onBanUser={banUser}
              isCreator={isCreator}
              currentUserId={currentUserId}
            />
          </section>

          {/* CENTER COLUMN: 45% - Main Auction Workspace */}
          <section className="h-full overflow-hidden min-h-0">
            <AuctionWorkspace
              onPlaceBid={(amount) => {
                if (snapshot?.currentLot && myFranchise) {
                  placeBid(
                    amount,
                    myFranchise,
                    snapshot.currentLot.id,
                    snapshot.stateVersion
                  );
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
          </section>

          {/* RIGHT COLUMN: 30% - Vertically Divided: (a) Activity & Live Chat (b) Current Set Players List */}
          <section className="h-full flex flex-col overflow-hidden min-h-0 bg-background/30 divide-y divide-border/80">
            {/* Upper Part (a): Activity & Live Chat */}
            <div className="h-[52%] flex flex-col overflow-hidden min-h-0">
              {/* Activity & Chat Tab Header */}
              <div className="flex items-center border-b border-border/80 bg-secondary/30 px-3 py-1 flex-shrink-0">
                <button
                  onClick={() => setActivityTab("activity")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                    activityTab === "activity"
                      ? "bg-card text-foreground shadow-2xs border border-border/70"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  <span>Activity</span>
                  {unreadActivityCount > 0 && activityTab !== "activity" && (
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-mono text-[9px] font-black">
                      {unreadActivityCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActivityTab("chat")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ml-1",
                    activityTab === "chat"
                      ? "bg-card text-foreground shadow-2xs border border-border/70"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Live Chat</span>
                  {unreadChatCount > 0 && activityTab !== "chat" && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white font-mono text-[9px] font-black">
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Active Sub-tab View */}
              <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                {activityTab === "activity" ? (
                  <ActivityFeed />
                ) : (
                  <LiveChat onSendMessage={sendChat} isConnected={isConnected} />
                )}
              </div>
            </div>

            {/* Lower Part (b): Current Set Players List */}
            <div className="h-[48%] flex flex-col overflow-hidden min-h-0">
              <CurrentSetPlayersList roomId={roomId} />
            </div>
          </section>
        </div>

        {/* MOBILE VIEW (< 1024px): Tab Switching with Persistent WebSocket Connection */}
        <div className="lg:hidden h-full w-full overflow-hidden min-h-0 pb-14">
          {activeMobileTab === "teams" && (
            <div className="h-full overflow-hidden min-h-0">
              <TeamAccordions
                onClaimTeam={claimTeam}
                onTakeOverTeam={takeOverTeam}
                onReassignToBot={reassignToBot}
                onBanUser={banUser}
                isCreator={isCreator}
                currentUserId={currentUserId}
              />
            </div>
          )}

          {activeMobileTab === "auction" && (
            <div className="h-full overflow-hidden min-h-0 max-w-2xl mx-auto w-full">
              <AuctionWorkspace
                onPlaceBid={(amount) => {
                  if (snapshot?.currentLot && myFranchise) {
                    placeBid(
                      amount,
                      myFranchise,
                      snapshot.currentLot.id,
                      snapshot.stateVersion
                    );
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
            </div>
          )}

          {activeMobileTab === "activity" && (
            <div className="h-full flex flex-col overflow-hidden min-h-0 divide-y divide-border/80">
              {/* Activity vs Chat subtabs */}
              <div className="h-[55%] flex flex-col overflow-hidden min-h-0">
                <div className="flex items-center border-b border-border/80 bg-secondary/30 px-3 py-1 flex-shrink-0">
                  <button
                    onClick={() => setActivityTab("activity")}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center",
                      activityTab === "activity"
                        ? "bg-card text-foreground shadow-2xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Activity
                  </button>
                  <button
                    onClick={() => setActivityTab("chat")}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center ml-1",
                      activityTab === "chat"
                        ? "bg-card text-foreground shadow-2xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Live Chat {unreadChatCount > 0 && `(${unreadChatCount})`}
                  </button>
                </div>

                <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                  {activityTab === "activity" ? (
                    <ActivityFeed />
                  ) : (
                    <LiveChat onSendMessage={sendChat} isConnected={isConnected} />
                  )}
                </div>
              </div>

              {/* Lower Part: Current Set Players List */}
              <div className="h-[45%] flex flex-col overflow-hidden min-h-0">
                <CurrentSetPlayersList roomId={roomId} />
              </div>
            </div>
          )}
        </div>
      </main>

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
    </div>
  );
}
