// ─── Print dispatcher ─────────────────────────────────────────────────────────
// 1. BLE available + paired  → ESC/POS via bluetooth-printer
// 2. Fallback                → HTML popup → window.print()

import type { TicketPayload } from "./ticket";
import { encodeTicket } from "./escpos";
import { isPaired, print as blePrint, isSupported } from "./bluetooth-printer";

export type PrintResult = "ble" | "browser" | "error";

export async function printTicket(payload: TicketPayload): Promise<PrintResult> {
  if (isSupported() && isPaired()) {
    try {
      const bytes = encodeTicket(payload);
      await blePrint(bytes);
      return "ble";
    } catch (err) {
      console.error("[print] BLE failed, falling back to browser print:", err);
    }
  }
  try {
    printHtml(payload);
    return "browser";
  } catch (err) {
    console.error("[print] HTML print failed:", err);
    return "error";
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printHtml(payload: TicketPayload): void {
  const isKot = payload.type === "KOT";

  const itemRows = isKot
    ? payload.items
        .map(
          (i) =>
            `<tr><td style="padding-right:6px;white-space:nowrap;vertical-align:top">${i.qty}×</td><td>${esc(i.name)}${i.note ? `<br/><small style="color:#555;font-size:11px"><em>(${esc(i.note)})</em></small>` : ''}</td></tr>`
        )
        .join("")
    : payload.items
        .map(
          (i) =>
            `<tr>
              <td style="padding-right:4px">${esc(i.name)}${i.note ? `<br/><small style="color:#555;font-size:11px"><em>(${esc(i.note)})</em></small>` : ''}</td>
              <td style="text-align:center;padding:0 4px;vertical-align:top">${i.qty}</td>
              <td style="text-align:right;white-space:nowrap;vertical-align:top">Rs${(
                (i.pricePaise * i.qty) /
                100
              ).toFixed(0)}</td>
            </tr>`
        )
        .join("");

  const totalSection = !isKot
    ? `<tr><td colspan="3"><hr style="border:none;border-top:1px dashed #000;margin:3px 0"/></td></tr>
       <tr>
         <td colspan="2"><b>TOTAL</b></td>
         <td style="text-align:right"><b>Rs${(payload.subtotalPaise / 100).toFixed(0)}</b></td>
       </tr>
       ${
         payload.method
           ? `<tr><td colspan="3" style="padding-top:4px;font-size:10px">Payment: ${esc(payload.method)}</td></tr>`
           : ""
       }`
    : "";

  const colHeaders = isKot
    ? `<tr style="font-weight:bold"><td>Qty</td><td>Item</td></tr>`
    : `<tr style="font-weight:bold"><td>Item</td><td style="text-align:center">Qty</td><td style="text-align:right">Amt</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${isKot ? "KOT" : "Bill"} #${payload.orderNo}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:12px;width:216px;padding:6px 4px}
.c{text-align:center}
hr.d{border:none;border-top:1px solid #000;margin:3px 0}
table{width:100%;border-collapse:collapse;font-size:12px}
@media print{@page{size:58mm auto;margin:2mm}body{width:auto;padding:0}}
</style>
</head><body>
<div class="c"><b>${esc(payload.restaurantName.toUpperCase())}</b></div>
${payload.restaurantAddress ? `<div class="c" style="font-size:10px">${esc(payload.restaurantAddress)}</div>` : ""}
<hr class="d"/>
<div class="c"><b>${isKot ? "KOT – KITCHEN ORDER" : "TAX INVOICE"}</b></div>
<hr class="d"/>
<table>
  <tr><td>Order #${payload.orderNo}</td><td style="text-align:right">${payload.tableNo ? `Table: ${esc(payload.tableNo)}` : ""}</td></tr>
  <tr><td>${payload.time}</td><td style="text-align:right">${payload.date}</td></tr>
</table>
<hr class="d"/>
<table>${colHeaders}${itemRows}${totalSection}</table>
<hr class="d"/>
<div class="c" style="font-size:11px">Thank you! Please visit again</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},800)}</script>
</body></html>`;

  const w = window.open("", "_blank", "width=300,height=600,toolbar=0,menubar=0");
  if (!w) {
    alert("Pop-up blocked. Please allow pop-ups to print.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
