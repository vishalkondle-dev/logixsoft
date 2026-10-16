"use client";

import React, { use, useState } from "react";
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
import { cn } from "../../../lib/utils";
import {
  Users,
  Shield,
  Crown,
  Play,
  Bot,
  UserX,
  UserCheck,
  Sparkles,
  Copy,
  Check,
  MessageSquare,
  Activity,
  Layers,
  Clock,
  Coins,
  ChevronRight,
  LogOut,
} from "lucide-react";

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
    banUser,
    kickUser,
    releaseTeam,
    sendChat,
    setRetentions,
    updateDisplayName,
    currentUserId,
  } = useAuctionRoom(roomId);

  const { user, isAuthenticated } = useAuthStore();
  const [guestName, setGuestName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ipl_auction_user_name");
    }
    return null;
  });

  const [copiedLink, setCopiedLink] = useState(false);
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
    (snapshot?.creatorId && (
      snapshot.creatorId === currentUserId ||
      snapshot.creatorId === "host" ||
      snapshot.creatorId === "official_host" ||
      snapshot.creatorId === "guest_creator"
    )) ||
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
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground space-y-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <span className="text-2xl">🏏</span>
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono text-sm font-bold text-foreground">Preparing Auction Lobby...</p>
          <p className="text-xs text-muted-foreground">Checking pitch and room code {roomId}</p>
        </div>
      </div>
    );
  }

  const teamsList = Object.values(snapshot.teams || {});
  const humanTeamsCount = teamsList.filter((t) => t.controller === "HUMAN").length;
  const botTeamsCount = teamsList.filter((t) => t.controller === "AI").length;

  // Joined participants list from snapshot or reconstructed from human teams
  const joinedMembers = snapshot.members && snapshot.members.length > 0
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
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background text-foreground select-none">
      {/* Top Navigation Bar */}
      <TopNavBar roomId={roomId} roomName={snapshot.name} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden min-h-0 flex flex-col lg:flex-row">
        {/* LEFT / CENTER COLUMN: Lobby Overview, Participants, and Teams */}
        <section className="flex-1 h-full overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">
          {/* Welcome & Room Status Banner */}
          <div className="bg-gradient-to-r from-primary/15 via-secondary/40 to-background border border-primary/25 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-full bg-radial from-primary/10 to-transparent pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[11px] font-black border border-amber-500/30">
                    LOBBY • WAITING FOR HOST
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-mono text-[11px] font-bold border border-blue-500/25">
                    {snapshot.ruleset || "MEGA"} AUCTION
                  </span>
                  {isCreator && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Room Host
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  {snapshot.name || "IPL 2026 Auction Arena"}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Claim your favorite franchise before the hammer falls. The host will start the live bidding when ready.
                </p>
              </div>

              {/* Share Invite Code Button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-secondary/60 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-primary" />}
                  <span>{copiedLink ? "Link Copied!" : "Share Room Link"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* JOINED PLAYERS & PARTICIPANTS PANEL */}
          <div className="bg-card/70 border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-foreground">
                  Joined Participants ({joinedMembers.length || snapshot.connectedHumanCount || 1})
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {isCreator ? "👑 You can manage and kick participants below" : "Lobby Presence"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {joinedMembers.map((m, idx) => {
                const isMe = m.userId === currentUserId;
                const isHost = m.userId === snapshot.creatorId || (isCreator && isMe);
                const team = m.claimedFranchise ? snapshot.teams?.[m.claimedFranchise] : null;

                return (
                  <div
                    key={m.sessionId || idx}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all text-xs",
                      isMe
                        ? "bg-primary/10 border-primary/40 shadow-xs"
                        : "bg-secondary/30 border-border/70 hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar / Initial */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 text-white shadow-xs"
                        style={{
                          backgroundColor: team ? team.primaryColor : "#4f46e5",
                        }}
                      >
                        {m.displayName ? m.displayName.charAt(0).toUpperCase() : "P"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold truncate text-foreground">
                            {m.displayName || "Participant"}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-mono text-primary font-bold">(You)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {isHost ? (
                            <span className="text-amber-400 font-bold flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> Host
                            </span>
                          ) : team ? (
                            <span
                              className="font-bold px-1.5 py-0.2 rounded text-[9px] text-white"
                              style={{ backgroundColor: team.primaryColor }}
                            >
                              {team.code}
                            </span>
                          ) : (
                            <span>Spectator</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Host Kick / Ban Controls */}
                    {isCreator && !isHost && !isMe && (
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${m.displayName || "this user"} from the lobby?`)) {
                              kickUser(m.userId);
                            }
                          }}
                          title="Remove user from lobby"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FRANCHISE SELECTION & TAKEOVER GRID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  Select Your Franchise (10 Teams)
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {humanTeamsCount} Human / {botTeamsCount} AI Bots
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              {teamsList.map((team) => {
                const isClaimedByMe = myFranchise === team.code;
                const isBot = team.controller === "AI";
                const isHuman = team.controller === "HUMAN";

                return (
                  <div
                    key={team.code}
                    className={cn(
                      "rounded-xl border p-3 flex flex-col justify-between transition-all relative overflow-hidden",
                      isClaimedByMe
                        ? "bg-card border-primary ring-2 ring-primary/40 shadow-md"
                        : "bg-card/60 border-border/80 hover:border-border hover:bg-card/90"
                    )}
                  >
                    {/* Top Team Color Accent Bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: team.primaryColor }}
                    />

                    <div>
                      {/* Team Header */}
                      <div className="flex items-start justify-between gap-1.5 pt-1 mb-2">
                        <div className="min-w-0">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-black text-white font-mono shadow-xs"
                            style={{ backgroundColor: team.primaryColor }}
                          >
                            {team.code}
                          </span>
                          <h3 className="font-bold text-xs truncate mt-1 text-foreground">
                            {team.name}
                          </h3>
                        </div>

                        {/* Controller Badge */}
                        {isHuman ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-mono text-[9px] font-bold border border-emerald-500/30 flex items-center gap-0.5">
                            <UserCheck className="w-2.5 h-2.5" />
                            {isClaimedByMe ? "YOU" : "CLAIMED"}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono text-[9px] font-medium border border-border flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" />
                            BOT
                          </span>
                        )}
                      </div>

                      {/* Team Details */}
                      <div className="text-[11px] text-muted-foreground space-y-1 mb-3">
                        <div className="flex justify-between">
                          <span>Owner:</span>
                          <span className="font-medium text-foreground truncate max-w-[100px]">
                            {isClaimedByMe ? "You" : team.humanDisplayName || "AI Bot"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Purse:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            ₹{(team.remainingPurse / 10000000).toFixed(1)} Cr
                          </span>
                        </div>
                        {snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" && (
                          <div className="flex justify-between items-center text-[10px] pt-1 border-t border-border/40">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5 text-purple-400" /> Retentions:
                            </span>
                            <span className="font-mono font-semibold text-purple-400">
                              {team.retainedPlayers?.length || 0} ({team.rtmCardsRemaining ?? (snapshot.ruleset === "MEGA" ? Math.max(0, 6 - (team.retainedPlayers?.length || 0)) : 0)} RTM)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="space-y-1.5">
                      {isClaimedByMe ? (
                        <>
                          {snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" && (
                            <button
                              onClick={() => setRetentionTeamCode(team.code)}
                              className="w-full py-1.5 px-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-bold border border-purple-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Layers className="w-3.5 h-3.5 text-purple-400" />
                              <span>Manage Retentions ({team.retainedPlayers?.length || 0})</span>
                            </button>
                          )}
                          <button
                            onClick={releaseTeam}
                            className="w-full py-1 px-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-[11px] font-bold border border-red-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Release Team (To Bot)</span>
                          </button>
                        </>
                      ) : isBot ? (
                        <>
                          <button
                            onClick={() => {
                              if (myFranchise) {
                                takeOverTeam(team.code);
                              } else {
                                claimTeam(team.code);
                              }
                            }}
                            className="w-full py-1.5 px-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>Claim Team</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          {isCreator && snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" && (
                            <button
                              onClick={() => setRetentionTeamCode(team.code)}
                              className="w-full py-1 px-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[10px] font-semibold border border-purple-500/25 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Layers className="w-3 h-3 text-purple-400" />
                              <span>Configure Retentions</span>
                            </button>
                          )}
                        </>
                      ) : isCreator ? (
                        <>
                          {snapshot.enableRetentions && snapshot.ruleset !== "SPRINT_XI" && (
                            <button
                              onClick={() => setRetentionTeamCode(team.code)}
                              className="w-full py-1 px-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-[11px] font-bold border border-purple-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Layers className="w-3 h-3 text-purple-400" />
                              <span>Configure Retentions</span>
                            </button>
                          )}
                          <button
                            onClick={() => reassignToBot(team.code)}
                            title="Reassign human team to AI bot"
                            className="w-full py-1 px-2 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] font-semibold border border-border transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Bot className="w-3 h-3" />
                            <span>Reassign to Bot</span>
                          </button>
                        </>
                      ) : (
                        <div className="w-full py-1 text-center text-[10px] text-muted-foreground font-mono bg-secondary/30 rounded-lg">
                          Claimed by {team.humanDisplayName || "Player"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Sidebar (Chat, Activity, Room Rules & Host Start Auction) */}
        <aside className="w-full lg:w-80 xl:w-96 h-80 lg:h-full border-t lg:border-t-0 lg:border-l border-border/80 flex flex-col bg-background/50 min-h-0">
          {/* Subtabs Header */}
          <div className="flex items-center border-b border-border/80 bg-secondary/30 px-3 py-1.5 flex-shrink-0">
            <button
              onClick={() => setSidebarTab("chat")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                sidebarTab === "chat"
                  ? "bg-card text-foreground shadow-2xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Live Chat</span>
              {unreadChatCount > 0 && sidebarTab !== "chat" && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white font-mono text-[9px] font-black">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setSidebarTab("activity")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ml-1",
                sidebarTab === "activity"
                  ? "bg-card text-foreground shadow-2xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Activity</span>
              {unreadActivityCount > 0 && sidebarTab !== "activity" && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-mono text-[9px] font-black">
                  {unreadActivityCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setSidebarTab("rules")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ml-1",
                sidebarTab === "rules"
                  ? "bg-card text-foreground shadow-2xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Rules</span>
            </button>
          </div>

          {/* Subtab Content Area */}
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            {sidebarTab === "chat" && (
              <LiveChat onSendMessage={sendChat} isConnected={isConnected} />
            )}

            {sidebarTab === "activity" && (
              <div className="flex-1 overflow-y-auto">
                <ActivityFeed />
              </div>
            )}

            {sidebarTab === "rules" && (
              <div className="p-4 space-y-4 overflow-y-auto text-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-foreground">Auction Specifications</h4>
                  <p className="text-muted-foreground text-[11px]">
                    Official BCCI IPL 2026 Regulations applied to this room.
                  </p>
                </div>

                <div className="space-y-2 border border-border/70 rounded-xl p-3 bg-card/40">
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" /> Purse
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {snapshot.ruleset === "SPRINT_XI" ? "₹50 Crore" : "₹120 Crore"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" /> Squad Size
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {snapshot.ruleset === "SPRINT_XI" ? "11 Players" : "18 – 25 Players"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-red-400" /> Bid Timer
                    </span>
                    <span className="font-mono font-bold text-foreground">10s per Increment</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Sets
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {snapshot.totalLots || 472} Auction Lots
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-secondary/30 rounded-xl border border-border/60 space-y-1 text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">Takeover Rule:</span>
                  <p>
                    Anyone in the auction arena can take over any AI bot franchise at any time. Human-claimed teams cannot be usurped.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Host Action Bar */}
          <div className="p-3.5 border-t border-border/80 bg-card/60 flex-shrink-0">
            {isCreator ? (
              <button
                onClick={startAuction}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Auction Now</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-xs">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Waiting for Host</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The auction will begin as soon as the host clicks Start. You will automatically move to the arena.
                </p>
              </div>
            )}
          </div>
        </aside>
      </main>

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
    </div>
  );
}
