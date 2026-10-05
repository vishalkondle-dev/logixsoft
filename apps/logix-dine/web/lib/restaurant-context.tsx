"use client";

import React, { useEffect, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  useRestaurantStore,
  type RestaurantState,
  updateUrlOutletId,
} from "./stores/restaurant-store";

export type RestaurantContextType = RestaurantState;

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const initFromAuth = useRestaurantStore((s) => s.initFromAuth);
  const activeRestaurantId = useRestaurantStore((s) => s.activeRestaurantId);
  const revalidateRole = useRestaurantStore((s) => s.revalidateRole);
  const activeOutlet = useRestaurantStore((s) => s.activeOutlet);
  const outlets = useRestaurantStore((s) => s.outlets);
  const setActiveOutlet = useRestaurantStore((s) => s.setActiveOutlet);
  const pathname = usePathname();

  // 1. Initialize restaurant state when auth settles
  useEffect(() => {
    if (authLoading) return;
    initFromAuth(user);
  }, [user, authLoading, initFromAuth]);

  // 2. Keep URL outlet param in sync
  useEffect(() => {
    if (
      activeOutlet &&
      pathname &&
      pathname !== "/" &&
      pathname !== "/onboarding" &&
      !pathname.startsWith("/admin")
    ) {
      updateUrlOutletId(activeOutlet.id);
    }
  }, [pathname, activeOutlet]);

  // 3. Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get("outletId") || params.get("outlet");
      if (urlId && urlId !== activeOutlet?.id) {
        const found = outlets.find((o) => o.id === urlId);
        if (found) {
          setActiveOutlet(found.id);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [outlets, activeOutlet, setActiveOutlet]);

  // 4. Role revalidation listeners
  useEffect(() => {
    if (!isAuthenticated || !activeRestaurantId || (user as any)?.role === "ADMIN") return;

    const handleRoleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      if (!data?.restaurantId || data.restaurantId === activeRestaurantId) {
        revalidateRole(activeRestaurantId);
      }
    };
    window.addEventListener("dine:role-updated", handleRoleUpdated);

    const handleFocus = () => revalidateRole(activeRestaurantId);
    window.addEventListener("focus", handleFocus);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        revalidateRole(activeRestaurantId);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const timer = setInterval(() => {
      revalidateRole(activeRestaurantId);
    }, 15000);

    return () => {
      window.removeEventListener("dine:role-updated", handleRoleUpdated);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(timer);
    };
  }, [isAuthenticated, activeRestaurantId, user, revalidateRole]);

  return <>{children}</>;
}

export function useRestaurant(): RestaurantState {
  return useRestaurantStore();
}

/** The caller's restaurant-level role: OWNER | MANAGER | WAITER | KITCHEN | CUSTOM_ROLE | null */
export function useRestaurantRole(): string | null {
  const role = useRestaurantStore((s) => s.role);
  const user = useAuth().user;
  if ((user as any)?.role === "ADMIN") return "ADMIN";
  return role;
}

/**
 * Checks if the active user has a specific permission or set of permissions.
 * Evaluated against active outlet subscription plan and in-memory session permissions.
 */
export function usePermission(
  permission: string | string[],
  mode: "all" | "any" = "all"
): boolean {
  const can = useRestaurantStore((s) => s.can);
  const user = useAuth().user;

  if ((user as any)?.role === "ADMIN") return true;

  if (Array.isArray(permission)) {
    return mode === "all"
      ? permission.every((p) => can(p))
      : permission.some((p) => can(p));
  }
  return can(permission);
}
