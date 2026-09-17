const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

async function apiFetch<T>(path: string, restaurantId: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Restaurant-Id": restaurantId,
      ...((opts.headers as Record<string, string>) ?? {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export const getBootstrap = (restaurantId: string) =>
  apiFetch<any>("/billing/bootstrap", restaurantId);

export const startOrder = (restaurantId: string, body: { outletId: string; tableNo?: string; note?: string }) =>
  apiFetch<any>("/billing/orders", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const getOrder = (restaurantId: string, orderId: string) =>
  apiFetch<any>(`/billing/orders/${orderId}`, restaurantId);

export const listOrders = (restaurantId: string, params?: { status?: string; outletId?: string; limit?: number }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
  ).toString();
  return apiFetch<any[]>(`/billing/orders${qs ? `?${qs}` : ""}`, restaurantId);
};

export const addOrderItem = (restaurantId: string, orderId: string, body: { itemId: string; qty?: number }) =>
  apiFetch<any>(`/billing/orders/${orderId}/items`, restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateOrderItemQty = (restaurantId: string, orderId: string, orderItemId: string, qty: number) =>
  apiFetch<any>(`/billing/orders/${orderId}/items/${orderItemId}`, restaurantId, { method: "PATCH", body: JSON.stringify({ qty }) });

export const removeOrderItem = (restaurantId: string, orderId: string, orderItemId: string) =>
  apiFetch<any>(`/billing/orders/${orderId}/items/${orderItemId}`, restaurantId, { method: "DELETE" });

export const settleOrder = (restaurantId: string, orderId: string, body: { method?: string }) =>
  apiFetch<any>(`/billing/orders/${orderId}/settle`, restaurantId, { method: "POST", body: JSON.stringify(body) });

export const voidOrder = (restaurantId: string, orderId: string) =>
  apiFetch<any>(`/billing/orders/${orderId}/void`, restaurantId, { method: "POST", body: JSON.stringify({}) });

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const getCategories = (restaurantId: string) =>
  apiFetch<any[]>("/menu/categories", restaurantId);

export const createCategory = (restaurantId: string, body: { name: string; description?: string; sortOrder?: number }) =>
  apiFetch<any>("/menu/categories", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateCategory = (restaurantId: string, id: string, body: any) =>
  apiFetch<any>(`/menu/categories/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const deleteCategory = (restaurantId: string, id: string) =>
  apiFetch<any>(`/menu/categories/${id}`, restaurantId, { method: "DELETE" });

export const reorderCategories = (restaurantId: string, items: { id: string; sortOrder: number }[]) =>
  apiFetch<any>("/menu/categories/reorder", restaurantId, { method: "PATCH", body: JSON.stringify(items) });

export const getItems = (restaurantId: string, categoryId?: string) =>
  apiFetch<any[]>(`/menu/items${categoryId ? `?categoryId=${categoryId}` : ""}`, restaurantId);

export const createItem = (restaurantId: string, body: { categoryId: string; name: string; pricePaise: number; description?: string }) =>
  apiFetch<any>("/menu/items", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateItem = (restaurantId: string, id: string, body: any) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const deleteItem = (restaurantId: string, id: string) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, { method: "DELETE" });

export const toggleItem = (restaurantId: string, id: string) =>
  apiFetch<any>(`/menu/items/${id}/toggle`, restaurantId, { method: "PATCH" });

// ─── Restaurant & Outlets ────────────────────────────────────────────────────

export const getRestaurant = (restaurantId: string) =>
  apiFetch<any>("/restaurants/me", restaurantId);

export const updateRestaurant = (restaurantId: string, body: any) =>
  apiFetch<any>(`/restaurants/${restaurantId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const getOutlets = (restaurantId: string) =>
  apiFetch<any[]>("/outlets", restaurantId);

export const createOutlet = (restaurantId: string, body: { name: string; address?: string; phone?: string }) =>
  apiFetch<any>("/outlets", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateOutlet = (restaurantId: string, outletId: string, body: any) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const deleteOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "DELETE" });

export const setDefaultOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}/set-default`, restaurantId, { method: "PATCH" });

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const createRestaurant = async (body: { name: string; address: string; phone?: string; outletName?: string }) => {
  const res = await fetch(`${API_BASE}/onboarding/restaurant`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
};
