import { chromium } from "../node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";
import path from "path";

const API_BASE = "https://dine-api.logixsoft.in";
const PHONE = "+917276718848";
const OTP = "123456";
const ARTIFACTS_DIR = "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e";

async function verifyInventoryUI() {
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

  console.log("2. Launching Chromium...");
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

  // 1. Visit /settings/inventory (Ingredients & Stock tab)
  console.log("3. Navigating to /settings/inventory...");
  await page.goto("https://dine.logixsoft.in/settings/inventory", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);
  const stockImgPath = path.join(ARTIFACTS_DIR, "inventory_stock_hub.png");
  await page.screenshot({ path: stockImgPath, fullPage: true });
  console.log(`Saved screenshot: ${stockImgPath}`);

  // 2. Click on "Dish Recipes (BOM)" tab
  console.log("4. Switching to Recipes tab...");
  const recipeTab = page.locator('button[role="tab"]:has-text("Recipes & Food Cost")');
  if (await recipeTab.isVisible()) {
    await recipeTab.click();
    await page.waitForTimeout(2000);
    const recipesImgPath = path.join(ARTIFACTS_DIR, "inventory_recipes_bom.png");
    await page.screenshot({ path: recipesImgPath, fullPage: true });
    console.log(`Saved screenshot: ${recipesImgPath}`);
  }

  // 3. Click on "Purchases & Deliveries" tab
  console.log("5. Switching to Purchases tab...");
  const purchasesTab = page.locator('button[role="tab"]:has-text("Purchases & Deliveries")');
  if (await purchasesTab.isVisible()) {
    await purchasesTab.click();
    await page.waitForTimeout(2000);
    const poImgPath = path.join(ARTIFACTS_DIR, "inventory_purchases_grn.png");
    await page.screenshot({ path: poImgPath, fullPage: true });
    console.log(`Saved screenshot: ${poImgPath}`);
  }

  // 4. Click on "Movement Ledger" tab
  console.log("6. Switching to Movement Ledger tab...");
  const ledgerTab = page.locator('button[role="tab"]:has-text("Movement Ledger")');
  if (await ledgerTab.isVisible()) {
    await ledgerTab.click();
    await page.waitForTimeout(2000);
    const ledgerImgPath = path.join(ARTIFACTS_DIR, "inventory_movement_ledger.png");
    await page.screenshot({ path: ledgerImgPath, fullPage: true });
    console.log(`Saved screenshot: ${ledgerImgPath}`);
  }

  // 5. Visit /settings/menu/item_0GedKgvE3LFEyC5C06AlyIPS (Delhi Style Butter Chicken)
  console.log("7. Navigating to Butter Chicken menu edit page...");
  await page.goto("https://dine.logixsoft.in/settings/menu/item_0GedKgvE3LFEyC5C06AlyIPS", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);
  const dishEditImgPath = path.join(ARTIFACTS_DIR, "menu_item_recipe_bom_card.png");
  await page.screenshot({ path: dishEditImgPath, fullPage: true });
  console.log(`Saved screenshot: ${dishEditImgPath}`);

  await browser.close();
  console.log("Verification finished successfully!");
}

verifyInventoryUI().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
