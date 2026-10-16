"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Search,
  RefreshCw,
} from "lucide-react";

export default function AdminSetsPage() {
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<any | null>(null);
  const [setForm, setSetForm] = useState({
    setNumber: 1,
    setCode: "",
    setName: "",
    displayOrder: 1,
    description: "",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadSets = () => {
    setLoading(true);
    fetchApi<{ sets: any[] }>("/api/admin/sets")
      .then((res) => setSets(res.sets || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSets();
  }, []);

  const handleOpenAdd = () => {
    setEditingSet(null);
    setSetForm({
      setNumber: sets.length + 1,
      setCode: `SET${sets.length + 1}`,
      setName: "",
      displayOrder: sets.length + 1,
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: any) => {
    setEditingSet(s);
    setSetForm({
      setNumber: s.setNumber,
      setCode: s.setCode,
      setName: s.setName,
      displayOrder: s.displayOrder,
      description: s.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSaveSet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSet) {
        await fetchApi(`/api/admin/sets/${editingSet.id}`, {
          method: "PUT",
          body: JSON.stringify(setForm),
        });
        setStatusMessage(`Updated auction set '${setForm.setName}'.`);
      } else {
        await fetchApi("/api/admin/sets", {
          method: "POST",
          body: JSON.stringify(setForm),
        });
        setStatusMessage(`Created auction set '${setForm.setName}'.`);
      }
      setIsModalOpen(false);
      setTimeout(() => setStatusMessage(null), 3000);
      loadSets();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  const handleDeleteSet = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete set '${name}'?`)) return;
    try {
      await fetchApi(`/api/admin/sets/${id}`, { method: "DELETE" });
      setStatusMessage(`Deleted set '${name}'.`);
      setTimeout(() => setStatusMessage(null), 3000);
      loadSets();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const filteredSets = sets.filter(
    (s) =>
      s.setName.toLowerCase().includes(search.toLowerCase()) ||
      s.setCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Auction Sets & Lot Progression</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {sets.length} SETS
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage set codes, ordering, descriptions, and player associations across capped and uncapped brackets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSets}
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
            <span>Create Auction Set</span>
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

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter sets by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-card border border-border/80 text-foreground"
        />
      </div>

      {/* Sets Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase text-[10px] font-bold tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-4">Set Number</th>
                <th className="py-2.5 px-3">Set Code</th>
                <th className="py-2.5 px-4">Set Name</th>
                <th className="py-2.5 px-3">Players in Set</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredSets.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-foreground">
                    Set #{s.setNumber}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-blue-400">
                    {s.setCode}
                  </td>
                  <td className="py-3 px-4 font-bold text-foreground">
                    {s.setName}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                    {s.playerCount || 0} Players
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-[11px]">
                    {s.description}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors"
                        title="Edit Set"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSet(s.id, s.setName)}
                        className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 cursor-pointer transition-colors"
                        title="Delete Set"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Set Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h2 className="text-base font-black">
                {editingSet ? `Edit Set: ${editingSet.setName}` : "Create Auction Set"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSet} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Set Number</label>
                  <input
                    type="number"
                    required
                    value={setForm.setNumber}
                    onChange={(e) => setSetForm({ ...setForm, setNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Set Code</label>
                  <input
                    type="text"
                    required
                    value={setForm.setCode}
                    onChange={(e) => setSetForm({ ...setForm, setCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono font-bold text-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Set Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Capped Fast Bowlers"
                  value={setForm.setName}
                  onChange={(e) => setSetForm({ ...setForm, setName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={setForm.description}
                  onChange={(e) => setSetForm({ ...setForm, description: e.target.value })}
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
                  {editingSet ? "Save Changes" : "Create Set"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
