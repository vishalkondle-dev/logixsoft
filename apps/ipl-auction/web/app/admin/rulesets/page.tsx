"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import { formatRupees } from "../../../lib/utils";
import {
  Sliders,
  Plane,
  Edit2,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Timer,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export default function AdminRulesetsPage() {
  const [rulesets, setRulesets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    type: "MEGA",
    startingPurse: 1200000000,
    minSquad: 18,
    maxSquad: 25,
    maxOverseas: 8,
    maxRetentions: 6,
    rtmEnabled: true,
    timerSeconds: 10,
    description: "",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadRulesets = () => {
    setLoading(true);
    fetchApi<{ rulesets: any[] }>("/api/admin/rulesets")
      .then((res) => setRulesets(res.rulesets || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRulesets();
  }, []);

  const handleOpenAdd = () => {
    setEditingRule(null);
    setRuleForm({
      name: "Custom Tournament Ruleset",
      type: "CUSTOM",
      startingPurse: 1200000000,
      minSquad: 18,
      maxSquad: 25,
      maxOverseas: 8,
      maxRetentions: 6,
      rtmEnabled: true,
      timerSeconds: 10,
      description: "Custom ruleset parameters for specialized auction rooms.",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: any) => {
    setEditingRule(r);
    setRuleForm({
      name: r.name,
      type: r.type,
      startingPurse: r.startingPurse,
      minSquad: r.minSquad,
      maxSquad: r.maxSquad,
      maxOverseas: r.maxOverseas,
      maxRetentions: r.maxRetentions !== undefined ? r.maxRetentions : 6,
      rtmEnabled: r.rtmEnabled !== undefined ? r.rtmEnabled : true,
      timerSeconds: r.timerSeconds || 10,
      description: r.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await fetchApi(`/api/admin/rulesets/${editingRule.id}`, {
          method: "PUT",
          body: JSON.stringify(ruleForm),
        });
        setStatusMessage(`Updated tournament ruleset '${ruleForm.name}'.`);
      } else {
        await fetchApi("/api/admin/rulesets", {
          method: "POST",
          body: JSON.stringify(ruleForm),
        });
        setStatusMessage(`Created tournament ruleset '${ruleForm.name}'.`);
      }
      setIsModalOpen(false);
      setTimeout(() => setStatusMessage(null), 3000);
      loadRulesets();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Ruleset Definitions & Tournament Formats</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              MEGA • CLASSIC • SPRINT XI
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure purse ceilings, squad capacities, retention allowances, RTM cards, and hammer timer speeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRulesets}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Ruleset</span>
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Rulesets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rulesets.map((r) => (
          <div
            key={r.id}
            className="p-5 rounded-2xl border border-border/80 bg-card flex flex-col justify-between gap-4 shadow-sm relative overflow-hidden"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                    r.type === "MEGA"
                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                      : r.type === "CLASSIC"
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                      : r.type === "SPRINT_XI"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-secondary text-foreground border border-border"
                  }`}
                >
                  {r.type} FORMAT
                </span>

                <button
                  onClick={() => handleOpenEdit(r)}
                  className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors"
                  title="Edit Ruleset Parameters"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h2 className="font-bold text-sm text-foreground">{r.name}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {r.description}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground bg-secondary/30 p-3 rounded-xl border border-border/50">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Starting Purse</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatRupees(r.startingPurse)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Squad Capacity</span>
                <span className="font-mono font-bold text-foreground">
                  {r.minSquad} - {r.maxSquad} Players
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Overseas Player Cap</span>
                <span className="font-mono font-bold text-foreground inline-flex items-center gap-1">
                  <span>Max {r.maxOverseas}</span>
                  <Plane className="w-3 h-3 text-blue-400" />
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Retentions Allowed</span>
                <span className="font-mono font-bold text-foreground">
                  {r.maxRetentions > 0 ? `Up to ${r.maxRetentions} Players` : "0 (Disabled)"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Right to Match (RTM)</span>
                <span className={`font-mono font-bold ${r.rtmEnabled ? "text-emerald-400" : "text-slate-400"}`}>
                  {r.rtmEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Hammer Timer Speed</span>
                <span className="font-mono font-bold text-foreground inline-flex items-center gap-1">
                  <Timer className="w-3 h-3 text-amber-400" />
                  <span>{r.timerSeconds || 10} Seconds</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Ruleset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h2 className="text-base font-black">
                {editingRule ? `Edit Ruleset: ${editingRule.name}` : "Create Tournament Ruleset"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Ruleset Name</label>
                <input
                  type="text"
                  required
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Format Category</label>
                  <select
                    value={ruleForm.type}
                    onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer"
                  >
                    <option value="MEGA">MEGA (Max 6 Retentions)</option>
                    <option value="CLASSIC">CLASSIC (Up to 11 Retentions)</option>
                    <option value="SPRINT_XI">SPRINT_XI (11 Squad, No Retentions)</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Starting Purse (Rupees)</label>
                  <input
                    type="number"
                    required
                    value={ruleForm.startingPurse}
                    onChange={(e) => setRuleForm({ ...ruleForm, startingPurse: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-foreground block mb-1">Min Squad</label>
                  <input
                    type="number"
                    value={ruleForm.minSquad}
                    onChange={(e) => setRuleForm({ ...ruleForm, minSquad: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Max Squad</label>
                  <input
                    type="number"
                    value={ruleForm.maxSquad}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxSquad: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Max Overseas</label>
                  <input
                    type="number"
                    value={ruleForm.maxOverseas}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxOverseas: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-foreground block mb-1">Max Retentions</label>
                  <input
                    type="number"
                    value={ruleForm.maxRetentions}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxRetentions: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Hammer Timer (Sec)</label>
                  <input
                    type="number"
                    value={ruleForm.timerSeconds}
                    onChange={(e) => setRuleForm({ ...ruleForm, timerSeconds: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rtmEnabled"
                      checked={ruleForm.rtmEnabled}
                      onChange={(e) => setRuleForm({ ...ruleForm, rtmEnabled: e.target.checked })}
                      className="rounded border-border cursor-pointer"
                    />
                    <label htmlFor="rtmEnabled" className="text-foreground cursor-pointer font-bold">
                      RTM Cards
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  {editingRule ? "Save Ruleset" : "Create Ruleset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
