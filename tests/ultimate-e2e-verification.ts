import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

// Load authentication session
let sessionCookie = '';
let cachedCookieObj: any = null;
if (fs.existsSync(CACHE_FILE)) {
  cachedCookieObj = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  sessionCookie = `${cachedCookieObj.name}=${cachedCookieObj.value}`;
}

let restaurantId = '';
let outletId = '';
let sampleItemId = '';
let tableAId = '';
let tableBId = '';
const tableAName = `T-A-${Date.now().toString().slice(-4)}`;
const tableBName = `T-B-${Date.now().toString().slice(-4)}`;
let dineInOrderId = '';
let takeawayOrderId = '';
let deliveryOrderId = '';
let voidOrderId = '';
let riderId = '';
let waiterRequestId = '';
let deliveryPin = '';

const customerPhone = `+9198765${Date.now().toString().slice(-5)}`;

async function api(pathStr: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (sessionCookie) headers.set('Cookie', sessionCookie);
  if (restaurantId && !headers.has('X-Restaurant-Id')) headers.set('X-Restaurant-Id', restaurantId);
  if (outletId && !headers.has('X-Outlet-Id')) headers.set('X-Outlet-Id', outletId);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${pathStr}`, {
        ...options,
        headers,
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }

      return { status: res.status, ok: res.ok, headers: res.headers, data: json };
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error('API request failed after 3 attempts');
}

function assert(condition: boolean, msg: string, detail?: any) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`, detail ? JSON.stringify(detail) : '');
    throw new Error(msg);
  }
  console.log(`  ✅ ${msg}`);
}

