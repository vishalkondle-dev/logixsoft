"use client";

import React, { useEffect, useRef } from "react";
import { useSyncTimer } from "../../hooks/useSyncTimer";
import { cn } from "../../lib/utils";
import { Timer, AlertTriangle } from "lucide-react";

interface TimerDisplayProps {
  timerDeadline: number | null;
  serverOffset?: number;
  isPaused?: boolean;
  compact?: boolean;
  className?: string;
}

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

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  timerDeadline,
  serverOffset = 0,
  isPaused = false,
  compact = false,
  className,
}) => {
  const { secondsLeft, remainingMs, percentage, isUrgent, isExpired } = useSyncTimer(
    isPaused ? null : timerDeadline,
    serverOffset
  );

  const lastTickedSecondRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused || !timerDeadline || remainingMs <= 0) {
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
  }, [secondsLeft, isPaused, timerDeadline, remainingMs]);

  return (
    <div className={cn("w-full flex flex-col gap-1", compact ? "gap-0.5" : "gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs font-semibold px-0.5">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Timer className={cn("text-primary", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
          {!compact && (
            <span className="uppercase tracking-wider text-[11px] font-bold">
              {isPaused ? "Countdown Paused" : "Hammer Countdown"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isUrgent && !isPaused && (
            <AlertTriangle className={cn("text-red-500 animate-pulse-fast", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
          )}
          <span
            className={cn(
              "font-mono font-black tabular-nums transition-colors",
              compact ? "text-xs" : "text-sm",
              isPaused
                ? "text-amber-600 dark:text-amber-400"
                : isUrgent
                ? "text-red-500 animate-pulse-fast"
                : "text-foreground"
            )}
          >
            {isPaused ? "PAUSED" : `${secondsLeft}s`}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className={cn("w-full bg-slate-200 dark:bg-secondary/80 rounded-full overflow-hidden p-0.5 border border-slate-300/80 dark:border-border/50", compact ? "h-1.5" : "h-2")}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-75 ease-linear",
            isPaused
              ? "bg-amber-400"
              : isUrgent
              ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
              : percentage > 50
              ? "bg-blue-500"
              : "bg-amber-500"
          )}
          style={{ width: `${isPaused ? 50 : percentage}%` }}
        />
      </div>
    </div>
  );
};
