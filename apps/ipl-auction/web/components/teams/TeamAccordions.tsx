"use client";

import React, { useState } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { TeamIdentity } from "./TeamIdentity";
import { TeamAverageRating } from "./TeamAverageRating";
import { formatRupees, cn } from "../../lib/utils";
import {
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Flame,
  Check,
  Plane,
  Shield,
  UserMinus,
  UserX,
  Zap,
} from "lucide-react";
import { PlayerRole, PurchasedPlayerRecord } from "../../lib/types";

interface TeamAccordionsProps {
  onClaimTeam: (code: string) => void;
  onTakeOverTeam?: (code: string) => void;
  onReassignToBot?: (code: string) => void;
  onBanUser?: (targetUserId: string, franchiseCode: string) => void;
  isCreator?: boolean;
  currentUserId?: string;
  className?: string;
}

/**
 * Authentic IPL Franchise Color Palette System
 */
const FRANCHISE_ACCORDION_THEMES: Record<
  string,
  {
    border: string;
    bg: string;
    leftBar: string;
    textAccent: string;
    purseText: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  CSK: {
    border: "border-amber-400/50 hover:border-amber-400/80 dark:border-amber-400/35",
    bg: "bg-amber-400/[0.08] hover:bg-amber-400/[0.14] dark:bg-amber-400/[0.04]",
    leftBar: "border-l-4 border-l-[#F9CD05]",
    textAccent: "text-amber-800 dark:text-amber-300",
    purseText: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30",
    badgeText: "text-amber-800 dark:text-amber-300",
  },
  MI: {
    border: "border-blue-500/50 hover:border-blue-500/80 dark:border-blue-500/35",
    bg: "bg-blue-500/[0.08] hover:bg-blue-500/[0.14] dark:bg-blue-500/[0.04]",
    leftBar: "border-l-4 border-l-[#004BA0]",
    textAccent: "text-blue-800 dark:text-blue-300",
    purseText: "text-blue-700 dark:text-blue-400",
    badgeBg: "bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-500/30",
    badgeText: "text-blue-800 dark:text-blue-300",
  },
  RCB: {
    border: "border-red-500/50 hover:border-red-500/80 dark:border-red-500/35",
    bg: "bg-red-500/[0.08] hover:bg-red-500/[0.14] dark:bg-red-500/[0.04]",
    leftBar: "border-l-4 border-l-[#D71920]",
    textAccent: "text-red-800 dark:text-red-300",
    purseText: "text-red-700 dark:text-red-400",
    badgeBg: "bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/30",
    badgeText: "text-red-800 dark:text-red-300",
  },
  KKR: {
    border: "border-purple-500/50 hover:border-purple-500/80 dark:border-purple-500/35",
    bg: "bg-purple-500/[0.08] hover:bg-purple-500/[0.14] dark:bg-purple-500/[0.04]",
    leftBar: "border-l-4 border-l-[#7B2CBF]",
    textAccent: "text-purple-800 dark:text-purple-300",
    purseText: "text-purple-700 dark:text-purple-400",
    badgeBg: "bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/30",
    badgeText: "text-purple-800 dark:text-purple-300",
  },
  SRH: {
    border: "border-orange-500/50 hover:border-orange-500/80 dark:border-orange-500/35",
    bg: "bg-orange-500/[0.08] hover:bg-orange-500/[0.14] dark:bg-orange-500/[0.04]",
    leftBar: "border-l-4 border-l-[#F26522]",
    textAccent: "text-orange-800 dark:text-orange-300",
    purseText: "text-orange-700 dark:text-orange-400",
    badgeBg: "bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/30",
    badgeText: "text-orange-800 dark:text-orange-300",
  },
  DC: {
    border: "border-sky-500/50 hover:border-sky-500/80 dark:border-sky-500/35",
    bg: "bg-sky-500/[0.08] hover:bg-sky-500/[0.14] dark:bg-sky-500/[0.04]",
    leftBar: "border-l-4 border-l-[#0078BC]",
    textAccent: "text-sky-800 dark:text-sky-300",
    purseText: "text-sky-700 dark:text-sky-400",
    badgeBg: "bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-500/30",
    badgeText: "text-sky-800 dark:text-sky-300",
  },
  RR: {
    border: "border-pink-500/50 hover:border-pink-500/80 dark:border-pink-500/35",
    bg: "bg-pink-500/[0.08] hover:bg-pink-500/[0.14] dark:bg-pink-500/[0.04]",
    leftBar: "border-l-4 border-l-[#EA1A85]",
    textAccent: "text-pink-800 dark:text-pink-300",
    purseText: "text-pink-700 dark:text-pink-400",
    badgeBg: "bg-pink-500/20 text-pink-800 dark:text-pink-300 border-pink-500/30",
    badgeText: "text-pink-800 dark:text-pink-300",
  },
  GT: {
    border: "border-cyan-500/50 hover:border-cyan-500/80 dark:border-cyan-500/35",
    bg: "bg-cyan-500/[0.08] hover:bg-cyan-500/[0.14] dark:bg-cyan-500/[0.04]",
    leftBar: "border-l-4 border-l-[#00D4FF]",
    textAccent: "text-cyan-800 dark:text-cyan-300",
    purseText: "text-cyan-700 dark:text-cyan-400",
    badgeBg: "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/30",
    badgeText: "text-cyan-800 dark:text-cyan-300",
  },
  LSG: {
    border: "border-blue-400/50 hover:border-blue-400/80 dark:border-blue-400/35",
    bg: "bg-blue-400/[0.08] hover:bg-blue-400/[0.14] dark:bg-blue-400/[0.04]",
    leftBar: "border-l-4 border-l-[#0050DB]",
    textAccent: "text-blue-800 dark:text-blue-300",
    purseText: "text-blue-700 dark:text-blue-400",
    badgeBg: "bg-blue-400/20 text-blue-800 dark:text-blue-300 border-blue-400/30",
    badgeText: "text-blue-800 dark:text-blue-300",
  },
  PBKS: {
    border: "border-rose-500/50 hover:border-rose-500/80 dark:border-rose-500/35",
    bg: "bg-rose-500/[0.08] hover:bg-rose-500/[0.14] dark:bg-rose-500/[0.04]",
    leftBar: "border-l-4 border-l-[#DD1F2D]",
    textAccent: "text-rose-800 dark:text-rose-300",
    purseText: "text-rose-700 dark:text-rose-400",
    badgeBg: "bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/30",
    badgeText: "text-rose-800 dark:text-rose-300",
  },
};

