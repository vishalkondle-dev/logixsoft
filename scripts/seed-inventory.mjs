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

async function main() {
  console.log("🌱 Starting Inventory & Recipe (BOM) realistic data seed...");

  // 1. Fetch restaurant and outlets
  const restaurants = await sql`SELECT id, name FROM "restaurant" LIMIT 1`;
  if (!restaurants.length) {
    console.error("❌ No restaurant found!");
    process.exit(1);
  }
  const restaurant = restaurants[0];
  console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);

  const outlets = await sql`SELECT id, name FROM "restaurantOutlet" WHERE "restaurantId" = ${restaurant.id}`;
  if (!outlets.length) {
    console.error("❌ No outlets found!");
    process.exit(1);
  }
  console.log(`Found ${outlets.length} outlet(s)`);

  // 2. Enable Inventory in all outlets
  const inventorySettingsObj = {
    enabled: true,
    autoDeductOn: "ON_ORDER",
    allowNegativeStock: true,
    lowStockAlerts: true,
    auto86OnDepletion: false,
  };

  for (const outlet of outlets) {
    await sql`
      UPDATE "restaurantOutlet"
      SET "inventorySettings" = ${sql.json(inventorySettingsObj)}
      WHERE id = ${outlet.id}
    `;
    console.log(`✅ Enabled inventory for outlet: ${outlet.name}`);
  }

  const primaryOutlet = outlets[0];

  // 3. Clear previous inventory records for clean slate
  console.log("Cleaning old inventory test records...");
  await sql`DELETE FROM "inventoryTransaction" WHERE "restaurantId" = ${restaurant.id}`;
  await sql`DELETE FROM "purchaseOrder" WHERE "restaurantId" = ${restaurant.id}`;
  await sql`DELETE FROM "menuItemRecipe" WHERE "restaurantId" = ${restaurant.id}`;
  await sql`DELETE FROM "inventoryItem" WHERE "restaurantId" = ${restaurant.id}`;
  await sql`DELETE FROM "inventorySupplier" WHERE "restaurantId" = ${restaurant.id}`;

  // 4. Create 3 Wholesale Suppliers
  console.log("Creating wholesale suppliers...");
  const suppliersData = [
    {
      id: generateId("sup"),
      restaurantId: restaurant.id,
      name: "Metro Cash & Carry Wholesale",
      contactPerson: "Ramesh Sharma",
      phone: "+919845012345",
      email: "b2b.bangalore@metro.co.in",
      gstin: "29AAACM1234F1Z5",
      address: "APMC Sub-Market Yard, Yeshwanthpur, Bengaluru",
      paymentTerms: "Net 15 Days",
      active: true,
    },
    {
      id: generateId("sup"),
      restaurantId: restaurant.id,
      name: "Heritage Dairy & Milk Products",
      contactPerson: "Suresh Gowda",
      phone: "+919886023456",
      email: "orders@heritagedairy.in",
      gstin: "29AAACH5678K1Z2",
      address: "Dairy Circle, Bannerghatta Road, Bengaluru",
      paymentTerms: "Cash On Delivery (COD)",
      active: true,
    },
    {
      id: generateId("sup"),
      restaurantId: restaurant.id,
      name: "Golden Spices & Agro Traded",
      contactPerson: "Abdul Qadir",
      phone: "+919741034567",
      email: "spices.sales@goldenspices.com",
      gstin: "29AAACG9012P1Z8",
      address: "Wholesale Spice Market, Commercial St, Bengaluru",
      paymentTerms: "Net 30 Days",
      active: true,
    },
  ];

  for (const s of suppliersData) {
    await sql`
      INSERT INTO "inventorySupplier" (
        id, "restaurantId", name, "contactPerson", phone, email, gstin, address, "paymentTerms", active
      ) VALUES (
        ${s.id}, ${s.restaurantId}, ${s.name}, ${s.contactPerson}, ${s.phone}, ${s.email}, ${s.gstin}, ${s.address}, ${s.paymentTerms}, ${s.active}
      )
    `;
  }
  console.log(`✅ Created ${suppliersData.length} suppliers`);

  const metroSup = suppliersData[0];
  const dairySup = suppliersData[1];
  const spiceSup = suppliersData[2];

  // 5. Create 16 Raw Materials
  console.log("Creating realistic raw materials...");
  const rawMaterials = [
    {
      name: "Raw Boneless Chicken Breast",
      sku: "ING-CHK-01",
      category: "Meat & Poultry",
      baseUom: "kg",
      costPerBaseUnitPaise: 22000, // ₹220 / kg
      currentStock: 45.0,
      lowStockThreshold: 12.0,
      supplierId: metroSup.id,
    },
    {
      name: "Farm Fresh Malai Paneer",
      sku: "ING-PAN-01",
      category: "Dairy",
      baseUom: "kg",
      costPerBaseUnitPaise: 34000, // ₹340 / kg
      currentStock: 28.5,
      lowStockThreshold: 8.0,
      supplierId: dairySup.id,
    },
    {
      name: "Aged Royal Basmati Rice (XXL)",
      sku: "ING-RCE-01",
      category: "Dry Grocery",
      baseUom: "kg",
      costPerBaseUnitPaise: 11500, // ₹115 / kg
      currentStock: 85.0,
      lowStockThreshold: 25.0,
      supplierId: metroSup.id,
    },
    {
      name: "Amul Pasteurised Table Butter",
      sku: "ING-BUT-01",
      category: "Dairy",
      baseUom: "kg",
      costPerBaseUnitPaise: 52000, // ₹520 / kg
      currentStock: 18.0,
      lowStockThreshold: 6.0,
      supplierId: dairySup.id,
    },
    {
      name: "Amul Fresh Cooking Dairy Cream",
      sku: "ING-CRM-01",
      category: "Dairy",
      baseUom: "l",
      costPerBaseUnitPaise: 24000, // ₹240 / L
      currentStock: 14.0,
      lowStockThreshold: 5.0,
      supplierId: dairySup.id,
    },
    {
      name: "Pure Cow Desi Ghee",
      sku: "ING-GHE-01",
      category: "Dairy",
      baseUom: "kg",
      costPerBaseUnitPaise: 65000, // ₹650 / kg
      currentStock: 15.0,
      lowStockThreshold: 4.0,
      supplierId: dairySup.id,
    },
    {
      name: "Farm Fresh Red Onions (Nashik)",
      sku: "ING-ONN-01",
      category: "Produce",
      baseUom: "kg",
      costPerBaseUnitPaise: 3200, // ₹32 / kg
      currentStock: 65.0,
      lowStockThreshold: 20.0,
      supplierId: metroSup.id,
    },
    {
      name: "Vine Ripe Hybrid Tomatoes",
      sku: "ING-TOM-01",
      category: "Produce",
      baseUom: "kg",
      costPerBaseUnitPaise: 2800, // ₹28 / kg
      currentStock: 42.0,
      lowStockThreshold: 15.0,
      supplierId: metroSup.id,
    },
    {
      name: "Fresh Ginger Garlic Paste",
      sku: "ING-GGP-01",
      category: "Produce",
      baseUom: "kg",
      costPerBaseUnitPaise: 14000, // ₹140 / kg
      currentStock: 12.0,
      lowStockThreshold: 4.0,
      supplierId: metroSup.id,
    },
    {
      name: "Kashmiri Degi Mirch Powder",
      sku: "ING-KDM-01",
      category: "Spices & Oils",
      baseUom: "kg",
      costPerBaseUnitPaise: 48000, // ₹480 / kg
      currentStock: 8.5,
      lowStockThreshold: 2.5,
      supplierId: spiceSup.id,
    },
    {
      name: "Royal Shahi Biryani Masala Blend",
      sku: "ING-SBM-01",
      category: "Spices & Oils",
      baseUom: "kg",
      costPerBaseUnitPaise: 75000, // ₹750 / kg
      currentStock: 6.0,
      lowStockThreshold: 2.0,
      supplierId: spiceSup.id,
    },
    {
      name: "Refined Sunflower Cooking Oil",
      sku: "ING-OIL-01",
      category: "Spices & Oils",
      baseUom: "l",
      costPerBaseUnitPaise: 13500, // ₹135 / L
      currentStock: 50.0,
      lowStockThreshold: 15.0,
      supplierId: metroSup.id,
    },
    {
      name: "Maida Refined Wheat Flour",
      sku: "ING-MAI-01",
      category: "Dry Grocery",
      baseUom: "kg",
      costPerBaseUnitPaise: 4200, // ₹42 / kg
      currentStock: 60.0,
      lowStockThreshold: 15.0,
      supplierId: metroSup.id,
    },
    {
      name: "Whole Black Urad Dal",
      sku: "ING-URD-01",
      category: "Dry Grocery",
      baseUom: "kg",
      costPerBaseUnitPaise: 12000, // ₹120 / kg
      currentStock: 35.0,
      lowStockThreshold: 10.0,
      supplierId: metroSup.id,
    },
    {
      name: "Fresh Coriander & Mint Herbs",
      sku: "ING-HRB-01",
      category: "Produce",
      baseUom: "kg",
      costPerBaseUnitPaise: 8000, // ₹80 / kg
      currentStock: 6.5,
      lowStockThreshold: 2.0,
      supplierId: metroSup.id,
    },
    {
      name: "Eco 3-Compartment Meal Box & Lid",
      sku: "ING-BOX-01",
      category: "Packaging",
      baseUom: "pcs",
      costPerBaseUnitPaise: 450, // ₹4.50 / pcs
      currentStock: 350.0,
      lowStockThreshold: 60.0,
      supplierId: metroSup.id,
    },
  ];

  const ingredientMap = new Map();

  for (const mat of rawMaterials) {
    const id = generateId("item");
    await sql`
      INSERT INTO "inventoryItem" (
        id, "restaurantId", "outletId", name, sku, category, "baseUom",
        "costPerBaseUnitPaise", "currentStock", "lowStockThreshold", "supplierId", active
      ) VALUES (
        ${id}, ${restaurant.id}, ${primaryOutlet.id}, ${mat.name}, ${mat.sku}, ${mat.category}, ${mat.baseUom},
        ${mat.costPerBaseUnitPaise}, ${mat.currentStock}, ${mat.lowStockThreshold}, ${mat.supplierId}, true
      )
    `;
    ingredientMap.set(mat.name, { id, ...mat });
  }
  console.log(`✅ Created ${rawMaterials.length} raw material ingredients`);

  // 6. Map Recipes (BOM) to Menu Items
  console.log("Mapping BOM recipes to menu items...");
  const menuItems = await sql`SELECT id, name, "pricePaise" FROM "menuItem" WHERE "restaurantId" = ${restaurant.id}`;

  const findMenuItem = (substr) => menuItems.find((m) => m.name.toLowerCase().includes(substr.toLowerCase()));

  const recipesToSeed = [
    {
      itemQuery: "Butter Chicken",
      ingredients: [
        { name: "Raw Boneless Chicken Breast", qty: 0.250, waste: 5 },
        { name: "Amul Pasteurised Table Butter", qty: 0.040, waste: 0 },
        { name: "Amul Fresh Cooking Dairy Cream", qty: 0.050, waste: 0 },
        { name: "Vine Ripe Hybrid Tomatoes", qty: 0.200, waste: 8 },
        { name: "Fresh Ginger Garlic Paste", qty: 0.020, waste: 0 },
        { name: "Kashmiri Degi Mirch Powder", qty: 0.010, waste: 0 },
      ],
    },
    {
      itemQuery: "Paneer Butter Masala",
      ingredients: [
        { name: "Farm Fresh Malai Paneer", qty: 0.220, waste: 2 },
        { name: "Amul Pasteurised Table Butter", qty: 0.035, waste: 0 },
        { name: "Amul Fresh Cooking Dairy Cream", qty: 0.040, waste: 0 },
        { name: "Vine Ripe Hybrid Tomatoes", qty: 0.180, waste: 8 },
        { name: "Fresh Ginger Garlic Paste", qty: 0.015, waste: 0 },
        { name: "Kashmiri Degi Mirch Powder", qty: 0.008, waste: 0 },
      ],
    },
    {
      itemQuery: "Dum Murgh Hyderabadi Biryani",
      ingredients: [
        { name: "Raw Boneless Chicken Breast", qty: 0.250, waste: 5 },
        { name: "Aged Royal Basmati Rice (XXL)", qty: 0.200, waste: 3 },
        { name: "Pure Cow Desi Ghee", qty: 0.025, waste: 0 },
        { name: "Farm Fresh Red Onions (Nashik)", qty: 0.120, waste: 10 },
        { name: "Royal Shahi Biryani Masala Blend", qty: 0.015, waste: 0 },
        { name: "Fresh Coriander & Mint Herbs", qty: 0.020, waste: 5 },
      ],
    },
    {
      itemQuery: "Dal Makhani",
      ingredients: [
        { name: "Whole Black Urad Dal", qty: 0.150, waste: 0 },
        { name: "Amul Pasteurised Table Butter", qty: 0.040, waste: 0 },
        { name: "Amul Fresh Cooking Dairy Cream", qty: 0.040, waste: 0 },
        { name: "Vine Ripe Hybrid Tomatoes", qty: 0.120, waste: 5 },
      ],
    },
    {
      itemQuery: "Garlic Herb Naan",
      ingredients: [
        { name: "Maida Refined Wheat Flour", qty: 0.120, waste: 5 },
        { name: "Amul Pasteurised Table Butter", qty: 0.020, waste: 0 },
        { name: "Fresh Coriander & Mint Herbs", qty: 0.010, waste: 0 },
      ],
    },
    {
      itemQuery: "Paneer Tikka Angaare",
      ingredients: [
        { name: "Farm Fresh Malai Paneer", qty: 0.240, waste: 2 },
        { name: "Refined Sunflower Cooking Oil", qty: 0.025, waste: 0 },
        { name: "Kashmiri Degi Mirch Powder", qty: 0.012, waste: 0 },
        { name: "Fresh Ginger Garlic Paste", qty: 0.020, waste: 0 },
      ],
    },
  ];

  let recipesConfigured = 0;
  for (const rDef of recipesToSeed) {
    const mi = findMenuItem(rDef.itemQuery);
    if (!mi) {
      console.log(`⚠️ Menu item not found for query: ${rDef.itemQuery}`);
      continue;
    }

    for (const ingDef of rDef.ingredients) {
      const ing = ingredientMap.get(ingDef.name);
      if (!ing) continue;

      await sql`
        INSERT INTO "menuItemRecipe" (
          id, "restaurantId", "outletId", "menuItemId", "ingredientId",
          quantity, "wastePercent"
        ) VALUES (
          ${generateId("rec")}, ${restaurant.id}, ${primaryOutlet.id}, ${mi.id}, ${ing.id},
          ${ingDef.qty}, ${ingDef.waste || 0}
        )
      `;
    }
    recipesConfigured++;
    console.log(`✅ Configured BOM for "${mi.name}" (Selling: ₹${mi.pricePaise / 100})`);
  }

  // 7. Insert Purchase Orders (GRN)
  console.log("Creating realistic purchase orders (GRN)...");

  // PO 1: Metro Dry Grocery & Meat
  const po1Id = generateId("po");
  const po1Items = [
    { name: "Raw Boneless Chicken Breast", qty: 30, unitCost: 22000 },
    { name: "Aged Royal Basmati Rice (XXL)", qty: 50, unitCost: 11500 },
    { name: "Farm Fresh Red Onions (Nashik)", qty: 40, unitCost: 3200 },
    { name: "Vine Ripe Hybrid Tomatoes", qty: 30, unitCost: 2800 },
  ];
  const po1Total = po1Items.reduce((acc, i) => acc + i.qty * i.unitCost, 0);

  await sql`
    INSERT INTO "purchaseOrder" (
      id, "restaurantId", "outletId", "supplierId", "poNumber", "invoiceNumber",
      "invoiceDate", status, "totalAmountPaise", notes, "receivedAt", "createdBy"
    ) VALUES (
      ${po1Id}, ${restaurant.id}, ${primaryOutlet.id}, ${metroSup.id},
      'PO-20260925-001', 'INV-METRO-8821', '2026-09-25', 'RECEIVED',
      ${po1Total}, 'Weekly meat and vegetable replenishment', NOW() - INTERVAL '1 day', 'Ramesh (Inventory Mgr)'
    )
  `;

  for (const item of po1Items) {
    const ing = ingredientMap.get(item.name);
    await sql`
      INSERT INTO "purchaseOrderItem" (
        id, "purchaseOrderId", "ingredientId",
        quantity, "unitCostPaise", "totalPaise"
      ) VALUES (
        ${generateId("poi")}, ${po1Id}, ${ing.id},
        ${item.qty}, ${item.unitCost}, ${item.qty * item.unitCost}
      )
    `;

    // INWARD Transaction
    await sql`
      INSERT INTO "inventoryTransaction" (
        id, "restaurantId", "outletId", "ingredientId", type,
        quantity, "balanceAfter", "unitCostPaise", "referenceId", "referenceNote", "createdBy", "createdAt"
      ) VALUES (
        ${generateId("itxn")}, ${restaurant.id}, ${primaryOutlet.id}, ${ing.id}, 'INWARD',
        ${item.qty}, ${ing.currentStock}, ${item.unitCost}, ${po1Id}, 'PO-20260925-001: Metro Wholesale Delivery', 'Ramesh', NOW() - INTERVAL '1 day'
      )
    `;
  }

  // PO 2: Heritage Dairy Delivery
  const po2Id = generateId("po");
  const po2Items = [
    { name: "Farm Fresh Malai Paneer", qty: 20, unitCost: 34000 },
    { name: "Amul Pasteurised Table Butter", qty: 15, unitCost: 52000 },
    { name: "Amul Fresh Cooking Dairy Cream", qty: 10, unitCost: 24000 },
  ];
  const po2Total = po2Items.reduce((acc, i) => acc + i.qty * i.unitCost, 0);

  await sql`
    INSERT INTO "purchaseOrder" (
      id, "restaurantId", "outletId", "supplierId", "poNumber", "invoiceNumber",
      "invoiceDate", status, "totalAmountPaise", notes, "receivedAt", "createdBy"
    ) VALUES (
      ${po2Id}, ${restaurant.id}, ${primaryOutlet.id}, ${dairySup.id},
      'PO-20260926-002', 'INV-HER-4410', '2026-09-26', 'RECEIVED',
      ${po2Total}, 'Morning fresh dairy & paneer stock-in', NOW() - INTERVAL '4 hours', 'Chef Vikram'
    )
  `;

  for (const item of po2Items) {
    const ing = ingredientMap.get(item.name);
    await sql`
      INSERT INTO "purchaseOrderItem" (
        id, "purchaseOrderId", "ingredientId",
        quantity, "unitCostPaise", "totalPaise"
      ) VALUES (
        ${generateId("poi")}, ${po2Id}, ${ing.id},
        ${item.qty}, ${item.unitCost}, ${item.qty * item.unitCost}
      )
    `;

    // INWARD Transaction
    await sql`
      INSERT INTO "inventoryTransaction" (
        id, "restaurantId", "outletId", "ingredientId", type,
        quantity, "balanceAfter", "unitCostPaise", "referenceId", "referenceNote", "createdBy", "createdAt"
      ) VALUES (
        ${generateId("itxn")}, ${restaurant.id}, ${primaryOutlet.id}, ${ing.id}, 'INWARD',
        ${item.qty}, ${ing.currentStock}, ${item.unitCost}, ${po2Id}, 'PO-20260926-002: Heritage Dairy Delivery', 'Chef Vikram', NOW() - INTERVAL '4 hours'
      )
    `;
  }

  // 8. Insert realistic WASTAGE transactions
  console.log("Inserting realistic kitchen wastage records...");
  const tomatoIng = ingredientMap.get("Vine Ripe Hybrid Tomatoes");
  if (tomatoIng) {
    await sql`
      INSERT INTO "inventoryTransaction" (
        id, "restaurantId", "outletId", "ingredientId", type,
        quantity, "balanceAfter", "unitCostPaise", "referenceNote", "createdBy", "createdAt"
      ) VALUES (
        ${generateId("itxn")}, ${restaurant.id}, ${primaryOutlet.id}, ${tomatoIng.id}, 'WASTAGE',
        -2.5, ${tomatoIng.currentStock}, ${tomatoIng.costPerBaseUnitPaise}, 'Prep trimming loss & soft tomatoes', 'Kitchen Commis', NOW() - INTERVAL '3 hours'
      )
    `;
  }

  const paneerIng = ingredientMap.get("Farm Fresh Malai Paneer");
  if (paneerIng) {
    await sql`
      INSERT INTO "inventoryTransaction" (
        id, "restaurantId", "outletId", "ingredientId", type,
        quantity, "balanceAfter", "unitCostPaise", "referenceNote", "createdBy", "createdAt"
      ) VALUES (
        ${generateId("itxn")}, ${restaurant.id}, ${primaryOutlet.id}, ${paneerIng.id}, 'WASTAGE',
        -1.0, ${paneerIng.currentStock}, ${paneerIng.costPerBaseUnitPaise}, 'Dropped during prep / Tandoor marinade discard', 'Chef Vikram', NOW() - INTERVAL '2 hours'
      )
    `;
  }

  // 9. Insert realistic stock audit ADJUSTMENT transaction
  const riceIng = ingredientMap.get("Aged Royal Basmati Rice (XXL)");
  if (riceIng) {
    await sql`
      INSERT INTO "inventoryTransaction" (
        id, "restaurantId", "outletId", "ingredientId", type,
        quantity, "balanceAfter", "unitCostPaise", "referenceNote", "createdBy", "createdAt"
      ) VALUES (
        ${generateId("itxn")}, ${restaurant.id}, ${primaryOutlet.id}, ${riceIng.id}, 'ADJUSTMENT',
        2.0, ${riceIng.currentStock}, ${riceIng.costPerBaseUnitPaise}, 'Physical Audit / Stock Count reconciliation', 'Ramesh', NOW() - INTERVAL '6 hours'
      )
    `;
  }

  console.log("🎉 Seed finished successfully!");
  console.log(`- 3 Suppliers registered`);
  console.log(`- 16 Raw Materials registered with stock & UOM`);
  console.log(`- ${recipesConfigured} Dish Recipes configured with food cost %`);
  console.log(`- 2 Inward Purchase Orders (GRN) created`);
  console.log(`- Movement ledger populated with INWARD, WASTAGE, and ADJUSTMENT logs`);

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
