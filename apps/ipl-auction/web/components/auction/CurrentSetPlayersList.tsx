"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { fetchApi } from "../../lib/api";
import { formatRupees, cn } from "../../lib/utils";
import { CountryFlag } from "../common/CountryFlag";
import { AuctionLot, PlayerRole } from "../../lib/types";
import { Layers, Flame, CheckCircle2, XCircle, Plane, Sparkles } from "lucide-react";

interface CurrentSetPlayersListProps {
  roomId: string;
  className?: string;
}

const getShortRole = (role?: string) => {
  if (!role) return "BAT";
  const upper = role.toUpperCase();
  if (
    upper.includes("ALL-ROUNDER") ||
    upper.includes("ALL ROUNDER") ||
    upper.includes("ALL_ROUNDER") ||
    upper === "AR"
  ) {
    return "AR";
  }
  if (upper.includes("WICKET") || upper.includes("KEEPER") || upper === "WK") {
    return "WK";
  }
  if (upper.includes("BOWLER") || upper === "BOWL") {
    return "BOWL";
  }
  if (upper.includes("BATSMAN") || upper.includes("BATTER") || upper === "BAT") {
    return "BAT";
  }
  return role.replace(/_/g, " ").slice(0, 4).toUpperCase();
};

export const CurrentSetPlayersList: React.FC<CurrentSetPlayersListProps> = ({
  roomId,
  className,
}) => {
  const { snapshot } = useAuctionStore();
  const currentLot = snapshot?.currentLot;
  const [allLots, setAllLots] = useState<AuctionLot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  // Load lots from room
  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;

    const loadLots = async () => {
      try {
        const res = await fetchApi<{ lots: AuctionLot[] }>(`/api/rooms/${roomId}/lots`);
        if (!isCancelled && res?.lots && Array.isArray(res.lots)) {
          setAllLots(res.lots);
        }
      } catch (err) {
        console.error("Failed to load room lots:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadLots();
    return () => {
      isCancelled = true;
    };
  }, [roomId, currentLot?.lotNumber, currentLot?.status]);

  // Identify active set
  const currentSetCode = currentLot?.setCode || allLots[0]?.setCode || "BA1";
  const currentSetName = currentLot?.setName || allLots[0]?.setName || "Capped Batters (BA1)";

  // Filter players for this set and merge with live snapshot state
  const setPlayers = useMemo(() => {
    // Deduplicate by playerId first
    const seenPlayerIds = new Set<string>();
    const dedupLots: AuctionLot[] = [];
    for (const lot of allLots) {
      const key = lot.playerId || lot.id || String(lot.lotNumber);
      if (!seenPlayerIds.has(key)) {
        seenPlayerIds.add(key);
        dedupLots.push(lot);
      }
    }

    const list = dedupLots.filter(
      (l) => (l.setCode && l.setCode === currentSetCode) || (l.setId && currentLot?.setId && l.setId === currentLot.setId)
    );

    // Merge live currentLot strictly by ID or PlayerID
    return list.map((lot) => {
      const isCurrent =
        currentLot &&
        (lot.id === currentLot.id ||
          (currentLot.playerId && lot.playerId === currentLot.playerId) ||
          (lot.lotNumber === currentLot.lotNumber && lot.playerName === currentLot.playerName));

      if (isCurrent) {
        return {
          ...lot,
          status: currentLot.status,
          currentBid: currentLot.currentBid,
          highestBidderFranchise: currentLot.highestBidderFranchise,
          soldToFranchise: currentLot.soldToFranchise,
          finalPrice: currentLot.finalPrice,
        };
      }
      return lot;
    });
  }, [allLots, currentSetCode, currentLot]);

  // Auto-scroll active player into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentLot?.id, currentLot?.lotNumber]);

  const soldCount = setPlayers.filter((p) => p.status === "SOLD").length;
  const unsoldCount = setPlayers.filter((p) => p.status === "UNSOLD").length;

  return (
    <div className={cn("flex flex-col h-full overflow-hidden min-h-0 select-none bg-[#090d20]/90", className)}>
      {/* Set Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-950/80 bg-secondary/20 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-bold text-xs text-white truncate" title={currentSetName}>
            {currentSetName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#141b3d] text-slate-300 border border-indigo-800/60">
            {soldCount}/{setPlayers.length} Sold
          </span>
        </div>
      </div>

      {/* Players List in Current Set */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5 scrollbar-thin">
        {setPlayers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground text-xs italic">
            {isLoading ? "Loading set players..." : "No players in this set."}
          </div>
        ) : (
          setPlayers.map((player) => {
            const isLive =
              currentLot &&
              (player.id === currentLot.id ||
                (currentLot.playerId && player.playerId === currentLot.playerId) ||
                (player.lotNumber === currentLot.lotNumber && player.playerName === currentLot.playerName)) &&
              currentLot.status === "ACTIVE";
            const isSold = player.status === "SOLD";
            const isUnsold = player.status === "UNSOLD";

            return (
              <div
                key={player.id || player.playerId || String(player.lotNumber)}
                ref={isLive ? activeItemRef : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all",
                  isLive
                    ? "bg-gradient-to-r from-orange-500/15 via-[#161c3d] to-[#0f142c] border-orange-500/60 shadow-md shadow-orange-500/10 ring-1 ring-orange-500/30"
                    : isSold
                    ? "bg-[#0b1024]/60 border-indigo-950/60 opacity-85"
                    : isUnsold
                    ? "bg-[#0b1024]/40 border-rose-950/40 opacity-70"
                    : "bg-[#0e142c]/70 hover:bg-[#141b3d] border-indigo-950/70"
                )}
              >
                {/* Left: Lot # + Flag + Plane + Player Name + Role */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-bold text-slate-400 w-5 shrink-0">
                    #{player.lotNumber}
                  </span>

                  <div className="shrink-0 flex items-center">
                    <CountryFlag country={player.country} size="xs" showLabel={false} />
                  </div>

                  {player.isOverseas && (
                    <span title="Overseas Player" className="inline-flex items-center shrink-0">
                      <Plane className="w-2.5 h-2.5 text-amber-400 fill-amber-400/40" />
                    </span>
                  )}

                  <span
                    className={cn(
                      "font-bold text-[11px] truncate",
                      isLive ? "text-orange-300 font-black" : "text-slate-200"
                    )}
                  >
                    {player.playerName}
                  </span>

                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-[#182042] text-slate-300 border border-indigo-800/60 shrink-0">
                    {getShortRole(player.role)}
                  </span>
                </div>

                {/* Right: Status Pill / Amount */}
                <div className="shrink-0 font-mono text-[11px]">
                  {isLive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-xs animate-pulse">
                      <Flame className="w-2.5 h-2.5 fill-orange-400" />
                      <span>LIVE</span>
                    </span>
                  ) : isSold ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-500/40 shadow-xs">
                      {player.soldToFranchise && (
                        <img
                          src={`/jerseys/${player.soldToFranchise.toLowerCase()}_logo.png`}
                          alt={player.soldToFranchise}
                          className="w-3.5 h-3.5 object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      )}
                      <span>{player.soldToFranchise}</span>
                      <span className="text-emerald-300 ml-0.5">
                        {formatRupees(player.finalPrice || player.basePrice)}
                      </span>
                    </span>
                  ) : isUnsold ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-950/60 text-rose-400 border border-rose-500/30">
                      <XCircle className="w-2.5 h-2.5" />
                      <span>UNSOLD</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      {formatRupees(player.basePrice)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
