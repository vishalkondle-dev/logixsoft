"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../../stores/authStore";
import { initiateGoogleSignIn } from "../../lib/auth-client";
import { Shield, UserCheck, AlertCircle, Loader2, X } from "lucide-react";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, googleEnabled, loginAsDemo, loginWithGoogle } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen || !mounted) return null;

  const handleGoogleClick = async (emailOverride?: string) => {
    setLoadingGoogle(true);
    try {
      if (googleEnabled) {
        await initiateGoogleSignIn(emailOverride);
      } else {
        const email = emailOverride || customEmail.trim() || "vishalkondle.dev@gmail.com";
        const name = email === "vishalkondle.dev@gmail.com"
          ? "Vishal Kondle"
          : email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        await loginWithGoogle(email, name);
        closeAuthModal();
      }
    } catch (err) {
      console.error("Google sign in error:", err);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleDemoSignIn = async (role: "admin" | "user") => {
    setLoadingRole(role);
    try {
      await loginAsDemo(role);
      closeAuthModal();
    } finally {
      setLoadingRole(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={closeAuthModal}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 text-foreground z-10 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center text-white font-black text-xs shadow-md">
              IPL
            </div>
            <h2 className="text-lg font-black tracking-tight">
              Sign In to IPL Auction Simulator
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Authenticate to manage franchises, preserve custom squad rosters, or access Administrator Controls.
          </p>
        </div>

        {/* Actions Body */}
        <div className="mt-5 space-y-4">
          {/* Main Google OAuth Button */}
          <button
            onClick={() => handleGoogleClick()}
            disabled={loadingGoogle}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-border/80 bg-background hover:bg-secondary/70 text-foreground text-xs font-bold transition-all shadow-2xs hover:shadow-sm cursor-pointer group disabled:opacity-50"
          >
            {loadingGoogle ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              /* Google Multi-Color G Icon */
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
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
            )}
            <span>{loadingGoogle ? "Signing in..." : "Continue with Google"}</span>
          </button>

          {/* Quick Account Information & Switch Option */}
          {!googleEnabled && (
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-secondary/30 border border-border/60 text-[11px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-muted-foreground truncate mr-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">
                    Account: <strong className="text-foreground">Vishal Kondle</strong> (<span className="font-mono text-[10px]">vishalkondle.dev@gmail.com</span>)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailInput(!showEmailInput)}
                  className="text-primary hover:underline text-[10px] font-semibold shrink-0 cursor-pointer"
                >
                  {showEmailInput ? "Hide" : "Switch account"}
                </button>
              </div>

              {showEmailInput && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customEmail.trim()) {
                      handleGoogleClick(customEmail.trim());
                    }
                  }}
                  className="mt-1 flex items-center gap-1.5"
                >
                  <input
                    type="email"
                    placeholder="e.g. name@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="flex-1 bg-background border border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={!customEmail.trim() || loadingGoogle}
                    className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    Use
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border/70" />
            <span className="flex-shrink mx-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Quick Role Sign-In
            </span>
            <div className="flex-grow border-t border-border/70" />
          </div>

          {/* Quick Sign-In Options */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Admin Sign-In */}
            <button
              onClick={() => handleDemoSignIn("admin")}
              disabled={loadingRole !== null}
              className="flex flex-col items-start gap-1 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-left transition-colors cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  ADMIN
                </span>
              </div>
              <div className="mt-1">
                <div className="text-xs font-bold text-foreground group-hover:text-amber-400 transition-colors flex items-center gap-1">
                  {loadingRole === "admin" && <Loader2 className="w-3 h-3 animate-spin" />}
                  IPL Commissioner
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Unlocks Admin Security Tier & Control Panel
                </div>
              </div>
            </button>

            {/* Standard User Sign-In */}
            <button
              onClick={() => handleDemoSignIn("user")}
              disabled={loadingRole !== null}
              className="flex flex-col items-start gap-1 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 text-left transition-colors cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                  PLAYER
                </span>
              </div>
              <div className="mt-1">
                <div className="text-xs font-bold text-foreground group-hover:text-blue-400 transition-colors flex items-center gap-1">
                  {loadingRole === "user" && <Loader2 className="w-3 h-3 animate-spin" />}
                  Cricket Strategist
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Standard bidder without admin access
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
