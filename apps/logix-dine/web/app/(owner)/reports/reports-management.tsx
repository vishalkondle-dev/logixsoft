"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Title, Text, Group, Stack, Paper, SimpleGrid, Loader, Center,
  Button, Select, Box, ActionIcon, ThemeIcon, Table, Badge,
  TextInput, SegmentedControl, Progress, Collapse, Divider, ScrollArea, Container,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { BarChart, LineChart, DonutChart } from "@mantine/charts";
import {
  IconChartPie, IconFileInvoice, IconReceipt2, IconChartHistogram,
  IconChartLine, IconPackages, IconCoinRupee, IconClockHour4,
  IconCalendarStats, IconCalendarMonth, IconCategory, IconArmchair,
  IconCreditCard, IconDiscount2, IconFileOff, IconCircleX,
  IconCalendar, IconArrowLeft, IconChevronRight, IconDownload,
  IconSearch, IconChevronDown, IconChevronUp, IconTrendingUp,
  IconUsers, IconShoppingBag, IconToolsKitchen2, IconFilter,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useReport } from "@/lib/queries";
import type { ReportType } from "@/lib/api-client";
import dayjs from "dayjs";

// ─── IST-aware preset -> date range translation ─────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDateStr(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

function istToday(): Date {
  return new Date(Date.now());
}

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
] as const;
type Preset = (typeof PRESETS)[number]["value"];

