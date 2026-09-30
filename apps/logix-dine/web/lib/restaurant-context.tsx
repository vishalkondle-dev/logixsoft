"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { JsonRestaurantRow, JsonRestaurantOutletRow } from "@logixsoft/logix-dine/types/pos-schema";
import { useAuth } from "@/lib/auth-context";
import { getMyRole } from "@/lib/api-client";
import { notifications } from "@mantine/notifications";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";
const RESTAURANT_COOKIE = "dine.restaurantId";
const OUTLET_COOKIE = "dine.outletId";

function getUrlOutletId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("outletId") || params.get("outlet");
}

function updateUrlOutletId(outletId: string | null) {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/admin")) return;
  const url = new URL(window.location.href);
  if (outletId) {
    if (url.searchParams.get("outletId") === outletId && !url.searchParams.has("outlet")) return;
    url.searchParams.set("outletId", outletId);
    url.searchParams.delete("outlet"); // canonicalize to outletId
  } else {
    url.searchParams.delete("outletId");
    url.searchParams.delete("outlet");
  }
  window.history.replaceState(window.history.state, "", url.toString());
}

import { hasPermission, type Permission } from "@logixsoft/logix-dine/types/roles";
import {
  isPermissionAllowedForOutlet,
  isModuleAllowedForOutlet,
  isSubscriptionActive,
  type PlanModuleId,
  type PlanTier,
} from "@logixsoft/logix-dine/types/plans";

