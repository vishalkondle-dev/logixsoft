"use client";

import React, { useEffect, useState } from "react";
import { RTMState, FranchiseState } from "../../lib/types";
import { formatRupees, cn } from "../../lib/utils";
import { Zap, Clock, Shield, Plane, AlertCircle } from "lucide-react";

interface RTMDecisionPromptProps {
  rtmState: RTMState;
  myFranchise: string | null;
  myFranchiseState?: FranchiseState;
  onDecideRtm: (exercise: boolean) => void;
}

export const RTMDecisionPrompt: React.FC<RTMDecisionPromptProps> = ({
  rtmState,
  myFranchise,
  myFranchiseState,
  onDecideRtm,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);
  const isMyDecision = myFranchise === rtmState.eligibleFranchise;
  const hasAutoDeclinedRef = React.useRef(false);

  useEffect(() => {
    hasAutoDeclinedRef.current = false;
  }, [rtmState.lotId]);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((rtmState.timerDeadline - now) / 1000));
      setSecondsRemaining(diff);
      if (diff === 0 && isMyDecision && !hasAutoDeclinedRef.current) {
        hasAutoDeclinedRef.current = true;
        onDecideRtm(false);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 250);
    return () => clearInterval(timer);
  }, [rtmState.timerDeadline, isMyDecision, onDecideRtm]);

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / 10) * 100));

  // Human user must make the decision
  if (isMyDecision) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-card border-2 border-amber-500/80 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ring-4 ring-amber-500/20">
          {/* Top urgency banner */}
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 px-5 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 fill-current animate-pulse text-yellow-300" />
              <span className="font-black text-sm tracking-wide uppercase">Right to Match (RTM) Opportunity</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-bold text-xs bg-black/30 px-2.5 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5 text-yellow-300" />
              <span>{secondsRemaining}s</span>
            </div>
          </div>

          {/* Progress countdown bar */}
          <div className="w-full bg-secondary h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-200 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col gap-5 text-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Your Former Player
              </div>
              <h2 className="text-2xl font-black text-foreground flex items-center justify-center gap-2">
                <span>{rtmState.playerName}</span>
                {rtmState.isOverseas && (
                  <span className="p-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center" title="Overseas Player">
                    <Plane className="w-3.5 h-3.5 fill-current" />
                  </span>
                )}
              </h2>
              <div className="text-xs text-muted-foreground mt-1">
                Role: <strong className="text-foreground">{rtmState.playerRole.replace(/_/g, " ")}</strong>
              </div>
            </div>

            {/* Bid info box */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">
                Hammer closed with highest bid by <strong className="text-foreground">{rtmState.highestBidderFranchise}</strong>
              </div>
              <div className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
                {formatRupees(rtmState.finalBidAmount)}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>
                  Match this exact amount to immediately retain {rtmState.playerName} for your franchise!
                </span>
              </div>
            </div>

            {/* Purse & cards remaining status */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/60 text-left">
                <div className="text-[10px] text-muted-foreground">Your Remaining Purse</div>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatRupees(myFranchiseState?.remainingPurse || 0)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/60 text-left">
                <div className="text-[10px] text-muted-foreground">RTM Cards Remaining</div>
                <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  {myFranchiseState?.rtmCardsRemaining || 1} Cards
                </div>
              </div>
            </div>

            {/* Decision Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => onDecideRtm(false)}
                className="py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all cursor-pointer hover:border-border/80"
              >
                Decline RTM
              </button>

              <button
                type="button"
                onClick={() => onDecideRtm(true)}
                className="py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 fill-current text-yellow-300" />
                <span>Match & Retain</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Spectator / Other team view: Informative notification banner
  return (
    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-foreground flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black text-xs shrink-0 border border-amber-500/40">
          RTM
        </div>
        <div className="min-w-0 text-xs">
          <div className="font-bold flex items-center gap-1.5 flex-wrap">
            <span className="text-amber-700 dark:text-amber-400">{rtmState.eligibleFranchise}</span>
            <span>evaluating Right to Match (RTM) for</span>
            <span className="underline font-black">{rtmState.playerName}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Matching price: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatRupees(rtmState.finalBidAmount)}</strong> (bid by {rtmState.highestBidderFranchise})
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-1 rounded bg-black/40 text-amber-300 shrink-0">
        <Clock className="w-3.5 h-3.5 animate-spin" />
        <span>{secondsRemaining > 0 ? `${secondsRemaining}s` : "Resolving..."}</span>
      </div>
    </div>
  );
};
