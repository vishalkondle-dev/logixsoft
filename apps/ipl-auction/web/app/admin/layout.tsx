"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { UserMenu } from "../../components/auth/UserMenu";
import { AuthModal } from "../../components/auth/AuthModal";
import {
  LayoutDashboard,
  Users,
  Tv,
  Shield,
  UserCheck,
  Layers,
  Sliders,
  History,
  MessageSquare,
  Bot,
  Settings,
  FileText,
  ArrowLeft,
  ShieldAlert,
  Lock,
  Loader2,
  LogIn,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/rooms", label: "Live Rooms", icon: Tv },
  { href: "/admin/players", label: "Players & Import", icon: UserCheck },
  { href: "/admin/teams", label: "Franchises", icon: Shield },
  { href: "/admin/sets", label: "Auction Sets", icon: Layers },
  { href: "/admin/rulesets", label: "Rulesets", icon: Sliders },
  { href: "/admin/auctions", label: "Past Auctions", icon: History },
  { href: "/admin/chat", label: "Chat Moderation", icon: MessageSquare },
  { href: "/admin/ai", label: "Clef-Flash AI", icon: Bot },
  { href: "/admin/users", label: "Users & Roles", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin, isLoading, openAuthModal, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs font-mono text-muted-foreground">Verifying Administrator Privileges...</p>
      </div>
    );
  }

  // Access Denied / Auth Gate for Non-Admins
  if (!isAdmin) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-between p-6">
        <header className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-black font-black text-xs flex items-center justify-center">
              ADM
            </div>
            <span className="font-bold text-xs tracking-tight">AUCTION CONTROL</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/60 hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Arena</span>
          </Link>
        </header>

        <main className="max-w-md mx-auto w-full py-12 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black tracking-tight">
              Administrator Authentication Required
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Access to the IPL Auction Control Room & Hidden Ratings Database is restricted to authorized Administrator accounts.
            </p>
          </div>

          <div className="w-full p-4 rounded-xl bg-card border border-border/80 text-left text-xs space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Current Identity:</span>
              <span className="font-bold text-foreground">
                {user ? user.name : "Unauthenticated Guest"}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Security Tier:</span>
              <span className="font-mono font-bold text-blue-400">
                {user ? user.role.toUpperCase() : "GUEST"}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Required Role:</span>
              <span className="font-mono font-bold text-amber-400">
                ADMIN
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              onClick={openAuthModal}
              className="w-full flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs transition-colors shadow-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In as Admin</span>
            </button>
            <Link
              href="/"
              className="w-full flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border/80 bg-secondary/80 hover:bg-secondary text-foreground font-semibold text-xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Arena</span>
            </Link>
          </div>
        </main>

        <footer className="text-center text-[10px] text-muted-foreground font-mono">
          Cloudflare D1 & Durable Object Identity Verification Tier
        </footer>

        <AuthModal />
      </div>
    );
  }

  // Authorized Admin View
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar (Desktop 220px) */}
      <aside className="w-56 border-r border-border/80 bg-card flex flex-col justify-between flex-shrink-0 select-none">
        <div>
          {/* Brand */}
          <div className="h-13 border-b border-border/80 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-amber-500 text-black font-black text-xs flex items-center justify-center">
                ADM
              </div>
              <span className="font-bold text-xs tracking-tight">AUCTION CONTROL</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-120px)]">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Back to Game */}
        <div className="p-3 border-t border-border/80">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Arena</span>
          </Link>
        </div>
      </aside>

      {/* Main Admin Content Region */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <header className="h-13 border-b border-border/80 bg-card/60 backdrop-blur-xs px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Administrator Security Tier
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 font-mono text-muted-foreground hidden sm:flex">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cloudflare DO Engine Online</span>
            </div>
            <UserMenu showAdminLink={false} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 p-6 bg-background/50">
          {children}
        </main>
      </div>

      <AuthModal />
    </div>
  );
}
