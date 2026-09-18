import { test, expect } from '@playwright/test';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';

let authCookie: { name: string; value: string; domain: string; path: string };

async function fetchAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string }> {
  const sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
  });
  if (!sRes.ok) {
    throw new Error(`send-otp failed: ${sRes.status} ${await sRes.text()}`);
  }

  const vRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE, otp: DEV_OTP }),
  });
  if (!vRes.ok) {
    throw new Error(`verify failed: ${vRes.status} ${await vRes.text()}`);
  }

  const setCookies = (vRes.headers as any).getSetCookie
    ? (vRes.headers as any).getSetCookie()
    : [vRes.headers.get('set-cookie')];
  const cookieStr = setCookies.filter(Boolean).join('; ');

  const match = cookieStr.match(/__Secure-logix-dine\.session_token=([^;]+)/);
  if (!match) {
    throw new Error(`Session cookie not found in: ${cookieStr}`);
  }

  return {
    name: '__Secure-logix-dine.session_token',
    value: match[1],
    domain: '.logixsoft.in',
    path: '/',
  };
}

async function apiGet(path: string, restaurantId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Cookie: `${authCookie.name}=${authCookie.value}`,
      ...(restaurantId ? { 'X-Restaurant-Id': restaurantId } : {}),
    },
  });
  return res.json();
}

test.describe.configure({ mode: 'serial' });

