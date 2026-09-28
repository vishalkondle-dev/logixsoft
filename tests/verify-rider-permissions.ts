import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function run() {
  console.log('=== VERIFYING RIDER ROLE PERMISSIONS IN LIVE PROD ===');
  const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

  // 1. Fetch from API to verify cleansed permissions
  const restRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { Cookie: `${cached.name}=${cached.value}` },
  });
  const rests = await restRes.json();
  const restId = rests[0].id;

  const rolesRes = await fetch(`${API_BASE}/roles`, {
    headers: { Cookie: `${cached.name}=${cached.value}`, 'X-Restaurant-Id': restId },
  });
  const rolesData = await rolesRes.json();
  const riderRole = rolesData.roles.find((r: any) => r.name === 'RIDER');
  console.log('API RIDER permissions:', riderRole.permissions);

  // 2. Launch browser and verify matrix UI
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: cached.name,
      value: cached.value,
      domain: '.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: cached.name,
      value: cached.value,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  console.log('Navigating to /settings/roles...');
  await page.goto(`${WEB_BASE}/settings/roles`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Wait for main page title
  const pageTitle = page.locator('text=Roles & Permissions Matrix').first();
  await pageTitle.waitFor({ timeout: 15000 });
  console.log('✓ Roles & Permissions Matrix is loaded');

  // Locate and click RIDER card in role selector grid
  const riderCard = page.locator('.mantine-Card-root', { hasText: 'RIDER' }).first();
  await riderCard.waitFor({ timeout: 15000 });
  console.log('✓ Found RIDER role card:', await riderCard.innerText());
  await riderCard.click();
  await page.waitForTimeout(1500);

  // Check the Granted badge in matrix header
  const matrixHeader = page.locator('text=RIDER Permissions Matrix').first();
  await matrixHeader.waitFor({ timeout: 10000 });
  console.log('✓ RIDER Permissions Matrix is open');

  const grantedBadge = page.locator('text=Granted').first();
  const grantedText = await grantedBadge.textContent();
  console.log('✓ Granted badge text in matrix header:', grantedText);

  // Count active switches on the page
  const checkedSwitches = await page.locator('input[type="checkbox"]:checked').count();
  console.log('✓ Number of checked switches on page:', checkedSwitches);

  // Take screenshot
  const screenshotPath = path.join(ARTIFACT_DIR, 'rider_permissions_audit.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('✓ Saved screenshot to:', screenshotPath);

  await browser.close();

  if (!grantedText?.includes('2 of 49 Granted')) {
    throw new Error(`Expected "2 of 49 Granted", got: ${grantedText}`);
  }
  if (checkedSwitches !== 2) {
    throw new Error(`Expected exactly 2 checked switches, got: ${checkedSwitches}`);
  }

  console.log('\n====================================================');
  console.log('RIDER PERMISSIONS VERIFICATION PASSED (100% MATCH!)');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
