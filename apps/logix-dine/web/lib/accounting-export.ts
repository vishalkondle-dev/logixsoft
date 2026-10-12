/**
 * Tally Prime / Tally ERP 9 & Marg ERP Export Utilities for Logix Dine
 * Generates verified XML and CSV export formats for Indian Restaurant Accounting.
 */

export interface TallyLedgerConfig {
  companyName: string;
  salesLedger: string;
  cashLedger: string;
  bankLedger: string;
  cardLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  discountLedger: string;
  roundOffLedger: string;
  chargesLedger: string;
  serviceChargeLedger: string;
  placeOfSupply?: string;
}

export const DEFAULT_TALLY_CONFIG: TallyLedgerConfig = {
  companyName: "Logix Dine Restaurant",
  salesLedger: "F&B Sales Account",
  cashLedger: "Cash",
  bankLedger: "Bank Account (UPI)",
  cardLedger: "Card Settlement Account",
  cgstLedger: "Output CGST 2.5%",
  sgstLedger: "Output SGST 2.5%",
  igstLedger: "Output IGST 5%",
  discountLedger: "Discount Allowed",
  roundOffLedger: "Round Off",
  chargesLedger: "Packaging & Delivery Charges",
  serviceChargeLedger: "Service Charges",
  placeOfSupply: "Local State",
};

export interface InvoiceRecord {
  id: string;
  orderNo: number | string;
  createdAt: string | Date;
  settledAt?: string | Date | null;
  tableNo?: string;
  tableSection?: string;
  orderType?: string;
  customerPhone?: string | null;
  status: string;
  orderStatus?: string;
  method?: string | null;
  subtotalPaise: number;
  grossPaise?: number;
  discountPaise?: number;
  netSalesPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  serviceChargePaise?: number;
  taxPaise?: number;
  packagingPaise?: number;
  deliveryPaise?: number;
  paidPaise: number;
  itemsCount?: number;
}

export interface ItemInvoiceRecord {
  id: string;
  orderId: string;
  orderNo: number | string;
  createdAt: string | Date;
  tableNo?: string;
  orderType?: string;
  customerPhone?: string | null;
  method?: string | null;
  orderStatus?: string;
  itemId: string;
  itemName: string;
  categoryName?: string;
  variantName?: string | null;
  addonsText?: string | null;
  qty: number;
  unitPricePaise: number;
  grossPaise: number;
  discountPaise: number;
  taxPaise: number;
  netPaise: number;
  itemStatus?: string;
}

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatTallyDate(dateVal: string | Date): string {
  const d = new Date(dateVal);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}${mo}${da}`;
}

function formatDisplayDate(dateVal: string | Date): string {
  const d = new Date(dateVal);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${da}-${mo}-${yr}`;
}

