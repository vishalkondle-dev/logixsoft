"use client";

import React, { useState } from "react";
import { Gavel, User, Sparkles } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

interface JoinNameModalProps {
  isOpen: boolean;
  onSetName: (name: string) => void;
}

export const JoinNameModal: React.FC<JoinNameModalProps> = ({ isOpen, onSetName }) => {
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { openAuthModal } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError("Please enter your name to enter the auction");
      return;
    }
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    try {
      localStorage.setItem("ipl_auction_user_name", trimmed);
    } catch {}
    onSetName(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-[#0b1024] border border-indigo-900/80 p-6 sm:p-8 shadow-2xl relative overflow-hidden select-none">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-orange-500/20 to-transparent blur-2xl pointer-events-none" />

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center gap-2 mb-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/30">
            <Gavel className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
            Join the Auction
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs">
            Enter your name to participate in live bidding and chat.
          </p>
        </div>

        {/* Name Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Your Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                required
                maxLength={40}
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Virat Sharma"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#141a38] border border-indigo-800/80 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 font-medium transition-all"
              />
            </div>
            {error && <p className="text-xs text-red-400 mt-1.5 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wide uppercase bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/25 transition-all cursor-pointer active:scale-[0.98]"
          >
            Enter Auction Arena
          </button>
        </form>

        {/* Divider & Google Auth */}
        <div className="mt-6 pt-5 border-t border-indigo-950/80 flex flex-col items-center gap-3 relative z-10">
          <span className="text-xs text-slate-400">or sign in with your account</span>
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#141a38] hover:bg-[#1a234a] text-slate-200 border border-indigo-800/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sign in with Google (Auto-names you)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