function presetToRange(preset: Preset): { from: string; to: string } {
  const now = istToday();
  const todayStr = istDateStr(now);
  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "yesterday": {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const s = istDateStr(y);
      return { from: s, to: s };
    }
    case "week": {
      const ist = new Date(now.getTime() + IST_OFFSET_MS);
      const dow = ist.getUTCDay();
      const diffToMonday = dow === 0 ? 6 : dow - 1;
      const monday = new Date(ist.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
      return { from: monday.toISOString().slice(0, 10), to: todayStr };
    }
    case "month": {
      const ist = new Date(now.getTime() + IST_OFFSET_MS);
      const first = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-01`;
      return { from: first, to: todayStr };
    }
    case "year": {
      const ist = new Date(now.getTime() + IST_OFFSET_MS);
      return { from: `${ist.getUTCFullYear()}-01-01`, to: todayStr };
    }
    case "all":
      return { from: "2024-01-01", to: todayStr };
    default:
      return { from: todayStr, to: todayStr };
  }
}

export interface ReportCardMeta {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  group: "overview" | "invoices" | "items" | "trends" | "channels" | "audit";
}

export const REPORT_CARDS: ReportCardMeta[] = [
  {
    id: "summary",
    title: "Summary",
    description: "Get a bird's-eye view of your business performance across sales, taxes, and payments.",
    icon: IconChartPie,
    color: "orange",
    group: "overview",
  },
  {
    id: "invoice-detail",
    title: "Invoice Detail",
    description: "Review comprehensive, line-by-line invoice details including customer and payment info.",
    icon: IconFileInvoice,
    color: "indigo",
    group: "invoices",
  },
  {
    id: "item-wise-invoice",
    title: "Item-wise Invoice",
    description: "View all invoices against individual items, variants, and addons in matrix format.",
    icon: IconReceipt2,
    color: "violet",
    group: "invoices",
  },
  {
    id: "sales-report",
    title: "Sales Report",
    description: "Track overall revenue trends, peak sales hours, and performance by day or month.",
    icon: IconChartHistogram,
    color: "blue",
    group: "overview",
  },
  {
    id: "average-order-value",
    title: "Average Order Value",
    description: "Monitor customer spending trends and track order efficiency over time.",
    icon: IconChartLine,
    color: "cyan",
    group: "overview",
  },
  {
    id: "gross-report",
    title: "Gross Report",
    description: "View item-wise gross sales performance before any deductions.",
    icon: IconPackages,
    color: "teal",
    group: "items",
  },
  {
    id: "net-sales-report",
    title: "Net Sales Report",
    description: "View item-wise sales performance after proportional discounts.",
    icon: IconCoinRupee,
    color: "emerald",
    group: "items",
  },
  {
    id: "sales-by-hour",
    title: "Sales by Hour",
    description: "Analyze peak sales periods to optimize staffing and kitchen operations.",
    icon: IconClockHour4,
    color: "grape",
    group: "trends",
  },
  {
    id: "sales-by-day",
    title: "Sales by Day",
    description: "Monitor daily revenue performance and order volume trends.",
    icon: IconCalendarStats,
    color: "blue",
    group: "trends",
  },
  {
    id: "sales-by-month",
    title: "Sales by Month",
    description: "Monitor monthly revenue performance and order volume trends.",
    icon: IconCalendarMonth,
    color: "indigo",
    group: "trends",
  },
  {
    id: "sales-by-order-type",
    title: "Sales by Order Type",
    description: "Analyze revenue distribution across different ordering channels.",
    icon: IconCategory,
    color: "orange",
    group: "channels",
  },
  {
    id: "sales-by-table",
    title: "Sales by Table",
    description: "Identify your most popular tables and floor areas.",
    icon: IconArmchair,
    color: "teal",
    group: "channels",
  },
  {
    id: "payment-methods",
    title: "Payment Methods",
    description: "Analyze revenue split across Cash, UPI, Cards, and other settlement channels.",
    icon: IconCreditCard,
    color: "green",
    group: "channels",
  },
  {
    id: "discount-report",
    title: "Discount Report",
    description: "Analyze discounts applied and their impact on overall sales.",
    icon: IconDiscount2,
    color: "yellow",
    group: "audit",
  },
  {
    id: "void-invoices",
    title: "Void Invoices",
    description: "Analyze voided transactions to identify patterns and prevent future occurrences.",
    icon: IconFileOff,
    color: "gray",
    group: "audit",
  },
  {
    id: "cancelled-invoices",
    title: "Cancelled Invoices",
    description: "Review cancelled invoices to understand cancellations and revenue impact.",
    icon: IconCircleX,
    color: "red",
    group: "audit",
  },
];

// Normalize legacy route slugs to their canonical card metadata
function resolveCanonicalReportType(type: ReportType): ReportType {
  switch (type) {
    case "top-items":
      return "gross-report";
    case "hourly":
      return "sales-by-hour";
    case "daily-trend":
      return "sales-by-day";
    case "orders-by-status":
      return "sales-by-order-type";
    default:
      return type;
  }
}

const rupees = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const rupeesExact = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (val: string | number | null | undefined) => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Reports Hub Grid ────────────────────────────────────────────────────────

export function ReportsCardsList() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return REPORT_CARDS.filter((c) => {
      if (groupFilter !== "all" && c.group !== groupFilter) return false;
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    });
  }, [search, groupFilter]);

  return (
    <Stack gap="lg" w="100%">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <TextInput
          placeholder="Search reports by name or topic..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setSearch(val);
          }}
          w={{ base: "100%", sm: 320 }}
          radius="md"
        />
        <ScrollArea type="never" w={{ base: "100%", md: "auto" }}>
          <SegmentedControl
            size="xs"
            radius="md"
            value={groupFilter}
            onChange={(val) => setGroupFilter(val)}
            data={[
              { label: "All Reports (16)", value: "all" },
              { label: "Overview", value: "overview" },
              { label: "Invoices", value: "invoices" },
              { label: "Items & Menu", value: "items" },
              { label: "Time Trends", value: "trends" },
              { label: "Channels & Tables", value: "channels" },
              { label: "Audits", value: "audit" },
            ]}
          />
        </ScrollArea>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          return (
            <Paper
              key={card.id}
              component={Link}
              href={`/settings/reports/${card.id}`}
              p="lg"
              radius="md"
              withBorder
              style={{
                textDecoration: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "transform 150ms ease, border-color 150ms ease",
              }}
            >
              <Group gap="md" align="flex-start" wrap="nowrap">
                <ThemeIcon size={44} radius="md" variant="light" color={card.color} style={{ flexShrink: 0 }}>
                  <Icon size={22} />
                </ThemeIcon>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" align="center" wrap="nowrap" mb={4}>
                    <Text fw={700} size="md" c="var(--mantine-color-text)" truncate>
                      {card.title}
                    </Text>
                    <IconChevronRight size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                  </Group>
                  <Text size="xs" c="dimmed" lh={1.45}>
                    {card.description}
                  </Text>
                </Box>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

// ─── Report Detail View ──────────────────────────────────────────────────────

export function ReportDetailView({ reportType }: { reportType: ReportType }) {
  const router = useRouter();
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const canonicalType = resolveCanonicalReportType(reportType);
  const cardMeta = REPORT_CARDS.find((c) => c.id === canonicalType) || REPORT_CARDS[0];
  const CardIcon = cardMeta.icon;

  const [preset, setPreset] = useState<Preset>("month");
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([null, null]);
  const [range, setRange] = useState(() => presetToRange("month"));

  useEffect(() => {
    if (preset === "custom") {
      if (customRange[0] && customRange[1]) {
        setRange({ from: istDateStr(customRange[0]), to: istDateStr(customRange[1]) });
      }
    } else {
      setRange(presetToRange(preset));
    }
  }, [preset, customRange]);

  const { data: reportResult, isLoading: loading } = useReport(
    restaurantId,
    canonicalType,
    range.from,
    range.to,
    outletId,
    !!restaurantId && !!outletId,
  );
  const data = reportResult?.data ?? null;

  const handleExportCsv = () => {
    if (!data) return;
    const prefix = `${canonicalType}_${range.from}_to_${range.to}`;
    const invoices = data.invoices || [];
    const items = data.itemsReport || [];
    const matrix = data.itemInvoiceMatrix || [];

    switch (canonicalType) {
      case "invoice-detail":
      case "discount-report":
      case "void-invoices":
      case "cancelled-invoices": {
        const filtered =
          canonicalType === "discount-report"
            ? invoices.filter((i: any) => i.discountPaise > 0)
            : canonicalType === "void-invoices"
              ? invoices.filter((i: any) => i.status === "VOID")
              : canonicalType === "cancelled-invoices"
                ? invoices.filter((i: any) => i.orderStatus === "CANCELLED" || i.cancelledItemsCount > 0)
                : invoices;
        downloadCsv(
          `${prefix}.csv`,
          ["Order No", "Date", "Channel", "Table", "Customer", "Status", "Payment", "Items Qty", "Gross (INR)", "Discount (INR)", "Tax (INR)", "Charges (INR)", "Paid (INR)"],
          filtered.map((inv: any) => [
            `#${inv.orderNo}`,
            dayjs(inv.createdAt).format("YYYY-MM-DD HH:mm"),
            inv.orderType,
            inv.tableNo,
            inv.customerPhone || "-",
            inv.orderStatus === "CANCELLED" ? "CANCELLED" : inv.status,
            inv.method || "-",
            inv.totalQty,
            (inv.grossPaise / 100).toFixed(2),
            (inv.discountPaise / 100).toFixed(2),
            (inv.totalTaxPaise / 100).toFixed(2),
            ((inv.packagingChargePaise + inv.deliveryChargePaise) / 100).toFixed(2),
            (inv.paidPaise / 100).toFixed(2),
          ]),
        );
        break;
      }
      case "item-wise-invoice": {
        downloadCsv(
          `${prefix}.csv`,
          ["Order No", "Date", "Item Name", "Category", "Variant", "Addons", "Qty", "Unit Price (INR)", "Gross (INR)", "Discount (INR)", "Net (INR)", "Payment", "Status"],
          matrix.map((r: any) => [
            `#${r.orderNo}`,
            dayjs(r.createdAt).format("YYYY-MM-DD HH:mm"),
            r.itemName,
            r.categoryName,
            r.variantName || "-",
            r.addonsText || "-",
            r.qty,
            (r.unitPricePaise / 100).toFixed(2),
            (r.grossPaise / 100).toFixed(2),
            (r.discountPaise / 100).toFixed(2),
            (r.netPaise / 100).toFixed(2),
            r.method,
            r.itemStatus,
          ]),
        );
        break;
      }
      case "gross-report":
      case "net-sales-report": {
        downloadCsv(
          `${prefix}.csv`,
          ["Item Name", "Category", "Unit Price (INR)", "Orders Count", "Qty Sold", "Gross Sales (INR)", "Allocated Discount (INR)", "Net Sales (INR)", "Allocated Tax (INR)", "Share %"],
          items.map((it: any) => [
            it.name,
            it.categoryName,
            (it.unitPricePaise / 100).toFixed(2),
            it.ordersCount,
            it.qtySold,
            (it.grossPaise / 100).toFixed(2),
            (it.discountAllocatedPaise / 100).toFixed(2),
            (it.netPaise / 100).toFixed(2),
            (it.taxAllocatedPaise / 100).toFixed(2),
            `${it.sharePercent}%`,
          ]),
        );
        break;
      }
      case "sales-by-hour": {
        downloadCsv(
          `${prefix}.csv`,
          ["Hour", "Paid Orders", "Items Sold", "Gross (INR)", "Discount (INR)", "Net (INR)", "Tax (INR)", "Total Revenue (INR)", "Avg Order Value (INR)"],
          (data.byHour || []).map((h: any) => [
            h.label,
            h.paidCount,
            h.itemsQty,
            (h.grossPaise / 100).toFixed(2),
            (h.discountPaise / 100).toFixed(2),
            (h.netPaise / 100).toFixed(2),
            (h.taxPaise / 100).toFixed(2),
            (h.revenuePaise / 100).toFixed(2),
            (h.avgOrderPaise / 100).toFixed(2),
          ]),
        );
        break;
      }
      case "sales-by-day":
      case "sales-report":
      case "average-order-value": {
        downloadCsv(
          `${prefix}.csv`,
          ["Date", "Day", "Paid Orders", "Items Sold", "Gross (INR)", "Discount (INR)", "Net (INR)", "Tax (INR)", "Revenue (INR)", "AOV (INR)"],
          (data.byDay || []).map((d: any) => [
            d.day,
            d.dayOfWeek,
            d.paidCount,
            d.itemsQty,
            (d.grossPaise / 100).toFixed(2),
            (d.discountPaise / 100).toFixed(2),
            (d.netPaise / 100).toFixed(2),
            (d.taxPaise / 100).toFixed(2),
            (d.revenuePaise / 100).toFixed(2),
            (d.avgOrderPaise / 100).toFixed(2),
          ]),
        );
        break;
      }
      case "sales-by-month": {
        downloadCsv(
          `${prefix}.csv`,
          ["Month", "Paid Orders", "Items Sold", "Gross (INR)", "Discount (INR)", "Net (INR)", "Tax (INR)", "Revenue (INR)", "AOV (INR)"],
          (data.byMonth || []).map((m: any) => [
            m.label,
            m.paidCount,
            m.itemsQty,
            (m.grossPaise / 100).toFixed(2),
            (m.discountPaise / 100).toFixed(2),
            (m.netPaise / 100).toFixed(2),
            (m.taxPaise / 100).toFixed(2),
            (m.revenuePaise / 100).toFixed(2),
            (m.avgOrderPaise / 100).toFixed(2),
          ]),
        );
        break;
      }
      case "sales-by-table": {
        downloadCsv(
          `${prefix}.csv`,
          ["Table", "Section", "Capacity", "Paid Orders", "Items Sold", "Gross (INR)", "Discount (INR)", "Revenue (INR)", "AOV (INR)", "Share %"],
          (data.byTable || []).map((t: any) => [
            t.tableNo,
            t.section,
            t.capacity,
            t.paidCount,
            t.itemsQty,
            (t.grossPaise / 100).toFixed(2),
            (t.discountPaise / 100).toFixed(2),
            (t.revenuePaise / 100).toFixed(2),
            (t.avgOrderPaise / 100).toFixed(2),
            `${t.sharePercent}%`,
          ]),
        );
        break;
      }
      default: {
        const s = data.summary || data;
        downloadCsv(
          `${prefix}.csv`,
          ["Metric", "Value"],
          [
            ["Paid Orders", s.paidCount],
            ["Gross Sales (INR)", (s.grossSalesPaise / 100).toFixed(2)],
            ["Discounts (INR)", (s.discountPaise / 100).toFixed(2)],
            ["Net Sales (INR)", (s.netSalesPaise / 100).toFixed(2)],
            ["Total Tax (INR)", (s.totalTaxPaise / 100).toFixed(2)],
            ["Collected Revenue (INR)", (s.revenuePaise / 100).toFixed(2)],
            ["Average Order Value (INR)", (s.avgOrderPaise / 100).toFixed(2)],
          ],
        );
      }
    }
  };

  if (!restaurant) return null;
  if (!activeOutlet) {
    return (
      <Center py={80}>
        <Loader color="dinePrimary" />
      </Center>
    );
  }

  return (
    <Container fluid px={{ base: "md", sm: "xl", lg: 32 }} py="lg" pb={120} w="100%">
      <Stack gap="lg" w="100%">
        {/* Header Bar */}
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
            <Group gap="sm" align="center" wrap="nowrap">
              <ActionIcon
                component={Link}
                href="/settings/reports"
                variant="light"
                color="gray"
                size="lg"
                radius="md"
                aria-label="Back to Reports"
              >
                <IconArrowLeft size={20} />
              </ActionIcon>
              <ThemeIcon size={42} radius="md" variant="light" color={cardMeta.color}>
                <CardIcon size={22} />
              </ThemeIcon>
              <Box>
                <Group gap="xs" align="center">
                  <Title order={3} lh={1.2}>
                    {cardMeta.title}
                  </Title>
                  <Badge variant="light" color={cardMeta.color} size="sm">
                    {activeOutlet.name}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  {cardMeta.description}
                </Text>
              </Box>
            </Group>

            {/* Controls: Report Switcher + Date Range + Export CSV */}
            <Group gap="xs" align="center" wrap="wrap">
              <Select
                size="sm"
                value={canonicalType}
                onChange={(val) => {
                  if (val) router.push(`/settings/reports/${val}`);
                }}
                data={REPORT_CARDS.map((c) => ({ value: c.id, label: c.title }))}
                w={{ base: "100%", xs: 190 }}
                allowDeselect={false}
                aria-label="Switch report"
                comboboxProps={{ withinPortal: true, zIndex: 1500 }}
              />

              <Select
                size="sm"
                value={preset}
                onChange={(val) => val && setPreset(val as Preset)}
                data={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                leftSection={<IconCalendar size={15} />}
                w={{ base: "100%", xs: 155 }}
                allowDeselect={false}
                aria-label="Duration"
                comboboxProps={{ withinPortal: true, zIndex: 1500 }}
              />

              {preset === "custom" && (
                <DatePickerInput
                  type="range"
                  placeholder="Select date range"
                  valueFormat="DD MMM YYYY"
                  labelSeparator="-"
                  value={customRange}
                  onChange={(v: [string | null, string | null] | null) => {
                    if (!v) {
                      setCustomRange([null, null]);
                      return;
                    }
                    setCustomRange([v[0] ? new Date(v[0]) : null, v[1] ? new Date(v[1]) : null]);
                  }}
                  size="sm"
                  w={{ base: "100%", xs: 230 }}
                  popoverProps={{ withinPortal: true, zIndex: 1500 }}
                />
              )}

              <Button
                variant="light"
                color="dinePrimary"
                size="sm"
                leftSection={<IconDownload size={16} />}
                onClick={handleExportCsv}
                disabled={!data}
              >
                Export CSV
              </Button>
            </Group>
          </Group>

          <Group justify="space-between" align="center" mt="xs" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
            <Text size="xs" c="dimmed">
              Reporting Period: <Text span fw={600} c="var(--mantine-color-text)">{dayjs(range.from).format("DD MMM YYYY")} – {dayjs(range.to).format("DD MMM YYYY")}</Text>
            </Text>
            {data?.summary && (
              <Group gap="md">
                <Text size="xs" c="dimmed">
                  Paid Orders: <Text span fw={700} c="teal">{data.summary.paidCount}</Text>
                </Text>
                <Text size="xs" c="dimmed">
                  Collected Revenue: <Text span fw={700} c="dinePrimary">{rupees(data.summary.revenuePaise)}</Text>
                </Text>
              </Group>
            )}
          </Group>
        </Paper>

        {loading ? (
          <Center py={80}>
            <Loader color="dinePrimary" />
          </Center>
        ) : !data ? (
          <Paper p="xl" radius="md" withBorder>
            <Text c="dimmed" ta="center" py="xl">
              No analytics data found for this period.
            </Text>
          </Paper>
        ) : (
          <ReportContentSwitch type={canonicalType} data={data} />
        )}
      </Stack>
    </Container>
  );
}

