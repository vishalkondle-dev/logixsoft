"use client";

import React, { useState, useEffect } from "react";
import { fetchApi } from "../../../lib/api";
import {
  MessageSquare,
  Trash2,
  Send,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Tv,
  CheckCircle2,
  Megaphone,
} from "lucide-react";

export default function AdminChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcing, setAnnouncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadRooms = () => {
    fetchApi<{ rooms: any[] }>("/api/admin/rooms")
      .then((res) => {
        setRooms(res.rooms || []);
        if (res.rooms && res.rooms.length > 0 && !selectedRoomId) {
          setSelectedRoomId(res.rooms[0].id);
        }
      })
      .catch((err) => console.error(err));
  };

  const loadMessages = () => {
    setLoading(true);
    const url = selectedRoomId
      ? `/api/admin/chat?roomId=${encodeURIComponent(selectedRoomId)}`
      : "/api/admin/chat";

    fetchApi<{ messages: any[] }>(url)
      .then((res) => setMessages(res.messages || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [selectedRoomId]);

  const handleDeleteMessage = async (roomId: string, messageId: string) => {
    try {
      await fetchApi(`/api/admin/chat/${roomId}/${messageId}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setStatusMessage("Chat message deleted from room.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Failed to delete message: ${err.message}`);
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim() || !selectedRoomId) return;

    setAnnouncing(true);
    try {
      await fetchApi(`/api/admin/chat/${selectedRoomId}/announce`, {
        method: "POST",
        body: JSON.stringify({ text: announcementText.trim() }),
      });
      setAnnouncementText("");
      setStatusMessage(`Broadcasted announcement to room ${selectedRoomId}.`);
      setTimeout(() => setStatusMessage(null), 3000);
      loadMessages();
    } catch (err: any) {
      alert(`Broadcast error: ${err.message}`);
    } finally {
      setAnnouncing(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
            <span>Live Chat Moderation & Broadcast Command</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              REAL-TIME WEBSOCKET
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspect room conversations, delete abusive messages from Durable Object storage, and issue official announcements.
          </p>
        </div>

        <button
          onClick={loadMessages}
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

      {/* Room Selector & Broadcast Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Room Filter Selector */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
          <label className="font-bold text-xs text-foreground block flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-blue-400" />
            <span>Select Target Room</span>
          </label>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs cursor-pointer"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.status})
              </option>
            ))}
          </select>
          <div className="text-[11px] text-muted-foreground font-mono">
            Active Room ID: {selectedRoomId || "None"}
          </div>
        </div>

        {/* Commissioner Announcement Form */}
        <div className="md:col-span-2 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
            <Megaphone className="w-4 h-4" />
            <span>Broadcast Commissioner Announcement</span>
          </div>

          <form onSubmit={handleSendAnnouncement} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Official Notice: 5-minute break before accelerated round begins..."
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={announcing || !announcementText.trim() || !selectedRoomId}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast</span>
            </button>
          </form>
        </div>
      </div>

      {/* Chat Messages Feed Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border/80 text-muted-foreground uppercase text-[10px] font-bold tracking-wider select-none">
              <tr>
                <th className="py-2.5 px-4">Room</th>
                <th className="py-2.5 px-3">Sender</th>
                <th className="py-2.5 px-4">Message</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-4 text-right">Moderate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {messages.map((m) => (
                <tr key={m.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-[10px] text-muted-foreground">
                    {m.roomId || selectedRoomId}
                  </td>

                  <td className="py-2.5 px-3 font-bold text-foreground">
                    {m.displayName || m.userId || "Participant"}
                  </td>

                  <td className="py-2.5 px-4">
                    <span className={m.displayName?.includes("ADMIN") ? "font-bold text-amber-400" : "text-foreground"}>
                      {m.text}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </td>

                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => handleDeleteMessage(m.roomId || selectedRoomId, m.id)}
                      className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 cursor-pointer transition-colors"
                      title="Remove Abusive Message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No chat messages in this room yet. Send an announcement or test in a live room.
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
