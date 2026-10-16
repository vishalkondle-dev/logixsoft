import React from "react";
import { cn } from "../../lib/utils";

interface TeamAverageRatingProps {
  rating: number | null;
  playerCount: number;
  playersRating?: number | null;
  squadBalanceRating?: number | null;
  purseBalanceRating?: number | null;
  className?: string;
}

export const TeamAverageRating: React.FC<TeamAverageRatingProps> = ({
  rating,
  playerCount,
  playersRating,
  squadBalanceRating,
  purseBalanceRating,
  className,
}) => {
  // Rule: Do not display rating until >= 2 players owned
  if (playerCount < 2 || rating === null) {
    return (
      <span
        title="Squad rating calculates after 2 purchases"
        className={cn("text-[10px] text-muted-foreground/70 italic select-none", className)}
      >
        --
      </span>
    );
  }

  // Tier color styling
  const colorClass =
    rating >= 85
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
      : rating >= 75
      ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";

  const tooltip = playersRating !== undefined && playersRating !== null
    ? `Overall Team Score: ${rating.toFixed(1)} ★ [Player Stats: ${playersRating.toFixed(1)} | Squad Balance: ${squadBalanceRating ?? 100}% | Purse Health: ${purseBalanceRating ?? 100}%]`
    : `Overall Team Score: ${rating.toFixed(1)} ★ (${playerCount} players)`;

  return (
    <div
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold border tabular-nums shadow-xs select-none",
        colorClass,
        className
      )}
    >
      <span className="text-[9px] uppercase font-semibold tracking-tighter opacity-80">SCORE</span>
      <span>{rating.toFixed(1)}</span>
    </div>
  );
};
