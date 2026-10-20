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

export const TEAM_GLOW_STYLES: Record<string, { bgGlow: string; borderGlow: string; accentText: string; pillStyle: string; label: string; numColor: string; podiumNeon: string }> = {
  MI: {
    bgGlow: "from-blue-600/20 via-blue-900/10 to-transparent",
    borderGlow: "border-blue-500/50 shadow-blue-500/15 dark:border-blue-500/40",
    accentText: "text-blue-600 dark:text-blue-400",
    pillStyle: "bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-blue-500/10",
    label: "Mumbai Indians",
    numColor: "#ffffff",
    podiumNeon: "#3b82f6",
  },
  CSK: {
    bgGlow: "from-amber-400/25 via-yellow-600/10 to-transparent",
    borderGlow: "border-amber-400/50 shadow-amber-400/15 dark:border-amber-400/40",
    accentText: "text-amber-600 dark:text-amber-300",
    pillStyle: "bg-amber-500/20 text-amber-800 dark:text-yellow-300 border-amber-400/50 shadow-amber-500/10",
    label: "Chennai Super Kings",
    numColor: "#ffffff",
    podiumNeon: "#eab308",
  },
  RCB: {
    bgGlow: "from-red-600/20 via-rose-950/15 to-transparent",
    borderGlow: "border-red-500/50 shadow-red-500/15 dark:border-red-500/40",
    accentText: "text-red-600 dark:text-red-400",
    pillStyle: "bg-red-600/15 text-red-700 dark:text-red-300 border-red-500/40 shadow-red-500/10",
    label: "Royal Challengers Bengaluru",
    numColor: "#ffffff",
    podiumNeon: "#ef4444",
  },
  KKR: {
    bgGlow: "from-purple-600/20 via-fuchsia-950/15 to-transparent",
    borderGlow: "border-purple-500/50 shadow-purple-500/15 dark:border-purple-500/40",
    accentText: "text-purple-600 dark:text-purple-400",
    pillStyle: "bg-purple-600/15 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-purple-500/10",
    label: "Kolkata Knight Riders",
    numColor: "#ffffff",
    podiumNeon: "#a855f7",
  },
  SRH: {
    bgGlow: "from-orange-500/25 via-amber-950/15 to-transparent",
    borderGlow: "border-orange-500/50 shadow-orange-500/15 dark:border-orange-500/40",
    accentText: "text-orange-600 dark:text-orange-400",
    pillStyle: "bg-orange-600/15 text-orange-700 dark:text-orange-300 border-orange-500/40 shadow-orange-500/10",
    label: "Sunrisers Hyderabad",
    numColor: "#ffffff",
    podiumNeon: "#f97316",
  },
  DC: {
    bgGlow: "from-blue-600/20 via-red-900/15 to-transparent",
    borderGlow: "border-blue-500/50 shadow-blue-500/15 dark:border-blue-500/40",
    accentText: "text-blue-600 dark:text-blue-400",
    pillStyle: "bg-blue-600/15 text-blue-700 dark:text-sky-300 border-blue-500/40 shadow-blue-500/10",
    label: "Delhi Capitals",
    numColor: "#ffffff",
    podiumNeon: "#0ea5e9",
  },
  RR: {
    bgGlow: "from-pink-500/25 via-rose-950/15 to-transparent",
    borderGlow: "border-pink-500/50 shadow-pink-500/15 dark:border-pink-500/40",
    accentText: "text-pink-600 dark:text-pink-400",
    pillStyle: "bg-pink-600/15 text-pink-700 dark:text-pink-300 border-pink-400/40 shadow-pink-500/10",
    label: "Rajasthan Royals",
    numColor: "#ffffff",
    podiumNeon: "#f43f5e",
  },
  GT: {
    bgGlow: "from-cyan-500/25 via-slate-900/20 to-transparent",
    borderGlow: "border-cyan-500/50 shadow-cyan-500/15 dark:border-cyan-500/40",
    accentText: "text-cyan-600 dark:text-cyan-400",
    pillStyle: "bg-cyan-600/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 shadow-cyan-500/10",
    label: "Gujarat Titans",
    numColor: "#ffffff",
    podiumNeon: "#14b8a6",
  },
  LSG: {
    bgGlow: "from-sky-500/25 via-blue-950/15 to-transparent",
    borderGlow: "border-sky-500/50 shadow-sky-500/15 dark:border-sky-500/40",
    accentText: "text-sky-600 dark:text-sky-400",
    pillStyle: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-400/40 shadow-sky-500/10",
    label: "Lucknow Super Giants",
    numColor: "#ffffff",
    podiumNeon: "#38bdf8",
  },
  PBKS: {
    bgGlow: "from-red-600/25 via-amber-950/15 to-transparent",
    borderGlow: "border-red-500/50 shadow-red-500/15 dark:border-red-500/40",
    accentText: "text-red-600 dark:text-red-400",
    pillStyle: "bg-rose-600/15 text-rose-700 dark:text-rose-300 border-rose-500/40 shadow-rose-500/10",
    label: "Punjab Kings",
    numColor: "#ffffff",
    podiumNeon: "#e11d48",
  },
};

