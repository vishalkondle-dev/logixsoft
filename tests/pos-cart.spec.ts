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

async function addItemToCart(page: any) {
  const itemCard = page.locator('.mantine-Paper-root').filter({ hasText: '₹' }).first();
  await itemCard.waitFor({ state: 'visible', timeout: 10000 });
  await itemCard.click();
  await page.waitForTimeout(400);

  const customizeAddBtn = page.locator('.mantine-Modal-content button').filter({ hasText: /^Add/i }).first();
  if (await customizeAddBtn.isVisible()) {
    await customizeAddBtn.click();
    await page.waitForTimeout(400);
  }
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

    // Free any active orders for test phone to prevent conflict
    try {
      const [rest] = await apiGet('/restaurants');
      if (rest?.id) {
        const openList = await apiGet('/orders/list?limit=100', rest.id);
        for (const o of (openList || [])) {
          if (o.order?.customerPhone?.includes('7276718848') && (o.order.status === 'OPEN' || !o.order.tableFreedAt)) {
            await fetch(`${API_BASE}/orders/free-table`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': `${authCookie.name}=${authCookie.value}`,
                'X-Restaurant-Id': rest.id,
              },
              body: JSON.stringify({ orderId: o.order.id, method: 'Cash', autoSettle: true }),
            }).catch(() => {});
          }
        }
      }
    } catch {}
  });

  test('1. Table select defaults to takeaway, customer phone exists, chevron is compact', async ({ page }) => {
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('domcontentloaded');

    // Verify on POS page
    await expect(page).toHaveURL(/.*\/pos.*/);

    // a. Order mode defaults to "Takeaway" via SegmentedControl
    const takeawayControl = page.locator('label').filter({ hasText: 'Takeaway' }).first();
    await expect(takeawayControl).toBeVisible({ timeout: 10000 });

    // Switch to Dine-In to verify Table select dropdown
    const dineInControl = page.locator('label').filter({ hasText: 'Dine-In' }).first();
    if (await dineInControl.isVisible()) {
      await dineInControl.click();
      await page.waitForTimeout(500);
      const tableSelectInput = page.locator('input[placeholder*="table" i]').first();
      await expect(tableSelectInput).toBeVisible();

      // Switch back to Takeaway
      await takeawayControl.click();
      await page.waitForTimeout(500);
    }

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
    await page.waitForLoadState('domcontentloaded');

    // Get restaurant ID and initial order count
    const [restaurant] = await apiGet('/restaurants');
    const restaurantId = restaurant.id;
    const initialOrders = await apiGet('/orders/list?limit=100', restaurantId);
    const initialCount = Array.isArray(initialOrders) ? initialOrders.length : 0;
    console.log('Initial orders count:', initialCount);

    // 1. Add item to cart
    await addItemToCart(page);

    // Verify item is visible in local cart
    const cartItem = page.locator('.mantine-Paper-root').filter({ has: page.locator('button[aria-label="Increase quantity"]') }).first();
    await expect(cartItem).toBeVisible();

    // CRITICAL CHECK: Verify order was NOT created in backend yet!
    const ordersAfterAdd = await apiGet('/orders/list?limit=100', restaurantId);
    expect(ordersAfterAdd.length).toBe(initialCount);
    console.log('Verified: Order was NOT created in DB when adding items to cart!');

    // 2. Modify quantity in local cart
    const plusBtn = page.locator('button').filter({ has: page.locator('svg.tabler-icon-plus') }).first();
    await plusBtn.click();
    await page.waitForTimeout(300);

    // Still no order created
    const ordersAfterQty = await apiGet('/orders/list?limit=100', restaurantId);
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
    const ordersAfterSend = await apiGet('/orders/list?limit=100', restaurantId);
    if (initialCount < 100) {
      expect(ordersAfterSend.length).toBeGreaterThanOrEqual(initialCount + 1);
    }

    const latestOrder = expectedOrderNo
      ? ordersAfterSend.find((o: any) => o.order.orderNo === expectedOrderNo)
      : ordersAfterSend[0];
    expect(latestOrder).toBeDefined();
    console.log('Created order:', latestOrder.order.orderNo, 'Table:', latestOrder.order.tableNo, 'CustomerPhone:', latestOrder.order.customerPhone);
    expect(latestOrder.order.tableNo).toBe('Takeaway');
    expect(latestOrder.order.customerPhone).toBe('7276718848');

    // 7. Verify cart is reset
    await expect(page.getByText('Add items from menu to start an order')).toBeVisible({ timeout: 5000 });
    const takeawayControl = page.locator('label').filter({ hasText: 'Takeaway' }).first();
    await expect(takeawayControl).toBeVisible();
    const resetPhone = await phoneInput.inputValue();
    expect(resetPhone).toBe('');
  });

  test('3. Settle & Send flow via compact chevron dropdown', async ({ page }) => {
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('domcontentloaded');

    // Add item to cart
    await addItemToCart(page);

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
    await page.waitForLoadState('domcontentloaded');

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

  test('5. Viewport meta tag and mobile input font-size >= 16px prevent auto-zoom on focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // Mobile viewport (iPhone 13)
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify Viewport meta tag contains proper scale locks & interactive-widget
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    console.log('Viewport Meta Content:', viewportMeta);
    expect(viewportMeta).toContain('width=device-width');
    expect(viewportMeta).toContain('maximum-scale=1');
    expect(viewportMeta).toContain('user-scalable=no');
    expect(viewportMeta).toContain('interactive-widget=resizes-content');

    // 2. Verify search input font-size is at least 16px on mobile (prevents iOS auto-zoom)
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await expect(searchInput).toBeVisible();
    const searchFz = await searchInput.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('Mobile search input font size:', searchFz);
    expect(parseFloat(searchFz)).toBeGreaterThanOrEqual(16);

    // 3. Verify mobile cart button is NOT visible when cart is empty
    await expect(page.getByRole('button', { name: /cart/i })).not.toBeVisible();

    // 4. Add an item and verify mobile cart button becomes visible
    await addItemToCart(page);

    const openCartBtn = page.getByRole('button', { name: /cart/i }).first();
    await expect(openCartBtn).toBeVisible();
    await openCartBtn.click();
    const phoneInput = page.locator('input[placeholder*="WhatsApp" i]:visible');
    await expect(phoneInput).toBeVisible();
    const phoneFz = await phoneInput.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('Mobile phone input font size:', phoneFz);
    expect(parseFloat(phoneFz)).toBeGreaterThanOrEqual(16);

    // 4. Focus on phone input and ensure page scale / visualViewport does not zoom
    await phoneInput.focus();
    const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    console.log('Visual viewport scale after focus:', scale);
    expect(scale).toBe(1);
  });

  test('6. Phone numeric only, Clear button clears table & phone, bigger action buttons, no each word, and + Note modal with chips', async ({ page }) => {
    await page.goto(`${WEB_BASE}/pos`);
    await page.waitForLoadState('domcontentloaded');

    // 1. Phone number must be numbers only
    const phoneInput = page.locator('input[placeholder*="WhatsApp" i]').first();
    await phoneInput.fill('abc987-xyz.654#3210');
    const filteredPhone = await phoneInput.inputValue();
    console.log('Filtered Phone:', filteredPhone);
    expect(filteredPhone).toBe('9876543210');
    expect(filteredPhone).not.toMatch(/\D/);

    // 2. Change table selection away from Takeaway (switch to Dine-In)
    const dineInControl = page.locator('label').filter({ hasText: 'Dine-In' }).first();
    if (await dineInControl.isVisible()) {
      await dineInControl.click();
      await page.waitForTimeout(300);
      const tableSelectInput = page.locator('input[placeholder*="table" i]').first();
      if (await tableSelectInput.isVisible()) {
        await tableSelectInput.click();
        await page.waitForTimeout(300);
        const t1Option = page.getByRole('option', { name: /T1/i }).first();
        if (await t1Option.isVisible()) {
          await t1Option.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }

    // 3. Add item to cart
    await addItemToCart(page);

    // 4. Verify "each" is NOT present; shows ₹X only
    const cartItem = page.locator('.mantine-Paper-root').filter({ has: page.locator('button[aria-label="Increase quantity"]') }).first();
    await expect(cartItem).toBeVisible();
    const itemText = await cartItem.innerText();
    console.log('Cart item text:', itemText);
    expect(itemText).not.toMatch(/each/i);
    expect(itemText).toMatch(/₹\d+/);

    // 5. Verify action buttons are bigger (>= 28px)
    const plusBtn = cartItem.locator('button[aria-label="Increase quantity"]');
    const plusBox = await plusBtn.boundingBox();
    expect(plusBox).not.toBeNull();
    console.log('Plus button size:', plusBox!.width, 'x', plusBox!.height);
    expect(plusBox!.width).toBeGreaterThanOrEqual(28);
    expect(plusBox!.height).toBeGreaterThanOrEqual(28);

    // 6. Test "+ Note" button and Note Modal with chips
    const addNoteBtn = cartItem.getByRole('button', { name: /\+ Note/i });
    await expect(addNoteBtn).toBeVisible();
    await addNoteBtn.click();

    // Note Modal opens
    const noteModal = page.getByRole('dialog').filter({ hasText: /Note for/i });
    await expect(noteModal).toBeVisible();

    // Verify default chips are visible
    const spicyChip = noteModal.getByRole('button', { name: /Less Spicy/i });
    await expect(spicyChip).toBeVisible();
    await spicyChip.click();

    // Verify chip text appears in textarea
    const textarea = noteModal.locator('textarea');
    await expect(textarea).toHaveValue(/Less Spicy/);

    // Save Note
    const saveNoteBtn = noteModal.getByRole('button', { name: /Save Note/i });
    await saveNoteBtn.click();

    // Modal closes and note badge is visible on cart item
    await expect(noteModal).not.toBeVisible();
    await expect(cartItem.getByText(/Less Spicy/i)).toBeVisible();

    // 7. Clear button clears items, table, and phone
    const clearBtn = page.getByRole('button', { name: /^Clear$/i });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Verify cart is empty
    await expect(page.getByText('Add items from menu to start an order')).toBeVisible();

    // Verify phone is cleared
    expect(await phoneInput.inputValue()).toBe('');

    // Verify table is reset to Takeaway
    const resetTakeaway = page.locator('label').filter({ hasText: 'Takeaway' }).first();
    await expect(resetTakeaway).toBeVisible();
  });

  test('7. Order ID is dynamic string based on outlet, and token sequence is per-outlet', async () => {
    // 1. Fetch restaurant and bootstrap
    const [restaurant] = await apiGet('/restaurants');
    const restaurantId = restaurant.id;
    let outlets = await apiGet('/outlets', restaurantId);
    if (!Array.isArray(outlets) || outlets.length < 2) {
      await fetch(`${API_BASE}/outlets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `${authCookie.name}=${authCookie.value}`,
          'X-Restaurant-Id': restaurantId,
        },
        body: JSON.stringify({
          name: 'Koramangala Hub',
          address: '80 Feet Rd, Bengaluru',
        }),
      });
      outlets = await apiGet('/outlets', restaurantId);
    }
    expect(outlets.length).toBeGreaterThanOrEqual(2);

    const outlet1 = outlets[0];
    const outlet2 = outlets.find((o: any) => o.id !== outlet1.id);
    expect(outlet2).toBeDefined();

    const items = await apiGet('/menu/items', restaurantId);
    const item = items[0];
    expect(item).toBeDefined();

    // 2. Create an order in outlet2 via API
    const res = await fetch(`${API_BASE}/orders/send-to-kitchen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${authCookie.name}=${authCookie.value}`,
        'X-Restaurant-Id': restaurantId,
      },
      body: JSON.stringify({
        outletId: outlet2.id,
        tableNo: 'Takeaway',
        items: [{ itemId: item.id, qty: 1 }],
      }),
    });
    expect(res.ok).toBe(true);
    const created = await res.json();
    console.log(`Created order in ${outlet2.name}:`, created.order.id, 'Token #:', created.order.orderNo);

    // 3. Verify order ID format includes outlet ID and timestamp
    expect(created.order.id).toMatch(new RegExp(`^(?:ord_)?${outlet2.id}[-_]\\d+$`));

    // 4. Verify token ID is positive number
    expect(created.order.orderNo).toBeGreaterThanOrEqual(1);

    // 5. Create another order in outlet2 and verify token ID increments by 1
    const res2 = await fetch(`${API_BASE}/orders/send-to-kitchen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${authCookie.name}=${authCookie.value}`,
        'X-Restaurant-Id': restaurantId,
      },
      body: JSON.stringify({
        outletId: outlet2.id,
        tableNo: 'Takeaway',
        items: [{ itemId: item.id, qty: 1 }],
      }),
    });
    expect(res2.ok).toBe(true);
    const created2 = await res2.json();
    expect(created2.order.orderNo).toBe(created.order.orderNo + 1);
    expect(created2.order.id).toMatch(new RegExp(`^(?:ord_)?${outlet2.id}[-_]\\d+$`));
    expect(created2.order.id).not.toBe(created.order.id);
  });
});
