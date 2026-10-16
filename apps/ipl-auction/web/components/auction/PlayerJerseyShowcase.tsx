"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { CheckCircle, Fire } from "@phosphor-icons/react";

export interface PlayerJerseyShowcaseProps {
  playerName: string;
  teamCode?: string | null;
  soldToTeam?: string | null;
  status?: "PENDING" | "ACTIVE" | "PAUSED" | "SOLD" | "UNSOLD" | string;
  lotNumber?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const TEAM_GLOW_STYLES: Record<string, { bgGlow: string; borderGlow: string; accentText: string; pillStyle: string; label: string }> = {
  MI: {
    bgGlow: "from-blue-600/20 via-blue-900/10 to-transparent",
    borderGlow: "border-blue-500/50 shadow-blue-500/15 dark:border-blue-500/40",
    accentText: "text-blue-600 dark:text-blue-400",
    pillStyle: "bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-blue-500/10",
    label: "Mumbai Indians",
  },
  CSK: {
    bgGlow: "from-amber-400/25 via-yellow-600/10 to-transparent",
    borderGlow: "border-amber-400/50 shadow-amber-400/15 dark:border-amber-400/40",
    accentText: "text-amber-600 dark:text-amber-300",
    pillStyle: "bg-amber-500/20 text-amber-800 dark:text-yellow-300 border-amber-400/50 shadow-amber-500/10",
    label: "Chennai Super Kings",
  },
  RCB: {
    bgGlow: "from-red-600/20 via-rose-950/15 to-transparent",
    borderGlow: "border-red-500/50 shadow-red-500/15 dark:border-red-500/40",
    accentText: "text-red-600 dark:text-red-400",
    pillStyle: "bg-red-600/15 text-red-700 dark:text-red-300 border-red-500/40 shadow-red-500/10",
    label: "Royal Challengers Bengaluru",
  },
  KKR: {
    bgGlow: "from-purple-600/20 via-fuchsia-950/15 to-transparent",
    borderGlow: "border-purple-500/50 shadow-purple-500/15 dark:border-purple-500/40",
    accentText: "text-purple-600 dark:text-purple-400",
    pillStyle: "bg-purple-600/15 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-purple-500/10",
    label: "Kolkata Knight Riders",
  },
  SRH: {
    bgGlow: "from-orange-500/25 via-amber-950/15 to-transparent",
    borderGlow: "border-orange-500/50 shadow-orange-500/15 dark:border-orange-500/40",
    accentText: "text-orange-600 dark:text-orange-400",
    pillStyle: "bg-orange-600/15 text-orange-700 dark:text-orange-300 border-orange-500/40 shadow-orange-500/10",
    label: "Sunrisers Hyderabad",
  },
  DC: {
    bgGlow: "from-blue-600/20 via-red-900/15 to-transparent",
    borderGlow: "border-blue-500/50 shadow-blue-500/15 dark:border-blue-500/40",
    accentText: "text-blue-600 dark:text-blue-400",
    pillStyle: "bg-blue-600/15 text-blue-700 dark:text-sky-300 border-blue-500/40 shadow-blue-500/10",
    label: "Delhi Capitals",
  },
  RR: {
    bgGlow: "from-pink-500/25 via-rose-950/15 to-transparent",
    borderGlow: "border-pink-500/50 shadow-pink-500/15 dark:border-pink-500/40",
    accentText: "text-pink-600 dark:text-pink-400",
    pillStyle: "bg-pink-600/15 text-pink-700 dark:text-pink-300 border-pink-400/40 shadow-pink-500/10",
    label: "Rajasthan Royals",
  },
  GT: {
    bgGlow: "from-cyan-500/25 via-slate-900/20 to-transparent",
    borderGlow: "border-cyan-500/50 shadow-cyan-500/15 dark:border-cyan-500/40",
    accentText: "text-cyan-600 dark:text-cyan-400",
    pillStyle: "bg-cyan-600/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 shadow-cyan-500/10",
    label: "Gujarat Titans",
  },
  LSG: {
    bgGlow: "from-sky-500/25 via-blue-950/15 to-transparent",
    borderGlow: "border-sky-500/50 shadow-sky-500/15 dark:border-sky-500/40",
    accentText: "text-sky-600 dark:text-sky-400",
    pillStyle: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40 shadow-sky-500/10",
    label: "Lucknow Super Giants",
  },
  PBKS: {
    bgGlow: "from-red-600/25 via-amber-950/15 to-transparent",
    borderGlow: "border-red-500/50 shadow-red-500/15 dark:border-red-500/40",
    accentText: "text-red-600 dark:text-red-400",
    pillStyle: "bg-rose-600/15 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-rose-500/10",
    label: "Punjab Kings",
  },
};

const DEFAULT_GLOW = {
  bgGlow: "from-slate-400/15 via-slate-700/10 to-transparent",
  borderGlow: "border-slate-200 shadow-slate-200/50 dark:border-border/60 dark:shadow-slate-900/10",
  accentText: "text-slate-600 dark:text-muted-foreground",
  pillStyle: "bg-slate-100 dark:bg-secondary/80 text-slate-600 dark:text-muted-foreground border-slate-200 dark:border-border/80",
  label: "Auction Pool",
};

export const PlayerJerseyShowcase: React.FC<PlayerJerseyShowcaseProps> = ({
  playerName,
  teamCode,
  soldToTeam,
  status = "ACTIVE",
  lotNumber,
  className,
  size = "md",
}) => {
  const [imgError, setImgError] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  // Active franchise is either the sold winner or current highest bidder
  const activeCode = (status === "SOLD" ? soldToTeam || teamCode : teamCode)?.toUpperCase() || null;
  const teamTheme = activeCode && TEAM_GLOW_STYLES[activeCode] ? TEAM_GLOW_STYLES[activeCode] : DEFAULT_GLOW;

  // Whenever the active bidding team changes, trigger an athletic snap animation
  useEffect(() => {
    setPulseKey((prev) => prev + 1);
    setImgError(false);
  }, [activeCode]);

  const jerseyUrl = useMemo(() => {
    if (activeCode && !imgError) {
      return `/jerseys/${activeCode.toLowerCase()}_miniature.png`;
    }
    return `/jerseys/neutral_miniature.png`;
  }, [activeCode, imgError]);

  const containerSizes = {
    sm: "w-24 h-28 xs:w-28 xs:h-32 sm:w-36 sm:h-44",
    md: "w-28 h-32 xs:w-32 xs:h-36 sm:w-44 sm:h-52 md:w-52 md:h-60",
    lg: "w-40 h-48 sm:w-56 sm:h-64 md:w-68 md:h-76",
  }[size];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-between p-2.5 rounded-2xl bg-gradient-to-b from-[#181a32] via-[#0d1228] to-[#080d1e] border border-orange-500/50 backdrop-blur-xs select-none transition-all duration-300 shadow-xl overflow-hidden group aspect-[3/4]",
        className
      )}
    >
      {/* Top glowing orange rim light */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-500 via-amber-400/60 to-transparent pointer-events-none z-10" />

      {/* Dynamic Ambient Stadium Spotlight Glow */}
      <div
        className={cn(
          "absolute -inset-10 bg-radial transition-all duration-700 pointer-events-none opacity-60 dark:opacity-75 blur-2xl",
          teamTheme.bgGlow
        )}
      />

      {/* Top Floating Status Pill - Hidden until a bid is placed */}
      {status === "SOLD" ? (
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-xs backdrop-blur-xs">
            <CheckCircle size={10} weight="fill" />
            <span>SOLD {activeCode}</span>
          </span>
        </div>
      ) : activeCode ? (
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs backdrop-blur-xs",
              teamTheme.pillStyle
            )}
          >
            <Fire size={12} weight="fill" className="animate-pulse" />
            <span>{activeCode}</span>
          </span>
        </div>
      ) : null}

      {/* 3D Miniature Jersey Graphic Stage */}
      <div
        key={pulseKey}
        className="relative flex-1 w-full flex items-center justify-center my-auto transition-transform duration-300 hover:scale-[1.03]"
      >
        {/* Base 3D Miniature Jersey Model */}
        <img
          src={jerseyUrl}
          alt={`${playerName} 2026 Kit`}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] pointer-events-none"
          loading="eager"
        />

        {/* Subtle Bottom Reflection / Shadow under Jersey */}
        <div className="absolute -bottom-2 w-3/4 h-3 rounded-[50%] bg-black/40 blur-md pointer-events-none" />
      </div>
    </div>
  );
};
