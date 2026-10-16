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
  const [imgError, setImgError] = useState(false);

  const styling = FRANCHISE_COLORS[code] || {
    bg: "bg-slate-700",
    text: "text-white",
    border: "border-slate-500",
  };

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px] font-bold rounded",
    md: "w-8 h-8 text-xs font-black tracking-tight rounded-md",
    lg: "w-11 h-11 text-sm font-black tracking-tight rounded-lg shadow-sm",
    xl: "w-14 h-14 text-base font-black tracking-tight rounded-xl shadow-md",
  }[size];

  const imgSizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-11 h-11",
    xl: "w-14 h-14",
  }[size];

  const logoUrl = code ? `/jerseys/${code.toLowerCase()}_logo.png` : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLogo && logoUrl && !imgError ? (
        <div className={cn("relative flex items-center justify-center flex-shrink-0 select-none", imgSizeClasses)}>
          <img
            src={logoUrl}
            alt={code}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none transition-transform hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className={cn(
            "inline-flex items-center justify-center select-none uppercase transition-transform flex-shrink-0 shadow-inner border",
            styling.bg,
            styling.text,
            styling.border,
            sizeClasses
          )}
        >
          {code}
        </div>
      )}
      {name && (
        <span className="font-semibold text-xs tracking-tight truncate select-none text-foreground">
          {name}
        </span>
      )}
    </div>
  );
};