export function ReportsManagement({ embedded = false, reportType }: { embedded?: boolean; reportType?: ReportType }) {
  if (reportType) {
    return <ReportDetailView reportType={reportType} />;
  }
  if (!embedded) {
    return (
      <Container fluid px={{ base: "md", sm: "xl", lg: 32 }} py="lg" pb={120} w="100%">
        <ReportsCardsList />
      </Container>
    );
  }
  return <ReportsCardsList />;
}

// ─── Shared UI Helpers ───────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sublabel,
  color = "dinePrimary",
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
  icon?: React.ElementType;
}) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb={6}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: 0.4 }}>
          {label}
        </Text>
        {Icon && (
          <ThemeIcon size={28} radius="md" variant="light" color={color}>
            <Icon size={16} />
          </ThemeIcon>
        )}
      </Group>
      <Text size="xl" fw={800} c={color} lh={1.2}>
        {value}
      </Text>
      {sublabel && (
        <Text size="xs" c="dimmed" mt={4}>
          {sublabel}
        </Text>
      )}
    </Paper>
  );
}

function ReportContentSwitch({ type, data }: { type: ReportType; data: any }) {
  switch (type) {
    case "summary":
      return <SummaryReportPanel data={data} />;
    case "invoice-detail":
      return <InvoiceDetailReportPanel data={data} mode="all" />;
    case "item-wise-invoice":
      return <ItemWiseInvoiceReportPanel data={data} />;
    case "sales-report":
      return <SalesReportPanel data={data} />;
    case "average-order-value":
      return <AverageOrderValueReportPanel data={data} />;
    case "gross-report":
      return <GrossNetItemsReportPanel data={data} mode="gross" />;
    case "net-sales-report":
      return <GrossNetItemsReportPanel data={data} mode="net" />;
    case "sales-by-hour":
      return <SalesByHourReportPanel data={data} />;
    case "sales-by-day":
      return <SalesByDayReportPanel data={data} />;
    case "sales-by-month":
      return <SalesByMonthReportPanel data={data} />;
    case "sales-by-order-type":
      return <SalesByOrderTypeReportPanel data={data} />;
    case "sales-by-table":
      return <SalesByTableReportPanel data={data} />;
    case "payment-methods":
      return <PaymentMethodsReportPanel data={data} />;
    case "discount-report":
      return <InvoiceDetailReportPanel data={data} mode="discount" />;
    case "void-invoices":
      return <InvoiceDetailReportPanel data={data} mode="void" />;
    case "cancelled-invoices":
      return <CancelledInvoicesReportPanel data={data} />;
    default:
      return <SummaryReportPanel data={data} />;
  }
}

// ─── 1. SUMMARY REPORT ───────────────────────────────────────────────────────

