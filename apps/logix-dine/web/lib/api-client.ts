const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

async function apiFetch<T>(
  path: string,
  restaurantId: string,
  opts: RequestInit = {},
  outletId?: string | null,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Restaurant-Id": restaurantId,
      ...(outletId ? { "X-Outlet-Id": outletId } : {}),
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

export const getBootstrap = (restaurantId: string, outletId?: string | null) =>
  apiFetch<any>(`/billing/bootstrap${outletId ? `?outletId=${outletId}` : ""}`, restaurantId, {}, outletId);

export const startOrder = (
  restaurantId: string,
  body: {
    outletId: string;
    tableNo?: string;
    customerPhone?: string;
    note?: string;
    items?: Array<{ itemId: string; qty: number; note?: string; variantId?: string; addonIds?: string[] }>;
  }
) => apiFetch<any>("/billing/orders", restaurantId, { method: "POST", body: JSON.stringify(body) }, body.outletId);

export const getOrder = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(`/billing/orders/${orderId}`, restaurantId, {}, outletId);

export const listOrders = (restaurantId: string, params?: { status?: string; orderStatus?: string; outletId?: string; limit?: number; tableOccupied?: boolean }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
  ).toString();
  return apiFetch<any[]>(`/billing/orders${qs ? `?${qs}` : ""}`, restaurantId, {}, params?.outletId);
};

export const addOrderItem = (
  restaurantId: string,
  orderId: string,
  body: { itemId: string; qty?: number; note?: string; variantId?: string; addonIds?: string[] },
  outletId?: string | null
) =>
  apiFetch<any>(`/billing/orders/${orderId}/items`, restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId);

export const addOrderRound = (
  restaurantId: string,
  orderId: string,
  body: {
    items: Array<{ itemId: string; qty: number; note?: string; variantId?: string; addonIds?: string[] }>;
    settle?: { method: string };
  },
  outletId?: string | null
) =>
  apiFetch<any>(`/billing/orders/${orderId}/round`, restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId);

export const freeTableOrder = (
  restaurantId: string,
  orderId: string,
  body?: { method?: string },
  outletId?: string | null
) =>
  apiFetch<any>(`/billing/orders/${orderId}/free-table`, restaurantId, { method: "POST", body: JSON.stringify(body ?? {}) }, outletId);

export const updateOrderItemQty = (restaurantId: string, orderId: string, orderItemId: string, qty: number, outletId?: string | null) =>
  apiFetch<any>(`/billing/orders/${orderId}/items/${orderItemId}`, restaurantId, { method: "PATCH", body: JSON.stringify({ qty }) }, outletId);

export const updateOrderItemStatus = (
  restaurantId: string,
  orderId: string,
  orderItemId: string,
  body: { status?: string; action?: "next" | "close" | "cancel" },
  outletId?: string | null
) =>
  apiFetch<any>(
    `/billing/orders/${orderId}/items/${orderItemId}/status`,
    restaurantId,
    { method: "PATCH", body: JSON.stringify(body) },
    outletId
  );

export const removeOrderItem = (restaurantId: string, orderId: string, orderItemId: string, outletId?: string | null) =>
  apiFetch<any>(`/billing/orders/${orderId}/items/${orderItemId}`, restaurantId, { method: "DELETE" }, outletId);

export const settleOrder = (
  restaurantId: string,
  orderId: string,
  body: { method?: string; customerPhone?: string },
  outletId?: string | null
) => apiFetch<any>(`/billing/orders/${orderId}/settle`, restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId);

/** Create + settle in a single API call — faster Settle & Send. */
export const createSettledOrder = (
  restaurantId: string,
  body: {
    outletId: string;
    tableNo?: string;
    customerPhone?: string;
    note?: string;
    method?: string;
    items?: Array<{ itemId: string; qty: number; note?: string; variantId?: string; addonIds?: string[] }>;
  }
) => apiFetch<any>("/billing/orders/create-settled", restaurantId, { method: "POST", body: JSON.stringify(body) }, body.outletId);

export const sendOrderWhatsApp = (
  restaurantId: string,
  orderId: string,
  body: { phone?: string },
  outletId?: string | null
) => apiFetch<any>(`/billing/orders/${orderId}/whatsapp`, restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId);

export const voidOrder = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(`/billing/orders/${orderId}/void`, restaurantId, { method: "POST", body: JSON.stringify({}) }, outletId);

export const markKotPrinted = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(`/billing/orders/${orderId}/mark-kot-printed`, restaurantId, { method: "PATCH" }, outletId);

// ─── Kitchen Display (KDS) ──────────────────────────────────────────────────────

export const getKitchenOrders = (restaurantId: string, outletId?: string | null) =>
  apiFetch<any[]>("/billing/orders/kitchen", restaurantId, {}, outletId);

export const markOrderReady = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(`/billing/orders/${orderId}/mark-ready`, restaurantId, { method: "PATCH" }, outletId);

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const getCategories = (restaurantId: string, outletId?: string | null) =>
  apiFetch<any[]>(`/menu/categories${outletId ? `?outletId=${outletId}` : ""}`, restaurantId, {}, outletId);

