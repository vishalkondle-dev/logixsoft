import { create } from 'zustand';
import type { JsonRestaurantRow, JsonRestaurantOutletRow } from '@logixsoft/logix-dine/types/pos-schema';
import { hasPermission, type Permission } from '@logixsoft/logix-dine/types/roles';
import {
  isPermissionAllowedForOutlet,
  isModuleAllowedForOutlet,
  isSubscriptionActive,
  type PlanModuleId,
  type PlanTier,
} from '@logixsoft/logix-dine/types/plans';
import { getMyRole } from '../api-client';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from './auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://dine-api.logixsoft.in';
const RESTAURANT_COOKIE = 'dine.restaurantId';
const OUTLET_COOKIE = 'dine.outletId';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const isSubdomain = typeof window !== 'undefined' && window.location.hostname.includes('logixsoft.in');
  const domainAttr = isSubdomain ? ';domain=.logixsoft.in' : '';
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/${domainAttr};SameSite=Lax`;
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function getUrlOutletId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('outletId') || params.get('outlet');
}

export function updateUrlOutletId(outletId: string | null) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/admin')) return;
  const url = new URL(window.location.href);
  if (outletId) {
    if (url.searchParams.get('outletId') === outletId && !url.searchParams.has('outlet')) return;
    url.searchParams.set('outletId', outletId);
    url.searchParams.delete('outlet');
  } else {
    url.searchParams.delete('outletId');
    url.searchParams.delete('outlet');
  }
  window.history.replaceState(window.history.state, '', url.toString());
}

export interface RestaurantState {
  restaurant: JsonRestaurantRow | null;
  outlets: JsonRestaurantOutletRow[];
  activeOutlet: JsonRestaurantOutletRow | null;
  myRestaurants: JsonRestaurantRow[];
  isLoading: boolean;
  activeRestaurantId: string | null;
  role: string | null;
  roleName: string | null;
  permissions: string[];
  allOutlets: boolean;
  myOutletIds: string[];
  isPlanActive: boolean;
  activePlanTier: PlanTier;

  // Actions
  can: (permission: string) => boolean;
  isModuleAllowed: (moduleId: PlanModuleId) => boolean;
  setActiveRestaurant: (restaurantId: string) => void;
  setActiveOutlet: (outletId: string) => void;
  fetchData: (restaurantId: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshRole: () => Promise<void>;
  revalidateRole: (targetRestaurantId?: string) => Promise<void>;
  initFromAuth: (user: any) => Promise<void>;
  reset: () => void;
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurant: null,
  outlets: [],
  activeOutlet: null,
  myRestaurants: [],
  isLoading: true,
  activeRestaurantId: null,
  role: null,
  roleName: null,
  permissions: [],
  allOutlets: true,
  myOutletIds: [],
  isPlanActive: true,
  activePlanTier: 'BASIC',

  reset: () =>
    set({
      restaurant: null,
      outlets: [],
      activeOutlet: null,
      myRestaurants: [],
      isLoading: false,
      activeRestaurantId: null,
      role: null,
      roleName: null,
      permissions: [],
      allOutlets: true,
      myOutletIds: [],
      isPlanActive: true,
      activePlanTier: 'BASIC',
    }),

  can: (permission: string): boolean => {
    const user = useAuthStore.getState().user;
    if ((user as any)?.role === 'ADMIN') return true;

    const { role, permissions, activeOutlet } = get();
    if (!role) return false;

    if (activeOutlet && !isPermissionAllowedForOutlet(activeOutlet as any, permission)) {
      return false;
    }

    if (role === 'OWNER') return true;
    return hasPermission(permissions, permission as Permission);
  },

  isModuleAllowed: (moduleId: PlanModuleId): boolean => {
    const user = useAuthStore.getState().user;
    if ((user as any)?.role === 'ADMIN') return true;

    const { activeOutlet } = get();
    if (!activeOutlet) return true;
    return isModuleAllowedForOutlet(activeOutlet as any, moduleId);
  },

  fetchData: async (restaurantId: string) => {
    set({ isLoading: true });
    try {
      const [restRes, outletsRes, roleInfo] = await Promise.all([
        fetch(`${API_BASE}/restaurants/me`, {
          credentials: 'include',
          headers: { 'X-Restaurant-Id': restaurantId },
        }),
        fetch(`${API_BASE}/outlets`, {
          credentials: 'include',
          headers: { 'X-Restaurant-Id': restaurantId },
        }),
        getMyRole(restaurantId).catch(() => null),
      ]);

      let restaurant: JsonRestaurantRow | null = null;
      if (restRes.ok) {
        restaurant = await restRes.json();
      }

      let role = get().role;
      let roleName = get().roleName;
      let permissions = get().permissions;
      let allOutlets = get().allOutlets;
      let myOutletIds = get().myOutletIds;

      if (roleInfo) {
        role = roleInfo.role;
        roleName = roleInfo.roleName || roleInfo.role;
        permissions = roleInfo.permissions || [];
        allOutlets = roleInfo.allOutlets;
        myOutletIds = roleInfo.outletIds || [];
      }

      let scopedOutlets: JsonRestaurantOutletRow[] = [];
      let chosenOutlet: JsonRestaurantOutletRow | null = null;

      if (outletsRes.ok) {
        const o: JsonRestaurantOutletRow[] = await outletsRes.json();
        scopedOutlets = roleInfo && !roleInfo.allOutlets
          ? o.filter((out) => roleInfo.outletIds.includes(out.id))
          : o;

        const urlOutletId = getUrlOutletId();
        const savedOutletId = getCookie(OUTLET_COOKIE);
        const fromUrl = urlOutletId ? scopedOutlets.find((out) => out.id === urlOutletId) : null;
        const fromCookie = savedOutletId ? scopedOutlets.find((out) => out.id === savedOutletId) : null;
        const defaultOutlet = scopedOutlets.find((out) => out.isDefault) ?? scopedOutlets[0] ?? null;
        chosenOutlet = fromUrl ?? fromCookie ?? defaultOutlet;

        if (chosenOutlet) {
          setCookie(OUTLET_COOKIE, chosenOutlet.id);
          if (
            typeof window !== 'undefined' &&
            window.location.pathname !== '/' &&
            !window.location.pathname.startsWith('/admin')
          ) {
            updateUrlOutletId(chosenOutlet.id);
          }
        }
      }

      const isPlanActive = chosenOutlet ? isSubscriptionActive(chosenOutlet as any) : true;
      const activePlanTier = (chosenOutlet?.planTier?.toUpperCase() as PlanTier) || 'BASIC';

      set({
        restaurant,
        outlets: scopedOutlets,
        activeOutlet: chosenOutlet,
        role,
        roleName,
        permissions,
        allOutlets,
        myOutletIds,
        isPlanActive,
        activePlanTier,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveRestaurant: (restaurantId: string) => {
    setCookie(RESTAURANT_COOKIE, restaurantId);
    set({ activeRestaurantId: restaurantId });
    get().fetchData(restaurantId);
  },

  setActiveOutlet: (outletId: string) => {
    setCookie(OUTLET_COOKIE, outletId);
    updateUrlOutletId(outletId);
    const outlet = get().outlets.find((o) => o.id === outletId) ?? null;
    const isPlanActive = outlet ? isSubscriptionActive(outlet as any) : true;
    const activePlanTier = (outlet?.planTier?.toUpperCase() as PlanTier) || 'BASIC';

    set({
      activeOutlet: outlet,
      isPlanActive,
      activePlanTier,
    });
  },

  refresh: async () => {
    const { activeRestaurantId, fetchData } = get();
    if (activeRestaurantId) {
      await fetchData(activeRestaurantId);
    }
  },

  refreshRole: async () => {
    const { activeRestaurantId, revalidateRole } = get();
    await revalidateRole(activeRestaurantId ?? undefined);
  },

  revalidateRole: async (targetRestaurantId?: string) => {
    const rid = targetRestaurantId || get().activeRestaurantId;
    const authState = useAuthStore.getState();
    if (!rid || !authState.isAuthenticated || (authState.user as any)?.role === 'ADMIN') return;

    try {
      const roleInfo = await getMyRole(rid).catch(() => null);
      if (roleInfo) {
        const prevRole = get().role;
        if (prevRole && prevRole !== roleInfo.role) {
          notifications.show({
            title: 'Role Updated',
            message: `Your role has been updated to ${roleInfo.roleName || roleInfo.role}.`,
            color: 'blue',
            autoClose: 5000,
          });
        }

        set({
          role: roleInfo.role,
          roleName: roleInfo.roleName || roleInfo.role,
          permissions: roleInfo.permissions || [],
          allOutlets: roleInfo.allOutlets,
          myOutletIds: roleInfo.outletIds || [],
        });

        if (!roleInfo.allOutlets && roleInfo.outletIds) {
          const outletsRes = await fetch(`${API_BASE}/outlets`, {
            credentials: 'include',
            headers: { 'X-Restaurant-Id': rid },
          }).catch(() => null);

          if (outletsRes && outletsRes.ok) {
            const allO: JsonRestaurantOutletRow[] = await outletsRes.json();
            const scoped = allO.filter((out) => roleInfo.outletIds.includes(out.id));
            const curr = get().activeOutlet;

            let nextChosen = curr;
            if (curr && !roleInfo.outletIds.includes(curr.id)) {
              nextChosen = scoped[0] ?? null;
              if (nextChosen) {
                setCookie(OUTLET_COOKIE, nextChosen.id);
                updateUrlOutletId(nextChosen.id);
              }
            }

            set({
              outlets: scoped,
              activeOutlet: nextChosen,
              isPlanActive: nextChosen ? isSubscriptionActive(nextChosen as any) : true,
              activePlanTier: (nextChosen?.planTier?.toUpperCase() as PlanTier) || 'BASIC',
            });
          }
        }
      } else {
        const restsRes = await fetch(`${API_BASE}/restaurants`, { credentials: 'include' }).catch(() => null);
        if (restsRes && restsRes.ok) {
          const rests: JsonRestaurantRow[] = await restsRes.json();
          set({ myRestaurants: rests });
          const stillMember = rests.some((r) => r.id === rid);
          if (!stillMember) {
            notifications.show({
              title: 'Access Updated',
              message: 'Your access to this restaurant is no longer active.',
              color: 'orange',
              autoClose: 6000,
            });
            if (rests.length > 0) {
              setCookie(RESTAURANT_COOKIE, rests[0].id);
              set({ activeRestaurantId: rests[0].id });
              get().fetchData(rests[0].id);
            } else {
              get().reset();
            }
          }
        }
      }
    } catch {
      // silently ignore network errors
    }
  },

  initFromAuth: async (user: any) => {
    if (!user || user.role === 'ADMIN') {
      get().reset();
      return;
    }

    try {
      const restsRes = await fetch(`${API_BASE}/restaurants`, { credentials: 'include' });
      const rests: JsonRestaurantRow[] = restsRes.ok ? await restsRes.json() : [];
      set({ myRestaurants: rests });

      if (!rests.length) {
        set({ isLoading: false });
        return;
      }

      const savedId = getCookie(RESTAURANT_COOKIE);
      const toLoad = rests.find((r) => r.id === savedId) ?? rests[0];
      if (toLoad) {
        set({ activeRestaurantId: toLoad.id });
        await get().fetchData(toLoad.id);
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
