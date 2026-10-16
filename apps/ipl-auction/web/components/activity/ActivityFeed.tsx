"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { formatRupees, cn } from "../../lib/utils";
import {
  Gavel,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  UserPlus,
  Info,
  ArrowUp,
} from "lucide-react";

export const ActivityFeed: React.FC<{ className?: string }> = ({ className }) => {
  const { snapshot } = useAuctionStore();
  const events = snapshot?.recentEvents || [];

  // Filter out redundant consecutive duplicate USER_CONNECTED events for the same user and memoize
  const displayEvents = React.useMemo(() => {
    const list = [...events].reverse();
    const filtered: typeof list = [];
    let lastUserJoinedTitle: string | null = null;

    for (const evt of list) {
      if (evt.type === "USER_CONNECTED") {
        const title = (evt.title || "").trim();
        if (title && title === lastUserJoinedTitle) {
          continue; // skip duplicate consecutive join
        }
        lastUserJoinedTitle = title;
      } else {
        lastUserJoinedTitle = null;
      }
      filtered.push(evt);
    }
    return filtered;
  }, [events]);

  const [isAtTop, setIsAtTop] = useState(true);
  const [hasNewEventsAbove, setHasNewEventsAbove] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop } = scrollContainerRef.current;
    const atTop = scrollTop < 30;
    setIsAtTop(atTop);
    if (atTop) {
      setHasNewEventsAbove(false);
    }
  };

  useEffect(() => {
    if (isAtTop) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setHasNewEventsAbove(true);
    }
  }, [events.length, isAtTop]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setIsAtTop(true);
    setHasNewEventsAbove(false);
  };

  const getCompactEvent = (evt: any) => {
    switch (evt.type) {
      case "BID_ACCEPTED":
      case "BID_PLACED":
        return {
          icon: <Gavel className="w-3 h-3 text-blue-400 shrink-0" />,
          label: evt.franchiseCode || "Bid",
          sub: "bid",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      case "PLAYER_SOLD":
        return {
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />,
          label: `SOLD • ${evt.franchiseCode || ""}`,
          sub: "",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      case "PLAYER_UNSOLD":
        return {
          icon: <XCircle className="w-3 h-3 text-rose-400 shrink-0" />,
          label: "UNSOLD",
          sub: "",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      case "AUCTION_PAUSED":
        return {
          icon: <PauseCircle className="w-3 h-3 text-amber-400 shrink-0" />,
          label: "Paused",
          sub: "",
          amount: "",
        };
      case "AUCTION_RESUMED":
        return {
          icon: <PlayCircle className="w-3 h-3 text-emerald-400 shrink-0" />,
          label: "Resumed",
          sub: "",
          amount: "",
        };
      case "USER_CONNECTED": {
        let userName = "User";
        if (evt.description && evt.description.toLowerCase().includes(" joined")) {
          userName = evt.description.split(/ joined/i)[0].trim();
        } else if (evt.title && evt.title.toLowerCase().includes(" joined")) {
          userName = evt.title.replace(/ joined/i, "").trim();
        } else if (evt.title && !["User Connected", "User Joined", "Participant"].includes(evt.title)) {
          userName = evt.title.trim();
        }
        return {
          icon: <UserPlus className="w-3 h-3 text-indigo-400 shrink-0" />,
          label: `${userName} Joined`,
          sub: "",
          amount: "",
        };
      }
      default: {
        let clean = evt.title || "Event";
        if (clean.includes("Bidding opened for")) {
          clean = clean.replace("Bidding opened for ", "Lot: ");
        }
        return {
          icon: <Info className="w-3 h-3 text-slate-400 shrink-0" />,
          label: clean,
          sub: "",
          amount: evt.amount ? formatRupees(evt.amount) : "",
        };
      }
    }
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden min-h-0 relative select-none", className)}>
      {/* Floating Scroll-to-Top Indicator */}
      {!isAtTop && hasNewEventsAbove && (
        <button
          onClick={scrollToTop}
          className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full shadow-lg hover:opacity-95 transition-all z-20 cursor-pointer animate-bounce"
        >
          <ArrowUp className="w-3 h-3" />
          <span>New activity</span>
        </button>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5 scrollbar-thin"
      >
        {displayEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground text-xs italic">
            No auction activity recorded yet.
          </div>
        ) : (
          displayEvents.map((evt, idx) => {
            const item = getCompactEvent(evt);
            return (
              <div
                key={evt.id ? `${evt.id}_${idx}` : `seq_${evt.sequence}_${idx}`}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#0e142c]/80 hover:bg-[#141b3d] border border-indigo-950/70 text-xs transition-colors"
              >
                {/* Left: Icon + Label/Team */}
                <div className="flex items-center gap-2 min-w-0">
                  {item.icon}
                  {evt.franchiseCode && (
                    <img
                      src={`/jerseys/${evt.franchiseCode.toLowerCase()}_logo.png`}
                      alt={evt.franchiseCode}
                      className="w-4 h-4 object-contain shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  )}
                  <span className="font-bold text-slate-200 truncate">
                    {item.label}
                  </span>
                  {item.sub && (
                    <span className="text-[11px] text-slate-400 hidden xs:inline">
                      {item.sub}
                    </span>
                  )}
                </div>

                {/* Right: Amount */}
                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                  {item.amount && (
                    <span className="font-bold text-emerald-400">
                      {item.amount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
