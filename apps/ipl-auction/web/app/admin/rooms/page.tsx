"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { fetchApi } from "../../../lib/api";
import {
  Tv,
  Pause,
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  Trash2,
  ExternalLink,
  Plus,
  Users,
  Shield,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "IPL 2026 Official Tournament",
    ruleset: "MEGA",
    aiDifficulty: "normal",
    enableRetentions: true,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadRooms = () => {
    setLoading(true);
    fetchApi<{ rooms: any[] }>("/api/admin/rooms")
      .then((res) => setRooms(res.rooms || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (roomId: string, action: "pause" | "resume" | "end" | "reset" | "delete") => {
    if (action === "delete" && !confirm(`Are you sure you want to delete room '${roomId}'? This action is irreversible.`)) {
      return;
    }

    setActionLoading(`${roomId}_${action}`);
    try {
      await fetchApi(`/api/admin/rooms/${roomId}/action`, {
        method: "POST",
        body: JSON.stringify({ action, reason: "ADMIN_OVERRIDE" }),
      });
      setStatusMessage(`Successfully executed '${action}' on room ${roomId}`);
      setTimeout(() => setStatusMessage(null), 3000);
      loadRooms();
    } catch (err: any) {
      alert(`Action error: ${err?.message || "Failed to execute"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetchApi<{ success: boolean; roomId: string }>("/api/admin/rooms", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setIsCreateModalOpen(false);
      setStatusMessage(`Created room ${res.roomId}`);
      setTimeout(() => setStatusMessage(null), 3000);
      loadRooms();
    } catch (err: any) {
      alert(`Failed to create room: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Live Auction Room Management</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              DURABLE OBJECT PERSISTENCE
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor, pause, resume, reset, or spectate any active Cloudflare Durable Object room in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Tournament Room</span>
          </button>

          <button
            onClick={loadRooms}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
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

      {/* Rooms Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase text-[10px] font-bold tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-4">Room Name & ID</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Format</th>
                <th className="py-2.5 px-3">Active Lot / Current Bid</th>
                <th className="py-2.5 px-3">Participants</th>
                <th className="py-2.5 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rooms.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-foreground text-xs">{r.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <span>ID: {r.id}</span>
                      <span>•</span>
                      <span>Host: {r.creatorId}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === "LIVE"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : r.status === "PAUSED"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : r.status === "LOBBY"
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-secondary/80 text-foreground">
                      {r.ruleset || "MEGA"}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    {r.currentLotName ? (
                      <div>
                        <div className="font-bold text-foreground">{r.currentLotName}</div>
                        <div className="text-[10px] font-mono text-emerald-400">
                          ₹{(r.currentBid || 0).toLocaleString("en-IN")}
                          {r.highestBidder && ` (${r.highestBidder})`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">In Lobby / Concluded</span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 font-mono font-bold text-foreground">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>{r.connectedHumans || 0} Humans</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.botTeamsCount || 10} AI Teams
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Spectate Button */}
                      <Link
                        href={`/room/${r.id}`}
                        target="_blank"
                        className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors"
                        title="Enter / Spectate Room"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      {/* Pause / Resume */}
                      {r.status === "LIVE" ? (
                        <button
                          onClick={() => handleAction(r.id, "pause")}
                          disabled={actionLoading !== null}
                          className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 cursor-pointer disabled:opacity-50"
                          title="Pause Auction Countdown"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      ) : r.status === "PAUSED" ? (
                        <button
                          onClick={() => handleAction(r.id, "resume")}
                          disabled={actionLoading !== null}
                          className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 cursor-pointer disabled:opacity-50"
                          title="Resume Auction Countdown"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      ) : null}

                      {/* Reset to Lobby */}
                      <button
                        onClick={() => handleAction(r.id, "reset")}
                        disabled={actionLoading !== null}
                        className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 cursor-pointer disabled:opacity-50"
                        title="Reset Room to Lobby (Reset Squads & Lots)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Conclude Room */}
                      {r.status !== "ENDED" && (
                        <button
                          onClick={() => handleAction(r.id, "end")}
                          disabled={actionLoading !== null}
                          className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 cursor-pointer disabled:opacity-50"
                          title="Conclude / End Auction"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}

                      {/* Delete Room */}
                      <button
                        onClick={() => handleAction(r.id, "delete")}
                        disabled={actionLoading !== null}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 cursor-pointer disabled:opacity-50"
                        title="Delete Room Completely"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No active auction rooms found. Launch an official room using the button above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Official Tournament Room Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h2 className="text-base font-black">Launch Tournament Room</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Auction Format</label>
                <select
                  value={createForm.ruleset}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      ruleset: e.target.value,
                      enableRetentions: e.target.value !== "SPRINT_XI",
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer"
                >
                  <option value="MEGA">Mega Auction (₹120 Cr, Max 6 Retentions, 18-25 Squad)</option>
                  <option value="CLASSIC">Classic Auction (₹120 Cr, Up to 11 Retentions, 18-25 Squad)</option>
                  <option value="SPRINT_XI">Sprint XI (₹50 Cr, Exactly 11 Squad, No Retentions)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">AI Franchise Difficulty</label>
                <select
                  value={createForm.aiDifficulty}
                  onChange={(e) => setCreateForm({ ...createForm, aiDifficulty: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer"
                >
                  <option value="normal">Normal (Realistic & Balanced)</option>
                  <option value="hard">Hard (Aggressive Bidding Wars)</option>
                  <option value="easy">Easy (Relaxed Bidding)</option>
                </select>
              </div>

              {createForm.ruleset !== "SPRINT_XI" && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="enableRetentions"
                    checked={createForm.enableRetentions}
                    onChange={(e) => setCreateForm({ ...createForm, enableRetentions: e.target.checked })}
                    className="rounded border-border cursor-pointer"
                  />
                  <label htmlFor="enableRetentions" className="text-muted-foreground cursor-pointer font-medium">
                    Enable Official IPL Retentions & RTM
                  </label>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer flex items-center gap-1.5"
                >
                  {createLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Initialize & Launch Room</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
