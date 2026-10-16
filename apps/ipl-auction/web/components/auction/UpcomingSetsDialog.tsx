"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatRupees, cn } from "../../lib/utils";
import { fetchApi } from "../../lib/api";
import { PlayerIdentity } from "./PlayerIdentity";
import { CountryFlag } from "../common/CountryFlag";
import { PlayerRole } from "../../lib/types";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Plane,
  CheckCircle2,
  Flame,
} from "lucide-react";

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
  globalNumber: number; // 1, 2, ...
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
        // Fetch sets metadata
        const setsRes = await fetchApi<{ sets: SetItem[] }>("/api/players/sets");
        const loadedSets = (setsRes.sets || []).sort((a, b) => a.displayOrder - b.displayOrder);
        setSets(loadedSets);

        let playersList: PlayerItem[] = [];

        // If roomId is available, attempt to fetch authoritative lots from room
        if (roomId) {
          try {
            const roomLotsRes = await fetchApi<{ lots: any[] }>(`/api/rooms/${roomId}/lots`);
            if (roomLotsRes.lots && roomLotsRes.lots.length > 0) {
              playersList = roomLotsRes.lots.map((lot) => ({
                globalNumber: lot.lotNumber,
                id: lot.playerId || lot.id,
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
          } catch (e) {
            console.warn("Failed to load room lots, falling back to players API", e);
          }
        }

        // Fallback: fetch all players from /api/players if room lots not loaded
        if (playersList.length === 0) {
          const playersRes = await fetchApi<{ players: any[] }>("/api/players");
          const rawPlayers = playersRes.players || [];

          // Group by set in set order to assign unique incremental numbers 001, 002, ...
          let counter = 1;
          for (const s of loadedSets) {
            const inSet = rawPlayers.filter((p) => p.setId === s.id);
            for (const p of inSet) {
              playersList.push({
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
                setCode: s.setCode,
                status: "PENDING",
              });
            }
          }
        }

        setAllPlayers(playersList);

        // Expand active set by default
        const initialOpen: Record<string, boolean> = {};
        const activeSet = loadedSets.find((s) => s.setCode === currentSetCode) || loadedSets[0];
        if (activeSet) {
          initialOpen[activeSet.id] = true;
        }
        setOpenSets(initialOpen);
      } catch (err) {
        console.error("Failed to load upcoming sets and players:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, currentSetCode, roomId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // When search or filter changes, automatically expand sets that contain matches
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

  // Group filtered players by set
  const setGroups = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return sets.map((s) => {
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
    }).filter((s) => ((searchQuery || roleFilter !== "ALL") ? s.players.length > 0 : s.totalInSet > 0));
  }, [sets, allPlayers, searchQuery, roleFilter, currentSetCode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl h-[88vh] max-h-[800px] bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/80 bg-secondary/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Upcoming Auction Sets & Players</h2>
              <p className="text-[11px] text-muted-foreground">
                Sets proceed in sequential order • Players within sets are dynamically nominated
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Search, Role Filter, Expand/Collapse */}
        <div className="px-5 py-3 border-b border-border/60 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search player name, nationality..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-secondary/50 border border-border/80 focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-secondary/50 border border-border/80 text-foreground cursor-pointer focus:outline-hidden"
            >
              <option value="ALL">All Roles</option>
              <option value="BATTER">Batters</option>
              <option value="BOWLER">Bowlers</option>
              <option value="ALL_ROUNDER">All-rounders</option>
              <option value="WICKETKEEPER">Wicketkeepers</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-center">
            <button
              onClick={expandAll}
              className="text-[11px] font-semibold px-2 py-1 rounded bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold px-2 py-1 rounded bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Sets Accordions Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              Loading auction sets and dynamic catalog...
            </div>
          ) : (
            setGroups.map((s) => {
              const isOpen = !!openSets[s.id];
              const playerCount = s.players.length;

              return (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-xl border transition-all overflow-hidden",
                    s.isCurrent
                      ? "border-amber-500/50 bg-amber-500/5 shadow-xs"
                      : "border-border/70 bg-card/60"
                  )}
                >
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleSet(s.id)}
                    className={cn(
                      "w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer",
                      isOpen ? "bg-muted/30 border-b border-border/60" : "hover:bg-secondary/40"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="font-mono text-xs px-2 py-0.5 rounded font-black bg-secondary border border-border text-foreground">
                        {s.setCode}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                        {s.setName}
                      </span>

                      {s.isCurrent && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                          <Flame className="w-2.5 h-2.5 animate-pulse" />
                          LIVE NOW
                        </span>
                      )}

                      {s.isCompleted && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          COMPLETED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {playerCount} {playerCount === 1 ? "player" : "players"}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Accordion Body (Players List) */}
                  {isOpen && (
                    <div className="p-2 space-y-1.5 bg-muted/10">
                      {s.players.length === 0 ? (
                        <div className="py-4 text-center text-xs text-muted-foreground italic">
                          No players match the filter in this set.
                        </div>
                      ) : (
                        s.players.map((p) => {
                          const formattedNum = String(p.globalNumber).padStart(3, "0");

                          return (
                            <div
                              key={p.id}
                              className={cn(
                                "flex items-center justify-between p-2 sm:p-2.5 rounded-lg border transition-colors",
                                p.status === "ACTIVE"
                                  ? "bg-amber-500/10 border-amber-500/40 shadow-xs"
                                  : p.status === "SOLD"
                                  ? "bg-emerald-500/5 border-emerald-500/20"
                                  : "bg-card/70 border-border/50 hover:bg-secondary/40"
                              )}
                            >
                              {/* Left: Global Number + Avatar + Identity */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-xs font-bold text-muted-foreground w-8 shrink-0">
                                  #{formattedNum}
                                </span>

                                <PlayerIdentity
                                  name={p.name}
                                  role={p.role}
                                  country={p.country}
                                  isOverseas={p.isOverseas}
                                  size="sm"
                                />

                                <div className="truncate">
                                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
                                    <span className="truncate">{p.name}</span>
                                    {p.isOverseas && (
                                      <span
                                        className="p-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center shrink-0"
                                        title="Overseas Player"
                                      >
                                        <Plane className="w-2.5 h-2.5 fill-current" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                                    <CountryFlag country={p.country} size="xs" />
                                    <span>{p.country}</span>
                                    <span>•</span>
                                    <span className="capitalize">
                                      {p.role.replace(/_/g, " ").toLowerCase()}
                                    </span>
                                    {p.battingStyle && (
                                      <>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="hidden sm:inline text-muted-foreground/80">
                                          {p.battingStyle}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Base Price & Status Badge */}
                              <div className="flex items-center gap-2.5 flex-shrink-0 text-right">
                                <div>
                                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatRupees(p.basePrice)}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground">Base</div>
                                </div>

                                <div className="min-w-[70px]">
                                  {p.status === "ACTIVE" && (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                                      IN AUCTION
                                    </span>
                                  )}
                                  {p.status === "SOLD" && (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40">
                                      {p.soldToFranchise || "SOLD"}
                                      {p.finalPrice ? ` (${formatRupees(p.finalPrice)})` : ""}
                                    </span>
                                  )}
                                  {p.status === "UNSOLD" && (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40">
                                      UNSOLD
                                    </span>
                                  )}
                                  {(!p.status || p.status === "PENDING") && (
                                    <span className="text-[10px] text-muted-foreground font-medium">
                                      Upcoming
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
