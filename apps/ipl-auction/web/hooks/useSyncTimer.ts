"use client";

import { useState, useEffect } from "react";

export function useSyncTimer(timerDeadline: number | null, serverOffset = 0) {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!timerDeadline) return 0;
    const now = Date.now() + serverOffset;
    return Math.max(0, timerDeadline - now);
  });

  useEffect(() => {
    if (!timerDeadline) {
      setRemainingMs(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now() + serverOffset;
      const left = Math.max(0, timerDeadline - now);
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [timerDeadline, serverOffset]);

  const totalDuration = 10000;
  const percentage = Math.max(0, Math.min(100, (remainingMs / totalDuration) * 100));
  const secondsLeft = Math.ceil(remainingMs / 1000);

  return {
    remainingMs,
    secondsLeft,
    percentage,
    isUrgent: remainingMs > 0 && remainingMs <= 3000,
    isExpired: remainingMs === 0,
  };
}
