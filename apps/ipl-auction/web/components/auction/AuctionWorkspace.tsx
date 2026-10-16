"use client";

import React, { useState } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { PlayerIdentity } from "./PlayerIdentity";
import { PlayerJerseyShowcase } from "./PlayerJerseyShowcase";
import { TeamIdentity } from "../teams/TeamIdentity";
import { TimerDisplay } from "./TimerDisplay";
import { BidControls } from "./BidControls";
import { UpcomingSetsDialog } from "./UpcomingSetsDialog";
import { TeamSelectionModal } from "./TeamSelectionModal";
import { ManageRetentionsModal } from "./ManageRetentionsModal";
import { RTMDecisionPrompt } from "./RTMDecisionPrompt";
import { CountryFlag } from "../common/CountryFlag";
import { formatRupees, formatIndianNumber, calculateNextLegalBid, getBidIncrement, cn } from "../../lib/utils";
import { playHammerSound } from "../../lib/auctionSound";
import { useSyncTimer } from "../../hooks/useSyncTimer";
import {
  Layers,
  Play,
  Pause,
  RotateCcw,
  Square,
  Award,
  Globe,
  Activity,
  Flame,
  CheckCircle,
  XCircle,
  Plane,
  GraduationCap,
  Shield,
  Gavel,
  ArrowDown,
} from "lucide-react";

