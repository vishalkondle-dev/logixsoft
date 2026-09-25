"use client";

import React, { useState, useEffect } from "react";
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Switch,
  TextInput,
  Badge,
  Loader,
  Box,
  Divider,
  Grid,
  NumberInput,
  Select,
  SegmentedControl,
  ActionIcon,
  Card,
  SimpleGrid,
  ThemeIcon,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconFileInvoice,
  IconCheck,
  IconPlus,
  IconTrash,
  IconBuildingStore,
  IconReceiptTax,
  IconPercentage,
  IconCurrencyRupee,
  IconInfoCircle,
  IconSparkles,
  IconPrinter,
  IconDiscount2,
  IconQrcode,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useUpdateOutlet } from "@/lib/queries";

// ─── Data Models ─────────────────────────────────────────────────────────────

export interface TaxSlab {
  id: string;
  name: string;
  rate: number; // e.g. 5, 12, 18, 0
  cgstRate: number; // e.g. 2.5
  sgstRate: number; // e.g. 2.5
  isDefault: boolean;
  description?: string;
}

export interface BillAdjustmentRule {
  id: string;
  name: string;
  type: "PERCENTAGE" | "FLAT";
  sign: "ADD" | "SUBTRACT";
  value: number; // percentage (e.g. 5) or flat amount (e.g. 20)
  category: "SERVICE_CHARGE" | "PACKAGING" | "DISCOUNT" | "DELIVERY" | "CUSTOM";
  orderType: "ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  isTaxable: boolean; // whether GST applies on this surcharge
  isActive: boolean;
  autoApply: boolean;
}

export interface InvoiceSettingsConfig {
  legalBusinessName: string;
  tradeName: string;
  gstin: string;
  fssaiNo: string;
  invoicePrefix: string;
  invoiceStartingNo: number;
  footerNote: string;
  showUpiQrOnBill: boolean;
  showTableNo: boolean;
  showFssai: boolean;
  showGstin: boolean;
}

export interface TaxSettingsConfig {
  taxPricingMode: "EXCLUSIVE" | "INCLUSIVE";
  enableGst: boolean;
  roundOffMode: "NEAREST" | "NONE";
  slabs: TaxSlab[];
  adjustments: BillAdjustmentRule[];
}

const DEFAULT_INVOICE_CONFIG: InvoiceSettingsConfig = {
  legalBusinessName: "",
  tradeName: "",
  gstin: "",
  fssaiNo: "",
  invoicePrefix: "INV-",
  invoiceStartingNo: 1001,
  footerNote: "Thank you for dining with us! Please visit again.",
  showUpiQrOnBill: true,
  showTableNo: true,
  showFssai: true,
  showGstin: true,
};

const DEFAULT_TAX_CONFIG: TaxSettingsConfig = {
  taxPricingMode: "EXCLUSIVE",
  enableGst: true,
  roundOffMode: "NEAREST",
  slabs: [
    { id: "slab-5", name: "GST 5% (Restaurant Food)", rate: 5, cgstRate: 2.5, sgstRate: 2.5, isDefault: true, description: "Standard restaurant food & beverages" },
    { id: "slab-12", name: "GST 12% (Bakery & Confectionery)", rate: 12, cgstRate: 6, sgstRate: 6, isDefault: false, description: "Packed snacks, sweets, pastries" },
    { id: "slab-18", name: "GST 18% (Beverages / Ice cream)", rate: 18, cgstRate: 9, sgstRate: 9, isDefault: false, description: "Caffeinated drinks, soft drinks" },
    { id: "slab-0", name: "0% Tax Exempt / MRP", rate: 0, cgstRate: 0, sgstRate: 0, isDefault: false, description: "Bottled water, milk, fresh juices" },
  ],
  adjustments: [
    {
      id: "adj-sc",
      name: "Service Charge",
      type: "PERCENTAGE",
      sign: "ADD",
      value: 5,
      category: "SERVICE_CHARGE",
      orderType: "DINE_IN",
      isTaxable: true,
      isActive: false,
      autoApply: false,
    },
    {
      id: "adj-pack",
      name: "Packaging / Container Charge",
      type: "FLAT",
      sign: "ADD",
      value: 20,
      category: "PACKAGING",
      orderType: "TAKEAWAY",
      isTaxable: false,
      isActive: true,
      autoApply: true,
    },
    {
      id: "adj-disc10",
      name: "Happy Hour / Courtesy Discount",
      type: "PERCENTAGE",
      sign: "SUBTRACT",
      value: 10,
      category: "DISCOUNT",
      orderType: "ALL",
      isTaxable: false,
      isActive: true,
      autoApply: false,
    },
  ],
};

