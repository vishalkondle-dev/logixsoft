"use client";

import React, { useMemo, useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { CheckCircle, ArrowsClockwise } from "@phosphor-icons/react";

export interface PlayerJerseyShowcaseProps {
  playerName: string;
  teamCode?: string | null;
  soldToTeam?: string | null;
  status?: "PENDING" | "ACTIVE" | "PAUSED" | "SOLD" | "UNSOLD" | string;
  lotNumber?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const TEAM_GLOW_STYLES: Record<string, { bgGlow: string; borderGlow: string; accentText: string; pillStyle: string; label: string; numColor: string }> = {
  MI: {
    bgGlow: "from-blue-600/20 via-blue-900/10 to-transparent",
    borderGlow: "border-blue-500/50 shadow-blue-500/15 dark:border-blue-500/40",
    accentText: "text-blue-600 dark:text-blue-400",
    pillStyle: "bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-blue-500/10",
    label: "Mumbai Indians",
    numColor: "#ffd700",
  },
  CSK: {
    bgGlow: "from-amber-400/25 via-yellow-600/10 to-transparent",
    borderGlow: "border-amber-400/50 shadow-amber-400/15 dark:border-amber-400/40",
    accentText: "text-amber-600 dark:text-amber-300",
    pillStyle: "bg-amber-500/20 text-amber-800 dark:text-yellow-300 border-amber-400/50 shadow-amber-500/10",
    label: "Chennai Super Kings",
    numColor: "#003b8e",
  },
  RCB: {
    bgGlow: "from-red-600/20 via-rose-950/15 to-transparent",
    borderGlow: "border-red-500/50 shadow-red-500/15 dark:border-red-500/40",
    accentText: "text-red-600 dark:text-red-400",
    pillStyle: "bg-red-600/15 text-red-700 dark:text-red-300 border-red-500/40 shadow-red-500/10",
    label: "Royal Challengers Bengaluru",
    numColor: "#ffd700",
  },
  KKR: {
    bgGlow: "from-purple-600/20 via-fuchsia-950/15 to-transparent",
    borderGlow: "border-purple-500/50 shadow-purple-500/15 dark:border-purple-500/40",
    accentText: "text-purple-600 dark:text-purple-400",
    pillStyle: "bg-purple-600/15 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-purple-500/10",
    label: "Kolkata Knight Riders",
    numColor: "#ffd700",
  },
  SRH: {
    bgGlow: "from-orange-500/25 via-amber-950/15 to-transparent",
    borderGlow: "border-orange-500/50 shadow-orange-500/15 dark:border-orange-500/40",
    accentText: "text-orange-600 dark:text-orange-400",
    pillStyle: "bg-orange-600/15 text-orange-700 dark:text-orange-300 border-orange-500/40 shadow-orange-500/10",
    label: "Sunrisers Hyderabad",
    numColor: "#ffffff",
  },
  DC: {
    bgGlow: "from-blue-600/20 via-red-900/15 to-transparent",
    borderGlow: "border-blue-500/50 shadow-blue-500/15 dark:border-blue-500/40",
    accentText: "text-blue-600 dark:text-blue-400",
    pillStyle: "bg-blue-600/15 text-blue-700 dark:text-sky-300 border-blue-500/40 shadow-blue-500/10",
    label: "Delhi Capitals",
    numColor: "#ffffff",
  },
  RR: {
    bgGlow: "from-pink-500/25 via-rose-950/15 to-transparent",
    borderGlow: "border-pink-500/50 shadow-pink-500/15 dark:border-pink-500/40",
    accentText: "text-pink-600 dark:text-pink-400",
    pillStyle: "bg-pink-600/15 text-pink-700 dark:text-pink-300 border-pink-400/40 shadow-pink-500/10",
    label: "Rajasthan Royals",
    numColor: "#ffffff",
  },
  GT: {
    bgGlow: "from-cyan-500/25 via-slate-900/20 to-transparent",
    borderGlow: "border-cyan-500/50 shadow-cyan-500/15 dark:border-cyan-500/40",
    accentText: "text-cyan-600 dark:text-cyan-400",
    pillStyle: "bg-cyan-600/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 shadow-cyan-500/10",
    label: "Gujarat Titans",
    numColor: "#e5c07b",
  },
  LSG: {
    bgGlow: "from-sky-500/25 via-blue-950/15 to-transparent",
    borderGlow: "border-sky-500/50 shadow-sky-500/15 dark:border-sky-500/40",
    accentText: "text-sky-600 dark:text-sky-400",
    pillStyle: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40 shadow-sky-500/10",
    label: "Lucknow Super Giants",
    numColor: "#ffffff",
  },
  PBKS: {
    bgGlow: "from-red-600/25 via-amber-950/15 to-transparent",
    borderGlow: "border-red-500/50 shadow-red-500/15 dark:border-red-500/40",
    accentText: "text-red-600 dark:text-red-400",
    pillStyle: "bg-rose-600/15 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-rose-500/10",
    label: "Punjab Kings",
    numColor: "#ffd700",
  },
};

const DEFAULT_GLOW = {
  bgGlow: "from-slate-400/15 via-slate-700/10 to-transparent",
  borderGlow: "border-slate-200 shadow-slate-200/50 dark:border-border/60 dark:shadow-slate-900/10",
  accentText: "text-slate-600 dark:text-muted-foreground",
  pillStyle: "bg-slate-100 dark:bg-secondary/80 text-slate-600 dark:text-muted-foreground border-slate-200 dark:border-border/80",
  label: "Auction Pool",
  numColor: "#ffffff",
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
  const [viewSide, setViewSide] = useState<"front" | "back">("back");

  // Active franchise is either the sold winner or current highest bidder
  const activeCode = (status === "SOLD" ? soldToTeam || teamCode : teamCode)?.toUpperCase() || null;
  const teamTheme = activeCode && TEAM_GLOW_STYLES[activeCode] ? TEAM_GLOW_STYLES[activeCode] : DEFAULT_GLOW;

  // Whenever the active bidding team changes, trigger an athletic snap animation
  useEffect(() => {
    setPulseKey((prev) => prev + 1);
    setImgError(false);
  }, [activeCode]);

  // Player surname for back print
  const surname = useMemo(() => {
    if (!playerName) return "PLAYER";
    const parts = playerName.trim().split(" ");
    return parts[parts.length - 1].toUpperCase();
  }, [playerName]);

  // Squad / Lot number for back view
  const displayNum = lotNumber !== undefined && lotNumber !== null ? lotNumber : 1;

  const jerseyUrl = useMemo(() => {
    const code = activeCode ? activeCode.toLowerCase() : "neutral";
    const suffix = viewSide === "back" ? "_back.png" : "_miniature.png";
    return `/jerseys/${code}${suffix}`;
  }, [activeCode, viewSide]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-between p-2.5 rounded-2xl bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-[#181a32] dark:via-[#0d1228] dark:to-[#080d1e] border border-orange-500/30 dark:border-orange-500/50 backdrop-blur-xs select-none transition-all duration-300 shadow-md dark:shadow-xl overflow-hidden group aspect-[3/4]",
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

      {/* Top Floating Status Pill */}
      {status === "SOLD" && (
        <div className="absolute top-2 left-2 z-20 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-xs backdrop-blur-xs">
            <CheckCircle size={10} weight="fill" />
            <span>SOLD {activeCode}</span>
          </span>
        </div>
      )}

      {/* Top Right: Interactive Front / Back Flip Button */}
      <button
        type="button"
        onClick={() => setViewSide((prev) => (prev === "front" ? "back" : "front"))}
        className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 hover:bg-black/80 text-white/90 border border-white/20 backdrop-blur-md shadow-xs transition-transform active:scale-95 cursor-pointer"
        title="Toggle Front/Back View"
      >
        <ArrowsClockwise size={10} weight="bold" />
        <span>{viewSide === "front" ? "BACK" : "FRONT"}</span>
      </button>

      {/* 3D Miniature Jersey Graphic Stage */}
      <div
        key={`${pulseKey}-${viewSide}`}
        onClick={() => setViewSide((prev) => (prev === "front" ? "back" : "front"))}
        className="relative flex-1 w-full flex items-center justify-center my-auto transition-transform duration-300 hover:scale-[1.03] cursor-pointer"
      >
        {/* 1:1 Aspect Box perfectly synced with the 1024x1024 Jersey */}
        <div className="relative aspect-square w-full max-h-full flex items-center justify-center [container-type:inline-size]">
          {/* Base 3D Miniature Jersey Model */}
          <img
            src={jerseyUrl}
            alt={`${playerName} 2026 Kit (${viewSide})`}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] pointer-events-none"
            loading="eager"
          />

          {/* Back View: Player Name and Number Athletic Overlay */}
          {viewSide === "back" && (
            <div className="absolute inset-0 pointer-events-none select-none">
              {/* Player Surname arched on upper back fabric */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-[52%] flex items-center justify-center text-center overflow-hidden"
                style={{ top: "21.5%" }}
              >
                <span
                  className="font-black uppercase tracking-wider truncate text-center"
                  style={{
                    fontSize: "clamp(10px, 8cqw, 14px)",
                    color: teamTheme.numColor,
                    textShadow: "0 2px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,0.9)",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    letterSpacing: "0.12em",
                    lineHeight: 1,
                    maxWidth: "100%",
                  }}
                >
                  {surname}
                </span>
              </div>

              {/* Number only - NO KEYWORD LOT, NO HASH */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-[45%] flex items-center justify-center text-center"
                style={{ top: "34%" }}
              >
                <span
                  className="font-black font-mono tracking-tight text-center leading-none"
                  style={{
                    fontSize: "clamp(26px, 22cqw, 44px)",
                    color: teamTheme.numColor,
                    textShadow: "0 3px 6px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95), 1px 2px 0 rgba(0,0,0,0.85)",
                  }}
                >
                  {displayNum}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Subtle Bottom Reflection / Shadow under Jersey */}
        <div className="absolute -bottom-2 w-3/4 h-3 rounded-[50%] bg-black/40 blur-md pointer-events-none" />
      </div>
    </div>
  );
};

export interface PlayerJerseyThumbnailProps {
  teamCode: string;
  lotNumber?: number;
  playerName?: string;
  side?: "front" | "back";
  size?: number;
  className?: string;
}

export const PlayerJerseyThumbnail: React.FC<PlayerJerseyThumbnailProps> = ({
  teamCode,
  lotNumber,
  playerName,
  side = "back",
  size = 32,
  className,
}) => {
  const code = (teamCode || "neutral").toUpperCase();
  const theme = TEAM_GLOW_STYLES[code] || DEFAULT_GLOW;
  const numColor = theme.numColor || "#ffffff";
  const suffix = side === "front" ? "_miniature.png" : "_back.png";
  const imgUrl = `/jerseys/${code.toLowerCase()}${suffix}`;

  const surname = useMemo(() => {
    if (!playerName) return "";
    const parts = playerName.trim().split(" ");
    return parts[parts.length - 1].toUpperCase();
  }, [playerName]);

  return (
    <div
      className={cn("relative shrink-0 flex items-center justify-center select-none", className)}
      style={{ width: size, height: Math.round(size * 1.08) }}
    >
      <img
        src={imgUrl}
        alt={`${code} kit`}
        className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] pointer-events-none"
        loading="lazy"
      />
      {side === "back" && lotNumber !== undefined && lotNumber !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {size >= 48 && surname && (
            <span
              className="text-[7px] font-black uppercase tracking-wider text-center px-0.5 truncate"
              style={{
                marginTop: "22%",
                color: numColor,
                textShadow: "0 1px 2px rgba(0,0,0,0.95)",
                maxWidth: "85%",
              }}
            >
              {surname}
            </span>
          )}
          <span
            className="font-black font-mono leading-none"
            style={{
              fontSize: size >= 48 ? "13px" : size >= 36 ? "10px" : "8px",
              marginTop: size >= 48 && surname ? "3%" : "28%",
              color: numColor,
              textShadow: "0 1px 2px rgba(0,0,0,0.95), 0 0 1px rgba(0,0,0,0.95)",
            }}
          >
            {lotNumber}
          </span>
        </div>
      )}
    </div>
  );
};

