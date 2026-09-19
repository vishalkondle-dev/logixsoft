// ─── ESC/POS encoder for 58mm thermal printers (32 chars/line) ───────────────
// ₹ is encoded as UTF-8 (3 bytes). Most modern 58mm printers handle it;
// if yours doesn't, swap RUPEE below to "Rs." and adjust column math.

import type { TicketPayload } from "./ticket";

const ESC_INIT:     number[] = [0x1b, 0x40];           // Initialize
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

function centered(s: string): number[] {
  const t = s.slice(0, COLS);
  const pad = Math.max(0, Math.floor((COLS - t.length) / 2));
  return [...enc.encode(" ".repeat(pad) + t), 0x0a];
}

function dashes(): number[] { return row("-".repeat(COLS)); }
function equals(): number[]  { return row("=".repeat(COLS)); }

// Lay out two strings at left and right within COLS, clamping to fit
function twoCol(left: string, right: string): number[] {
  const maxLeft = COLS - right.length;
  const l = left.slice(0, maxLeft).padEnd(maxLeft, " ");
  return [...enc.encode((l + right).slice(0, COLS)), 0x0a];
}

export function encodeTicket(p: TicketPayload): Uint8Array {
  const parts: number[][] = [];
  const push = (...chunks: number[][]) => parts.push(...chunks);

  push(ESC_INIT);

  // ── Header ──
  push(ALIGN_CENTER, BOLD_ON);
  push(centered(p.restaurantName.toUpperCase()));
  push(BOLD_OFF);
  if (p.restaurantAddress) {
    // Wrap address naively at COLS chars
    for (let i = 0; i < p.restaurantAddress.length; i += COLS) {
      push(centered(p.restaurantAddress.slice(i, i + COLS).trim()));
    }
  }
  push(equals());

  // ── Type label ──
  push(BOLD_ON);
  push(centered(p.type === "KOT" ? (p.round && p.round > 1 ? `KOT - ROUND ${p.round}` : "KOT - KITCHEN ORDER") : "TAX INVOICE"));
  push(BOLD_OFF);
  push(equals());

  // ── Order meta ──
  push(ALIGN_LEFT);
  const tablePart = p.tableNo ? `Table: ${p.tableNo}` : "";
  push(twoCol(`Token #: ${p.orderNo}${p.round && p.round > 1 ? ` (R${p.round})` : ""}`, tablePart));
  if (p.orderId) push(row(`Order ID: ${p.orderId}`));
  push(twoCol(`Time: ${p.time}`, `Date: ${p.date}`));
  push(dashes());

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
    // Columns: name=17, qty=4, amt=9, padding=2 → 32
    push(row("Item".padEnd(17) + "Qty".padStart(4) + "Amt".padStart(9) + "  "));
    push(dashes());
    for (const item of p.items) {
      const name = item.name.slice(0, 17).padEnd(17);
      const qty = String(item.qty).padStart(4);
      const amtNum = (item.pricePaise * item.qty / 100).toFixed(0);
      const amt = `Rs${amtNum}`.padStart(9);
      push(row(name + qty + amt + "  "));
    }
    push(dashes());

    // Total
    const totalAmt = `Rs${(p.subtotalPaise / 100).toFixed(0)}`;
    push(BOLD_ON);
    push(twoCol("TOTAL:".padStart(COLS - totalAmt.length - 1), totalAmt));
    push(BOLD_OFF);

    push(equals());
    if (p.method) push(centered(`Payment: ${p.method}`));
  }

  push(equals());
  push(centered("Thank you! Please visit again"));
  push(equals());
  push(LF, LF, LF);
  push(CUT);

  const flat = parts.flat();
  return new Uint8Array(flat);
}
