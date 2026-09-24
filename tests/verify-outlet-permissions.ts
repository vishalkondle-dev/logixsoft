import * as fs from 'fs';

const API_BASE = 'https://dine-api.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';

async function main() {
  console.log('🔒 VERIFYING OUTLET-LEVEL PERMISSIONS & SCOPING...');

  if (!fs.existsSync(CACHE_FILE)) {
    console.error('No session cache found');
    process.exit(1);
  }

  const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const sessionCookie = `${cached.name}=${cached.value}`;

  // 1. Get my restaurants and outlets
  const restRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { Cookie: sessionCookie },
  });
  const restaurants = await restRes.json();
  const restaurantId = restaurants[0]?.id;

  const outletsRes = await fetch(`${API_BASE}/outlets`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId },
  });
  const outlets = await outletsRes.json();
  console.log(`Found ${outlets.length} outlet(s) in restaurant ${restaurantId}`);

  const primaryOutlet = outlets[0]?.id;
  const fakeUnauthorizedOutlet = 'outlet_unauthorized_999999';

  // 2. Test assertOutletAccess on fake / unassigned outlet
  console.log('\n--- 1. Testing Tables Scoping ---');
  const tableCheck = await fetch(`${API_BASE}/tables/list?outletId=${fakeUnauthorizedOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': fakeUnauthorizedOutlet },
  });
  console.log(`Tables GET with unassigned outlet: status = ${tableCheck.status} (Expected 403)`);
  if (tableCheck.status !== 403) throw new Error('Expected 403 for unauthorized outlet on tables');

  console.log('\n--- 2. Testing Kitchen Tickets Scoping ---');
  const kitchenCheck = await fetch(`${API_BASE}/kitchen/active-tickets?outletId=${fakeUnauthorizedOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': fakeUnauthorizedOutlet },
  });
  console.log(`Kitchen GET with unassigned outlet: status = ${kitchenCheck.status} (Expected 403)`);
  if (kitchenCheck.status !== 403) throw new Error('Expected 403 for unauthorized outlet on kitchen');

  console.log('\n--- 3. Testing Waiter Requests Scoping ---');
  const waiterCheck = await fetch(`${API_BASE}/waiter/active-requests?outletId=${fakeUnauthorizedOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': fakeUnauthorizedOutlet },
  });
  console.log(`Waiter GET with unassigned outlet: status = ${waiterCheck.status} (Expected 403)`);
  if (waiterCheck.status !== 403) throw new Error('Expected 403 for unauthorized outlet on waiter');

  console.log('\n--- 4. Testing Orders Scoping ---');
  const orderCheck = await fetch(`${API_BASE}/orders/list?outletId=${fakeUnauthorizedOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': fakeUnauthorizedOutlet },
  });
  console.log(`Orders GET with unassigned outlet: status = ${orderCheck.status} (Expected 403)`);
  if (orderCheck.status !== 403) throw new Error('Expected 403 for unauthorized outlet on orders');

  const orderActiveCheck = await fetch(`${API_BASE}/orders/active?outletId=${fakeUnauthorizedOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': fakeUnauthorizedOutlet },
  });
  console.log(`Active Orders GET with unassigned outlet: status = ${orderActiveCheck.status} (Expected 403)`);
  if (orderActiveCheck.status !== 403) throw new Error('Expected 403 for unauthorized outlet on active orders');

  console.log('\n--- 5. Testing Delivery Riders Scoping ---');
  const riderCheck = await fetch(`${API_BASE}/delivery/riders?outletId=${fakeUnauthorizedOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': fakeUnauthorizedOutlet },
  });
  console.log(`Delivery Riders GET with unassigned outlet: status = ${riderCheck.status} (Expected 403)`);
  if (riderCheck.status !== 403) throw new Error('Expected 403 for unauthorized outlet on riders');

  console.log('\n--- 6. Testing Reports Scoping ---');
  const reportCheck = await fetch(`${API_BASE}/reports/summary?from=2026-09-01&to=2026-09-24&outletId=${fakeUnauthorizedOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': fakeUnauthorizedOutlet },
  });
  console.log(`Reports GET with unassigned outlet: status = ${reportCheck.status} (Expected 403)`);
  if (reportCheck.status !== 403) throw new Error('Expected 403 for unauthorized outlet on reports');

  console.log('\n--- 7. Testing Authorized Outlet Allowed ---');
  const validCheck = await fetch(`${API_BASE}/tables/list?outletId=${primaryOutlet}`, {
    headers: { Cookie: sessionCookie, 'X-Restaurant-Id': restaurantId, 'X-Outlet-Id': primaryOutlet },
  });
  console.log(`Tables GET with assigned outlet: status = ${validCheck.status} (Expected 200)`);
  if (validCheck.status !== 200) throw new Error('Expected 200 for authorized outlet on tables');

  console.log('\n🎉 ALL OUTLET-LEVEL SECURITY BOUNDARY CHECKS PASSED!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
