"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuctionStore } from "../../stores/auctionStore";
import { TeamIdentity } from "../teams/TeamIdentity";
import { Send, ArrowDown, Wifi, WifiOff } from "lucide-react";
import { cn } from "../../lib/utils";

interface LiveChatProps {
  onSendMessage: (text: string) => void;
  isConnected: boolean;
  className?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({
  onSendMessage,
  isConnected,
  className,
}) => {
  const { snapshot, myFranchise, resetUnreadChat } = useAuctionStore();
  const [inputText, setInputText] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessagesAbove, setHasNewMessagesAbove] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const messages = snapshot?.recentChat || [];

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewMessagesAbove(false);
      resetUnreadChat();
    }
  };

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setHasNewMessagesAbove(true);
    }
  }, [messages.length, isAtBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setHasNewMessagesAbove(false);
    resetUnreadChat();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected) return;
    onSendMessage(inputText.trim());
    setInputText("");
    setIsAtBottom(true);
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden min-h-0 relative", className)}>
      {/* Scrollable Messages Region */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2.5"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs italic">
            No chat messages yet. Send a message to the room!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-1.5">
                {msg.franchiseCode ? (
                  <TeamIdentity code={msg.franchiseCode} size="sm" />
                ) : (
                  <div className="w-5 h-5 rounded bg-secondary font-bold text-[10px] flex items-center justify-center text-muted-foreground select-none">
                    {msg.displayName[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <span className="font-bold text-foreground text-[11px] truncate">
                  {msg.displayName}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <div className="pl-6.5">
                <div className="inline-block px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-secondary/70 border border-slate-200 dark:border-border/50 text-foreground text-xs leading-relaxed break-words max-w-[90%] shadow-2xs">
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* New Message Floating Pill Indicator */}
      {hasNewMessagesAbove && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-lg animate-bounce cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>New messages</span>
        </button>
      )}

      {/* Sticky Message Input Footer */}
      <form
        onSubmit={handleSend}
        className="p-2 border-t border-border/80 bg-card flex items-center gap-1.5 flex-shrink-0"
      >
        <div className="flex items-center pl-1 text-muted-foreground" title={isConnected ? "WebSocket Connected" : "Connecting..."}>
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
          )}
        </div>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isConnected ? "Type message... (Enter to send)" : "Connecting to room..."}
          disabled={!isConnected}
          maxLength={300}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-secondary/50 border border-border/80 focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || !isConnected}
          className="p-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
