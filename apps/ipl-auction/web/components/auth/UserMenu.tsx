"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { ShieldCheck, LogOut, ChevronDown, User, Shield } from "lucide-react";
import Link from "next/link";

export const UserMenu: React.FC<{ showAdminLink?: boolean }> = ({ showAdminLink = true }) => {
  const { user, isAuthenticated, isAdmin, openAuthModal, logout, initialize } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={openAuthModal}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-secondary/70 text-foreground text-xs font-bold transition-all shadow-2xs hover:shadow-sm cursor-pointer"
        title="Sign in with Google"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Sign In</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border/80 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
      >
        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary font-black text-[10px] flex items-center justify-center select-none uppercase">
          {user.name.charAt(0)}
        </div>
        <span className="truncate max-w-[120px] hidden sm:inline">{user.name}</span>
        {user.role === "admin" ? (
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono text-[9px] font-bold">
            ADMIN
          </span>
        ) : (
          <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono text-[9px] font-bold">
            USER
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/80 bg-card text-foreground shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2 border-b border-border/60">
            <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
            {user.email && (
              <p className="text-[10px] text-muted-foreground font-mono truncate">{user.email}</p>
            )}
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Security Role:</span>
              <span className={`text-[10px] font-bold font-mono ${user.role === "admin" ? "text-amber-400" : "text-blue-400"}`}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="p-1 space-y-0.5">
            {isAdmin && showAdminLink && (
              <Link
                href="/admin/dashboard"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-secondary text-foreground transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Dashboard</span>
              </Link>
            )}

            <button
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
