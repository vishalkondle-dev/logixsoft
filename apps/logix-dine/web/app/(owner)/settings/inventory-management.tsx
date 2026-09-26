"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Stack,
  Group,
  Text,
  Title,
  Button,
  Switch,
  TextInput,
  NumberInput,
  Select,
  Badge,
  Loader,
  Divider,
  Grid,
  SimpleGrid,
  Card,
  Table,
  ActionIcon,
  Modal,
  Tabs,
  ThemeIcon,
  Alert,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPackages,
  IconPlus,
  IconCheck,
  IconTrash,
  IconEdit,
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconSearch,
  IconFilter,
  IconCircleCheck,
  IconChefHat,
  IconTruckDelivery,
  IconArrowUpRight,
  IconArrowDownRight,
  IconClock,
  IconBuildingStore,
  IconReceipt,
  IconInfoCircle,
  IconSettings,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useInventoryOverview,
  useInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useAdjustInventoryStock,
  useLogInventoryWastage,
  useMenuRecipes,
  useMenuRecipe,
  useSaveMenuRecipe,
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useInventorySuppliers,
  useCreateInventorySupplier,
  useUpdateInventorySupplier,
  useInventoryTransactions,
  useUpdateInventorySettings,
} from "@/lib/queries";
import {
  InventoryItem,
  DishRecipeSummary,
  InventorySupplier,
  PurchaseOrder,
} from "@/lib/api-client";

const INVENTORY_CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat & Poultry",
  "Dry Grocery",
  "Spices & Oils",
  "Beverages",
  "Packaging",
  "Bakery",
  "Other",
];

const UOM_OPTIONS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "l", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "pcs", label: "Pieces / Units (pcs)" },
  { value: "packet", label: "Packet (pkt)" },
  { value: "can", label: "Can / Tin" },
  { value: "bottle", label: "Bottle" },
  { value: "box", label: "Box" },
];

const WASTAGE_REASONS = [
  "Burnt / Kitchen Preparation Error",
  "Expired / Spoiled Dairy or Produce",
  "Prep Trimming Loss",
  "Spillage / Dropped Material",
  "Customer Return / Quality Rejection",
  "Physical Audit Discrepancy",
];

const ADJUST_REASONS = [
  "Physical Audit / Stock Count",
  "Vendor Recount / Delivery Discrepancy",
  "Stock Take Correction",
  "Found Unrecorded Stock",
  "Other Reason",
];

