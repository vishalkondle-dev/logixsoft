"use client";

import React from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { Users, Gavel, BarChart2 } from "lucide-react";
import { cn } from "../../lib/utils";

export const MobileBottomNav: React.FC = () => {
  const {
    activeMobileTab,
    setActiveMobileTab,
    unreadChatCount,
    unreadActivityCount,
  } = useAuctionStore();

  const totalUnread = unreadChatCount + unreadActivityCount;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b1a] border-t border-indigo-950/80 px-4 py-1 flex items-center justify-around select-none shadow-2xl pb-[env(safe-area-inset-bottom,0.5rem)]">
      {/* TEAMS */}
      <button
        onClick={() => setActiveMobileTab("teams")}
        className={cn(
          "flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer",
          activeMobileTab === "teams"
            ? "text-indigo-400 bg-[#141838] border-t-2 border-indigo-500 rounded-t-xl shadow-[0_-4px_16px_rgba(99,102,241,0.25)]"
            : "text-slate-400 hover:text-white"
        )}
      >
        <Users className="w-5 h-5 stroke-[2.2]" />
        <span>Teams</span>
      </button>

      {/* AUCTION (Default Active) */}
      <button
        onClick={() => setActiveMobileTab("auction")}
        className={cn(
          "flex flex-col items-center gap-1 py-1.5 px-7 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer relative",
          activeMobileTab === "auction"
            ? "text-indigo-400 bg-[#181d3d] border-t-2 border-indigo-500 rounded-t-xl shadow-[0_-4px_16px_rgba(99,102,241,0.3)]"
            : "text-slate-400 hover:text-white"
        )}
      >
        <Gavel className="w-5 h-5 stroke-[2.2]" />
        <span>Auction</span>
      </button>

      {/* ACTIVITY & CHAT */}
      <button
        onClick={() => setActiveMobileTab("activity")}
        className={cn(
          "flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-200 cursor-pointer relative",
          activeMobileTab === "activity"
            ? "text-indigo-400 bg-[#141838] border-t-2 border-indigo-500 rounded-t-xl shadow-[0_-4px_16px_rgba(99,102,241,0.25)]"
            : "text-slate-400 hover:text-white"
        )}
      >
        <div className="relative">
          <BarChart2 className="w-5 h-5 stroke-[2.2]" />
          {totalUnread > 0 && activeMobileTab !== "activity" && (
            <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-red-500 text-white font-mono text-[9px] font-black leading-none animate-pulse">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </div>
        <span>Activity</span>
      </button>
    </nav>
  );
};