interface RestaurantContextType {
  restaurant: JsonRestaurantRow | null;
  outlets: JsonRestaurantOutletRow[];
  activeOutlet: JsonRestaurantOutletRow | null;
  myRestaurants: JsonRestaurantRow[];
  isLoading: boolean;
  role: string | null;
  roleName: string | null;
  permissions: string[];
  allOutlets: boolean;
  myOutletIds: string[];
  isPlanActive: boolean;
  activePlanTier: PlanTier;
  can: (permission: string) => boolean;
  isModuleAllowed: (moduleId: PlanModuleId) => boolean;
  setActiveRestaurant: (restaurantId: string) => void;
  setActiveOutlet: (outletId: string) => void;
  refresh: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const isSubdomain = typeof window !== "undefined" && window.location.hostname.includes("logixsoft.in");
  const domainAttr = isSubdomain ? ";domain=.logixsoft.in" : "";
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/${domainAttr};SameSite=Lax`;
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState<JsonRestaurantRow | null>(null);
  const [outlets, setOutlets] = useState<JsonRestaurantOutletRow[]>([]);
  const [activeOutlet, setActiveOutletState] = useState<JsonRestaurantOutletRow | null>(null);
  const [myRestaurants, setMyRestaurants] = useState<JsonRestaurantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true); // start true until first fetch resolves
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [allOutlets, setAllOutlets] = useState<boolean>(true);
  const [myOutletIds, setMyOutletIds] = useState<string[]>([]);

  const fetchData = useCallback(async (restaurantId: string) => {
    setIsLoading(true);
    try {
      const [restRes, outletsRes, roleInfo] = await Promise.all([
        fetch(`${API_BASE}/restaurants/me`, {
          credentials: "include",
          headers: { "X-Restaurant-Id": restaurantId },
        }),
        fetch(`${API_BASE}/outlets`, {
          credentials: "include",
          headers: { "X-Restaurant-Id": restaurantId },
        }),
        getMyRole(restaurantId).catch(() => null),
      ]);

      if (restRes.ok) {
        const r = await restRes.json();
        setRestaurant(r);
      }
      if (roleInfo) {
        setRole(roleInfo.role);
        setRoleName(roleInfo.roleName || roleInfo.role);
        setPermissions(roleInfo.permissions || []);
        setAllOutlets(roleInfo.allOutlets);
        setMyOutletIds(roleInfo.outletIds);
      }
      if (outletsRes.ok) {
        const o: JsonRestaurantOutletRow[] = await outletsRes.json();
        // Non-owner roles only ever see/select outlets they're assigned to —
        // the API already enforces this server-side, but scoping the picker
        // here too avoids showing outlets the user can't actually act on.
        const scoped = roleInfo && !roleInfo.allOutlets
          ? o.filter((out) => roleInfo.outletIds.includes(out.id))
          : o;
        setOutlets(scoped);
        // Priority: 1. URL search param (if valid for this user/role)
        //           2. Saved cookie
        //           3. Default outlet
        const urlOutletId = getUrlOutletId();
        const savedOutletId = getCookie(OUTLET_COOKIE);
        const fromUrl = urlOutletId ? scoped.find((out) => out.id === urlOutletId) : null;
        const fromCookie = savedOutletId ? scoped.find((out) => out.id === savedOutletId) : null;
        const defaultOutlet = scoped.find((out) => out.isDefault) ?? scoped[0] ?? null;
        const chosen = fromUrl ?? fromCookie ?? defaultOutlet;

        setActiveOutletState(chosen);
        if (chosen) {
          setCookie(OUTLET_COOKIE, chosen.id);
          if (typeof window !== "undefined" && window.location.pathname !== "/" && !window.location.pathname.startsWith("/admin")) {
            updateUrlOutletId(chosen.id);
          }
        }
      }
    } catch {
      // silently fail — auth-context handles login state
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pathname = usePathname();

  useEffect(() => {
    if (activeOutlet && pathname && pathname !== "/" && pathname !== "/onboarding" && !pathname.startsWith("/admin")) {
      updateUrlOutletId(activeOutlet.id);
    }
  }, [pathname, activeOutlet]);

  useEffect(() => {
    const handlePopState = () => {
      const urlId = getUrlOutletId();
      if (urlId && urlId !== activeOutlet?.id) {
        const found = outlets.find((o) => o.id === urlId);
        if (found) {
          setCookie(OUTLET_COOKIE, found.id);
          setActiveOutletState(found);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [outlets, activeOutlet]);

  const refresh = useCallback(async () => {
    if (activeRestaurantId) await fetchData(activeRestaurantId);
  }, [activeRestaurantId, fetchData]);

  const revalidateRole = useCallback(async (targetRestaurantId?: string) => {
    const rid = targetRestaurantId || activeRestaurantId;
    if (!rid || !isAuthenticated || (user as any)?.role === "ADMIN") return;

    try {
      const roleInfo = await getMyRole(rid).catch(() => null);
      if (roleInfo) {
        setRole((prev) => {
          if (prev && prev !== roleInfo.role) {
            notifications.show({
              title: "Role Updated",
              message: `Your role has been updated to ${roleInfo.roleName || roleInfo.role}.`,
              color: "blue",
              autoClose: 5000,
            });
          }
          return roleInfo.role;
        });
        setRoleName(roleInfo.roleName || roleInfo.role);
        setPermissions(roleInfo.permissions || []);
        setAllOutlets(roleInfo.allOutlets);
        setMyOutletIds(roleInfo.outletIds || []);

        if (!roleInfo.allOutlets && roleInfo.outletIds) {
          const outletsRes = await fetch(`${API_BASE}/outlets`, {
            credentials: "include",
            headers: { "X-Restaurant-Id": rid },
          }).catch(() => null);
          if (outletsRes && outletsRes.ok) {
            const allO: JsonRestaurantOutletRow[] = await outletsRes.json();
            const scoped = allO.filter((out) => roleInfo.outletIds.includes(out.id));
            setOutlets(scoped);
            setActiveOutletState((curr) => {
              if (curr && !roleInfo.outletIds.includes(curr.id)) {
                const nextChosen = scoped[0] ?? null;
                if (nextChosen) {
                  setCookie(OUTLET_COOKIE, nextChosen.id);
                  updateUrlOutletId(nextChosen.id);
                }
                return nextChosen;
              }
              return curr;
            });
          }
        }
      } else {
        const restsRes = await fetch(`${API_BASE}/restaurants`, { credentials: "include" }).catch(() => null);
        if (restsRes && restsRes.ok) {
          const rests: JsonRestaurantRow[] = await restsRes.json();
          setMyRestaurants(rests);
          const stillMember = rests.some((r) => r.id === rid);
          if (!stillMember) {
            setRestaurant(null);
            setRole(null);
            setRoleName(null);
            setPermissions([]);
            setOutlets([]);
            setActiveOutletState(null);
            notifications.show({
              title: "Access Updated",
              message: "Your access to this restaurant is no longer active.",
              color: "orange",
              autoClose: 6000,
            });
            if (rests.length > 0) {
              setCookie(RESTAURANT_COOKIE, rests[0].id);
              setActiveRestaurantId(rests[0].id);
              fetchData(rests[0].id);
            }
          }
        }
      }
    } catch {
      // silently ignore network errors
    }
  }, [activeRestaurantId, isAuthenticated, user, fetchData]);

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

  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      setRestaurant(null);
      setOutlets([]);
      setMyRestaurants([]);
      setRole(null);
      setRoleName(null);
      setPermissions([]);
      setIsLoading(false); // auth settled, no session — done
      return;
    }

    // Platform ADMIN has strictly only the ADMIN role and has 0 restaurant memberships
    if ((user as any).role === "ADMIN") {
      setRestaurant(null);
      setOutlets([]);
      setMyRestaurants([]);
      setRole(null);
      setRoleName(null);
      setPermissions([]);
      setIsLoading(false);
      return;
    }
    // Fetch the list of restaurants the user is a member of (owner or staff)
    fetch(`${API_BASE}/restaurants`, {
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : [])
      .then((rests: JsonRestaurantRow[]) => {
        setMyRestaurants(rests);
        if (!rests.length) {
          setIsLoading(false); // no restaurants — done
          return;
        }
        // Pick active from cookie or first
        const savedId = getCookie(RESTAURANT_COOKIE);
        const toLoad = rests.find((r) => r.id === savedId) ?? rests[0];
        if (toLoad) {
          setActiveRestaurantId(toLoad.id);
          fetchData(toLoad.id);
        } else if (savedId) {
          setActiveRestaurantId(savedId);
          fetchData(savedId);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, user, authLoading, fetchData]);

  const setActiveRestaurant = useCallback((restaurantId: string) => {
    setCookie(RESTAURANT_COOKIE, restaurantId);
    setActiveRestaurantId(restaurantId);
    fetchData(restaurantId);
  }, [fetchData]);

  const setActiveOutlet = useCallback((outletId: string) => {
    setCookie(OUTLET_COOKIE, outletId);
    updateUrlOutletId(outletId);
    const outlet = outlets.find((o) => o.id === outletId) ?? null;
    setActiveOutletState(outlet);
  }, [outlets]);

  const can = useCallback(
    (permission: string): boolean => {
      // Platform ADMIN bypasses everything
      if ((user as any)?.role === "ADMIN") return true;
      if (!role) return false;

      // 1. Subscription plan licensing check for active outlet:
      // Both STAFF and OWNER are bound by what the active outlet's subscription allows!
      if (activeOutlet && !isPermissionAllowedForOutlet(activeOutlet as any, permission)) {
        return false;
      }

      // 2. Role & permission matrix check:
      if (role === "OWNER") return true;
      return hasPermission(permissions, permission as Permission);
    },
    [role, permissions, user, activeOutlet]
  );

  const isModuleAllowed = useCallback(
    (moduleId: PlanModuleId): boolean => {
      if ((user as any)?.role === "ADMIN") return true;
      if (!activeOutlet) return true;
      return isModuleAllowedForOutlet(activeOutlet as any, moduleId);
    },
    [user, activeOutlet]
  );

  const isPlanActive = React.useMemo(() => {
    if (!activeOutlet) return true;
    return isSubscriptionActive(activeOutlet as any);
  }, [activeOutlet]);

  const activePlanTier = ((activeOutlet?.planTier?.toUpperCase() as PlanTier) || "BASIC");

  return (
    <RestaurantContext.Provider value={{
      restaurant,
      outlets,
      activeOutlet,
      myRestaurants,
      isLoading,
      role,
      roleName,
      permissions,
      allOutlets,
      myOutletIds,
      isPlanActive,
      activePlanTier,
      can,
      isModuleAllowed,
      setActiveRestaurant,
      setActiveOutlet,
      refresh,
      refreshRole: () => revalidateRole(activeRestaurantId ?? undefined),
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant must be used within RestaurantProvider");
  return ctx;
}

/** The caller's restaurant-level role: OWNER | MANAGER | WAITER | KITCHEN | CUSTOM_ROLE | null (not a member / not loaded yet). */
export function useRestaurantRole(): string | null {
  const { role } = useRestaurant();
  const { user } = useAuth();
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
  const { can } = useRestaurant();
  const { user } = useAuth();

  if ((user as any)?.role === "ADMIN") return true;

  if (Array.isArray(permission)) {
    return mode === "all"
      ? permission.every((p) => can(p))
      : permission.some((p) => can(p));
  }
  return can(permission);
}