const DEFAULT_GLOW = {
  bgGlow: "from-slate-400/15 via-slate-700/10 to-transparent",
  borderGlow: "border-slate-200 shadow-slate-200/50 dark:border-border/60 dark:shadow-slate-900/10",
  accentText: "text-slate-600 dark:text-muted-foreground",
  pillStyle: "bg-slate-100 dark:bg-secondary/80 text-slate-600 dark:text-muted-foreground border-slate-200 dark:border-border/80",
  label: "Auction Pool",
  numColor: "#ffffff",
  podiumNeon: "#38bdf8",
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
    const parts = playerName.trim().split(/\s+/);
    return parts[parts.length - 1].toUpperCase();
  }, [playerName]);

  // Dynamic font scaling according to length of the name and container queries (screen/card size)
  const nameTypography = useMemo(() => {
    const len = surname.length;
    let cqw = 4.8;
    let minPx = 6.5;
    let maxPx = 9.2;
    let letterSpacing = "0.08em";

    if (len <= 4) {
      // Very short: GILL, PANT, HEAD, IYER
      cqw = 4.8;
      minPx = 6.5;
      maxPx = 9.2;
      letterSpacing = "0.08em";
    } else if (len <= 6) {
      // Short: KOHLI, ROHIT, BUMRAH, PANDYA
      cqw = 4.2;
      minPx = 6.0;
      maxPx = 8.4;
      letterSpacing = "0.06em";
    } else if (len <= 8) {
      // Medium: KLAASEN, MAXWELL, SAMSON, HETMYER
      cqw = 3.7;
      minPx = 5.4;
      maxPx = 7.5;
      letterSpacing = "0.04em";
    } else if (len <= 10) {
      // Long: WILLIAMSON, RUTHERFORD, CHOUDHARY
      cqw = 3.2;
      minPx = 4.8;
      maxPx = 6.6;
      letterSpacing = "0.02em";
    } else if (len <= 12) {
      // Very long: CHAKRAVARTHY, LIVINGSTONE
      cqw = 2.8;
      minPx = 4.2;
      maxPx = 5.8;
      letterSpacing = "0.01em";
    } else {
      // Extra long (13+):
      cqw = 2.4;
      minPx = 3.8;
      maxPx = 5.2;
      letterSpacing = "0em";
    }

    return {
      fontSize: `clamp(${minPx}px, ${cqw}cqw, ${maxPx}px)`,
      letterSpacing,
    };
  }, [surname]);

  // Squad / Lot number for back view
  const displayNum = lotNumber !== undefined && lotNumber !== null ? lotNumber : 1;

  const jerseyUrl = useMemo(() => {
    const code = activeCode ? activeCode.toLowerCase() : "neutral";
    const suffix = viewSide === "back" ? "_back.webp" : "_miniature.webp";
    return `/jerseys/${code}${suffix}`;
  }, [activeCode, viewSide]);

  const jerseyPngUrl = useMemo(() => {
    const code = activeCode ? activeCode.toLowerCase() : "neutral";
    const suffix = viewSide === "back" ? "_back.png" : "_miniature.png";
    return `/jerseys/${code}${suffix}`;
  }, [activeCode, viewSide]);

  // Double-buffering state: ensures previous jersey stays fully visible until the next is 100% loaded
  const [displayedUrl, setDisplayedUrl] = useState(jerseyUrl);

  useEffect(() => {
    if (jerseyUrl === displayedUrl) return;

    let isSubscribed = true;
    const img = new Image();
    img.src = jerseyUrl;

    if (img.complete && img.naturalWidth > 0) {
      setDisplayedUrl(jerseyUrl);
      setImgError(false);
      return;
    }

    if (typeof img.decode === "function") {
      img
        .decode()
        .then(() => {
          if (isSubscribed) {
            setDisplayedUrl(jerseyUrl);
            setImgError(false);
          }
        })
        .catch(() => {
          const fallback = new Image();
          fallback.src = jerseyPngUrl;
          fallback.onload = () => {
            if (isSubscribed) {
              setDisplayedUrl(jerseyPngUrl);
              setImgError(false);
            }
          };
        });
    } else {
      (img as HTMLImageElement).onload = () => {
        if (isSubscribed) {
          setDisplayedUrl(jerseyUrl);
          setImgError(false);
        }
      };
      (img as HTMLImageElement).onerror = () => {
        if (isSubscribed) {
          setDisplayedUrl(jerseyPngUrl);
        }
      };
    }

    return () => {
      isSubscribed = false;
    };
  }, [jerseyUrl, jerseyPngUrl, displayedUrl]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-between p-2.5 rounded-2xl bg-gradient-to-b from-[#0e152e] via-[#090e1f] to-[#050814] border border-[#1e284a] select-none transition-all duration-300 shadow-xl overflow-hidden group aspect-[4/5.2]",
        className
      )}
    >
      {/* Stadium Overhead Spotlight & Atmospheric Floodlight Glow */}
      <div
        className="absolute inset-0 pointer-events-none z-1"
        style={{
          background:
            "radial-gradient(ellipse 130% 70% at 50% -10%, rgba(255, 255, 255, 0.22) 0%, rgba(147, 51, 234, 0.12) 35%, transparent 70%), radial-gradient(circle at 10% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 40%), radial-gradient(circle at 90% 30%, rgba(236, 72, 153, 0.12) 0%, transparent 40%)",
        }}
      />

      {/* Dynamic Ambient Stadium Spotlight Glow */}
      <div
        className={cn(
          "absolute -inset-10 bg-radial transition-all duration-700 pointer-events-none opacity-60 dark:opacity-75 blur-2xl z-2",
          teamTheme.bgGlow
        )}
      />

      {/* Top Floating Status Pill */}
      {status === "SOLD" && (
        <div className="absolute top-2.5 left-2.5 z-25 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-xs backdrop-blur-xs">
            <CheckCircle size={11} weight="fill" />
            <span>SOLD {activeCode}</span>
          </span>
        </div>
      )}

      {/* Top Right: Interactive Front / Back Flip Button */}
      <button
        type="button"
        onClick={() => setViewSide((prev) => (prev === "front" ? "back" : "front"))}
        className="absolute top-2.5 right-2.5 z-25 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/55 hover:bg-black/75 text-white/95 border border-white/20 backdrop-blur-md shadow-xs transition-transform active:scale-95 cursor-pointer"
        title="Toggle Front/Back View"
      >
        <ArrowsClockwise size={12} weight="bold" />
        <span>{viewSide === "front" ? "Back" : "Front"}</span>
      </button>

      {/* 3D Miniature Jersey Graphic Stage */}
      <div
        key={`${pulseKey}-${viewSide}`}
        onClick={() => setViewSide((prev) => (prev === "front" ? "back" : "front"))}
        className="relative flex-1 w-[92%] flex items-center justify-center my-auto transition-transform duration-300 hover:scale-[1.03] cursor-pointer z-10 -mb-3"
      >
        {/* 1:1 Aspect Box perfectly synced with the 1024x1024 Jersey */}
        <div className="relative aspect-square w-full max-h-full flex items-center justify-center [container-type:inline-size]">
          {/* Base 3D Miniature Jersey Model with WebP primary and PNG fallback */}
          <picture className="w-full h-full flex items-center justify-center pointer-events-none">
            <source srcSet={displayedUrl} type="image/webp" />
            <img
              src={displayedUrl.endsWith(".webp") ? displayedUrl.replace(".webp", ".png") : displayedUrl}
              alt={`${playerName} 2026 Kit (${viewSide})`}
              onError={() => setImgError(true)}
              className="w-full h-full object-contain filter drop-shadow-[0_16px_28px_rgba(0,0,0,0.8)] pointer-events-none transition-opacity duration-150"
              loading="eager"
              decoding="async"
            />
          </picture>

          {/* Back View: Player Name and Number Athletic Overlay */}
          {viewSide === "back" && (
            <div className="absolute inset-0 pointer-events-none select-none">
              {/* Player Surname arched on upper back fabric */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-[58%] flex items-center justify-center text-center overflow-hidden"
                style={{ top: "22.5%" }}
              >
                <span
                  className="font-black uppercase truncate text-center"
                  style={{
                    fontSize: nameTypography.fontSize,
                    letterSpacing: nameTypography.letterSpacing,
                    color: "#ffffff",
                    textShadow:
                      "0 2px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.9)",
                    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    lineHeight: 1.1,
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
                    color: "#ffffff",
                    textShadow:
                      "0 3px 6px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95), 1px 2px 0 rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.9)",
                  }}
                >
                  {displayNum}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3D Realistic Illuminated Stadium Podium Base */}
      <div className="relative w-[86%] h-12 shrink-0 mb-0.5 z-5 pointer-events-none">
        {/* Top Disc with Neon Glowing Rim */}
        <div
          className="absolute top-0 left-0 right-0 h-7 rounded-[50%] z-20"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, #26274a 0%, #15162e 70%, #0d0e1f 100%)",
            border: "2px solid rgba(255, 255, 255, 0.85)",
            boxShadow: `0 0 18px ${teamTheme.podiumNeon}, 0 0 36px ${teamTheme.podiumNeon}90, inset 0 0 10px rgba(255, 255, 255, 0.55)`,
          }}
        />
        {/* Front Center Lens Flare Glint on Rim */}
        <div
          className="absolute top-3.5 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-2 rounded-[50%] z-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, #ffffff 0%, rgba(255, 255, 255, 0.8) 40%, transparent 100%)",
            filter: "blur(1px)",
            boxShadow: `0 0 8px #ffffff, 0 0 16px ${teamTheme.podiumNeon}`,
          }}
        />
        {/* 3D Solid Cylinder Body */}
        <div
          className="absolute top-3 left-0 right-0 h-8 rounded-b-[50%] z-10"
          style={{
            background: "linear-gradient(180deg, #1c1d36 0%, #0e1022 55%, #05060f 100%)",
            borderBottom: "1.5px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 12px 24px rgba(0, 0, 0, 0.9)",
          }}
        />
        {/* Soft Shadow on Stadium Floor */}
        <div className="absolute -bottom-2 left-[2%] w-[96%] h-5 rounded-[50%] bg-black/85 blur-md z-0" />
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
  const suffixWebp = side === "front" ? "_miniature.webp" : "_back.webp";
  const suffixPng = side === "front" ? "_miniature.png" : "_back.png";
  const imgUrlWebp = `/jerseys/${code.toLowerCase()}${suffixWebp}`;
  const imgUrlPng = `/jerseys/${code.toLowerCase()}${suffixPng}`;

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
      <picture className="w-full h-full flex items-center justify-center pointer-events-none">
        <source srcSet={imgUrlWebp} type="image/webp" />
        <img
          src={imgUrlPng}
          alt={`${code} kit`}
          className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] pointer-events-none"
          loading="lazy"
          decoding="async"
        />
      </picture>
      {side === "back" && lotNumber !== undefined && lotNumber !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {size >= 48 && surname && (
            <span
              className="font-black uppercase tracking-wider text-center px-0.5 truncate"
              style={{
                fontSize: surname.length > 8 ? "5.5px" : "6.5px",
                marginTop: "22.5%",
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

