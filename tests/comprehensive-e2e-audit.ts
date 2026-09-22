import * as fs from 'fs';

const API_BASE = 'https://dine-api.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';

// Test session cookie
let sessionCookie = '';
if (fs.existsSync(CACHE_FILE)) {
  const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  sessionCookie = `${cached.name}=${cached.value}`;
}

let restaurantId = '';
let outletId = '';
let sampleItemId = '';
let testTableId = '';
const testTableName = `T-Test-${Date.now().toString().slice(-4)}`;
let testDineInOrderId = '';
let testTakeawayOrderId = '';
let testDeliveryOrderId = '';
let testRiderId = '';
let testWaiterRequestId = '';

const testCustomerPhone = '+919988776655';

async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (sessionCookie) headers.set('Cookie', sessionCookie);
  if (restaurantId) headers.set('X-Restaurant-Id', restaurantId);
  if (outletId) headers.set('X-Outlet-Id', outletId);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
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
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`  ✅ ${msg}`);
}

async function runFullAudit() {
  console.log('================================================================');
  console.log('🚀 COMPREHENSIVE END-TO-END APPLICATION AUDIT & TEST SUITE');
  console.log('================================================================\n');

  // ─── 1. Health & Authentication ─────────────────────────────────────────────
  console.log('--- PHASE 1: Health & Authentication ---');
  const healthRes = await api('/health');
  assert(healthRes.status === 200 && healthRes.data.status === 'ok', 'API is healthy');

  const meRes = await api('/auth/me');
  assert(meRes.status === 200 && meRes.data.user && meRes.data.user.role === 'OWNER', 'Owner session verified');
  console.log(`  Logged in as: ${meRes.data.user.name} (${meRes.data.user.phoneNumber})`);

  // ─── 2. Multi-Tenancy & Outlets ─────────────────────────────────────────────
  console.log('\n--- PHASE 2: Multi-Tenancy & Outlets ---');
  const restRes = await api('/restaurants');
  assert(restRes.status === 200 && Array.isArray(restRes.data) && restRes.data.length > 0, 'Fetched user restaurants');
  restaurantId = restRes.data[0].id;
  console.log(`  Active Restaurant: ${restRes.data[0].name} (${restaurantId})`);

  const outletRes = await api('/outlets');
  const defaultOutlet = outletRes.data.find((o: any) => o.isDefault) || outletRes.data[0];
  outletId = defaultOutlet.id;
  console.log(`  Active Outlet: ${defaultOutlet.name} (${outletId})`);

  // ─── 3. Menu Management ─────────────────────────────────────────────────────
  console.log('\n--- PHASE 3: Menu Categories & Items ---');
  const catRes = await api(`/menu/categories?outletId=${outletId}`);
  assert(catRes.status === 200 && Array.isArray(catRes.data) && catRes.data.length > 0, 'Menu categories loaded');

  const itemsRes = await api(`/menu/items?outletId=${outletId}`);
  assert(itemsRes.status === 200 && Array.isArray(itemsRes.data) && itemsRes.data.length > 0, 'Menu items loaded');
  sampleItemId = itemsRes.data[0].id;
  console.log(`  Sample Item: ${itemsRes.data[0].name} (₹${itemsRes.data[0].pricePaise / 100})`);

  // Toggle item availability and verify
  const toggleRes = await api(`/menu/items/${sampleItemId}/toggle`, { method: 'PATCH' });
  assert(toggleRes.status === 200, 'Item availability toggle endpoint works');
  // Toggle back
  await api(`/menu/items/${sampleItemId}/toggle`, { method: 'PATCH' });

  // ─── 4. Tables Management ───────────────────────────────────────────────────
  console.log('\n--- PHASE 4: Dining Tables Management ---');
  // Create a temporary table
  const createTableRes = await api('/tables', {
    method: 'POST',
    body: JSON.stringify({
      outletId,
      name: testTableName,
      section: 'Audit Section',
      capacity: 4,
      sortOrder: 999,
    }),
  });
  assert(createTableRes.status === 201 && createTableRes.data.id, `Created test table ${testTableName}`);
  testTableId = createTableRes.data.id;

  // Verify table is listed
  const tablesRes = await api(`/tables?outletId=${outletId}`);
  assert(tablesRes.status === 200 && tablesRes.data.some((t: any) => t.id === testTableId), 'Test table is listed');

  // ─── 5. POS & Billing: Dine-In Multi-Round Order ────────────────────────────
  console.log('\n--- PHASE 5: POS Dine-In Order with Multi-Round & Settle ---');
  // Round 1
  const startOrderRes = await api('/billing/orders', {
    method: 'POST',
    body: JSON.stringify({
      outletId,
      tableNo: testTableName,
      orderType: 'DINE_IN',
      customerPhone: testCustomerPhone,
      items: [{ itemId: sampleItemId, qty: 2 }],
      note: 'Dine-In Audit Round 1',
    }),
  });
  assert(startOrderRes.status === 201 && startOrderRes.data.order, 'Dine-in Order Round 1 started');
  testDineInOrderId = startOrderRes.data.order.id;
  const tokenNo1 = startOrderRes.data.order.orderNo;
  console.log(`  Created Dine-In Order #${tokenNo1} (ID: ${testDineInOrderId})`);

  // Verify Table is Occupied
  const occupiedRes = await api(`/billing/orders?outletId=${outletId}&tableOccupied=true`);
  assert(
    occupiedRes.status === 200 && occupiedRes.data.some((o: any) => o.order.id === testDineInOrderId),
    'Table correctly detected as occupied'
  );

  // Round 2: Add additional round of items
  const round2Res = await api(`/billing/orders/${testDineInOrderId}/round`, {
    method: 'POST',
    body: JSON.stringify({
      items: [{ itemId: sampleItemId, qty: 1, note: 'Less spicy' }],
    }),
  });
  assert(round2Res.status === 200 && round2Res.data.round === 2, 'Added Round 2 to Dine-In Order');

  // Settle Order
  const settleDineRes = await api(`/billing/orders/${testDineInOrderId}/settle`, {
    method: 'POST',
    body: JSON.stringify({ method: 'UPI' }),
  });
  assert(settleDineRes.status === 200 && settleDineRes.data.order.status === 'PAID', 'Dine-in Order settled via UPI');

  // Free Table
  // First advance items to SERVED so table can be freed
  const orderDetails = await api(`/billing/orders/${testDineInOrderId}`);
  for (const it of orderDetails.data.items) {
    await api(`/billing/orders/${testDineInOrderId}/items/${it.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SERVED' }),
    });
  }
  const freeTableRes = await api(`/billing/orders/${testDineInOrderId}/free-table`, {
    method: 'POST',
    body: JSON.stringify({ method: 'UPI' }),
  });
  assert(freeTableRes.status === 200 && freeTableRes.data.order.tableFreedAt !== null, 'Table freed successfully');

  // Verify Table is NO LONGER Occupied
  const afterFreeRes = await api(`/billing/orders?outletId=${outletId}&tableOccupied=true`);
  assert(
    afterFreeRes.status === 200 && !afterFreeRes.data.some((o: any) => o.order.id === testDineInOrderId),
    'Table occupancy cleared'
  );

  // ─── 6. POS & Billing: Takeaway Order (Instant Settle & Send) ───────────────
  console.log('\n--- PHASE 6: POS Takeaway Order (Settle & Send) ---');
  const takeawayRes = await api('/billing/orders/create-settled', {
    method: 'POST',
    body: JSON.stringify({
      outletId,
      tableNo: 'Takeaway',
      orderType: 'TAKEAWAY',
      method: 'Cash',
      customerPhone: testCustomerPhone,
      items: [{ itemId: sampleItemId, qty: 1 }],
      packagingChargePaise: 2000,
      note: 'Takeaway parcel audit',
    }),
  });
  assert(takeawayRes.status === 201 && takeawayRes.data.order.status === 'PAID', 'Takeaway Order created settled (PAID)');
  testTakeawayOrderId = takeawayRes.data.order.id;
  assert(takeawayRes.data.order.packagingChargePaise === 2000, 'Packaging charge applied correctly');
  console.log(`  Created Takeaway Order #${takeawayRes.data.order.orderNo} (ID: ${testTakeawayOrderId})`);

  // ─── 7. Delivery Module & Rider Flow ────────────────────────────────────────
  console.log('\n--- PHASE 7: Delivery Orders & Rider Lifecycle ---');
  // Create or get a rider
  const ridersRes = await api(`/delivery/riders?outletId=${outletId}`);
  assert(ridersRes.status === 200, 'Fetched fleet riders');
  if (ridersRes.data.length > 0) {
    testRiderId = ridersRes.data[0].id;
  } else {
    const createRiderRes = await api('/delivery/riders', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        name: 'Ramesh Rider',
        phone: '+919876543210',
        vehicleType: 'BIKE',
        vehicleNumber: 'KA-05-AB-1234',
      }),
    });
    assert(createRiderRes.status === 200, 'Created new delivery rider');
    testRiderId = createRiderRes.data.id;
  }
  console.log(`  Rider ID: ${testRiderId}`);

  // Set Rider to AVAILABLE (On Duty)
  const riderDutyRes = await api(`/delivery/riders/${testRiderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'AVAILABLE' }),
  });
  assert(riderDutyRes.status === 200 && riderDutyRes.data.status === 'AVAILABLE', 'Rider marked On Duty (AVAILABLE)');

  // Save Customer Address
  const saveAddrRes = await api('/delivery/addresses', {
    method: 'POST',
    body: JSON.stringify({
      customerPhone: testCustomerPhone,
      label: 'Office',
      receiverName: 'Vishal Test',
      addressLine1: 'Prestige Tech Park, Outer Ring Road',
      landmark: 'Behind Building 2A',
      city: 'Bengaluru',
      pincode: '560103',
      isDefault: true,
    }),
  });
  assert(saveAddrRes.status === 200, 'Saved customer delivery address');

  // Fetch saved customer addresses
  const getAddrRes = await api(`/delivery/addresses/${encodeURIComponent(testCustomerPhone)}`);
  assert(getAddrRes.status === 200 && getAddrRes.data.length > 0, 'Fetched customer saved addresses');

  // Place Delivery Order from POS
  const delivOrderRes = await api('/billing/orders', {
    method: 'POST',
    body: JSON.stringify({
      outletId,
      tableNo: 'Delivery',
      orderType: 'DELIVERY',
      customerPhone: testCustomerPhone,
      packagingChargePaise: 2000,
      deliveryChargePaise: 4000,
      delivery: {
        customerName: 'Vishal Test',
        customerPhone: testCustomerPhone,
        addressLine1: 'Prestige Tech Park, Outer Ring Road',
        landmark: 'Behind Building 2A',
        pincode: '560103',
        riderId: testRiderId,
        deliveryNotes: 'Leave with security if unavailable',
      },
      items: [{ itemId: sampleItemId, qty: 1 }],
      note: 'Delivery Audit Order',
    }),
  });
  assert(delivOrderRes.status === 201 && delivOrderRes.data.order, 'Delivery Order created successfully');
  testDeliveryOrderId = delivOrderRes.data.order.id;
  const delivDetails = delivOrderRes.data.delivery;
  assert(delivDetails && delivDetails.deliveryOtp, 'Delivery OTP generated');
  const deliveryOtp = delivDetails.deliveryOtp;
  console.log(`  Created Delivery Order #${delivOrderRes.data.order.orderNo} with PIN: ${deliveryOtp}`);

  // Advance Delivery: OUT_FOR_DELIVERY
  const startDelRes = await api(`/delivery/orders/${testDeliveryOrderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'OUT_FOR_DELIVERY', riderId: testRiderId }),
  });
  assert(startDelRes.status === 200 && startDelRes.data.status === 'OUT_FOR_DELIVERY', 'Delivery marked OUT_FOR_DELIVERY');

  // Complete Delivery with OTP
  const completeDelRes = await api(`/delivery/orders/${testDeliveryOrderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'DELIVERED', deliveryOtp }),
  });
  assert(completeDelRes.status === 200 && completeDelRes.data.status === 'DELIVERED', 'Delivery completed with OTP');

  // Verify SaleOrder was automatically settled upon delivery
  const verifyOrderSettled = await api(`/billing/orders/${testDeliveryOrderId}`);
  assert(verifyOrderSettled.status === 200 && verifyOrderSettled.data.order.status === 'PAID', 'Delivery order auto-settled on delivery');

  // ─── 8. Kitchen Display System (KDS) ────────────────────────────────────────
  console.log('\n--- PHASE 8: Kitchen Display System (KDS) ---');
  const kitchenRes = await api(`/billing/orders/kitchen?outletId=${outletId}`);
  assert(kitchenRes.status === 200 && Array.isArray(kitchenRes.data), 'Kitchen orders query returned active tickets');

  // ─── 9. Waiter Assistance ───────────────────────────────────────────────────
  console.log('\n--- PHASE 9: Waiter Assistance & Floor Requests ---');
  const waiterReqRes = await api('/waiter/requests', {
    method: 'POST',
    body: JSON.stringify({
      outletId,
      tableNo: testTableName,
      serviceType: 'WATER',
      note: 'Please bring cold water',
      customerPhone: testCustomerPhone,
    }),
  });
  assert(waiterReqRes.status === 201 && waiterReqRes.data.id, 'Created Waiter Request');
  testWaiterRequestId = waiterReqRes.data.id;

  // Advance status: IN_PROGRESS
  const inProgRes = await api(`/waiter/requests/${testWaiterRequestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });
  assert(inProgRes.status === 200 && inProgRes.data.status === 'IN_PROGRESS', 'Waiter Request status updated to IN_PROGRESS');

  // Complete request: COMPLETED
  const compRes = await api(`/waiter/requests/${testWaiterRequestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  assert(compRes.status === 200 && compRes.data.status === 'COMPLETED', 'Waiter Request marked COMPLETED');

  // Waiter Stats
  const waiterStatsRes = await api(`/waiter/stats?outletId=${outletId}`);
  assert(waiterStatsRes.status === 200 && typeof waiterStatsRes.data.completedTodayCount === 'number', 'Waiter stats query works');

  // ─── 10. Customer Self-Service Portal ───────────────────────────────────────
  console.log('\n--- PHASE 10: Customer Self-Service Portal ---');
  const portalRes = await api('/customer/portal');
  assert(portalRes.status === 200 && portalRes.data.customer, 'Customer portal loaded successfully');
  assert(Array.isArray(portalRes.data.activeOrders), 'Portal activeOrders array present');
  assert(Array.isArray(portalRes.data.pastOrders), 'Portal pastOrders array present');
  console.log(`  Active Orders: ${portalRes.data.activeOrders.length} | Past Orders: ${portalRes.data.pastOrders.length}`);

  // ─── 11. Customer CRM ───────────────────────────────────────────────────────
  console.log('\n--- PHASE 11: Customer CRM & Profile Metrics ---');
  const custRes = await api(`/customers/${encodeURIComponent(testCustomerPhone)}?outletId=${outletId}`);
  assert(custRes.status === 200 && custRes.data.customer && custRes.data.metrics, 'Customer CRM profile loaded');
  console.log(`  Customer Visits: ${custRes.data.metrics.totalOrdersCount} | Lifetime Spend: ₹${(custRes.data.metrics.lifetimeSpendPaise / 100).toFixed(2)}`);

  // Update Customer Notes
  const updateNotesRes = await api(`/customers/${encodeURIComponent(testCustomerPhone)}/notes`, {
    method: 'PUT',
    body: JSON.stringify({
      notes: 'VIP guest from corporate office',
      tags: ['VIP', 'Regular'],
    }),
  });
  assert(updateNotesRes.status === 200 && updateNotesRes.data.success, 'Updated customer staff notes & tags');

  // ─── 12. Reports & Analytics ────────────────────────────────────────────────
  console.log('\n--- PHASE 12: Reports & Analytics ---');
  const todayStr = new Date().toISOString().split('T')[0];
  const summaryRes = await api(`/reports/summary?from=${todayStr}&to=${todayStr}&outletId=${outletId}`);
  assert(summaryRes.status === 200 && typeof summaryRes.data.data.paidCount === 'number', 'Summary report generated');
  console.log(`  Today's Paid Orders: ${summaryRes.data.data.paidCount} | Revenue: ₹${(summaryRes.data.data.revenuePaise / 100).toFixed(2)}`);

  const topItemsRes = await api(`/reports/top-items?from=${todayStr}&to=${todayStr}&outletId=${outletId}`);
  assert(topItemsRes.status === 200 && Array.isArray(topItemsRes.data.data), 'Top items report generated');

  const payMethodsRes = await api(`/reports/payment-methods?from=${todayStr}&to=${todayStr}&outletId=${outletId}`);
  assert(payMethodsRes.status === 200 && Array.isArray(payMethodsRes.data.data), 'Payment methods report generated');

  // ─── 13. WebSocket Ticket ───────────────────────────────────────────────────
  console.log('\n--- PHASE 13: WebSocket Ticket & Live Sync ---');
  const wsTicketRes = await api('/auth/ws-ticket');
  assert(wsTicketRes.status === 200 && wsTicketRes.data.ticket, 'Durable Object WebSocket upgrade ticket issued');

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  console.log('\n--- Cleanup: Soft-deleting test table ---');
  const delTableRes = await api(`/tables/${testTableId}`, { method: 'DELETE' });
  assert(delTableRes.status === 200 && delTableRes.data.success, 'Test table soft-deleted cleanly');

  console.log('\n================================================================');
  console.log('🎉 ALL 13 PHASES COMPLETED WITH 100% SUCCESS!');
  console.log('================================================================');
}

runFullAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err);
  process.exit(1);
});
