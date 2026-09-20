"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Container, Title, Text, Group, Stack, Paper, SimpleGrid, Loader, Center,
  Button, Select, Box, ActionIcon, ThemeIcon,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { BarChart, LineChart, DonutChart } from "@mantine/charts";
import {
  IconChartBar, IconToolsKitchen2, IconStatusChange, IconCash,
  IconClockHour4, IconTrendingUp, IconCalendar, IconArrowLeft, IconChevronRight,
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
  { value: "custom", label: "Custom" },
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
      return { from: "1970-01-01", to: todayStr };
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
}

export const REPORT_CARDS: ReportCardMeta[] = [
  {
    id: "summary",
    title: "Sales Summary",
    description: "Gross revenue, net sales, taxes, discounts, and order totals overview.",
    icon: IconChartBar,
    color: "indigo",
  },
  {
    id: "top-items",
    title: "Top Items",
    description: "Best-selling menu items ranked by quantity sold and revenue generated.",
    icon: IconToolsKitchen2,
    color: "teal",
  },
  {
    id: "orders-by-status",
    title: "Orders by Status",
    description: "Distribution and volume of completed, open, and cancelled orders.",
    icon: IconStatusChange,
    color: "orange",
  },
  {
    id: "payment-methods",
    title: "Payment Methods",
    description: "Revenue split across Cash, UPI, Cards, and other payment channels.",
    icon: IconCash,
    color: "green",
  },
  {
    id: "hourly",
    title: "Hourly Sales",
    description: "Peak business hours and sales distribution throughout the day.",
    icon: IconClockHour4,
    color: "grape",
  },
  {
    id: "daily-trend",
    title: "Daily Trend",
    description: "Day-by-day revenue progression and order trends over time.",
    icon: IconTrendingUp,
    color: "blue",
  },
];

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function ReportsCardsList() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
      {REPORT_CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <Paper
            key={card.id}
            component={Link}
            href={`/settings/reports/${card.id}`}
            p="lg"
            radius="md"
            style={{
              textDecoration: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "transform 150ms ease",
            }}
          >
            <div>
              <Group justify="space-between" align="flex-start" mb="md">
                <ThemeIcon size={44} radius="md" variant="light" color={card.color}>
                  <Icon size={24} />
                </ThemeIcon>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconChevronRight size={18} />
                </ActionIcon>
              </Group>
              <Text fw={600} size="md" mb={4} c="var(--mantine-color-text)">
                {card.title}
              </Text>
              <Text size="xs" c="dimmed" lh={1.4}>
                {card.description}
              </Text>
            </div>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

export function ReportDetailView({ reportType }: { reportType: ReportType }) {
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const [preset, setPreset] = useState<Preset>("today");
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([null, null]);
  const [range, setRange] = useState(() => presetToRange("today"));

  const cardMeta = REPORT_CARDS.find((c) => c.id === reportType) || REPORT_CARDS[0];

  useEffect(() => {
    if (preset === "custom") {
      if (customRange[0] && customRange[1]) {
        setRange({ from: istDateStr(customRange[0]), to: istDateStr(customRange[1]) });
      }
    } else {
      setRange(presetToRange(preset));
    }
  }, [preset, customRange]);

  // React Query — cached per (restaurant, type, from, to, outlet)
  const { data: reportResult, isLoading: loading } = useReport(
    restaurantId,
    reportType,
    range.from,
    range.to,
    outletId,
    !!restaurantId && !!outletId,
  );
  const data = reportResult?.data ?? null;

  if (!restaurant) return null;
  if (!activeOutlet) {
    return <Center py={80}><Loader color="dinePrimary" /></Center>;
  }

  return (
    <Container size="xl" pt="sm" pb={100} px={{ base: "sm", sm: "md" }}>
      <Stack gap="lg">
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
            <Box>
              <Title order={2} lh={1.2}>{cardMeta.title}</Title>
              <Text size="xs" c="dimmed">{cardMeta.description}</Text>
            </Box>
          </Group>

          <Stack gap={4} align="flex-start" w={{ base: "100%", sm: "auto" }}>
            <Group gap="xs" wrap="nowrap" align="center" style={{ width: "100%", maxWidth: preset === "custom" ? 440 : 230 }}>
              <Select
                size="sm"
                value={preset}
                onChange={(val) => val && setPreset(val as Preset)}
                data={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                leftSection={<IconCalendar size={15} />}
                w={preset === "custom" ? { base: 142, sm: 165 } : { base: 195, sm: 220 }}
                style={{ flexShrink: 0 }}
                allowDeselect={false}
                aria-label="Duration"
                comboboxProps={{ withinPortal: true, zIndex: 1500 }}
              />
              {preset === "custom" && (
                <DatePickerInput
                  type="range"
                  placeholder="Select date(s)"
                  valueFormat="DD MMM YYYY"
                  labelSeparator="-"
                  valueFormatter={({ date }) => {
                    if (Array.isArray(date)) {
                      if (date[0] && date[1]) {
                        return `${dayjs(date[0]).format("DD MMM YYYY")} - ${dayjs(date[1]).format("DD MMM YYYY")}`;
                      }
                      if (date[0]) {
                        return `${dayjs(date[0]).format("DD MMM YYYY")} - `;
                      }
                      return "";
                    }
                    return date ? dayjs(date).format("DD MMM YYYY") : "";
                  }}
                  value={customRange}
                  onChange={(v: [string | null, string | null] | null) => {
                    if (!v) { setCustomRange([null, null]); return; }
                    setCustomRange([v[0] ? new Date(v[0]) : null, v[1] ? new Date(v[1]) : null]);
                  }}
                  size="sm"
                  styles={{
                    input: {
                      fontSize: "11.5px",
                      paddingLeft: "6px",
                      paddingRight: "6px",
                      textAlign: "center",
                      height: "36px",
                    },
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                  maw={{ base: "100%", sm: 240 }}
                  popoverProps={{ withinPortal: true, zIndex: 1500 }}
                />
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {`${dayjs(range.from).format("DD MMM YYYY")} - ${dayjs(range.to).format("DD MMM YYYY")}`}
            </Text>
          </Stack>
        </Group>

        {loading ? (
          <Center py={80}><Loader color="dinePrimary" /></Center>
        ) : data === null || data === undefined ? (
          <Text c="dimmed" ta="center" py="xl">No data for this period</Text>
        ) : (
          <ReportPanel type={reportType} data={data} />
        )}
      </Stack>
    </Container>
  );
}

export function ReportsManagement({ embedded = false, reportType }: { embedded?: boolean; reportType?: ReportType }) {
  if (reportType) {
    return <ReportDetailView reportType={reportType} />;
  }
  return <ReportsCardsList />;
}

function ReportPanel({ type, data }: { type: ReportType; data: any }) {
  switch (type) {
    case "summary":
      return <SummaryPanel data={data} />;
    case "top-items":
      return <TopItemsPanel data={data} />;
    case "orders-by-status":
      return <OrdersByStatusPanel data={data} />;
    case "payment-methods":
      return <PaymentMethodsPanel data={data} />;
    case "hourly":
      return <HourlyPanel data={data} />;
    case "daily-trend":
      return <DailyTrendPanel data={data} />;
    default:
      return null;
  }
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Paper p="lg" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>{label}</Text>
      <Text size="xl" fw={800} c={color ?? "dinePrimary"}>{value}</Text>
    </Paper>
  );
}

function SummaryPanel({ data }: { data: any }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
      <StatCard label="Collected Revenue" value={rupees(data?.revenuePaise ?? 0)} />
      <StatCard label="Paid Orders" value={String(data?.paidCount ?? 0)} />
      <StatCard label="Avg Order Value" value={rupees(data?.avgOrderPaise ?? 0)} />
      <StatCard label="Pending (Open)" value={`${data?.openCount ?? 0} · ${rupees(data?.openRevenuePaise ?? 0)}`} color="blue" />
      <StatCard label="Void" value={String(data?.voidCount ?? 0)} color="gray" />
    </SimpleGrid>
  );
}

function TopItemsPanel({ data }: { data: any[] }) {
  if (!Array.isArray(data) || !data.length) return <Text c="dimmed" ta="center" py="xl">No items sold in this period</Text>;
  return (
    <Paper p="md" radius="md">
      <BarChart
        h={Math.max(300, data.length * 40)}
        data={data.map((d) => ({ name: d.name, Qty: d.qty }))}
        dataKey="name"
        series={[{ name: "Qty", color: "grape.6" }]}
        orientation="vertical"
        yAxisProps={{ width: 140 }}
        gridAxis="x"
      />
    </Paper>
  );
}

function OrdersByStatusPanel({ data }: { data: any }) {
  const counts = data?.counts ?? {};
  const donutData = [
    { name: "Paid", value: counts.PAID ?? 0, color: "green.6" },
    { name: "Open", value: counts.OPEN ?? 0, color: "blue.6" },
    { name: "Void", value: counts.VOID ?? 0, color: "gray.5" },
  ].filter((d) => d.value > 0);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 3 }} spacing="md">
        <StatCard label="Paid" value={String(counts.PAID ?? 0)} color="green" />
        <StatCard label="Open" value={String(counts.OPEN ?? 0)} color="blue" />
        <StatCard label="Void" value={String(counts.VOID ?? 0)} color="gray" />
      </SimpleGrid>
      {donutData.length > 0 && (
        <Paper p="md" radius="md">
          <Center>
            <DonutChart data={donutData} withLabelsLine withLabels size={220} thickness={30} />
          </Center>
        </Paper>
      )}
    </Stack>
  );
}

function PaymentMethodsPanel({ data }: { data: any[] }) {
  if (!Array.isArray(data) || !data.length) return <Text c="dimmed" ta="center" py="xl">No settled payments in this period</Text>;
  const colors = ["grape.6", "blue.6", "orange.6", "teal.6"];
  const donutData = data.map((d, i) => ({ name: d.method, value: d.revenuePaise, color: colors[i % colors.length] }));
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <Paper p="md" radius="md">
        <Center h="100%">
          <DonutChart data={donutData} withLabelsLine withLabels size={220} thickness={30} />
        </Center>
      </Paper>
      <Paper p="md" radius="md">
        <Stack gap="xs">
          {data.map((d) => (
            <Group key={d.method} justify="space-between">
              <Text size="sm" fw={500}>{d.method}</Text>
              <Group gap="xs">
                <Text size="xs" c="dimmed">{d.count} orders</Text>
                <Text size="sm" fw={700} c="dinePrimary">{rupees(d.revenuePaise)}</Text>
              </Group>
            </Group>
          ))}
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}

function HourlyPanel({ data }: { data: any[] }) {
  if (!Array.isArray(data)) return null;
  const chartData = data.map((d) => ({ hour: `${d.hour}:00`, Revenue: d.revenuePaise / 100 }));
  return (
    <Paper p="md" radius="md">
      <BarChart
        h={320}
        data={chartData}
        dataKey="hour"
        series={[{ name: "Revenue", color: "grape.6" }]}
        gridAxis="y"
        withLegend={false}
        valueFormatter={(v) => `₹${v}`}
      />
    </Paper>
  );
}

function DailyTrendPanel({ data }: { data: any[] }) {
  if (!Array.isArray(data) || !data.length) return <Text c="dimmed" ta="center" py="xl">No sales in this period</Text>;
  const chartData = data.map((d) => ({ day: d.day.slice(5), Revenue: d.revenuePaise / 100 }));
  return (
    <Paper p="md" radius="md">
      <LineChart
        h={320}
        data={chartData}
        dataKey="day"
        series={[{ name: "Revenue", color: "grape.6" }]}
        curveType="monotone"
        valueFormatter={(v) => `₹${v}`}
      />
    </Paper>
  );
}
