import * as fs from 'fs';

const API_BASE = 'https://dine-api.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';

async function getAuthHeaders() {
  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error('Session cache not found');
  }
  const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: `${cached.name}=${cached.value}`,
  };

  const restRes = await fetch(`${API_BASE}/restaurants`, { headers: baseHeaders });
  const rests = await restRes.json();
  const restaurantId = rests[0]?.id;

  const outletsRes = await fetch(`${API_BASE}/outlets`, {
    headers: { ...baseHeaders, 'X-Restaurant-Id': restaurantId },
  });
  const outlets = await outletsRes.json();
  const outletId = outlets[0]?.id;

  return {
    restaurantId,
    outletId,
    headers: {
      ...baseHeaders,
      'X-Restaurant-Id': restaurantId,
    },
  };
}

async function seed() {
  console.log('--- Starting Real Data Seeding for Vishal Diner ---');
  const { restaurantId, outletId, headers } = await getAuthHeaders();
  console.log(`Target: Restaurant ${restaurantId}, Outlet: ${outletId}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Categories
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n1. Seeding Categories...');
  const existingCatsRes = await fetch(`${API_BASE}/menu/categories?outletId=${outletId}`, { headers });
  const existingCats: any[] = await existingCatsRes.json();
  const catMap = new Map<string, any>();
  for (const c of existingCats) {
    catMap.set(c.name.toLowerCase().trim(), c);
  }

  const desiredCategories = [
    { name: 'Starters', description: 'Tandoori, kebabs and crispy appetizers', sortOrder: 1 },
    { name: 'Main Course', description: 'Rich curries and signature gravies', sortOrder: 2 },
    { name: 'Biryani & Rice', description: 'Aromatic dum biryanis and seasoned rice', sortOrder: 3 },
    { name: 'Breads', description: 'Fresh clay-oven naans, rotis & parathas', sortOrder: 4 },
    { name: 'Beverages', description: 'Refreshing lassis, sodas, and hot beverages', sortOrder: 5 },
    { name: 'Desserts', description: 'Traditional and fusion sweet delights', sortOrder: 6 },
  ];

  for (const dc of desiredCategories) {
    const key = dc.name.toLowerCase().trim();
    if (!catMap.has(key)) {
      console.log(`Creating category: ${dc.name}`);
      const res = await fetch(`${API_BASE}/menu/categories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...dc, outletId }),
      });
      if (res.ok) {
        const created = await res.json();
        catMap.set(key, created);
      } else {
        console.error(`Failed to create category ${dc.name}:`, await res.text());
      }
    } else {
      console.log(`Category exists: ${dc.name}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Menu Items
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Seeding Menu Items...');
  const existingItemsRes = await fetch(`${API_BASE}/menu/items?outletId=${outletId}`, { headers });
  const existingItems: any[] = await existingItemsRes.json();
  const itemMap = new Map<string, any>();
  for (const it of existingItems) {
    itemMap.set(it.name.toLowerCase().trim(), it);
  }

  const desiredItems = [
    // Starters
    { category: 'Starters', name: 'Paneer Tikka', description: 'Marinated cottage cheese cubes grilled in tandoor', pricePaise: 22000, sortOrder: 1 },
    { category: 'Starters', name: 'Crispy Corn', description: 'Fried sweet corn tossed with pepper and herbs', pricePaise: 18000, sortOrder: 2 },
    { category: 'Starters', name: 'Chicken Tikka', description: 'Boneless tender chicken marinated in spiced yogurt', pricePaise: 26000, sortOrder: 3 },
    { category: 'Starters', name: 'Tandoori Chicken (Half)', description: 'Classic bone-in chicken roasted to perfection', pricePaise: 28000, sortOrder: 4 },
    { category: 'Starters', name: 'Veg Spring Rolls', description: 'Crispy rolled pancakes stuffed with seasoned vegetables', pricePaise: 16000, sortOrder: 5 },
    { category: 'Starters', name: 'Chilli Chicken Dry', description: 'Indo-Chinese style crispy chicken with bell peppers', pricePaise: 25000, sortOrder: 6 },

    // Main Course
    { category: 'Main Course', name: 'Butter Chicken', description: 'Smoked chicken in a velvety tomato butter gravy', pricePaise: 32000, sortOrder: 1 },
    { category: 'Main Course', name: 'Dal Makhani', description: 'Slow-cooked black lentils simmered with cream and butter', pricePaise: 21000, sortOrder: 2 },
    { category: 'Main Course', name: 'Paneer Butter Masala', description: 'Soft paneer in rich mildly sweet cashew tomato gravy', pricePaise: 25000, sortOrder: 3 },
    { category: 'Main Course', name: 'Kadai Chicken', description: 'Spicy chicken cooked with crushed coriander and bell peppers', pricePaise: 31000, sortOrder: 4 },
    { category: 'Main Course', name: 'Dal Tadka', description: 'Yellow lentils tempered with cumin, garlic and dried red chillies', pricePaise: 17000, sortOrder: 5 },
    { category: 'Main Course', name: 'Kaju Masala', description: 'Roasted whole cashews in a thick spicy onion gravy', pricePaise: 27000, sortOrder: 6 },

    // Biryani & Rice
    { category: 'Biryani & Rice', name: 'Hyderabadi Chicken Biryani', description: 'Fragrant basmati rice layered with spiced chicken and saffron', pricePaise: 29900, sortOrder: 1 },
    { category: 'Biryani & Rice', name: 'Veg Dum Biryani', description: 'Garden vegetables and basmati rice slow cooked with aromatic spices', pricePaise: 22000, sortOrder: 2 },
    { category: 'Biryani & Rice', name: 'Mutton Dum Biryani', description: 'Tender mutton cuts infused with secret biryani spices', pricePaise: 38000, sortOrder: 3 },
    { category: 'Biryani & Rice', name: 'Jeera Rice', description: 'Basmati rice tempered with roasted cumin seeds and ghee', pricePaise: 14000, sortOrder: 4 },
    { category: 'Biryani & Rice', name: 'Steamed Basmati Rice', description: 'Fluffy long-grain steamed rice', pricePaise: 11000, sortOrder: 5 },

    // Breads
    { category: 'Breads', name: 'Butter Naan', description: 'Soft refined flour bread layered with fresh butter', pricePaise: 5000, sortOrder: 1 },
    { category: 'Breads', name: 'Garlic Naan', description: 'Naan topped with chopped garlic and coriander', pricePaise: 6500, sortOrder: 2 },
    { category: 'Breads', name: 'Tandoori Roti', description: 'Whole wheat bread baked in clay oven', pricePaise: 2500, sortOrder: 3 },
    { category: 'Breads', name: 'Butter Roti', description: 'Tandoori roti brushed with melted butter', pricePaise: 3000, sortOrder: 4 },
    { category: 'Breads', name: 'Laccha Paratha', description: 'Multi-layered crispy flaky whole wheat paratha', pricePaise: 6000, sortOrder: 5 },

    // Beverages
    { category: 'Beverages', name: 'Mango Lassi', description: 'Creamy thick yogurt shake with Alphonso mango pulp', pricePaise: 9000, sortOrder: 1 },
    { category: 'Beverages', name: 'Fresh Lime Soda', description: 'Sweet and salted refreshing sparkling limeade', pricePaise: 6000, sortOrder: 2 },
    { category: 'Beverages', name: 'Masala Chai', description: 'Traditional brewed tea with cardamom and ginger', pricePaise: 4000, sortOrder: 3 },
    { category: 'Beverages', name: 'Cold Coffee with Ice Cream', description: 'Chilled blended espresso topped with vanilla ice cream', pricePaise: 12000, sortOrder: 4 },

    // Desserts
    { category: 'Desserts', name: 'Gulab Jamun (2 Pcs)', description: 'Warm fried milk dumplings soaked in rose cardamom syrup', pricePaise: 8000, sortOrder: 1 },
    { category: 'Desserts', name: 'Rasmalai (2 Pcs)', description: 'Soft cottage cheese patties in saffron flavored milk', pricePaise: 11000, sortOrder: 2 },
    { category: 'Desserts', name: 'Sizzling Brownie', description: 'Warm chocolate walnut brownie with vanilla ice cream and hot fudge', pricePaise: 16000, sortOrder: 3 },
  ];

  for (const di of desiredItems) {
    const key = di.name.toLowerCase().trim();
    if (!itemMap.has(key)) {
      const cat = catMap.get(di.category.toLowerCase().trim());
      if (!cat) {
        console.warn(`Category ${di.category} not found for item ${di.name}`);
        continue;
      }
      console.log(`Creating item: ${di.name} (₹${di.pricePaise / 100})`);
      const res = await fetch(`${API_BASE}/menu/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          categoryId: cat.id,
          outletId,
          name: di.name,
          description: di.description,
          pricePaise: di.pricePaise,
          sortOrder: di.sortOrder,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        itemMap.set(key, created);
      } else {
        console.error(`Failed to create item ${di.name}:`, await res.text());
      }
    } else {
      console.log(`Item exists: ${di.name}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Tables by Section
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n3. Seeding Tables across Sections...');
  const existingTablesRes = await fetch(`${API_BASE}/tables?outletId=${outletId}`, { headers });
  const existingTables: any[] = await existingTablesRes.json();
  const tableMap = new Map<string, any>();
  for (const t of existingTables) {
    tableMap.set(t.name.toUpperCase().trim(), t);
  }

  const desiredTables = [
    // Ground Floor (AC)
    { name: 'T1', section: 'Ground Floor (AC)', capacity: 4, sortOrder: 1 },
    { name: 'T2', section: 'Ground Floor (AC)', capacity: 4, sortOrder: 2 },
    { name: 'T3', section: 'Ground Floor (AC)', capacity: 2, sortOrder: 3 },
    { name: 'T4', section: 'Ground Floor (AC)', capacity: 2, sortOrder: 4 },
    { name: 'T5', section: 'Ground Floor (AC)', capacity: 6, sortOrder: 5 },
    { name: 'T6', section: 'Ground Floor (AC)', capacity: 6, sortOrder: 6 },

    // First Floor / Balcony
    { name: 'F1', section: 'First Floor', capacity: 4, sortOrder: 11 },
    { name: 'F2', section: 'First Floor', capacity: 4, sortOrder: 12 },
    { name: 'F3', section: 'First Floor', capacity: 4, sortOrder: 13 },
    { name: 'F4', section: 'First Floor', capacity: 8, sortOrder: 14 },

    // Outdoor Garden
    { name: 'G1', section: 'Outdoor Garden', capacity: 4, sortOrder: 21 },
    { name: 'G2', section: 'Outdoor Garden', capacity: 4, sortOrder: 22 },
    { name: 'G3', section: 'Outdoor Garden', capacity: 2, sortOrder: 23 },
    { name: 'G4', section: 'Outdoor Garden', capacity: 4, sortOrder: 24 },
  ];

  for (const dt of desiredTables) {
    const key = dt.name.toUpperCase().trim();
    if (!tableMap.has(key)) {
      console.log(`Creating table: ${dt.name} [${dt.section}]`);
      const res = await fetch(`${API_BASE}/tables`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          outletId,
          name: dt.name,
          section: dt.section,
          capacity: dt.capacity,
          sortOrder: dt.sortOrder,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        tableMap.set(key, created);
      } else {
        console.error(`Failed to create table ${dt.name}:`, await res.text());
      }
    } else {
      console.log(`Table exists: ${dt.name}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Realistic Active & Historical Orders
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n4. Seeding Realistic Orders...');

  // Helper to lookup item by name
  const getItem = (name: string) => {
    const it = itemMap.get(name.toLowerCase().trim());
    if (!it) throw new Error(`Item not found: ${name}`);
    return it;
  };

  // Scenario A: Table T3 - Starters Round (OPEN / Unpaid, ORDERED)
  console.log('Creating Order for Table T3 (Ground Floor)...');
  const t3OrderRes = await fetch(`${API_BASE}/orders/send-to-kitchen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      outletId,
      tableNo: 'T3',
      customerPhone: '9822334455',
      note: 'Medium spice',
      items: [
        { itemId: getItem('Crispy Corn').id, qty: 1, note: 'Extra crispy' },
        { itemId: getItem('Veg Dum Biryani').id, qty: 1 },
        { itemId: getItem('Fresh Lime Soda').id, qty: 2, note: 'Sweet & salt' },
      ],
    }),
  });
  if (t3OrderRes.ok) {
    const t3 = await t3OrderRes.json();
    console.log(`T3 Order created: #${t3.order.orderNo} (${t3.order.id})`);
  }

  // Scenario B: Table F1 - Family Dining (First Floor, Multi-Round: R1 Paid, R2 Unpaid)
  console.log('Creating Multi-Round Order for Table F1 (First Floor)...');
  const f1R1Res = await fetch(`${API_BASE}/orders/create-settled`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      outletId,
      tableNo: 'F1',
      customerPhone: '9890112233',
      method: 'UPI',
      note: 'Family table round 1',
      items: [
        { itemId: getItem('Tandoori Chicken (Half)').id, qty: 1 },
        { itemId: getItem('Paneer Tikka').id, qty: 1 },
        { itemId: getItem('Mango Lassi').id, qty: 2 },
      ],
    }),
  });
  if (f1R1Res.ok) {
    const f1R1 = await f1R1Res.json();
    console.log(`F1 Round 1 settled: #${f1R1.order.orderNo}`);

    // Add Round 2 (Mains & Breads)
    const f1R2Res = await fetch(`${API_BASE}/orders/add-round`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: f1R1.order.id,
        items: [
          { itemId: getItem('Butter Chicken').id, qty: 1 },
          { itemId: getItem('Dal Makhani').id, qty: 1 },
          { itemId: getItem('Butter Naan').id, qty: 4 },
          { itemId: getItem('Jeera Rice').id, qty: 1 },
        ],
      }),
    });
    if (f1R2Res.ok) {
      console.log(`F1 Round 2 added successfully!`);
    }
  }

  // Scenario C: Table G2 - Outdoor Garden Dining (Round 1 in PREPARING)
  console.log('Creating Order for Table G2 (Garden)...');
  const g2OrderRes = await fetch(`${API_BASE}/orders/send-to-kitchen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      outletId,
      tableNo: 'G2',
      customerPhone: '9765432100',
      items: [
        { itemId: getItem('Chilli Chicken Dry').id, qty: 1 },
        { itemId: getItem('Hyderabadi Chicken Biryani').id, qty: 2 },
        { itemId: getItem('Cold Coffee with Ice Cream').id, qty: 2 },
      ],
    }),
  });
  if (g2OrderRes.ok) {
    const g2 = await g2OrderRes.json();
    console.log(`G2 Order created: #${g2.order.orderNo}`);
    // Advance first item to PREPARING
    if (g2.items?.[0]?.id) {
      await fetch(`${API_BASE}/kitchen/advance-item-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: g2.order.id, orderItemId: g2.items[0].id, action: 'next' }),
      });
    }
  }

  // Scenario D: Takeaway Order
  console.log('Creating Takeaway Order...');
  const takeawayRes = await fetch(`${API_BASE}/orders/create-settled`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      outletId,
      tableNo: 'Takeaway',
      customerPhone: '917276718848',
      method: 'Cash',
      note: 'Pack separately with extra onions',
      items: [
        { itemId: getItem('Mutton Dum Biryani').id, qty: 1, note: 'Raita on side' },
        { itemId: getItem('Gulab Jamun (2 Pcs)').id, qty: 2 },
      ],
    }),
  });
  if (takeawayRes.ok) {
    const tw = await takeawayRes.json();
    console.log(`Takeaway Order created: #${tw.order.orderNo}`);
  }

  // Scenario E: Table T5 - Finished, Paid & Freed Table (demonstrates Table Freed status)
  console.log('Creating and Freeing Table T5 (Finished Dining)...');
  const t5OrderRes = await fetch(`${API_BASE}/orders/send-to-kitchen`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      outletId,
      tableNo: 'T5',
      customerPhone: '9422001122',
      items: [
        { itemId: getItem('Paneer Butter Masala').id, qty: 1 },
        { itemId: getItem('Garlic Naan').id, qty: 2 },
        { itemId: getItem('Rasmalai (2 Pcs)').id, qty: 1 },
      ],
    }),
  });
  if (t5OrderRes.ok) {
    const t5 = await t5OrderRes.json();
    // Free the table
    await fetch(`${API_BASE}/orders/free-table`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId: t5.order.id, method: 'Card' }),
    });
    console.log(`T5 Order #${t5.order.orderNo} settled and Table T5 freed.`);
  }

  console.log('\n--- Real Data Seeding Completed Successfully! ---');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