export const createCategory = (restaurantId: string, body: { name: string; description?: string; sortOrder?: number; outletId?: string | null }, outletId?: string | null) =>
  apiFetch<any>("/menu/categories", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId ?? body.outletId);

export const updateCategory = (restaurantId: string, id: string, body: any, outletId?: string | null) =>
  apiFetch<any>(`/menu/categories/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) }, outletId);

export const deleteCategory = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/categories/${id}`, restaurantId, { method: "DELETE" }, outletId);

export const reorderCategories = (restaurantId: string, items: { id: string; sortOrder: number }[], outletId?: string | null) =>
  apiFetch<any>("/menu/categories/reorder", restaurantId, { method: "PATCH", body: JSON.stringify(items) }, outletId);

export const getItems = (restaurantId: string, categoryId?: string, outletId?: string | null) => {
  const params = new URLSearchParams();
  if (categoryId) params.append("categoryId", categoryId);
  if (outletId) params.append("outletId", outletId);
  const qs = params.toString();
  return apiFetch<any[]>(`/menu/items${qs ? `?${qs}` : ""}`, restaurantId, {}, outletId);
};

export const getItem = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, {}, outletId);

export const createItem = (
  restaurantId: string,
  body: {
    categoryId: string;
    name: string;
    pricePaise: number;
    description?: string;
    outletId?: string | null;
    variants?: any[];
    addons?: any[];
  },
  outletId?: string | null
) =>
  apiFetch<any>("/menu/items", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId ?? body.outletId);

export const updateItem = (restaurantId: string, id: string, body: any, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) }, outletId);

export const deleteItem = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, { method: "DELETE" }, outletId);

export const toggleItem = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}/toggle`, restaurantId, { method: "PATCH" }, outletId);

// ─── Restaurant & Outlets ────────────────────────────────────────────────────

export const getRestaurant = (restaurantId: string) =>
  apiFetch<any>("/restaurants/me", restaurantId);

export const updateRestaurant = (restaurantId: string, body: any) =>
  apiFetch<any>(`/restaurants/${restaurantId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const getMyRole = (restaurantId: string) =>
  apiFetch<{ role: string; outletIds: string[]; allOutlets: boolean }>("/restaurants/my-role", restaurantId);

export const getOutlets = (restaurantId: string) =>
  apiFetch<any[]>("/outlets", restaurantId);

export const createOutlet = (restaurantId: string, body: { name: string; address?: string; phone?: string; upiId?: string }) =>
  apiFetch<any>("/outlets", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateOutlet = (restaurantId: string, outletId: string, body: any) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const deleteOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "DELETE" });

export const setDefaultOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}/set-default`, restaurantId, { method: "PATCH" });

// ─── Staff ───────────────────────────────────────────────────────────────────

export const listStaff = (restaurantId: string) =>
  apiFetch<any[]>("/staff", restaurantId);

export const inviteStaff = (restaurantId: string, body: { phone: string; role: string; outletIds: string[] }) =>
  apiFetch<any>("/staff/invite", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateStaff = (restaurantId: string, memberId: string, body: { role?: string; outletIds?: string[] }) =>
  apiFetch<any>(`/staff/${memberId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const removeStaff = (restaurantId: string, memberId: string) =>
  apiFetch<any>(`/staff/${memberId}`, restaurantId, { method: "DELETE" });

// ─── Tables ──────────────────────────────────────────────────────────────────

export const getTables = (restaurantId: string, outletId?: string) =>
  apiFetch<any[]>(`/tables${outletId ? `?outletId=${outletId}` : ""}`, restaurantId, {}, outletId);

export const createTable = (restaurantId: string, body: { outletId: string; name: string; section?: string; capacity?: number }) =>
  apiFetch<any>("/tables", restaurantId, { method: "POST", body: JSON.stringify(body) }, body.outletId);

export const updateTable = (restaurantId: string, tableId: string, body: any, outletId?: string) =>
  apiFetch<any>(`/tables/${tableId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) }, outletId);

export const toggleTable = (restaurantId: string, tableId: string, outletId?: string) =>
  apiFetch<any>(`/tables/${tableId}/toggle`, restaurantId, { method: "PATCH" }, outletId);

export const deleteTable = (restaurantId: string, tableId: string, outletId?: string) =>
  apiFetch<any>(`/tables/${tableId}`, restaurantId, { method: "DELETE" }, outletId);

// ─── Reports ─────────────────────────────────────────────────────────────────

export type ReportType = "summary" | "top-items" | "orders-by-status" | "payment-methods" | "hourly" | "daily-trend";

export const getReport = (restaurantId: string, type: ReportType, from: string, to: string, outletId?: string | null) => {
  const qs = new URLSearchParams({ from, to, ...(outletId ? { outletId } : {}) }).toString();
  return apiFetch<{ type: string; from: string; to: string; outletId: string | null; data: any }>(
    `/reports/${type}?${qs}`,
    restaurantId,
    {},
    outletId,
  );
};

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
