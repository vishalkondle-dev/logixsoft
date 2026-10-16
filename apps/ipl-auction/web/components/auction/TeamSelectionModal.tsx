"use client";

import React from "react";
import { FranchiseState } from "../../lib/types";
import { TeamIdentity } from "../teams/TeamIdentity";
import { formatRupees, cn } from "../../lib/utils";
import { X, Shield, Bot, User, Lock, CheckCircle2 } from "lucide-react";

interface TeamSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Record<string, FranchiseState>;
  onSelectTeam: (franchiseCode: string) => void;
  nextLegalBid?: number;
}

export const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({
  isOpen,
  onClose,
  teams,
  onSelectTeam,
  nextLegalBid,
}) => {
  if (!isOpen) return null;

  const teamsList = Object.values(teams || {});

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-secondary/30 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Select Franchise to Bid</h2>
              <p className="text-xs text-muted-foreground">
                Choose an available AI bot team to take over and start placing bids.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Franchises Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {teamsList.map((team) => {
              const isAi = team.controller === "AI";
              const isHuman = team.controller === "HUMAN";
              const canAfford = nextLegalBid ? team.remainingPurse >= nextLegalBid : true;

              return (
                <div
                  key={team.code}
                  className={cn(
                    "p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all",
                    isAi
                      ? "bg-secondary/30 border-border hover:border-primary/50 hover:bg-secondary/50"
                      : "bg-secondary/10 border-border/50 opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TeamIdentity code={team.code} size="md" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">
                          {team.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{team.squadCount}/{team.maxSquad} Squad</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatRupees(team.remainingPurse)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isAi ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          <Bot className="w-2.5 h-2.5" />
                          <span>Bot Available</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Occupied</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {isAi ? "Available to claim immediately" : `Controlled by ${team.humanDisplayName || "Human"}`}
                    </span>

                    {isAi ? (
                      <button
                        onClick={() => {
                          onSelectTeam(team.code);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Take Over</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-secondary text-muted-foreground cursor-not-allowed border border-border/60"
                      >
                        Unavailable
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border/80 bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
          <span>Only AI-controlled teams can be claimed.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors cursor-pointer font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
