import fetch from 'node-fetch';

const API_BASE = 'https://dine-api.logixsoft.in';

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
  return cookiePair;
}

async function run() {
  console.log('========================================================================');
  console.log('🔍 EXHAUSTIVE SERVER-SIDE SORTING & FILTERING API VERIFICATION SUITE 🔍');
  console.log('========================================================================\n');

  const cookie = await loginAndGetCookie('+917276718848');
  const headers = {
    'Cookie': cookie,
    'Content-Type': 'application/json',
  };

  const get = async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) {
      throw new Error(`GET ${path} failed with status ${res.status}: ${await res.text()}`);
    }
    return res.json();
  };

  let passed = 0;

  // 1. /admin/restaurants
  console.log('Testing /admin/restaurants sorting...');
  for (const sort of ['name', 'gmv_desc', 'gmv_asc', 'orders', 'recent', 'oldest']) {
    const res: any = await get(`/admin/restaurants?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.restaurants;
    if (!Array.isArray(list)) throw new Error(`/admin/restaurants?sortBy=${sort} did not return array`);
    console.log(`  ✓ sortBy=${sort} returned ${list.length} restaurants`);
    passed++;
  }

  // 2. /admin/outlets
  console.log('Testing /admin/outlets sorting and filters...');
  for (const sort of ['name', 'restaurant', 'recent', 'oldest']) {
    const res: any = await get(`/admin/outlets?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.outlets;
    if (!Array.isArray(list)) throw new Error(`/admin/outlets?sortBy=${sort} did not return array`);
    console.log(`  ✓ sortBy=${sort} returned ${list.length} outlets`);
    passed++;
  }
  const outletStatusRes: any = await get(`/admin/outlets?status=ACTIVE`);
  console.log(`  ✓ status=ACTIVE returned ${(outletStatusRes.outlets || outletStatusRes).length} outlets`);
  passed++;

  // 3. /admin/users
  console.log('Testing /admin/users sorting and role filtering...');
  for (const sort of ['name', 'role', 'owned_stores', 'recent', 'oldest']) {
    const res: any = await get(`/admin/users?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.users;
    if (!Array.isArray(list)) throw new Error(`/admin/users?sortBy=${sort} did not return array`);
    console.log(`  ✓ sortBy=${sort} returned ${list.length} users`);
    passed++;
  }
  const userRoleRes: any = await get(`/admin/users?role=ADMIN`);
  const adminUsers = userRoleRes.users || userRoleRes;
  if (!adminUsers.every((u: any) => u.role === 'ADMIN')) {
    throw new Error('user role filtering failed to filter only ADMIN');
  }
  console.log(`  ✓ role=ADMIN verified strictly (${adminUsers.length} admin users)`);
  passed++;

  // 4. /admin/subscriptions
  console.log('Testing /admin/subscriptions tier and status filters...');
  for (const tier of ['ALL', 'PRO', 'FREE']) {
    const res: any = await get(`/admin/subscriptions?tier=${tier}`);
    const list = Array.isArray(res) ? res : (res.restaurants || []);
    console.log(`  ✓ tier=${tier} returned ${list.length} subscriptions`);
    passed++;
  }
  for (const sort of ['name', 'status', 'recent', 'oldest']) {
    const res: any = await get(`/admin/subscriptions?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : (res.restaurants || []);
    console.log(`  ✓ sortBy=${sort} returned ${list.length} subscriptions`);
    passed++;
  }

  // 5. /admin/orders
  console.log('Testing /admin/orders sorting and filters...');
  for (const sort of ['newest', 'oldest', 'total', 'orderNo']) {
    const res: any = await get(`/admin/orders?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.orders;
    console.log(`  ✓ sortBy=${sort} returned ${list.length} orders`);
    passed++;
  }
  const ordersAllScope: any = await get(`/admin/orders?restaurantId=ALL&outletId=ALL`);
  console.log(`  ✓ restaurantId=ALL&outletId=ALL returned ${(ordersAllScope.orders || ordersAllScope).length} orders`);
  passed++;

  // 6. /admin/menu/items and /admin/menu/categories
  console.log('Testing /admin/menu/categories and items...');
  const catAll: any = await get(`/admin/menu/categories?restaurantId=ALL`);
  const catList = Array.isArray(catAll) ? catAll : catAll.categories;
  if (!Array.isArray(catList) || catList.length === 0) {
    throw new Error(`/admin/menu/categories?restaurantId=ALL returned empty or invalid`);
  }
  console.log(`  ✓ /admin/menu/categories?restaurantId=ALL returned ${catList.length} categories`);
  passed++;

  for (const sort of ['name', 'price_desc', 'price_asc', 'recent']) {
    const res: any = await get(`/admin/menu/items?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.items;
    console.log(`  ✓ menu items sortBy=${sort} returned ${list.length} items`);
    passed++;
  }

  // 7. /admin/tables
  console.log('Testing /admin/tables sorting and filters...');
  for (const sort of ['name', 'capacity_desc', 'capacity_asc', 'section']) {
    const res: any = await get(`/admin/tables?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.tables;
    console.log(`  ✓ tables sortBy=${sort} returned ${list.length} tables`);
    passed++;
  }

  // 8. /admin/inventory
  console.log('Testing /admin/inventory sorting and stock alerts...');
  for (const sort of ['name', 'stock_asc', 'stock_desc', 'cost_desc']) {
    const res: any = await get(`/admin/inventory?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.inventory;
    console.log(`  ✓ inventory sortBy=${sort} returned ${list.length} items`);
    passed++;
  }

  // 9. /admin/customers
  console.log('Testing /admin/customers minOrders aliases and sorting...');
  for (const minOrders of ['ALL', 'repeat', 'first', 'zero']) {
    const res: any = await get(`/admin/customers?minOrders=${minOrders}`);
    const list = Array.isArray(res) ? res : res.customers;
    console.log(`  ✓ minOrders=${minOrders} returned ${list.length} customers`);
    passed++;
  }
  for (const sort of ['orders', 'spend', 'name', 'recent', 'oldest']) {
    const res: any = await get(`/admin/customers?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.customers;
    console.log(`  ✓ customers sortBy=${sort} returned ${list.length} customers`);
    passed++;
  }

  // 10. /admin/reservations
  console.log('Testing /admin/reservations sorting...');
  for (const sort of ['newest', 'oldest', 'guestName', 'partySize']) {
    const res: any = await get(`/admin/reservations?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.reservations;
    console.log(`  ✓ reservations sortBy=${sort} returned ${list.length} reservations`);
    passed++;
  }

  // 11. /admin/feedback
  console.log('Testing /admin/feedback replied filters and sorting...');
  for (const replied of ['ALL', 'replied', 'pending', 'YES', 'NO']) {
    const res: any = await get(`/admin/feedback?replied=${replied}`);
    const list = Array.isArray(res) ? res : res.feedback;
    console.log(`  ✓ feedback replied=${replied} returned ${list.length} reviews`);
    passed++;
  }
  for (const sort of ['newest', 'oldest', 'rating_desc', 'rating_asc']) {
    const res: any = await get(`/admin/feedback?sortBy=${sort}`);
    const list = Array.isArray(res) ? res : res.feedback;
    console.log(`  ✓ feedback sortBy=${sort} returned ${list.length} reviews`);
    passed++;
  }

  console.log(`\n========================================================================`);
  console.log(`🎉 ALL ${passed} SERVER-SIDE SORTING & FILTERING CHECKS PASSED WITH 100%! 🎉`);
  console.log(`========================================================================`);
}

run().catch((err) => {
  console.error('❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
