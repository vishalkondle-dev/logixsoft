"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft, Search, AlertTriangle, ShieldAlert } from "lucide-react";

interface InvalidRoomErrorProps {
  roomId: string;
  errorMessage?: string;
}

export function InvalidRoomError({ roomId, errorMessage }: InvalidRoomErrorProps) {
  const router = useRouter();
  const [newRoomId, setNewRoomId] = useState("");

  const handleJoinNew = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRoomId.trim().toUpperCase();
    if (clean) {
      router.push(`/lobby/${clean}`);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-gradient-to-b from-slate-950 via-zinc-900 to-black text-foreground relative overflow-hidden select-none">
      {/* Stadium Floodlights & Ambient Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-20 right-10 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Glassmorphic Error Container */}
      <div className="relative z-10 max-w-lg w-full bg-card/85 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        {/* Third Umpire DRS / Clean Bowled Header Graphic */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          {/* Animated Glowing Ring */}
          <div className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping opacity-25" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600/20 to-amber-600/20 border-2 border-red-500/60 flex items-center justify-center shadow-lg shadow-red-500/20">
            {/* Cricket / Auction Theme Icons */}
            <div className="relative flex items-center justify-center">
              <span className="text-4xl filter drop-shadow-md">🏏</span>
              <span className="absolute -bottom-1 -right-2 text-2xl filter drop-shadow-md">🔨</span>
            </div>
          </div>
        </div>

        {/* Third Umpire Decision Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 font-mono text-xs font-black tracking-widest uppercase">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>DRS DECISION: CLEAN BOWLED!</span>
        </div>

        {/* Error Headline & Subtitle */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Pitch Not Found!
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The third umpire reviewed ultra-edge and ball tracking: room code{" "}
            <span className="inline-block px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono font-black border border-red-500/30">
              {roomId || "UNKNOWN"}
            </span>{" "}
            does not exist on the pitch or has already been retired.
          </p>
          {errorMessage && (
            <p className="text-xs text-red-400/90 italic bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-900/50">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Cricket Match Summary Card */}
        <div className="bg-secondary/40 border border-border/80 rounded-xl p-3.5 text-left text-xs space-y-1.5 font-sans">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Umpire Review</span>
            <span className="font-mono font-bold text-red-400">NO AUCTION LOTS</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Room Code Checked</span>
            <span className="font-mono font-bold text-foreground">{roomId}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Status</span>
            <span className="font-semibold text-amber-400">Unregistered or Expired</span>
          </div>
        </div>

        {/* Quick Join Another Code Form */}
        <form onSubmit={handleJoinNew} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value.toUpperCase())}
              placeholder="e.g. A1C2E3 or K4K9S1"
              maxLength={10}
              className="w-full bg-background/80 border border-border/90 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            type="submit"
            disabled={!newRoomId.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Join</span>
          </button>
        </form>

        {/* Action Buttons: Back to Pavilion & Go Back */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
            className="flex-1 py-2.5 px-4 rounded-xl border border-border/80 hover:bg-secondary/60 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <Link
            href="/"
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Back to Pavilion</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