export function InvoiceTaxManagement() {
  const { restaurant, outlets, activeOutlet, refresh } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const updateOutletMut = useUpdateOutlet(restaurantId);

  const [saving, setSaving] = useState(false);
  const [invoiceConfig, setInvoiceConfig] = useState<InvoiceSettingsConfig>(DEFAULT_INVOICE_CONFIG);
  const [taxConfig, setTaxConfig] = useState<TaxSettingsConfig>(DEFAULT_TAX_CONFIG);

  // Modals for adding custom Tax Slab or Rule
  const [slabModalOpen, setSlabModalOpen] = useState(false);
  const [newSlab, setNewSlab] = useState<Omit<TaxSlab, "id">>({
    name: "",
    rate: 5,
    cgstRate: 2.5,
    sgstRate: 2.5,
    isDefault: false,
    description: "",
  });

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [newRule, setNewRule] = useState<Omit<BillAdjustmentRule, "id">>({
    name: "",
    type: "PERCENTAGE",
    sign: "ADD",
    value: 5,
    category: "CUSTOM",
    orderType: "ALL",
    isTaxable: false,
    isActive: true,
    autoApply: false,
  });

  // Load existing settings from currentOutlet
  useEffect(() => {
    if (currentOutlet) {
      // 1. Invoice settings
      if (currentOutlet.invoiceSettings) {
        try {
          const parsedInv = typeof currentOutlet.invoiceSettings === "string"
            ? JSON.parse(currentOutlet.invoiceSettings)
            : currentOutlet.invoiceSettings;
          setInvoiceConfig({ ...DEFAULT_INVOICE_CONFIG, ...parsedInv });
        } catch (e) {
          console.error("Failed to parse invoiceSettings", e);
        }
      } else {
        // Pre-fill trade name with restaurant/outlet name if empty
        setInvoiceConfig((prev) => ({
          ...prev,
          tradeName: currentOutlet.name || restaurant?.name || "",
          legalBusinessName: restaurant?.name || "",
        }));
      }

      // 2. Tax settings
      if (currentOutlet.taxSettings) {
        try {
          const parsedTax = typeof currentOutlet.taxSettings === "string"
            ? JSON.parse(currentOutlet.taxSettings)
            : currentOutlet.taxSettings;
          setTaxConfig({ ...DEFAULT_TAX_CONFIG, ...parsedTax });
        } catch (e) {
          console.error("Failed to parse taxSettings", e);
        }
      }
    }
  }, [currentOutlet?.id, currentOutlet?.invoiceSettings, currentOutlet?.taxSettings]);

  // Save all settings to DB
  const handleSave = async () => {
    if (!currentOutlet?.id) return;
    setSaving(true);
    try {
      await updateOutletMut.mutateAsync({
        id: currentOutlet.id,
        body: {
          invoiceSettings: invoiceConfig,
          taxSettings: taxConfig,
        },
      });
      await refresh();
      notifications.show({
        title: "Saved",
        message: "Invoice and Tax configurations updated successfully",
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Error saving configuration",
        message: err.message || "Failed to update settings",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  // Add new tax slab
  const handleAddSlab = () => {
    if (!newSlab.name.trim()) {
      notifications.show({ title: "Name required", message: "Please provide a slab name", color: "orange" });
      return;
    }
    const slab: TaxSlab = {
      id: `slab-${Date.now()}`,
      ...newSlab,
    };
    setTaxConfig((prev) => ({
      ...prev,
      slabs: [...prev.slabs, slab],
    }));
    setSlabModalOpen(false);
    setNewSlab({ name: "", rate: 5, cgstRate: 2.5, sgstRate: 2.5, isDefault: false, description: "" });
  };

  const handleDeleteSlab = (id: string) => {
    setTaxConfig((prev) => ({
      ...prev,
      slabs: prev.slabs.filter((s) => s.id !== id),
    }));
  };

  // Add new adjustment rule
  const handleAddRule = () => {
    if (!newRule.name.trim()) {
      notifications.show({ title: "Name required", message: "Please enter a rule name", color: "orange" });
      return;
    }
    const rule: BillAdjustmentRule = {
      id: `rule-${Date.now()}`,
      ...newRule,
    };
    setTaxConfig((prev) => ({
      ...prev,
      adjustments: [...prev.adjustments, rule],
    }));
    setRuleModalOpen(false);
    setNewRule({
      name: "",
      type: "PERCENTAGE",
      sign: "ADD",
      value: 5,
      category: "CUSTOM",
      orderType: "ALL",
      isTaxable: false,
      isActive: true,
      autoApply: false,
    });
  };

  const handleDeleteRule = (id: string) => {
    setTaxConfig((prev) => ({
      ...prev,
      adjustments: prev.adjustments.filter((r) => r.id !== id),
    }));
  };

  const handleToggleRule = (id: string) => {
    setTaxConfig((prev) => ({
      ...prev,
      adjustments: prev.adjustments.map((r) =>
        r.id === id ? { ...r, isActive: !r.isActive } : r
      ),
    }));
  };

  // ─── Live Bill Preview Calculations ─────────────────────────────────────────
  const isInclusive = taxConfig.taxPricingMode === "INCLUSIVE";
  const defaultSlab = taxConfig.slabs.find((s) => s.isDefault) || taxConfig.slabs[0] || { rate: 5, cgstRate: 2.5, sgstRate: 2.5 };
  
  // Simulated Cart:
  // Item 1: Special Biryani ₹300
  // Item 2: Garlic Naan (x2) ₹100
  // Subtotal = ₹400
  const sampleSubtotal = 400;

  // Active Adjustments
  const activeSurcharges = taxConfig.adjustments.filter((a) => a.isActive && a.sign === "ADD" && a.autoApply);
  const activeDiscounts = taxConfig.adjustments.filter((a) => a.isActive && a.sign === "SUBTRACT" && a.autoApply);

  // Discount amount
  const discountTotal = activeDiscounts.reduce((sum, d) => {
    return sum + (d.type === "PERCENTAGE" ? (sampleSubtotal * d.value) / 100 : d.value);
  }, 0);

  const netFoodBase = Math.max(0, sampleSubtotal - discountTotal);

  // Surcharges (e.g. Service charge)
  const surchargesTotal = activeSurcharges.reduce((sum, s) => {
    return sum + (s.type === "PERCENTAGE" ? (netFoodBase * s.value) / 100 : s.value);
  }, 0);

  // Tax calculation
  let cgstAmount = 0;
  let sgstAmount = 0;
  let finalTotal = 0;
  let taxableDisplay = 0;

  if (taxConfig.enableGst && defaultSlab.rate > 0) {
    if (isInclusive) {
      // Menu price includes tax
      taxableDisplay = netFoodBase / (1 + defaultSlab.rate / 100);
      cgstAmount = (taxableDisplay * defaultSlab.cgstRate) / 100;
      sgstAmount = (taxableDisplay * defaultSlab.sgstRate) / 100;
      finalTotal = netFoodBase + surchargesTotal;
    } else {
      // Exclusive: add on top
      taxableDisplay = netFoodBase;
      cgstAmount = (taxableDisplay * defaultSlab.cgstRate) / 100;
      sgstAmount = (taxableDisplay * defaultSlab.sgstRate) / 100;
      finalTotal = netFoodBase + surchargesTotal + cgstAmount + sgstAmount;
    }
  } else {
    finalTotal = netFoodBase + surchargesTotal;
  }

  const roundOffDiff = taxConfig.roundOffMode === "NEAREST"
    ? Math.round(finalTotal) - finalTotal
    : 0;
  const payableAmount = finalTotal + roundOffDiff;

  return (
    <Stack gap="lg">
      {/* Header Bar */}
      <Paper p="md" radius="md">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" color="teal" variant="light">
              <IconReceiptTax size={22} />
            </ThemeIcon>
            <div>
              <Group gap="xs" align="center">
                <Text fw={600} size="md">Invoice & Tax Rules</Text>
                {currentOutlet?.isDefault && (
                  <Badge size="xs" variant="light" color="dinePrimary">Default Outlet</Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                Configure GST slabs, inclusive/exclusive pricing, invoice series, and receipt format for this outlet.
              </Text>
            </div>
          </Group>

          <Button
            color="dinePrimary"
            leftSection={<IconCheck size={16} />}
            loading={saving}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Group>
      </Paper>

      {/* Main Grid: Left Settings Panels | Right Live Receipt Simulator */}
      <Grid gap="md">
        {/* Left Column: Configuration Forms */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">

            {/* 1. Tax Calculation & Pricing Scheme */}
            <Paper p="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <ThemeIcon size={30} radius="sm" color="blue" variant="light">
                      <IconPercentage size={16} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600} size="sm">Tax Calculation Scheme</Text>
                      <Text size="xs" c="dimmed">Choose how taxes are billed to your customers</Text>
                    </div>
                  </Group>
                  <Switch
                    checked={!!taxConfig.enableGst}
                    onChange={(e) => {
                      const isChecked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setTaxConfig((p) => ({ ...p, enableGst: isChecked }));
                    }}
                    label={taxConfig.enableGst ? "Tax Enabled" : "Tax Disabled"}
                    size="sm"
                    color="teal"
                  />
                </Group>

                {taxConfig.enableGst && (
                  <>
                    <Divider my={4} />
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <div>
                        <Text size="xs" fw={500} mb={4}>Menu Pricing Mode</Text>
                        <SegmentedControl
                          fullWidth
                          size="xs"
                          value={taxConfig.taxPricingMode}
                          onChange={(v) => setTaxConfig((p) => ({ ...p, taxPricingMode: v as any }))}
                          data={[
                            { label: "Exclusive (+ Tax on Top)", value: "EXCLUSIVE" },
                            { label: "Inclusive (Tax in Price)", value: "INCLUSIVE" },
                          ]}
                        />
                        <Text size="xs" c="dimmed" mt={4}>
                          {taxConfig.taxPricingMode === "EXCLUSIVE"
                            ? "Taxes will be calculated and added on top of item rates at checkout."
                            : "Menu prices already include GST. Reverse calculation is shown on bills."}
                        </Text>
                      </div>

                      <div>
                        <Text size="xs" fw={500} mb={4}>Bill Round-Off</Text>
                        <SegmentedControl
                          fullWidth
                          size="xs"
                          value={taxConfig.roundOffMode}
                          onChange={(v) => setTaxConfig((p) => ({ ...p, roundOffMode: v as any }))}
                          data={[
                            { label: "Nearest Rupee (₹1.00)", value: "NEAREST" },
                            { label: "Exact Paise (None)", value: "NONE" },
                          ]}
                        />
                        <Text size="xs" c="dimmed" mt={4}>
                          Auto-rounds final bill to eliminate loose coin change.
                        </Text>
                      </div>
                    </SimpleGrid>
                  </>
                )}
              </Stack>
            </Paper>

            {/* 2. Tax Slabs */}
            {taxConfig.enableGst && (
              <Paper p="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <div>
                      <Text fw={600} size="sm">GST & Tax Slabs</Text>
                      <Text size="xs" c="dimmed">Tax groups mapped to menu categories or individual items</Text>
                    </div>
                    <Button
                      size="xs"
                      variant="light"
                      color="teal"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => setSlabModalOpen(true)}
                    >
                      Add Tax Slab
                    </Button>
                  </Group>

                  <Stack gap="xs" mt={4}>
                    {taxConfig.slabs.map((slab) => (
                      <Paper key={slab.id} withBorder p="xs" radius="sm">
                        <Group justify="space-between" align="center">
                          <div>
                            <Group gap="xs">
                              <Text size="sm" fw={600}>{slab.name}</Text>
                              <Badge size="xs" variant="filled" color={slab.rate === 0 ? "gray" : "teal"}>
                                {slab.rate}%
                              </Badge>
                              {slab.isDefault && (
                                <Badge size="xs" variant="outline" color="blue">Default Food</Badge>
                              )}
                            </Group>
                            {slab.rate > 0 && (
                              <Text size="xs" c="dimmed">
                                Split: CGST {slab.cgstRate}% + SGST {slab.sgstRate}%
                              </Text>
                            )}
                            {slab.description && (
                              <Text size="xs" c="dimmed">{slab.description}</Text>
                            )}
                          </div>

                          <Group gap="xs">
                            {!slab.isDefault && (
                              <Button
                                size="compact-xs"
                                variant="subtle"
                                onClick={() =>
                                  setTaxConfig((prev) => ({
                                    ...prev,
                                    slabs: prev.slabs.map((s) => ({ ...s, isDefault: s.id === slab.id })),
                                  }))
                                }
                              >
                                Set as Default
                              </Button>
                            )}
                            {taxConfig.slabs.length > 1 && (
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                size="sm"
                                onClick={() => handleDeleteSlab(slab.id)}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            )}

            {/* 3. Bill Adjustments: Surcharges & Discounts */}
            <Paper p="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600} size="sm">Charges, Packaging & Discounts</Text>
                    <Text size="xs" c="dimmed">Dynamic rules that increase (+) or decrease (-) the final bill</Text>
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    color="indigo"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => setRuleModalOpen(true)}
                  >
                    Add Rule
                  </Button>
                </Group>

                <Stack gap="xs" mt={4}>
                  {taxConfig.adjustments.map((rule) => {
                    const isAdd = rule.sign === "ADD";
                    return (
                      <Paper key={rule.id} withBorder p="xs" radius="sm">
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <div>
                            <Group gap="xs" mb={2}>
                              <Badge
                                size="xs"
                                variant="light"
                                color={isAdd ? "orange" : "green"}
                              >
                                {isAdd ? "+" : "-"} {rule.type === "PERCENTAGE" ? `${rule.value}%` : `₹${rule.value}`}
                              </Badge>
                              <Text size="sm" fw={600}>{rule.name}</Text>
                              <Badge size="xs" variant="dot" color="gray">
                                {rule.orderType === "ALL" ? "All Orders" : rule.orderType.replace("_", " ")}
                              </Badge>
                            </Group>
                            <Group gap="xs">
                              {rule.autoApply && (
                                <Group gap={4} align="center">
                                  <IconSparkles size={12} color="#868e96" />
                                  <Text size="xs" c="dimmed">Auto-applies to bill</Text>
                                </Group>
                              )}
                              {rule.isTaxable && (
                                <Group gap={4} align="center">
                                  <IconReceiptTax size={12} color="#868e96" />
                                  <Text size="xs" c="dimmed">Subject to GST</Text>
                                </Group>
                              )}
                            </Group>
                          </div>

                          <Group gap="xs">
                            <Switch
                              checked={rule.isActive}
                              size="xs"
                              color="teal"
                              onChange={() => handleToggleRule(rule.id)}
                            />
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              size="sm"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            </Paper>

            {/* 4. GSTIN, FSSAI & Business Legal Info */}
            <Paper p="md" radius="md">
              <Stack gap="sm">
                <div>
                  <Text fw={600} size="sm">Legal & Compliance Info</Text>
                  <Text size="xs" c="dimmed">Printed on customer receipts and official tax invoices</Text>
                </div>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    label="GSTIN Number"
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    size="xs"
                    value={invoiceConfig.gstin}
                    onChange={(e) => setInvoiceConfig((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                  />
                  <TextInput
                    label="FSSAI License No."
                    placeholder="14-digit registration number"
                    size="xs"
                    maxLength={14}
                    value={invoiceConfig.fssaiNo}
                    onChange={(e) => setInvoiceConfig((p) => ({ ...p, fssaiNo: e.target.value.replace(/\D/g, "") }))}
                  />
                  <TextInput
                    label="Trade / Brand Name"
                    placeholder="e.g. The Bistro Central"
                    size="xs"
                    value={invoiceConfig.tradeName}
                    onChange={(e) => setInvoiceConfig((p) => ({ ...p, tradeName: e.target.value }))}
                  />
                  <TextInput
                    label="Legal Registered Entity"
                    placeholder="e.g. Logix Hospitality Private Limited"
                    size="xs"
                    value={invoiceConfig.legalBusinessName}
                    onChange={(e) => setInvoiceConfig((p) => ({ ...p, legalBusinessName: e.target.value }))}
                  />
                </SimpleGrid>
              </Stack>
            </Paper>

            {/* 5. Invoice Sequencing & Receipt Customization */}
            <Paper p="md" radius="md">
              <Stack gap="sm">
                <div>
                  <Text fw={600} size="sm">Invoice Series & Bill Customization</Text>
                  <Text size="xs" c="dimmed">Customize invoice numbers and footer message</Text>
                </div>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <TextInput
                    label="Invoice Prefix"
                    placeholder="e.g. INV- or LD/"
                    size="xs"
                    value={invoiceConfig.invoicePrefix}
                    onChange={(e) => setInvoiceConfig((p) => ({ ...p, invoicePrefix: e.target.value }))}
                  />
                  <NumberInput
                    label="Starting Sequence Number"
                    size="xs"
                    min={1}
                    value={invoiceConfig.invoiceStartingNo}
                    onChange={(v) => setInvoiceConfig((p) => ({ ...p, invoiceStartingNo: Number(v) || 1 }))}
                  />
                </SimpleGrid>

                <TextInput
                  label="Footer Note / Greetings"
                  placeholder="Thank you for dining with us! Visit again."
                  size="xs"
                  value={invoiceConfig.footerNote}
                  onChange={(e) => setInvoiceConfig((p) => ({ ...p, footerNote: e.target.value }))}
                />

                <Group gap="xl" mt="xs">
                  <Switch
                    label="Print Dynamic UPI QR on Bill"
                    size="xs"
                    checked={!!invoiceConfig.showUpiQrOnBill}
                    onChange={(e) => {
                      const isChecked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setInvoiceConfig((p) => ({ ...p, showUpiQrOnBill: isChecked }));
                    }}
                  />
                  <Switch
                    label="Print Table No & Pax"
                    size="xs"
                    checked={!!invoiceConfig.showTableNo}
                    onChange={(e) => {
                      const isChecked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                      setInvoiceConfig((p) => ({ ...p, showTableNo: isChecked }));
                    }}
                  />
                </Group>
              </Stack>
            </Paper>

          </Stack>
        </Grid.Col>

        {/* Right Column: Live Thermal Receipt Simulator */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box style={{ position: "sticky", top: 80 }}>
            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                backgroundColor: "#fffdf9",
                fontFamily: "monospace",
                boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
                border: "1px dashed #d0d0d0",
              }}
            >
              <Stack gap="xs" align="center" style={{ textAlign: "center" }}>
                <IconReceiptTax size={24} style={{ opacity: 0.6 }} />
                <div>
                  <Text fw={700} size="md" style={{ letterSpacing: "1px" }}>
                    {invoiceConfig.tradeName || "RESTAURANT NAME"}
                  </Text>
                  {currentOutlet?.address && (
                    <Text size="xs" c="dimmed">{currentOutlet.address}</Text>
                  )}
                  {invoiceConfig.gstin && (
                    <Text size="xs" fw={600} mt={2}>GSTIN: {invoiceConfig.gstin}</Text>
                  )}
                  {invoiceConfig.fssaiNo && (
                    <Text size="xs" c="dimmed">FSSAI: {invoiceConfig.fssaiNo}</Text>
                  )}
                </div>

                <Divider w="100%" style={{ borderStyle: "dashed" }} />

                <Box w="100%">
                  <Group justify="space-between">
                    <Text size="xs">Invoice: {invoiceConfig.invoicePrefix}{invoiceConfig.invoiceStartingNo}</Text>
                    <Text size="xs">Date: {new Date().toLocaleDateString()}</Text>
                  </Group>
                  {invoiceConfig.showTableNo && (
                    <Group justify="space-between">
                      <Text size="xs">Table: T-04 (Pax: 2)</Text>
                      <Text size="xs">Type: Dine-In</Text>
                    </Group>
                  )}
                </Box>

                <Divider w="100%" style={{ borderStyle: "dashed" }} />

                {/* Items */}
                <Box w="100%">
                  <Group justify="space-between">
                    <Text size="xs" fw={700}>Item</Text>
                    <Text size="xs" fw={700}>Amt</Text>
                  </Group>
                  <Group justify="space-between" mt={4}>
                    <Text size="xs">1x Special Biryani</Text>
                    <Text size="xs">300.00</Text>
                  </Group>
                  <Group justify="space-between" mt={2}>
                    <Text size="xs">2x Garlic Naan</Text>
                    <Text size="xs">100.00</Text>
                  </Group>
                </Box>

                <Divider w="100%" style={{ borderStyle: "dashed" }} />

                {/* Calculations */}
                <Box w="100%">
                  <Group justify="space-between">
                    <Text size="xs">Item Subtotal:</Text>
                    <Text size="xs">₹{sampleSubtotal.toFixed(2)}</Text>
                  </Group>

                  {discountTotal > 0 && (
                    <Group justify="space-between" c="green">
                      <Text size="xs">Discount:</Text>
                      <Text size="xs">-₹{discountTotal.toFixed(2)}</Text>
                    </Group>
                  )}

                  {surchargesTotal > 0 && (
                    <Group justify="space-between">
                      <Text size="xs">Charges / Packaging:</Text>
                      <Text size="xs">+₹{surchargesTotal.toFixed(2)}</Text>
                    </Group>
                  )}

                  {taxConfig.enableGst && defaultSlab.rate > 0 && (
                    <>
                      {isInclusive ? (
                        <Box my={4} p={4} style={{ backgroundColor: "#f4f4f4", borderRadius: 4 }}>
                          <Text size="10px" c="dimmed" style={{ textAlign: "left" }}>
                            *Prices include GST {defaultSlab.rate}%
                          </Text>
                          <Group justify="space-between">
                            <Text size="10px">Taxable Base:</Text>
                            <Text size="10px">₹{taxableDisplay.toFixed(2)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="10px">CGST ({defaultSlab.cgstRate}%):</Text>
                            <Text size="10px">₹{cgstAmount.toFixed(2)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="10px">SGST ({defaultSlab.sgstRate}%):</Text>
                            <Text size="10px">₹{sgstAmount.toFixed(2)}</Text>
                          </Group>
                        </Box>
                      ) : (
                        <>
                          <Group justify="space-between">
                            <Text size="xs">CGST ({defaultSlab.cgstRate}%):</Text>
                            <Text size="xs">+₹{cgstAmount.toFixed(2)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="xs">SGST ({defaultSlab.sgstRate}%):</Text>
                            <Text size="xs">+₹{sgstAmount.toFixed(2)}</Text>
                          </Group>
                        </>
                      )}
                    </>
                  )}

                  {roundOffDiff !== 0 && (
                    <Group justify="space-between" c="dimmed">
                      <Text size="xs">Round-Off:</Text>
                      <Text size="xs">{roundOffDiff > 0 ? `+₹${roundOffDiff.toFixed(2)}` : `-₹${Math.abs(roundOffDiff).toFixed(2)}`}</Text>
                    </Group>
                  )}

                  <Divider my={4} style={{ borderStyle: "dashed" }} />

                  <Group justify="space-between">
                    <Text fw={700} size="sm">NET PAYABLE:</Text>
                    <Text fw={700} size="sm">₹{payableAmount.toFixed(2)}</Text>
                  </Group>
                </Box>

                {invoiceConfig.showUpiQrOnBill && (
                  <>
                    <Divider w="100%" style={{ borderStyle: "dashed" }} />
                    <Box style={{ textAlign: "center" }}>
                      <ThemeIcon size={46} color="dark" variant="light" radius="md">
                        <IconQrcode size={28} />
                      </ThemeIcon>
                      <Text size="10px" c="dimmed" mt={2}>Scan & Pay via UPI</Text>
                    </Box>
                  </>
                )}

                <Divider w="100%" style={{ borderStyle: "dashed" }} />
                <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                  {invoiceConfig.footerNote}
                </Text>
              </Stack>
            </Paper>
          </Box>
        </Grid.Col>
      </Grid>

      {/* Add Tax Slab Modal */}
      <Modal
        opened={slabModalOpen}
        onClose={() => setSlabModalOpen(false)}
        title="Create Tax Slab"
      >
        <Stack gap="sm">
          <TextInput
            label="Slab Name"
            placeholder="e.g. GST 12% or Liquor VAT 10%"
            required
            value={newSlab.name}
            onChange={(e) => setNewSlab((p) => ({ ...p, name: e.target.value }))}
          />
          <NumberInput
            label="Total Rate (%)"
            min={0}
            max={100}
            decimalScale={2}
            value={newSlab.rate}
            onChange={(v) => {
              const val = Number(v) || 0;
              setNewSlab((p) => ({
                ...p,
                rate: val,
                cgstRate: Number((val / 2).toFixed(2)),
                sgstRate: Number((val / 2).toFixed(2)),
              }));
            }}
          />
          <SimpleGrid cols={2}>
            <NumberInput
              label="CGST Rate (%)"
              decimalScale={2}
              value={newSlab.cgstRate}
              onChange={(v) => setNewSlab((p) => ({ ...p, cgstRate: Number(v) || 0 }))}
            />
            <NumberInput
              label="SGST Rate (%)"
              decimalScale={2}
              value={newSlab.sgstRate}
              onChange={(v) => setNewSlab((p) => ({ ...p, sgstRate: Number(v) || 0 }))}
            />
          </SimpleGrid>
          <TextInput
            label="Description / Applicability"
            placeholder="e.g. Applied on bakery goods"
            value={newSlab.description}
            onChange={(e) => setNewSlab((p) => ({ ...p, description: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setSlabModalOpen(false)}>Cancel</Button>
            <Button color="teal" onClick={handleAddSlab}>Add Slab</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add Bill Adjustment Rule Modal */}
      <Modal
        opened={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Add Bill Adjustment Rule"
      >
        <Stack gap="sm">
          <TextInput
            label="Rule Name"
            placeholder="e.g. Service Charge, Takeaway Parcel, VIP Discount"
            required
            value={newRule.name}
            onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
          />

          <SimpleGrid cols={2}>
            <Select
              label="Effect"
              value={newRule.sign}
              onChange={(v) => setNewRule((p) => ({ ...p, sign: v as any }))}
              data={[
                { value: "ADD", label: "+ Add Surcharge / Fee" },
                { value: "SUBTRACT", label: "- Subtract Discount" },
              ]}
            />
            <Select
              label="Value Type"
              value={newRule.type}
              onChange={(v) => setNewRule((p) => ({ ...p, type: v as any }))}
              data={[
                { value: "PERCENTAGE", label: "Percentage (%)" },
                { value: "FLAT", label: "Flat Rupee (₹)" },
              ]}
            />
          </SimpleGrid>

          <NumberInput
            label={newRule.type === "PERCENTAGE" ? "Value (%)" : "Amount (₹)"}
            min={0}
            value={newRule.value}
            onChange={(v) => setNewRule((p) => ({ ...p, value: Number(v) || 0 }))}
          />

          <Select
            label="Applicable Order Type"
            value={newRule.orderType}
            onChange={(v) => setNewRule((p) => ({ ...p, orderType: v as any }))}
            data={[
              { value: "ALL", label: "All Orders" },
              { value: "DINE_IN", label: "Dine-In Only" },
              { value: "TAKEAWAY", label: "Takeaway Only" },
              { value: "DELIVERY", label: "Delivery Only" },
            ]}
          />

          <Switch
            label="Auto-apply to every new bill"
            size="xs"
            checked={!!newRule.autoApply}
            onChange={(e) => {
              const isChecked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
              setNewRule((p) => ({ ...p, autoApply: isChecked }));
            }}
          />

          {newRule.sign === "ADD" && (
            <Switch
              label="Subject to GST (Taxes calculated over this charge)"
              size="xs"
              checked={!!newRule.isTaxable}
              onChange={(e) => {
                const isChecked = e?.currentTarget ? e.currentTarget.checked : Boolean((e?.target as any)?.checked);
                setNewRule((p) => ({ ...p, isTaxable: isChecked }));
              }}
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setRuleModalOpen(false)}>Cancel</Button>
            <Button color="indigo" onClick={handleAddRule}>Save Rule</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
