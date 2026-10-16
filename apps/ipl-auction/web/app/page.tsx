"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { UserMenu } from "../components/auth/UserMenu";
import { AuthModal } from "../components/auth/AuthModal";
import { TeamIdentity } from "../components/teams/TeamIdentity";
import { ThemeToggle } from "../components/layout/ThemeToggle";
import { FRANCHISE_COLORS, cn } from "../lib/utils";
import {
  Gavel,
  PlusCircle,
  Sparkles,
  Users,
  Globe,
  Lock,
  Eye,
  RefreshCw,
  Radio,
  ArrowRight,
  Shield,
  Bot,
  Check,
} from "lucide-react";

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

export default function LobbyPage() {
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
  const [rulesetType, setRulesetType] = useState<"MEGA" | "CLASSIC" | "SPRINT_XI">("MEGA");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [selectedTeam, setSelectedTeam] = useState<string>("MI");
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [enableRetentions, setEnableRetentions] = useState<boolean>(true);

  // Public Rooms State
  const [publicRooms, setPublicRooms] = useState<PublicRoomItem[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);
  const [roomFilter, setRoomFilter] = useState<"ALL" | "LOBBY" | "LIVE">("ALL");

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
      let uid = typeof window !== "undefined"
        ? (localStorage.getItem("ipl_auction_ip_user_id") || localStorage.getItem("ipl_auction_user_id"))
        : null;
      if (!uid && typeof window !== "undefined") {
        uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("ipl_auction_user_id", uid);
      }

      const res = await fetchApi<{ roomId: string; isPublic: boolean; creatorTeam?: string }>("/api/rooms", {
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
      });

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
    if (roomFilter === "LIVE") return r.status === "LIVE" || r.status === "PAUSED" || r.status === "ENDED" || r.status === "COMPLETED";
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary selection:text-primary-foreground">
      {/* Top Header */}
      <header className="h-14 border-b border-border/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-white font-black text-sm shadow-md">
            IPL
          </div>
          <div>
            <span className="font-black text-sm tracking-tight">AUCTION SIMULATOR</span>
            <span className="text-[10px] text-muted-foreground ml-2 font-mono">2026 OFFICIAL RULES</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {isAdmin && (
            <a
              href="/admin/dashboard"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
            >
              Admin Panel
            </a>
          )}
          <UserMenu />
          <AuthModal />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 flex flex-col gap-10">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cloudflare Workers AI + Clef-Flash Decision Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            The Definitive Real-Time Cricket Auction
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Authentic IPL 2026 player shortlist & sets. Authoritative 10-second hammer countdowns,
            multiplayer WebSockets with Durable Object state persistence, and competitive Clef-Flash AI franchisees.
          </p>
        </div>

        {/* Section 1: Create Room & Join by Code */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Room Form (2 Cols on lg) */}
          <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-md flex flex-col justify-between">
            <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight">Host Multiplayer Auction</h2>
                    <p className="text-xs text-muted-foreground">Configure your room, pick your franchise, and invite players.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                    isPublic ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground border-border"
                  )}>
                    {isPublic ? "PUBLIC ROOM" : "PRIVATE ROOM"}
                  </span>
                </div>
              </div>

              {/* Creator Name (Mandatory if not logged in) */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Your Name <span className="text-red-400">*</span>
                </label>
                {isAuthenticated && user?.name ? (
                  <div className="w-full px-3 py-2 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-between">
                    <span>{user.name}</span>
                    <span className="text-[10px] font-mono font-normal text-emerald-300">Signed in via Google</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={creatorName}
                    onChange={(e) => {
                      setCreatorName(e.target.value);
                      try {
                        localStorage.setItem("ipl_auction_user_name", e.target.value);
                      } catch {}
                    }}
                    placeholder="Enter your name (mandatory to host or join)"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-secondary/50 border border-border focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground"
                  />
                )}
              </div>

              {/* Room Name */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Auction Room Name
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. IPL 2026 Mega Auction"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-secondary/50 border border-border focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              {/* Creator Team Choice */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground block">
                    Choose Your Franchise <span className="text-primary font-normal">(Creator plays as this team)</span>
                  </label>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Selected: <strong className="text-foreground">{selectedTeam}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {FRANCHISES.map((team) => {
                    const isSelected = selectedTeam === team.code;
                    const styling = FRANCHISE_COLORS[team.code];
                    return (
                      <button
                        key={team.code}
                        type="button"
                        onClick={() => setSelectedTeam(team.code)}
                        className={cn(
                          "relative p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                            : "border-border/70 bg-secondary/20 hover:bg-secondary/50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border shadow-xs",
                            styling?.bg || "bg-slate-700",
                            styling?.text || "text-white",
                            styling?.border || "border-slate-500"
                          )}
                        >
                          {team.code}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold truncate text-foreground">{team.code}</div>
                          <div className="text-[9px] text-muted-foreground truncate">{team.name.split(" ")[0]}</div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 text-primary">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auction Type, AI Difficulty & Public Room Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Auction Type
                  </label>
                  <select
                    value={rulesetType}
                    onChange={(e) => {
                      const val = e.target.value as "MEGA" | "CLASSIC" | "SPRINT_XI";
                      setRulesetType(val);
                      if (val === "SPRINT_XI") {
                        setEnableRetentions(false);
                      } else {
                        setEnableRetentions(true);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-secondary/50 border border-border text-foreground cursor-pointer"
                  >
                    <option value="MEGA">Mega (₹120 Cr, Max 6 Retentions)</option>
                    <option value="CLASSIC">Classic (₹120 Cr, Max 11 Retentions)</option>
                    <option value="SPRINT_XI">Sprint XI (₹50 Cr, Max 11 Players, 0 Retentions)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    AI Franchise Difficulty
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-secondary/50 border border-border text-foreground cursor-pointer"
                  >
                    <option value="easy">Easy (Conservative)</option>
                    <option value="normal">Normal (Realistic)</option>
                    <option value="hard">Hard (Aggressive)</option>
                  </select>
                </div>

                {/* Public Room Toggle */}
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Visibility
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPublic(!isPublic)}
                    className={cn(
                      "w-full px-3 py-2 rounded-xl text-xs border font-medium flex items-center justify-between transition-colors cursor-pointer",
                      isPublic
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-secondary/40 border-border text-muted-foreground"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{isPublic ? "Public Directory" : "Private (Code Only)"}</span>
                    </span>
                    <span className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white",
                      isPublic ? "bg-emerald-500" : "bg-muted-foreground"
                    )}>
                      {isPublic ? "✓" : "—"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Official Retentions & RTM Toggle */}
              <div className={cn(
                "p-3 rounded-xl border flex items-center justify-between gap-3 transition-opacity",
                rulesetType === "SPRINT_XI" ? "bg-muted/30 border-border/40 opacity-60" : "bg-secondary/30 border-border/80"
              )}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center font-black text-xs shrink-0 border border-amber-500/30">
                    RTM
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground flex items-center gap-2 flex-wrap">
                      <span>Enable Official Retentions & Right to Match (RTM)</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        {rulesetType === "SPRINT_XI" ? "Disabled in Sprint XI" : (rulesetType === "MEGA" ? "Max 6 Retentions" : "Max 11 Retentions")}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate sm:whitespace-normal">
                      {rulesetType === "SPRINT_XI"
                        ? "Sprint XI mode forbids retentions and RTM. Teams draft a 11-player squad from scratch."
                        : (rulesetType === "MEGA"
                            ? "Teams retain up to 6 players (max 5 capped, 2 uncapped) with ₹18, 14, 11, 18, 14 Cr slabs. Unused cards become RTM."
                            : "Teams retain up to 11 players with official salaries deducted from ₹120 Cr purse. Unused slots become RTM cards.")}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={rulesetType === "SPRINT_XI"}
                  onClick={() => setEnableRetentions(!enableRetentions)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                    enableRetentions && rulesetType !== "SPRINT_XI" ? "bg-primary" : "bg-muted",
                    rulesetType === "SPRINT_XI" && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                      enableRetentions && rulesetType !== "SPRINT_XI" ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer mt-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isCreating ? "Initializing Auction Room..." : "Create & Enter Auction Room"}</span>
              </button>
            </form>
          </div>

          {/* Join with Room Code Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-md flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Join with Room Code</h2>
                  <p className="text-xs text-muted-foreground">Got an invite code? Enter it below to join.</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect directly to an existing private or custom room hosted by your friend or community organizer.
              </p>

              <form onSubmit={handleJoinById} className="flex flex-col gap-3 mt-1">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Room Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A1C2E3 or K4K9S1"
                    maxLength={10}
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-xl text-xs bg-secondary/50 border border-border focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground font-mono uppercase tracking-wider"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!roomIdInput.trim()}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-secondary hover:bg-secondary/80 text-foreground border border-border flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Join Room</span>
                </button>
              </form>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 text-[11px] text-muted-foreground flex flex-col gap-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-primary" /> Want to browse games?
              </span>
              <span>Check the Public Directory below to find games waiting for participants!</span>
            </div>
          </div>
        </div>

        {/* Section 2: Public Auctions Directory */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Public Auctions Directory</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {publicRooms.length} {publicRooms.length === 1 ? "Room" : "Rooms"} Available
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Join rooms in the lobby before the auction starts, or watch and spectate live auctions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center rounded-xl bg-secondary/40 p-1 border border-border">
                <button
                  onClick={() => setRoomFilter("ALL")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    roomFilter === "ALL" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All ({publicRooms.length})
                </button>
                <button
                  onClick={() => setRoomFilter("LOBBY")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                    roomFilter === "LOBBY" ? "bg-emerald-500/15 text-emerald-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Joinable Lobby ({publicRooms.filter((r) => r.status === "LOBBY").length})
                </button>
                <button
                  onClick={() => setRoomFilter("LIVE")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                    roomFilter === "LIVE" ? "bg-amber-500/15 text-amber-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Radio className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                  Live & Finished ({publicRooms.filter((r) => r.status !== "LOBBY").length})
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadPublicRooms}
                disabled={isLoadingRooms}
                className="p-2 rounded-xl bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                title="Refresh Room Directory"
              >
                <RefreshCw className={cn("w-4 h-4", isLoadingRooms && "animate-spin text-primary")} />
              </button>
            </div>
          </div>

          {/* Rooms Grid / Cards */}
          {filteredRooms.length === 0 ? (
            <div className="p-10 rounded-2xl bg-card border border-border/80 text-center flex flex-col items-center justify-center gap-2">
              <Globe className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">No public rooms found in this category</p>
              <p className="text-xs text-muted-foreground">
                Be the first to create an open room using the form above!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => {
                const isLobby = room.status === "LOBBY";
                const isLive = room.status === "LIVE" || room.status === "PAUSED";
                const isEnded = room.status === "ENDED" || room.status === "COMPLETED";

                return (
                  <div
                    key={room.id}
                    className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-border transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div>
                      {/* Status & Ruleset Badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5",
                            isLobby && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                            isLive && "bg-amber-500/15 text-amber-400 border-amber-500/30",
                            isEnded && "bg-slate-700/30 text-slate-400 border-slate-600/30"
                          )}
                        >
                          {isLive && <Radio className="w-2 h-2 animate-pulse text-amber-400" />}
                          {isLobby && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          <span>{room.status}</span>
                        </span>

                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          {room.ruleset} AUCTION
                        </span>
                      </div>

                      {/* Room Title */}
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {room.name}
                      </h3>

                      <div className="text-[11px] font-mono text-muted-foreground/80 mt-0.5 truncate">
                        ID: {room.id}
                      </div>

                      {/* Info Badges */}
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                        <div className="p-2 rounded-lg bg-secondary/30 border border-border/40 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Online</span>
                            <span className="font-semibold text-foreground">{room.connectedCount || 1} Human(s)</span>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-secondary/30 border border-border/40 flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Bot Teams</span>
                            <span className="font-semibold text-foreground">
                              {room.botTeamsCount !== undefined ? `${room.botTeamsCount} Available` : "AI Driven"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Host Info */}
                      {room.creatorTeam && (
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground px-1">
                          <span>Host Playing As:</span>
                          <span className="font-bold text-foreground inline-flex items-center gap-1">
                            <span
                              className={cn(
                                "w-4 h-4 rounded text-[9px] font-black inline-flex items-center justify-center",
                                FRANCHISE_COLORS[room.creatorTeam]?.bg || "bg-slate-700",
                                FRANCHISE_COLORS[room.creatorTeam]?.text || "text-white"
                              )}
                            >
                              {room.creatorTeam}
                            </span>
                            <span>{room.creatorTeam}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div>
                      {isLobby ? (
                        <button
                          onClick={() => router.push(`/lobby/${room.id}`)}
                          className="w-full py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Join Lobby</span>
                        </button>
                      ) : isEnded ? (
                        <button
                          onClick={() => router.push(`/summary/${room.id}`)}
                          className="w-full py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-secondary hover:bg-secondary/80 text-foreground border border-border flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>View Summary</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/auction/${room.id}`)}
                          className="w-full py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Enter Auction Arena</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-border/80 px-6 flex items-center justify-between text-xs text-muted-foreground select-none">
        <span>Cloudflare Durable Objects • Workers AI • Next.js 16</span>
        <span>IPL Auction Simulator V2</span>
      </footer>
    </div>
  );
}
