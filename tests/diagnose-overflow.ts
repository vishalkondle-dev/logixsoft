import { chromium } from '@playwright/test';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function diagnose() {
  const auth = await loginAndGetCookie('+917276718848');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  });

  await context.addCookies([
    { name: auth.cookieName, value: auth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    { name: auth.cookieName, value: auth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    { name: auth.cookieName, value: auth.cookieValue, domain: 'dine-api.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ]);

  const testPages = ['/admin/feedback', '/admin/system', '/pos', '/tables'];

  for (const p of testPages) {
    const page = await context.newPage();
    console.log(`\nDiagnosing ${p}...`);
    await page.goto(`${WEB_BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log(`  Current URL: ${page.url()}`);

    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const winWidth = await page.evaluate(() => window.innerWidth);
    console.log(`  scrollWidth: ${docWidth}, innerWidth: ${winWidth}`);

    if (docWidth > winWidth) {
      const offendingElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const offending: { tag: string; className: string; id: string; rect: any; text: string }[] = [];
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 2) {
            offending.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 50),
              id: el.id,
              rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
              text: (el.textContent || '').trim().slice(0, 40),
            });
          }
        }
        return offending.slice(-10); // innermost offending elements
      });
      console.log('  Offending elements (last 10):', JSON.stringify(offendingElements, null, 2));
    }
    await page.close();
  }

  await browser.close();
}

diagnose().catch(console.error);