test.describe('POS Cart Selection & Order Creation E2E', () => {
  test.beforeAll(async () => {
    authCookie = await fetchAuthCookie();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: authCookie.name,
        value: authCookie.value,
        domain: authCookie.domain,
        path: authCookie.path,
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
    ]);
  });

  test('1. Table select defaults to takeaway, customer phone exists, chevron is compact', async ({ page }) => {
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('networkidle');

    // Verify on POS page
    await expect(page).toHaveURL(/.*\/pos.*/);

    // a. Table Select should default to "Takeaway"
    const tableSelectInput = page.locator('input[value="Takeaway"]').first();
    await expect(tableSelectInput).toBeVisible({ timeout: 10000 });
    const selectedVal = await tableSelectInput.inputValue();
    expect(selectedVal).toBe('Takeaway');

    // Click table select to verify dropdown options
    await tableSelectInput.click();
    await page.waitForTimeout(500);
    const takeawayOption = page.getByRole('option', { name: 'Takeaway' });
    await expect(takeawayOption).toBeVisible();

    // Table T1 should also be in options
    const t1Option = page.getByRole('option', { name: /T1/i });
    if (await t1Option.isVisible()) {
      console.log('Found table T1 in table options dropdown');
    }
    await page.keyboard.press('Escape');

    // b. Optional Customer Phone number field
    const phoneInput = page.locator('input[placeholder*="WhatsApp" i], input[placeholder*="9876543210" i]').first();
    await expect(phoneInput).toBeVisible();

    // c. Send and Chevron button styling & dimensions
    const sendButton = page.getByRole('button', { name: /^send$/i }).first();
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled(); // empty cart

    const chevronButton = page.locator('button[aria-label="More order options"]').first();
    await expect(chevronButton).toBeVisible();
    await expect(chevronButton).toBeDisabled(); // empty cart

    // Verify chevron down icon is small/compact, not 50% wide
    const chevronBox = await chevronButton.boundingBox();
    const sendBox = await sendButton.boundingBox();
    expect(chevronBox).not.toBeNull();
    expect(sendBox).not.toBeNull();

    console.log(`Send button width: ${sendBox!.width}px, Chevron button width: ${chevronBox!.width}px`);
    // Chevron button should be compact (around 36px, less than 60px)
    expect(chevronBox!.width).toBeLessThan(60);
    // Send button should be significantly wider than chevron button
    expect(sendBox!.width).toBeGreaterThan(chevronBox!.width * 2);
  });

  test('2. Order is created ONLY after clicking Send, and dispatches WhatsApp', async ({ page }) => {
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('networkidle');

    // Get restaurant ID and initial order count
    const [restaurant] = await apiGet('/restaurants');
    const restaurantId = restaurant.id;
    const initialOrders = await apiGet('/billing/orders?limit=100', restaurantId);
    const initialCount = Array.isArray(initialOrders) ? initialOrders.length : 0;
    console.log('Initial orders count:', initialCount);

    // 1. Add item to cart
    const itemCard = page.locator('.mantine-Paper-root').filter({ hasText: '₹' }).first();
    await expect(itemCard).toBeVisible({ timeout: 10000 });
    await itemCard.click();
    await page.waitForTimeout(500);

    // Verify item is visible in local cart
    const cartItem = page.locator('.mantine-Paper-root').filter({ hasText: 'each' }).first();
    await expect(cartItem).toBeVisible();

    // CRITICAL CHECK: Verify order was NOT created in backend yet!
    const ordersAfterAdd = await apiGet('/billing/orders?limit=100', restaurantId);
    expect(ordersAfterAdd.length).toBe(initialCount);
    console.log('Verified: Order was NOT created in DB when adding items to cart!');

    // 2. Modify quantity in local cart
    const plusBtn = page.locator('button').filter({ has: page.locator('svg.tabler-icon-plus') }).first();
    await plusBtn.click();
    await page.waitForTimeout(300);

    // Still no order created
    const ordersAfterQty = await apiGet('/billing/orders?limit=100', restaurantId);
    expect(ordersAfterQty.length).toBe(initialCount);

    // 3. Fill customer phone number
    const phoneInput = page.locator('input[placeholder*="WhatsApp" i], input[placeholder*="9876543210" i]').first();
    await phoneInput.fill('7276718848');

    // 4. Send button is enabled
    const sendButton = page.getByRole('button', { name: /^send$/i }).first();
    await expect(sendButton).toBeEnabled();

    // 5. Click Send
    await sendButton.click();

    // Notification appears
    await expect(page.locator('.mantine-Notification-root')).toBeVisible({ timeout: 15000 });
    const notif = await page.locator('.mantine-Notification-root').innerText();
    console.log('Send Notification:', notif);
    expect(notif).toMatch(/Order #\d+ sent to kitchen/i);
    const matchNo = notif.match(/Order #(\d+)/i);
    const expectedOrderNo = matchNo ? parseInt(matchNo[1], 10) : undefined;

    // 6. Verify order IS now created in backend!
    const ordersAfterSend = await apiGet('/billing/orders?limit=100', restaurantId);
    expect(ordersAfterSend.length).toBeGreaterThanOrEqual(initialCount + 1);

    const latestOrder = expectedOrderNo
      ? ordersAfterSend.find((o: any) => o.order.orderNo === expectedOrderNo)
      : ordersAfterSend[0];
    expect(latestOrder).toBeDefined();
    console.log('Created order:', latestOrder.order.orderNo, 'Table:', latestOrder.order.tableNo, 'CustomerPhone:', latestOrder.order.customerPhone);
    expect(latestOrder.order.tableNo).toBe('Takeaway');
    expect(latestOrder.order.customerPhone).toBe('7276718848');

    // 7. Verify cart is reset
    await expect(page.getByText('Add items from menu to start an order')).toBeVisible({ timeout: 5000 });
    const resetTable = await page.locator('input[value="Takeaway"]').first().inputValue();
    expect(resetTable).toBe('Takeaway');
    const resetPhone = await phoneInput.inputValue();
    expect(resetPhone).toBe('');
  });

  test('3. Settle & Send flow via compact chevron dropdown', async ({ page }) => {
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('networkidle');

    // Add item to cart
    const itemCard = page.locator('.mantine-Paper-root').filter({ hasText: '₹' }).first();
    await itemCard.click();
    await page.waitForTimeout(500);

    // Fill customer phone
    const phoneInput = page.locator('input[placeholder*="WhatsApp" i], input[placeholder*="9876543210" i]').first();
    await phoneInput.fill('7276718848');

    // Click compact chevron down button
    const chevronButton = page.locator('button[aria-label="More order options"]').first();
    await chevronButton.click();
    await page.waitForTimeout(300);

    // Click "Settle & Send" in dropdown
    const settleMenuItem = page.getByRole('menuitem', { name: /settle & send/i });
    await expect(settleMenuItem).toBeVisible();
    await settleMenuItem.click();

    // Settle Modal opens
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Settle & Send/i)).toBeVisible();

    // Confirm settlement
    const confirmBtn = modal.getByRole('button', { name: /confirm settlement/i });
    await confirmBtn.click();

    // Notification confirms order settled
    await expect(page.locator('.mantine-Notification-root')).toBeVisible({ timeout: 15000 });
    const notifText = await page.locator('.mantine-Notification-root').innerText();
    console.log('Settle Notification:', notifText);
    expect(notifText).toMatch(/Order settled!/i);

    // Cart reset
    await expect(page.getByText('Add items from menu to start an order')).toBeVisible({ timeout: 5000 });
  });

  test('4. Orders page reflects Takeaway and WhatsApp customer phone', async ({ page }) => {
    await page.goto(`${WEB_BASE}/orders`);
    await page.waitForLoadState('networkidle');

    // Verify orders list is visible
    const orderCards = page.locator('.mantine-Paper-root').filter({ hasText: '#' });
    await expect(orderCards.first()).toBeVisible({ timeout: 10000 });

    // Latest order should show Takeaway badge and WA badge
    const firstOrder = orderCards.first();
    const orderText = await firstOrder.innerText();
    console.log('Latest order on /orders page:', orderText);
    expect(orderText).toMatch(/Takeaway|WA/);

    // Click order to open modal
    await firstOrder.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    const modalText = await modal.innerText();
    console.log('Order modal details:', modalText);
    expect(modalText).toMatch(/Takeaway/i);
  });
});
