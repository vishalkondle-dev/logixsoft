"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { JsonRestaurantRow, JsonRestaurantOutletRow } from "@logixsoft/logix-dine/types/pos-schema";
import { useAuth } from "@/lib/auth-context";
import { getMyRole } from "@/lib/api-client";

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

interface RestaurantContextType {
  restaurant: JsonRestaurantRow | null;
  outlets: JsonRestaurantOutletRow[];
  activeOutlet: JsonRestaurantOutletRow | null;
  myRestaurants: JsonRestaurantRow[];
  isLoading: boolean;
  role: string | null;
  allOutlets: boolean;
  myOutletIds: string[];
  setActiveRestaurant: (restaurantId: string) => void;
  setActiveOutlet: (outletId: string) => void;
  refresh: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
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
          if (typeof window !== "undefined" && window.location.pathname !== "/") {
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
    if (activeOutlet && pathname && pathname !== "/" && pathname !== "/onboarding") {
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

  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      setRestaurant(null);
      setOutlets([]);
      setMyRestaurants([]);
      setRole(null);
      setIsLoading(false); // auth settled, no session — done
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
        setActiveRestaurantId(toLoad.id);
        fetchData(toLoad.id);
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

  return (
    <RestaurantContext.Provider value={{
      restaurant,
      outlets,
      activeOutlet,
      myRestaurants,
      isLoading,
      role,
      allOutlets,
      myOutletIds,
      setActiveRestaurant,
      setActiveOutlet,
      refresh,
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