const DEFAULT_FRANCHISE_THEME = {
  border: "border-slate-200 dark:border-border/70 hover:border-slate-300 dark:hover:border-border",
  bg: "bg-card hover:bg-slate-50 dark:hover:bg-muted/10",
  leftBar: "border-l-4 border-l-slate-400",
  textAccent: "text-foreground",
  purseText: "text-emerald-700 dark:text-emerald-400",
  badgeBg: "bg-slate-100 dark:bg-secondary text-slate-700 dark:text-foreground border-slate-200 dark:border-border",
  badgeText: "text-foreground",
};

export const TeamAccordions: React.FC<TeamAccordionsProps> = ({
  onClaimTeam,
  onTakeOverTeam,
  onReassignToBot,
  onBanUser,
  isCreator,
  currentUserId,
  className,
}) => {
  const { snapshot, myFranchise, setMyFranchise } = useAuctionStore();
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({
    CSK: true, // Expand CSK by default
  });

  const toggleExpand = (code: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const teamsList = snapshot?.teams ? Object.values(snapshot.teams) : [];
  const currentLeaderCode = snapshot?.currentLot?.highestBidderFranchise;

  const handleClaim = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    if (myFranchise) return;
    onClaimTeam(code);
    setMyFranchise(code);
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden min-h-0 bg-slate-50/50 dark:bg-background/40 border-r border-slate-200 dark:border-border/80", className)}>
      {/* Top Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-border/80 bg-white dark:bg-card flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Franchises ({teamsList.length})
          </h2>
        </div>

        <span className="text-[10px] text-muted-foreground font-medium inline-flex items-center gap-1">
          Squad: {teamsList[0]?.minSquad || 18}–{teamsList[0]?.maxSquad || 25} • Max {teamsList[0]?.maxOverseas || 8} <Plane className="w-2.5 h-2.5 inline text-amber-600 dark:text-amber-400" />
        </span>
      </div>

      {/* Accordions List (Independent Internal Scrolling) */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-2">
        {teamsList.map((team) => {
          const isMyFranchise = myFranchise === team.code;
          const isLeading = currentLeaderCode === team.code;
          const isExpanded = Boolean(expandedTeams[team.code]);

          const fTheme = FRANCHISE_ACCORDION_THEMES[team.code] || DEFAULT_FRANCHISE_THEME;

          // Group purchased players by role
          const batters = team.purchasedPlayers.filter((p) => p.role === "BATTER");
          const keepers = team.purchasedPlayers.filter((p) => p.role === "WICKETKEEPER");
          const allRounders = team.purchasedPlayers.filter((p) => p.role === "ALL_ROUNDER");
          const bowlers = team.purchasedPlayers.filter((p) => p.role === "BOWLER");

          return (
            <div
              key={team.code}
              className={cn(
                "rounded-xl border bg-white dark:bg-card transition-all duration-150 overflow-hidden shadow-2xs hover:border-slate-300 dark:hover:border-border",
                fTheme.leftBar,
                isMyFranchise
                  ? "ring-2 ring-blue-500/50 border-blue-500/40 bg-blue-500/[0.02] dark:bg-blue-500/[0.04]"
                  : isLeading
                  ? "ring-2 ring-amber-500/50 border-amber-500/40 bg-amber-500/[0.03] dark:bg-amber-500/[0.04] animate-pulse-subtle"
                  : "border-slate-200/90 dark:border-border/70"
              )}
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleExpand(team.code)}
                className="p-2.5 cursor-pointer flex flex-col gap-1.5 select-none hover:bg-slate-50/80 dark:hover:bg-secondary/30 transition-colors"
              >
                {/* Row 1: Logo, Short Name, Badges, Remaining Purse & Chevron */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamIdentity code={team.code} size="sm" />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("text-xs font-black tracking-tight truncate", fTheme.textAccent)}>
                        {team.shortName}
                      </span>
                      {isMyFranchise && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-blue-600 text-white shadow-2xs shrink-0">
                          YOU
                        </span>
                      )}
                      {isLeading && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                          <Flame className="w-2.5 h-2.5 text-amber-500" />
                          <span>BIDDING</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className={cn("text-xs font-mono font-black text-right", fTheme.purseText)}>
                      {formatRupees(team.remainingPurse)}
                    </div>
                    <div className="text-slate-400 dark:text-muted-foreground p-0.5">
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Metadata Pills (Squad, Overseas, RTM, Controller) & Actions */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-0.5 font-medium">
                      {team.controller === "HUMAN" ? (
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-semibold">
                          <User className="w-2.5 h-2.5" /> Human
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-0.5">
                          <Bot className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{team.squadCount}/{team.maxSquad}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5 font-mono">
                      <Plane className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      <span>{team.overseasCount}/{team.maxOverseas}</span>
                    </span>
                    {snapshot?.enableRetentions && team.rtmCardsRemaining !== undefined && team.rtmCardsRemaining > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                          RTM: {team.rtmCardsRemaining}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Team Overall Rating Badge */}
                    <TeamAverageRating
                      rating={team.averageRating}
                      playerCount={team.squadCount}
                      playersRating={team.playersRating}
                      squadBalanceRating={team.squadBalanceRating}
                      purseBalanceRating={team.purseBalanceRating}
                    />

                    {/* Take over button (clean & non-intrusive) */}
                    {!myFranchise && team.controller === "AI" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTakeOverTeam) {
                            onTakeOverTeam(team.code);
                          } else {
                            handleClaim(e, team.code);
                          }
                        }}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer flex items-center gap-0.5 shadow-2xs"
                        title="Take over control of this team from AI"
                      >
                        <Zap className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Claim</span>
                      </button>
                    )}

                    {/* Host action controls */}
                    {isCreator && team.controller === "HUMAN" && team.code !== myFranchise && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Reassign ${team.name} back to AI Bot?`)) {
                              onReassignToBot?.(team.code);
                            }
                          }}
                          className="p-1 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                          title="Reassign team to AI bot"
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Ban ${team.humanDisplayName || "user"} from this room?`)) {
                              onBanUser?.(team.humanUserId!, team.code);
                            }
                          }}
                          className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Ban user"
                        >
                          <UserX className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Accordion Expanded Content (Purchased Squad) */}
              {isExpanded && (
                <div className="border-t border-slate-200/90 dark:border-border/60 bg-white/70 dark:bg-muted/20 p-2 text-xs space-y-2">
                  {team.purchasedPlayers.length === 0 ? (
                    <div className="text-[11px] text-slate-500 dark:text-muted-foreground italic text-center py-2">
                      No players acquired yet.
                    </div>
                  ) : (
                    <>
                      {/* Batters */}
                      {batters.length > 0 && (
                        <SquadGroup
                          title="Batters"
                          players={batters}
                        />
                      )}
                      {/* Wicketkeepers */}
                      {keepers.length > 0 && (
                        <SquadGroup
                          title="Wicketkeepers"
                          players={keepers}
                        />
                      )}
                      {/* All-rounders */}
                      {allRounders.length > 0 && (
                        <SquadGroup
                          title="All-rounders"
                          players={allRounders}
                        />
                      )}
                      {/* Bowlers */}
                      {bowlers.length > 0 && (
                        <SquadGroup
                          title="Bowlers"
                          players={bowlers}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function SquadGroup({
  title,
  players,
}: {
  title: string;
  players: PurchasedPlayerRecord[];
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-1">
        {title} ({players.length})
      </div>
      <div className="space-y-1">
        {players.map((p) => {
          return (
            <div
              key={p.id}
              className="flex items-center justify-between py-1 px-2 rounded-lg border text-[11px] transition-colors bg-white/90 dark:bg-card/60 border-slate-200/80 dark:border-border/40 text-slate-900 dark:text-foreground"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold truncate">{p.name}</span>
                {p.rating && (
                  <span className="text-[9px] font-mono font-bold px-1 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0" title={`Stats Rating: ${p.rating}`}>
                    {p.rating}★
                  </span>
                )}
                {p.isOverseas && (
                  <span className="p-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 inline-flex items-center" title="Overseas Player">
                    <Plane className="w-2.5 h-2.5 fill-current" />
                  </span>
                )}
                {p.isRetained && (
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[8px] font-black bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 shrink-0"
                    title="Retained Player"
                  >
                    R
                  </span>
                )}
                {p.isRtmMatch && (
                  <span className="text-[8px] font-bold px-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    RTM
                  </span>
                )}
              </div>

              <span className="font-mono font-bold text-slate-700 dark:text-muted-foreground ml-2 shrink-0">
                {formatRupees(p.purchasePrice)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
