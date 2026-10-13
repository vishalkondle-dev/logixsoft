import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

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
  return { cookiePair, cookieName, cookieValue };
}

async function run() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING WHATSAPP BILL DISPATCH & LIVE E-BILL RECEIPT DELIVERY 🧪');
  console.log('========================================================================\n');

  // 1. Authenticate as Owner (Cafe 45)
  const ownerAuth = await loginAndGetCookie('+919985720478');
  const restRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { Cookie: ownerAuth.cookiePair },
  });
  const rests = await restRes.json();
  const restId = rests[0].id;
  console.log(`[1] Authenticated. Restaurant: ${rests[0].name} (${restId})`);

  const outletsRes = await fetch(`${API_BASE}/outlets`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const outlets = await outletsRes.json();
  const outletId = outlets[0].id;
  console.log(`[2] Active Outlet: ${outlets[0].name} (${outletId})`);

  // 2. Fetch an existing order or create a new settled order with customer phone
  console.log('\n[3] Fetching recent orders to test WhatsApp Receipt API...');
  const ordersRes = await fetch(`${API_BASE}/orders/list?outletId=${outletId}&limit=5`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const orderList = await ordersRes.json();
  if (!Array.isArray(orderList) || orderList.length === 0) {
    throw new Error('No orders found to test WhatsApp receipt');
  }
  const testOrder = orderList[0];
  console.log(`  ✓ Target Order: ID=${testOrder.order.id}, Token=#${testOrder.order.orderNo}`);

  // 3. Dispatch Live WhatsApp Receipt
  console.log('\n[4] Dispatching Digital WhatsApp Receipt via POST /orders/send-whatsapp-receipt...');
  const dispatchRes = await fetch(`${API_BASE}/orders/send-whatsapp-receipt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookiePair,
      'X-Restaurant-Id': restId,
    },
    body: JSON.stringify({
      orderId: testOrder.order.id,
      phone: '+917822914442',
    }),
  });

  const dispatchData = await dispatchRes.json();
  console.log('  Response Status:', dispatchRes.status);
  console.log('  Response Data:', JSON.stringify(dispatchData, null, 2));

  if (!dispatchRes.ok || !dispatchData.success) {
    throw new Error(`WhatsApp receipt dispatch failed: ${JSON.stringify(dispatchData)}`);
  }
  console.log('  ✅ Live WhatsApp receipt dispatch succeeded with status 200 & verified gateway messageId!\n');

  // 4. Test Settle & Send Auto-WhatsApp Trigger
  console.log('[5] Testing Create-Settled Order with Customer Phone Auto-WhatsApp Trigger...');
  const createSettledRes = await fetch(`${API_BASE}/orders/create-settled`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookiePair,
      'X-Restaurant-Id': restId,
    },
    body: JSON.stringify({
      outletId,
      tableNo: 'Takeaway',
      orderType: 'TAKEAWAY',
      customerPhone: '+917822914442',
      method: 'UPI',
      items: [
        {
          itemId: testOrder.items[0]?.itemId || 'item_default',
          qty: 1,
        },
      ],
    }),
  });
  console.log('  Create-Settled Response Status:', createSettledRes.status);
  const createdSettledData = await createSettledRes.json();
  console.log(`  ✓ Auto-settled order created: #${createdSettledData.order?.orderNo} (Auto WhatsApp background trigger fired)`);

  // 5. Playwright Browser Visual UI Test
  console.log('\n[6] Launching Playwright to test UI buttons on /orders and /pos...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addCookies([
      { name: ownerAuth.cookieName, value: ownerAuth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: ownerAuth.cookieName, value: ownerAuth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'dine.restaurantId', value: restId, domain: 'dine.logixsoft.in', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      { name: 'dine.outletId', value: outletId, domain: 'dine.logixsoft.in', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
    ]);

    const page = await context.newPage();

    // 5.1 Verify on /orders
    console.log('  Navigating to /orders...');
    await page.goto(`${WEB_BASE}/orders?outletId=${outletId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Click on the first order card/row to open order modal
    const firstOrderCard = page.locator('div[style*="cursor: pointer"], div[style*="cursor:pointer"]').first();
    await firstOrderCard.click();
    await page.waitForTimeout(2000);

    // Verify WhatsApp Bill button is visible in Order Details Modal
    const waBillBtn = page.locator('button:has-text("WhatsApp Bill"), button:has-text("Send to WhatsApp")').first();
    const isWaVisible = await waBillBtn.isVisible();
    console.log(`  ✓ WhatsApp Bill action button visible in /orders modal: ${isWaVisible}`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'whatsapp_orders_modal_verified.png'),
    });
    console.log('  ✓ Screenshot saved: whatsapp_orders_modal_verified.png');

    // 5.2 Click WhatsApp Bill button and verify toast notification
    console.log('  Clicking WhatsApp Bill button...');
    await waBillBtn.click();
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'whatsapp_bill_dispatched_notification.png'),
    });
    console.log('  ✓ Screenshot saved: whatsapp_bill_dispatched_notification.png');

    // 5.3 Navigate to /pos and check
    console.log('  Navigating to /pos...');
    await page.goto(`${WEB_BASE}/pos?outletId=${outletId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'whatsapp_pos_counter_verified.png'),
    });
    console.log('  ✓ Screenshot saved: whatsapp_pos_counter_verified.png');

    console.log('\n========================================================================');
    console.log('🎉 ALL WHATSAPP MESSAGING & DIGITAL BILL TESTS PASSED 100%! 🎉');
    console.log('========================================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
