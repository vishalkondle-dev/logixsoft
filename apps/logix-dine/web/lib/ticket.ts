// ─── Canonical ticket payload ─────────────────────────────────────────────────
// Both ESC/POS encoder and HTML fallback consume this shape.

export interface TicketPayload {
  orderId?: string;
  restaurantName: string;
  restaurantAddress: string;
  orderNo: number;
  tableNo: string | null;
  date: string;  // "17/09/2026"
  time: string;  // "05:33 PM"
  items: { name: string; qty: number; pricePaise: number; note?: string | null }[];
  subtotalPaise: number;
  method: string | null;
  type: "KOT" | "BILL";
}

/** Format an ISO timestamp in IST (UTC+5:30). */
function formatIST(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = ist.getUTCFullYear();
  const hRaw = ist.getUTCHours();
  const min = String(ist.getUTCMinutes()).padStart(2, "0");
  const ampm = hRaw >= 12 ? "PM" : "AM";
  const h12 = String(hRaw % 12 || 12).padStart(2, "0");
  return { date: `${dd}/${mm}/${yyyy}`, time: `${h12}:${min} ${ampm}` };
}

export function buildKotPayload(order: any, restaurant: any): TicketPayload {
  const { date, time } = formatIST(order.order.createdAt);
  return {
    orderId: order.order.id,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address ?? "",
    orderNo: order.order.orderNo,
    tableNo: order.order.tableNo ?? null,
    date,
    time,
    items: (order.items ?? []).map((i: any) => ({
      name: i.nameSnapshot ?? i.name,
      qty: i.qty,
      pricePaise: i.pricePaiseSnapshot ?? i.pricePaise ?? 0,
      note: i.note ?? null,
    })),
    subtotalPaise: order.order.subtotalPaise,
    method: null,
    type: "KOT",
  };
}

export function buildBillPayload(order: any, restaurant: any): TicketPayload {
  const { date, time } = formatIST(order.order.createdAt);
  return {
    orderId: order.order.id,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address ?? "",
    orderNo: order.order.orderNo,
    tableNo: order.order.tableNo ?? null,
    date,
    time,
    items: (order.items ?? []).map((i: any) => ({
      name: i.name,
      qty: i.qty,
      pricePaise: i.pricePaiseSnapshot ?? i.pricePaise ?? 0,
    })),
    subtotalPaise: order.order.subtotalPaise,
    method: order.order.paymentMethod ?? null,
    type: "BILL",
  };
}
