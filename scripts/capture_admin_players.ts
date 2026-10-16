import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. First authenticate as admin
  console.log("Authenticating as admin via demo-login...");
  await page.goto("http://localhost:3050");
  await page.evaluate(async () => {
    const res = await fetch("/api/auth/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin", name: "Super Administrator" }),
    });
    const data = await res.json();
    localStorage.setItem("ipl_auction_auth_token", data.token);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    document.cookie = `session_token=${data.token}; Path=/; SameSite=Lax; Max-Age=2592000`;
  });

  // 2. Navigate to admin players
  console.log("Navigating to http://localhost:3050/admin/players...");
  await page.goto("http://localhost:3050/admin/players", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Capture table
  console.log("Capturing admin_players_table.png...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin_players_table.png"), fullPage: false });

  // Click on the first row to open the Player Dossier Modal
  console.log("Clicking player row to open dossier modal...");
  const row = page.locator("tbody tr").first();
  await row.click();
  await page.waitForTimeout(800);

  // Capture modal
  console.log("Capturing admin_player_dossier_modal.png...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin_player_dossier_modal.png") });

  await browser.close();
  console.log("Completed screenshots successfully!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