function formatDisplayTime(dateVal: string | Date): string {
  const d = new Date(dateVal);
  const hr = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hr}:${mi}`;
}

/**
 * Generates an XML string compatible with Tally ERP 9 / Tally Prime Sales Voucher Import.
 */
export function generateTallyXml(
  invoices: InvoiceRecord[],
  config: Partial<TallyLedgerConfig> = {}
): string {
  const cfg = { ...DEFAULT_TALLY_CONFIG, ...config };
  const validInvoices = invoices.filter(
    (inv) => inv.status === "PAID" && inv.orderStatus !== "CANCELLED" && inv.paidPaise > 0
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<ENVELOPE>\n`;
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`;
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>Vouchers</REPORTNAME>\n`;
  xml += `        <STATICVARIABLES>\n`;
  xml += `          <SVCURRENTCOMPANY>${escapeXml(cfg.companyName)}</SVCURRENTCOMPANY>\n`;
  xml += `        </STATICVARIABLES>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`;

  for (const inv of validInvoices) {
    const tallyDate = formatTallyDate(inv.createdAt);
    const voucherNo = `INV-${inv.orderNo}`;
    const methodStr = String(inv.method || "Cash").toUpperCase();

    // Map payment method to proper Tally ledger
    let partyLedger = cfg.cashLedger;
    if (methodStr.includes("UPI") || methodStr.includes("QR") || methodStr.includes("ONLINE")) {
      partyLedger = cfg.bankLedger;
    } else if (methodStr.includes("CARD")) {
      partyLedger = cfg.cardLedger;
    } else if (inv.customerPhone) {
      partyLedger = cfg.cashLedger;
    }

    const totalPaid = (inv.paidPaise || 0) / 100;
    const foodNet = Math.max(0, (inv.netSalesPaise || inv.subtotalPaise || 0) / 100);
    const cgst = ((inv.cgstPaise || 0) / 100);
    const sgst = ((inv.sgstPaise || 0) / 100);
    const packaging = ((inv.packagingPaise || 0) / 100);
    const delivery = ((inv.deliveryPaise || 0) / 100);
    const serviceCharge = ((inv.serviceChargePaise || 0) / 100);
    const charges = packaging + delivery;

    // Calculate sum of credits
    const creditSum = foodNet + cgst + sgst + charges + serviceCharge;
    const roundOff = Number((totalPaid - creditSum).toFixed(2));

    const partyNarr = [
      `Order #${inv.orderNo}`,
      inv.orderType ? `Type: ${inv.orderType}` : null,
      inv.tableNo ? `Table: ${inv.tableNo}` : null,
      inv.customerPhone ? `Cust: ${inv.customerPhone}` : null,
      `Mode: ${inv.method || "Cash"}`,
    ].filter(Boolean).join(" | ");

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">\n`;
    xml += `            <DATE>${tallyDate}</DATE>\n`;
    xml += `            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n`;
    xml += `            <VOUCHERNUMBER>${escapeXml(voucherNo)}</VOUCHERNUMBER>\n`;
    xml += `            <REFERENCE>${escapeXml(String(inv.orderNo))}</REFERENCE>\n`;
    xml += `            <PARTYLEDGERNAME>${escapeXml(partyLedger)}</PARTYLEDGERNAME>\n`;
    xml += `            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>\n`;
    xml += `            <PLACEOFSUPPLY>${escapeXml(cfg.placeOfSupply || "Local State")}</PLACEOFSUPPLY>\n`;
    xml += `            <BASICBUYERNAME>${escapeXml(inv.customerPhone ? `Customer ${inv.customerPhone}` : "Walk-in Diner")}</BASICBUYERNAME>\n`;
    xml += `            <NARRATION>${escapeXml(partyNarr)}</NARRATION>\n`;

    // 1. DEBIT: Party / Cash / Bank (Negative in Tally)
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>${escapeXml(partyLedger)}</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>-${totalPaid.toFixed(2)}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;

    // 2. CREDIT: Food Sales Account (Positive in Tally)
    if (foodNet > 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${escapeXml(cfg.salesLedger)}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${foodNet.toFixed(2)}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    // 3. CREDIT: Output CGST
    if (cgst > 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${escapeXml(cfg.cgstLedger)}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${cgst.toFixed(2)}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    // 4. CREDIT: Output SGST
    if (sgst > 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${escapeXml(cfg.sgstLedger)}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${sgst.toFixed(2)}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    // 5. CREDIT: Packaging & Delivery
    if (charges > 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${escapeXml(cfg.chargesLedger)}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${charges.toFixed(2)}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    // 6. CREDIT: Service Charge
    if (serviceCharge > 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${escapeXml(cfg.serviceChargeLedger)}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${serviceCharge.toFixed(2)}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    // 7. ROUND OFF (Balancing entry)
    if (Math.abs(roundOff) >= 0.01) {
      const isPositiveDiff = roundOff > 0;
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>${escapeXml(cfg.roundOffLedger)}</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>${isPositiveDiff ? "No" : "Yes"}</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${(isPositiveDiff ? roundOff : roundOff).toFixed(2)}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    xml += `          </VOUCHER>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>\n`;

  return xml;
}

/**
 * Generates Marg ERP Bill-level Sales Import CSV.
 */
export function generateMargSalesCsv(invoices: InvoiceRecord[]): string {
  const headers = [
    "VOUCHER_NO",
    "BILL_DATE",
    "BILL_TIME",
    "ORDER_TYPE",
    "TABLE_NO",
    "CUSTOMER_PHONE",
    "PAYMENT_MODE",
    "FOOD_NET_AMOUNT",
    "PACKAGING_CHARGE",
    "DELIVERY_CHARGE",
    "SERVICE_CHARGE",
    "DISCOUNT_AMOUNT",
    "CGST_AMOUNT",
    "SGST_AMOUNT",
    "TOTAL_TAX",
    "ROUND_OFF",
    "GRAND_TOTAL",
    "STATUS",
  ];

  const validInvoices = invoices.filter(
    (inv) => inv.status === "PAID" && inv.orderStatus !== "CANCELLED"
  );

  const rows = validInvoices.map((inv) => {
    const totalPaid = (inv.paidPaise || 0) / 100;
    const foodNet = ((inv.netSalesPaise || inv.subtotalPaise || 0) / 100);
    const packaging = ((inv.packagingPaise || 0) / 100);
    const delivery = ((inv.deliveryPaise || 0) / 100);
    const serviceCharge = ((inv.serviceChargePaise || 0) / 100);
    const discount = ((inv.discountPaise || 0) / 100);
    const cgst = ((inv.cgstPaise || 0) / 100);
    const sgst = ((inv.sgstPaise || 0) / 100);
    const totalTax = cgst + sgst;
    const roundOff = totalPaid - (foodNet + totalTax + packaging + delivery + serviceCharge);

    return [
      `INV-${inv.orderNo}`,
      formatDisplayDate(inv.createdAt),
      formatDisplayTime(inv.createdAt),
      inv.orderType || "DINE_IN",
      inv.tableNo || "Counter",
      inv.customerPhone || "",
      inv.method || "Cash",
      foodNet.toFixed(2),
      packaging.toFixed(2),
      delivery.toFixed(2),
      serviceCharge.toFixed(2),
      discount.toFixed(2),
      cgst.toFixed(2),
      sgst.toFixed(2),
      totalTax.toFixed(2),
      roundOff.toFixed(2),
      totalPaid.toFixed(2),
      "PAID",
    ];
  });

  const escapeCsv = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

/**
 * Generates Marg ERP Item-Wise Line-by-Line Sales Import CSV.
 */
export function generateMargItemWiseCsv(items: ItemInvoiceRecord[]): string {
  const headers = [
    "BILL_NO",
    "BILL_DATE",
    "BILL_TIME",
    "ORDER_TYPE",
    "TABLE_NO",
    "CUSTOMER_PHONE",
    "PAYMENT_MODE",
    "ITEM_NAME",
    "CATEGORY",
    "VARIANT",
    "QTY",
    "UNIT_PRICE",
    "GROSS_AMOUNT",
    "DISCOUNT",
    "TAXABLE_AMOUNT",
    "TAX_AMOUNT",
    "NET_AMOUNT",
    "STATUS",
  ];

  const validItems = items.filter(
    (item) => item.itemStatus !== "CANCELLED" && item.orderStatus !== "CANCELLED"
  );

  const rows = validItems.map((item) => [
    `INV-${item.orderNo}`,
    formatDisplayDate(item.createdAt),
    formatDisplayTime(item.createdAt),
    item.orderType || "DINE_IN",
    item.tableNo || "Counter",
    item.customerPhone || "",
    item.method || "Cash",
    item.itemName,
    item.categoryName || "General",
    item.variantName || "",
    item.qty,
    (item.unitPricePaise / 100).toFixed(2),
    (item.grossPaise / 100).toFixed(2),
    (item.discountPaise / 100).toFixed(2),
    ((item.grossPaise - item.discountPaise) / 100).toFixed(2),
    (item.taxPaise / 100).toFixed(2),
    (item.netPaise / 100).toFixed(2),
    "COMPLETED",
  ]);

  const escapeCsv = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

/**
 * Triggers a browser file download of string content.
 */
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
