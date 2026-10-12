"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Paper,
  Tabs,
  TextInput,
  SimpleGrid,
  ThemeIcon,
  Badge,
  Alert,
  Divider,
  Box,
  Accordion,
} from "@mantine/core";
import {
  IconFileSpreadsheet,
  IconDownload,
  IconCheck,
  IconInfoCircle,
  IconSettings,
  IconBuildingStore,
  IconHelp,
  IconReceipt2,
  IconBrandShopee,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  generateTallyXml,
  generateMargSalesCsv,
  generateMargItemWiseCsv,
  downloadFile,
  DEFAULT_TALLY_CONFIG,
  type TallyLedgerConfig,
  type InvoiceRecord,
  type ItemInvoiceRecord,
} from "@/lib/accounting-export";

interface AccountingExportModalProps {
  opened: boolean;
  onClose: () => void;
  invoices: InvoiceRecord[];
  itemInvoices: ItemInvoiceRecord[];
  restaurantName: string;
  outletName: string;
  from: string;
  to: string;
}

const TALLY_STORAGE_KEY = "logix_dine_tally_ledger_settings_v1";

export function AccountingExportModal({
  opened,
  onClose,
  invoices,
  itemInvoices,
  restaurantName,
  outletName,
  from,
  to,
}: AccountingExportModalProps) {
  const [activeFormat, setActiveFormat] = useState<string | null>("tally");
  const [tallyConfig, setTallyConfig] = useState<TallyLedgerConfig>(DEFAULT_TALLY_CONFIG);
  const [showConfig, setShowConfig] = useState(false);

  // Load saved ledger names from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(TALLY_STORAGE_KEY);
        if (stored) {
          setTallyConfig({
            ...DEFAULT_TALLY_CONFIG,
            ...JSON.parse(stored),
            companyName: restaurantName || DEFAULT_TALLY_CONFIG.companyName,
          });
          return;
        }
      } catch (err) {
        console.warn("Failed to load stored tally config:", err);
      }
    }
    setTallyConfig((prev) => ({
      ...prev,
      companyName: restaurantName || prev.companyName,
    }));
  }, [restaurantName]);

  const handleSaveTallyConfig = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TALLY_STORAGE_KEY, JSON.stringify(tallyConfig));
        notifications.show({
          title: "Ledgers Saved",
          message: "Tally ledger names saved as your default preferences.",
          color: "teal",
          icon: <IconCheck size={16} />,
        });
      } catch (err) {
        console.warn("Failed to save tally config:", err);
      }
    }
    setShowConfig(false);
  };

  const paidInvoices = invoices.filter(
    (inv) => inv.status === "PAID" && inv.orderStatus !== "CANCELLED"
  );
  const totalRevenuePaise = paidInvoices.reduce((s, inv) => s + (inv.paidPaise || 0), 0);
  const totalFoodNetPaise = paidInvoices.reduce(
    (s, inv) => s + (inv.netSalesPaise || inv.subtotalPaise || 0),
    0
  );
  const totalTaxPaise = paidInvoices.reduce((s, inv) => s + (inv.taxPaise || 0), 0);

  const handleExportTally = () => {
    if (paidInvoices.length === 0) {
      notifications.show({
        title: "No Invoices Found",
        message: "No paid invoices available in the selected date range.",
        color: "orange",
      });
      return;
    }

    const xml = generateTallyXml(invoices, tallyConfig);
    const filename = `Tally_Sales_${outletName.replace(/\s+/g, "_")}_${from}_to_${to}.xml`;
    downloadFile(filename, xml, "application/xml");

    notifications.show({
      title: "Tally XML Exported! 📊",
      message: `${paidInvoices.length} sales vouchers exported in Tally Prime / ERP 9 format.`,
      color: "teal",
      icon: <IconCheck size={16} />,
    });
    onClose();
  };

  const handleExportMargBill = () => {
    if (paidInvoices.length === 0) {
      notifications.show({
        title: "No Invoices Found",
        message: "No paid invoices available in the selected date range.",
        color: "orange",
      });
      return;
    }

    const csv = generateMargSalesCsv(invoices);
    const filename = `Marg_Sales_Bills_${outletName.replace(/\s+/g, "_")}_${from}_to_${to}.csv`;
    downloadFile(filename, csv, "text/csv;charset=utf-8;");

    notifications.show({
      title: "Marg ERP CSV Exported! 📈",
      message: `${paidInvoices.length} bill records exported for Marg ERP sales import.`,
      color: "teal",
      icon: <IconCheck size={16} />,
    });
    onClose();
  };

  const handleExportMargItemWise = () => {
    if (itemInvoices.length === 0) {
      notifications.show({
        title: "No Item Details",
        message: "No itemized records available in the selected date range.",
        color: "orange",
      });
      return;
    }

    const csv = generateMargItemWiseCsv(itemInvoices);
    const filename = `Marg_Item_Sales_${outletName.replace(/\s+/g, "_")}_${from}_to_${to}.csv`;
    downloadFile(filename, csv, "text/csv;charset=utf-8;");

    notifications.show({
      title: "Marg Item-Wise CSV Exported! 🍛",
      message: `${itemInvoices.length} line item sales records exported for Marg ERP.`,
      color: "teal",
      icon: <IconCheck size={16} />,
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size="md" color="teal" variant="light" radius="md">
            <IconFileSpreadsheet size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="md">
              Accounting & ERP Export
            </Text>
            <Text size="xs" c="dimmed">
              Direct export for Tally Prime / Tally ERP 9 & Marg ERP
            </Text>
          </div>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        {/* Scope Banner */}
        <Paper withBorder p="xs" radius="md" bg="gray.0">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" fw={700} c="dark.7">
                {outletName || "All Outlets"}
              </Text>
              <Text size="11px" c="dimmed">
                Period: {from} to {to}
              </Text>
            </div>
            <Group gap="xs">
              <Badge color="teal" variant="light" size="sm">
                {paidInvoices.length} Vouchers
              </Badge>
              <Badge color="blue" variant="light" size="sm">
                ₹{((totalRevenuePaise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Total
              </Badge>
            </Group>
          </Group>
        </Paper>

        <Tabs value={activeFormat} onChange={setActiveFormat} variant="outline" radius="md">
          <Tabs.List>
            <Tabs.Tab value="tally" leftSection={<IconReceipt2 size={15} />}>
              Tally Prime (XML)
            </Tabs.Tab>
            <Tabs.Tab value="marg" leftSection={<IconBrandShopee size={15} />}>
              Marg ERP (CSV)
            </Tabs.Tab>
          </Tabs.List>

          {/* ─── TAB 1: TALLY PRIME / ERP 9 ─── */}
          <Tabs.Panel value="tally" pt="md">
            <Stack gap="md">
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" p="xs">
                <Text size="xs">
                  Generates standard <strong>Tally XML Sales Vouchers</strong>. Ready for 1-click import into Tally Prime or Tally ERP 9 under <strong>Import &gt; Transactions</strong>.
                </Text>
              </Alert>

              <Group justify="space-between" align="center">
                <Text size="xs" fw={600} c="dimmed">
                  Ledger Configuration
                </Text>
                <Button
                  variant="subtle"
                  size="compact-xs"
                  leftSection={<IconSettings size={14} />}
                  onClick={() => setShowConfig(!showConfig)}
                >
                  {showConfig ? "Hide Ledgers" : "Configure Ledgers"}
                </Button>
              </Group>

              {showConfig && (
                <Paper withBorder p="sm" radius="md" bg="gray.0">
                  <Stack gap="xs">
                    <Text size="xs" fw={700}>
                      Tally Account Ledgers
                    </Text>
                    <Text size="11px" c="dimmed">
                      Match these names with the ledgers in your Tally company chart of accounts:
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      <TextInput
                        label="Company Name"
                        size="xs"
                        value={tallyConfig.companyName}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, companyName: e.target.value })}
                      />
                      <TextInput
                        label="Sales Ledger"
                        size="xs"
                        value={tallyConfig.salesLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, salesLedger: e.target.value })}
                      />
                      <TextInput
                        label="Cash Ledger"
                        size="xs"
                        value={tallyConfig.cashLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, cashLedger: e.target.value })}
                      />
                      <TextInput
                        label="Bank / UPI Ledger"
                        size="xs"
                        value={tallyConfig.bankLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, bankLedger: e.target.value })}
                      />
                      <TextInput
                        label="Card Ledger"
                        size="xs"
                        value={tallyConfig.cardLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, cardLedger: e.target.value })}
                      />
                      <TextInput
                        label="Output CGST Ledger"
                        size="xs"
                        value={tallyConfig.cgstLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, cgstLedger: e.target.value })}
                      />
                      <TextInput
                        label="Output SGST Ledger"
                        size="xs"
                        value={tallyConfig.sgstLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, sgstLedger: e.target.value })}
                      />
                      <TextInput
                        label="Charges Ledger (Pkg/Del)"
                        size="xs"
                        value={tallyConfig.chargesLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, chargesLedger: e.target.value })}
                      />
                      <TextInput
                        label="Round Off Ledger"
                        size="xs"
                        value={tallyConfig.roundOffLedger}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, roundOffLedger: e.target.value })}
                      />
                      <TextInput
                        label="Place of Supply"
                        size="xs"
                        value={tallyConfig.placeOfSupply}
                        onChange={(e) => setTallyConfig({ ...tallyConfig, placeOfSupply: e.target.value })}
                      />
                    </SimpleGrid>
                    <Group justify="flex-end" mt="xs">
                      <Button size="xs" color="teal" onClick={handleSaveTallyConfig}>
                        Save Ledger Names
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}

              {/* Summary Stats */}
              <SimpleGrid cols={3} spacing="xs">
                <Paper withBorder p="xs" radius="md" style={{ textAlign: "center" }}>
                  <Text size="11px" c="dimmed">
                    Taxable F&amp;B Sales
                  </Text>
                  <Text fw={700} size="sm">
                    ₹{((totalFoodNetPaise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </Text>
                </Paper>
                <Paper withBorder p="xs" radius="md" style={{ textAlign: "center" }}>
                  <Text size="11px" c="dimmed">
                    GST Collected
                  </Text>
                  <Text fw={700} size="sm" c="teal.7">
                    ₹{((totalTaxPaise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </Text>
                </Paper>
                <Paper withBorder p="xs" radius="md" style={{ textAlign: "center" }}>
                  <Text size="11px" c="dimmed">
                    Net Collected
                  </Text>
                  <Text fw={700} size="sm" c="blue.7">
                    ₹{((totalRevenuePaise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </Text>
                </Paper>
              </SimpleGrid>

              {/* Instructions Accordion */}
              <Accordion variant="separated" radius="md">
                <Accordion.Item value="instructions">
                  <Accordion.Control icon={<IconHelp size={16} />}>
                    <Text size="xs" fw={600}>
                      How to import into Tally Prime / ERP 9?
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="4px">
                      <Text size="xs" c="dimmed">
                        1. Open your company in <strong>Tally Prime</strong> or <strong>Tally.ERP 9</strong>.
                      </Text>
                      <Text size="xs" c="dimmed">
                        2. Press <strong>Alt + O</strong> (Import) or click <strong>Import &gt; Transactions</strong>.
                      </Text>
                      <Text size="xs" c="dimmed">
                        3. Select File Format: <strong>XML (Data Interchange)</strong>.
                      </Text>
                      <Text size="xs" c="dimmed">
                        4. Browse and select the downloaded <code>.xml</code> file.
                      </Text>
                      <Text size="xs" c="dimmed">
                        5. Tally will automatically create all sales vouchers with date, order number, cash/bank split, and GST tax ledgers.
                      </Text>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>

              <Button
                leftSection={<IconDownload size={16} />}
                color="teal"
                fullWidth
                size="md"
                onClick={handleExportTally}
                disabled={paidInvoices.length === 0}
              >
                Download Tally XML ({paidInvoices.length} Vouchers)
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* ─── TAB 2: MARG ERP ─── */}
          <Tabs.Panel value="marg" pt="md">
            <Stack gap="md">
              <Alert icon={<IconInfoCircle size={16} />} color="teal" variant="light" p="xs">
                <Text size="xs">
                  Generates <strong>Marg ERP Sales Import CSV files</strong> matching Marg&apos;s standard data import utility for retail and restaurant establishments.
                </Text>
              </Alert>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Paper withBorder p="md" radius="md">
                  <Stack justify="space-between" style={{ height: "100%" }}>
                    <div>
                      <Group gap="xs" mb="xs">
                        <ThemeIcon size="sm" color="blue" variant="light" radius="xl">
                          <IconReceipt2 size={14} />
                        </ThemeIcon>
                        <Text size="xs" fw={700}>
                          Bill-Level Sales Import
                        </Text>
                      </Group>
                      <Text size="11px" c="dimmed" mb="sm">
                        One row per settled bill with voucher number, date, payment mode, subtotal, CGST, SGST, round off, and total.
                      </Text>
                    </div>
                    <Button
                      size="xs"
                      color="blue"
                      variant="light"
                      leftSection={<IconDownload size={14} />}
                      onClick={handleExportMargBill}
                      disabled={paidInvoices.length === 0}
                    >
                      Export Marg Bills ({paidInvoices.length})
                    </Button>
                  </Stack>
                </Paper>

                <Paper withBorder p="md" radius="md">
                  <Stack justify="space-between" style={{ height: "100%" }}>
                    <div>
                      <Group gap="xs" mb="xs">
                        <ThemeIcon size="sm" color="orange" variant="light" radius="xl">
                          <IconFileSpreadsheet size={14} />
                        </ThemeIcon>
                        <Text size="xs" fw={700}>
                          Item-Wise Line Sales Import
                        </Text>
                      </Group>
                      <Text size="11px" c="dimmed" mb="sm">
                        Itemized line-by-line sales with dish name, category, quantity, unit rate, and allocated GST for Marg stock matching.
                      </Text>
                    </div>
                    <Button
                      size="xs"
                      color="orange"
                      variant="light"
                      leftSection={<IconDownload size={14} />}
                      onClick={handleExportMargItemWise}
                      disabled={itemInvoices.length === 0}
                    >
                      Export Marg Items ({itemInvoices.length})
                    </Button>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {/* Marg Instructions Accordion */}
              <Accordion variant="separated" radius="md">
                <Accordion.Item value="instructions">
                  <Accordion.Control icon={<IconHelp size={16} />}>
                    <Text size="xs" fw={600}>
                      How to import into Marg ERP?
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="4px">
                      <Text size="xs" c="dimmed">
                        1. Open <strong>Marg ERP 9+</strong>.
                      </Text>
                      <Text size="xs" c="dimmed">
                        2. Go to <strong>Reports &gt; Management Reports &gt; Utilities &gt; Data Import &gt; Sales Import</strong>.
                      </Text>
                      <Text size="xs" c="dimmed">
                        3. Select the exported CSV file.
                      </Text>
                      <Text size="xs" c="dimmed">
                        4. Verify mapped fields (Bill No, Date, Amount, Tax) and click <strong>Import</strong>.
                      </Text>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Modal>
  );
}
