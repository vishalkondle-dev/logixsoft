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
  items: { name: string; qty: number; pricePaise: number; note?: string | null; round?: number }[];
  subtotalPaise: number;
  method: string | null;
  type: "KOT" | "BILL";
  round?: number;
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

export function buildKotPayload(
  order: any,
  restaurant: any,
  options?: { round?: number; items?: any[] }
): TicketPayload {
  const { date, time } = formatIST(order.order.createdAt);
  const itemsToPrint = options?.items ?? order.items ?? [];
  return {
    orderId: order.order.id,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address ?? "",
    orderNo: order.order.orderNo,
    tableNo: order.order.tableNo ?? null,
    date,
    time,
    items: itemsToPrint.map((i: any) => {
      const addonNames = Array.isArray(i.addons) && i.addons.length > 0 ? i.addons.map((a: any) => a.name).join(", ") : "";
      const noteParts = [i.note, addonNames ? `+ ${addonNames}` : ""].filter(Boolean).join(" | ");
      return {
        name: i.nameSnapshot ?? i.name,
        qty: i.qty,
        pricePaise: i.pricePaiseSnapshot ?? i.pricePaise ?? 0,
        note: noteParts || null,
        round: i.round,
      };
    }),
    subtotalPaise: order.order.subtotalPaise,
    method: null,
    type: "KOT",
    round: options?.round,
  };
}

export function buildBillPayload(
  order: any,
  restaurant: any,
  options?: { items?: any[]; subtotalPaise?: number }
): TicketPayload {
  const { date, time } = formatIST(order.order.createdAt);
  const itemsToPrint = options?.items ?? order.items ?? [];
  return {
    orderId: order.order.id,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address ?? "",
    orderNo: order.order.orderNo,
    tableNo: order.order.tableNo ?? null,
    date,
    time,
    items: itemsToPrint.map((i: any) => {
      const addonNames = Array.isArray(i.addons) && i.addons.length > 0 ? ` (+${i.addons.map((a: any) => a.name).join(", ")})` : "";
      return {
        name: (i.nameSnapshot ?? i.name) + addonNames,
        qty: i.qty,
        pricePaise: i.pricePaiseSnapshot ?? i.pricePaise ?? 0,
        round: i.round,
      };
    }),
    subtotalPaise: options?.subtotalPaise ?? order.order.subtotalPaise,
    method: order.order.paymentMethod ?? null,
    type: "BILL",
  };
}