export function InventoryManagement() {
  const { restaurant, activeOutlet, outlets } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? outlets[0]?.id ?? "";

  const [activeSubTab, setActiveSubTab] = useState<string>("items");

  // Overview Query
  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useInventoryOverview(restaurantId, outletId, Boolean(restaurantId && outletId));

  const isInventoryEnabled = overview?.inventorySettings?.enabled ?? false;

  // Items Query & Filters
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>("ALL");
  const [itemSearch, setItemSearch] = useState<string>("");
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  const {
    data: items = [],
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useInventoryItems(
    restaurantId,
    outletId,
    itemCategoryFilter === "ALL" ? undefined : itemCategoryFilter,
    lowStockOnly,
    Boolean(restaurantId && outletId)
  );

  // Recipes Query & Filters
  const [recipeSearch, setRecipeSearch] = useState<string>("");
  const [recipeFilter, setRecipeFilter] = useState<"ALL" | "CONFIGURED" | "MISSING">("ALL");

  const {
    data: recipes = [],
    isLoading: recipesLoading,
    refetch: refetchRecipes,
  } = useMenuRecipes(restaurantId, outletId, Boolean(restaurantId && outletId));

  // Suppliers Query
  const { data: suppliers = [], refetch: refetchSuppliers } = useInventorySuppliers(
    restaurantId,
    Boolean(restaurantId)
  );

  // Purchase Orders Query
  const {
    data: purchaseOrders = [],
    isLoading: purchasesLoading,
    refetch: refetchPurchases,
  } = usePurchaseOrders(restaurantId, outletId, Boolean(restaurantId && outletId));

  // Transactions / Movement Ledger Query
  const [txnTypeFilter, setTxnTypeFilter] = useState<string>("ALL");
  const {
    data: transactions = [],
    isLoading: txnsLoading,
    refetch: refetchTxns,
  } = useInventoryTransactions(
    restaurantId,
    outletId,
    undefined,
    txnTypeFilter === "ALL" ? undefined : txnTypeFilter,
    Boolean(restaurantId && outletId)
  );

  // Mutations
  const updateSettingsMut = useUpdateInventorySettings(restaurantId, outletId);
  const createItemMut = useCreateInventoryItem(restaurantId, outletId);
  const updateItemMut = useUpdateInventoryItem(restaurantId, outletId);
  const deleteItemMut = useDeleteInventoryItem(restaurantId, outletId);
  const adjustStockMut = useAdjustInventoryStock(restaurantId, outletId);
  const logWastageMut = useLogInventoryWastage(restaurantId, outletId);
  const saveRecipeMut = useSaveMenuRecipe(restaurantId, outletId);
  const createPOMut = useCreatePurchaseOrder(restaurantId, outletId);
  const createSupplierMut = useCreateInventorySupplier(restaurantId);
  const updateSupplierMut = useUpdateInventorySupplier(restaurantId);

  // Modals state
  const [itemModal, setItemModal] = useState<{ open: boolean; editing: InventoryItem | null }>({
    open: false,
    editing: null,
  });
  const [itemForm, setItemForm] = useState({
    name: "",
    sku: "",
    category: "Produce",
    baseUom: "kg",
    costPerBaseUnit: 0,
    currentStock: 0,
    lowStockThreshold: 5,
    supplierId: "",
  });

  const [adjustModal, setAdjustModal] = useState<{ open: boolean; item: InventoryItem | null }>({
    open: false,
    item: null,
  });
  const [adjustForm, setAdjustForm] = useState({
    newStock: 0,
    reason: ADJUST_REASONS[0],
    note: "",
  });

  const [wastageModal, setWastageModal] = useState<{ open: boolean; item: InventoryItem | null }>({
    open: false,
    item: null,
  });
  const [wastageForm, setWastageForm] = useState({
    ingredientId: "",
    quantity: 1,
    reason: WASTAGE_REASONS[0],
  });

  // Recipe Builder Modal State
  const [recipeModal, setRecipeModal] = useState<{
    open: boolean;
    dish: DishRecipeSummary | null;
  }>({
    open: false,
    dish: null,
  });

  const { data: activeRecipeDetail, isLoading: recipeDetailLoading } = useMenuRecipe(
    restaurantId,
    recipeModal.dish?.id || "",
    outletId,
    Boolean(restaurantId && recipeModal.dish?.id)
  );

  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{
      ingredientId: string;
      quantity: number;
      wastePercent: number;
    }>
  >([]);

  // Synchronize ingredients when recipe detail is loaded
  React.useEffect(() => {
    if (activeRecipeDetail?.ingredients) {
      setRecipeIngredients(
        activeRecipeDetail.ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          wastePercent: ing.wastePercent || 0,
        }))
      );
    } else {
      setRecipeIngredients([]);
    }
  }, [activeRecipeDetail]);

  // Purchase Order (Stock In) Modal State
  const [poModal, setPoModal] = useState(false);
  const [poForm, setPoForm] = useState<{
    supplierId: string;
    poNumber: string;
    invoiceNumber: string;
    invoiceDate: string;
    notes: string;
    items: Array<{
      ingredientId: string;
      quantity: number;
      unitCost: number;
    }>;
  }>({
    supplierId: "",
    poNumber: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
      100 + Math.random() * 900
    )}`,
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    notes: "",
    items: [{ ingredientId: "", quantity: 10, unitCost: 100 }],
  });

  // Supplier Modal State
  const [supplierModal, setSupplierModal] = useState<{
    open: boolean;
    editing: InventorySupplier | null;
  }>({
    open: false,
    editing: null,
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    paymentTerms: "Net 15 Days",
  });

  // Helper calculations
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchSearch =
        !itemSearch.trim() ||
        it.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (it.sku && it.sku.toLowerCase().includes(itemSearch.toLowerCase()));
      return matchSearch;
    });
  }, [items, itemSearch]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((rc) => {
      const matchSearch =
        !recipeSearch.trim() ||
        rc.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
        (rc.categoryName && rc.categoryName.toLowerCase().includes(recipeSearch.toLowerCase()));
      if (!matchSearch) return false;
      if (recipeFilter === "CONFIGURED") return rc.hasRecipe;
      if (recipeFilter === "MISSING") return !rc.hasRecipe;
      return true;
    });
  }, [recipes, recipeSearch, recipeFilter]);

  // Handle Master Toggle
  const handleToggleInventory = async (checked: boolean) => {
    try {
      await updateSettingsMut.mutateAsync({
        enabled: checked,
        autoDeductOn: "ON_ORDER",
        allowNegativeStock: true,
        lowStockAlerts: true,
      });
      notifications.show({
        title: checked ? "Inventory Tracking Enabled" : "Inventory Disabled",
        message: checked
          ? "Stock levels, recipes, and BOM deductions are now active for this outlet."
          : "Inventory tracking paused. Orders will pass through without stock deduction.",
        color: checked ? "green" : "gray",
        icon: <IconCheck size={16} />,
      });
      refetchOverview();
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message || "Failed to update inventory settings",
        color: "red",
      });
    }
  };

  // Handle Save Ingredient
  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) {
      notifications.show({ title: "Name Required", message: "Please provide ingredient name", color: "orange" });
      return;
    }
    try {
      const payload = {
        name: itemForm.name.trim(),
        sku: itemForm.sku.trim() || undefined,
        category: itemForm.category,
        baseUom: itemForm.baseUom,
        costPerBaseUnitPaise: Math.round(Number(itemForm.costPerBaseUnit) * 100),
        currentStock: Number(itemForm.currentStock) || 0,
        lowStockThreshold: Number(itemForm.lowStockThreshold) || 0,
        supplierId: itemForm.supplierId || undefined,
      };

      if (itemModal.editing) {
        await updateItemMut.mutateAsync({ id: itemModal.editing.id, data: payload });
        notifications.show({ title: "Updated", message: "Raw material updated", color: "green", icon: <IconCheck size={16} /> });
      } else {
        await createItemMut.mutateAsync(payload);
        notifications.show({ title: "Added", message: "Raw material registered in stock", color: "green", icon: <IconCheck size={16} /> });
      }
      setItemModal({ open: false, editing: null });
      refetchItems();
      refetchOverview();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message || "Failed to save item", color: "red" });
    }
  };

  // Handle Quick Adjust Stock
  const handleSaveAdjust = async () => {
    if (!adjustModal.item) return;
    try {
      const fullReason = adjustForm.note.trim()
        ? `${adjustForm.reason}: ${adjustForm.note.trim()}`
        : adjustForm.reason;

      await adjustStockMut.mutateAsync({
        ingredientId: adjustModal.item.id,
        newStock: Number(adjustForm.newStock),
        reason: fullReason,
      });

      notifications.show({
        title: "Stock Adjusted",
        message: `${adjustModal.item.name} stock updated to ${adjustForm.newStock} ${adjustModal.item.baseUom}`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
      setAdjustModal({ open: false, item: null });
      refetchItems();
      refetchOverview();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message || "Failed to adjust stock", color: "red" });
    }
  };

  // Handle Log Wastage
  const handleSaveWastage = async () => {
    if (!wastageForm.ingredientId || Number(wastageForm.quantity) <= 0) {
      notifications.show({ title: "Invalid Input", message: "Select ingredient and valid quantity", color: "orange" });
      return;
    }
    try {
      await logWastageMut.mutateAsync({
        ingredientId: wastageForm.ingredientId,
        quantity: Number(wastageForm.quantity),
        reason: wastageForm.reason,
      });
      notifications.show({
        title: "Wastage Logged",
        message: `Logged ${wastageForm.quantity} units as waste. Stock has been deducted.`,
        color: "orange",
        icon: <IconTrash size={16} />,
      });
      setWastageModal({ open: false, item: null });
      refetchItems();
      refetchOverview();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message || "Failed to log wastage", color: "red" });
    }
  };

  // Recipe Builder Cost Calculation
  const recipeCostCalculations = useMemo(() => {
    let totalCost = 0;
    const lines = recipeIngredients.map((row) => {
      const ing = items.find((it) => it.id === row.ingredientId);
      const unitCost = ing ? ing.costPerBaseUnitPaise / 100 : 0;
      const wasteFactor = 1 + (row.wastePercent || 0) / 100;
      const lineCost = (row.quantity || 0) * unitCost * wasteFactor;
      totalCost += lineCost;
      return {
        ...row,
        name: ing?.name || "Unknown",
        uom: ing?.baseUom || "units",
        unitCost,
        lineCost,
      };
    });

    const sellingPrice = recipeModal.dish ? recipeModal.dish.pricePaise / 100 : 0;
    const foodCostPercent = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0;
    const grossMarginPercent = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0;

    return {
      totalCost,
      sellingPrice,
      foodCostPercent,
      grossMarginPercent,
      lines,
    };
  }, [recipeIngredients, items, recipeModal.dish]);

  // Handle Save Recipe
  const handleSaveRecipe = async () => {
    if (!recipeModal.dish) return;
    try {
      const validRows = recipeIngredients.filter(
        (r) => r.ingredientId && Number(r.quantity) > 0
      );
      await saveRecipeMut.mutateAsync({
        menuItemId: recipeModal.dish.id,
        ingredients: validRows,
      });
      notifications.show({
        title: "Recipe Saved",
        message: `BOM updated for "${recipeModal.dish.name}" with ${validRows.length} ingredients.`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
      setRecipeModal({ open: false, dish: null });
      refetchRecipes();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message || "Failed to save recipe", color: "red" });
    }
  };

  // Handle Save Purchase Order
  const handleSavePurchaseOrder = async () => {
    if (!poForm.items.length || !poForm.items.some((i) => i.ingredientId && i.quantity > 0)) {
      notifications.show({ title: "Missing Items", message: "Add at least one raw material line item", color: "orange" });
      return;
    }
    try {
      const itemsPayload = poForm.items
        .filter((i) => i.ingredientId && Number(i.quantity) > 0)
        .map((i) => ({
          ingredientId: i.ingredientId,
          quantity: Number(i.quantity),
          unitCostPaise: Math.round(Number(i.unitCost) * 100),
        }));

      await createPOMut.mutateAsync({
        supplierId: poForm.supplierId || undefined,
        poNumber: poForm.poNumber || `PO-${Date.now()}`,
        invoiceNumber: poForm.invoiceNumber || undefined,
        invoiceDate: poForm.invoiceDate || undefined,
        notes: poForm.notes || undefined,
        items: itemsPayload,
      });

      notifications.show({
        title: "Stock Received",
        message: "Purchase order logged and ingredient stock levels updated immediately.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
      setPoModal(false);
      refetchPurchases();
      refetchItems();
      refetchOverview();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message || "Failed to record delivery", color: "red" });
    }
  };

  // Handle Save Supplier
  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      notifications.show({ title: "Name Required", message: "Supplier name is required", color: "orange" });
      return;
    }
    try {
      if (supplierModal.editing) {
        await updateSupplierMut.mutateAsync({
          id: supplierModal.editing.id,
          data: supplierForm,
        });
        notifications.show({ title: "Supplier Updated", message: "Vendor details saved", color: "green", icon: <IconCheck size={16} /> });
      } else {
        await createSupplierMut.mutateAsync(supplierForm);
        notifications.show({ title: "Supplier Added", message: "New vendor registered", color: "green", icon: <IconCheck size={16} /> });
      }
      setSupplierModal({ open: false, editing: null });
      refetchSuppliers();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message || "Failed to save supplier", color: "red" });
    }
  };

  return (
    <Box>
      {/* Master Enable/Disable Switch Card */}
      <Paper p="md" radius="md" mb="md" withBorder>
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              size={44}
              radius="md"
              variant="light"
              color={isInventoryEnabled ? "teal" : "gray"}
            >
              <IconPackages size={24} />
            </ThemeIcon>
            <div>
              <Group gap="xs" align="center">
                <Text fw={700} size="md">
                  Inventory & Recipe (BOM) System
                </Text>
                <Badge
                  color={isInventoryEnabled ? "teal" : "gray"}
                  variant="filled"
                  size="sm"
                >
                  {isInventoryEnabled ? "Active & Tracking" : "Optional / Disabled"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {isInventoryEnabled
                  ? "Orders deduct raw materials automatically based on dish recipes. Real-time food cost and margin tracking active."
                  : "Inventory is optional. When disabled, orders pass through with zero stock overhead and POS is never blocked."}
              </Text>
            </div>
          </Group>

          <Group gap="sm">
            <Switch
              size="md"
              color="teal"
              checked={isInventoryEnabled}
              disabled={updateSettingsMut.isPending}
              onChange={(e) => handleToggleInventory(e.currentTarget.checked)}
              label={
                <Text size="sm" fw={600}>
                  {isInventoryEnabled ? "Tracking Stock" : "Enable Inventory"}
                </Text>
              }
            />
          </Group>
        </Group>
      </Paper>

      {/* When Inventory is Disabled: Educational Feature Card */}
      {!isInventoryEnabled && (
        <Paper p="xl" radius="md" mb="md" withBorder bg="var(--mantine-color-gray-0)">
          <Stack align="center" gap="md" py="lg">
            <ThemeIcon size={56} radius="xl" color="teal" variant="light">
              <IconSparkles size={32} />
            </ThemeIcon>
            <Title order={3} ta="center">
              Real-Time Raw Material & Food Cost Management
            </Title>
            <Text size="sm" c="dimmed" ta="center" maw={640}>
              LogixDine's Inventory module connects your menu dishes to raw ingredients via Bill of
              Materials (BOM). Deduct stock automatically on orders, prevent stockouts, eliminate
              kitchen waste, and know your true gross margins.
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="md" w="100%" maw={800}>
              <Paper p="md" radius="md" withBorder bg="white">
                <ThemeIcon color="blue" variant="light" size={32} radius="md" mb="xs">
                  <IconPackages size={18} />
                </ThemeIcon>
                <Text fw={600} size="sm">
                  1. Raw Materials Registry
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Track Paneer, Chicken, Spices, Dairy, and Packaging with UOM, unit cost, and low-stock alerts.
                </Text>
              </Paper>

              <Paper p="md" radius="md" withBorder bg="white">
                <ThemeIcon color="teal" variant="light" size={32} radius="md" mb="xs">
                  <IconChefHat size={18} />
                </ThemeIcon>
                <Text fw={600} size="sm">
                  2. Recipe (BOM) Builder
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Map ingredients to menu items with prep loss factor to calculate exact food cost % and profit margins.
                </Text>
              </Paper>

              <Paper p="md" radius="md" withBorder bg="white">
                <ThemeIcon color="orange" variant="light" size={32} radius="md" mb="xs">
                  <IconTruckDelivery size={18} />
                </ThemeIcon>
                <Text fw={600} size="sm">
                  3. Inward Deliveries & Waste
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  Stock in vendor deliveries in one click (GRN) and log prep waste or spoilage to keep audits 100% accurate.
                </Text>
              </Paper>
            </SimpleGrid>

            <Button
              size="md"
              color="teal"
              leftSection={<IconCheck size={18} />}
              onClick={() => handleToggleInventory(true)}
              loading={updateSettingsMut.isPending}
              mt="md"
            >
              Activate Inventory Module Now
            </Button>
          </Stack>
        </Paper>
      )}

      {/* KPI Overview Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="md">
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Total Stock Value
              </Text>
              <Text fw={700} size="xl" mt={4}>
                ₹{((overview?.totalStockValuePaise || 0) / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </div>
            <ThemeIcon color="teal" variant="light" size={36} radius="md">
              <IconPackages size={20} />
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Valuation across all registered raw materials
          </Text>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Low Stock Alert
              </Text>
              <Group gap="xs" mt={4} align="baseline">
                <Text
                  fw={700}
                  size="xl"
                  c={overview?.lowStockCount ? "red" : "teal"}
                >
                  {overview?.lowStockCount || 0}
                </Text>
                <Text size="xs" c="dimmed">
                  items critical
                </Text>
              </Group>
            </div>
            <ThemeIcon
              color={overview?.lowStockCount ? "red" : "teal"}
              variant="light"
              size={36}
              radius="md"
            >
              {overview?.lowStockCount ? (
                <IconAlertTriangle size={20} />
              ) : (
                <IconCircleCheck size={20} />
              )}
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {overview?.lowStockCount
              ? "Items at or below reorder threshold"
              : "All stock levels currently healthy"}
          </Text>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Raw Ingredients
              </Text>
              <Text fw={700} size="xl" mt={4}>
                {overview?.totalItemsCount || items.length}
              </Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={36} radius="md">
              <IconBuildingStore size={20} />
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Active ingredients tracked in catalog
          </Text>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Today's Usage & Waste
              </Text>
              <Text fw={700} size="xl" mt={4}>
                ₹{(((overview?.todayConsumptionPaise || 0) + (overview?.todayWastagePaise || 0)) / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={36} radius="md">
              <IconChefHat size={20} />
            </ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            ₹{((overview?.todayWastagePaise || 0) / 100).toFixed(0)} logged as spoilage/waste
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Main Tabs Navigation */}
      <Tabs value={activeSubTab} onChange={(v) => v && setActiveSubTab(v)}>
        <Tabs.List mb="md">
          <Tabs.Tab value="items" leftSection={<IconPackages size={16} />}>
            Ingredients & Stock ({items.length})
          </Tabs.Tab>
          <Tabs.Tab value="recipes" leftSection={<IconChefHat size={16} />}>
            Recipes & Food Cost ({recipes.filter((r) => r.hasRecipe).length}/{recipes.length})
          </Tabs.Tab>
          <Tabs.Tab value="purchases" leftSection={<IconTruckDelivery size={16} />}>
            Purchases & Deliveries ({purchaseOrders.length})
          </Tabs.Tab>
          <Tabs.Tab value="wastage" leftSection={<IconTrash size={16} />}>
            Wastage & Spoilage
          </Tabs.Tab>
          <Tabs.Tab value="ledger" leftSection={<IconReceipt size={16} />}>
            Movement Ledger
          </Tabs.Tab>
          <Tabs.Tab value="suppliers" leftSection={<IconBuildingStore size={16} />}>
            Suppliers ({suppliers.length})
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
            Settings
          </Tabs.Tab>
        </Tabs.List>

        {/* ─── TAB 1: INGREDIENTS & STOCK ────────────────────────────────────────── */}
        <Tabs.Panel value="items">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <Group gap="xs" wrap="wrap">
                <TextInput
                  placeholder="Search raw material or SKU..."
                  leftSection={<IconSearch size={16} />}
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  style={{ minWidth: 240 }}
                  size="sm"
                />
                <Select
                  placeholder="Category"
                  data={["ALL", ...INVENTORY_CATEGORIES].map((c) => ({
                    value: c,
                    label: c === "ALL" ? "All Categories" : c,
                  }))}
                  value={itemCategoryFilter}
                  onChange={(v) => v && setItemCategoryFilter(v)}
                  size="sm"
                  style={{ width: 160 }}
                />
                <Switch
                  label="Low stock only"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.currentTarget.checked)}
                  size="sm"
                />
              </Group>

              <Group gap="xs">
                <Button
                  variant="light"
                  color="orange"
                  size="sm"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => {
                    setWastageForm({
                      ingredientId: items[0]?.id || "",
                      quantity: 1,
                      reason: WASTAGE_REASONS[0],
                    });
                    setWastageModal({ open: true, item: null });
                  }}
                >
                  Log Wastage
                </Button>
                <Button
                  color="teal"
                  size="sm"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    setItemForm({
                      name: "",
                      sku: "",
                      category: "Produce",
                      baseUom: "kg",
                      costPerBaseUnit: 100,
                      currentStock: 10,
                      lowStockThreshold: 5,
                      supplierId: suppliers[0]?.id || "",
                    });
                    setItemModal({ open: true, editing: null });
                  }}
                >
                  Add Ingredient
                </Button>
              </Group>
            </Group>

            {itemsLoading ? (
              <Box py={40} ta="center">
                <Loader color="teal" />
              </Box>
            ) : filteredItems.length === 0 ? (
              <Box py={40} ta="center">
                <Text size="sm" c="dimmed">
                  No ingredients found matching your search. Click "Add Ingredient" to register raw materials.
                </Text>
              </Box>
            ) : (
              <Table.ScrollContainer minWidth={700}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Ingredient</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Unit Cost</Table.Th>
                      <Table.Th>Current Stock</Table.Th>
                      <Table.Th>Reorder Level</Table.Th>
                      <Table.Th>Stock Value</Table.Th>
                      <Table.Th ta="right">Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredItems.map((item) => {
                      const isLow =
                        item.lowStockThreshold &&
                        item.lowStockThreshold > 0 &&
                        item.currentStock <= item.lowStockThreshold;
                      const isOutOfStock = item.currentStock <= 0;
                      const stockVal = item.currentStock * (item.costPerBaseUnitPaise / 100);

                      return (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Text fw={600} size="sm">
                              {item.name}
                            </Text>
                            {item.sku && (
                              <Text size="xs" c="dimmed">
                                SKU: {item.sku}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="blue" size="sm">
                              {item.category}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              ₹{(item.costPerBaseUnitPaise / 100).toFixed(2)} / {item.baseUom}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" align="center">
                              <Text
                                fw={700}
                                size="sm"
                                c={isOutOfStock ? "red" : isLow ? "orange" : undefined}
                              >
                                {item.currentStock} {item.baseUom}
                              </Text>
                              {isOutOfStock ? (
                                <Badge color="red" size="xs" variant="filled">
                                  Out of Stock
                                </Badge>
                              ) : isLow ? (
                                <Badge color="orange" size="xs" variant="light">
                                  Low Stock
                                </Badge>
                              ) : null}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {item.lowStockThreshold ? `${item.lowStockThreshold} ${item.baseUom}` : "—"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              ₹{stockVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Group gap={6} justify="flex-end" wrap="nowrap">
                              <Tooltip label="Quick Audit / Adjust Stock">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  size="sm"
                                  onClick={() => {
                                    setAdjustForm({
                                      newStock: item.currentStock,
                                      reason: ADJUST_REASONS[0],
                                      note: "",
                                    });
                                    setAdjustModal({ open: true, item });
                                  }}
                                >
                                  <IconAdjustmentsHorizontal size={14} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Log Wastage / Spoilage">
                                <ActionIcon
                                  variant="light"
                                  color="orange"
                                  size="sm"
                                  onClick={() => {
                                    setWastageForm({
                                      ingredientId: item.id,
                                      quantity: 1,
                                      reason: WASTAGE_REASONS[0],
                                    });
                                    setWastageModal({ open: true, item });
                                  }}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Edit Details">
                                <ActionIcon
                                  variant="light"
                                  color="gray"
                                  size="sm"
                                  onClick={() => {
                                    setItemForm({
                                      name: item.name,
                                      sku: item.sku || "",
                                      category: item.category,
                                      baseUom: item.baseUom,
                                      costPerBaseUnit: item.costPerBaseUnitPaise / 100,
                                      currentStock: item.currentStock,
                                      lowStockThreshold: item.lowStockThreshold || 0,
                                      supplierId: item.supplierId || "",
                                    });
                                    setItemModal({ open: true, editing: item });
                                  }}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ─── TAB 2: RECIPES & FOOD COST (BOM) ──────────────────────────────────── */}
        <Tabs.Panel value="recipes">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <Group gap="xs" wrap="wrap">
                <TextInput
                  placeholder="Search dish or category..."
                  leftSection={<IconSearch size={16} />}
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  style={{ minWidth: 240 }}
                  size="sm"
                />
                <Select
                  data={[
                    { value: "ALL", label: "All Menu Dishes" },
                    { value: "CONFIGURED", label: "Recipes Configured" },
                    { value: "MISSING", label: "Missing Recipe" },
                  ]}
                  value={recipeFilter}
                  onChange={(v) => v && setRecipeFilter(v as any)}
                  size="sm"
                  style={{ width: 180 }}
                />
              </Group>

              <Text size="xs" c="dimmed">
                Showing {filteredRecipes.length} dishes
              </Text>
            </Group>

            {recipesLoading ? (
              <Box py={40} ta="center">
                <Loader color="teal" />
              </Box>
            ) : filteredRecipes.length === 0 ? (
              <Box py={40} ta="center">
                <Text size="sm" c="dimmed">
                  No dishes found. Add menu items in Menu Catalog first.
                </Text>
              </Box>
            ) : (
              <Table.ScrollContainer minWidth={750}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Dish & Category</Table.Th>
                      <Table.Th>Selling Price</Table.Th>
                      <Table.Th>Recipe Cost (BOM)</Table.Th>
                      <Table.Th>Food Cost %</Table.Th>
                      <Table.Th>Gross Margin</Table.Th>
                      <Table.Th>Recipe Status</Table.Th>
                      <Table.Th ta="right">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredRecipes.map((dish) => {
                      const costRupees = dish.totalCostPaise / 100;
                      const priceRupees = dish.pricePaise / 100;
                      const fcPercent = dish.foodCostPercent || 0;
                      const marginPercent = dish.grossMarginPercent || 0;

                      return (
                        <Table.Tr key={dish.id}>
                          <Table.Td>
                            <Text fw={600} size="sm">
                              {dish.name}
                            </Text>
                            <Badge size="xs" variant="dot" color="teal">
                              {dish.categoryName || "General"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600} size="sm">
                              ₹{priceRupees.toFixed(2)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {dish.hasRecipe ? (
                              <Text fw={600} size="sm" c="dimmed">
                                ₹{costRupees.toFixed(2)}
                              </Text>
                            ) : (
                              <Text size="xs" c="dimmed">
                                Not configured
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {dish.hasRecipe ? (
                              <Badge
                                size="sm"
                                color={
                                  fcPercent < 28
                                    ? "teal"
                                    : fcPercent <= 36
                                    ? "yellow"
                                    : "red"
                                }
                                variant="light"
                              >
                                {fcPercent.toFixed(1)}%
                              </Badge>
                            ) : (
                              <Text size="xs" c="dimmed">
                                —
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {dish.hasRecipe ? (
                              <Badge size="sm" color="blue" variant="outline">
                                {marginPercent.toFixed(1)}% Margin
                              </Badge>
                            ) : (
                              <Text size="xs" c="dimmed">
                                —
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {dish.hasRecipe ? (
                              <Badge color="green" size="sm" variant="filled">
                                {dish.ingredientCount} Ingredients
                              </Badge>
                            ) : (
                              <Badge color="gray" size="sm" variant="outline">
                                No Recipe
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td ta="right">
                            <Button
                              variant="light"
                              color="teal"
                              size="xs"
                              leftSection={<IconChefHat size={14} />}
                              onClick={() => {
                                setRecipeModal({ open: true, dish });
                              }}
                            >
                              {dish.hasRecipe ? "Edit Recipe" : "Build Recipe"}
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ─── TAB 3: PURCHASES & STOCK IN (GRN) ─────────────────────────────────── */}
        <Tabs.Panel value="purchases">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <div>
                <Title order={4}>Purchases & Vendor Inward (GRN)</Title>
                <Text size="xs" c="dimmed">
                  Record raw material deliveries from suppliers. Automatically increments stock and logs purchase audit.
                </Text>
              </div>

              <Button
                color="teal"
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setPoForm({
                    supplierId: suppliers[0]?.id || "",
                    poNumber: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
                      100 + Math.random() * 900
                    )}`,
                    invoiceNumber: "",
                    invoiceDate: new Date().toISOString().slice(0, 10),
                    notes: "",
                    items: [
                      {
                        ingredientId: items[0]?.id || "",
                        quantity: 10,
                        unitCost: items[0] ? items[0].costPerBaseUnitPaise / 100 : 100,
                      },
                    ],
                  });
                  setPoModal(true);
                }}
              >
                Record Stock In (GRN)
              </Button>
            </Group>

            {purchasesLoading ? (
              <Box py={40} ta="center">
                <Loader color="teal" />
              </Box>
            ) : purchaseOrders.length === 0 ? (
              <Box py={40} ta="center">
                <Text size="sm" c="dimmed">
                  No inward deliveries logged yet. Click "Record Stock In (GRN)" when vendor supplies arrive.
                </Text>
              </Box>
            ) : (
              <Table.ScrollContainer minWidth={700}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>PO / Reference</Table.Th>
                      <Table.Th>Supplier</Table.Th>
                      <Table.Th>Invoice #</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Total Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Received By</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {purchaseOrders.map((po) => (
                      <Table.Tr key={po.id}>
                        <Table.Td>
                          <Text fw={600} size="sm">
                            {po.poNumber}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{po.supplierName || "Direct Vendor"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {po.invoiceNumber || "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {po.receivedAt
                              ? new Date(po.receivedAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : new Date(po.createdAt).toLocaleDateString("en-IN")}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={700} size="sm" c="teal">
                            ₹{(po.totalAmountPaise / 100).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="green" size="sm" variant="filled">
                            {po.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {po.createdBy || "Staff"}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ─── TAB 4: WASTAGE & SPOILAGE ─────────────────────────────────────────── */}
        <Tabs.Panel value="wastage">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <div>
                <Title order={4}>Kitchen Wastage & Spoilage Log</Title>
                <Text size="xs" c="dimmed">
                  Track prep trimming loss, burnt food, dropped items, and expired dairy. Keeps inventory balances audit-ready.
                </Text>
              </div>

              <Button
                color="orange"
                size="sm"
                leftSection={<IconTrash size={16} />}
                onClick={() => {
                  setWastageForm({
                    ingredientId: items[0]?.id || "",
                    quantity: 1,
                    reason: WASTAGE_REASONS[0],
                  });
                  setWastageModal({ open: true, item: null });
                }}
              >
                Log Kitchen Wastage
              </Button>
            </Group>

            {/* Filter transactions for type WASTAGE */}
            {txnsLoading ? (
              <Box py={40} ta="center">
                <Loader color="teal" />
              </Box>
            ) : (
              (() => {
                const wasteTxns = transactions.filter((t) => t.type === "WASTAGE");
                if (wasteTxns.length === 0) {
                  return (
                    <Box py={40} ta="center">
                      <Text size="sm" c="dimmed">
                        No wastage recorded. Excellent kitchen control!
                      </Text>
                    </Box>
                  );
                }
                return (
                  <Table.ScrollContainer minWidth={650}>
                    <Table verticalSpacing="sm" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Date & Time</Table.Th>
                          <Table.Th>Raw Material</Table.Th>
                          <Table.Th>Quantity Wasted</Table.Th>
                          <Table.Th>Stock Balance</Table.Th>
                          <Table.Th>Reason / Cause</Table.Th>
                          <Table.Th>Logged By</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {wasteTxns.map((t) => (
                          <Table.Tr key={t.id}>
                            <Table.Td>
                              <Text size="xs">
                                {new Date(t.createdAt).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={600} size="sm">
                                {t.ingredientName || "Ingredient"}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color="red" variant="light" size="sm">
                                -{Math.abs(t.quantity)} {t.baseUom}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {t.balanceAfter} {t.baseUom}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{t.referenceNote || "Kitchen waste"}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {t.createdBy || "Staff"}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                );
              })()
            )}
          </Paper>
        </Tabs.Panel>

        {/* ─── TAB 5: MOVEMENT LEDGER ────────────────────────────────────────────── */}
        <Tabs.Panel value="ledger">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <div>
                <Title order={4}>Stock Movement Ledger (Audit Trail)</Title>
                <Text size="xs" c="dimmed">
                  Chronological transaction log of every inward, order deduction, waste, and stock count correction.
                </Text>
              </div>

              <Select
                placeholder="Filter by Type"
                data={[
                  { value: "ALL", label: "All Movements" },
                  { value: "INWARD", label: "Inward Deliveries" },
                  { value: "ORDER_DEDUCT", label: "Order Deductions" },
                  { value: "WASTAGE", label: "Wastage & Spoilage" },
                  { value: "ADJUSTMENT", label: "Manual Adjustments" },
                  { value: "CANCEL_RETURN", label: "Order Cancellations" },
                ]}
                value={txnTypeFilter}
                onChange={(v) => v && setTxnTypeFilter(v)}
                size="sm"
                style={{ width: 180 }}
              />
            </Group>

            {txnsLoading ? (
              <Box py={40} ta="center">
                <Loader color="teal" />
              </Box>
            ) : transactions.length === 0 ? (
              <Box py={40} ta="center">
                <Text size="sm" c="dimmed">
                  No movement transactions recorded yet.
                </Text>
              </Box>
            ) : (
              <Table.ScrollContainer minWidth={750}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Timestamp</Table.Th>
                      <Table.Th>Ingredient</Table.Th>
                      <Table.Th>Movement Type</Table.Th>
                      <Table.Th>Qty Delta</Table.Th>
                      <Table.Th>Balance After</Table.Th>
                      <Table.Th>Reference / Note</Table.Th>
                      <Table.Th>Actor</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {transactions.map((tx) => {
                      const isPositive = tx.quantity > 0;
                      return (
                        <Table.Tr key={tx.id}>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {new Date(tx.createdAt).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600} size="sm">
                              {tx.ingredientName || "Ingredient"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              variant="filled"
                              color={
                                tx.type === "INWARD"
                                  ? "teal"
                                  : tx.type === "ORDER_DEDUCT"
                                  ? "blue"
                                  : tx.type === "WASTAGE"
                                  ? "orange"
                                  : tx.type === "CANCEL_RETURN"
                                  ? "cyan"
                                  : "gray"
                              }
                            >
                              {tx.type}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} align="center">
                              {isPositive ? (
                                <IconArrowUpRight size={14} color="var(--mantine-color-teal-6)" />
                              ) : (
                                <IconArrowDownRight size={14} color="var(--mantine-color-red-6)" />
                              )}
                              <Text
                                size="sm"
                                fw={700}
                                c={isPositive ? "teal" : "red"}
                              >
                                {isPositive ? `+${tx.quantity}` : tx.quantity} {tx.baseUom}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {tx.balanceAfter} {tx.baseUom}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {tx.referenceNote || "—"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {tx.createdBy || "System"}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ─── TAB 6: SUPPLIERS REGISTRY ─────────────────────────────────────────── */}
        <Tabs.Panel value="suppliers">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
              <div>
                <Title order={4}>Raw Material Suppliers & Vendors</Title>
                <Text size="xs" c="dimmed">
                  Manage vendor contacts, GSTIN numbers, and standard payment terms for stock deliveries.
                </Text>
              </div>

              <Button
                color="teal"
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setSupplierForm({
                    name: "",
                    contactPerson: "",
                    phone: "",
                    email: "",
                    gstin: "",
                    address: "",
                    paymentTerms: "Net 15 Days",
                  });
                  setSupplierModal({ open: true, editing: null });
                }}
              >
                Add Supplier
              </Button>
            </Group>

            {suppliers.length === 0 ? (
              <Box py={40} ta="center">
                <Text size="sm" c="dimmed">
                  No suppliers registered yet. Click "Add Supplier" to add wholesale vendors.
                </Text>
              </Box>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {suppliers.map((sup) => (
                  <Paper key={sup.id} p="md" radius="md" withBorder>
                    <Group justify="space-between" align="flex-start" mb="xs">
                      <div>
                        <Text fw={700} size="md">
                          {sup.name}
                        </Text>
                        {sup.contactPerson && (
                          <Text size="xs" c="dimmed">
                            Contact: {sup.contactPerson}
                          </Text>
                        )}
                      </div>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => {
                          setSupplierForm({
                            name: sup.name,
                            contactPerson: sup.contactPerson || "",
                            phone: sup.phone || "",
                            email: sup.email || "",
                            gstin: sup.gstin || "",
                            address: sup.address || "",
                            paymentTerms: sup.paymentTerms || "Net 15 Days",
                          });
                          setSupplierModal({ open: true, editing: sup });
                        }}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Group>

                    <Stack gap={4} mt="xs">
                      {sup.phone && (
                        <Text size="xs">
                          <b>Phone:</b> {sup.phone}
                        </Text>
                      )}
                      {sup.gstin && (
                        <Text size="xs">
                          <b>GSTIN:</b> {sup.gstin}
                        </Text>
                      )}
                      {sup.paymentTerms && (
                        <Badge size="xs" color="gray" variant="light">
                          {sup.paymentTerms}
                        </Badge>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
            )}
          </Paper>
        </Tabs.Panel>

        {/* ─── TAB 7: SETTINGS ───────────────────────────────────────────────────── */}
        <Tabs.Panel value="settings">
          <Paper p="md" radius="md" withBorder>
            <Title order={4} mb="xs">
              Inventory & Deduction Rules
            </Title>
            <Text size="xs" c="dimmed" mb="lg">
              Fine-tune how stock deductions interact with kitchen workflow and POS rush hours.
            </Text>

            <Stack gap="lg" maw={640}>
              <Paper p="md" radius="md" withBorder bg="var(--mantine-color-gray-0)">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600} size="sm">
                      Allow Negative Stock (Rush Protection)
                    </Text>
                    <Text size="xs" c="dimmed">
                      When enabled, orders will NEVER be blocked or rejected during busy lunch/dinner rush
                      even if deliveries haven't been physically entered yet.
                    </Text>
                  </div>
                  <Switch
                    checked={overview?.inventorySettings?.allowNegativeStock ?? true}
                    onChange={(e) =>
                      updateSettingsMut.mutate({
                        allowNegativeStock: e.currentTarget.checked,
                      })
                    }
                    color="teal"
                  />
                </Group>
              </Paper>

              <Paper p="md" radius="md" withBorder bg="var(--mantine-color-gray-0)">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600} size="sm">
                      Automatic Deduction Point
                    </Text>
                    <Text size="xs" c="dimmed">
                      Choose when inventory ingredients are deducted from your balance.
                    </Text>
                  </div>
                  <Select
                    data={[
                      { value: "ON_ORDER", label: "On KOT Send (Real-time)" },
                      { value: "ON_SETTLE", label: "On Bill Settlement" },
                      { value: "MANUAL", label: "Manual Audit Only" },
                    ]}
                    value={overview?.inventorySettings?.autoDeductOn ?? "ON_ORDER"}
                    onChange={(val) => {
                      if (val) {
                        updateSettingsMut.mutate({
                          autoDeductOn: val as any,
                        });
                      }
                    }}
                    style={{ width: 200 }}
                  />
                </Group>
              </Paper>

              <Paper p="md" radius="md" withBorder bg="var(--mantine-color-gray-0)">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600} size="sm">
                      Low Stock Alerts
                    </Text>
                    <Text size="xs" c="dimmed">
                      Highlight ingredients and trigger warnings when stock dips below threshold.
                    </Text>
                  </div>
                  <Switch
                    checked={overview?.inventorySettings?.lowStockAlerts ?? true}
                    onChange={(e) =>
                      updateSettingsMut.mutate({
                        lowStockAlerts: e.currentTarget.checked,
                      })
                    }
                    color="teal"
                  />
                </Group>
              </Paper>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* ─── MODAL 1: ADD / EDIT INGREDIENT ───────────────────────────────────────── */}
      <Modal
        opened={itemModal.open}
        onClose={() => setItemModal({ open: false, editing: null })}
        title={itemModal.editing ? "Edit Raw Material" : "Add New Raw Material"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Ingredient Name"
            placeholder="e.g. Basmati Rice, Boneless Chicken, Amul Butter"
            required
            value={itemForm.name}
            onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
          />

          <Grid gap="xs">
            <Grid.Col span={6}>
              <Select
                label="Category"
                data={INVENTORY_CATEGORIES}
                required
                value={itemForm.category}
                onChange={(v) => v && setItemForm((f) => ({ ...f, category: v }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Base Unit of Measure (UOM)"
                data={UOM_OPTIONS}
                required
                value={itemForm.baseUom}
                onChange={(v) => v && setItemForm((f) => ({ ...f, baseUom: v }))}
              />
            </Grid.Col>
          </Grid>

          <Grid gap="xs">
            <Grid.Col span={6}>
              <NumberInput
                label="Cost Per Base Unit (₹)"
                placeholder="100.00"
                min={0}
                decimalScale={2}
                required
                value={itemForm.costPerBaseUnit}
                onChange={(v) => setItemForm((f) => ({ ...f, costPerBaseUnit: Number(v) || 0 }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="Current Stock"
                placeholder="50"
                decimalScale={3}
                required
                value={itemForm.currentStock}
                onChange={(v) => setItemForm((f) => ({ ...f, currentStock: Number(v) || 0 }))}
              />
            </Grid.Col>
          </Grid>

          <Grid gap="xs">
            <Grid.Col span={6}>
              <NumberInput
                label="Low Stock Alert Threshold"
                placeholder="5"
                decimalScale={2}
                value={itemForm.lowStockThreshold}
                onChange={(v) => setItemForm((f) => ({ ...f, lowStockThreshold: Number(v) || 0 }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="SKU / Barcode (Optional)"
                placeholder="ING-RICE-01"
                value={itemForm.sku}
                onChange={(e) => setItemForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </Grid.Col>
          </Grid>

          <Select
            label="Preferred Supplier (Optional)"
            placeholder="Select vendor"
            data={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            value={itemForm.supplierId}
            onChange={(v) => setItemForm((f) => ({ ...f, supplierId: v || "" }))}
            clearable
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setItemModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleSaveItem}
              loading={createItemMut.isPending || updateItemMut.isPending}
            >
              {itemModal.editing ? "Update Raw Material" : "Save Ingredient"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL 2: QUICK AUDIT / ADJUST STOCK ─────────────────────────────────── */}
      <Modal
        opened={adjustModal.open}
        onClose={() => setAdjustModal({ open: false, item: null })}
        title={`Audit / Adjust Stock: ${adjustModal.item?.name || ""}`}
        size="sm"
      >
        <Stack gap="sm">
          <Paper p="xs" bg="var(--mantine-color-gray-0)" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Current Registered Balance:
              </Text>
              <Text size="sm" fw={700}>
                {adjustModal.item?.currentStock} {adjustModal.item?.baseUom}
              </Text>
            </Group>
          </Paper>

          <NumberInput
            label="New Physical Stock Count"
            description="Enter the actual verified quantity physically present"
            decimalScale={3}
            required
            value={adjustForm.newStock}
            onChange={(v) => setAdjustForm((f) => ({ ...f, newStock: Number(v) || 0 }))}
          />

          {adjustModal.item && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Calculated Variance:
              </Text>
              <Badge
                color={
                  adjustForm.newStock >= adjustModal.item.currentStock ? "teal" : "red"
                }
              >
                {adjustForm.newStock - adjustModal.item.currentStock >= 0 ? "+" : ""}
                {(adjustForm.newStock - adjustModal.item.currentStock).toFixed(3)}{" "}
                {adjustModal.item.baseUom}
              </Badge>
            </Group>
          )}

          <Select
            label="Reason for Adjustment"
            data={ADJUST_REASONS}
            required
            value={adjustForm.reason}
            onChange={(v) => v && setAdjustForm((f) => ({ ...f, reason: v }))}
          />

          <TextInput
            label="Notes / Comments"
            placeholder="Audit notes or recount details..."
            value={adjustForm.note}
            onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setAdjustModal({ open: false, item: null })}>
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleSaveAdjust}
              loading={adjustStockMut.isPending}
            >
              Confirm Adjustment
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL 3: LOG WASTAGE ─────────────────────────────────────────────────── */}
      <Modal
        opened={wastageModal.open}
        onClose={() => setWastageModal({ open: false, item: null })}
        title="Record Kitchen Wastage / Loss"
        size="sm"
      >
        <Stack gap="sm">
          <Select
            label="Ingredient"
            placeholder="Select raw material"
            data={items.map((i) => ({
              value: i.id,
              label: `${i.name} (${i.currentStock} ${i.baseUom} available)`,
            }))}
            required
            value={wastageForm.ingredientId}
            onChange={(v) => v && setWastageForm((f) => ({ ...f, ingredientId: v }))}
          />

          <NumberInput
            label="Quantity Wasted"
            description="Quantity to deduct from stock balance"
            min={0.001}
            decimalScale={3}
            required
            value={wastageForm.quantity}
            onChange={(v) => setWastageForm((f) => ({ ...f, quantity: Number(v) || 0 }))}
          />

          <Select
            label="Reason / Cause"
            data={WASTAGE_REASONS}
            required
            value={wastageForm.reason}
            onChange={(v) => v && setWastageForm((f) => ({ ...f, reason: v }))}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setWastageModal({ open: false, item: null })}>
              Cancel
            </Button>
            <Button
              color="orange"
              onClick={handleSaveWastage}
              loading={logWastageMut.isPending}
            >
              Record Wastage
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL 4: RECIPE BUILDER (BOM) ────────────────────────────────────────── */}
      <Modal
        opened={recipeModal.open}
        onClose={() => setRecipeModal({ open: false, dish: null })}
        title={`Recipe & Food Cost (BOM): ${recipeModal.dish?.name || ""}`}
        size="lg"
      >
        <Stack gap="md">
          {recipeDetailLoading ? (
            <Box py={40} ta="center">
              <Loader color="teal" />
            </Box>
          ) : (
            <>
              {/* Dish Selling Price & Cost Summary Header */}
              <Paper p="sm" radius="md" bg="var(--mantine-color-gray-0)" withBorder>
                <Grid align="center">
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">
                      Selling Price (MRP):
                    </Text>
                    <Text fw={700} size="md">
                      ₹{recipeCostCalculations.sellingPrice.toFixed(2)}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">
                      Total Ingredient Cost:
                    </Text>
                    <Text fw={700} size="md" c="teal">
                      ₹{recipeCostCalculations.totalCost.toFixed(2)}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">
                      Food Cost %:
                    </Text>
                    <Badge
                      color={
                        recipeCostCalculations.foodCostPercent < 28
                          ? "teal"
                          : recipeCostCalculations.foodCostPercent <= 36
                          ? "yellow"
                          : "red"
                      }
                      size="md"
                    >
                      {recipeCostCalculations.foodCostPercent.toFixed(1)}% (
                      {recipeCostCalculations.grossMarginPercent.toFixed(1)}% Margin)
                    </Badge>
                  </Grid.Col>
                </Grid>
              </Paper>

              <Text size="sm" fw={600}>
                Recipe Ingredients (Portion Size for 1 Serving):
              </Text>

              {recipeIngredients.length === 0 ? (
                <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                  No ingredients added yet. Add raw materials below to automatically deduct stock on
                  order.
                </Alert>
              ) : (
                <Stack gap="xs">
                  {recipeCostCalculations.lines.map((row, idx) => (
                    <Paper key={idx} p="xs" radius="sm" withBorder>
                      <Grid align="center" gap="xs">
                        <Grid.Col span={{ base: 12, sm: 5 }}>
                          <Select
                            placeholder="Select raw material"
                            data={items.map((i) => ({
                              value: i.id,
                              label: `${i.name} (₹${(i.costPerBaseUnitPaise / 100).toFixed(2)}/${i.baseUom})`,
                            }))}
                            value={row.ingredientId}
                            onChange={(v) => {
                              const next = [...recipeIngredients];
                              next[idx] = { ...next[idx], ingredientId: v || "" };
                              setRecipeIngredients(next);
                            }}
                            size="xs"
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 5, sm: 3 }}>
                          <NumberInput
                            placeholder="Qty"
                            description={`In ${row.uom}`}
                            min={0.001}
                            decimalScale={3}
                            value={row.quantity}
                            onChange={(val) => {
                              const next = [...recipeIngredients];
                              next[idx] = { ...next[idx], quantity: Number(val) || 0 };
                              setRecipeIngredients(next);
                            }}
                            size="xs"
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 4, sm: 2 }}>
                          <NumberInput
                            placeholder="Loss %"
                            description="Waste %"
                            min={0}
                            max={100}
                            value={row.wastePercent}
                            onChange={(val) => {
                              const next = [...recipeIngredients];
                              next[idx] = { ...next[idx], wastePercent: Number(val) || 0 };
                              setRecipeIngredients(next);
                            }}
                            size="xs"
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 3, sm: 2 }}>
                          <Group justify="space-between" align="center" wrap="nowrap">
                            <Text size="xs" fw={600}>
                              ₹{row.lineCost.toFixed(2)}
                            </Text>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              size="sm"
                              onClick={() => {
                                setRecipeIngredients(
                                  recipeIngredients.filter((_, i) => i !== idx)
                                );
                              }}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Grid.Col>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              )}

              <Button
                variant="light"
                color="teal"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setRecipeIngredients([
                    ...recipeIngredients,
                    {
                      ingredientId: items[0]?.id || "",
                      quantity: 0.1,
                      wastePercent: 0,
                    },
                  ]);
                }}
              >
                Add Raw Material
              </Button>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="default"
                  onClick={() => setRecipeModal({ open: false, dish: null })}
                >
                  Cancel
                </Button>
                <Button
                  color="teal"
                  onClick={handleSaveRecipe}
                  loading={saveRecipeMut.isPending}
                >
                  Save Recipe (BOM)
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* ─── MODAL 5: RECORD INWARD / PURCHASE ORDER (GRN) ─────────────────────────── */}
      <Modal
        opened={poModal}
        onClose={() => setPoModal(false)}
        title="Record Stock Inward Delivery (GRN)"
        size="lg"
      >
        <Stack gap="sm">
          <Grid gap="xs">
            <Grid.Col span={6}>
              <Select
                label="Supplier / Vendor"
                placeholder="Select vendor"
                data={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                value={poForm.supplierId}
                onChange={(v) => setPoForm((f) => ({ ...f, supplierId: v || "" }))}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="PO / Ref Number"
                required
                value={poForm.poNumber}
                onChange={(e) => setPoForm((f) => ({ ...f, poNumber: e.target.value }))}
              />
            </Grid.Col>
          </Grid>

          <Grid gap="xs">
            <Grid.Col span={6}>
              <TextInput
                label="Vendor Invoice # (Optional)"
                placeholder="INV-9921"
                value={poForm.invoiceNumber}
                onChange={(e) => setPoForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Invoice Date"
                type="date"
                value={poForm.invoiceDate}
                onChange={(e) => setPoForm((f) => ({ ...f, invoiceDate: e.target.value }))}
              />
            </Grid.Col>
          </Grid>

          <Divider my="xs" label="Delivered Line Items" labelPosition="center" />

          <Stack gap="xs">
            {poForm.items.map((line, idx) => {
              const ing = items.find((i) => i.id === line.ingredientId);
              const lineTotal = (line.quantity || 0) * (line.unitCost || 0);

              return (
                <Paper key={idx} p="xs" radius="sm" withBorder>
                  <Grid align="center" gap="xs">
                    <Grid.Col span={{ base: 12, sm: 5 }}>
                      <Select
                        placeholder="Raw Material"
                        data={items.map((i) => ({
                          value: i.id,
                          label: `${i.name} (${i.baseUom})`,
                        }))}
                        value={line.ingredientId}
                        onChange={(v) => {
                          const matched = items.find((i) => i.id === v);
                          const next = [...poForm.items];
                          next[idx] = {
                            ...next[idx],
                            ingredientId: v || "",
                            unitCost: matched ? matched.costPerBaseUnitPaise / 100 : next[idx].unitCost,
                          };
                          setPoForm((f) => ({ ...f, items: next }));
                        }}
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 3 }}>
                      <NumberInput
                        placeholder="Qty"
                        description={ing?.baseUom ? `in ${ing.baseUom}` : "Quantity"}
                        min={0.01}
                        decimalScale={3}
                        value={line.quantity}
                        onChange={(val) => {
                          const next = [...poForm.items];
                          next[idx] = { ...next[idx], quantity: Number(val) || 0 };
                          setPoForm((f) => ({ ...f, items: next }));
                        }}
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 6, sm: 2 }}>
                      <NumberInput
                        placeholder="Unit Cost"
                        description="Price per UOM"
                        min={0}
                        decimalScale={2}
                        value={line.unitCost}
                        onChange={(val) => {
                          const next = [...poForm.items];
                          next[idx] = { ...next[idx], unitCost: Number(val) || 0 };
                          setPoForm((f) => ({ ...f, items: next }));
                        }}
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 2 }}>
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Text size="xs" fw={700}>
                          ₹{lineTotal.toFixed(2)}
                        </Text>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="sm"
                          onClick={() => {
                            setPoForm((f) => ({
                              ...f,
                              items: f.items.filter((_, i) => i !== idx),
                            }));
                          }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Grid.Col>
                  </Grid>
                </Paper>
              );
            })}
          </Stack>

          <Button
            variant="light"
            color="teal"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setPoForm((f) => ({
                ...f,
                items: [
                  ...f.items,
                  {
                    ingredientId: items[0]?.id || "",
                    quantity: 10,
                    unitCost: items[0] ? items[0].costPerBaseUnitPaise / 100 : 100,
                  },
                ],
              }));
            }}
          >
            Add Line Item
          </Button>

          <Paper p="xs" bg="var(--mantine-color-gray-0)" radius="md" mt="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                Total Inward Delivery Value:
              </Text>
              <Text fw={700} size="md" c="teal">
                ₹
                {poForm.items
                  .reduce((sum, item) => sum + (item.quantity || 0) * (item.unitCost || 0), 0)
                  .toFixed(2)}
              </Text>
            </Group>
          </Paper>

          <TextInput
            label="Delivery Notes (Optional)"
            placeholder="Challan details, vehicle number, batch expiry..."
            value={poForm.notes}
            onChange={(e) => setPoForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setPoModal(false)}>
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleSavePurchaseOrder}
              loading={createPOMut.isPending}
            >
              Confirm Delivery & Update Stock
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL 6: ADD / EDIT SUPPLIER ─────────────────────────────────────────── */}
      <Modal
        opened={supplierModal.open}
        onClose={() => setSupplierModal({ open: false, editing: null })}
        title={supplierModal.editing ? "Edit Supplier" : "Register New Supplier"}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Supplier / Business Name"
            placeholder="e.g. Metro Cash & Carry, Heritage Dairy, Golden Spices"
            required
            value={supplierForm.name}
            onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
          />

          <Grid gap="xs">
            <Grid.Col span={6}>
              <TextInput
                label="Contact Person"
                placeholder="Ramesh Sharma"
                value={supplierForm.contactPerson}
                onChange={(e) => setSupplierForm((f) => ({ ...f, contactPerson: e.target.value }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Phone Number"
                placeholder="9876543210"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Grid.Col>
          </Grid>

          <Grid gap="xs">
            <Grid.Col span={6}>
              <TextInput
                label="Email"
                placeholder="orders@vendor.com"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="GSTIN (Optional)"
                placeholder="29AAAAA0000A1Z5"
                value={supplierForm.gstin}
                onChange={(e) => setSupplierForm((f) => ({ ...f, gstin: e.target.value }))}
              />
            </Grid.Col>
          </Grid>

          <TextInput
            label="Payment Terms"
            placeholder="e.g. Net 15 Days, Cash On Delivery (COD), Advance"
            value={supplierForm.paymentTerms}
            onChange={(e) => setSupplierForm((f) => ({ ...f, paymentTerms: e.target.value }))}
          />

          <TextInput
            label="Address / Depot"
            placeholder="APMC Yard, Wholesale Block B, Bengaluru"
            value={supplierForm.address}
            onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setSupplierModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleSaveSupplier}
              loading={createSupplierMut.isPending || updateSupplierMut.isPending}
            >
              {supplierModal.editing ? "Update Supplier" : "Save Supplier"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
