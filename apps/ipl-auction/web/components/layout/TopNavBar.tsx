"use client";

import React from "react";
import Link from "next/link";
import { useAuctionStore } from "../../stores/auctionStore";
import { useAuthStore } from "../../stores/authStore";
import { TeamIdentity } from "../teams/TeamIdentity";
import { UserMenu } from "../auth/UserMenu";
import { AuthModal } from "../auth/AuthModal";
import { ThemeToggle } from "./ThemeToggle";
import {
  Volume2,
  VolumeX,
  ShieldCheck,
  Radio,
  Users,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

interface TopNavBarProps {
  roomId?: string;
  roomName?: string;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  roomId,
  roomName = "IPL 2026 Auction",
}) => {
  const { voiceEnabled, setVoiceEnabled, snapshot, myFranchise } = useAuctionStore();
  const { isAdmin } = useAuthStore();
  const [copied, setCopied] = React.useState(false);

  const isLive = snapshot?.status === "LIVE";
  const connectedHumans = snapshot?.connectedHumanCount || 1;

  return (
    <header className="h-12 w-full bg-[#0a0e22] border-b border-indigo-950/80 px-3 sm:px-4 flex items-center justify-between flex-shrink-0 z-40 select-none">
      {/* Brand & Room Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-1.5 shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-[#141b3d] border border-indigo-800/60 flex items-center justify-center text-white font-black text-xs shadow-xs tracking-wider">
            IPL
          </div>
        </Link>

        {/* Divider */}
        <div className="h-5 w-[1px] bg-indigo-950/90 shrink-0" />

        {/* Room Name & LIVE badge */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight truncate max-w-[140px] sm:max-w-[220px]">
            {roomName || "IPL 2026 Mega Auction"}
          </span>

          {roomId && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(roomId);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              title="Click to copy Room Code"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#141b3d] border border-indigo-700/60 text-indigo-300 hover:text-white cursor-pointer transition-colors shrink-0"
            >
              <span>{roomId}</span>
              {copied ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 text-indigo-400" />
              )}
            </button>
          )}

          {isLive ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground shrink-0">
              {snapshot?.status || "LOBBY"}
            </span>
          )}
        </div>

        {/* Claimed Franchise */}
        {myFranchise && (
          <>
            <div className="h-5 w-[1px] bg-indigo-950/90 shrink-0 hidden xs:block" />
            <div className="hidden xs:flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">TEAM:</span>
              <TeamIdentity code={myFranchise} size="sm" />
            </div>
          </>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Human Presence Counter */}
        <div
          title={`${connectedHumans} active participants`}
          className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-300 px-2.5 py-1 rounded-xl bg-[#141b3d] border border-indigo-800/60 shadow-xs"
        >
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{connectedHumans}</span>
        </div>

        {/* Voice Toggle */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          title={voiceEnabled ? "Mute Voice Announcements" : "Enable Voice Announcements"}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {voiceEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Theme Mode Toggle */}
        <ThemeToggle />

        {/* Admin Link: Strictly visible ONLY when authenticated as Administrator */}
        {isAdmin && (
          <Link
            href="/admin/dashboard"
            title="Open Admin Dashboard"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline">Admin</span>
          </Link>
        )}

        {/* User Profile & Sign-In Menu */}
        <UserMenu />

        {/* Authentication Modal */}
        <AuthModal />
      </div>
    </header>
  );
};
