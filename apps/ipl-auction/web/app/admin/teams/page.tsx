"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import { formatRupees } from "../../../lib/utils";
import { TeamIdentity } from "../../../components/teams/TeamIdentity";
import {
  Shield,
  Edit2,
  Sliders,
  CheckCircle2,
  X,
  Bot,
  Sparkles,
  Plane,
  RefreshCw,
} from "lucide-react";

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadTeams = () => {
    setLoading(true);
    fetchApi<{ teams: any[] }>("/api/admin/teams")
      .then((res) => setTeams(res.teams || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleOpenEdit = (t: any) => {
    setEditingTeam(t);
    setEditForm({
      name: t.name,
      shortName: t.shortName,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      defaultPurse: t.defaultPurse,
      minSquad: t.minSquad,
      maxSquad: t.maxSquad,
      maxOverseas: t.maxOverseas,
      aiProfile: {
        aggression: t.aiProfile?.aggression || 1.06,
        maxPurseRatioPerPlayer: t.aiProfile?.maxPurseRatioPerPlayer || 0.2,
        rolePriority: {
          BATTER: t.aiProfile?.rolePriority?.BATTER || 1.1,
          BOWLER: t.aiProfile?.rolePriority?.BOWLER || 1.1,
          ALL_ROUNDER: t.aiProfile?.rolePriority?.ALL_ROUNDER || 1.15,
          WICKETKEEPER: t.aiProfile?.rolePriority?.WICKETKEEPER || 1.05,
        },
      },
    });
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    try {
      await fetchApi(`/api/admin/teams/${editingTeam.code}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      setStatusMessage(`Updated franchise configuration for '${editingTeam.code}'.`);
      setEditingTeam(null);
      setTimeout(() => setStatusMessage(null), 3000);
      loadTeams();
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
            <span>Franchise Configurations & Tactical Profiles</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              10 OFFICIAL TEAMS
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure starting purse caps, squad boundaries, overseas allocations, and AI bidding aggression.
          </p>
        </div>

        <button
          onClick={loadTeams}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Franchise Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((t) => (
          <div
            key={t.code}
            className="p-4 rounded-xl border border-border/80 bg-card flex flex-col justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <TeamIdentity code={t.code} name={t.name} size="md" />
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {formatRupees(t.defaultPurse)}
                </span>
                <div className="text-[10px] text-muted-foreground">Default Starting Purse</div>
              </div>
            </div>

            {/* Squad limits stats bar */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 px-3 rounded-lg bg-secondary/30 border border-border/50">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Min Squad</div>
                <div className="font-mono font-bold text-foreground mt-0.5">{t.minSquad} Players</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Max Squad</div>
                <div className="font-mono font-bold text-foreground mt-0.5">{t.maxSquad} Players</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Max Overseas</div>
                <div className="font-mono font-bold text-foreground mt-0.5 inline-flex items-center gap-1 justify-center">
                  <span>{t.maxOverseas}</span>
                  <Plane className="w-2.5 h-2.5 text-blue-400" />
                </div>
              </div>
            </div>

            {/* Tactical AI Profile summary */}
            <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-purple-300 flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  Tactical AI Profile
                </span>
                <span className="font-mono font-bold text-foreground">
                  Aggression: {t.aiProfile?.aggression || 1.06}×
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
                <span>Batter: {t.aiProfile?.rolePriority?.BATTER || 1.1}×</span>
                <span>Bowler: {t.aiProfile?.rolePriority?.BOWLER || 1.1}×</span>
                <span>All-Rounder: {t.aiProfile?.rolePriority?.ALL_ROUNDER || 1.15}×</span>
                <span>Keeper: {t.aiProfile?.rolePriority?.WICKETKEEPER || 1.05}×</span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                onClick={() => handleOpenEdit(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Configuration</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Franchise Modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <TeamIdentity code={editingTeam.code} size="sm" />
                <h2 className="text-base font-black">Edit Franchise: {editingTeam.name}</h2>
              </div>
              <button
                onClick={() => setEditingTeam(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Franchise Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Short Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.shortName}
                    onChange={(e) => setEditForm({ ...editForm, shortName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Starting Purse (Rupees)</label>
                <input
                  type="number"
                  required
                  value={editForm.defaultPurse}
                  onChange={(e) => setEditForm({ ...editForm, defaultPurse: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-foreground block mb-1">Min Squad</label>
                  <input
                    type="number"
                    value={editForm.minSquad}
                    onChange={(e) => setEditForm({ ...editForm, minSquad: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Max Squad</label>
                  <input
                    type="number"
                    value={editForm.maxSquad}
                    onChange={(e) => setEditForm({ ...editForm, maxSquad: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Max Overseas</label>
                  <input
                    type="number"
                    value={editForm.maxOverseas}
                    onChange={(e) => setEditForm({ ...editForm, maxOverseas: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
              </div>

              {/* AI Tactical Profiles Settings */}
              <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                  <Bot className="w-3.5 h-3.5" />
                  <span>AI Tactical Bidding Tuning</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Aggression Multiplier</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1.0"
                      max="1.25"
                      value={editForm.aiProfile?.aggression || 1.06}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          aiProfile: { ...editForm.aiProfile, aggression: Number(e.target.value) },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">Max Single Player Cap</label>
                    <select
                      value={editForm.aiProfile?.maxPurseRatioPerPlayer || 0.2}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          aiProfile: { ...editForm.aiProfile, maxPurseRatioPerPlayer: Number(e.target.value) },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-foreground cursor-pointer"
                    >
                      <option value={0.18}>18% (₹21.6 Cr)</option>
                      <option value={0.20}>20% (₹24.0 Cr)</option>
                      <option value={0.22}>22% (₹26.4 Cr)</option>
                      <option value={0.25}>25% (₹30.0 Cr)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Batter Priority</label>
                    <input
                      type="number"
                      step="0.05"
                      value={editForm.aiProfile?.rolePriority?.BATTER || 1.1}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          aiProfile: {
                            ...editForm.aiProfile,
                            rolePriority: { ...editForm.aiProfile.rolePriority, BATTER: Number(e.target.value) },
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-secondary/50 border border-border font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Bowler Priority</label>
                    <input
                      type="number"
                      step="0.05"
                      value={editForm.aiProfile?.rolePriority?.BOWLER || 1.1}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          aiProfile: {
                            ...editForm.aiProfile,
                            rolePriority: { ...editForm.aiProfile.rolePriority, BOWLER: Number(e.target.value) },
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-secondary/50 border border-border font-mono text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Save Franchise Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
