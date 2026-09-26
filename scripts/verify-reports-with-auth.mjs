import { chromium } from "../node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const API_BASE = "https://dine-api.logixsoft.in";
const PHONE = "+917276718848";
const OTP = "123456";

async function verifyReportsWithAuth() {
  console.log("1. Authenticating via API...");
  await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: PHONE }),
  });

  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: PHONE, otp: OTP }),
  });

  const setCookie = verifyRes.headers.get("set-cookie");
  if (!setCookie) throw new Error("No session cookie returned");

  const [cookiePair] = setCookie.split(";");
  const [name, value] = cookiePair.split("=");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name,
      value,
      domain: ".logixsoft.in",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name,
      value,
      domain: "dine.logixsoft.in",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  const reportsToCapture = [
    { slug: "invoice-detail", file: "report_invoice_detail.png" },
    { slug: "item-wise-invoice", file: "report_item_wise_invoice.png" },
    { slug: "sales-by-hour", file: "report_sales_by_hour.png" },
    { slug: "sales-by-table", file: "report_sales_by_table.png" },
    { slug: "gross-report", file: "report_gross_report.png" },
    { slug: "payment-methods", file: "report_payment_methods.png" },
    { slug: "discount-report", file: "report_discount_report.png" },
    { slug: "cancelled-invoices", file: "report_cancelled_invoices.png" },
  ];

  for (const item of reportsToCapture) {
    const url = `https://dine.logixsoft.in/settings/reports/${item.slug}`;
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/${item.file}`,
      fullPage: true,
    });
    console.log(`📸 Saved ${item.file}`);
  }

  await browser.close();
  console.log("All requested report screenshots captured successfully!");
}

verifyReportsWithAuth().catch(console.error);
