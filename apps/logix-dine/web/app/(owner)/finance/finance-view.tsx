"use client";

import React, { useState, useMemo } from "react";
import {
  Paper,
  Stack,
  Text,
  Title,
  Group,
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  Badge,
  Box,
  Divider,
  Table,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  ActionIcon,
  Tooltip,
  Alert,
  Progress,
  SegmentedControl,
} from "@mantine/core";
import {
  IconWallet,
  IconReceipt2,
  IconReceipt,
  IconPlus,
  IconTrash,
  IconBrandWhatsapp,
  IconTrendingUp,
  IconTrendingDown,
  IconCash,
  IconDeviceMobile,
  IconCreditCard,
  IconClock,
  IconSearch,
  IconFilter,
  IconCheck,
  IconAlertCircle,
  IconBuildingStore,
  IconArrowUpRight,
  IconArrowDownRight,
  IconCoin,
  IconSend,
  IconFileInvoice,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useExpenseSummary,
  useExpenses,
  useCreateExpense,
  useDeleteExpense,
  useCashRegister,
  useSetCashRegister,
  useSendClosingReport,
  useClosingReportPreview,
} from "@/lib/queries";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_MODES } from "@logixsoft/logix-dine/schemas/pos";

export const CATEGORY_METAS: Record<string, { label: string; color: string }> = {
  RAW_MATERIAL: { label: "Raw Materials & Groceries", color: "orange" },
  STAFF: { label: "Staff Wages & Advances", color: "blue" },
  UTILITIES: { label: "Gas, Power & Water", color: "teal" },
  MAINTENANCE: { label: "Repairs & Maintenance", color: "yellow" },
  PACKAGING: { label: "Packaging & Bags", color: "cyan" },
  MARKETING: { label: "Marketing & Ads", color: "pink" },
  RENT: { label: "Store Rent", color: "grape" },
  OTHER: { label: "Miscellaneous Petty Cash", color: "gray" },
};

function formatINR(paise: number): string {
  const rs = Math.round(paise / 100);
  return rs.toLocaleString("en-IN");
}

function getTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function FinanceView() {
  const { restaurant, outlets, activeOutlet, setActiveOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const outletId = currentOutlet?.id ?? "";

  // Date selection filter
  const todayStr = useMemo(() => getTodayStr(), []);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("today");
  const [customDate, setCustomDate] = useState<string>(todayStr);

  const activeDate = useMemo(() => {
    if (selectedDateFilter === "today") return todayStr;
    if (selectedDateFilter === "yesterday") {
      const d = new Date(`${todayStr}T12:00:00+05:30`);
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    return customDate;
  }, [selectedDateFilter, todayStr, customDate]);

  // Queries
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useExpenseSummary(
    restaurantId,
    outletId,
    activeDate,
    !!restaurantId && !!outletId
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [modeFilter, setModeFilter] = useState<string>("ALL");

  const { data: expenseData, isLoading: expensesLoading, refetch: refetchExpenses } = useExpenses(
    restaurantId,
    {
      outletId,
      startDate: activeDate,
      endDate: activeDate,
      category: categoryFilter !== "ALL" ? categoryFilter : undefined,
      paymentMode: modeFilter !== "ALL" ? modeFilter : undefined,
    },
    !!restaurantId && !!outletId
  );

  const { data: cashRegister, refetch: refetchCashRegister } = useCashRegister(
    restaurantId,
    outletId,
    activeDate,
    !!restaurantId && !!outletId
  );

  // Mutations
  const createExpenseMut = useCreateExpense(restaurantId);
  const deleteExpenseMut = useDeleteExpense(restaurantId);
  const setCashRegisterMut = useSetCashRegister(restaurantId);
  const sendClosingReportMut = useSendClosingReport(restaurantId);

  // Modals state
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmountRs, setNewAmountRs] = useState<number | "">("");
  const [newCategory, setNewCategory] = useState<string>("OTHER");
  const [newMode, setNewMode] = useState<string>("CASH");
  const [newPaidTo, setNewPaidTo] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Cash Drawer Float Modal
  const [floatModalOpen, setFloatModalOpen] = useState(false);
  const [openingFloatRs, setOpeningFloatRs] = useState<number | "">("");
  const [cashWithdrawnRs, setCashWithdrawnRs] = useState<number | "">("");
  const [closingCountedRs, setClosingCountedRs] = useState<number | "">("");
  const [floatNotes, setFloatNotes] = useState("");
  const [submittingFloat, setSubmittingFloat] = useState(false);

  // WhatsApp Closing Report Modal
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sendingReport, setSendingReport] = useState(false);

  const { data: previewData, isLoading: previewLoading } = useClosingReportPreview(
    restaurantId,
    outletId,
    activeDate,
    closingModalOpen && !!restaurantId && !!outletId
  );

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    const list = expenseData?.expenses || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.paidTo && e.paidTo.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
    );
  }, [expenseData?.expenses, searchQuery]);

  // Handle Record Expense
  const handleRecordExpense = async () => {
    if (!newTitle.trim()) {
      notifications.show({ title: "Title Required", message: "Please provide an expense title.", color: "orange" });
      return;
    }
    const val = Number(newAmountRs);
    if (!val || val <= 0) {
      notifications.show({ title: "Invalid Amount", message: "Please enter a valid amount greater than ₹0.", color: "orange" });
      return;
    }

    setSubmittingExpense(true);
    try {
      await createExpenseMut.mutateAsync({
        data: {
          title: newTitle.trim(),
          amountPaise: Math.round(val * 100),
          category: newCategory as any,
          paymentMode: newMode as any,
          paidTo: newPaidTo.trim() || null,
          expenseDate: activeDate,
          notes: newNotes.trim() || null,
          outletId,
        },
        outletId,
      });

      notifications.show({
        title: "Expense Logged",
        message: `₹${val.toLocaleString("en-IN")} recorded as ${newMode === "CASH" ? "Petty Cash Out" : newMode}.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setRecordModalOpen(false);
      setNewTitle("");
      setNewAmountRs("");
      setNewPaidTo("");
      setNewNotes("");
      refetchSummary();
      refetchExpenses();
    } catch (err: any) {
      notifications.show({
        title: "Failed to record expense",
        message: err.message || "An unexpected error occurred",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteExpenseMut.mutateAsync({ id, outletId });
      notifications.show({
        title: "Expense Removed",
        message: `Voucher "${title}" deleted.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      refetchSummary();
      refetchExpenses();
    } catch (err: any) {
      notifications.show({
        title: "Delete Failed",
        message: err.message || "Could not delete expense",
        color: "red",
      });
    }
  };

  // Handle Save Float / Cash Register
  const handleSaveFloat = async () => {
    setSubmittingFloat(true);
    try {
      await setCashRegisterMut.mutateAsync({
        data: {
          date: activeDate,
          openingFloatPaise: openingFloatRs !== "" ? Math.round(Number(openingFloatRs) * 100) : undefined,
          cashWithdrawnPaise: cashWithdrawnRs !== "" ? Math.round(Number(cashWithdrawnRs) * 100) : undefined,
          closingCountedPaise: closingCountedRs !== "" ? Math.round(Number(closingCountedRs) * 100) : undefined,
          notes: floatNotes.trim() || null,
          outletId,
        },
        outletId,
      });

      notifications.show({
        title: "Cash Drawer Updated",
        message: "Opening float and drawer settings saved successfully.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setFloatModalOpen(false);
      refetchSummary();
      refetchCashRegister();
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message || "Could not update drawer",
        color: "red",
      });
    } finally {
      setSubmittingFloat(false);
    }
  };

  // Handle Send WhatsApp Closing Report
  const handleSendClosingReport = async () => {
    const targetPhone = recipientPhone.trim() || summary?.ownerPhone || "";
    const cleanDigits = targetPhone.replace(/\D/g, "");
    if (!cleanDigits || cleanDigits.length < 10) {
      notifications.show({
        title: "Invalid Phone Number",
        message: "Please enter a valid 10-digit mobile number.",
        color: "orange",
      });
      return;
    }

    setSendingReport(true);
    try {
      const res = await sendClosingReportMut.mutateAsync({
        outletId,
        phone: cleanDigits,
        date: activeDate,
      });

      notifications.show({
        title: "Closing Report Dispatched! 🌙",
        message: `Comprehensive EOD summary sent via WhatsApp to ${res.recipientPhone}.`,
        color: "teal",
        icon: <IconBrandWhatsapp size={18} />,
        autoClose: 5000,
      });

      setClosingModalOpen(false);
    } catch (err: any) {
      notifications.show({
        title: "Dispatch Failed",
        message: err.message || "Could not deliver closing report.",
        color: "red",
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSendingReport(false);
    }
  };

  // Metrics
  const grossSales = summary?.grossSalesPaise || 0;
  const totalExpenses = summary?.totalExpensesPaise || 0;
  const cashSales = summary?.cashSalesPaise || 0;
  const upiSales = summary?.upiSalesPaise || 0;
  const cashExpenses = summary?.cashExpensesPaise || 0;
  const onlineExpenses = summary?.onlineExpensesPaise || 0;
  const openingFloat = summary?.openingFloatPaise || 0;
  const cashInHand = summary?.cashInHandPaise || 0;
  const netProfit = summary?.netProfitPaise || 0;
  const profitMargin = grossSales > 0 ? ((netProfit / grossSales) * 100).toFixed(1) : "0";

  return (
    <Stack gap="lg" w="100%">
      {/* ─── Top Header & Controls ─── */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <div>
            <Group gap="xs">
              <ThemeIcon color="teal" size="lg" radius="md" variant="light">
                <IconWallet size={24} />
              </ThemeIcon>
              <div>
                <Title order={3} fw={700}>Finance & Petty Cash Tracking</Title>
                <Text size="xs" c="dimmed">
                  Daily income vs expense vouchers, counter cash drawer float, and WhatsApp EOD closing digests.
                </Text>
              </div>
            </Group>
          </div>

          <Group gap="sm" wrap="wrap">
            {outlets.length > 1 && (
              <Select
                size="sm"
                data={outlets.map((o) => ({ value: o.id, label: o.name }))}
                value={outletId}
                onChange={(val) => {
                  if (val) setActiveOutlet(val);
                }}
                leftSection={<IconBuildingStore size={15} />}
                allowDeselect={false}
                w={180}
              />
            )}

            <SegmentedControl
              size="sm"
              value={selectedDateFilter}
              onChange={(val) => setSelectedDateFilter(val)}
              data={[
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "Custom Date", value: "custom" },
              ]}
            />

            {selectedDateFilter === "custom" && (
              <TextInput
                type="date"
                size="sm"
                value={customDate}
                onChange={(e) => setCustomDate(e.currentTarget.value)}
                w={145}
              />
            )}

            <Button
              color="teal"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setNewTitle("");
                setNewAmountRs("");
                setNewCategory("OTHER");
                setNewMode("CASH");
                setNewPaidTo("");
                setNewNotes("");
                setRecordModalOpen(true);
              }}
            >
              Record Expense
            </Button>

            <Button
              color="green"
              variant="light"
              leftSection={<IconBrandWhatsapp size={18} />}
              onClick={() => {
                setRecipientPhone(summary?.ownerPhone || currentOutlet?.phone || "");
                setClosingModalOpen(true);
              }}
            >
              Send EOD Closing Report
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* ─── Key KPI Metrics Grid ─── */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {/* Card 1: Net Day Profit */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Net Day Profit
            </Text>
            <ThemeIcon
              color={netProfit >= 0 ? "teal" : "red"}
              variant="light"
              size="md"
              radius="md"
            >
              {netProfit >= 0 ? <IconTrendingUp size={18} /> : <IconTrendingDown size={18} />}
            </ThemeIcon>
          </Group>
          <Group align="baseline" gap="xs" mt="xs">
            <Text size="xl" fw={800} c={netProfit >= 0 ? "teal.7" : "red.7"}>
              ₹{formatINR(netProfit)}
            </Text>
            <Badge color={netProfit >= 0 ? "teal" : "red"} size="xs" variant="light">
              {profitMargin}% margin
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Sales ₹{formatINR(grossSales)} - Expenses ₹{formatINR(totalExpenses)}
          </Text>
        </Card>

        {/* Card 2: Total Sales Revenue */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Gross Sales Revenue
            </Text>
            <ThemeIcon color="blue" variant="light" size="md" radius="md">
              <IconReceipt size={18} />
            </ThemeIcon>
          </Group>
          <Group align="baseline" gap="xs" mt="xs">
            <Text size="xl" fw={800}>
              ₹{formatINR(grossSales)}
            </Text>
            <Badge color="blue" size="xs" variant="light">
              {summary?.totalOrdersSettled || 0} orders
            </Badge>
          </Group>
          <Group gap={6} mt={6}>
            <Badge color="green" size="xs" variant="subtle">
              💵 Cash ₹{formatINR(cashSales)}
            </Badge>
            <Badge color="indigo" size="xs" variant="subtle">
              📱 UPI ₹{formatINR(upiSales)}
            </Badge>
          </Group>
        </Card>

        {/* Card 3: Total Day Expenses */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Total Day Expenses
            </Text>
            <ThemeIcon color="orange" variant="light" size="md" radius="md">
              <IconReceipt2 size={18} />
            </ThemeIcon>
          </Group>
          <Group align="baseline" gap="xs" mt="xs">
            <Text size="xl" fw={800} c="orange.7">
              ₹{formatINR(totalExpenses)}
            </Text>
            <Badge color="orange" size="xs" variant="light">
              {expenseData?.count || 0} vouchers
            </Badge>
          </Group>
          <Group gap={6} mt={6}>
            <Badge color="yellow" size="xs" variant="subtle">
              💵 Petty Cash ₹{formatINR(cashExpenses)}
            </Badge>
            <Badge color="cyan" size="xs" variant="subtle">
              📱 Online ₹{formatINR(onlineExpenses)}
            </Badge>
          </Group>
        </Card>

        {/* Card 4: Cash Drawer (Cash in Hand) */}
        <Card withBorder p="md" radius="md" style={{ borderColor: "var(--mantine-color-green-3)" }}>
          <Group justify="space-between" align="flex-start">
            <Text size="xs" fw={700} c="green.8" tt="uppercase">
              Cash Drawer (In Hand)
            </Text>
            <Tooltip label="Set Opening Float / Reconcile Drawer">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="green"
                onClick={() => {
                  setOpeningFloatRs(cashRegister?.openingFloatPaise ? cashRegister.openingFloatPaise / 100 : "");
                  setCashWithdrawnRs(cashRegister?.cashWithdrawnPaise ? cashRegister.cashWithdrawnPaise / 100 : "");
                  setClosingCountedRs(cashRegister?.closingCountedPaise ? cashRegister.closingCountedPaise / 100 : "");
                  setFloatNotes(cashRegister?.notes || "");
                  setFloatModalOpen(true);
                }}
              >
                <IconCoin size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Group align="baseline" gap="xs" mt="xs">
            <Text size="xl" fw={800} c="green.8">
              ₹{formatINR(cashInHand)}
            </Text>
            <Badge color="green" size="xs" variant="light">
              Register
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Cash In ₹{formatINR(cashSales)} - Spent ₹{formatINR(cashExpenses)}
            {openingFloat > 0 && ` + Float ₹${formatINR(openingFloat)}`}
          </Text>
        </Card>
      </SimpleGrid>

      {/* ─── Petty Cash Drawer Notice & Reconcile ─── */}
      <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="sm">
            <ThemeIcon color="green" variant="light" size="md" radius="xl">
              <IconCash size={18} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600}>
                Physical Cash in Counter Drawer: <span style={{ color: "var(--mantine-color-green-8)" }}>₹{formatINR(cashInHand)}</span>
              </Text>
              <Text size="xs" c="dimmed">
                Calculated automatically from settled cash bills minus counter petty cash payouts.
                {cashRegister?.closingCountedPaise !== undefined && cashRegister?.closingCountedPaise !== null && (
                  <> • Counted: ₹{formatINR(cashRegister.closingCountedPaise)}</>
                )}
              </Text>
            </div>
          </Group>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconCoin size={14} />}
            onClick={() => {
              setOpeningFloatRs(cashRegister?.openingFloatPaise ? cashRegister.openingFloatPaise / 100 : "");
              setCashWithdrawnRs(cashRegister?.cashWithdrawnPaise ? cashRegister.cashWithdrawnPaise / 100 : "");
              setClosingCountedRs(cashRegister?.closingCountedPaise ? cashRegister.closingCountedPaise / 100 : "");
              setFloatNotes(cashRegister?.notes || "");
              setFloatModalOpen(true);
            }}
          >
            Adjust Float / Count Cash
          </Button>
        </Group>
      </Paper>

      {/* ─── Category Outflows Breakdown (if any) ─── */}
      {summary?.categoryExpenses && summary.categoryExpenses.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Text fw={700} size="sm" mb="xs">
            Where Did The Money Go Today? (Expense Categories)
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
            {summary.categoryExpenses.map((cat) => {
              const meta = CATEGORY_METAS[cat.category] || { label: cat.label, color: "gray" };
              const percent = totalExpenses > 0 ? Math.round((cat.amountPaise / totalExpenses) * 100) : 0;
              return (
                <Card withBorder key={cat.category} p="xs" radius="sm">
                  <Group justify="space-between" align="center">
                    <Badge color={meta.color} size="sm" variant="light">
                      {meta.label}
                    </Badge>
                    <Text size="xs" fw={700}>
                      {percent}%
                    </Text>
                  </Group>
                  <Text fw={800} size="md" mt="xs">
                    ₹{formatINR(cat.amountPaise)}
                  </Text>
                  <Progress value={percent} color={meta.color} size="xs" mt={6} radius="xl" />
                  <Text size="10px" c="dimmed" mt={4}>
                    {cat.count} voucher(s)
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>
        </Paper>
      )}

      {/* ─── Expense Ledger Table ─── */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <div>
              <Title order={4} fw={700}>Expense & Petty Cash Ledger</Title>
              <Text size="xs" c="dimmed">
                All payouts, vendor raw material bills, wages, and store maintenance for {activeDate}.
              </Text>
            </div>
            <Group gap="sm" wrap="wrap">
              <TextInput
                size="xs"
                placeholder="Search description, payee..."
                leftSection={<IconSearch size={14} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                w={200}
              />
              <Select
                size="xs"
                placeholder="Category"
                data={[
                  { value: "ALL", label: "All Categories" },
                  ...EXPENSE_CATEGORIES.map((c) => ({
                    value: c,
                    label: CATEGORY_METAS[c]?.label || c,
                  })),
                ]}
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(v || "ALL")}
                w={160}
              />
              <Select
                size="xs"
                placeholder="Mode"
                data={[
                  { value: "ALL", label: "All Modes" },
                  { value: "CASH", label: "💵 Cash (Drawer)" },
                  { value: "UPI", label: "📱 UPI / QR" },
                  { value: "BANK_TRANSFER", label: "🏦 Bank Transfer" },
                  { value: "CARD", label: "💳 Card" },
                ]}
                value={modeFilter}
                onChange={(v) => setModeFilter(v || "ALL")}
                w={140}
              />
            </Group>
          </Group>

          {filteredExpenses.length === 0 ? (
            <Card withBorder p="xl" radius="md" style={{ textAlign: "center" }}>
              <ThemeIcon color="gray" size="xl" radius="xl" variant="light" mx="auto" mb="sm">
                <IconReceipt2 size={28} />
              </ThemeIcon>
              <Text fw={600} size="md">No expenses recorded for this date</Text>
              <Text size="xs" c="dimmed" mb="md">
                Click "Record Expense" to log vegetable purchases, gas refills, staff advances, or emergency store maintenance.
              </Text>
              <Button
                size="xs"
                color="teal"
                leftSection={<IconPlus size={14} />}
                onClick={() => setRecordModalOpen(true)}
                mx="auto"
              >
                Record First Expense
              </Button>
            </Card>
          ) : (
            <Table.ScrollContainer minWidth={700}>
              <Table verticalSpacing="xs" striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title / Description</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Payment Mode</Table.Th>
                    <Table.Th>Paid To / Vendor</Table.Th>
                    <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
                    <Table.Th>Recorded By</Table.Th>
                    <Table.Th style={{ width: 60 }}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredExpenses.map((exp) => {
                    const catMeta = CATEGORY_METAS[exp.category] || { label: exp.category, color: "gray" };
                    const isCash = exp.paymentMode === "CASH";
                    return (
                      <Table.Tr key={exp.id}>
                        <Table.Td>
                          <Text fw={600} size="sm">{exp.title}</Text>
                          {exp.notes && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {exp.notes}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={catMeta.color} size="sm" variant="light">
                            {catMeta.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={isCash ? "green" : "indigo"}
                            size="sm"
                            variant="dot"
                          >
                            {isCash ? "💵 Petty Cash" : exp.paymentMode}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{exp.paidTo || "—"}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Text fw={700} size="sm" c="orange.8">
                            ₹{formatINR(exp.amountPaise)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{exp.createdBy || "Staff"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label="Delete Expense">
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              size="sm"
                              onClick={() => handleDeleteExpense(exp.id, exp.title)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </Paper>

      {/* ─── MODAL 1: Record Expense ─── */}
      <Modal
        opened={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="teal" size="md" radius="md">
              <IconPlus size={16} />
            </ThemeIcon>
            <Text fw={700}>Record Expense / Petty Cash Out</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Expense Title / Description"
            placeholder="e.g. Milk & Dairy Supply, Indane Gas Refill, Ramesh Advance"
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.currentTarget.value)}
          />

          <SimpleGrid cols={2} spacing="sm">
            <NumberInput
              label="Amount (₹)"
              placeholder="e.g. 450"
              required
              min={1}
              prefix="₹ "
              value={newAmountRs}
              onChange={(val) => setNewAmountRs(val as any)}
            />

            <Select
              label="Payment Mode"
              required
              data={[
                { value: "CASH", label: "💵 Cash (Petty Cash Drawer)" },
                { value: "UPI", label: "📱 UPI / QR" },
                { value: "BANK_TRANSFER", label: "🏦 Bank Transfer" },
                { value: "CARD", label: "💳 Debit / Credit Card" },
              ]}
              value={newMode}
              onChange={(v) => setNewMode(v || "CASH")}
            />
          </SimpleGrid>

          <SimpleGrid cols={2} spacing="sm">
            <Select
              label="Category"
              required
              data={EXPENSE_CATEGORIES.map((c) => ({
                value: c,
                label: CATEGORY_METAS[c]?.label || c,
              }))}
              value={newCategory}
              onChange={(v) => setNewCategory(v || "OTHER")}
            />

            <TextInput
              label="Paid To (Vendor / Person)"
              placeholder="e.g. Mother Dairy, Sanjeev"
              value={newPaidTo}
              onChange={(e) => setNewPaidTo(e.currentTarget.value)}
            />
          </SimpleGrid>

          <Textarea
            label="Notes / Remarks (Optional)"
            placeholder="Additional details, voucher number, invoice ref..."
            rows={2}
            value={newNotes}
            onChange={(e) => setNewNotes(e.currentTarget.value)}
          />

          {newMode === "CASH" && (
            <Alert color="green" icon={<IconCash size={16} />}>
              <Text size="xs">
                This expense will be deducted from your daily <b>Counter Cash Drawer</b> float.
              </Text>
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setRecordModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="teal"
              loading={submittingExpense}
              onClick={handleRecordExpense}
              leftSection={<IconCheck size={16} />}
            >
              Save Expense
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL 2: Cash Register Opening Float & Count ─── */}
      <Modal
        opened={floatModalOpen}
        onClose={() => setFloatModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="green" size="md" radius="md">
              <IconCoin size={16} />
            </ThemeIcon>
            <Text fw={700}>Cash Drawer Float & Day Reconciliation</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Set your drawer opening float at start of shift, or count physical cash at closing to check for drawer discrepancies.
          </Text>

          <NumberInput
            label="Opening Cash Float (₹)"
            description="Petty cash already present in the drawer at the start of shift"
            placeholder="e.g. 2000"
            min={0}
            prefix="₹ "
            value={openingFloatRs}
            onChange={(val) => setOpeningFloatRs(val as any)}
          />

          <NumberInput
            label="Cash Dropped / Withdrawn (₹)"
            description="Cash taken out during shift to deposit into bank or handed to owner"
            placeholder="e.g. 5000"
            min={0}
            prefix="₹ "
            value={cashWithdrawnRs}
            onChange={(val) => setCashWithdrawnRs(val as any)}
          />

          <NumberInput
            label="Physical Counted Cash at Closing (₹)"
            description="Actual physical currency counted in drawer at 11:59 PM close"
            placeholder="e.g. 14500"
            min={0}
            prefix="₹ "
            value={closingCountedRs}
            onChange={(val) => setClosingCountedRs(val as any)}
          />

          <Textarea
            label="Reconciliation Notes"
            placeholder="Any cash shortage or explanation..."
            rows={2}
            value={floatNotes}
            onChange={(e) => setFloatNotes(e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setFloatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="green"
              loading={submittingFloat}
              onClick={handleSaveFloat}
              leftSection={<IconCheck size={16} />}
            >
              Update Cash Drawer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL 3: WhatsApp Closing Report Preview & Dispatch ─── */}
      <Modal
        opened={closingModalOpen}
        onClose={() => setClosingModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="green" size="md" radius="md">
              <IconBrandWhatsapp size={18} />
            </ThemeIcon>
            <Text fw={700}>Daily WhatsApp Business Closing Digest</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            This end-of-day digest is sent automatically at <b>11:59 PM</b> every night to the owner. You can also preview or trigger it on-demand right now.
          </Text>

          <TextInput
            label="Owner WhatsApp Mobile Number"
            placeholder="e.g. 9876543210"
            description="Indian 10-digit number. Report will be delivered instantly via WhatsApp Business API."
            required
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.currentTarget.value)}
            leftSection={<IconBrandWhatsapp size={16} color="green" />}
          />

          <Text fw={600} size="xs" mt="xs">Live Message Preview:</Text>
          <Box
            p="md"
            style={{
              backgroundColor: "#e5ddd5",
              borderRadius: "8px",
              fontFamily: "monospace",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              maxHeight: "340px",
              overflowY: "auto",
              color: "#111",
              border: "1px solid #ccc",
            }}
          >
            {previewLoading
              ? "Compiling today's sales and expense figures..."
              : previewData?.message || "No preview available."}
          </Box>

          <Group justify="space-between" mt="md">
            <Text size="xs" c="dimmed">
              Auto-Schedule: Daily at 11:59 PM (IST)
            </Text>
            <Group gap="sm">
              <Button variant="default" onClick={() => setClosingModalOpen(false)}>
                Close
              </Button>
              <Button
                color="green"
                loading={sendingReport}
                onClick={handleSendClosingReport}
                leftSection={<IconSend size={16} />}
              >
                Send via WhatsApp Now
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
