"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import {
  FileText,
  ShieldAlert,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Filter,
} from "lucide-react";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadLogs = () => {
    setLoading(true);
    const url = actionFilter !== "ALL"
      ? `/api/admin/audit-logs?action=${encodeURIComponent(actionFilter)}`
      : "/api/admin/audit-logs";

    fetchApi<{ logs: any[] }>(url)
      .then((res) => setLogs(res.logs || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear audit logs?")) return;
    try {
      await fetchApi("/api/admin/audit-logs/clear", { method: "POST" });
      setStatusMessage("Audit trail cleared.");
      setTimeout(() => setStatusMessage(null), 3000);
      loadLogs();
    } catch (err: any) {
      alert(`Clear error: ${err.message}`);
    }
  };

  const filtered = logs.filter(
    (l) =>
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.targetId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Security & Administrative Audit Trail</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              IMMUTABLE LOGS
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit logs tracking all administrative interventions, room pauses, player updates, and security role modifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 cursor-pointer transition-colors shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search audit trail by action, target, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-card border border-border/80 text-foreground"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-card border border-border/80 text-foreground cursor-pointer text-xs"
        >
          <option value="ALL">All Actions</option>
          <option value="ROOM_">Room Actions</option>
          <option value="PLAYER_">Player Changes</option>
          <option value="SET_">Set Changes</option>
          <option value="RULESET_">Ruleset Changes</option>
          <option value="UPDATE_USER_ROLE">Role Changes</option>
          <option value="AI_">AI Tuning</option>
          <option value="UPDATE_APP_SETTINGS">Settings Changes</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase text-[10px] font-bold tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-3">Admin</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-4">Details</th>
                <th className="py-2.5 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        l.action.includes("ROOM")
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : l.action.includes("PLAYER")
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : l.action.includes("ROLE")
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-secondary text-foreground border border-border"
                      }`}
                    >
                      {l.action}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-muted-foreground">{l.adminUserId}</td>

                  <td className="py-3 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary text-foreground">
                      {l.targetType}:{l.targetId}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-foreground text-[11px] max-w-md">
                    {l.details}
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-muted-foreground text-[11px]">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No audit records matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
