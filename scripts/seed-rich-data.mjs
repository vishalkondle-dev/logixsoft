import postgres from "../apps/logix-dine/api/node_modules/postgres/src/index.js";

const DATABASE_URL = "postgresql://payment_user:payment_pass_logixsoft_2026@127.0.0.1:5432/payment";
const sql = postgres(DATABASE_URL);

function generateId(prefix = "id") {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let str = "";
  for (let i = 0; i < 24; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${str}`;
}

const CUSTOMERS = [
  { name: "Vishal Kondle", phone: "+917276718848" },
  { name: "Priya Sharma", phone: "+919845012345" },
  { name: "Rahul Deshmukh", phone: "+919820112233" },
  { name: "Ananya Iyer", phone: "+919886098765" },
  { name: "Rajesh Varma", phone: "+919741234567" },
  { name: "Sneha Patil", phone: "+919900112233" },
  { name: "Vikram Malhotra", phone: "+919811223344" },
  { name: "Pooja Hegde", phone: "+919945678901" },
  { name: "Amitabh Sen", phone: "+919830012345" },
  { name: "Neha Kulkarni", phone: "+919422001122" },
  { name: "Arjun Reddy", phone: "+919989012345" },
  { name: "Kavita Nair", phone: "+919447012345" },
  { name: "Suresh Pillai", phone: "+919448012345" },
  { name: "Divya Agarwal", phone: "+919829012345" },
  { name: "Rohan Kapoor", phone: "+919810012345" },
  { name: "Meera Joshi", phone: "+919822334455" },
  { name: "Karthik Subramanian", phone: "+919841012345" },
  { name: "Sunita Rao", phone: "+919880012345" },
  { name: "Deepak Choudhary", phone: "+919828012345" },
  { name: "Swati Menon", phone: "+919446012345" },
  { name: "Gaurav Mehta", phone: "+919821012345" },
  { name: "Aditi Bhat", phone: "+919886712345" },
];

async function seed() {
  console.log("=== STARTING REAL DATA PURGE & RE-SEEDING ===");

  // 1. Fetch restaurant and outlets
  const restaurants = await sql`SELECT id, name FROM "restaurant" LIMIT 1;`;
  if (!restaurants.length) {
    throw new Error("No restaurant found in DB!");
  }
  const restaurant = restaurants[0];
  const restaurantId = restaurant.id;
  console.log(`Found Restaurant: ${restaurant.name} (${restaurantId})`);

  const outlets = await sql`SELECT id, name, "isDefault" FROM "restaurantOutlet" WHERE "restaurantId" = ${restaurantId};`;
  if (!outlets.length) {
    throw new Error("No outlets found in DB!");
  }
  const defaultOutlet = outlets.find((o) => o.isDefault) || outlets[0];
  const secondaryOutlet = outlets.find((o) => !o.isDefault) || outlets[0];
  console.log(`Primary Outlet: ${defaultOutlet.name} (${defaultOutlet.id})`);
  console.log(`Secondary Outlet: ${secondaryOutlet.name} (${secondaryOutlet.id})`);

  // 2. Wipe old transactional, catalog and table data
  console.log("\nPurging old data...");
  await sql`DELETE FROM "tableReservation" WHERE "restaurantId" = ${restaurantId};`;
  await sql`DELETE FROM "waiterRequest" WHERE "restaurantId" = ${restaurantId};`;
  await sql`DELETE FROM "orderItemAudit";`;
  await sql`DELETE FROM "deliveryOrder";`;
  await sql`DELETE FROM "saleOrderItem";`;
  await sql`DELETE FROM "saleOrder" WHERE "restaurantId" = ${restaurantId};`;
  await sql`DELETE FROM "posTable" WHERE "restaurantId" = ${restaurantId};`;
  await sql`DELETE FROM "menuItem" WHERE "restaurantId" = ${restaurantId};`;
  await sql`DELETE FROM "menuCategory" WHERE "restaurantId" = ${restaurantId};`;
  await sql`DELETE FROM "customerAddress";`;
  console.log("Purge complete: 0 old records remaining in tables/orders/menu.");

  // 3. Update outlet taxSettings to standard 5% GST
  const standardTaxSettings = {
    enableGst: true,
    gstEnabled: true,
    cgstPercent: 2.5,
    sgstPercent: 2.5,
    serviceChargeEnabled: false,
    serviceChargePercent: 5,
    taxInclusive: false,
    packagingChargePaise: 2500,
    deliveryChargePaise: 4000,
  };
  await sql`
    UPDATE "restaurantOutlet"
    SET "taxSettings" = ${sql.json(standardTaxSettings)}
    WHERE "restaurantId" = ${restaurantId};
  `;
  console.log("Outlet tax settings updated: GST 5% (2.5% CGST + 2.5% SGST), exclusive.");

  // 4. Create POS Tables across 4 distinct sections for Indiranagar Flagship
  console.log("\nCreating Tables for Indiranagar Flagship...");
  const tableDefs = [
    // Ground Floor AC
    { name: "T1", section: "Ground Floor (AC)", capacity: 4, sortOrder: 1 },
    { name: "T2", section: "Ground Floor (AC)", capacity: 4, sortOrder: 2 },
    { name: "T3", section: "Ground Floor (AC)", capacity: 2, sortOrder: 3 },
    { name: "T4", section: "Ground Floor (AC)", capacity: 2, sortOrder: 4 },
    { name: "T5", section: "Ground Floor (AC)", capacity: 6, sortOrder: 5 },
    { name: "T6", section: "Ground Floor (AC)", capacity: 6, sortOrder: 6 },
    { name: "T7", section: "Ground Floor (AC)", capacity: 8, sortOrder: 7 },
    // First Floor Lounge
    { name: "L1", section: "First Floor Lounge", capacity: 4, sortOrder: 11 },
    { name: "L2", section: "First Floor Lounge", capacity: 4, sortOrder: 12 },
    { name: "L3", section: "First Floor Lounge", capacity: 6, sortOrder: 13 },
    { name: "L4", section: "First Floor Lounge", capacity: 2, sortOrder: 14 },
    // Terrace Garden
    { name: "TG1", section: "Terrace Garden", capacity: 4, sortOrder: 21 },
    { name: "TG2", section: "Terrace Garden", capacity: 4, sortOrder: 22 },
    { name: "TG3", section: "Terrace Garden", capacity: 6, sortOrder: 23 },
    { name: "TG4", section: "Terrace Garden", capacity: 2, sortOrder: 24 },
    // Private Dining
    { name: "PDR1", section: "Private Dining (PDR)", capacity: 10, sortOrder: 31 },
    { name: "PDR2", section: "Private Dining (PDR)", capacity: 12, sortOrder: 32 },
  ];

  for (const t of tableDefs) {
    await sql`
      INSERT INTO "posTable" ("id", "restaurantId", "outletId", "name", "section", "capacity", "active", "sortOrder", "createdAt", "updatedAt")
      VALUES (${generateId("tbl")}, ${restaurantId}, ${defaultOutlet.id}, ${t.name}, ${t.section}, ${t.capacity}, true, ${t.sortOrder}, NOW(), NOW());
    `;
  }
  console.log(`Created ${tableDefs.length} tables across 4 sections.`);

  // 5. Create Menu Categories & Real Menu Items
  console.log("\nCreating Menu Categories and Items...");
  const categoriesData = [
    { name: "Soups & Starters (Veg)", sortOrder: 1 },
    { name: "Tandoori & Starters (Non-Veg)", sortOrder: 2 },
    { name: "Main Course - Veg", sortOrder: 3 },
    { name: "Main Course - Non-Veg", sortOrder: 4 },
    { name: "Biryani & Rice Specialties", sortOrder: 5 },
    { name: "Tandoori Breads", sortOrder: 6 },
    { name: "Beverages & Mocktails", sortOrder: 7 },
    { name: "Desserts", sortOrder: 8 },
  ];

  const catMap = new Map();
  for (const c of categoriesData) {
    const id = generateId("cat");
    await sql`
      INSERT INTO "menuCategory" ("id", "restaurantId", "outletId", "name", "sortOrder", "active", "createdAt", "updatedAt")
      VALUES (${id}, ${restaurantId}, ${defaultOutlet.id}, ${c.name}, ${c.sortOrder}, true, NOW(), NOW());
    `;
    catMap.set(c.name, id);
  }

  const itemsData = [
    // Soups & Starters (Veg)
    {
      category: "Soups & Starters (Veg)",
      name: "Paneer Tikka Angaare",
      description: "Charcoal grilled cottage cheese chunks with roasted spices and capsicum",
      pricePaise: 28000,
      variants: [{ id: "v1", name: "Classic Spiced", pricePaise: 28000 }, { id: "v2", name: "Achari Flavour", pricePaise: 30000 }],
      addons: [{ id: "a1", name: "Extra Mint Dip", pricePaise: 3000 }],
    },
    {
      category: "Soups & Starters (Veg)",
      name: "Crispy Corn Salt & Pepper",
      description: "Crunchy sweet corn kernels tossed with crushed black pepper, herbs and lime",
      pricePaise: 21000,
      variants: [],
      addons: [],
    },
    {
      category: "Soups & Starters (Veg)",
      name: "Dahi Ke Kebab",
      description: "Melt-in-mouth spiced hung curd patties with a golden crispy exterior",
      pricePaise: 24000,
      variants: [],
      addons: [],
    },
    {
      category: "Soups & Starters (Veg)",
      name: "Malai Broccoli",
      description: "Broccoli florets marinated in cardamom cream, cheese and royal saffron",
      pricePaise: 29000,
      variants: [],
      addons: [],
    },
    {
      category: "Soups & Starters (Veg)",
      name: "Veg Spring Rolls",
      description: "Golden rolls stuffed with shredded wok vegetables and spicy dip",
      pricePaise: 19000,
      variants: [],
      addons: [],
    },

    // Tandoori & Starters (Non-Veg)
    {
      category: "Tandoori & Starters (Non-Veg)",
      name: "Murgh Malai Tikka",
      description: "Succulent chicken tenders steeped in cashew cream, green cardamom and mild spices",
      pricePaise: 36000,
      variants: [],
      addons: [{ id: "a2", name: "Extra Garlic Mayo Dip", pricePaise: 3500 }],
    },
    {
      category: "Tandoori & Starters (Non-Veg)",
      name: "Tandoori Chicken",
      description: "Traditional spring chicken marinated overnight in spiced curd and degi mirch",
      pricePaise: 32000,
      variants: [{ id: "tc_half", name: "Half Portion (4 pcs)", pricePaise: 32000 }, { id: "tc_full", name: "Full Portion (8 pcs)", pricePaise: 58000 }],
      addons: [],
    },
    {
      category: "Tandoori & Starters (Non-Veg)",
      name: "Amritsari Fish Fry",
      description: "Crispy carom-infused fresh river sole fish fillets with mint chutney",
      pricePaise: 42000,
      variants: [],
      addons: [],
    },
    {
      category: "Tandoori & Starters (Non-Veg)",
      name: "Mutton Seekh Kebab",
      description: "Minced lamb skewer kebabs aromatic with mint, ginger and roasted garam masala",
      pricePaise: 45000,
      variants: [],
      addons: [],
    },
    {
      category: "Tandoori & Starters (Non-Veg)",
      name: "Chilli Chicken Dry",
      description: "Wok tossed crispy chicken cubes with scallions, green chillies and soy glaze",
      pricePaise: 31000,
      variants: [],
      addons: [],
    },

    // Main Course - Veg
    {
      category: "Main Course - Veg",
      name: "Paneer Butter Masala",
      description: "Fresh cottage cheese bathed in a rich, buttery satin tomato-cashew gravy",
      pricePaise: 31000,
      variants: [],
      addons: [{ id: "a3", name: "Extra Amul Butter Cube", pricePaise: 2500 }],
    },
    {
      category: "Main Course - Veg",
      name: "Dal Makhani (24-hr Slow Simmered)",
      description: "Our signature black urad lentils slow-cooked overnight with white butter & cream",
      pricePaise: 26000,
      variants: [],
      addons: [],
    },
    {
      category: "Main Course - Veg",
      name: "Kadhai Paneer",
      description: "Paneer cubes tossed with fresh bell peppers, whole coriander seeds and spicy onion gravy",
      pricePaise: 32000,
      variants: [],
      addons: [],
    },
    {
      category: "Main Course - Veg",
      name: "Subz Handi Diwani",
      description: "Assorted seasonal garden greens and baby corn in aromatic brown gravy",
      pricePaise: 27000,
      variants: [],
      addons: [],
    },
    {
      category: "Main Course - Veg",
      name: "Dal Tadka Double Rassa",
      description: "Yellow lentils tempered with ghee, cumin seeds, garlic slivers and red chillies",
      pricePaise: 21000,
      variants: [],
      addons: [],
    },

    // Main Course - Non-Veg
    {
      category: "Main Course - Non-Veg",
      name: "Delhi Style Butter Chicken",
      description: "Tandoor roasted boneless chicken simmered in rich creamy tomato silk sauce",
      pricePaise: 39000,
      variants: [],
      addons: [{ id: "a4", name: "Extra Gravy Bowl", pricePaise: 6000 }],
    },
    {
      category: "Main Course - Non-Veg",
      name: "Rogan Josh Kashmiri Mutton",
      description: "Tender mountain goat pieces slow cooked with Kashmiri dried chillies and ratan jot",
      pricePaise: 49000,
      variants: [],
      addons: [],
    },
    {
      category: "Main Course - Non-Veg",
      name: "Murgh Rara Masala",
      description: "Juicy chicken cuts cooked in a spiced minced chicken keema gravy",
      pricePaise: 41000,
      variants: [],
      addons: [],
    },
    {
      category: "Main Course - Non-Veg",
      name: "Kadhai Murgh",
      description: "Chicken with chunky bell peppers, tomatoes and freshly pounded kadhai masala",
      pricePaise: 38000,
      variants: [],
      addons: [],
    },

    // Biryani & Rice Specialties
    {
      category: "Biryani & Rice Specialties",
      name: "Dum Murgh Hyderabadi Biryani",
      description: "Long-grain basmati layered with marinated tender chicken, saffron and caramelized onions",
      pricePaise: 36000,
      variants: [
        { id: "b_reg", name: "Regular Portion (Serves 1-2)", pricePaise: 36000 },
        { id: "b_fam", name: "Handi Family Pack (Serves 3-4)", pricePaise: 68000 },
      ],
      addons: [{ id: "a5", name: "Extra Spiced Salan & Burani Raita", pricePaise: 4500 }],
    },
    {
      category: "Biryani & Rice Specialties",
      name: "Lucknowi Gosht Biryani",
      description: "Fragrant Awadhi dum biryani with melt-in-mouth mutton cuts and kewra aroma",
      pricePaise: 48000,
      variants: [],
      addons: [],
    },
    {
      category: "Biryani & Rice Specialties",
      name: "Subz Dum Dum Biryani",
      description: "Assorted vegetables and paneer infused with saffron water and whole spices",
      pricePaise: 27000,
      variants: [],
      addons: [],
    },
    {
      category: "Biryani & Rice Specialties",
      name: "Jeera Ghee Rice",
      description: "Fluffy aged basmati tempered with royal cumin seeds and clarified butter",
      pricePaise: 18000,
      variants: [],
      addons: [],
    },
    {
      category: "Biryani & Rice Specialties",
      name: "Steamed Aged Basmati Rice",
      description: "Long-grain fragrant steamed white rice",
      pricePaise: 13000,
      variants: [],
      addons: [],
    },

    // Tandoori Breads
    {
      category: "Tandoori Breads",
      name: "Butter Naan",
      description: "Clay oven baked refined flour flatbread brushed with golden butter",
      pricePaise: 6000,
      variants: [],
      addons: [],
    },
    {
      category: "Tandoori Breads",
      name: "Garlic Herb Naan",
      description: "Naan topped with chopped toasted garlic cloves, coriander and butter",
      pricePaise: 8000,
      variants: [],
      addons: [],
    },
    {
      category: "Tandoori Breads",
      name: "Cheese Garlic Naan",
      description: "Stuffed with melted mozzarella and cheddar, finished with roasted garlic",
      pricePaise: 12000,
      variants: [],
      addons: [],
    },
    {
      category: "Tandoori Breads",
      name: "Tandoori Roti",
      description: "Crisp and soft whole wheat bread baked in clay tandoor",
      pricePaise: 3500,
      variants: [],
      addons: [],
    },
    {
      category: "Tandoori Breads",
      name: "Butter Roti",
      description: "Clay-oven whole wheat roti brushed with fresh dairy butter",
      pricePaise: 4000,
      variants: [],
      addons: [],
    },
    {
      category: "Tandoori Breads",
      name: "Laccha Paratha",
      description: "Flaky multi-layered whole wheat paratha baked crisp in tandoor",
      pricePaise: 7000,
      variants: [],
      addons: [],
    },

    // Beverages & Mocktails
    {
      category: "Beverages & Mocktails",
      name: "Royal Mango Lassi",
      description: "Thick creamy yogurt whipped with Alphonso mango pulp and saffron strands",
      pricePaise: 14000,
      variants: [],
      addons: [],
    },
    {
      category: "Beverages & Mocktails",
      name: "Fresh Lime Soda Sweet & Salt",
      description: "Classic fizzy sparkling limeade balanced with rock salt and organic cane sugar",
      pricePaise: 9000,
      variants: [],
      addons: [],
    },
    {
      category: "Beverages & Mocktails",
      name: "Spiced Masala Chaas",
      description: "Cooling buttermilk infused with roasted cumin, green chillies and fresh mint",
      pricePaise: 8000,
      variants: [],
      addons: [],
    },
    {
      category: "Beverages & Mocktails",
      name: "Chilled Virgin Mojito",
      description: "Fresh mint leaves muddled with lime wedges, sugar syrup and sparkling water",
      pricePaise: 16000,
      variants: [],
      addons: [],
    },
    {
      category: "Beverages & Mocktails",
      name: "Classic Cold Coffee with Ice Cream",
      description: "Double-shot espresso blended with chilled milk, topped with rich vanilla ice cream",
      pricePaise: 15000,
      variants: [],
      addons: [],
    },

    // Desserts
    {
      category: "Desserts",
      name: "Gulab Jamun with Rabdi (2 pcs)",
      description: "Warm soft khoya dumplings dipped in saffron syrup, served on thickened rabdi",
      pricePaise: 13000,
      variants: [],
      addons: [],
    },
    {
      category: "Desserts",
      name: "Kesar Pista Rasmalai (2 pcs)",
      description: "Spongy cottage cheese discs soaked in cardamom and saffron infused clotted milk",
      pricePaise: 15000,
      variants: [],
      addons: [],
    },
    {
      category: "Desserts",
      name: "Sizzling Brownie with Ice Cream",
      description: "Warm walnut brownie on cast iron skillet drizzled with hot fudge and vanilla scoop",
      pricePaise: 21000,
      variants: [],
      addons: [],
    },
  ];

  const itemMap = new Map();
  const allCreatedItems = [];
  for (const it of itemsData) {
    const id = generateId("item");
    const categoryId = catMap.get(it.category);
    await sql`
      INSERT INTO "menuItem" ("id", "restaurantId", "outletId", "categoryId", "name", "description", "pricePaise", "variants", "addons", "available", "sortOrder", "createdAt", "updatedAt")
      VALUES (${id}, ${restaurantId}, ${defaultOutlet.id}, ${categoryId}, ${it.name}, ${it.description}, ${it.pricePaise}, ${sql.json(it.variants)}, ${sql.json(it.addons)}, true, 0, NOW(), NOW());
    `;
    const itemObj = { ...it, id, categoryId };
    itemMap.set(it.name, itemObj);
    allCreatedItems.push(itemObj);
  }
  console.log(`Created ${allCreatedItems.length} menu items across ${categoriesData.length} categories.`);

  // 6. Generate 135 Realistic Orders across Dates, Hours, and Channels
  console.log("\nGenerating ~135 Realistic Orders...");

  const baseDate = new Date("2026-09-26T12:00:00+05:30"); // Today (IST)
  let orderNoCounter = 1001;

  // Plan dates distribution:
  // Today: Sept 26 (24 orders)
  // Yesterday: Sept 25 (24 orders)
  // Sept 21-24 (40 orders)
  // Sept 1-20 (32 orders)
  // August 2026 (16 orders)
  const orderPlans = [];

  // Helper for generating timestamps
  function makeOrderTime(year, month, day, hour, minute) {
    const d = new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
    return d;
  }

  // Today (Sept 26): 24 orders
  for (let i = 0; i < 24; i++) {
    // Distribute hours:
    // 0..2: Breakfast (8:30..10:45)
    // 3..12: Lunch (12:00..15:30)
    // 13..16: Afternoon (16:00..18:30)
    // 17..23: Dinner (19:00..23:00)
    let h = 12;
    let m = Math.floor(Math.random() * 50) + 5;
    if (i < 3) {
      h = 8 + i;
    } else if (i < 13) {
      h = 12 + Math.floor((i - 3) * 0.35);
    } else if (i < 17) {
      h = 16 + (i - 13);
    } else {
      h = 19 + Math.floor((i - 17) * 0.6);
    }

    orderPlans.push({
      date: makeOrderTime(2026, 9, 26, h, m),
      isToday: true,
      indexInGroup: i,
    });
  }

  // Yesterday (Sept 25): 24 orders
  for (let i = 0; i < 24; i++) {
    let h = 12;
    let m = Math.floor(Math.random() * 50) + 5;
    if (i < 3) h = 9 + i;
    else if (i < 13) h = 12 + Math.floor((i - 3) * 0.35);
    else if (i < 17) h = 16 + (i - 13);
    else h = 19 + Math.floor((i - 17) * 0.6);

    orderPlans.push({
      date: makeOrderTime(2026, 9, 25, h, m),
      isYesterday: true,
      indexInGroup: i,
    });
  }

  // Sept 21-24 (This week): 40 orders
  for (let d = 21; d <= 24; d++) {
    for (let i = 0; i < 10; i++) {
      const h = 12 + Math.floor(i * 1.1);
      const m = Math.floor(Math.random() * 50) + 5;
      orderPlans.push({
        date: makeOrderTime(2026, 9, d, h, m),
        indexInGroup: i,
      });
    }
  }

  // Sept 1-20 (Earlier this month): 32 orders
  for (let i = 0; i < 32; i++) {
    const day = 1 + Math.floor(i * 0.6);
    const h = 12 + (i % 10);
    const m = Math.floor(Math.random() * 50) + 5;
    orderPlans.push({
      date: makeOrderTime(2026, 9, day, h, m),
      indexInGroup: i,
    });
  }

  // August 2026 (Last month): 16 orders
  for (let i = 0; i < 16; i++) {
    const day = 10 + i;
    const h = 13 + (i % 8);
    const m = Math.floor(Math.random() * 50) + 5;
    orderPlans.push({
      date: makeOrderTime(2026, 8, day, h, m),
      indexInGroup: i,
    });
  }

  // Sort by date ASC so orderNo numbers increment naturally with time
  orderPlans.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log(`Generated ${orderPlans.length} orders timeline from August to September 26, 2026.`);

  const tablesPool = tableDefs.map((t) => t.name);
  const paymentMethodsPool = ["UPI", "UPI", "UPI", "Cash", "Card", "Card", "QR"];

  for (let idx = 0; idx < orderPlans.length; idx++) {
    const plan = orderPlans[idx];
    const orderNo = orderNoCounter++;
    const orderId = generateId("ord");
    const cust = CUSTOMERS[idx % CUSTOMERS.length];

    // Determine channel
    let orderType = "DINE_IN";
    let tableNo = tablesPool[idx % tablesPool.length];
    let packagingChargePaise = 0;
    let deliveryChargePaise = 0;

    const channelRand = (idx * 7 + 13) % 100;
    if (channelRand < 65) {
      orderType = "DINE_IN";
    } else if (channelRand < 85) {
      orderType = "TAKEAWAY";
      tableNo = "Takeaway";
      packagingChargePaise = 2500;
    } else {
      orderType = "DELIVERY";
      tableNo = "Delivery";
      packagingChargePaise = 2500;
      deliveryChargePaise = 4000;
    }

    // Determine status:
    // Mostly PAID.
    // In Today's orders: 2 OPEN orders (live tables), 1 VOID, 1 CANCELLED.
    // In other dates: ~3 VOID, ~4 CANCELLED.
    let status = "PAID";
    let orderStatus = "SERVED";
    let note = null;

    if (plan.isToday && plan.indexInGroup === 22) {
      status = "OPEN";
      orderStatus = "PREPARING";
      tableNo = "T2";
      orderType = "DINE_IN";
      note = "Guest requested less oil and spicy";
    } else if (plan.isToday && plan.indexInGroup === 23) {
      status = "OPEN";
      orderStatus = "ORDERED";
      tableNo = "TG1";
      orderType = "DINE_IN";
      note = "Table occupied right now";
    } else if (idx % 35 === 17) {
      status = "VOID";
      orderStatus = "ORDERED";
      note = "Customer changed mind before punching KOT; voided by captain";
    } else if (idx % 29 === 11) {
      status = "OPEN";
      orderStatus = "CANCELLED";
      note = "Kitchen stock ran out; order cancelled";
    }

    // Pick 2 to 5 items for this order
    const numItems = 2 + (idx % 4);
    const chosenItems = [];
    const startIndex = (idx * 3) % allCreatedItems.length;
    for (let j = 0; j < numItems; j++) {
      chosenItems.push(allCreatedItems[(startIndex + j) % allCreatedItems.length]);
    }

    let subtotalPaise = 0;
    const orderItemsToInsert = [];

    for (let k = 0; k < chosenItems.length; k++) {
      const it = chosenItems[k];
      const qty = (k === 0 && it.category.includes("Breads")) ? 3 : (idx % 5 === 0 && k === 0 ? 2 : 1);
      const variant = it.variants.length > 0 ? it.variants[idx % it.variants.length] : null;
      const unitPrice = variant ? variant.pricePaise : it.pricePaise;
      const addons = (idx % 4 === 0 && it.addons.length > 0) ? [it.addons[0]] : [];
      const addonsPrice = addons.reduce((s, a) => s + a.pricePaise, 0);
      const lineTotal = (unitPrice + addonsPrice) * qty;

      let itemStatus = orderStatus === "CANCELLED" ? "CANCELLED" : "SERVED";
      // In 3 orders, mark exactly 1 item as CANCELLED (e.g. out of stock item)
      if (status === "PAID" && idx % 38 === 7 && k === chosenItems.length - 1) {
        itemStatus = "CANCELLED";
      }

      if (itemStatus !== "CANCELLED") {
        subtotalPaise += lineTotal;
      }

      orderItemsToInsert.push({
        id: generateId("soi"),
        orderId,
        itemId: it.id,
        nameSnapshot: it.name,
        pricePaiseSnapshot: unitPrice,
        qty,
        variant,
        addons,
        status: itemStatus,
        round: 1,
        paymentStatus: status === "PAID" ? "PAID" : "UNPAID",
        settledMethod: status === "PAID" ? paymentMethodsPool[idx % paymentMethodsPool.length] : null,
        note: k === 0 && idx % 6 === 0 ? "Served hot" : null,
        createdAt: plan.date,
        updatedAt: plan.date,
      });
    }

    // Bill & Tax Math
    // 5% GST (exclusive)
    const cgstPaise = Math.round((subtotalPaise * 2.5) / 100);
    const sgstPaise = Math.round((subtotalPaise * 2.5) / 100);
    const totalTaxPaise = cgstPaise + sgstPaise;

    const expectedTotal = subtotalPaise + totalTaxPaise + packagingChargePaise + deliveryChargePaise;

    // Apply Discount on ~22% of orders
    let discountPaise = 0;
    if (status === "PAID" && idx % 4 === 1 && expectedTotal > 50000) {
      // 10% discount
      discountPaise = Math.round(expectedTotal * 0.1);
      note = note || "10% Happy Hour Courtesy Discount";
    } else if (status === "PAID" && idx % 11 === 0 && expectedTotal > 80000) {
      // ₹150 flat discount
      discountPaise = 15000;
      note = note || "₹150 Weekend Celebration Promo Discount";
    }

    const paidPaise = status === "PAID" ? Math.max(0, expectedTotal - discountPaise) : 0;
    const method = status === "PAID" ? paymentMethodsPool[idx % paymentMethodsPool.length] : null;

    const settledAt = status === "PAID" ? new Date(plan.date.getTime() + 45 * 60 * 1000) : null;
    const tableFreedAt = status === "PAID" && orderType === "DINE_IN" ? settledAt : null;

    // Insert saleOrder
    await sql`
      INSERT INTO "saleOrder" (
        "id", "restaurantId", "outletId", "orderNo", "tableNo", "customerPhone",
        "status", "orderStatus", "subtotalPaise", "paidPaise", "method", "note",
        "orderType", "packagingChargePaise", "deliveryChargePaise",
        "createdAt", "updatedAt", "settledAt", "tableFreedAt"
      ) VALUES (
        ${orderId}, ${restaurantId}, ${defaultOutlet.id}, ${orderNo}, ${tableNo}, ${cust.phone},
        ${status}, ${orderStatus}, ${subtotalPaise}, ${paidPaise}, ${method}, ${note},
        ${orderType}, ${packagingChargePaise}, ${deliveryChargePaise},
        ${plan.date}, ${plan.date}, ${settledAt}, ${tableFreedAt}
      );
    `;

    // Insert line items
    for (const soi of orderItemsToInsert) {
      await sql`
        INSERT INTO "saleOrderItem" (
          "id", "orderId", "itemId", "nameSnapshot", "pricePaiseSnapshot",
          "qty", "variant", "addons", "status", "round", "paymentStatus",
          "settledMethod", "note", "createdAt", "updatedAt"
        ) VALUES (
          ${soi.id}, ${soi.orderId}, ${soi.itemId}, ${soi.nameSnapshot}, ${soi.pricePaiseSnapshot},
          ${soi.qty}, ${sql.json(soi.variant)}, ${sql.json(soi.addons)}, ${soi.status}, ${soi.round}, ${soi.paymentStatus},
          ${soi.settledMethod}, ${soi.note}, ${soi.createdAt}, ${soi.updatedAt}
        );
      `;
    }
  }

  console.log(`\nSuccessfully inserted ${orderPlans.length} orders with comprehensive items, taxes, and discounts!`);

  // Final count check
  const orderCount = await sql`SELECT count(*) FROM "saleOrder";`;
  const itemsCount = await sql`SELECT count(*) FROM "saleOrderItem";`;
  const tablesCount = await sql`SELECT count(*) FROM "posTable";`;
  const menuItemsCount = await sql`SELECT count(*) FROM "menuItem";`;
  console.log("\n=== DATABASE SUMMARY AFTER SEEDING ===");
  console.log(`Orders: ${orderCount[0].count}`);
  console.log(`Order Items: ${itemsCount[0].count}`);
  console.log(`Tables: ${tablesCount[0].count}`);
  console.log(`Menu Items: ${menuItemsCount[0].count}`);

  await sql.end();
  console.log("\nSeeding finished cleanly!");
}

seed().catch((err) => {
  console.error("Seeding failed with error:", err);
  process.exit(1);
});