function playTickSound(second: number) {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // 3s: 800Hz, 2s: 1000Hz, 1s: 1250Hz (sharp, rising urgency tick)
    const freq = second === 1 ? 1250 : second === 2 ? 1000 : 800;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Fast, crisp woodblock-style tick click
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch (err) {
    // Autoplay policy or unsupported audio environment silently ignored
  }
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

const formatBattingStyle = (style?: string) => {
  if (!style) return "RHB";
  const upper = style.toUpperCase();
  if (upper.includes("RIGHT")) return "RHB";
  if (upper.includes("LEFT")) return "LHB";
  return style;
};



interface AuctionWorkspaceProps {
  onPlaceBid: (amount: number) => void;
  onStartAuction: () => void;
  onPauseAuction: (reason?: string) => void;
  onResumeAuction: () => void;
  onEndAuction: () => void;
  onClaimTeam?: (code: string) => void;
  onSetRetentions?: (franchiseCode: string, playerIds: string[]) => void;
  onDecideRtm?: (exercise: boolean) => void;
  serverOffset?: number;
  className?: string;
}

export const AuctionWorkspace: React.FC<AuctionWorkspaceProps> = ({
  onPlaceBid,
  onStartAuction,
  onPauseAuction,
  onResumeAuction,
  onEndAuction,
  onClaimTeam,
  onSetRetentions,
  onDecideRtm,
  serverOffset = 0,
  className,
}) => {
  const { snapshot, myFranchise, isUpcomingDialogOpen, setIsUpcomingDialogOpen } = useAuctionStore();
  const [isTeamSelectModalOpen, setIsTeamSelectModalOpen] = useState(false);
  const [isRetentionsModalOpen, setIsRetentionsModalOpen] = useState(false);

  const currentLot = snapshot?.currentLot || null;
  const isLive = snapshot?.status === "LIVE";
  const isPaused = snapshot?.status === "PAUSED";
  const isCompleted = snapshot?.status === "COMPLETED";
  const isLobby = snapshot?.status === "LOBBY";

  // Play hammer sound on sold
  const lastSoldLotIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (currentLot?.status === "SOLD" && currentLot.id !== lastSoldLotIdRef.current) {
      lastSoldLotIdRef.current = currentLot.id;
      playHammerSound();
    }
  }, [currentLot?.status, currentLot?.id]);

  const userFranchiseState = myFranchise && snapshot?.teams ? snapshot.teams[myFranchise] : null;

  // Authoritative dynamic legal next bid and increment calculation
  let effectiveNextBid = 0;
  let effectiveIncrement = 500000;

  if (currentLot) {
    if (currentLot.status === "ACTIVE") {
      if (currentLot.currentBid <= 0) {
        // Player lot just opened, first bid is strictly base price!
        effectiveNextBid = currentLot.basePrice;
        effectiveIncrement = getBidIncrement(currentLot.basePrice);
      } else {
        const calc = calculateNextLegalBid(currentLot.currentBid, currentLot.basePrice);
        effectiveNextBid = calc.nextBid;
        effectiveIncrement = calc.increment;
      }
    } else if (currentLot.status === "SOLD" || currentLot.status === "UNSOLD") {
      // Lot settled: amount is immediately the upcoming player's base amount!
      effectiveNextBid = snapshot?.nextLegalBid || 0;
      effectiveIncrement = snapshot?.bidIncrement || 500000;
    } else {
      effectiveNextBid = currentLot.basePrice;
      effectiveIncrement = getBidIncrement(currentLot.basePrice);
    }
  } else {
    effectiveNextBid = snapshot?.nextLegalBid || 0;
    effectiveIncrement = snapshot?.bidIncrement || 500000;
  }

  // Authoritative dynamic timer hook & tick sound for hammer countdown
  const { secondsLeft, remainingMs, percentage, isUrgent } = useSyncTimer(
    isPaused ? null : snapshot?.timerDeadline || null,
    serverOffset
  );

  const lastTickedSecondRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (isPaused || !snapshot?.timerDeadline || remainingMs <= 0) {
      lastTickedSecondRef.current = null;
      return;
    }

    if (secondsLeft >= 1 && secondsLeft <= 3) {
      if (lastTickedSecondRef.current !== secondsLeft) {
        lastTickedSecondRef.current = secondsLeft;
        playTickSound(secondsLeft);
      }
    } else {
      lastTickedSecondRef.current = null;
    }
  }, [secondsLeft, isPaused, snapshot?.timerDeadline, remainingMs]);


  // Real-time Bidding Battle history for the current lot
  const currentLotBids = React.useMemo(() => {
    if (!snapshot?.recentEvents || !currentLot) return [];
    return snapshot.recentEvents
      .filter(
        (e) =>
          (e.lotNumber === currentLot.lotNumber || !e.lotNumber) &&
          (e.amount || e.type.includes("BID")) &&
          e.franchiseCode
      )
      .slice(-4)
      .reverse();
  }, [snapshot?.recentEvents, currentLot?.lotNumber]);

  const previousTeam =
    currentLot?.previousFranchise && currentLot.previousFranchise !== "None"
      ? snapshot?.teams?.[currentLot.previousFranchise]
      : null;

  const hasRtm = Boolean(
    currentLot?.previousFranchise &&
      currentLot.previousFranchise !== "None" &&
      snapshot?.enableRetentions !== false &&
      snapshot?.ruleset !== "SPRINT_XI" &&
      (!previousTeam || previousTeam.rtmCardsRemaining > 0)
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-hidden min-h-0 bg-[#070b1a] relative px-2 sm:px-4 py-2 sm:py-3 gap-2.5 sm:gap-3 justify-between select-none",
        className
      )}
    >
      {/* Sub-Header Bar: LOT Pill, Set Name, and 3 Action Triggers */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0 w-full select-none">
        {/* Left: LOT Pill */}
        <div className="bg-[#101633] border border-indigo-900/60 rounded-xl px-3 py-1 flex flex-col items-center justify-center min-w-[56px] shadow-sm">
          <span className="text-[9px] tracking-wider uppercase text-slate-400 font-bold leading-tight">
            {isLobby ? "STATUS" : "LOT"}
          </span>
          <span className="text-sm font-black text-white leading-tight font-mono">
            {isLobby ? "LOBBY" : `#${currentLot?.lotNumber || 1}`}
          </span>
        </div>

        {/* Center: Set Name Pill */}
        <div className="bg-[#101633] border border-indigo-900/60 rounded-xl px-3 sm:px-4 py-2 flex items-center justify-center flex-1 shadow-sm truncate">
          <span className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate">
            {isLobby ? "Pre-Auction Arena" : (currentLot ? currentLot.setName : "IPL 2026 Live Auction")}
          </span>
        </div>

        {/* Right: Action Buttons (Layers / Pause / End) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsUpcomingDialogOpen(true)}
            className="w-9 h-9 rounded-xl bg-[#141b3d] border border-indigo-800/60 hover:bg-indigo-900/50 flex items-center justify-center text-indigo-400 transition-colors shadow-sm cursor-pointer"
            title="Upcoming Players"
            aria-label="Upcoming Players"
          >
            <Layers className="w-4 h-4" />
          </button>

          {isLive && (
            <button
              onClick={() => onPauseAuction("MANUAL_HOST_PAUSE")}
              className="w-9 h-9 rounded-xl bg-[#231a10] border border-amber-600/50 hover:bg-amber-900/50 flex items-center justify-center text-amber-400 transition-colors shadow-sm cursor-pointer"
              title="Pause Auction"
              aria-label="Pause Auction"
            >
              <Pause className="w-4 h-4 fill-current" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResumeAuction}
              className="w-9 h-9 rounded-xl bg-[#0f241a] border border-emerald-600/50 hover:bg-emerald-900/50 flex items-center justify-center text-emerald-400 transition-colors shadow-sm cursor-pointer"
              title="Resume Auction"
              aria-label="Resume Auction"
            >
              <Play className="w-4 h-4 fill-current" />
            </button>
          )}

          {(isLive || isPaused) && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to end the auction now? This will conclude the event and display the final Review & Report.")) {
                  onEndAuction();
                }
              }}
              className="w-9 h-9 rounded-xl bg-[#29121c] border border-rose-600/50 hover:bg-rose-900/50 flex items-center justify-center text-rose-400 transition-colors shadow-sm cursor-pointer"
              title="End Auction"
              aria-label="End Auction"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* Right to Match (RTM) Banner / Prompt */}
      {snapshot?.rtmState && snapshot.rtmState.active && (
        <RTMDecisionPrompt
          rtmState={snapshot.rtmState}
          myFranchise={myFranchise}
          myFranchiseState={userFranchiseState || undefined}
          onDecideRtm={(exercise) => onDecideRtm?.(exercise)}
        />
      )}

      {/* Main Player Display Cards (Only shown during active/paused auction) */}
      {!isLobby && currentLot && (isLive || isPaused) ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative gap-2.5 sm:gap-3 justify-start scrollbar-thin">
          {/* Status Overlay: SOLD / UNSOLD Announcement */}
          {currentLot.status === "SOLD" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-2xs rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-2 text-center p-5 bg-[#0d1329] border-2 border-emerald-500/80 rounded-2xl shadow-2xl max-w-sm">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div className="text-xl font-black text-emerald-400 tracking-tight uppercase">
                  SOLD TO {currentLot.soldToFranchise}!
                </div>
                <div className="text-sm font-semibold text-white">
                  {currentLot.playerName} fetched {formatRupees(currentLot.finalPrice || currentLot.currentBid)}
                </div>
              </div>
            </div>
          )}

          {currentLot.status === "UNSOLD" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-2xs rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-2 text-center p-5 bg-[#0d1329] border-2 border-slate-600 rounded-2xl shadow-2xl max-w-sm">
                <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-400 mb-1">
                  <XCircle className="w-8 h-8" />
                </div>
                <div className="text-xl font-black text-slate-300 tracking-tight uppercase">
                  UNSOLD
                </div>
                <div className="text-xs text-slate-400">
                  {currentLot.playerName} received no bids at base price {formatRupees(currentLot.basePrice)}.
                </div>
              </div>
            </div>
          )}

          {/* CARD 1: Main Player Stage Card - Clean, compact, and free of duplicate tags */}
          <div className="relative rounded-2xl sm:rounded-3xl bg-[#0b1024] border border-indigo-950/80 p-3 sm:p-5 md:p-6 shadow-xl overflow-hidden flex flex-row items-stretch gap-3 sm:gap-5 md:gap-6 select-none shrink-0">
            {/* Ambient glow */}
            <div className="absolute top-0 left-0 w-36 sm:w-56 h-36 sm:h-56 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-44 sm:w-64 h-44 sm:h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Left Column: Framed Jersey Showcase + Badges Row Below */}
            <div className="w-24 xs:w-28 sm:w-44 md:w-52 shrink-0 flex flex-col items-center justify-center gap-1.5 sm:gap-2 self-center">
              <PlayerJerseyShowcase
                playerName={currentLot.playerName}
                teamCode={currentLot.highestBidderFranchise}
                soldToTeam={currentLot.soldToFranchise}
                status={currentLot.status}
                lotNumber={currentLot.lotNumber}
                size="md"
                className="w-full aspect-[3/4]"
              />

              {/* Player Indicators: Capped, Overseas, Last Played Team Logo, Country Flag */}
              <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full">
                {/* 1. Cap icon if capped */}
                {currentLot.isCapped && (
                  <div
                    className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-xs"
                    title="Capped Player"
                  >
                    <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
                  </div>
                )}

                {/* 2. Overseas airplane icon */}
                {currentLot.isOverseas && (
                  <div
                    className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-xs"
                    title="Overseas Player"
                  >
                    <Plane className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400/40" />
                  </div>
                )}

                {/* 3. Last played team logo */}
                {currentLot.previousFranchise && currentLot.previousFranchise !== "None" && (
                  <div
                    className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-[#141b3a] border border-indigo-800/60 flex items-center justify-center p-1 shrink-0 shadow-xs"
                    title={`Previous Franchise: ${currentLot.previousFranchise}`}
                  >
                    <img
                      src={`/jerseys/${currentLot.previousFranchise.toLowerCase()}_logo.png`}
                      alt={currentLot.previousFranchise}
                      className="w-full h-full object-contain filter drop-shadow-xs"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* 4. Country flag icon */}
                <div
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-lg bg-[#141b3a] border border-indigo-800/60 flex items-center justify-center p-1 shrink-0 shadow-xs overflow-hidden"
                  title={currentLot.country}
                >
                  <CountryFlag country={currentLot.country} size="sm" showLabel={false} />
                </div>
              </div>
            </div>

            {/* Right Column: Player Intel and 3x2 Stats Grid */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 sm:py-1">
              {/* Header Info */}
              <div>
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <h1 className="text-base xs:text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight truncate">
                    {currentLot.playerName}
                  </h1>
                </div>

                {/* Subtitle: Role (left of batting hand) & Bowling Style */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm text-slate-300 font-medium mt-1 sm:mt-1.5 truncate">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-[#182042] text-slate-200 border border-indigo-700/60 shrink-0">
                    {getShortRole(currentLot.role)}
                  </span>
                  <span className="text-slate-300 truncate">{formatBattingStyle(currentLot.battingStyle)}</span>
                  {currentLot.bowlingStyle && currentLot.bowlingStyle !== "None" && (
                    <>
                      <span className="text-slate-600 shrink-0">•</span>
                      <span className="text-slate-400 truncate">{currentLot.bowlingStyle}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 3x2 Grid of 6 Stats Cards */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 md:gap-3 mt-2 sm:mt-3">
                {/* MAT */}
                <div className="bg-[#121936]/90 border border-indigo-900/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 md:p-3 text-center shadow-xs flex flex-col justify-center">
                  <div className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">MAT</div>
                  <div className="text-xs sm:text-lg md:text-xl font-black text-white font-mono mt-0.5 sm:mt-1">{currentLot.matches}</div>
                </div>
                {/* RUNS */}
                <div className="bg-[#121936]/90 border border-indigo-900/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 md:p-3 text-center shadow-xs flex flex-col justify-center">
                  <div className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">RUNS</div>
                  <div className="text-xs sm:text-lg md:text-xl font-black text-white font-mono mt-0.5 sm:mt-1">{formatIndianNumber(currentLot.runs)}</div>
                </div>
                {/* AVG */}
                <div className="bg-[#121936]/90 border border-indigo-900/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 md:p-3 text-center shadow-xs flex flex-col justify-center">
                  <div className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">AVG</div>
                  <div className="text-xs sm:text-lg md:text-xl font-black text-white font-mono mt-0.5 sm:mt-1">
                    {currentLot.battingAverage > 0 ? currentLot.battingAverage.toFixed(1) : "-"}
                  </div>
                </div>
                {/* SR */}
                <div className="bg-[#121936]/90 border border-indigo-900/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 md:p-3 text-center shadow-xs flex flex-col justify-center">
                  <div className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">SR</div>
                  <div className="text-xs sm:text-lg md:text-xl font-black text-white font-mono mt-0.5 sm:mt-1">
                    {currentLot.strikeRate > 0 ? currentLot.strikeRate.toFixed(1) : "-"}
                  </div>
                </div>
                {/* WKTS */}
                <div className="bg-[#121936]/90 border border-indigo-900/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 md:p-3 text-center shadow-xs flex flex-col justify-center">
                  <div className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">WKTS</div>
                  <div className="text-xs sm:text-lg md:text-xl font-black text-white font-mono mt-0.5 sm:mt-1">{currentLot.wickets}</div>
                </div>
                {/* ECON */}
                <div className="bg-[#121936]/90 border border-indigo-900/50 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 md:p-3 text-center shadow-xs flex flex-col justify-center">
                  <div className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">ECON</div>
                  <div className="text-xs sm:text-lg md:text-xl font-black text-white font-mono mt-0.5 sm:mt-1">
                    {currentLot.economy > 0 ? currentLot.economy.toFixed(1) : "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: Valuation & Highest Bid Banner (Expanded Width Container for Bids & Team) */}
          <div className="relative rounded-2xl sm:rounded-3xl bg-[#0b1022] border border-indigo-950/80 p-3 sm:p-4 md:p-5 shadow-xl overflow-hidden flex items-center justify-between select-none shrink-0">
            {/* Top-left subtle orange rim line */}
            <div className="absolute top-0 left-0 w-24 h-[2px] bg-gradient-to-r from-orange-500 via-amber-400 to-transparent pointer-events-none" />

            {/* Left Half: Base Price (+ RTM Info ONLY if available) */}
            <div
              className={cn(
                "shrink-0 min-w-0 pr-2 sm:pr-3 flex flex-col justify-center",
                hasRtm ? "w-[28%] sm:w-[24%]" : "w-[22%] sm:w-[18%]"
              )}
            >
              {/* Row 1: Orange Rupee Icon + Base Price */}
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-xl md:text-2xl font-black text-amber-500 font-mono">₹</span>
                <span className="text-base sm:text-lg lg:text-2xl font-bold text-white font-mono">
                  {formatRupees(currentLot.basePrice).replace("₹", "")}
                </span>
              </div>

              {/* Row 2: Down Arrow Circle + RTM Pill (Only if available) */}
              {hasRtm && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                    <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
                  </div>
                  <div className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-950/80 border border-blue-500/40 text-blue-400 truncate">
                    RTM: {currentLot.previousFranchise}
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="h-11 sm:h-12 w-[1px] bg-indigo-950/90 mx-2 sm:mx-3 shrink-0" />

            {/* Right Half: Current Bid + Leading Team (Expanded Width) */}
            <div className="flex-1 min-w-0 pl-2 sm:pl-4 flex items-center justify-between">
              {/* Flame + Bid Amount */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Flame className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 text-amber-500 fill-amber-500/30 animate-pulse shrink-0" />
                <span className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-white tracking-tight truncate">
                  {currentLot.currentBid > 0 ? formatRupees(currentLot.currentBid) : formatRupees(currentLot.basePrice)}
                </span>
              </div>

              {/* Leading Team Code & Logo */}
              {currentLot.highestBidderFranchise ? (
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                  <div className="flex flex-col items-end">
                    <span className="text-base sm:text-xl lg:text-2xl font-black text-white tracking-wide leading-none">
                      {currentLot.highestBidderFranchise}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-amber-400 uppercase tracking-widest leading-none mt-1">
                      Leading Bid
                    </span>
                  </div>
                  <img
                    src={`/jerseys/${currentLot.highestBidderFranchise.toLowerCase()}_logo.png`}
                    alt={currentLot.highestBidderFranchise}
                    className="w-8 h-8 sm:w-11 sm:h-11 md:w-13 md:h-13 object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="text-right text-[11px] sm:text-xs text-slate-400 italic font-medium shrink-0 ml-2">
                  Opening Bid
                </div>
              )}
            </div>
          </div>
        </div>
      ) : isLobby ? (
        /* Pre-Auction Lobby Waiting Screen (Requirement 2: Only show player & bid controls once auction starts) */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground gap-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            <Gavel className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Lobby • Waiting to Start
            </div>
            <h2 className="text-xl font-black text-foreground tracking-tight">
              {snapshot?.name || "IPL 2026 Live Auction Arena"}
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm">
              {myFranchise
                ? `You represent ${myFranchise}. Check upcoming player sets and start the auction when ready.`
                : "Select or claim a franchise from the left panel before the auction begins."}
            </p>
          </div>

          {/* Quick Rules & Format Grid */}
          <div className="grid grid-cols-3 gap-2 w-full text-left">
            <div className="p-2.5 rounded-xl bg-card/70 border border-border/80">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">Auction Format</div>
              <div className="text-xs font-bold text-foreground mt-0.5">
                {snapshot?.ruleset === "SPRINT_XI" ? "Sprint XI" : snapshot?.ruleset === "CLASSIC" ? "Classic" : "Mega Auction"}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card/70 border border-border/80">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">Squad Size</div>
              <div className="text-xs font-bold text-foreground mt-0.5">
                {snapshot?.ruleset === "SPRINT_XI" ? "11 Players" : "18 - 25 Players"}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-card/70 border border-border/80">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">Total Purse</div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {snapshot?.ruleset === "SPRINT_XI" ? "₹50 Cr" : "₹120 Cr"}
              </div>
            </div>
          </div>

          {/* Lobby Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setIsUpcomingDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-secondary/80 hover:bg-secondary text-foreground border border-border/80 shadow-2xs transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Upcoming Players</span>
            </button>

            {myFranchise && snapshot?.enableRetentions && snapshot?.ruleset !== "SPRINT_XI" && (
              <button
                onClick={() => setIsRetentionsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 shadow-2xs transition-colors cursor-pointer"
              >
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Configure Retentions</span>
              </button>
            )}

            <button
              onClick={onStartAuction}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Auction</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground gap-3">
          <Award className="w-12 h-12 text-primary/50" />
          <h2 className="text-base font-bold text-foreground">
            {isCompleted ? "Auction Completed!" : "Auction Arena"}
          </h2>
          <p className="text-xs max-w-md">
            {isCompleted
              ? "All player sets have concluded. Inspect final squads in the Teams panel."
              : "Waiting for auction lot to open..."}
          </p>
        </div>
      )}

      {/* Immediate Action Bidding Controls: Strictly hidden in Lobby and anchored at the bottom */}
      {!isLobby && !isCompleted && currentLot && (
        <div className="flex-shrink-0 w-full mt-auto">
          <BidControls
            currentBid={currentLot?.currentBid || 0}
            nextLegalBid={effectiveNextBid}
            bidIncrement={effectiveIncrement}
            highestBidderCode={currentLot?.highestBidderFranchise || null}
            myFranchise={userFranchiseState}
            currentLot={currentLot}
            ruleset={snapshot?.ruleset}
            onPlaceBid={onPlaceBid}
            onSelectTeamRequest={() => setIsTeamSelectModalOpen(true)}
            isLive={isLive && currentLot?.status === "ACTIVE" && !Boolean(snapshot?.rtmState?.active)}
            isRtmActive={Boolean(snapshot?.rtmState?.active)}
            timerSeconds={secondsLeft}
            timerPercentage={percentage}
            isUrgent={isUrgent}
            isPaused={isPaused}
          />
        </div>
      )}

      {/* Team Selection Modal (When clicking Bid without team) */}
      <TeamSelectionModal
        isOpen={isTeamSelectModalOpen}
        onClose={() => setIsTeamSelectModalOpen(false)}
        teams={snapshot?.teams || {}}
        onSelectTeam={(code) => {
          onClaimTeam?.(code);
        }}
        nextLegalBid={effectiveNextBid}
      />

      {/* Upcoming Players Sheet Dialog */}
      <UpcomingSetsDialog
        isOpen={isUpcomingDialogOpen}
        onClose={() => setIsUpcomingDialogOpen(false)}
        currentSetCode={currentLot?.setCode || "BA1"}
        roomId={snapshot?.roomId}
      />

      {/* Manage Retentions Modal (Lobby) */}
      {myFranchise && snapshot?.ruleset !== "SPRINT_XI" && (
        <ManageRetentionsModal
          isOpen={isRetentionsModalOpen}
          onClose={() => setIsRetentionsModalOpen(false)}
          franchiseCode={myFranchise}
          franchiseState={userFranchiseState || undefined}
          ruleset={snapshot?.ruleset || "MEGA"}
          onSaveRetentions={(code, playerIds) => onSetRetentions?.(code, playerIds)}
        />
      )}
    </div>
  );
};