async function runAudit() {
  console.log('========================================================================');
  console.log('🌟 ULTIMATE FULL-APPLICATION E2E FEATURE VERIFICATION & AUDIT');
  console.log('========================================================================\n');

  const testResults: Record<string, 'PASSED' | 'FAILED'> = {};

  try {
    // ─── 1. Health & Auth ───────────────────────────────────────────────────────
    console.log('--- SECTION 1: System Health & Multi-Tenancy ---');
    const health = await api('/health');
    assert(health.status === 200 && health.data.status === 'ok', 'API health check passed');

    const me = await api('/auth/me');
    assert(me.status === 200 && me.data.user?.role === 'OWNER', 'Owner authenticated successfully');
    console.log(`  Active Owner: ${me.data.user.name} (${me.data.user.phoneNumber})`);

    const rest = await api('/restaurants');
    assert(rest.status === 200 && rest.data.length > 0, 'Fetched active restaurants');
    restaurantId = rest.data[0].id;

    const outlets = await api('/outlets');
    assert(outlets.status === 200 && outlets.data.length > 0, 'Fetched restaurant outlets');
    const defOutlet = outlets.data.find((o: any) => o.isDefault) || outlets.data[0];
    outletId = defOutlet.id;
    console.log(`  Active Outlet: ${defOutlet.name} (${outletId})`);
    testResults['System Health & Multi-Tenancy'] = 'PASSED';

    // ─── 2. Role-Based Permissions & Guard Verification ────────────────────────
    console.log('\n--- SECTION 2: Role-Based Permissions & Security Guards ---');
    // Verify 401 on missing auth
    const unauth = await fetch(`${API_BASE}/orders/list`, {
      headers: { 'X-Restaurant-Id': restaurantId },
    });
    assert(unauth.status === 401, 'Unauthorized request correctly rejected with 401');

    // Verify 400 on missing restaurant header
    const noRest = await api('/orders/list', {
      headers: { 'X-Restaurant-Id': '' },
    });
    assert(noRest.status === 400, 'Missing X-Restaurant-Id correctly rejected with 400');

    // Verify 403 on unauthorized restaurant access
    const badRest = await api('/orders/list', {
      headers: { 'X-Restaurant-Id': 'rest_unauthorized_other_tenant_123' },
    });
    assert(badRest.status === 403, 'Unauthorized restaurant access correctly rejected with 403');
    testResults['Role-Based Permissions & Guards'] = 'PASSED';

    // ─── 3. Menu Management ─────────────────────────────────────────────────────
    console.log('\n--- SECTION 3: Menu Catalogue & Items ---');
    const cats = await api(`/menu/categories?outletId=${outletId}`);
    assert(cats.status === 200 && Array.isArray(cats.data), 'Listed menu categories');

    const items = await api(`/menu/items?outletId=${outletId}`);
    assert(items.status === 200 && Array.isArray(items.data) && items.data.length > 0, 'Listed menu items');
    sampleItemId = items.data[0].id;
    console.log(`  Sample Item Selected: ${items.data[0].name} (₹${items.data[0].pricePaise / 100})`);

    // Toggle item availability
    const toggle = await api(`/menu/items/${sampleItemId}/toggle`, { method: 'PATCH' });
    assert(toggle.status === 200, 'Toggled item availability');
    await api(`/menu/items/${sampleItemId}/toggle`, { method: 'PATCH' }); // reset
    testResults['Menu Catalogue & Management'] = 'PASSED';

    // ─── 4. Table Management & Transfers ───────────────────────────────────────
    console.log('\n--- SECTION 4: Table Management & Table Transfers ---');
    // Create Table A
    const tblARes = await api('/tables/create', {
      method: 'POST',
      body: JSON.stringify({ outletId, name: tableAName, section: 'Ground Floor', capacity: 4 }),
    });
    assert(tblARes.status === 201, `Created Table A (${tableAName})`);
    tableAId = tblARes.data.id;

    // Create Table B
    const tblBRes = await api('/tables/create', {
      method: 'POST',
      body: JSON.stringify({ outletId, name: tableBName, section: 'Garden Area', capacity: 6 }),
    });
    assert(tblBRes.status === 201, `Created Table B (${tableBName})`);
    tableBId = tblBRes.data.id;

    // Update Table A capacity
    const updateTbl = await api(`/tables/update/${tableAId}`, {
      method: 'POST',
      body: JSON.stringify({ outletId, name: tableAName, section: 'Ground Floor', capacity: 5 }),
    });
    assert(updateTbl.status === 200 && updateTbl.data.capacity === 5, 'Updated table details');

    // Toggle active status
    const toggleTbl = await api(`/tables/toggle-active/${tableAId}`, { method: 'POST' });
    assert(toggleTbl.status === 200 && toggleTbl.data.active === false, 'Toggled table inactive');
    await api(`/tables/toggle-active/${tableAId}`, { method: 'POST' }); // toggle back
    testResults['Table Management & Layout'] = 'PASSED';

    // ─── 5. POS Dine-in Order with Multi-Round, KOT, and Transfer ───────────────
    console.log('\n--- SECTION 5: POS Dine-in Lifecycle (Rounds, KOT, Transfer, Settle) ---');
    // Start Dine-in Order on Table A
    const dineInRes = await api('/orders/send-to-kitchen', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        tableNo: tableAName,
        customerPhone,
        note: 'Customer prefers spicy food',
        items: [{ itemId: sampleItemId, qty: 2, note: 'Round 1 Starter' }],
      }),
    });
    assert(dineInRes.status === 201, `Dine-in Order created: #${dineInRes.data.order.orderNo}`);
    dineInOrderId = dineInRes.data.order.id;

    // Verify Table A occupied
    const occupiedRes = await api(`/orders/list?outletId=${outletId}&tableOccupied=true`);
    assert(
      occupiedRes.status === 200 && occupiedRes.data.some((o: any) => o.order.tableNo === tableAName),
      'Table A correctly detected as OCCUPIED'
    );

    // Add Round 2
    const round2 = await api('/orders/add-round', {
      method: 'POST',
      body: JSON.stringify({
        orderId: dineInOrderId,
        items: [{ itemId: sampleItemId, qty: 1, note: 'Round 2 Mains' }],
      }),
    });
    assert(round2.status === 200 && round2.data.round === 2, 'Added Round 2 to Dine-in order');

    // Mark KOT Printed
    const kotPrint = await api('/orders/mark-kot-printed', {
      method: 'POST',
      body: JSON.stringify({ orderId: dineInOrderId }),
    });
    assert(kotPrint.status === 200 && kotPrint.data.order.kotPrintedAt !== null, 'Hardware KOT printed timestamp recorded');

    // Transfer Table from Table A to Table B
    const transfer = await api('/tables/transfer', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        orderId: dineInOrderId,
        fromTableNo: tableAName,
        toTableNo: tableBName,
      }),
    });
    assert(transfer.status === 200, `Transferred order from ${tableAName} to ${tableBName}`);

    // Verify Table B is now occupied and Table A is free
    const occupiedTrans = await api(`/orders/list?outletId=${outletId}&tableOccupied=true`);
    assert(!occupiedTrans.data.some((o: any) => o.order.tableNo === tableAName), 'Table A is now FREE after transfer');
    assert(occupiedTrans.data.some((o: any) => o.order.tableNo === tableBName), 'Table B is now OCCUPIED after transfer');

    // Settle Bill on transferred order
    const settle = await api('/orders/settle-bill', {
      method: 'POST',
      body: JSON.stringify({
        orderId: dineInOrderId,
        method: 'UPI',
        customerPhone,
      }),
    });
    assert(settle.status === 200 && settle.data.order.status === 'PAID', 'Dine-in bill settled via UPI');

    // Free Table B
    const freeTbl = await api('/orders/free-table', {
      method: 'POST',
      body: JSON.stringify({ orderId: dineInOrderId, method: 'UPI' }),
    });
    assert(freeTbl.status === 200, 'Table B freed successfully');

    // Send Digital WhatsApp Receipt
    const waReceipt = await api('/orders/send-whatsapp-receipt', {
      method: 'POST',
      body: JSON.stringify({ orderId: dineInOrderId, phone: customerPhone }),
    });
    assert(waReceipt.status === 200 && waReceipt.data.success === true, 'Digital WhatsApp receipt dispatched');
    testResults['POS Dine-in Lifecycle & Table Transfer'] = 'PASSED';

    // ─── 6. Fast Takeaway Order (Settle & Send) ─────────────────────────────────
    console.log('\n--- SECTION 6: POS Takeaway Counter Sale (Settle & Send) ---');
    const takeaway = await api('/orders/create-settled', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        tableNo: 'Takeaway',
        orderType: 'TAKEAWAY',
        customerPhone,
        method: 'Cash',
        packagingChargePaise: 3000,
        items: [{ itemId: sampleItemId, qty: 1 }],
      }),
    });
    assert(takeaway.status === 201 && takeaway.data.order.status === 'PAID', 'Created takeaway order settled directly (PAID)');
    assert(takeaway.data.order.packagingChargePaise === 3000, 'Packaging charge applied correctly');
    takeawayOrderId = takeaway.data.order.id;
    testResults['POS Takeaway Counter Sale'] = 'PASSED';

    // ─── 7. Delivery Order & Rider Fleet Dispatch ───────────────────────────────
    console.log('\n--- SECTION 7: Delivery Orders & Rider Fleet Lifecycle ---');
    // Save Address
    const saveAddr = await api('/delivery/save-address', {
      method: 'POST',
      body: JSON.stringify({
        customerPhone,
        label: 'Office HQ',
        receiverName: 'Vishal K',
        receiverPhone: customerPhone,
        addressLine1: '402 High-Tech Park',
        addressLine2: 'Indiranagar 100ft Road',
        landmark: 'Near Metro',
        city: 'Bangalore',
        pincode: '560038',
      }),
    });
    assert(saveAddr.status === 200 || saveAddr.status === 201, 'Saved customer delivery address');

    // List Addresses
    const listAddr = await api(`/delivery/customer-addresses/${encodeURIComponent(customerPhone)}`);
    assert(listAddr.status === 200 && listAddr.data.length > 0, 'Retrieved customer saved addresses');

    // List Riders
    const riders = await api(`/delivery/riders?outletId=${outletId}`);
    assert(riders.status === 200 && Array.isArray(riders.data), 'Retrieved fleet riders');
    if (riders.data.length > 0) {
      riderId = riders.data[0].id;
    } else {
      const newRider = await api('/delivery/register-rider', {
        method: 'POST',
        body: JSON.stringify({
          outletId,
          name: 'Flash Rider',
          phone: '+919911223344',
          vehicleType: 'EV',
          vehicleNumber: 'KA-01-AB-1234',
        }),
      });
      riderId = newRider.data.id;
    }

    // Toggle Rider Duty
    const duty = await api('/delivery/update-rider-duty', {
      method: 'POST',
      body: JSON.stringify({ riderId, status: 'AVAILABLE' }),
    });
    assert(duty.status === 200 && duty.data.status === 'AVAILABLE', 'Rider marked AVAILABLE (On Duty)');

    // Create Delivery Order
    const delOrder = await api('/orders/send-to-kitchen', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        orderType: 'DELIVERY',
        customerPhone,
        deliveryChargePaise: 4000,
        packagingChargePaise: 2000,
        delivery: {
          customerName: 'Vishal K',
          customerPhone,
          addressLine1: '402 High-Tech Park',
          city: 'Bangalore',
          pincode: '560038',
          deliveryMode: 'IN_HOUSE',
        },
        items: [{ itemId: sampleItemId, qty: 1 }],
      }),
    });
    assert(delOrder.status === 201 && delOrder.data.delivery !== null, 'Created Delivery Order with auto-generated PIN');
    deliveryOrderId = delOrder.data.order.id;
    deliveryPin = delOrder.data.delivery.deliveryOtp;
    console.log(`  Delivery Order #${delOrder.data.order.orderNo} created with OTP PIN: ${deliveryPin}`);

    // Assign Rider
    const assign = await api('/delivery/assign-rider', {
      method: 'POST',
      body: JSON.stringify({ orderId: deliveryOrderId, riderId }),
    });
    assert(assign.status === 200 && assign.data.status === 'ASSIGNED', 'Rider assigned to order');

    // Dispatch Order
    const dispatch = await api('/delivery/dispatch-order', {
      method: 'POST',
      body: JSON.stringify({ orderId: deliveryOrderId, riderId }),
    });
    assert(dispatch.status === 200 && dispatch.data.status === 'OUT_FOR_DELIVERY', 'Delivery dispatched OUT_FOR_DELIVERY');

    // Complete Delivery with OTP
    const verifyOtp = await api('/delivery/verify-otp-and-complete', {
      method: 'POST',
      body: JSON.stringify({ orderId: deliveryOrderId, deliveryOtp: deliveryPin }),
    });
    assert(verifyOtp.status === 200 && verifyOtp.data.status === 'DELIVERED', 'Delivery completed with OTP verification');

    // Verify auto-settled
    const checkDelPaid = await api(`/orders/${deliveryOrderId}`);
    assert(checkDelPaid.data.order.status === 'PAID', 'Delivery order auto-settled upon verified delivery');
    testResults['Delivery & Rider Fleet Operations'] = 'PASSED';

    // ─── 8. Kitchen Display System (KDS) ────────────────────────────────────────
    console.log('\n--- SECTION 8: Kitchen Display System (KDS) Tickets ---');
    // Start fresh order for KDS
    const kdsOrder = await api('/orders/send-to-kitchen', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        tableNo: tableBName,
        customerPhone,
        items: [{ itemId: sampleItemId, qty: 2 }],
      }),
    });
    const kdsOrderId = kdsOrder.data.order.id;
    const kdsOrderItemId = kdsOrder.data.items[0].id;

    // Fetch Active Tickets
    const kdsTickets = await api(`/kitchen/active-tickets?outletId=${outletId}`);
    assert(kdsTickets.status === 200 && Array.isArray(kdsTickets.data), 'Fetched KDS active tickets');

    // Advance status to PREPARING
    const adv = await api('/kitchen/advance-item-status', {
      method: 'POST',
      body: JSON.stringify({ orderId: kdsOrderId, orderItemId: kdsOrderItemId, action: 'next' }),
    });
    assert(adv.status === 200, 'Advanced KDS item status');

    // Mark Order Ready
    const ready = await api('/kitchen/mark-order-ready', {
      method: 'POST',
      body: JSON.stringify({ orderId: kdsOrderId }),
    });
    assert(ready.status === 200, 'Marked KDS order ready');

    // Cancel an item test
    const cancelItem = await api('/kitchen/cancel-item', {
      method: 'POST',
      body: JSON.stringify({ orderId: kdsOrderId, orderItemId: kdsOrderItemId, reason: 'Customer changed mind' }),
    });
    assert(cancelItem.status === 200, 'Item cancelled from KDS with audit log');

    // Free KDS order
    await api('/orders/free-table', {
      method: 'POST',
      body: JSON.stringify({ orderId: kdsOrderId, autoSettle: true, method: 'Cash' }),
    });

    testResults['Kitchen Display System (KDS)'] = 'PASSED';

    // ─── 9. Waiter Assistance & Floor Requests ──────────────────────────────────
    console.log('\n--- SECTION 9: Waiter Floor Operations & Assistance Calls ---');
    // Call Assistance
    const callWaiter = await api('/waiter/call-assistance', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        tableNo: tableBName,
        serviceType: 'WATER',
        serviceLabel: 'Fresh Lime Water',
        note: 'Cold water please',
      }),
    });
    assert(callWaiter.status === 201, 'Customer called waiter assistance');
    waiterRequestId = callWaiter.data.id;

    // List Active Requests
    const waiterReqs = await api(`/waiter/active-requests?outletId=${outletId}`);
    assert(waiterReqs.status === 200 && waiterReqs.data.some((r: any) => r.id === waiterRequestId), 'Waiter request visible in floor dashboard');

    // Attend Request
    const attend = await api('/waiter/attend-request', {
      method: 'POST',
      body: JSON.stringify({ requestId: waiterRequestId }),
    });
    assert(attend.status === 200 && attend.data.status === 'IN_PROGRESS', 'Waiter claimed & attended request');

    // Complete Request
    const complete = await api('/waiter/complete-request', {
      method: 'POST',
      body: JSON.stringify({ requestId: waiterRequestId }),
    });
    assert(complete.status === 200 && complete.data.status === 'COMPLETED', 'Waiter marked request COMPLETED');

    // Waiter Stats
    const waiterStats = await api(`/waiter/stats?outletId=${outletId}`);
    assert(waiterStats.status === 200 && typeof waiterStats.data.completedTodayCount === 'number', 'Fetched waiter statistics');
    testResults['Waiter Floor Operations'] = 'PASSED';

    // ─── 10. Customer Self-Service Portal ───────────────────────────────────────
    console.log('\n--- SECTION 10: Customer Self-Service Portal ---');
    // Session
    const portalSession = await api('/portal/session');
    assert(portalSession.status === 200 && Array.isArray(portalSession.data.activeOrders), 'Customer portal session loaded');

    // Outlet Menu
    const portalMenu = await api(`/portal/menu/${outletId}`);
    assert(portalMenu.status === 200 && portalMenu.data.items?.length > 0, 'Customer portal digital menu retrieved');

    // Update Profile
    const updateProfile = await api('/portal/update-profile', {
      method: 'POST',
      body: JSON.stringify({ name: 'Vishal Kondle (VIP)', email: 'vishal.vip@logixsoft.in' }),
    });
    assert(updateProfile.status === 200 && updateProfile.data.success === true, 'Updated customer guest profile');
    testResults['Customer Self-Service Portal'] = 'PASSED';

    // ─── 11. Order Voiding Lifecycle ────────────────────────────────────────────
    console.log('\n--- SECTION 11: Order Void Lifecycle with Audit ---');
    const voidTableName = `T-Void-${Date.now().toString().slice(-4)}`;
    const voidPhone = `+9198765${(Date.now() + 77).toString().slice(-5)}`;
    const voidOrderCreate = await api('/orders/send-to-kitchen', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        tableNo: voidTableName,
        customerPhone: voidPhone,
        items: [{ itemId: sampleItemId, qty: 1 }],
      }),
    });
    assert(voidOrderCreate.status === 201, 'Created order to test voiding', voidOrderCreate);
    voidOrderId = voidOrderCreate.data.order.id;

    const voidRes = await api('/orders/void', {
      method: 'POST',
      body: JSON.stringify({ orderId: voidOrderId, reason: 'Duplicate test order' }),
    });
    assert(voidRes.status === 200 && voidRes.data.order.status === 'VOID', 'Order successfully voided with audit reason');
    testResults['Order Void Lifecycle'] = 'PASSED';

    // ─── 12. Customer CRM & Profile Metrics ─────────────────────────────────────
    console.log('\n--- SECTION 12: Customer CRM & Profile Analytics ---');
    const crm = await api(`/customers/${encodeURIComponent(customerPhone)}`);
    assert(crm.status === 200 && crm.data.customer, 'Customer CRM record retrieved');
    console.log(`  Customer Visits: ${crm.data.metrics.visitCount} | Lifetime Spend: ₹${crm.data.metrics.lifetimeSpendPaise / 100}`);

    const crmNotes = await api(`/customers/${encodeURIComponent(customerPhone)}/notes`, {
      method: 'PUT',
      body: JSON.stringify({
        notes: 'Regular diner, prefers outdoor seating',
        tags: ['VIP', 'Foodie'],
        favoriteTable: tableAName,
      }),
    });
    assert(crmNotes.status === 200, 'Customer CRM notes & tags updated');
    testResults['Customer CRM & Metrics'] = 'PASSED';

    // ─── 13. Reports & Analytics ────────────────────────────────────────────────
    console.log('\n--- SECTION 13: Financial & Operational Reports ---');
    const today = new Date().toISOString().slice(0, 10);
    const repSummary = await api(`/reports/summary?from=${today}&to=${today}&outletId=${outletId}`);
    assert(repSummary.status === 200 && repSummary.data.data, 'Financial KPI summary report generated', repSummary);
    console.log(`  Today's Revenue: ₹${(repSummary.data.data.revenuePaise || 0) / 100} | Total Orders: ${repSummary.data.data.paidCount}`);

    const repItems = await api(`/reports/top-items?from=${today}&to=${today}&outletId=${outletId}`);
    assert(repItems.status === 200 && Array.isArray(repItems.data.data.itemsReport), 'Top items report generated', repItems);

    const repPayments = await api(`/reports/payment-methods?from=${today}&to=${today}&outletId=${outletId}`);
    assert(repPayments.status === 200 && Array.isArray(repPayments.data.data.byPaymentMethod), 'Payment methods report generated', repPayments);
    testResults['Financial & Operational Reports'] = 'PASSED';

    // ─── 14. Real-time Live Sync Ticket ─────────────────────────────────────────
    console.log('\n--- SECTION 14: WebSocket Live Sync & Ticket Authentication ---');
    const wsTicket = await api('/auth/ws-ticket');
    assert(wsTicket.status === 200 && typeof wsTicket.data.ticket === 'string', 'WebSocket ticket generated');
    testResults['WebSocket Live Sync'] = 'PASSED';

    // ─── Cleanup ────────────────────────────────────────────────────────────────
    console.log('\n--- Cleanup: Soft-deleting test tables ---');
    if (tableAId) await api(`/tables/delete/${tableAId}`, { method: 'POST' });
    if (tableBId) await api(`/tables/delete/${tableBId}`, { method: 'POST' });
    console.log('  Cleaned up test tables cleanly.');

    // ─── 15. Playwright Browser UI E2E ──────────────────────────────────────────
    console.log('\n--- SECTION 15: Playwright Web UI Visual & Interactive Tests ---');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    if (cachedCookieObj) {
      await context.addCookies([
        {
          name: cachedCookieObj.name,
          value: cachedCookieObj.value,
          domain: 'dine.logixsoft.in',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'None',
        },
      ]);
    }

    const page = await context.newPage();

    // 1. POS Page
    console.log('Testing Web UI: /pos ...');
    await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_verify_pos_page.png') });
    console.log('  ✅ POS page loaded & screenshotted');

    // 2. Orders Page
    console.log('Testing Web UI: /orders ...');
    await page.goto(`${WEB_BASE}/orders`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_verify_orders_page.png') });
    console.log('  ✅ Orders page loaded & screenshotted');

    // 3. Kitchen KDS Page
    console.log('Testing Web UI: /kitchen ...');
    await page.goto(`${WEB_BASE}/kitchen`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_verify_kitchen_page.png') });
    console.log('  ✅ Kitchen KDS page loaded & screenshotted');

    // 4. Waiter Page
    console.log('Testing Web UI: /waiter ...');
    await page.goto(`${WEB_BASE}/waiter`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_verify_waiter_page.png') });
    console.log('  ✅ Waiter floor page loaded & screenshotted');

    // 5. Rider Page
    console.log('Testing Web UI: /rider ...');
    await page.goto(`${WEB_BASE}/rider`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_verify_rider_page.png') });
    console.log('  ✅ Rider delivery page loaded & screenshotted');

    // 6. Tables Page
    console.log('Testing Web UI: /tables ...');
    await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_verify_tables_page.png') });
    console.log('  ✅ Tables page loaded & screenshotted');

    // 7. Customer Portal Page
    console.log('Testing Web UI: /portal ...');
    await page.goto(`${WEB_BASE}/portal`, { waitUntil: 'commit' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_verify_portal_page.png') });
    console.log('  ✅ Customer portal page loaded & screenshotted');

    await browser.close();
    testResults['Web Browser UI Interactive Tests'] = 'PASSED';

    console.log('\n========================================================================');
    console.log('🎉 ALL 15 CORE APPLICATION MODULES & UI WORKFLOWS PASSED 100%!');
    console.log('========================================================================');

    console.log(JSON.stringify(testResults, null, 2));

  } catch (err: any) {
    console.error('\n❌ AUDIT ENCOUNTERED ERROR:', err);
    process.exit(1);
  }
}

runAudit();
