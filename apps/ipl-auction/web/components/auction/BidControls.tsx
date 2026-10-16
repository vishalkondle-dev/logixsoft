"use client";

import React, { useState } from "react";
import { formatRupees, cn } from "../../lib/utils";
import { Gavel, TrendingUp, AlertCircle, ShieldAlert, Wallet, CheckCircle, Clock } from "lucide-react";
import { FranchiseState, AuctionLot } from "../../lib/types";
import { evaluateRosterBalance } from "../../lib/rosterBalance";

interface BidControlsProps {
  currentBid: number;
  nextLegalBid: number;
  bidIncrement: number;
  highestBidderCode: string | null;
  myFranchise: FranchiseState | null;
  currentLot?: AuctionLot | null;
  ruleset?: "MEGA" | "CLASSIC" | "SPRINT_XI";
  timerSeconds?: number | null;
  timerPercentage?: number;
  isUrgent?: boolean;
  isPaused?: boolean;
  isRtmActive?: boolean;
  onPlaceBid: (amount: number) => void;
  onSelectTeamRequest?: () => void;
  isLive: boolean;
  className?: string;
}

export const BidControls: React.FC<BidControlsProps> = ({
  currentBid,
  nextLegalBid,
  bidIncrement,
  highestBidderCode,
  myFranchise,
  currentLot,
  ruleset = "MEGA",
  timerSeconds,
  timerPercentage = 100,
  isUrgent = false,
  isPaused = false,
  isRtmActive = false,
  onPlaceBid,
  onSelectTeamRequest,
  isLive,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation checks
  const isHighestBidder = myFranchise && highestBidderCode === myFranchise.code;
  const hasSufficientPurse = myFranchise ? myFranchise.remainingPurse >= nextLegalBid : false;

  // Reserve check: Can the team still fill minimum squad?
  const spotsRemaining = myFranchise ? Math.max(0, myFranchise.minSquad - myFranchise.squadCount - 1) : 0;
  const reserveNeeded = spotsRemaining * 3000000;
  const canAffordWithReserve = myFranchise
    ? myFranchise.remainingPurse - nextLegalBid >= reserveNeeded
    : false;

  const isSquadFull = myFranchise ? myFranchise.squadCount >= myFranchise.maxSquad : false;

  // Roster Balance & Role Quotas check (Lookahead reservation)
  const rosterCheck = myFranchise && currentLot
    ? evaluateRosterBalance(myFranchise, currentLot, ruleset)
    : { allowed: true, reason: undefined };

  const isRosterRestricted = !rosterCheck.allowed;

  const canBid =
    isLive &&
    !isRtmActive &&
    myFranchise &&
    !isHighestBidder &&
    hasSufficientPurse &&
    canAffordWithReserve &&
    !isSquadFull &&
    !isRosterRestricted;

  const handleClickBid = () => {
    if (!myFranchise) {
      onSelectTeamRequest?.();
      return;
    }
    if (!canBid || isSubmitting) return;
    setIsSubmitting(true);
    onPlaceBid(nextLegalBid);
    setTimeout(() => setIsSubmitting(false), 400);
  };

  return (
    <div
      className={cn(
        "relative w-full bg-[#0b1022] border border-indigo-950/80 rounded-2xl p-3 sm:p-3.5 shadow-xl flex flex-col gap-3 overflow-hidden select-none",
        className
      )}
    >
      {/* Top Countdown Progress Bar (Line reducing) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-950/80 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-75 ease-linear",
            isRtmActive
              ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.9)]"
              : isPaused
              ? "bg-amber-400"
              : isUrgent
              ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"
              : (timerPercentage ?? 100) > 50
              ? "bg-gradient-to-r from-blue-500 to-indigo-500"
              : "bg-gradient-to-r from-amber-500 to-orange-500"
          )}
          style={{ width: `${isPaused ? 50 : (timerPercentage ?? 100)}%` }}
        />
      </div>

      {/* Top-left subtle orange rim light */}
      <div className="absolute top-0 left-0 w-24 h-[2px] bg-gradient-to-r from-orange-500 via-amber-400 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-28 h-28 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Row: 3 Items with Space Between (Time Left, Next Increment, Your Purse) */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 z-10 pt-0.5">
        {/* Item 1: Time Left */}
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
          <Clock
            className={cn(
              "w-5 h-5 sm:w-6 sm:h-6 shrink-0 stroke-[2.2]",
              isRtmActive
                ? "text-purple-400 animate-pulse"
                : isUrgent
                ? "text-red-400 animate-pulse"
                : "text-indigo-400"
            )}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight truncate">
              {isRtmActive ? "RTM Decision" : "Time Left"}
            </span>
            <span
              className={cn(
                "text-sm sm:text-base md:text-lg font-black font-mono leading-tight mt-0.5 truncate",
                isRtmActive
                  ? "text-purple-300 font-extrabold"
                  : isPaused
                  ? "text-amber-400"
                  : isUrgent
                  ? "text-red-400 animate-pulse font-extrabold"
                  : "text-white"
              )}
            >
              {isRtmActive ? `${timerSeconds ?? 0}s` : isPaused ? "PAUSED" : `${timerSeconds ?? 0}s`}
            </span>
          </div>
        </div>

        {/* Divider 1 */}
        <div className="h-8 sm:h-9 w-[1px] bg-indigo-950/90 shrink-0" />

        {/* Item 2: Next Increment */}
        <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 shrink-0 stroke-[2.2]" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight truncate">
              Next Increment
            </span>
            <span className="text-sm sm:text-base md:text-lg font-black text-white font-mono leading-tight mt-0.5 truncate">
              +{formatRupees(bidIncrement)}
            </span>
          </div>
        </div>

        {/* Divider 2 */}
        <div className="h-8 sm:h-9 w-[1px] bg-indigo-950/90 shrink-0" />

        {/* Item 3: Your Purse */}
        <div className="flex items-center gap-2 flex-1 min-w-0 pl-1">
          <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 shrink-0 stroke-[2.2]" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight truncate">
              Your Purse
            </span>
            <span
              className={cn(
                "text-sm sm:text-base md:text-lg font-black font-mono leading-tight mt-0.5 truncate",
                myFranchise
                  ? myFranchise.remainingPurse < nextLegalBid
                    ? "text-red-400"
                    : "text-emerald-400"
                  : "text-slate-400"
              )}
            >
              {myFranchise ? formatRupees(myFranchise.remainingPurse) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Action Button or Disabled State Button with Inline Message */}
      {isRtmActive ? (
        <button
          disabled
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-purple-950/40 text-purple-300 border border-purple-500/50 flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
        >
          <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="truncate">Right to Match (RTM) In Progress — Bidding Locked</span>
        </button>
      ) : !myFranchise ? (
        <button
          onClick={handleClickBid}
          className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wide uppercase transition-all duration-150 flex items-center justify-center gap-2 shadow-lg select-none bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white border border-amber-400/40 cursor-pointer shadow-amber-600/30 ring-2 ring-amber-500/20 active:scale-[0.98]"
        >
          <Gavel className="w-4 h-4 shrink-0" />
          <span>Select Team to Bid ({formatRupees(nextLegalBid)})</span>
        </button>
      ) : isHighestBidder ? (
        <button
          disabled
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 flex items-center justify-center gap-2 shadow-inner cursor-default"
        >
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>You Hold the Highest Bid</span>
        </button>
      ) : isRosterRestricted ? (
        <button
          disabled
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#1f130b] text-amber-400 border border-amber-600/50 flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
        >
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">{rosterCheck.reason || "Maximum role quota reached"}</span>
        </button>
      ) : !canAffordWithReserve ? (
        <button
          disabled
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#1f130b] text-amber-400 border border-amber-600/50 flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
        >
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">Must reserve {formatRupees(reserveNeeded)} for squad</span>
        </button>
      ) : isSquadFull ? (
        <button
          disabled
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#240e14] text-rose-400 border border-rose-600/50 flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="truncate">Max Squad Limit Reached ({myFranchise.maxSquad} max)</span>
        </button>
      ) : !hasSufficientPurse ? (
        <button
          disabled
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#240e14] text-rose-400 border border-rose-600/50 flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="truncate">Insufficient Purse Balance</span>
        </button>
      ) : !isLive ? (
        <button
          disabled
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-white/5 text-slate-400 border border-white/10 flex items-center justify-center gap-2 cursor-not-allowed shadow-inner"
        >
          <Gavel className="w-4 h-4 shrink-0" />
          <span className="truncate">{nextLegalBid > 0 ? `Next Lot Opens At ${formatRupees(nextLegalBid)}` : "Lot Transition In Progress"}</span>
        </button>
      ) : (
        <button
          onClick={handleClickBid}
          disabled={!canBid || isSubmitting}
          className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wide uppercase transition-all duration-150 flex items-center justify-center gap-2 shadow-lg select-none bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30 cursor-pointer shadow-blue-600/30 ring-2 ring-blue-500/20 active:scale-[0.98]"
        >
          <Gavel className="w-5 h-5 shrink-0" />
          <span>Bid {formatRupees(nextLegalBid)} ({myFranchise.code})</span>
        </button>
      )}
    </div>
  );
};
