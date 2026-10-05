// ─── ESC/POS encoder for 58mm thermal printers (30 chars/line) ───────────────
// Uses standard ASCII and pure hardware alignment for 100% printer compatibility.

import type { TicketPayload } from "./ticket";

const ESC_INIT:     number[] = [0x1b, 0x40];           // Initialize
const MARGIN_ZERO:  number[] = [0x1d, 0x4c, 0x00, 0x00]; // GS L 0 0: Set left margin to 0
const ALIGN_CENTER: number[] = [0x1b, 0x61, 0x01];    // Center
const ALIGN_LEFT:   number[] = [0x1b, 0x61, 0x00];    // Left
const BOLD_ON:      number[] = [0x1b, 0x45, 0x01];    // Bold on
const BOLD_OFF:     number[] = [0x1b, 0x45, 0x00];    // Bold off
const LF:           number[] = [0x0a];                  // Line feed
const CUT:          number[] = [0x1d, 0x56, 0x42, 0x00]; // Full cut + feed

const COLS = 32;
const enc = new TextEncoder();

// Encode a string and LF, padded/truncated to COLS bytes
function row(s: string): number[] {
  const padded = s.slice(0, COLS).padEnd(COLS, " ");
  return [...enc.encode(padded), 0x0a];
}

// Native hardware center alignment without artificial space offsets
function centerText(s: string): number[] {
  return [...ALIGN_CENTER, ...enc.encode(s.trim()), 0x0a, ...ALIGN_LEFT];
}

function dashes(): number[] { return row("-".repeat(COLS)); }
function equals(): number[]  { return row("=".repeat(COLS)); }

// Lay out two strings at left and right within COLS, clamping to fit
function twoCol(left: string, right: string): number[] {
  const maxLeft = Math.max(0, COLS - right.length);
  const l = left.slice(0, maxLeft).padEnd(maxLeft, " ");
  return [...enc.encode((l + right).slice(0, COLS)), 0x0a];
}

export function encodeTicket(p: TicketPayload): Uint8Array {
  const parts: number[][] = [];
  const push = (...chunks: number[][]) => parts.push(...chunks);

  push(ESC_INIT);
  push(MARGIN_ZERO);

  // ── Header ──
  push(BOLD_ON);
  push(centerText(p.restaurantName.toUpperCase()));
  push(BOLD_OFF);
  if (p.restaurantAddress) {
    for (let i = 0; i < p.restaurantAddress.length; i += COLS) {
      push(centerText(p.restaurantAddress.slice(i, i + COLS)));
    }
  }
  push(equals());

  // ── Type label ──
  push(BOLD_ON);
  push(centerText(p.type === "KOT" ? (p.round && p.round > 1 ? `KOT - ROUND ${p.round}` : "KOT - KITCHEN ORDER") : "TAX INVOICE"));
  push(BOLD_OFF);
  push(equals());

  // ── Order meta ──
  push(ALIGN_LEFT);
  const tablePart = p.tableNo ? `Table: ${p.tableNo}` : "";
  push(twoCol(`Token #: ${p.orderNo}${p.round && p.round > 1 ? ` (R${p.round})` : ""}`, tablePart));
  if (p.orderId) push(row(`Order ID: ${p.orderId}`));
  push(twoCol(`Date: ${p.date}`, `Time: ${p.time}`));
  push(dashes());

  if (p.orderType === "DELIVERY" || p.delivery) {
    push(BOLD_ON);
    push(centerText("*** DELIVERY ORDER ***"));
    push(BOLD_OFF);
    if (p.delivery?.customerName) push(row(`Cust: ${p.delivery.customerName}`));
    if (p.delivery?.customerPhone) push(row(`Phone: ${p.delivery.customerPhone}`));
    if (p.delivery?.address) push(row(`Addr: ${p.delivery.address}`));
    if (p.delivery?.landmark) push(row(`Landmark: ${p.delivery.landmark}`));
    if (p.delivery?.deliveryNotes) push(row(`Notes: ${p.delivery.deliveryNotes}`));
    push(dashes());
  }

  if (p.type === "KOT") {
    // ── KOT items: Qty  Item ──
    push(row("Qty  Item"));
    push(dashes());
    for (const item of p.items) {
      const qty = String(item.qty).padStart(3, " ");
      const name = item.name.slice(0, COLS - 5);
      push([...enc.encode(`${qty}  ${name}`), 0x0a]);
    }
  } else {
    // ── Bill items: Name | Qty | Amt ──
    // Columns: name=16, qty=4, amt=12 → 32
    push(row("Item".padEnd(16) + "Qty".padStart(4) + "Amt".padStart(12)));
    push(dashes());
    for (const item of p.items) {
      const name = item.name.slice(0, 16).padEnd(16);
      const qty = String(item.qty).padStart(4);
      const amtNum = (item.pricePaise * item.qty / 100).toFixed(2);
      const amt = `Rs.${amtNum}`.padStart(12);
      push(row(name + qty + amt));
    }
    push(dashes());

    if (p.packagingChargePaise && p.packagingChargePaise > 0) {
      const pkgAmt = `Rs.${(p.packagingChargePaise / 100).toFixed(2)}`;
      push(twoCol("Packaging:", pkgAmt));
    }
    if (p.deliveryChargePaise && p.deliveryChargePaise > 0) {
      const delAmt = `Rs.${(p.deliveryChargePaise / 100).toFixed(2)}`;
      push(twoCol("Delivery:", delAmt));
    }
    if (p.adjustments && Array.isArray(p.adjustments) && p.adjustments.length > 0) {
      for (const adj of p.adjustments) {
        const sign = adj.amountPaise < 0 ? "-" : "";
        const amtStr = `${sign}Rs.${(Math.abs(adj.amountPaise) / 100).toFixed(2)}`;
        push(twoCol(`${adj.label}:`, amtStr));
      }
    }

    // Total - guaranteed single line within 30 cols
    const totalAmt = `Rs.${(p.subtotalPaise / 100).toFixed(2)}`;
    push(BOLD_ON);
    push(twoCol("TOTAL:", totalAmt));
    push(BOLD_OFF);

    if (p.method) {
      push(equals());
      push(centerText(`Payment: ${p.method}`));
    }
  }

  push(equals());
  push(centerText("Thank you! Please visit again"));
  push(centerText("LogixDine by LogixSoft"));
  push(centerText("Contact: 7276718848"));
  push(equals());
  if (p.type === "KOT") {
    push(LF, LF);
  } else {
    push(LF, LF);
  }
  push(CUT);

  const flat = parts.flat();
  return new Uint8Array(flat);
}
