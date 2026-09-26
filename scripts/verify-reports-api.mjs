const API_BASE = "https://dine-api.logixsoft.in";
const PHONE = "+917276718848";
const OTP = "123456";

async function verifyAllReports() {
  console.log("=== 1. AUTHENTICATING AS OWNER ===");
  const sendRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: PHONE }),
  });
  console.log("Send OTP status:", sendRes.status, await sendRes.text());

  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: PHONE, otp: OTP }),
  });
  console.log("Verify OTP status:", verifyRes.status, await verifyRes.clone().text());
  const cookie = verifyRes.headers.get("set-cookie")?.split(";")[0];
  console.log("Session Cookie obtained:", !!cookie);

  const restRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { Cookie: cookie },
  });
  const restaurants = await restRes.json();
  const restaurantId = restaurants[0]?.id;
  console.log("Restaurant:", restaurantId, restaurants[0]?.name);

  const outletsRes = await fetch(`${API_BASE}/outlets`, {
    headers: { Cookie: cookie, "X-Restaurant-Id": restaurantId },
  });
  const outlets = await outletsRes.json();
  const outletId = outlets[0]?.id;
  console.log("Outlet:", outletId, outlets[0]?.name);

  const headers = {
    Cookie: cookie,
    "X-Restaurant-Id": restaurantId,
    "X-Outlet-Id": outletId,
  };

  const REPORT_SLUGS = [
    "summary",
    "invoice-detail",
    "item-wise-invoice",
    "sales-report",
    "average-order-value",
    "gross-report",
    "net-sales-report",
    "sales-by-hour",
    "sales-by-day",
    "sales-by-month",
    "sales-by-order-type",
    "sales-by-table",
    "payment-methods",
    "discount-report",
    "void-invoices",
    "cancelled-invoices",
  ];

  console.log("\n=== 2. TESTING ALL 16 REPORT ENDPOINTS ===");
  const results = [];
  for (const slug of REPORT_SLUGS) {
    const from = slug === "sales-by-month" ? "2026-08-01" : "2026-09-01";
    const to = "2026-09-26";
    const url = `${API_BASE}/reports/${slug}?from=${from}&to=${to}&outletId=${outletId}`;
    const start = Date.now();
    const res = await fetch(url, { headers });
    const duration = Date.now() - start;

    if (!res.ok) {
      console.error(`❌ [${slug}] Failed with status ${res.status}: ${await res.text()}`);
      results.push({ slug, ok: false, status: res.status });
      continue;
    }

    const json = await res.json();
    const data = json.data;
    const summary = data.summary || data;

    results.push({
      slug,
      ok: true,
      duration: `${duration}ms`,
      paidOrders: summary.paidCount,
      revenue: `₹${(summary.revenuePaise / 100).toFixed(2)}`,
      invoicesCount: data.invoices?.length ?? 0,
      itemsCount: data.itemsReport?.length ?? 0,
      matrixRows: data.itemInvoiceMatrix?.length ?? 0,
    });
    console.log(`✅ [${slug}] ${duration}ms | Paid: ${summary.paidCount} | Rev: ₹${(summary.revenuePaise / 100).toFixed(2)} | Invoices: ${data.invoices?.length}`);
  }

  console.log("\n=== 3. REPORT TEST SUMMARY ===");
  console.table(results);
}

verifyAllReports().catch(console.error);
