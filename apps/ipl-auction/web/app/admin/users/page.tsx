"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import {
  Users,
  Shield,
  User,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  Lock,
} from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadUsers = () => {
    setLoading(true);
    fetchApi<{ users: any[] }>("/api/admin/users")
      .then((res) => setUsers(res.users || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    try {
      await fetchApi(`/api/admin/users/${userId}/role`, {
        method: "POST",
        body: JSON.stringify({ role: nextRole }),
      });
      setStatusMessage(`User role updated to ${nextRole.toUpperCase()}.`);
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: nextRole } : u))
      );
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Role update error: ${err.message}`);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>User Accounts & Security Roles</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              ROLE-BASED ACCESS CONTROL (RBAC)
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Server-enforced role assignments. Admin rights grant authoritative control room access and hidden rating visibility.
          </p>
        </div>

        <button
          onClick={loadUsers}
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

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-card border border-border/80 text-foreground"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase text-[10px] font-bold tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Auth Provider</th>
                <th className="py-2.5 px-3">Security Role</th>
                <th className="py-2.5 px-4 text-right">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-3 px-4 font-bold text-foreground flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center font-bold text-[10px]">
                      {u.name.charAt(0)}
                    </div>
                    <span>{u.name}</span>
                  </td>

                  <td className="py-3 px-3 font-mono text-muted-foreground">{u.email}</td>

                  <td className="py-3 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary/80 text-foreground uppercase">
                      {u.provider || "system"}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        u.role === "admin"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {u.role.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRoleToggle(u.id, u.role)}
                      className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                        u.role === "admin"
                          ? "bg-secondary hover:bg-secondary/80 text-muted-foreground border-border"
                          : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {u.role === "admin" ? "Demote to User" : "Promote to Admin"}
                    </button>
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
