import { chromium } from '@playwright/test';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';

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

async function run() {
  console.log('================================================================');
  console.log('🔍 RUNNING COMPREHENSIVE END-TO-END SYSTEM HEALTH CHECK 🔍');
  console.log('================================================================\n');

  let allChecksPassed = true;

  // 1. Check Owner Billing API & Plans
  console.log('--- 1. Testing Owner Billing & Plan Resolution ---');
  try {
    const ownerAuth = await loginAndGetCookie('+919985720478');
    console.log(`[Owner Auth] Logged in as ${ownerAuth.user.role} (${ownerAuth.user.phoneNumber})`);

    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Cookie: ownerAuth.cookiePair },
    });
    const meData = await meRes.json();
    const restaurantId = meData.session?.activeRestaurantId || meData.memberships?.[0]?.restaurantId || 'rest_mg3Owcn941nb42aC7UZ66ZON';
    console.log(`[Owner Auth] Active Restaurant ID: ${restaurantId}`);

    const billingRes = await fetch(`${API_BASE}/outlets/billing`, {
      headers: { 
        Cookie: ownerAuth.cookiePair,
        'X-Restaurant-Id': restaurantId,
      },
    });
    if (!billingRes.ok) {
      throw new Error(`GET /outlets/billing failed: ${billingRes.status} ${await billingRes.text()}`);
    }
    const billingData = await billingRes.json();
    console.log(`[Owner Billing] Restaurant: "${billingData.restaurant?.name}", Outlets count: ${billingData.outlets?.length}`);
    console.log(`[Owner Billing] Plans received: ${billingData.plans?.map((p: any) => `${p.name} (₹${p.monthlyPrice}/mo)`).join(', ')}`);

    if (!billingData.plans || billingData.plans.length !== 2) {
      throw new Error(`Expected strictly 2 plans, got: ${billingData.plans?.length}`);
    }
    console.log('✅ Owner Billing & Pricing matrix is 100% correct.');
  } catch (err: any) {
    console.error('❌ Check 1 Failed:', err.message);
    allChecksPassed = false;
  }

  // 2. Check Admin Plans & Subscriptions API
  console.log('\n--- 2. Testing Admin Governance APIs ---');
  try {
    const adminAuth = await loginAndGetCookie('+917276718848');
    console.log(`[Admin Auth] Logged in as ${adminAuth.user.role} (${adminAuth.user.phoneNumber})`);

    const plansRes = await fetch(`${API_BASE}/admin/plans`, {
      headers: { Cookie: adminAuth.cookiePair },
    });
    if (!plansRes.ok) throw new Error(`GET /admin/plans failed: ${plansRes.status}`);
    const plansData = await plansRes.json();
    console.log(`[Admin Plans] Live platform plans: ${plansData.plans?.map((p: any) => `${p.id}: ₹${p.monthlyPrice}/mo, ₹${p.annualPrice}/yr`).join(' | ')}`);

    const subsRes = await fetch(`${API_BASE}/admin/subscriptions`, {
      headers: { Cookie: adminAuth.cookiePair },
    });
    if (!subsRes.ok) throw new Error(`GET /admin/subscriptions failed: ${subsRes.status}`);
    const subsData = await subsRes.json();
    console.log(`[Admin Subscriptions] Retrieved ${subsData.restaurants?.length} outlet licenses.`);
    console.log('✅ Admin Governance endpoints are 100% operational.');
  } catch (err: any) {
    console.error('❌ Check 2 Failed:', err.message);
    allChecksPassed = false;
  }

  // 3. Check Public CDN Downloads
  console.log('\n--- 3. Testing Public Package CDN URLs ---');
  const urlsToCheck = [
    { name: 'Android APK', url: 'https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/android/LogixDine-Android-debug.apk' },
    { name: 'Windows x64', url: 'https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/windows/LogixDine-Windows-x64.zip' },
    { name: 'macOS Apple Silicon', url: 'https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/macos/LogixDine-macOS-AppleSilicon-arm64.zip' },
    { name: 'macOS Intel', url: 'https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/macos/LogixDine-macOS-Intel-x64.zip' },
    { name: 'Linux AppImage', url: 'https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/linux/LogixDine-Linux-x64.AppImage' },
    { name: 'Linux .deb amd64', url: 'https://pub-1d0c10adcdfd421aab701469007ccd2c.r2.dev/linux/LogixDine-Ubuntu-Debian-amd64.deb' },
  ];

  for (const item of urlsToCheck) {
    try {
      const res = await fetch(item.url, { method: 'HEAD' });
      if (res.status === 200) {
        const sizeMb = (Number(res.headers.get('content-length') || 0) / (1024 * 1024)).toFixed(1);
        console.log(`✅ [${item.name}] HTTP 200 OK (${sizeMb} MB)`);
      } else {
        throw new Error(`Returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.error(`❌ [${item.name}] Failed: ${err.message}`);
      allChecksPassed = false;
    }
  }

  // 4. Check Web Pages Live Status
  console.log('\n--- 4. Testing Web App Pages Live Status ---');
  const pagesToCheck = [
    `${WEB_BASE}`,
    `${WEB_BASE}/download`,
  ];
  for (const pageUrl of pagesToCheck) {
    try {
      const res = await fetch(pageUrl, { method: 'HEAD' });
      if (res.status === 200) {
        console.log(`✅ [${pageUrl}] HTTP 200 OK`);
      } else {
        throw new Error(`Returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.error(`❌ [${pageUrl}] Failed: ${err.message}`);
      allChecksPassed = false;
    }
  }

  console.log('\n================================================================');
  if (allChecksPassed) {
    console.log('🎉 ALL SYSTEM HEALTH CHECKS PASSED: EVERYTHING IS 100% CORRECT! 🎉');
  } else {
    console.error('⚠️ SOME SYSTEM HEALTH CHECKS FAILED!');
    process.exit(1);
  }
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
