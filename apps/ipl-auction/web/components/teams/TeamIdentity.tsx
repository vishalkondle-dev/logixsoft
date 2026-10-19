"use client";

import React, { useState } from "react";
import { cn, FRANCHISE_COLORS } from "../../lib/utils";

interface TeamIdentityProps {
  code: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showLogo?: boolean;
  className?: string;
}

export const TeamIdentity: React.FC<TeamIdentityProps> = ({
  code,
  name,
  size = "md",
  showLogo = true,
  className,
}) => {
  const styling = FRANCHISE_COLORS[code] || {
    bg: "bg-slate-700",
    text: "text-white",
    border: "border-slate-500",
    hex: "#475569",
  };

  const badgeSizes = {
    sm: "w-6 h-6 text-[10px] font-black tracking-wider rounded-md",
    md: "w-8 h-8 text-xs font-black tracking-wider rounded-lg shadow-xs",
    lg: "w-11 h-11 text-sm font-black tracking-wider rounded-xl shadow-md",
    xl: "w-14 h-14 text-base font-black tracking-wider rounded-2xl shadow-lg",
  }[size];

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {showLogo && (
        <div
          className={cn(
            "relative flex items-center justify-center select-none uppercase font-black transition-all duration-200 border flex-shrink-0 group hover:scale-105",
            styling.bg,
            styling.text,
            styling.border,
            badgeSizes
          )}
          style={{
            boxShadow: `0 2px 8px ${styling.hex}40, inset 0 1px 1px rgba(255, 255, 255, 0.35)`,
          }}
        >
          {/* Subtle top gloss highlight */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-inherit pointer-events-none" />
          <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {code}
          </span>
        </div>
      )}
      {name && (
        <span className="font-bold text-xs tracking-tight truncate select-none text-foreground">
          {name}
        </span>
      )}
    </div>
  );
};
