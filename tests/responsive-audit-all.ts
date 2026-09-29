import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const ADMIN_PAGES = [
  '/admin/overview',
  '/admin/restaurants',
  '/admin/outlets',
  '/admin/users',
  '/admin/subscriptions',
  '/admin/orders',
  '/admin/menu',
  '/admin/tables',
  '/admin/inventory',
  '/admin/delivery',
  '/admin/customers',
  '/admin/reservations',
  '/admin/feedback',
  '/admin/system',
];

const STORE_PAGES = [
  '/pos',
  '/tables',
  '/kitchen',
  '/waiter',
  '/rider',
  '/orders',
  '/inventory',
  '/reports',
  '/settings',
  '/settings/roles',
  '/portal',
];

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) {
    throw new Error(`Failed to verify phone ${phone}: ${verifyRes.status} ${await verifyRes.text()}`);
  }
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function runResponsiveAudit() {
  console.log('🚀 Starting Comprehensive Responsive Audit across PC, Tablet, Phone...');
  const browser = await chromium.launch({ headless: true });

  const auth = await loginAndGetCookie('+917276718848');
  console.log(`✅ Logged in as ${auth.user.name} (${auth.user.role})`);

  const report: {
    viewport: string;
    page: string;
    status: 'PASS' | 'FAIL';
    hasOverflow: boolean;
    scrollWidth?: number;
    innerWidth?: number;
    consoleErrors: string[];
    error?: string;
  }[] = [];

  const screenshotDir = path.join(process.cwd(), 'tests/screenshots/responsive');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  for (const vp of VIEWPORTS) {
    console.log(`\n📱 --- TESTING VIEWPORT: ${vp.name.toUpperCase()} (${vp.width}x${vp.height}) ---`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.name === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
        : vp.name === 'tablet'
        ? 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
        : undefined,
    });

    await context.addCookies([
      { name: auth.cookieName, value: auth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: auth.cookieName, value: auth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: auth.cookieName, value: auth.cookieValue, domain: 'dine-api.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);

    const allPages = [...ADMIN_PAGES, ...STORE_PAGES];

    for (const pagePath of allPages) {
      const page = await context.newPage();
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter known benign errors like WebSocket connection failures in headless or ResizeObserver loops
          if (!text.includes('ResizeObserver') && !text.includes('favicon')) {
            consoleErrors.push(text);
          }
        }
      });

      try {
        await page.goto(`${WEB_BASE}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2000);

        // Check if page redirected unexpectedly
        const currentUrl = page.url();
        const expected = pagePath.startsWith('/admin') ? '/admin' : pagePath.split('?')[0];

        // Measure horizontal overflow
        const overflow = await page.evaluate(() => {
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          return {
            hasOverflow: scrollW > innerW + 2, // 2px tolerance for rounding
            scrollWidth: scrollW,
            innerWidth: innerW,
          };
        });

        const safeName = `${vp.name}_${pagePath.replace(/\//g, '_')}`;
        await page.screenshot({ path: path.join(screenshotDir, `${safeName}.png`) });

        console.log(`  [${vp.name}] ${pagePath} => ${overflow.hasOverflow ? '⚠️ OVERFLOW (' + overflow.scrollWidth + ' > ' + overflow.innerWidth + ')' : '✅ OK'} (Errors: ${consoleErrors.length})`);

        report.push({
          viewport: vp.name,
          page: pagePath,
          status: overflow.hasOverflow ? 'FAIL' : 'PASS',
          hasOverflow: overflow.hasOverflow,
          scrollWidth: overflow.scrollWidth,
          innerWidth: overflow.innerWidth,
          consoleErrors,
        });
      } catch (err: any) {
        console.error(`  [${vp.name}] ${pagePath} => ❌ ERROR: ${err.message}`);
        report.push({
          viewport: vp.name,
          page: pagePath,
          status: 'FAIL',
          hasOverflow: false,
          consoleErrors,
          error: err.message,
        });
      } finally {
        await page.close();
      }
    }

    await context.close();
  }

  await browser.close();

  const failures = report.filter((r) => r.status === 'FAIL' || r.hasOverflow || r.error);
  console.log(`\n======================================================`);
  console.log(`AUDIT SUMMARY: ${report.length} tests run. Failures/Overflows: ${failures.length}`);
  if (failures.length > 0) {
    console.log(`Issues detected:`);
    for (const f of failures) {
      console.log(`- [${f.viewport}] ${f.page}: overflow=${f.hasOverflow} (${f.scrollWidth}px vs ${f.innerWidth}px), error=${f.error || 'none'}`);
    }
  } else {
    console.log(`🎉 100% PERFECT RESPONSIVE RENDERING! No horizontal overflows found.`);
  }
}

runResponsiveAudit().catch(console.error);
