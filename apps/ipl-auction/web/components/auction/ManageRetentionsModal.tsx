"use client";

import React, { useState, useEffect } from "react";
import {
  OFFICIAL_FRANCHISE_RETENTIONS,
  calculateRetentionDeduction,
  RetainedCandidate,
} from "../../lib/retentions";
import { formatRupees, cn } from "../../lib/utils";
import { X, Check, Shield, AlertTriangle, Plane, Layers } from "lucide-react";
import { FranchiseState } from "../../lib/types";
import { CountryFlag } from "../common/CountryFlag";

interface ManageRetentionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchiseCode: string;
  franchiseState?: FranchiseState;
  onSaveRetentions: (franchiseCode: string, playerIds: string[]) => void;
  ruleset?: "MEGA" | "CLASSIC" | "SPRINT_XI";
}

export const ManageRetentionsModal: React.FC<ManageRetentionsModalProps> = ({
  isOpen,
  onClose,
  franchiseCode,
  franchiseState,
  onSaveRetentions,
  ruleset = "MEGA",
}) => {
  const isMega = ruleset === "MEGA";
  const config = OFFICIAL_FRANCHISE_RETENTIONS[franchiseCode];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize selected IDs from current franchiseState retained players or defaultRetainedIds
  useEffect(() => {
    if (franchiseState && Array.isArray(franchiseState.retainedPlayers)) {
      setSelectedIds(franchiseState.retainedPlayers.map((p) => p.id));
    } else if (config) {
      if (isMega) {
        let capped = 0;
        let uncapped = 0;
        const initial: string[] = [];
        for (const id of config.defaultRetainedIds) {
          if (initial.length >= 6) break;
          const cand = config.candidates.find((c) => c.id === id);
          if (!cand) continue;
          if (cand.isCapped && capped < 5) {
            capped++;
            initial.push(cand.id);
          } else if (!cand.isCapped && uncapped < 2) {
            uncapped++;
            initial.push(cand.id);
          }
        }
        setSelectedIds(initial);
      } else {
        setSelectedIds(config.defaultRetainedIds.slice(0, 11));
      }
    }
  }, [franchiseState, config, isOpen, isMega]);

  if (!isOpen || !config) return null;

  const candidates = config.candidates;
  const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));
  const cappedSelected = selectedCandidates.filter((c) => c.isCapped);
  const uncappedSelected = selectedCandidates.filter((c) => !c.isCapped);

  const maxAllowed = isMega ? 6 : 11;
  const maxOverseas = franchiseState?.maxOverseas || 8;
  const overseasSelected = selectedCandidates.filter((c) => c.isOverseas);

  const { totalDeduction, rtmCards } = calculateRetentionDeduction(selectedCandidates, ruleset);
  const totalPurse = franchiseState?.totalPurse || 1200000000;
  const remainingPurse = Math.max(0, totalPurse - totalDeduction);

  const handleToggle = (candidate: RetainedCandidate) => {
    setErrorMsg(null);
    const isSelected = selectedIds.includes(candidate.id);

    if (isSelected) {
      setSelectedIds((prev) => prev.filter((id) => id !== candidate.id));
    } else {
      if (selectedIds.length >= maxAllowed) {
        setErrorMsg(isMega ? "Mega Auction allows a maximum of 6 retentions." : "Classic Auction allows a maximum of 11 retentions.");
        return;
      }
      if (isMega) {
        if (candidate.isCapped && cappedSelected.length >= 5) {
          setErrorMsg("Mega Auction allows a maximum of 5 capped retentions.");
          return;
        }
        if (!candidate.isCapped && uncappedSelected.length >= 2) {
          setErrorMsg("Mega Auction allows a maximum of 2 uncapped retentions.");
          return;
        }
      }
      if (candidate.isOverseas && overseasSelected.length >= maxOverseas) {
        setErrorMsg(`Maximum ${maxOverseas} overseas retentions allowed.`);
        return;
      }
      setSelectedIds((prev) => [...prev, candidate.id]);
    }
  };

  const handleSave = () => {
    if (selectedIds.length > maxAllowed) {
      setErrorMsg(`Cannot exceed ${maxAllowed} retentions.`);
      return;
    }
    if (isMega) {
      if (cappedSelected.length > 5) {
        setErrorMsg("Cannot exceed 5 capped retentions in Mega Auction.");
        return;
      }
      if (uncappedSelected.length > 2) {
        setErrorMsg("Cannot exceed 2 uncapped retentions in Mega Auction.");
        return;
      }
    }
    if (overseasSelected.length > maxOverseas) {
      setErrorMsg(`Cannot exceed ${maxOverseas} overseas retentions.`);
      return;
    }
    onSaveRetentions(franchiseCode, selectedIds);
    onClose();
  };

  const handleResetToDefault = () => {
    if (isMega) {
      let capped = 0;
      let uncapped = 0;
      const initial: string[] = [];
      for (const id of config.defaultRetainedIds) {
        if (initial.length >= 6) break;
        const cand = config.candidates.find((c) => c.id === id);
        if (!cand) continue;
        if (cand.isCapped && capped < 5) {
          capped++;
          initial.push(cand.id);
        } else if (!cand.isCapped && uncapped < 2) {
          uncapped++;
          initial.push(cand.id);
        }
      }
      setSelectedIds(initial);
    } else {
      setSelectedIds(config.defaultRetainedIds.slice(0, 11));
    }
    setErrorMsg(null);
  };

  const handleClearAll = () => {
    setSelectedIds([]);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center font-black text-xs">
              RTM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Manage {franchiseCode} Retentions & RTM
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase">
                  {isMega ? "Mega (Max 6)" : "Classic (Max 11)"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isMega
                  ? "Mega Auction: max 6 retentions (up to 5 capped, 2 uncapped) with ₹18, 14, 11, 18, 14 Cr slabs."
                  : "Classic Auction: up to 11 squad retentions permitted using official contracts and ₹120 Cr purse."}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Rule & Purse Dashboard */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-secondary/20 border-b border-border/60 text-center">
          <div className="p-2 rounded-xl bg-card/60 border border-border/60">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">Retained Players</div>
            <div className="text-sm font-bold text-foreground mt-0.5">
              {selectedIds.length} / {maxAllowed}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">
                ({cappedSelected.length} Capped, {uncappedSelected.length} Uncapped)
              </span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-card/60 border border-border/60">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">Retention Cost</div>
            <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {formatRupees(totalDeduction)}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-card/60 border border-border/60">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">RTM Cards Available</div>
            <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
              <span>{rtmCards} Cards</span>
            </div>
          </div>
        </div>

        {/* Rules Reminder Notice */}
        <div className="px-5 py-2 bg-amber-500/5 border-b border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isMega
                ? "Slabs: 1st Capped ₹18 Cr • 2nd ₹14 Cr • 3rd ₹11 Cr • 4th ₹18 Cr • 5th ₹14 Cr • Uncapped ₹4 Cr each"
                : "Official Contracts: Deducted directly from franchise starting purse of ₹120 Cr"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-[10px] underline hover:text-amber-700 dark:hover:text-amber-300 font-semibold cursor-pointer"
            >
              Reset Official
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] underline hover:text-amber-700 dark:hover:text-amber-300 font-semibold cursor-pointer"
            >
              Clear All ({isMega ? "6" : "6"} RTMs)
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Candidates List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {candidates.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <div
                key={c.id}
                onClick={() => handleToggle(c)}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none",
                  isSelected
                    ? "border-primary/80 bg-primary/10 shadow-xs ring-1 ring-primary/40"
                    : "border-border/60 bg-secondary/20 hover:bg-secondary/40"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border bg-card text-transparent"
                    )}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate">{c.name}</span>
                      {c.isOverseas && (
                        <span className="p-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center" title="Overseas Player">
                          <Plane className="w-2.5 h-2.5 fill-current" />
                        </span>
                      )}
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.2 rounded border",
                        c.isCapped
                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      )}>
                        {c.isCapped ? "CAPPED" : "UNCAPPED"}
                      </span>
                    </div>

                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{c.role.replace(/_/g, " ")}</span>
                      <span>•</span>
                      <CountryFlag country={c.country} size="xs" />
                      <span>{c.country}</span>
                      <span>•</span>
                      <span>{c.matches} IPL Matches ({c.runs} Runs, {c.wickets} Wkts)</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-foreground">
                    {formatRupees(c.officialPrice)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Official Slab</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/80 bg-secondary/30 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Remaining Auction Purse: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatRupees(remainingPurse)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all cursor-pointer"
            >
              Save Retentions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
