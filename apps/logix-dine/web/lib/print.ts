// ─── Print dispatcher ─────────────────────────────────────────────────────────
// 1. Desktop PC / Electron silent thermal printing (via window.logixDinePC.printReceipt)
// 2. BLE available + paired  → ESC/POS via bluetooth-printer
// 3. System / Browser Default Paired Printer → Invisible iframe print directly to default printer

import type { TicketPayload } from "./ticket";
import { encodeTicket } from "./escpos";
import { isPaired, print as blePrint, isSupported } from "./bluetooth-printer";

export type PrintResult = "ble" | "browser" | "error";

export async function printTicket(payload: TicketPayload): Promise<PrintResult> {
  const html = generateTicketHtml(payload);

  // 1. Desktop PC / Electron silent thermal printing
  if (typeof window !== "undefined" && (window as any).logixDinePC?.printReceipt) {
    try {
      const res = await (window as any).logixDinePC.printReceipt({
        silent: true,
        html,
        type: payload.type,
        orderNo: payload.orderNo,
        restaurantName: payload.restaurantName,
        items: payload.items,
        time: payload.time,
        date: payload.date,
        subtotalPaise: payload.subtotalPaise,
        delivery: payload.delivery,
      });
      if (res?.success !== false) return "ble";
    } catch (err) {
      console.error("[print] Desktop PC print failed:", err);
    }
  }

  // 2. Bluetooth thermal printer (Web Bluetooth) - print only if valid printer is paired/connected
  if (isPaired()) {
    try {
      const bytes = encodeTicket(payload);
      await blePrint(bytes);
      return "ble";
    } catch (err) {
      console.error("[print] BLE thermal print failed:", err);
    }
  }

  // 3. Fallback to hidden iframe printing for standard USB / OS default thermal printers
  if (typeof window !== "undefined") {
    try {
      printHtml(payload);
      return "browser";
    } catch (err) {
      console.error("[print] Browser fallback print failed:", err);
    }
  }

  return "error";
}

/**
 * Print ticket silently to thermal printer (Electron or Web Bluetooth).
 * Never triggers browser print modal.
 */
