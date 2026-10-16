"use client";

import React from "react";
import { formatRupees } from "../../../lib/utils";
import { History, Trophy } from "lucide-react";

export default function AdminAuctionsPage() {
  const pastAuctions = [
    {
      id: "auc_2026_prev_01",
      name: "Season 19 Mega Auction Run",
      completedAt: Date.now() - 86400000 * 2,
      totalSpent: 11400000000,
      soldCount: 74,
      unsoldCount: 12,
      topPurchase: { player: "Cameron Green", team: "KKR", price: 235000000 },
    },
    {
      id: "auc_2026_prev_02",
      name: "Weekend Invitational Mini Auction",
      completedAt: Date.now() - 86400000 * 5,
      totalSpent: 3800000000,
      soldCount: 22,
      unsoldCount: 4,
      topPurchase: { player: "Quinton de Kock", team: "MI", price: 140000000 },
    },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Completed Auction Logs</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Historical records of concluded auctions, finalized squads, and purse allocations.
        </p>
      </div>

      <div className="space-y-3">
        {pastAuctions.map((a) => (
          <div key={a.id} className="p-4 rounded-xl border border-border/80 bg-card space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-foreground">{a.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  Concluded: {new Date(a.completedAt).toLocaleDateString()}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {formatRupees(a.totalSpent)}
                </div>
                <div className="text-[10px] text-muted-foreground">Total Purse Spent</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 px-3 rounded-lg bg-secondary/30 border border-border/50">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Sold</span>
                <div className="font-mono font-bold text-emerald-400">{a.soldCount} Players</div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Unsold</span>
                <div className="font-mono font-bold text-slate-400">{a.unsoldCount} Players</div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Top Purchase</span>
                <div className="font-mono font-bold text-foreground truncate">
                  {a.topPurchase.player} ({formatRupees(a.topPurchase.price)})
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
