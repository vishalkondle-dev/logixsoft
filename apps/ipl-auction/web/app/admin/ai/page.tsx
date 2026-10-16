"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import { formatRupees } from "../../../lib/utils";
import {
  Bot,
  Sparkles,
  Sliders,
  CheckCircle2,
  Play,
  Activity,
  Cpu,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function AdminAIPage() {
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [difficulty, setDifficulty] = useState("normal");
  const [clefFlashEnabled, setClefFlashEnabled] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Simulation state
  const [simFranchise, setSimFranchise] = useState("CSK");
  const [simPlayerId, setSimPlayerId] = useState("");
  const [simBid, setSimBid] = useState(20000000);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchApi<any>("/api/admin/ai"),
      fetchApi<{ players: any[] }>("/api/admin/players"),
    ])
      .then(([aiRes, playerRes]) => {
        setAiConfig(aiRes);
        if (aiRes.difficulty) setDifficulty(aiRes.difficulty);
        if (aiRes.clefFlashEnabled !== undefined) setClefFlashEnabled(aiRes.clefFlashEnabled);
        const playerList = playerRes.players || [];
        setPlayers(playerList);
        if (playerList.length > 0 && !simPlayerId) {
          setSimPlayerId(playerList[0].id);
          setSimBid(playerList[0].basePrice);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    try {
      await fetchApi("/api/admin/ai", {
        method: "POST",
        body: JSON.stringify({
          difficulty,
          clefFlashEnabled,
        }),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const res = await fetchApi<{ simulation: any }>("/api/admin/ai/simulate", {
        method: "POST",
        body: JSON.stringify({
          franchiseCode: simFranchise,
          playerId: simPlayerId,
          nextBid: simBid,
          difficulty,
        }),
      });
      setSimResult(res.simulation);
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Cloudflare Clef-Flash AI Inference Engine</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
              WORKERS AI • MULTI-CHOICE HEAD
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tune typed decision parameters, inspect 10-franchise tactical profiles, and test live valuation scenarios.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global AI Engine Settings */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <div className="text-sm font-bold text-foreground">Active Model Architecture</div>
            <div className="text-xs text-muted-foreground font-mono">
              @cf/cloudflare/clef-flash (Typed Decision Engine + Heuristic Fallback)
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            JEV SPEC COMPATIBLE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-bold text-foreground block mb-1">
              Global AI Difficulty Profile
            </label>
            <p className="text-muted-foreground text-[11px] mb-2">
              Influences valuation discipline, planning, and role scarcity prioritization across all 10 bots.
            </p>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer text-xs"
            >
              <option value="easy">Easy (Conservative valuation ceilings, relaxed bidding)</option>
              <option value="normal">Normal (Realistic squad balancing & authentic IPL market valuation)</option>
              <option value="hard">Hard (Aggressive counter-bidding & ruthless star targeting)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-foreground block mb-1">
              Cloudflare Workers AI Runtime
            </label>
            <p className="text-muted-foreground text-[11px] mb-2">
              Toggle live inference vs deterministic heuristic calculation.
            </p>
            <select
              value={clefFlashEnabled ? "true" : "false"}
              onChange={(e) => setClefFlashEnabled(e.target.value === "true")}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer text-xs"
            >
              <option value="true">Enabled (Use Cloudflare Workers AI @cf/cloudflare/clef-flash)</option>
              <option value="false">Disabled (Fallback to Deterministic Heuristic Engine Only)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border/60">
          {isSaved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> AI Engine configuration updated
            </span>
          )}
          <button
            onClick={handleSaveConfig}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            Save AI Settings
          </button>
        </div>
      </div>

      {/* Interactive AI Valuation Simulator */}
      <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span>Interactive AI Valuation Simulator</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Test in real time how any AI franchise evaluates a specific player at any bid amount.
        </p>

        <form onSubmit={handleRunSimulation} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="font-bold text-foreground block mb-1">Target Franchise</label>
            <select
              value={simFranchise}
              onChange={(e) => setSimFranchise(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground cursor-pointer"
            >
              <option value="CSK">CSK (Chennai Super Kings)</option>
              <option value="MI">MI (Mumbai Indians)</option>
              <option value="RCB">RCB (Royal Challengers)</option>
              <option value="KKR">KKR (Kolkata Knight Riders)</option>
              <option value="SRH">SRH (Sunrisers Hyderabad)</option>
              <option value="DC">DC (Delhi Capitals)</option>
              <option value="RR">RR (Rajasthan Royals)</option>
              <option value="GT">GT (Gujarat Titans)</option>
              <option value="LSG">LSG (Lucknow Super Giants)</option>
              <option value="PBKS">PBKS (Punjab Kings)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-foreground block mb-1">Target Player</label>
            <select
              value={simPlayerId}
              onChange={(e) => {
                setSimPlayerId(e.target.value);
                const pl = players.find((p) => p.id === e.target.value);
                if (pl) setSimBid(pl.basePrice);
              }}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground cursor-pointer"
            >
              {players.slice(0, 100).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role} • OVR: {p.hiddenRatingOverall} • ₹{p.basePrice / 10000000} Cr)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-foreground block mb-1">Test Bid (Rupees)</label>
            <input
              type="number"
              step="500000"
              value={simBid}
              onChange={(e) => setSimBid(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border font-mono text-foreground"
            />
          </div>

          <div className="sm:col-span-4 flex justify-end pt-1">
            <button
              type="submit"
              disabled={simulating}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Simulate Valuation Decision</span>
            </button>
          </div>
        </form>

        {/* Simulation Output Card */}
        {simResult && (
          <div className="p-4 rounded-xl bg-card border border-border text-xs space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="font-bold text-foreground text-sm flex items-center gap-2">
                <span>Outcome:</span>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-black ${
                    simResult.willBid
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-red-500/20 text-red-400 border border-red-500/40"
                  }`}
                >
                  {simResult.willBid ? "RAISE PADDLE (WILL BID)" : "PASS (DO NOT BID)"}
                </span>
              </div>
              <div className="text-muted-foreground font-mono text-[11px]">
                Test Bid: {formatRupees(simResult.testBid)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 px-3 rounded-lg bg-secondary/30 border border-border/50">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Valuation Ceiling</span>
                <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                  {formatRupees(simResult.valuationCeiling)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Squad Need Factor</span>
                <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                  {simResult.squadNeedFactor.toFixed(2)}×
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Role Need Factor</span>
                <div className="font-mono font-bold text-purple-400 text-sm mt-0.5">
                  {simResult.roleNeedFactor.toFixed(2)}×
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed font-mono">
              {simResult.reason}
            </p>
          </div>
        )}
      </div>

      {/* 10 Franchise Tactical Profiles Overview */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border/80">
          <h2 className="text-sm font-bold text-foreground">10 Franchise Tactical AI Matrices</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggression multipliers, role preference weights, and maximum purse ratios per star player.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase text-[10px] font-bold tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-4">Franchise</th>
                <th className="py-2.5 px-3">Aggression</th>
                <th className="py-2.5 px-4">Role Multipliers (Bat / Bowl / AR / WK)</th>
                <th className="py-2.5 px-3 text-right">Max Single Star Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {aiConfig?.franchiseProfiles &&
                Object.entries(aiConfig.franchiseProfiles).map(([code, p]: [string, any]) => (
                  <tr key={code} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-foreground">{code}</td>
                    <td className="py-2.5 px-3 font-bold text-purple-400">{p.aggression}×</td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      BAT: {p.rolePriority?.BATTER || 1.1}× • BOWL: {p.rolePriority?.BOWLER || 1.1}× • AR: {p.rolePriority?.ALL_ROUNDER || 1.15}× • WK: {p.rolePriority?.WICKETKEEPER || 1.05}×
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                      {(p.maxPurseRatioPerPlayer * 100).toFixed(0)}% (₹{(p.maxPurseRatioPerPlayer * 120).toFixed(1)} Cr)
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
