import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function run() {
  console.log('=== Verifying Responsive Navigation (Header vs Bottom Bar) in Live Production ===\n');

  const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ─── 1. Test Large Screens (1440 x 900) ──────────────────────────────────
  console.log('--- 1. Testing Large Screen (1440x900) ---');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await desktopContext.addCookies([
    { name: cached.name, value: cached.value, domain: cached.domain, path: cached.path, secure: true, httpOnly: true, sameSite: 'None' },
    { name: '__Secure-logix-dine.session_token', value: cached.value, domain: 'dine.logixsoft.in', path: '/', secure: true, httpOnly: true, sameSite: 'None' },
  ]);

  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(`${WEB_BASE}/pos`, { waitUntil: 'commit' });
  await desktopPage.waitForTimeout(3000);

  // Check Bottom Navigation on Large Screen
  const desktopBottomNav = desktopPage.locator('nav[aria-label="Bottom Navigation"]');
  const isBottomNavVisibleDesktop = await desktopBottomNav.isVisible().catch(() => false);
  console.log(`Large Screen: Bottom Navigation visible? ${isBottomNavVisibleDesktop}`);
  if (isBottomNavVisibleDesktop) {
    throw new Error('FAILED: Bottom navigation is still visible on large screen! Expected hidden.');
  }
  console.log('PASS: Bottom navigation is NOT present on large screens.');

  // Check Middle Header Navigation on Large Screen
  const desktopHeaderNav = desktopPage.locator('nav[aria-label="Main Navigation"]');
  await desktopHeaderNav.waitFor({ state: 'visible', timeout: 8000 });
  console.log('PASS: Middle Header Navigation is clearly visible in the header on large screen!');

  const headerNavLinks = await desktopHeaderNav.locator('a').all();
  const headerLinkTexts: string[] = [];
  for (const l of headerNavLinks) {
    headerLinkTexts.push((await l.textContent())?.trim() || '');
  }
  console.log('Header Navigation items:', headerLinkTexts);

  if (!headerLinkTexts.includes('Tables') || !headerLinkTexts.includes('POS') || !headerLinkTexts.includes('Orders') || !headerLinkTexts.includes('Settings')) {
    throw new Error(`FAILED: Header Navigation missing expected items: ${headerLinkTexts}`);
  }
  console.log('PASS: All 4 navigation items (Tables, POS, Orders, Settings) are present in the header.');

  // Check Active state styling (on /pos, POS should be active)
  const posLink = desktopHeaderNav.locator('a:has-text("POS")');
  const activeBg = await posLink.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  console.log('Active POS link background:', activeBg);

  await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04_large_screen_header_nav.png') });
  console.log('Saved screenshot: 04_large_screen_header_nav.png');

  // Click Tables in header to test navigation
  console.log('Clicking "Tables" in header navigation...');
  const tablesLink = desktopHeaderNav.locator('a:has-text("Tables")');
  await tablesLink.click();
  await desktopPage.waitForTimeout(2000);
  console.log('Navigated URL:', desktopPage.url());
  if (!desktopPage.url().includes('/tables')) {
    throw new Error(`FAILED: Navigating via header nav failed, URL: ${desktopPage.url()}`);
  }
  console.log('PASS: Header navigation works seamlessly!');

  await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, '05_large_screen_tables_navigated.png') });
  console.log('Saved screenshot: 05_large_screen_tables_navigated.png');

  await desktopContext.close();

  // ─── 2. Test Mobile / Tablet Screens (< md, e.g. 768px and 390px) ─────────
  console.log('\n--- 2. Testing Small Screen (768x1024 Tablet) ---');
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
  });
  await tabletContext.addCookies([
    { name: cached.name, value: cached.value, domain: cached.domain, path: cached.path, secure: true, httpOnly: true, sameSite: 'None' },
    { name: '__Secure-logix-dine.session_token', value: cached.value, domain: 'dine.logixsoft.in', path: '/', secure: true, httpOnly: true, sameSite: 'None' },
  ]);

  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto(`${WEB_BASE}/tables`, { waitUntil: 'commit' });
  await tabletPage.waitForTimeout(3000);

  // On Tablet: Header Nav should NOT be visible (due to limited space)
  const tabletHeaderNav = tabletPage.locator('nav[aria-label="Main Navigation"]');
  const isHeaderNavVisibleTablet = await tabletHeaderNav.isVisible().catch(() => false);
  console.log(`Tablet (768px): Header Navigation visible? ${isHeaderNavVisibleTablet}`);
  if (isHeaderNavVisibleTablet) {
    throw new Error('FAILED: Header navigation should be hidden on tablet where space is limited!');
  }
  console.log('PASS: Header navigation is hidden on tablet screens.');

  // On Tablet: Bottom Navigation SHOULD be visible
  const tabletBottomNav = tabletPage.locator('nav[aria-label="Bottom Navigation"]');
  await tabletBottomNav.waitFor({ state: 'visible', timeout: 8000 });
  console.log('PASS: Bottom navigation is visible on tablet screens where header space is limited.');

  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, '06_tablet_bottom_nav.png') });
  console.log('Saved screenshot: 06_tablet_bottom_nav.png');

  await tabletContext.close();
  await browser.close();

  console.log('\n=== RESPONSIVE NAVIGATION VERIFIED SUCCESSFULLY IN PRODUCTION! ===');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
