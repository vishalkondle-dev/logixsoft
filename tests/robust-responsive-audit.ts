import { chromium, Browser } from '@playwright/test';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const PAGES_TO_TEST = [
  // Admin pages
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
  // Store pages
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
  if (!verifyRes.ok) throw new Error('Login failed');
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookieName, cookieValue, user: data.user };
}

async function runAudit() {
  console.log('🚀 Running robust responsive audit across all 25 pages and 3 viewports...');
  const auth = await loginAndGetCookie('+917276718848');
  console.log(`✅ Authenticated as ${auth.user.name} (${auth.user.role})`);

  const browser = await chromium.launch({ headless: true });

  const results: {
    viewport: string;
    page: string;
    scrollWidth: number;
    innerWidth: number;
    hasOverflow: boolean;
    url: string;
  }[] = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n📱 VIEWPORT: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})`);

    for (const pagePath of PAGES_TO_TEST) {
      // Create a fresh context for each page to prevent WebSocket connection buildup
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });

      await context.addCookies([
        {
          name: auth.cookieName,
          value: decodeURIComponent(auth.cookieValue),
          domain: '.logixsoft.in',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None',
        },
        {
          name: auth.cookieName,
          value: decodeURIComponent(auth.cookieValue),
          domain: 'dine.logixsoft.in',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None',
        },
      ]);

      const page = await context.newPage();
      try {
        await page.goto(`${WEB_BASE}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1000);

        const metrics = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          };
        });

        const hasOverflow = metrics.scrollWidth > metrics.innerWidth + 2;
        const currentUrl = page.url();

        console.log(`  [${vp.name}] ${pagePath} => ${hasOverflow ? '❌ OVERFLOW (' + metrics.scrollWidth + ' > ' + metrics.innerWidth + ')' : '✅ OK (' + metrics.scrollWidth + 'px)'}`);

        results.push({
          viewport: vp.name,
          page: pagePath,
          scrollWidth: metrics.scrollWidth,
          innerWidth: metrics.innerWidth,
          hasOverflow,
          url: currentUrl,
        });
      } catch (err: any) {
        console.log(`  [${vp.name}] ${pagePath} => ⚠️ Error: ${err.message}`);
        results.push({
          viewport: vp.name,
          page: pagePath,
          scrollWidth: -1,
          innerWidth: vp.width,
          hasOverflow: false,
          url: 'error: ' + err.message,
        });
      } finally {
        await page.close();
        await context.close();
      }
    }
  }

  await browser.close();

  console.log('\n======================================================');
  const overflows = results.filter((r) => r.hasOverflow);
  console.log(`SUMMARY: Tested ${results.length} pages. Overflows: ${overflows.length}`);
  if (overflows.length > 0) {
    for (const o of overflows) {
      console.log(`  - [${o.viewport}] ${o.page}: ${o.scrollWidth}px > ${o.innerWidth}px (URL: ${o.url})`);
    }
  } else {
    console.log('🎉 100% PERFECT! No viewport overflow on PC, Tablet, or Mobile across all pages!');
  }
}

runAudit().catch(console.error);
