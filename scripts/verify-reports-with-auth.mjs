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
    { url: "https://dine.logixsoft.in/tables", file: "tables_page.png" },
    { url: "https://dine.logixsoft.in/settings", file: "settings_overview.png" },
    { url: "https://dine.logixsoft.in/settings/reports", file: "reports_hub.png" },
    { url: "https://dine.logixsoft.in/settings/reports/summary", file: "report_summary.png" },
    { url: "https://dine.logixsoft.in/settings/reports/invoice-detail", file: "report_invoice_detail.png" },
  ];

  for (const item of reportsToCapture) {
    const url = item.url;
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
