"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Container, Title, Text, Group, Stack, Paper, SimpleGrid, Loader, Center,
  Button, Tabs, ScrollArea, Select, Box,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { BarChart, LineChart, DonutChart } from "@mantine/charts";
import {
  IconChartBar, IconToolsKitchen2, IconStatusChange, IconCash,
  IconClockHour4, IconTrendingUp, IconCalendar,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { getReport, type ReportType } from "@/lib/api-client";
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

const REPORT_TABS: { value: ReportType; label: string; icon: React.ElementType }[] = [
  { value: "summary", label: "Sales Summary", icon: IconChartBar },
  { value: "top-items", label: "Top Items", icon: IconToolsKitchen2 },
  { value: "orders-by-status", label: "Order Status", icon: IconStatusChange },
  { value: "payment-methods", label: "Payment Methods", icon: IconCash },
  { value: "hourly", label: "Hourly Sales", icon: IconClockHour4 },
  { value: "daily-trend", label: "Daily Trend", icon: IconTrendingUp },
];

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function ReportsManagement({ embedded = false }: { embedded?: boolean }) {
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const [activeType, setActiveType] = useState<ReportType>("summary");
  const [preset, setPreset] = useState<Preset>("today");
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([null, null]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => presetToRange("today"));

  useEffect(() => {
    if (preset === "custom") {
      if (customRange[0] && customRange[1]) {
        setRange({ from: istDateStr(customRange[0]), to: istDateStr(customRange[1]) });
      }
    } else {
      setRange(presetToRange(preset));
    }
  }, [preset, customRange]);

  const load = useCallback(async () => {
    if (!restaurantId || !range.from || !range.to || !outletId) return;
    setLoading(true);
    try {
      const result = await getReport(restaurantId, activeType, range.from, range.to, outletId);
      setData(result.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, activeType, range, outletId]);

  useEffect(() => { load(); }, [load]);

  if (!restaurant) return null;
  if (!activeOutlet) {
    return <Center py={80}><Loader color="dinePrimary" /></Center>;
  }

  const content = (
    <>
      <Title order={embedded ? 3 : 2} mb="md">Reports</Title>

      <Stack gap={6} mb="md">
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

      <Tabs
        value={activeType}
        onChange={(v) => {
          if (!v) return;
          setActiveType(v as ReportType);
          setData(null);
        }}
        mb="lg"
      >
        <ScrollArea type="auto" offsetScrollbars={false} scrollbars="x">
          <Tabs.List style={{ flexWrap: "nowrap", width: "max-content", minWidth: "100%" }}>
            {REPORT_TABS.map((t) => (
              <Tabs.Tab key={t.value} value={t.value} leftSection={<t.icon size={16} />} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </ScrollArea>
      </Tabs>

      {loading ? (
        <Center py={80}><Loader color="dinePrimary" /></Center>
      ) : data === null || data === undefined ? (
        <Text c="dimmed" ta="center" py="xl">No data for this period</Text>
      ) : (
        <ReportPanel type={activeType} data={data} />
      )}
    </>
  );

  if (embedded) {
    return <Box pt="xs">{content}</Box>;
  }

  return (
    <Container size="xl" pt="sm" pb={100} px={{ base: "sm", sm: "md" }}>
      {content}
    </Container>
  );
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
    <Paper withBorder p="lg" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>{label}</Text>
      <Text size="xl" fw={800} c={color ?? "dinePrimary"}>{value}</Text>
    </Paper>
  );
}

function SummaryPanel({ data }: { data: any }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
      <StatCard label="Revenue" value={rupees(data?.revenuePaise ?? 0)} />
      <StatCard label="Paid Orders" value={String(data?.paidCount ?? 0)} />
      <StatCard label="Avg Order" value={rupees(data?.avgOrderPaise ?? 0)} />
      <StatCard label="Open" value={String(data?.openCount ?? 0)} color="blue" />
      <StatCard label="Void" value={String(data?.voidCount ?? 0)} color="gray" />
    </SimpleGrid>
  );
}

function TopItemsPanel({ data }: { data: any[] }) {
  if (!Array.isArray(data) || !data.length) return <Text c="dimmed" ta="center" py="xl">No items sold in this period</Text>;
  return (
    <Paper withBorder p="md" radius="md">
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
        <Paper withBorder p="md" radius="md">
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
      <Paper withBorder p="md" radius="md">
        <Center h="100%">
          <DonutChart data={donutData} withLabelsLine withLabels size={220} thickness={30} />
        </Center>
      </Paper>
      <Paper withBorder p="md" radius="md">
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
    <Paper withBorder p="md" radius="md">
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
    <Paper withBorder p="md" radius="md">
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
