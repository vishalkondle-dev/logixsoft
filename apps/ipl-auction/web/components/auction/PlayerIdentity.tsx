import React from "react";
import { cn } from "../../lib/utils";
import { PlayerRole } from "../../lib/types";
import { Plane } from "lucide-react";

interface PlayerIdentityProps {
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PlayerIdentity: React.FC<PlayerIdentityProps> = ({
  name,
  role,
  country,
  isOverseas,
  size = "md",
  className,
}) => {
  // Extract initials (e.g. Cameron Green -> CG)
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const roleGradients: Record<PlayerRole, string> = {
    BATTER: "from-blue-600 via-indigo-700 to-sky-900 border-blue-400/40 text-blue-100",
    BOWLER: "from-emerald-600 via-teal-700 to-green-900 border-emerald-400/40 text-emerald-100",
    ALL_ROUNDER: "from-amber-600 via-orange-700 to-yellow-900 border-amber-400/40 text-amber-100",
    WICKETKEEPER: "from-purple-600 via-fuchsia-700 to-violet-900 border-purple-400/40 text-purple-100",
  };

  const gradient = roleGradients[role] || "from-slate-700 to-slate-900 border-slate-500 text-slate-100";

  const sizeClasses = {
    sm: "w-8 h-8 text-xs font-bold rounded",
    md: "w-14 h-14 text-base font-black rounded-lg shadow-md",
    lg: "w-20 h-20 text-2xl font-black rounded-xl shadow-lg",
  }[size];

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center select-none bg-gradient-to-br border flex-shrink-0 tracking-wider shadow-inner",
        gradient,
        sizeClasses,
        className
      )}
    >
      <span>{initials}</span>

      {isOverseas && size !== "sm" && (
        <span
          title="Overseas Player"
          className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 p-1 rounded-full shadow-md border border-amber-300 select-none flex items-center justify-center"
        >
          <Plane className={size === "lg" ? "w-3 h-3 fill-current" : "w-2.5 h-2.5 fill-current"} />
        </span>
      )}
    </div>
  );
};