function SummaryReportPanel({ data }: { data: any }) {
  const s = data.summary || data;
  const byOrderType = data.byOrderType || [];
  const byPaymentMethod = data.byPaymentMethod || [];
  const byCategory = data.byCategory || [];
  const topItems = (data.itemsReport || []).slice(0, 6);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard
          label="Gross Sales"
          value={rupees(s.grossSalesPaise ?? s.revenuePaise)}
          sublabel={`${s.totalItemsSoldQty ?? 0} total items sold`}
          color="indigo"
          icon={IconPackages}
        />
        <KpiCard
          label="Net Sales (Excl. Tax)"
          value={rupees(s.netSalesPaise ?? s.revenuePaise)}
          sublabel={`After ${rupees(s.discountPaise ?? 0)} discounts`}
          color="teal"
          icon={IconCoinRupee}
        />
        <KpiCard
          label="Taxes & Charges"
          value={rupees((s.totalTaxPaise ?? 0) + (s.packagingChargePaise ?? 0) + (s.deliveryChargePaise ?? 0))}
          sublabel={`Tax: ${rupees(s.totalTaxPaise ?? 0)} · Pkg/Del: ${rupees((s.packagingChargePaise ?? 0) + (s.deliveryChargePaise ?? 0))}`}
          color="orange"
          icon={IconReceipt2}
        />
        <KpiCard
          label="Total Collected Revenue"
          value={rupees(s.revenuePaise ?? 0)}
          sublabel={`${s.paidCount ?? 0} settled invoices`}
          color="dinePrimary"
          icon={IconChartPie}
        />
        <KpiCard
          label="Average Order Value"
          value={rupees(s.avgOrderPaise ?? 0)}
          sublabel={`${s.avgItemsPerOrder ?? 0} avg items / order`}
          color="cyan"
          icon={IconChartLine}
        />
        <KpiCard
          label="Open / Unsettled Bills"
          value={`${s.openCount ?? 0} Orders`}
          sublabel={`Pending value: ${rupees(s.openRevenuePaise ?? 0)}`}
          color="blue"
          icon={IconClockHour4}
        />
        <KpiCard
          label="Discounts Given"
          value={rupees(s.discountPaise ?? 0)}
          sublabel={`${s.discountedOrdersCount ?? 0} discounted bills`}
          color="yellow"
          icon={IconDiscount2}
        />
        <KpiCard
          label="Voids & Cancellations"
          value={`${(s.voidCount ?? 0) + (s.cancelledOrdersCount ?? 0)} Orders`}
          sublabel={`Impact: ${rupees((s.voidRevenuePaise ?? 0) + (s.cancelledRevenuePaise ?? 0))}`}
          color="red"
          icon={IconCircleX}
        />
      </SimpleGrid>

      {/* Financial Waterfall + Payment & Channel Split */}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">
            Financial Accounting Breakdown
          </Title>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Gross Item & Charge Value</Text>
              <Text size="sm" fw={600}>{rupeesExact(s.grossSalesPaise ?? s.revenuePaise)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Less: Bill Discounts</Text>
              <Text size="sm" fw={600} c="red">- {rupeesExact(s.discountPaise ?? 0)}</Text>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={600}>Net Food & Beverage Sales</Text>
              <Text size="sm" fw={700} c="teal">{rupeesExact(s.netSalesPaise ?? s.revenuePaise)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">CGST Collected</Text>
              <Text size="xs">{rupeesExact(s.totalCgstPaise ?? 0)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">SGST Collected</Text>
              <Text size="xs">{rupeesExact(s.totalSgstPaise ?? 0)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Service Charge</Text>
              <Text size="xs">{rupeesExact(s.totalServiceChargePaise ?? 0)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Packaging & Delivery Fees</Text>
              <Text size="xs">{rupeesExact((s.packagingChargePaise ?? 0) + (s.deliveryChargePaise ?? 0))}</Text>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="md" fw={800}>Total Collected Revenue</Text>
              <Text size="md" fw={800} c="dinePrimary">{rupeesExact(s.revenuePaise ?? 0)}</Text>
            </Group>
          </Stack>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">
            Revenue by Order Channel
          </Title>
          <Stack gap="md">
            {byOrderType.map((ot: any) => (
              <Box key={ot.orderType}>
                <Group justify="space-between" mb={4}>
                  <Group gap="xs">
                    <Badge variant="light" color={ot.orderType === "DINE_IN" ? "teal" : ot.orderType === "TAKEAWAY" ? "orange" : "indigo"}>
                      {ot.label}
                    </Badge>
                    <Text size="xs" c="dimmed">{ot.paidCount} orders</Text>
                  </Group>
                  <Text size="sm" fw={700}>{rupees(ot.revenuePaise)} ({ot.sharePercent}%)</Text>
                </Group>
                <Progress
                  value={ot.sharePercent}
                  color={ot.orderType === "DINE_IN" ? "teal" : ot.orderType === "TAKEAWAY" ? "orange" : "indigo"}
                  size="md"
                  radius="xl"
                />
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">
            Payment Mode Settlement
          </Title>
          {byPaymentMethod.length === 0 ? (
            <Text size="sm" c="dimmed" py="xl" ta="center">No settled payments in this range</Text>
          ) : (
            <Stack gap="sm">
              {byPaymentMethod.map((pm: any) => (
                <Box key={pm.method}>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={600}>{pm.method}</Text>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">{pm.count} bills</Text>
                      <Text size="sm" fw={700} c="dinePrimary">{rupees(pm.revenuePaise)}</Text>
                    </Group>
                  </Group>
                  <Progress value={pm.sharePercent} color="grape" size="sm" radius="xl" />
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </SimpleGrid>

      {/* Top Categories & Top Items */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={5}>Top Performing Categories</Title>
            <Button component={Link} href="/settings/reports/gross-report" variant="subtle" size="xs">
              View All
            </Button>
          </Group>
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="xs" miw={360}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th ta="right">Qty Sold</Table.Th>
                  <Table.Th ta="right">Gross Sales</Table.Th>
                  <Table.Th ta="right">Share</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {byCategory.slice(0, 6).map((cat: any) => (
                  <Table.Tr key={cat.categoryName}>
                    <Table.Td fw={600}>{cat.categoryName}</Table.Td>
                    <Table.Td ta="right">{cat.qtySold}</Table.Td>
                    <Table.Td ta="right" fw={600}>{rupees(cat.grossPaise)}</Table.Td>
                    <Table.Td ta="right">
                      <Badge variant="light" color="teal" size="sm">{cat.sharePercent}%</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={5}>Top Selling Menu Items</Title>
            <Button component={Link} href="/settings/reports/gross-report" variant="subtle" size="xs">
              View Full Item Report
            </Button>
          </Group>
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="xs" miw={360}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                  <Table.Th ta="right">Gross</Table.Th>
                  <Table.Th ta="right">Net</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {topItems.map((it: any) => (
                  <Table.Tr key={it.key || it.itemId}>
                    <Table.Td>
                      <Text size="sm" fw={600} lineClamp={1}>{it.name}</Text>
                      <Text size="xs" c="dimmed">{it.categoryName}</Text>
                    </Table.Td>
                    <Table.Td ta="right" fw={600}>{it.qtySold}</Table.Td>
                    <Table.Td ta="right">{rupees(it.grossPaise)}</Table.Td>
                    <Table.Td ta="right" fw={700} c="teal">{rupees(it.netPaise)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

// ─── 2, 14, 15. INVOICE DETAIL / DISCOUNT / VOID REPORTS ─────────────────────

function InvoiceDetailReportPanel({
  data,
  mode,
}: {
  data: any;
  mode: "all" | "discount" | "void";
}) {
  const rawInvoices: any[] = data.invoices || [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawInvoices.filter((inv) => {
      if (mode === "discount" && !(inv.discountPaise > 0)) return false;
      if (mode === "void" && inv.status !== "VOID") return false;
      if (statusFilter !== "ALL") {
        if (statusFilter === "CANCELLED" && inv.orderStatus !== "CANCELLED") return false;
        if (statusFilter !== "CANCELLED" && inv.status !== statusFilter) return false;
      }
      if (channelFilter !== "ALL" && inv.orderType !== channelFilter) return false;
      if (!q) return true;
      const matchNo = String(inv.orderNo).includes(q);
      const matchTable = String(inv.tableNo || "").toLowerCase().includes(q);
      const matchPhone = String(inv.customerPhone || "").toLowerCase().includes(q);
      const matchItem = (inv.items || []).some((i: any) => String(i.name || "").toLowerCase().includes(q));
      return matchNo || matchTable || matchPhone || matchItem;
    });
  }, [rawInvoices, mode, statusFilter, channelFilter, search]);

  const totalGross = filtered.reduce((s, i) => s + (i.grossPaise || 0), 0);
  const totalDiscount = filtered.reduce((s, i) => s + (i.discountPaise || 0), 0);
  const totalTax = filtered.reduce((s, i) => s + (i.totalTaxPaise || 0), 0);
  const totalPaid = filtered.reduce((s, i) => s + (i.paidPaise || 0), 0);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard
          label={mode === "void" ? "Voided Invoices" : mode === "discount" ? "Discounted Invoices" : "Matching Invoices"}
          value={String(filtered.length)}
          sublabel={`Out of ${rawInvoices.length} total invoices`}
          color={mode === "void" ? "gray" : "indigo"}
          icon={IconFileInvoice}
        />
        <KpiCard
          label="Gross Invoice Value"
          value={rupees(totalGross)}
          sublabel="Before discounts & taxes"
          color="blue"
          icon={IconPackages}
        />
        <KpiCard
          label="Total Discounts Applied"
          value={rupees(totalDiscount)}
          sublabel={totalGross > 0 ? `${((totalDiscount / totalGross) * 100).toFixed(1)}% of gross value` : "0% of gross"}
          color="yellow"
          icon={IconDiscount2}
        />
        <KpiCard
          label={mode === "void" ? "Voided Value" : "Net Collected Value"}
          value={rupees(mode === "void" ? totalGross : totalPaid)}
          sublabel={`Includes ${rupees(totalTax)} taxes`}
          color={mode === "void" ? "red" : "teal"}
          icon={IconCoinRupee}
        />
      </SimpleGrid>

      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search by Order #, Table, Phone, or Item..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              const val = e.currentTarget.value;
              setSearch(val);
            }}
            w={{ base: "100%", sm: 300 }}
          />
          <Group gap="xs" wrap="wrap">
            {mode === "all" && (
              <Select
                size="xs"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v || "ALL")}
                data={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "PAID", label: "Paid Only" },
                  { value: "OPEN", label: "Open / Unpaid" },
                  { value: "VOID", label: "Void" },
                  { value: "CANCELLED", label: "Cancelled" },
                ]}
                w={140}
              />
            )}
            <Select
              size="xs"
              value={channelFilter}
              onChange={(v) => setChannelFilter(v || "ALL")}
              data={[
                { value: "ALL", label: "All Channels" },
                { value: "DINE_IN", label: "Dine-In" },
                { value: "TAKEAWAY", label: "Takeaway" },
                { value: "DELIVERY", label: "Delivery" },
              ]}
              w={140}
            />
          </Group>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={900}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 40 }} />
                <Table.Th>Order #</Table.Th>
                <Table.Th>Date & Time</Table.Th>
                <Table.Th>Channel / Table</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th ta="right">Items</Table.Th>
                <Table.Th ta="right">Gross</Table.Th>
                <Table.Th ta="right">Discount</Table.Th>
                <Table.Th ta="right">Tax & Fees</Table.Th>
                <Table.Th ta="right">Settled</Table.Th>
                <Table.Th>Payment</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={12} ta="center" py="xl" c="dimmed">
                    No invoices match your filter criteria.
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((inv) => {
                  const isExpanded = expandedId === inv.id;
                  const statusLabel = inv.orderStatus === "CANCELLED" ? "CANCELLED" : inv.status;
                  const statusColor =
                    statusLabel === "PAID" ? "teal" : statusLabel === "OPEN" ? "blue" : statusLabel === "CANCELLED" ? "red" : "gray";

                  return (
                    <React.Fragment key={inv.id}>
                      <Table.Tr
                        style={{ cursor: "pointer" }}
                        onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      >
                        <Table.Td>
                          <ActionIcon variant="subtle" size="sm" color="gray">
                            {isExpanded ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />}
                          </ActionIcon>
                        </Table.Td>
                        <Table.Td fw={700}>#{inv.orderNo}</Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={500}>{dayjs(inv.createdAt).format("DD MMM YYYY")}</Text>
                          <Text size="xs" c="dimmed">{dayjs(inv.createdAt).format("hh:mm A")}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" size="xs" color={inv.orderType === "DINE_IN" ? "teal" : inv.orderType === "TAKEAWAY" ? "orange" : "indigo"}>
                            {inv.orderType}
                          </Badge>
                          <Text size="xs" fw={600} mt={2}>{inv.tableNo}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">{inv.customerPhone || "Walk-in Guest"}</Text>
                        </Table.Td>
                        <Table.Td ta="right" fw={600}>{inv.totalQty}</Table.Td>
                        <Table.Td ta="right">{rupees(inv.grossPaise)}</Table.Td>
                        <Table.Td ta="right" c={inv.discountPaise > 0 ? "red" : "dimmed"} fw={inv.discountPaise > 0 ? 700 : 400}>
                          {inv.discountPaise > 0 ? `- ${rupees(inv.discountPaise)}` : "₹0"}
                        </Table.Td>
                        <Table.Td ta="right">{rupees(inv.totalTaxPaise + inv.packagingChargePaise + inv.deliveryChargePaise)}</Table.Td>
                        <Table.Td ta="right" fw={700} c="dinePrimary">{rupees(inv.paidPaise)}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="gray" size="xs">{inv.method || "-"}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={statusColor} size="sm">{statusLabel}</Badge>
                        </Table.Td>
                      </Table.Tr>
                      {isExpanded && (
                        <Table.Tr>
                          <Table.Td colSpan={12} bg="var(--mantine-color-default-hover)" p="md">
                            <Stack gap="xs">
                              <Group justify="space-between">
                                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                                  Line Items for Invoice #{inv.orderNo} ({inv.tableSection})
                                </Text>
                                {inv.note && <Text size="xs" c="orange">Order Note: {inv.note}</Text>}
                              </Group>
                              <Table withTableBorder verticalSpacing="xs" bg="var(--mantine-color-body)">
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Item Name</Table.Th>
                                    <Table.Th>Category</Table.Th>
                                    <Table.Th>Variant / Addons</Table.Th>
                                    <Table.Th ta="right">Qty</Table.Th>
                                    <Table.Th ta="right">Unit Price</Table.Th>
                                    <Table.Th ta="right">Line Total</Table.Th>
                                    <Table.Th>Kitchen Status</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {(inv.items || []).map((item: any) => (
                                    <Table.Tr key={item.id}>
                                      <Table.Td fw={600}>{item.name}</Table.Td>
                                      <Table.Td>{item.categoryName}</Table.Td>
                                      <Table.Td>
                                        <Text size="xs" c="dimmed">
                                          {[item.variantName, item.addonsText].filter(Boolean).join(" + ") || "-"}
                                        </Text>
                                      </Table.Td>
                                      <Table.Td ta="right" fw={600}>{item.qty}</Table.Td>
                                      <Table.Td ta="right">{rupees(item.unitPricePaise)}</Table.Td>
                                      <Table.Td ta="right" fw={700}>{rupees(item.lineTotalPaise)}</Table.Td>
                                      <Table.Td>
                                        <Badge size="xs" color={item.status === "CANCELLED" ? "red" : "teal"} variant="light">
                                          {item.status}
                                        </Badge>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </Stack>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 3. ITEM-WISE INVOICE (MATRIX & LEDGER) ──────────────────────────────────

function ItemWiseInvoiceReportPanel({ data }: { data: any }) {
  const rows: any[] = data.itemInvoiceMatrix || [];
  const [viewMode, setViewMode] = useState<"ledger" | "matrix">("ledger");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.itemName || "").toLowerCase().includes(q) ||
        String(r.categoryName || "").toLowerCase().includes(q) ||
        String(r.orderNo).includes(q) ||
        String(r.tableNo || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Build Pivot Matrix: Top 20 recent invoices as columns, items as rows
  const matrixData = useMemo(() => {
    const invoiceNos = Array.from(new Set(filtered.map((r) => r.orderNo))).slice(0, 15);
    const itemMap = new Map<string, { itemName: string; categoryName: string; byOrder: Record<number, number>; totalQty: number; totalGross: number }>();

    for (const r of filtered) {
      if (r.itemStatus === "CANCELLED") continue;
      const key = `${r.itemName}${r.variantName ? ` (${r.variantName})` : ""}`;
      let entry = itemMap.get(key);
      if (!entry) {
        entry = { itemName: key, categoryName: r.categoryName, byOrder: {}, totalQty: 0, totalGross: 0 };
        itemMap.set(key, entry);
      }
      entry.byOrder[r.orderNo] = (entry.byOrder[r.orderNo] || 0) + r.qty;
      entry.totalQty += r.qty;
      entry.totalGross += r.grossPaise;
    }

    return {
      invoiceNos,
      items: Array.from(itemMap.values()).sort((a, b) => b.totalQty - a.totalQty),
    };
  }, [filtered]);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard
          label="Total Item Line Entries"
          value={String(filtered.length)}
          sublabel="Across all matching invoices"
          color="violet"
          icon={IconReceipt2}
        />
        <KpiCard
          label="Unique Menu Items Sold"
          value={String(matrixData.items.length)}
          sublabel="Including active variants"
          color="indigo"
          icon={IconToolsKitchen2}
        />
        <KpiCard
          label="Total Units Dispatched"
          value={String(filtered.reduce((s, r) => s + (r.itemStatus !== "CANCELLED" ? r.qty : 0), 0))}
          sublabel="Active non-cancelled portions"
          color="teal"
          icon={IconPackages}
        />
        <KpiCard
          label="Net Item Revenue"
          value={rupees(filtered.reduce((s, r) => s + (r.itemStatus !== "CANCELLED" ? r.netPaise : 0), 0))}
          sublabel="After proportional discounts"
          color="dinePrimary"
          icon={IconCoinRupee}
        />
      </SimpleGrid>

      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
          <TextInput
            placeholder="Filter by item name, category, or invoice #..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              const val = e.currentTarget.value;
              setSearch(val);
            }}
            w={{ base: "100%", sm: 320 }}
          />
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as "ledger" | "matrix")}
            data={[
              { label: "Line-Item Invoice Ledger", value: "ledger" },
              { label: "Item × Invoice Matrix", value: "matrix" },
            ]}
          />
        </Group>

        {viewMode === "ledger" ? (
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="xs" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice #</Table.Th>
                  <Table.Th>Date & Time</Table.Th>
                  <Table.Th>Item Name</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Variant / Addons</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                  <Table.Th ta="right">Unit Price</Table.Th>
                  <Table.Th ta="right">Gross</Table.Th>
                  <Table.Th ta="right">Discount</Table.Th>
                  <Table.Th ta="right">Net Value</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td fw={700}>#{r.orderNo}</Table.Td>
                    <Table.Td>
                      <Text size="xs">{dayjs(r.createdAt).format("DD MMM, hh:mm A")}</Text>
                    </Table.Td>
                    <Table.Td fw={600}>{r.itemName}</Table.Td>
                    <Table.Td>{r.categoryName}</Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {[r.variantName, r.addonsText].filter(Boolean).join(" + ") || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right" fw={700}>{r.qty}</Table.Td>
                    <Table.Td ta="right">{rupees(r.unitPricePaise)}</Table.Td>
                    <Table.Td ta="right">{rupees(r.grossPaise)}</Table.Td>
                    <Table.Td ta="right" c={r.discountPaise > 0 ? "red" : "dimmed"}>
                      {r.discountPaise > 0 ? `- ${rupees(r.discountPaise)}` : "₹0"}
                    </Table.Td>
                    <Table.Td ta="right" fw={700} c="teal">{rupees(r.netPaise)}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color={r.itemStatus === "CANCELLED" ? "red" : "teal"}>
                        {r.itemStatus}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <ScrollArea>
            <Table withTableBorder withColumnBorders striped highlightOnHover verticalSpacing="xs" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Menu Item</Table.Th>
                  <Table.Th>Category</Table.Th>
                  {matrixData.invoiceNos.map((no) => (
                    <Table.Th key={no} ta="center">#{no}</Table.Th>
                  ))}
                  <Table.Th ta="right">Total Qty</Table.Th>
                  <Table.Th ta="right">Gross Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {matrixData.items.map((row) => (
                  <Table.Tr key={row.itemName}>
                    <Table.Td fw={600}>{row.itemName}</Table.Td>
                    <Table.Td>{row.categoryName}</Table.Td>
                    {matrixData.invoiceNos.map((no) => (
                      <Table.Td key={no} ta="center" fw={row.byOrder[no] ? 700 : 400} c={row.byOrder[no] ? "dinePrimary" : "dimmed"}>
                        {row.byOrder[no] || "–"}
                      </Table.Td>
                    ))}
                    <Table.Td ta="right" fw={800}>{row.totalQty}</Table.Td>
                    <Table.Td ta="right" fw={700} c="teal">{rupees(row.totalGross)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>
    </Stack>
  );
}

// ─── 4. SALES REPORT ─────────────────────────────────────────────────────────

function SalesReportPanel({ data }: { data: any }) {
  const s = data.summary || data;
  const byDay = data.byDay || [];
  const byCategory = data.byCategory || [];

  const chartData = byDay.map((d: any) => ({
    day: `${d.day.slice(5)} (${d.dayOfWeek})`,
    "Gross Sales": Math.round(d.grossPaise / 100),
    "Net Collected": Math.round(d.revenuePaise / 100),
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard label="Total Gross Sales" value={rupees(s.grossSalesPaise)} sublabel={`${s.paidCount} paid orders`} color="indigo" icon={IconChartHistogram} />
        <KpiCard label="Net Sales (Excl. Tax)" value={rupees(s.netSalesPaise)} sublabel={`After ${rupees(s.discountPaise)} discounts`} color="teal" icon={IconCoinRupee} />
        <KpiCard label="Total Taxes Collected" value={rupees(s.totalTaxPaise)} sublabel="CGST + SGST + Service Charge" color="orange" icon={IconReceipt2} />
        <KpiCard label="Total Revenue Collected" value={rupees(s.revenuePaise)} sublabel={`Avg ${rupees(s.avgOrderPaise)} / order`} color="dinePrimary" icon={IconTrendingUp} />
      </SimpleGrid>

      {chartData.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Gross vs Net Collected Sales Progression</Title>
          <BarChart
            h={320}
            data={chartData}
            dataKey="day"
            series={[
              { name: "Gross Sales", color: "indigo.5" },
              { name: "Net Collected", color: "teal.6" },
            ]}
            withLegend
            valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </Paper>
      )}

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Category-wise Sales Performance</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={750}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Orders</Table.Th>
                <Table.Th ta="right">Units Sold</Table.Th>
                <Table.Th ta="right">Gross Sales</Table.Th>
                <Table.Th ta="right">Discounts</Table.Th>
                <Table.Th ta="right">Net Sales</Table.Th>
                <Table.Th style={{ width: 180 }}>Revenue Share</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {byCategory.map((cat: any) => (
                <Table.Tr key={cat.categoryName}>
                  <Table.Td fw={700}>{cat.categoryName}</Table.Td>
                  <Table.Td ta="right">{cat.ordersCount}</Table.Td>
                  <Table.Td ta="right" fw={600}>{cat.qtySold}</Table.Td>
                  <Table.Td ta="right">{rupees(cat.grossPaise)}</Table.Td>
                  <Table.Td ta="right" c="red">{cat.discountPaise > 0 ? `- ${rupees(cat.discountPaise)}` : "₹0"}</Table.Td>
                  <Table.Td ta="right" fw={700} c="teal">{rupees(cat.netPaise)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Progress value={cat.sharePercent} color="teal" size="sm" radius="xl" style={{ flex: 1 }} />
                      <Text size="xs" fw={600} w={42} ta="right">{cat.sharePercent}%</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 5. AVERAGE ORDER VALUE REPORT ───────────────────────────────────────────

function AverageOrderValueReportPanel({ data }: { data: any }) {
  const s = data.summary || data;
  const byDay = data.byDay || [];
  const byOrderType = data.byOrderType || [];
  const paidInvoices = (data.invoices || []).filter((i: any) => i.status === "PAID" && i.orderStatus !== "CANCELLED");

  const highestOrderPaise = paidInvoices.reduce((max: number, i: any) => Math.max(max, i.paidPaise || 0), 0);
  const lowestOrderPaise = paidInvoices.length > 0
    ? paidInvoices.reduce((min: number, i: any) => Math.min(min, i.paidPaise || Infinity), Infinity)
    : 0;

  const chartData = byDay.map((d: any) => ({
    day: d.day.slice(5),
    "Avg Order Value": Math.round((d.avgOrderPaise || 0) / 100),
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard label="Average Order Value (AOV)" value={rupees(s.avgOrderPaise)} sublabel={`Across ${s.paidCount} paid bills`} color="cyan" icon={IconChartLine} />
        <KpiCard label="Highest Single Bill" value={rupees(highestOrderPaise)} sublabel="Peak customer spend" color="teal" icon={IconTrendingUp} />
        <KpiCard label="Lowest Settled Bill" value={rupees(lowestOrderPaise === Infinity ? 0 : lowestOrderPaise)} sublabel="Minimum ticket size" color="gray" icon={IconReceipt2} />
        <KpiCard label="Avg Items per Order" value={`${s.avgItemsPerOrder ?? 0} Items`} sublabel={`${s.uniqueCustomersCount ?? 0} unique phones`} color="indigo" icon={IconUsers} />
      </SimpleGrid>

      {chartData.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Daily Average Order Value (AOV) Trend</Title>
          <LineChart
            h={300}
            data={chartData}
            dataKey="day"
            series={[{ name: "Avg Order Value", color: "cyan.6" }]}
            curveType="monotone"
            valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </Paper>
      )}

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Average Spend Efficiency by Channel</Title>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {byOrderType.map((ot: any) => (
            <Paper key={ot.orderType} p="md" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Badge color={ot.orderType === "DINE_IN" ? "teal" : ot.orderType === "TAKEAWAY" ? "orange" : "indigo"}>
                  {ot.label}
                </Badge>
                <Text size="xs" c="dimmed">{ot.paidCount} paid orders</Text>
              </Group>
              <Text size="xl" fw={800} c="dinePrimary">{rupees(ot.avgOrderPaise)}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Total Revenue: {rupees(ot.revenuePaise)} ({ot.itemsQty} items)
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

// ─── 6 & 7. GROSS REPORT & NET SALES REPORT ──────────────────────────────────

function GrossNetItemsReportPanel({ data, mode }: { data: any; mode: "gross" | "net" }) {
  const items: any[] = data.itemsReport || [];
  const categories: any[] = data.byCategory || [];
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (catFilter !== "ALL" && it.categoryName !== catFilter) return false;
      if (!q) return true;
      return it.name.toLowerCase().includes(q) || it.categoryName.toLowerCase().includes(q);
    });
  }, [items, search, catFilter]);

  const totalGross = filtered.reduce((s, i) => s + i.grossPaise, 0);
  const totalDiscount = filtered.reduce((s, i) => s + i.discountAllocatedPaise, 0);
  const totalNet = filtered.reduce((s, i) => s + i.netPaise, 0);
  const totalQty = filtered.reduce((s, i) => s + i.qtySold, 0);

  const topChartData = filtered.slice(0, 10).map((it) => ({
    name: it.name.length > 22 ? `${it.name.slice(0, 20)}…` : it.name,
    [mode === "gross" ? "Gross Sales" : "Net Sales"]: Math.round((mode === "gross" ? it.grossPaise : it.netPaise) / 100),
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard label="Total Units Sold" value={String(totalQty)} sublabel={`Across ${filtered.length} menu items`} color="indigo" icon={IconPackages} />
        <KpiCard label="Item Gross Sales" value={rupees(totalGross)} sublabel="Before any deductions" color="blue" icon={IconChartHistogram} />
        <KpiCard label="Proportional Discounts" value={rupees(totalDiscount)} sublabel="Allocated across items" color="red" icon={IconDiscount2} />
        <KpiCard label="Item Net Sales" value={rupees(totalNet)} sublabel="After discount deductions" color="teal" icon={IconCoinRupee} />
      </SimpleGrid>

      {topChartData.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">
            Top 10 Menu Items by {mode === "gross" ? "Gross Sales" : "Net Sales"}
          </Title>
          <BarChart
            h={Math.max(280, topChartData.length * 36)}
            data={topChartData}
            dataKey="name"
            series={[{ name: mode === "gross" ? "Gross Sales" : "Net Sales", color: mode === "gross" ? "teal.6" : "emerald.6" }]}
            orientation="vertical"
            yAxisProps={{ width: 160 }}
            gridAxis="x"
            valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </Paper>
      )}

      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search menu item..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              const val = e.currentTarget.value;
              setSearch(val);
            }}
            w={{ base: "100%", sm: 300 }}
          />
          <Select
            size="xs"
            value={catFilter}
            onChange={(v) => setCatFilter(v || "ALL")}
            data={[
              { value: "ALL", label: "All Categories" },
              ...categories.map((c: any) => ({ value: c.categoryName, label: c.categoryName })),
            ]}
            w={180}
          />
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={820}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Menu Item</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Unit Price</Table.Th>
                <Table.Th ta="right">Orders</Table.Th>
                <Table.Th ta="right">Qty Sold</Table.Th>
                <Table.Th ta="right">Gross Sales</Table.Th>
                <Table.Th ta="right">Allocated Discount</Table.Th>
                <Table.Th ta="right">Net Sales</Table.Th>
                <Table.Th style={{ width: 150 }}>Share %</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((it, idx) => (
                <Table.Tr key={it.key || it.itemId}>
                  <Table.Td c="dimmed">{idx + 1}</Table.Td>
                  <Table.Td fw={700}>{it.name}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="gray" size="xs">{it.categoryName}</Badge>
                  </Table.Td>
                  <Table.Td ta="right">{rupees(it.unitPricePaise)}</Table.Td>
                  <Table.Td ta="right">{it.ordersCount}</Table.Td>
                  <Table.Td ta="right" fw={700}>{it.qtySold}</Table.Td>
                  <Table.Td ta="right" fw={mode === "gross" ? 700 : 500} c={mode === "gross" ? "dinePrimary" : undefined}>
                    {rupees(it.grossPaise)}
                  </Table.Td>
                  <Table.Td ta="right" c={it.discountAllocatedPaise > 0 ? "red" : "dimmed"}>
                    {it.discountAllocatedPaise > 0 ? `- ${rupees(it.discountAllocatedPaise)}` : "₹0"}
                  </Table.Td>
                  <Table.Td ta="right" fw={700} c="teal">
                    {rupees(it.netPaise)}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Progress value={it.sharePercent} color="teal" size="sm" radius="xl" style={{ flex: 1 }} />
                      <Text size="xs" fw={600} w={38} ta="right">{it.sharePercent}%</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 8. SALES BY HOUR REPORT ─────────────────────────────────────────────────

function SalesByHourReportPanel({ data }: { data: any }) {
  const byHour: any[] = data.byHour || [];
  const totalRev = byHour.reduce((s, h) => s + h.revenuePaise, 0);
  const peakRevHour = [...byHour].sort((a, b) => b.revenuePaise - a.revenuePaise)[0];
  const peakOrderHour = [...byHour].sort((a, b) => b.paidCount - a.paidCount)[0];
  const activeHours = byHour.filter((h) => h.paidCount > 0).length;

  const dayParts = [
    { label: "Morning (6 AM – 12 PM)", hours: [6, 7, 8, 9, 10, 11], color: "yellow" },
    { label: "Lunch (12 PM – 4 PM)", hours: [12, 13, 14, 15], color: "orange" },
    { label: "Evening (4 PM – 7 PM)", hours: [16, 17, 18], color: "teal" },
    { label: "Dinner (7 PM – 11 PM)", hours: [19, 20, 21, 22, 23], color: "grape" },
    { label: "Late Night (12 AM – 6 AM)", hours: [0, 1, 2, 3, 4, 5], color: "indigo" },
  ].map((dp) => {
    const slots = byHour.filter((h) => dp.hours.includes(h.hour));
    const rev = slots.reduce((s, h) => s + h.revenuePaise, 0);
    const orders = slots.reduce((s, h) => s + h.paidCount, 0);
    return {
      ...dp,
      revenuePaise: rev,
      orders,
      share: totalRev > 0 ? Math.round((rev / totalRev) * 1000) / 10 : 0,
    };
  });

  const chartData = byHour.map((h) => ({
    hour: h.label,
    Revenue: Math.round(h.revenuePaise / 100),
    Orders: h.paidCount,
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard
          label="Peak Revenue Hour"
          value={peakRevHour?.revenuePaise > 0 ? peakRevHour.label : "No Sales"}
          sublabel={peakRevHour?.revenuePaise > 0 ? `${rupees(peakRevHour.revenuePaise)} collected` : "-"}
          color="grape"
          icon={IconClockHour4}
        />
        <KpiCard
          label="Peak Rush Hour (Orders)"
          value={peakOrderHour?.paidCount > 0 ? peakOrderHour.label : "No Orders"}
          sublabel={peakOrderHour?.paidCount > 0 ? `${peakOrderHour.paidCount} paid bills` : "-"}
          color="orange"
          icon={IconTrendingUp}
        />
        <KpiCard
          label="Active Trading Hours"
          value={`${activeHours} / 24 hrs`}
          sublabel="Hours with at least 1 sale"
          color="teal"
          icon={IconCalendarStats}
        />
        <KpiCard
          label="Avg Revenue / Active Hour"
          value={rupees(activeHours > 0 ? Math.round(totalRev / activeHours) : 0)}
          sublabel="During active service hours"
          color="dinePrimary"
          icon={IconCoinRupee}
        />
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Day-Part Shift Breakdown</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
          {dayParts.map((dp) => (
            <Paper key={dp.label} p="sm" radius="md" withBorder>
              <Text size="xs" fw={700} c={dp.color}>{dp.label}</Text>
              <Text size="lg" fw={800} mt={4}>{rupees(dp.revenuePaise)}</Text>
              <Group justify="space-between" mt={4}>
                <Text size="xs" c="dimmed">{dp.orders} orders</Text>
                <Badge size="xs" variant="light" color={dp.color}>{dp.share}%</Badge>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      </Paper>

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">24-Hour Revenue Curve (IST)</Title>
        <BarChart
          h={320}
          data={chartData}
          dataKey="hour"
          series={[{ name: "Revenue", color: "grape.6" }]}
          valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
        />
      </Paper>

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Hourly Operations Ledger</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="xs" miw={700}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Hour Slot (IST)</Table.Th>
                <Table.Th ta="right">Paid Orders</Table.Th>
                <Table.Th ta="right">Items Sold</Table.Th>
                <Table.Th ta="right">Gross Sales</Table.Th>
                <Table.Th ta="right">Net Sales</Table.Th>
                <Table.Th ta="right">Total Revenue</Table.Th>
                <Table.Th ta="right">AOV</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {byHour.filter((h) => h.totalOrdersCount > 0 || h.revenuePaise > 0).map((h) => (
                <Table.Tr key={h.hour}>
                  <Table.Td fw={700}>{h.label}</Table.Td>
                  <Table.Td ta="right" fw={600}>{h.paidCount}</Table.Td>
                  <Table.Td ta="right">{h.itemsQty}</Table.Td>
                  <Table.Td ta="right">{rupees(h.grossPaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(h.netPaise)}</Table.Td>
                  <Table.Td ta="right" fw={700} c="dinePrimary">{rupees(h.revenuePaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(h.avgOrderPaise)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 9. SALES BY DAY REPORT ──────────────────────────────────────────────────

function SalesByDayReportPanel({ data }: { data: any }) {
  const byDay: any[] = data.byDay || [];
  const bestDay = [...byDay].sort((a, b) => b.revenuePaise - a.revenuePaise)[0];
  const totalRev = byDay.reduce((s, d) => s + d.revenuePaise, 0);
  const totalOrders = byDay.reduce((s, d) => s + d.paidCount, 0);

  const chartData = byDay.map((d) => ({
    day: `${d.day.slice(5)} (${d.dayOfWeek})`,
    "Dine-In": Math.round(d.dineInPaise / 100),
    Takeaway: Math.round(d.takeawayPaise / 100),
    Delivery: Math.round(d.deliveryPaise / 100),
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard
          label="Best Performing Day"
          value={bestDay ? dayjs(bestDay.day).format("DD MMM YYYY") : "N/A"}
          sublabel={bestDay ? `${rupees(bestDay.revenuePaise)} (${bestDay.paidCount} orders)` : "-"}
          color="blue"
          icon={IconCalendarStats}
        />
        <KpiCard
          label="Daily Average Revenue"
          value={rupees(byDay.length > 0 ? Math.round(totalRev / byDay.length) : 0)}
          sublabel={`Across ${byDay.length} active days`}
          color="teal"
          icon={IconCoinRupee}
        />
        <KpiCard
          label="Daily Average Orders"
          value={byDay.length > 0 ? String(Math.round(totalOrders / byDay.length)) : "0"}
          sublabel={`${totalOrders} total paid orders`}
          color="indigo"
          icon={IconShoppingBag}
        />
        <KpiCard
          label="Period Total Revenue"
          value={rupees(totalRev)}
          sublabel="Settled sales across all days"
          color="dinePrimary"
          icon={IconTrendingUp}
        />
      </SimpleGrid>

      {chartData.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Daily Channel Revenue Breakdown</Title>
          <BarChart
            h={320}
            data={chartData}
            dataKey="day"
            type="stacked"
            series={[
              { name: "Dine-In", color: "teal.6" },
              { name: "Takeaway", color: "orange.6" },
              { name: "Delivery", color: "indigo.6" },
            ]}
            withLegend
            valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </Paper>
      )}

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Day-by-Day Financial Ledger</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={850}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Day</Table.Th>
                <Table.Th ta="right">Paid Orders</Table.Th>
                <Table.Th ta="right">Items Sold</Table.Th>
                <Table.Th ta="right">Gross Sales</Table.Th>
                <Table.Th ta="right">Discount</Table.Th>
                <Table.Th ta="right">Net Sales</Table.Th>
                <Table.Th ta="right">Tax</Table.Th>
                <Table.Th ta="right">Collected</Table.Th>
                <Table.Th ta="right">AOV</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...byDay].reverse().map((d) => (
                <Table.Tr key={d.day}>
                  <Table.Td fw={700}>{dayjs(d.day).format("DD MMM YYYY")}</Table.Td>
                  <Table.Td><Badge variant="light" color="gray" size="xs">{d.dayOfWeek}</Badge></Table.Td>
                  <Table.Td ta="right" fw={600}>{d.paidCount}</Table.Td>
                  <Table.Td ta="right">{d.itemsQty}</Table.Td>
                  <Table.Td ta="right">{rupees(d.grossPaise)}</Table.Td>
                  <Table.Td ta="right" c={d.discountPaise > 0 ? "red" : "dimmed"}>{rupees(d.discountPaise)}</Table.Td>
                  <Table.Td ta="right" c="teal" fw={600}>{rupees(d.netPaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(d.taxPaise)}</Table.Td>
                  <Table.Td ta="right" fw={800} c="dinePrimary">{rupees(d.revenuePaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(d.avgOrderPaise)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 10. SALES BY MONTH REPORT ───────────────────────────────────────────────

function SalesByMonthReportPanel({ data }: { data: any }) {
  const byMonth: any[] = data.byMonth || [];
  const totalRev = byMonth.reduce((s, m) => s + m.revenuePaise, 0);
  const bestMonth = [...byMonth].sort((a, b) => b.revenuePaise - a.revenuePaise)[0];

  const chartData = byMonth.map((m) => ({
    month: m.label,
    "Gross Sales": Math.round(m.grossPaise / 100),
    "Collected Revenue": Math.round(m.revenuePaise / 100),
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard label="Best Performing Month" value={bestMonth?.label || "N/A"} sublabel={bestMonth ? rupees(bestMonth.revenuePaise) : "-"} color="indigo" icon={IconCalendarMonth} />
        <KpiCard label="Monthly Avg Revenue" value={rupees(byMonth.length > 0 ? Math.round(totalRev / byMonth.length) : 0)} sublabel={`Across ${byMonth.length} months`} color="teal" icon={IconCoinRupee} />
        <KpiCard label="Total Settled Orders" value={String(byMonth.reduce((s, m) => s + m.paidCount, 0))} sublabel="Paid orders in range" color="blue" icon={IconShoppingBag} />
        <KpiCard label="Total Taxes Collected" value={rupees(byMonth.reduce((s, m) => s + m.taxPaise, 0))} sublabel="Cumulative GST & Service Charge" color="orange" icon={IconReceipt2} />
      </SimpleGrid>

      {chartData.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Monthly Revenue Progression</Title>
          <BarChart
            h={300}
            data={chartData}
            dataKey="month"
            series={[
              { name: "Gross Sales", color: "indigo.5" },
              { name: "Collected Revenue", color: "teal.6" },
            ]}
            withLegend
            valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </Paper>
      )}

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Monthly Financial Summary</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={850}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th ta="right">Paid Orders</Table.Th>
                <Table.Th ta="right">Items Sold</Table.Th>
                <Table.Th ta="right">Gross Sales</Table.Th>
                <Table.Th ta="right">Discounts</Table.Th>
                <Table.Th ta="right">Net Sales</Table.Th>
                <Table.Th ta="right">Taxes</Table.Th>
                <Table.Th ta="right">Collected Revenue</Table.Th>
                <Table.Th ta="right">AOV</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...byMonth].reverse().map((m) => (
                <Table.Tr key={m.month}>
                  <Table.Td fw={700}>{m.label}</Table.Td>
                  <Table.Td ta="right" fw={600}>{m.paidCount}</Table.Td>
                  <Table.Td ta="right">{m.itemsQty}</Table.Td>
                  <Table.Td ta="right">{rupees(m.grossPaise)}</Table.Td>
                  <Table.Td ta="right" c="red">{rupees(m.discountPaise)}</Table.Td>
                  <Table.Td ta="right" c="teal" fw={600}>{rupees(m.netPaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(m.taxPaise)}</Table.Td>
                  <Table.Td ta="right" fw={800} c="dinePrimary">{rupees(m.revenuePaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(m.avgOrderPaise)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 11. SALES BY ORDER TYPE REPORT ──────────────────────────────────────────

function SalesByOrderTypeReportPanel({ data }: { data: any }) {
  const byOrderType: any[] = data.byOrderType || [];
  const counts = data.counts || {};

  const channelDonut = byOrderType
    .filter((ot) => ot.revenuePaise > 0)
    .map((ot) => ({
      name: ot.label,
      value: Math.round(ot.revenuePaise / 100),
      color: ot.orderType === "DINE_IN" ? "teal.6" : ot.orderType === "TAKEAWAY" ? "orange.6" : "indigo.6",
    }));

  const statusDonut = [
    { name: "Paid", value: counts.PAID || 0, color: "teal.6" },
    { name: "Open", value: counts.OPEN || 0, color: "blue.6" },
    { name: "Void", value: counts.VOID || 0, color: "gray.6" },
    { name: "Cancelled", value: counts.CANCELLED || 0, color: "red.6" },
  ].filter((d) => d.value > 0);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {byOrderType.map((ot) => (
          <KpiCard
            key={ot.orderType}
            label={`${ot.label} Channel`}
            value={rupees(ot.revenuePaise)}
            sublabel={`${ot.paidCount} paid orders · AOV ${rupees(ot.avgOrderPaise)} (${ot.sharePercent}%)`}
            color={ot.orderType === "DINE_IN" ? "teal" : ot.orderType === "TAKEAWAY" ? "orange" : "indigo"}
            icon={IconCategory}
          />
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Revenue Share by Ordering Channel</Title>
          <Center py="md">
            {channelDonut.length > 0 ? (
              <DonutChart data={channelDonut} withLabelsLine withLabels size={220} thickness={32} />
            ) : (
              <Text c="dimmed">No paid channel sales</Text>
            )}
          </Center>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Order Status Fulfilment Distribution</Title>
          <Center py="md">
            {statusDonut.length > 0 ? (
              <DonutChart data={statusDonut} withLabelsLine withLabels size={220} thickness={32} />
            ) : (
              <Text c="dimmed">No orders in period</Text>
            )}
          </Center>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Channel Performance Matrix</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={900}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order Type</Table.Th>
                <Table.Th ta="right">Paid Orders</Table.Th>
                <Table.Th ta="right">Open</Table.Th>
                <Table.Th ta="right">Void / Cancelled</Table.Th>
                <Table.Th ta="right">Items Sold</Table.Th>
                <Table.Th ta="right">Packaging / Delivery Fees</Table.Th>
                <Table.Th ta="right">Net Sales</Table.Th>
                <Table.Th ta="right">Total Collected</Table.Th>
                <Table.Th ta="right">AOV</Table.Th>
                <Table.Th ta="right">Share</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {byOrderType.map((ot) => (
                <Table.Tr key={ot.orderType}>
                  <Table.Td fw={700}>{ot.label}</Table.Td>
                  <Table.Td ta="right" fw={600}>{ot.paidCount}</Table.Td>
                  <Table.Td ta="right">{ot.openCount}</Table.Td>
                  <Table.Td ta="right" c="red">{ot.voidCount + ot.cancelledCount}</Table.Td>
                  <Table.Td ta="right">{ot.itemsQty}</Table.Td>
                  <Table.Td ta="right">{rupees(ot.packagingPaise + ot.deliveryPaise)}</Table.Td>
                  <Table.Td ta="right" c="teal" fw={600}>{rupees(ot.netPaise)}</Table.Td>
                  <Table.Td ta="right" fw={800} c="dinePrimary">{rupees(ot.revenuePaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(ot.avgOrderPaise)}</Table.Td>
                  <Table.Td ta="right"><Badge variant="light" color="teal">{ot.sharePercent}%</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 12. SALES BY TABLE REPORT ───────────────────────────────────────────────

function SalesByTableReportPanel({ data }: { data: any }) {
  const byTable: any[] = data.byTable || [];
  const topTable = byTable[0];

  const sectionMap = new Map<string, { section: string; tablesCount: number; orders: number; revenuePaise: number }>();
  for (const t of byTable) {
    const sec = t.section || "Main Area";
    const cur = sectionMap.get(sec) || { section: sec, tablesCount: 0, orders: 0, revenuePaise: 0 };
    cur.tablesCount += 1;
    cur.orders += t.paidCount;
    cur.revenuePaise += t.revenuePaise;
    sectionMap.set(sec, cur);
  }
  const sections = Array.from(sectionMap.values()).sort((a, b) => b.revenuePaise - a.revenuePaise);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard
          label="Top Performing Table"
          value={topTable ? topTable.tableNo : "N/A"}
          sublabel={topTable ? `${rupees(topTable.revenuePaise)} (${topTable.paidCount} orders)` : "-"}
          color="teal"
          icon={IconArmchair}
        />
        <KpiCard
          label="Top Floor / Section"
          value={sections[0]?.section || "N/A"}
          sublabel={sections[0] ? `${rupees(sections[0].revenuePaise)} across ${sections[0].orders} bills` : "-"}
          color="indigo"
          icon={IconCategory}
        />
        <KpiCard
          label="Active Tables / Counters"
          value={String(byTable.filter((t) => t.paidCount > 0).length)}
          sublabel="Tables with settled bills"
          color="blue"
          icon={IconUsers}
        />
        <KpiCard
          label="Avg Revenue per Active Table"
          value={rupees(byTable.length > 0 ? Math.round(byTable.reduce((s, t) => s + t.revenuePaise, 0) / Math.max(1, byTable.filter((t) => t.paidCount > 0).length)) : 0)}
          sublabel="Table utilization efficiency"
          color="dinePrimary"
          icon={IconCoinRupee}
        />
      </SimpleGrid>

      {sections.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Floor & Section Breakdown</Title>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {sections.map((sec) => (
              <Paper key={sec.section} p="md" radius="md" withBorder>
                <Text size="sm" fw={700}>{sec.section}</Text>
                <Text size="xl" fw={800} c="teal" mt={4}>{rupees(sec.revenuePaise)}</Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {sec.orders} paid orders across {sec.tablesCount} tables/points
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Paper>
      )}

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Table-wise Performance Ranking</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={900}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Table / Point</Table.Th>
                <Table.Th>Floor Section</Table.Th>
                <Table.Th ta="right">Capacity</Table.Th>
                <Table.Th ta="right">Paid Orders</Table.Th>
                <Table.Th ta="right">Items Sold</Table.Th>
                <Table.Th ta="right">Gross Sales</Table.Th>
                <Table.Th ta="right">Collected Revenue</Table.Th>
                <Table.Th ta="right">AOV</Table.Th>
                <Table.Th style={{ width: 150 }}>Share %</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {byTable.map((t, idx) => (
                <Table.Tr key={t.tableNo}>
                  <Table.Td c="dimmed">{idx + 1}</Table.Td>
                  <Table.Td fw={700}>{t.tableNo}</Table.Td>
                  <Table.Td><Badge variant="light" color="gray" size="xs">{t.section}</Badge></Table.Td>
                  <Table.Td ta="right">{t.capacity} seats</Table.Td>
                  <Table.Td ta="right" fw={600}>{t.paidCount}</Table.Td>
                  <Table.Td ta="right">{t.itemsQty}</Table.Td>
                  <Table.Td ta="right">{rupees(t.grossPaise)}</Table.Td>
                  <Table.Td ta="right" fw={800} c="dinePrimary">{rupees(t.revenuePaise)}</Table.Td>
                  <Table.Td ta="right">{rupees(t.avgOrderPaise)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Progress value={t.sharePercent} color="teal" size="sm" radius="xl" style={{ flex: 1 }} />
                      <Text size="xs" fw={600} w={38} ta="right">{t.sharePercent}%</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}

// ─── 13. PAYMENT METHODS REPORT ──────────────────────────────────────────────

function PaymentMethodsReportPanel({ data }: { data: any }) {
  const methods: any[] = data.byPaymentMethod || [];
  const totalRev = methods.reduce((s, m) => s + m.revenuePaise, 0);
  const colors = ["teal.6", "indigo.6", "orange.6", "grape.6", "cyan.6"];
  const donutData = methods.map((m, i) => ({
    name: m.method,
    value: Math.round(m.revenuePaise / 100),
    color: colors[i % colors.length],
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <KpiCard label="Primary Payment Channel" value={methods[0]?.method || "N/A"} sublabel={methods[0] ? `${methods[0].sharePercent}% of total collections` : "-"} color="green" icon={IconCreditCard} />
        <KpiCard label="Total Settled Revenue" value={rupees(totalRev)} sublabel="Across all payment channels" color="dinePrimary" icon={IconCoinRupee} />
        <KpiCard label="Payment Modes Used" value={String(methods.length)} sublabel="Distinct settlement methods" color="indigo" icon={IconChartPie} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Payment Mode Distribution</Title>
          <Center py="md">
            {donutData.length > 0 ? (
              <DonutChart data={donutData} withLabelsLine withLabels size={220} thickness={32} />
            ) : (
              <Text c="dimmed">No settled payments in this range</Text>
            )}
          </Center>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Settlement Breakdown</Title>
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={360}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Method</Table.Th>
                  <Table.Th ta="right">Paid Bills</Table.Th>
                  <Table.Th ta="right">Avg Ticket</Table.Th>
                  <Table.Th ta="right">Total Collected</Table.Th>
                  <Table.Th ta="right">Share</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {methods.map((m) => (
                  <Table.Tr key={m.method}>
                    <Table.Td fw={700}>{m.method}</Table.Td>
                    <Table.Td ta="right">{m.count}</Table.Td>
                    <Table.Td ta="right">{rupees(m.avgOrderPaise)}</Table.Td>
                    <Table.Td ta="right" fw={700} c="dinePrimary">{rupees(m.revenuePaise)}</Table.Td>
                    <Table.Td ta="right"><Badge variant="light" color="teal">{m.sharePercent}%</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}

// ─── 16. CANCELLED INVOICES & ITEMS REPORT ───────────────────────────────────

function CancelledInvoicesReportPanel({ data }: { data: any }) {
  const s = data.summary || data;
  const cancelledOrders = (data.invoices || []).filter((i: any) => i.orderStatus === "CANCELLED");
  const cancelledItems = (data.itemInvoiceMatrix || []).filter((r: any) => r.itemStatus === "CANCELLED");

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <KpiCard
          label="Cancelled Full Invoices"
          value={String(s.cancelledOrdersCount ?? cancelledOrders.length)}
          sublabel="Orders marked CANCELLED"
          color="red"
          icon={IconCircleX}
        />
        <KpiCard
          label="Cancelled Line Items"
          value={String(s.cancelledItemsCount ?? cancelledItems.length)}
          sublabel="Individual portions cancelled"
          color="orange"
          icon={IconFileOff}
        />
        <KpiCard
          label="Cancelled Revenue Impact"
          value={rupees(s.cancelledRevenuePaise ?? 0)}
          sublabel="Potential revenue lost"
          color="red"
          icon={IconCoinRupee}
        />
        <KpiCard
          label="Cancellation Rate"
          value={s.totalCount > 0 ? `${(((s.cancelledOrdersCount || 0) / s.totalCount) * 100).toFixed(1)}%` : "0.0%"}
          sublabel={`Out of ${s.totalCount ?? 0} total orders`}
          color="gray"
          icon={IconChartPie}
        />
      </SimpleGrid>

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Cancelled Invoices ({cancelledOrders.length})</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={750}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order #</Table.Th>
                <Table.Th>Date & Time</Table.Th>
                <Table.Th>Channel / Table</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th ta="right">Order Value</Table.Th>
                <Table.Th>Note / Reason</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cancelledOrders.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" py="lg" c="dimmed">
                    Zero cancelled full invoices in this period.
                  </Table.Td>
                </Table.Tr>
              ) : (
                cancelledOrders.map((inv: any) => (
                  <Table.Tr key={inv.id}>
                    <Table.Td fw={700}>#{inv.orderNo}</Table.Td>
                    <Table.Td>{dayjs(inv.createdAt).format("DD MMM YYYY, hh:mm A")}</Table.Td>
                    <Table.Td>{inv.orderType} · {inv.tableNo}</Table.Td>
                    <Table.Td>{inv.customerPhone || "-"}</Table.Td>
                    <Table.Td ta="right" fw={700} c="red">{rupees(inv.subtotalPaise)}</Table.Td>
                    <Table.Td>{inv.note || "Cancelled"}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Paper p="lg" radius="md" withBorder>
        <Title order={5} mb="md">Cancelled Line Items Audit ({cancelledItems.length})</Title>
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="sm" miw={750}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order #</Table.Th>
                <Table.Th>Date & Time</Table.Th>
                <Table.Th>Item Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Table</Table.Th>
                <Table.Th ta="right">Qty</Table.Th>
                <Table.Th ta="right">Cancelled Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cancelledItems.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} ta="center" py="lg" c="dimmed">
                    Zero cancelled line items in this period.
                  </Table.Td>
                </Table.Tr>
              ) : (
                cancelledItems.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td fw={700}>#{item.orderNo}</Table.Td>
                    <Table.Td>{dayjs(item.createdAt).format("DD MMM, hh:mm A")}</Table.Td>
                    <Table.Td fw={600}>{item.itemName}</Table.Td>
                    <Table.Td>{item.categoryName}</Table.Td>
                    <Table.Td>{item.tableNo}</Table.Td>
                    <Table.Td ta="right" fw={700}>{item.qty}</Table.Td>
                    <Table.Td ta="right" fw={700} c="red">{rupees(item.grossPaise)}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
}
