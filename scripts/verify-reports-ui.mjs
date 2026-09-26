import { chromium } from "../node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

async function verifyReportsUi() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("Navigating to https://dine.logixsoft.in ...");
  await page.goto("https://dine.logixsoft.in");
  await page.waitForTimeout(2000);

  // Check if we need to login
  if (page.url().includes("/onboarding") || (await page.$('input[placeholder*="mobile" i], input[type="tel"]'))) {
    console.log("Logging in via OTP bypass...");
    const phoneInput = page.locator('input[placeholder*="mobile" i], input[type="tel"]').first();
    await phoneInput.fill("7276718848");

    const submitBtn = page.locator("button:has-text('Send OTP'), button:has-text('Continue'), button:has-text('Get OTP'), button[type='submit']").first();
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // Enter OTP 123456
    const otpInputs = page.locator("input[data-pin-input], input[aria-label*='PinInput' i], input[type='password'], input[inputmode='numeric']");
    const count = await otpInputs.count();
    if (count >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String(i + 1 === 1 ? "1" : i + 1 === 2 ? "2" : i + 1 === 3 ? "3" : i + 1 === 4 ? "4" : i + 1 === 5 ? "5" : "6"));
      }
    } else {
      const singlePin = page.locator("input[placeholder*='OTP' i], input[name='otp']").first();
      if (await singlePin.isVisible()) {
        await singlePin.fill("123456");
      }
    }

    const verifyBtn = page.locator("button:has-text('Verify'), button:has-text('Login'), button:has-text('Submit')").first();
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
    }
    await page.waitForTimeout(3000);
  }

  console.log("Navigating to /settings/reports ...");
  await page.goto("https://dine.logixsoft.in/settings/reports");
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/reports_hub.png", fullPage: true });
  console.log("📸 Saved reports_hub.png");

  // Open Summary
  console.log("Navigating to /settings/reports/summary ...");
  await page.goto("https://dine.logixsoft.in/settings/reports/summary");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/report_summary.png", fullPage: true });
  console.log("📸 Saved report_summary.png");

  // Open Invoice Detail
  console.log("Navigating to /settings/reports/invoice-detail ...");
  await page.goto("https://dine.logixsoft.in/settings/reports/invoice-detail");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/report_invoice_detail.png", fullPage: true });
  console.log("📸 Saved report_invoice_detail.png");

  // Open Item-wise Invoice
  console.log("Navigating to /settings/reports/item-wise-invoice ...");
  await page.goto("https://dine.logixsoft.in/settings/reports/item-wise-invoice");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/report_item_wise_invoice.png", fullPage: true });
  console.log("📸 Saved report_item_wise_invoice.png");

  // Open Sales by Hour
  console.log("Navigating to /settings/reports/sales-by-hour ...");
  await page.goto("https://dine.logixsoft.in/settings/reports/sales-by-hour");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/report_sales_by_hour.png", fullPage: true });
  console.log("📸 Saved report_sales_by_hour.png");

  // Open Sales by Table
  console.log("Navigating to /settings/reports/sales-by-table ...");
  await page.goto("https://dine.logixsoft.in/settings/reports/sales-by-table");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/report_sales_by_table.png", fullPage: true });
  console.log("📸 Saved report_sales_by_table.png");

  // Open Cancelled Invoices
  console.log("Navigating to /settings/reports/cancelled-invoices ...");
  await page.goto("https://dine.logixsoft.in/settings/reports/cancelled-invoices");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/report_cancelled_invoices.png", fullPage: true });
  console.log("📸 Saved report_cancelled_invoices.png");

  await browser.close();
  console.log("Verification finished successfully!");
}

verifyReportsUi().catch(console.error);