export async function printTicketSilent(payload: TicketPayload): Promise<PrintResult> {
  const html = generateTicketHtml(payload);

  // 1. Desktop PC / Electron silent thermal printing
  if (typeof window !== "undefined" && (window as any).logixDinePC?.printReceipt) {
    try {
      const res = await (window as any).logixDinePC.printReceipt({
        silent: true,
        html,
        type: payload.type,
        orderNo: payload.orderNo,
        restaurantName: payload.restaurantName,
        items: payload.items,
        time: payload.time,
        date: payload.date,
        subtotalPaise: payload.subtotalPaise,
        delivery: payload.delivery,
      });
      if (res?.success !== false) return "ble";
    } catch (err) {
      console.error("[print] Desktop PC print failed:", err);
    }
  }

  // 2. Bluetooth thermal printer (Web Bluetooth)
  if (isPaired()) {
    try {
      const bytes = encodeTicket(payload);
      await blePrint(bytes);
      return "ble";
    } catch (err) {
      console.error("[print] BLE thermal print failed:", err);
    }
  }

  return "error";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateTicketHtml(payload: TicketPayload): string {
  const isKot = payload.type === "KOT";

  const itemRows = isKot
    ? payload.items
        .map(
          (i) =>
            `<tr>
              <td style="text-align:center;padding:1px 2px 1px 0;vertical-align:top;font-weight:bold">${i.qty}×</td>
              <td style="text-align:left;padding:1px 0;vertical-align:top">${esc(i.name)}${i.note ? `<br/><small style="color:#444;font-size:10px"><em>(${esc(i.note)})</em></small>` : ''}</td>
            </tr>`
        )
        .join("")
    : payload.items
        .map(
          (i) =>
            `<tr>
              <td style="text-align:left;padding:1px 2px 1px 0;vertical-align:top">${esc(i.name)}${i.note ? `<br/><small style="color:#444;font-size:10px"><em>(${esc(i.note)})</em></small>` : ''}</td>
              <td style="text-align:center;padding:1px 2px;vertical-align:top">${i.qty}</td>
              <td style="text-align:right;white-space:nowrap;padding:1px 0;vertical-align:top">Rs.${(
                (i.pricePaise * i.qty) /
                100
              ).toFixed(2)}</td>
            </tr>`
        )
        .join("");

  const packagingRow = (payload.packagingChargePaise && payload.packagingChargePaise > 0)
    ? `<tr><td colspan="2" style="padding:1px 0">Packaging</td><td style="text-align:right;padding:1px 0">Rs.${(payload.packagingChargePaise / 100).toFixed(2)}</td></tr>`
    : "";
  const deliveryRow = (payload.deliveryChargePaise && payload.deliveryChargePaise > 0)
    ? `<tr><td colspan="2" style="padding:1px 0">Delivery</td><td style="text-align:right;padding:1px 0">Rs.${(payload.deliveryChargePaise / 100).toFixed(2)}</td></tr>`
    : "";
  const adjustmentsRows = (payload.adjustments && Array.isArray(payload.adjustments) && payload.adjustments.length > 0)
    ? payload.adjustments
        .map((a) => {
          const sign = a.amountPaise < 0 ? "-" : "";
          const amt = `${sign}Rs.${(Math.abs(a.amountPaise) / 100).toFixed(2)}`;
          return `<tr><td colspan="2" style="padding:1px 0">${esc(a.label)}</td><td style="text-align:right;padding:1px 0">${amt}</td></tr>`;
        })
        .join("")
    : "";

  const hasExtraCharges = Boolean(packagingRow || deliveryRow || adjustmentsRows);

  const totalSection = !isKot
    ? `<tr><td colspan="3"><hr style="border:none;border-top:1px dashed #000;margin:3px 0"/></td></tr>
       ${packagingRow}
       ${deliveryRow}
       ${adjustmentsRows}
       ${hasExtraCharges ? `<tr><td colspan="3"><hr style="border:none;border-top:1px dashed #000;margin:3px 0"/></td></tr>` : ""}
       <tr style="font-size:12px;font-weight:bold;white-space:nowrap">
         <td colspan="2" style="padding:2px 0;text-align:left;white-space:nowrap">TOTAL</td>
         <td style="text-align:right;padding:2px 0;white-space:nowrap">Rs.${(payload.subtotalPaise / 100).toFixed(2)}</td>
       </tr>
       ${
         payload.method
           ? `<tr><td colspan="3" style="padding-top:3px;font-size:10px;text-align:center">Payment Mode: <b>${esc(payload.method)}</b></td></tr>`
           : ""
       }`
    : "";

  const deliverySection = (payload.orderType === "DELIVERY" || payload.delivery)
    ? `<div style="margin:3px 0;padding:4px 5px;border:1px dashed #000;font-size:11px;border-radius:2px">
         <div class="c" style="font-weight:bold;margin-bottom:2px">*** DELIVERY ORDER ***</div>
         ${payload.delivery?.customerName ? `<div><b>Cust:</b> ${esc(payload.delivery.customerName)}</div>` : ""}
         ${payload.delivery?.customerPhone ? `<div><b>Phone:</b> ${esc(payload.delivery.customerPhone)}</div>` : ""}
         ${payload.delivery?.address ? `<div><b>Addr:</b> ${esc(payload.delivery.address)}</div>` : ""}
         ${payload.delivery?.landmark ? `<div><b>Landmark:</b> ${esc(payload.delivery.landmark)}</div>` : ""}
         ${payload.delivery?.deliveryNotes ? `<div><b>Notes:</b> ${esc(payload.delivery.deliveryNotes)}</div>` : ""}
       </div>`
    : "";

  const colHeaders = isKot
    ? `<colgroup><col style="width:20%"/><col style="width:80%"/></colgroup>
       <thead><tr style="font-weight:bold;border-bottom:1px dashed #000"><th style="text-align:center;padding:1px 0">Qty</th><th style="text-align:left;padding:1px 0">Item</th></tr></thead>`
    : `<colgroup><col style="width:52%"/><col style="width:14%"/><col style="width:34%"/></colgroup>
       <thead><tr style="font-weight:bold;border-bottom:1px dashed #000"><th style="text-align:left;padding:1px 0">Item</th><th style="text-align:center;padding:1px 0">Qty</th><th style="text-align:right;padding:1px 0">Amt</th></tr></thead>`;

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${isKot ? "KOT" : "Bill"} #${payload.orderNo}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background-color: #ffffff;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.3;
  color: #000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
}
.receipt {
  width: 236px;
  max-width: 100%;
  margin: 0 auto;
  background: #ffffff;
  padding: 6px 0 ${isKot ? "6px" : "4px"} 0;
  box-sizing: border-box;
}
.c { text-align: center; }
hr.d { border: none; border-top: 1px dashed #000; margin: 3px 0; }
table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
table td, table th { word-break: break-word; padding: 1px 0; }
@media print {
  @page {
    margin: 0;
    size: auto;
  }
  html, body {
    background: #ffffff !important;
    display: block !important;
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .receipt {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 0 ${isKot ? "3mm" : "2mm"} 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
}
</style>
</head><body>
<div class="receipt">
  <div class="c" style="font-size:14px;font-weight:bold;letter-spacing:0.5px">${esc(payload.restaurantName.toUpperCase())}</div>
  ${payload.restaurantAddress ? `<div class="c" style="font-size:10px;color:#333;margin-top:2px">${esc(payload.restaurantAddress)}</div>` : ""}
  <hr class="d"/>
  <div class="c" style="font-weight:bold;font-size:12px;letter-spacing:1px">${isKot ? (payload.round && payload.round > 1 ? `KOT – ROUND ${payload.round}` : "KOT – KITCHEN ORDER") : "TAX INVOICE"}</div>
  <hr class="d"/>
  <table style="table-layout:auto">
    <tr>
      <td style="text-align:left"><b>Token #${payload.orderNo}${payload.round && payload.round > 1 ? ` (R${payload.round})` : ""}</b></td>
      <td style="text-align:right">${payload.tableNo ? `<b>Table:</b> ${esc(payload.tableNo)}` : ""}</td>
    </tr>
    ${payload.orderId ? `<tr><td colspan="2" style="font-size:10px;color:#555;padding:1px 0">Order ID: ${esc(payload.orderId)}</td></tr>` : ""}
    <tr>
      <td style="text-align:left;white-space:nowrap">${payload.date}</td>
      <td style="text-align:right;white-space:nowrap">${payload.time}</td>
    </tr>
  </table>
  ${deliverySection}
  <hr class="d"/>
  <table class="items-table">${colHeaders}<tbody>${itemRows}</tbody><tfoot>${totalSection}</tfoot></table>
  <hr class="d"/>
  <div class="c" style="font-size:11px;font-weight:bold;margin-top:3px">Thank you! Please visit again</div>
  <div class="c" style="font-size:10px;font-weight:bold;color:#222;margin-top:5px">LogixDine by LogixSoft</div>
  <div class="c" style="font-size:10px;color:#333">Contact: 7276718848</div>
  <div style="height:${isKot ? "6px" : "2px"};width:100%"></div>
</div>
</body></html>`;
}

export function printHtml(payload: TicketPayload): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const html = generateTicketHtml(payload);

  // Hidden print iframe avoids popup blockers and prints directly to the OS default paired printer
  let iframe = document.getElementById("__dine_print_frame__") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "__dine_print_frame__";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "10px";
    iframe.style.height = "10px";
    iframe.style.opacity = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) return;

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn("[print] Iframe print exception, fallback to window popup:", e);
      try {
        const w = window.open("", "_blank", "width=340,height=680,toolbar=0,menubar=0");
        if (w) {
          w.document.write(html);
          w.document.close();
        }
      } catch (_) {}
    }
  }, 250);
}
