"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import {
  Settings,
  CheckCircle2,
  Save,
  Volume2,
  Bot,
  Timer,
  Coins,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const loadSettings = () => {
    setLoading(true);
    fetchApi<{ settings: Record<string, string> }>("/api/admin/settings")
      .then((res) => setSettings(res.settings || {}))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(settings),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Global Runtime Settings & Operational Flags</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              AUTHORITATIVE CONFIG
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time settings affecting newly initialized rooms, default auction timer speeds, and Workers AI bindings.
          </p>
        </div>

        <button
          onClick={loadSettings}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border cursor-pointer transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="p-6 rounded-2xl border border-border/80 bg-card space-y-5 shadow-sm text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>Default Hammer Timer Seconds</span>
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={settings.defaultTimerSeconds || "10"}
              onChange={(e) => setSettings({ ...settings, defaultTimerSeconds: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Official IPL standard is 10 seconds.</p>
          </div>

          <div>
            <label className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>Default Starting Purse (Rupees)</span>
            </label>
            <input
              type="number"
              step="10000000"
              value={settings.defaultStartingPurse || "1200000000"}
              onChange={(e) => setSettings({ ...settings, defaultStartingPurse: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-foreground"
            />
            <p className="text-[10px] text-muted-foreground mt-1">₹1,200,000,000 corresponds to ₹120 Crore.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>Workers AI Clef-Flash Binding</span>
            </label>
            <select
              value={settings.clefFlashEnabled || "true"}
              onChange={(e) => setSettings({ ...settings, clefFlashEnabled: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer text-xs"
            >
              <option value="true">Enabled (Query @cf/cloudflare/clef-flash model)</option>
              <option value="false">Disabled (Fallback to Deterministic Heuristic Engine)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Voice Announcements Default</span>
            </label>
            <select
              value={settings.voiceAnnouncementsDefault || "true"}
              onChange={(e) => setSettings({ ...settings, voiceAnnouncementsDefault: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer text-xs"
            >
              <option value="true">Enabled (Voice announcements active by default)</option>
              <option value="false">Muted by default (User must explicitly unmute)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Tournament Maintenance Mode</span>
          </label>
          <select
            value={settings.maintenanceMode || "false"}
            onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground cursor-pointer text-xs"
          >
            <option value="false">Normal Operations (All rooms and lobbies accessible)</option>
            <option value="true">Maintenance Mode Active (Block new room creation for maintenance)</option>
          </select>
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-border/60">
          {isSaved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Runtime settings persisted successfully</span>
            </span>
          )}
          <button
            type="submit"
            className="ml-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Runtime Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
