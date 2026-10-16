"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { RoomSnapshot, FranchiseState, PurchasedPlayerRecord, PlayerRole } from "../../lib/types";
import { TeamIdentity } from "../teams/TeamIdentity";
import { CountryFlag } from "../common/CountryFlag";
import { formatRupees, cn } from "../../lib/utils";
import {
  Trophy,
  Award,
  Users,
  Plane,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  Layers,
  Sparkles,
  Gavel,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  Flame,
} from "lucide-react";

interface AuctionReviewReportProps {
  snapshot: RoomSnapshot;
  onRestart?: () => void;
}

export const AuctionReviewReport: React.FC<AuctionReviewReportProps> = ({
  snapshot,
  onRestart,
}) => {
  const [activeTab, setActiveTab] = useState<"squads" | "leaderboard" | "events">("squads");
  const [expandedFranchises, setExpandedFranchises] = useState<Record<string, boolean>>({
    // By default first 4 franchises open
    CSK: true,
    MI: true,
    RCB: true,
    KKR: true,
  });

  const toggleFranchise = (code: string) => {
    setExpandedFranchises((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const teams = useMemo(() => {
    const list = Object.values(snapshot.teams || {});
    return list.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
  }, [snapshot.teams]);

  // Aggregate stats
  const { allPurchasedPlayers, totalSpent, mostExpensivePlayer, topRatedTeam } = useMemo(() => {
    const players: (PurchasedPlayerRecord & { franchiseCode: string; franchiseName: string })[] = [];
    let spent = 0;
    let topRating = -1;
    let bestTeam: FranchiseState | null = null;

    teams.forEach((t) => {
      spent += (t.totalPurse - t.remainingPurse);
      if (t.averageRating !== null && t.averageRating > topRating) {
        topRating = t.averageRating;
        bestTeam = t;
      }
      (t.purchasedPlayers || []).forEach((p) => {
        players.push({
          ...p,
          franchiseCode: t.code,
          franchiseName: t.name,
        });
      });
    });

    players.sort((a, b) => b.purchasePrice - a.purchasePrice);
    const topBuy = players.length > 0 ? players[0] : null;

    return {
      allPurchasedPlayers: players,
      totalSpent: spent,
      mostExpensivePlayer: topBuy,
      topRatedTeam: bestTeam as FranchiseState | null,
    };
  }, [teams]);

  // Role categorizer
  const groupPlayersByRole = (players: PurchasedPlayerRecord[]) => {
    const groups: Record<PlayerRole, PurchasedPlayerRecord[]> = {
      BATTER: [],
      WICKETKEEPER: [],
      ALL_ROUNDER: [],
      BOWLER: [],
    };
    players.forEach((p) => {
      if (groups[p.role]) {
        groups[p.role].push(p);
      } else {
        groups.BATTER.push(p);
      }
    });
    return groups;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-background text-foreground select-none">
      {/* Header Banner */}
      <header className="border-b border-border/80 bg-card/60 backdrop-blur-xs px-4 py-3 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-md">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight">{snapshot.name}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                AUCTION CONCLUDED
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Official Franchise Rosters, Financial Breakdown & Squad Analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRestart && (
            <button
              onClick={onRestart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">New Auction</span>
            </button>
          )}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Arena</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Total Purse Spent */}
          <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Purse Spent</span>
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatRupees(totalSpent)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Across all 10 franchises (out of ₹1,200 Cr)
            </div>
          </div>

          {/* 2. Total Players Sold */}
          <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Players Acquired</span>
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
              {allPurchasedPlayers.length}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Total squad recruits confirmed
            </div>
          </div>

          {/* 3. Most Expensive Player */}
          <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Record Purchase</span>
              <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-sm font-black text-amber-600 dark:text-amber-400 truncate">
              {mostExpensivePlayer ? mostExpensivePlayer.name : "None"}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
              {mostExpensivePlayer ? (
                <>
                  <span className="font-bold text-foreground">{formatRupees(mostExpensivePlayer.purchasePrice)}</span>
                  <span>•</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{mostExpensivePlayer.franchiseCode}</span>
                </>
              ) : (
                "No bids completed"
              )}
            </div>
          </div>

          {/* 4. Top Rated Franchise */}
          <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Top Rated Squad</span>
              <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-sm font-black text-purple-600 dark:text-purple-400 truncate">
              {topRatedTeam ? topRatedTeam.name : "Evaluating..."}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
              {topRatedTeam?.averageRating ? (
                <>
                  <span className="font-bold text-foreground">{topRatedTeam.averageRating.toFixed(1)} Rating</span>
                  <span>•</span>
                  <span>{topRatedTeam.purchasedPlayers.length} Players</span>
                </>
              ) : (
                "Min 3 players required"
              )}
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center border-b border-border/80 bg-secondary/30 rounded-lg p-1 max-w-md">
          <button
            onClick={() => setActiveTab("squads")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer text-center",
              activeTab === "squads"
                ? "bg-card text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Franchise Squads (10)
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer text-center ml-1",
              activeTab === "leaderboard"
                ? "bg-card text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Top Buys ({allPurchasedPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer text-center ml-1",
              activeTab === "events"
                ? "bg-card text-foreground shadow-2xs border border-border/70"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Auction Timeline
          </button>
        </div>

        {/* TAB 1: SQUADS & FRANCHISES */}
        {activeTab === "squads" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {teams.map((team, idx) => {
              const isOpen = Boolean(expandedFranchises[team.code]);
              const grouped = groupPlayersByRole(team.purchasedPlayers || []);
              const spent = team.totalPurse - team.remainingPurse;

              return (
                <div
                  key={team.code}
                  className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs flex flex-col"
                >
                  {/* Franchise Header */}
                  <div
                    onClick={() => toggleFranchise(team.code)}
                    className="p-3 bg-secondary/40 hover:bg-secondary/70 border-b border-border/60 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn(
                        "w-5 h-5 rounded-md font-mono font-black text-[10px] flex items-center justify-center shrink-0",
                        idx === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        idx === 1 ? "bg-slate-400/20 text-slate-300 border border-slate-400/30" :
                        idx === 2 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                        "bg-secondary text-muted-foreground"
                      )}>
                        #{idx + 1}
                      </span>
                      <TeamIdentity code={team.code} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-foreground truncate">{team.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
                            {team.controller}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2 mt-0.5">
                          <span>{team.purchasedPlayers.length}/{team.maxSquad || 25} Squad</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Plane className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                            {team.overseasCount}/{team.maxOverseas || 8}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 text-right">
                      <div>
                        <div className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {formatRupees(team.remainingPurse)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Spent: {formatRupees(spent)}
                        </div>
                      </div>
                      {team.averageRating !== null && (
                        <div className="flex flex-col items-end">
                          <div className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-mono text-[11px] font-black">
                            {team.averageRating.toFixed(1)} ★
                          </div>
                          {team.playersRating !== undefined && team.playersRating !== null && (
                            <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
                              Players: {team.playersRating.toFixed(1)} • Bal: {team.squadBalanceRating ?? 100}% • Purse: {team.purseBalanceRating ?? 100}%
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Purchased Players Grouped */}
                  {isOpen && (
                    <div className="p-3 space-y-3 flex-1 text-xs">
                      {team.purchasedPlayers.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-xs italic">
                          No players acquired during this auction.
                        </div>
                      ) : (
                        (["BATTER", "WICKETKEEPER", "ALL_ROUNDER", "BOWLER"] as PlayerRole[]).map((role) => {
                          const playersInRole = grouped[role];
                          if (playersInRole.length === 0) return null;

                          return (
                            <div key={role} className="space-y-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between border-b border-border/40 pb-0.5">
                                <span>{role}S</span>
                                <span className="font-mono">{playersInRole.length}</span>
                              </div>

                              <div className="space-y-1 pt-1">
                                {playersInRole.map((player) => (
                                  <div
                                    key={player.id || player.lotNumber}
                                    className="flex items-center justify-between py-1 px-2 rounded-md bg-secondary/30 hover:bg-secondary/60 text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-mono text-[10px] text-muted-foreground w-6">
                                        #{String(player.lotNumber).padStart(3, "0")}
                                      </span>
                                      <span className="font-bold text-foreground truncate">{player.name}</span>
                                      {player.rating && (
                                        <span className="text-[8px] font-mono font-bold px-1 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0" title={`Stats Rating: ${player.rating}`}>
                                          {player.rating}★
                                        </span>
                                      )}

                                      {player.isOverseas && (
                                        <span title={`Overseas (${player.country})`}>
                                          <Plane className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs flex-shrink-0">
                                      {formatRupees(player.purchasePrice)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: TOP PURCHASES LEADERBOARD */}
        {activeTab === "leaderboard" && (
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="p-3 bg-secondary/30 border-b border-border/60 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                All Purchased Players (Ranked by Sale Price)
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {allPurchasedPlayers.length} total players
              </span>
            </div>

            {allPurchasedPlayers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs italic">
                No players were purchased in this auction.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {allPurchasedPlayers.map((player, idx) => (
                  <div
                    key={`${player.id}-${idx}`}
                    className="flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-secondary text-foreground font-mono font-black text-xs flex items-center justify-center flex-shrink-0">
                        #{idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground text-sm truncate">{player.name}</span>
                          {player.isOverseas && (
                            <span title={`Overseas (${player.country})`}>
                              <Plane className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-secondary text-muted-foreground uppercase">
                            {player.role}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                          <CountryFlag country={player.country} size="xs" />
                          <span>{player.country} • Lot #{player.lotNumber}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 text-right">
                      <TeamIdentity code={player.franchiseCode} size="md" />
                      <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatRupees(player.purchasePrice)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TIMELINE & EVENTS */}
        {activeTab === "events" && (
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="p-3 bg-secondary/30 border-b border-border/60 flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Authoritative Event Stream
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {snapshot.recentEvents?.length || 0} events recorded
              </span>
            </div>

            <div className="p-3 space-y-2">
              {(snapshot.recentEvents || []).map((evt) => (
                <div
                  key={evt.id || evt.sequence}
                  className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/20 border border-border/50 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{evt.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{evt.description}</p>
                    {evt.franchiseCode && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <TeamIdentity code={evt.franchiseCode} size="sm" />
                        {evt.amount && (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                            {formatRupees(evt.amount)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
