"use client";

import React, { useState } from "react";
import { getCountryFlagUrl } from "../../lib/countryFlags";
import { Globe, Airplane } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

export interface CountryFlagProps {
  country: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "player";
  className?: string;
  imgClassName?: string;
  showLabel?: boolean;
  isOverseas?: boolean;
}

const SIZE_CONFIG: Record<string, { img: string; text: string }> = {
  xs: { img: "w-3 h-3", text: "text-[10px]" },
  sm: { img: "w-3.5 h-3.5", text: "text-xs" },
  md: { img: "w-4.5 h-4.5", text: "text-xs" },
  lg: { img: "w-6 h-6", text: "text-sm" },
  xl: { img: "w-8 h-8", text: "text-base" },
  player: { img: "h-5 xs:h-6 sm:h-7 md:h-8 w-auto aspect-[4/3]", text: "text-base" },
};

export const CountryFlag: React.FC<CountryFlagProps> = ({
  country,
  size = "sm",
  className,
  imgClassName,
  showLabel = false,
  isOverseas,
}) => {
  const [hasError, setHasError] = useState(false);
  const flagUrl = getCountryFlagUrl(country);
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.sm;

  const fallback = (
    <Globe size={16} weight="bold" className={cn("text-blue-400 shrink-0", className)} />
  );

  return (
    <span className={cn("inline-flex items-center gap-1.5 shrink-0 align-middle", className)} title={country || undefined}>
      {flagUrl && !hasError ? (
        <img
          src={flagUrl}
          alt={country || "Flag"}
          onError={() => setHasError(true)}
          className={cn(
            "object-contain shrink-0 rounded-xs select-none shadow-2xs",
            cfg.img,
            imgClassName
          )}
          loading="lazy"
        />
      ) : (
        fallback
      )}

      {showLabel && country && (
        <span className={cn("font-medium text-foreground truncate", cfg.text)}>
          {country}
        </span>
      )}

      {isOverseas && (
        <span
          className="p-0.5 rounded bg-amber-500/20 text-amber-400 inline-flex items-center shrink-0 ml-0.5"
          title="Overseas Player"
        >
          <Airplane size={12} weight="fill" />
        </span>
      )}
    </span>
  );
};
