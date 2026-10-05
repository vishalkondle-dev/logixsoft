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
  TextInput,
  NumberInput,
  Autocomplete,
  Badge,
  Loader,
  Divider,
  SimpleGrid,
  Card,
  ActionIcon,
  Modal,
  ThemeIcon,
  Tooltip,
  SegmentedControl,
  CopyButton,
  Center,
  Select,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconTable,
  IconPlus,
  IconCheck,
  IconTrash,
  IconEdit,
  IconSearch,
  IconUsers,
  IconArmchair,
  IconLayoutGrid,
  IconList,
  IconToolsKitchen2,
  IconSnowflake,
  IconPlant,
  IconGlassFull,
  IconQrcode,
  IconPlayerPause,
  IconPlayerPlay,
  IconExternalLink,
  IconCopy,
  IconPrinter,
  IconPlaylistAdd,
  IconSparkles,
  IconAlertCircle,
  IconCircleCheck,
} from "@tabler/icons-react";
import { QRCode } from "@gfazioli/mantine-qr-code";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useTables,
  useCreateTable,
  useUpdateTable,
  useToggleTable,
  useDeleteTable,
} from "@/lib/queries";

// Helper to determine aesthetic theme & icon for a given section name
function getSectionConfig(sectionName: string) {
  const s = (sectionName || "").toLowerCase().trim();
  if (
    s.includes("roof") ||
    s.includes("garden") ||
    s.includes("outdoor") ||
    s.includes("terrace") ||
    s.includes("patio") ||
    s.includes("balcony")
  ) {
    return {
      color: "teal",
      icon: IconPlant,
      badgeLabel: "Outdoor / Garden",
      emoji: "🌿",
    };
  }
  if (
    s.includes("ac") ||
    s.includes("family") ||
    s.includes("hall") ||
    s.includes("private") ||
    s.includes("vip") ||
    s.includes("cabin")
  ) {
    return {
      color: "blue",
      icon: IconSnowflake,
      badgeLabel: "AC / Family",
      emoji: "❄️",
    };
  }
  if (
    s.includes("bar") ||
    s.includes("lounge") ||
    s.includes("counter") ||
    s.includes("pub") ||
    s.includes("drink")
  ) {
    return {
      color: "violet",
      icon: IconGlassFull,
      badgeLabel: "Bar & Lounge",
      emoji: "🍸",
    };
  }
  if (
    s.includes("main") ||
    s.includes("dining") ||
    s.includes("hall") ||
    s.includes("ground") ||
    s.includes("floor")
  ) {
    return {
      color: "dinePrimary",
      icon: IconToolsKitchen2,
      badgeLabel: "Main Dining",
      emoji: "🍽️",
    };
  }
  return {
    color: "indigo",
    icon: IconArmchair,
    badgeLabel: "Dining Zone",
    emoji: "🪑",
  };
}

const CAPACITY_PRESETS = [2, 4, 6, 8, 10, 12];

export function TablesManagement() {
  const { restaurant, activeOutlet, outlets } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const currentOutlet = activeOutlet || outlets[0];
  const outletId = currentOutlet?.id || null;

  // React Query cached tables
  const {
    data: tables = [],
    isLoading: tablesLoading,
  } = useTables(restaurantId, outletId, { includeInactive: true });

  // Mutations
  const createTableMut = useCreateTable(restaurantId, outletId);
  const updateTableMut = useUpdateTable(restaurantId, outletId);
  const toggleTableMut = useToggleTable(restaurantId, outletId);
  const deleteTableMut = useDeleteTable(restaurantId, outletId);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [viewMode, setViewMode] = useState<"grouped" | "grid">("grouped");

  // Modals state
  const [tableModal, setTableModal] = useState<{ open: boolean; editing: any | null }>({
    open: false,
    editing: null,
  });
  const [tableForm, setTableForm] = useState({
    name: "",
    section: "",
    capacity: 4,
  });
  const [tableFormError, setTableFormError] = useState<string | null>(null);

  // Bulk add modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    prefix: "T",
    startNum: 1,
    count: 4,
    section: "Main Dining",
    capacity: 4,
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  // Single table QR Modal
  const [qrModalTable, setQrModalTable] = useState<any | null>(null);

  // Floor QR Print Sheet Modal
  const [printSheetOpen, setPrintSheetOpen] = useState(false);
  const [printSectionFilter, setPrintSectionFilter] = useState<string>("ALL");

  // Delete Confirm Modal
  const [tableToDelete, setTableToDelete] = useState<any | null>(null);

  // Derive unique existing section names
  const existingSections = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => {
      const s = t.section?.trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [tables]);

  // Key KPI stats
  const stats = useMemo(() => {
    const totalTables = tables.length;
    const totalCapacity = tables.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0);
    const activeTables = tables.filter((t) => t.active).length;
    const inactiveTables = totalTables - activeTables;
    const sectionsCount = existingSections.length;
    return { totalTables, totalCapacity, activeTables, inactiveTables, sectionsCount };
  }, [tables, existingSections]);

  // Filtered tables based on search, status, and section
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      // Status filter
      if (statusFilter === "ACTIVE" && !t.active) return false;
      if (statusFilter === "INACTIVE" && t.active) return false;

      // Section tab filter (if not ALL)
      if (selectedSection !== "ALL") {
        if (selectedSection === "UNASSIGNED") {
          if (t.section?.trim()) return false;
        } else if (t.section?.trim() !== selectedSection) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesSection = (t.section || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSection) return false;
      }

      return true;
    });
  }, [tables, statusFilter, selectedSection, searchQuery]);

  // Grouped tables structure
  const groupedSections = useMemo(() => {
    const groups: { [key: string]: any[] } = {};

    filteredTables.forEach((t) => {
      const s = t.section?.trim() || "Unassigned";
      if (!groups[s]) groups[s] = [];
      groups[s].push(t);
    });

    // Sort sections: predefined/existing first, unassigned at end
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((sectionName) => ({
      name: sectionName,
      tables: groups[sectionName].sort((a, b) => {
        // Natural sort for table names like T1, T2, T10
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      }),
      config: getSectionConfig(sectionName),
      totalSeats: groups[sectionName].reduce((acc, t) => acc + (Number(t.capacity) || 0), 0),
      activeCount: groups[sectionName].filter((t) => t.active).length,
    }));
  }, [filteredTables]);

  // ─── Single Table Handlers ──────────────────────────────────────────────────
  const openCreateTable = (presetSection?: string) => {
    setTableForm({
      name: "",
      section: presetSection || existingSections[0] || "Main Dining",
      capacity: 4,
    });
    setTableFormError(null);
    setTableModal({ open: true, editing: null });
  };

  const openEditTable = (t: any) => {
    setTableForm({
      name: t.name,
      section: t.section ?? "",
      capacity: Number(t.capacity) || 4,
    });
    setTableFormError(null);
    setTableModal({ open: true, editing: t });
  };

  const saveTable = async () => {
    const trimmedName = tableForm.name.trim();
    if (!trimmedName) {
      setTableFormError("Table name or number is required");
      return;
    }

    if (!outletId) {
      notifications.show({
        title: "Error",
        message: "No active outlet selected.",
        color: "red",
      });
      return;
    }

    // Check duplicate name within the outlet
    const isDuplicate = tables.some(
      (t) =>
        t.name.toLowerCase() === trimmedName.toLowerCase() &&
        t.id !== tableModal.editing?.id
    );
    if (isDuplicate) {
      setTableFormError(`A table named "${trimmedName}" already exists in this outlet.`);
      return;
    }

    setTableFormError(null);
    try {
      const body = {
        name: trimmedName,
        section: tableForm.section.trim() || undefined,
        capacity: Number(tableForm.capacity) || 4,
      };

      if (tableModal.editing) {
        await updateTableMut.mutateAsync({ id: tableModal.editing.id, body });
        notifications.show({
          title: "Table Updated",
          message: `Table "${trimmedName}" has been updated.`,
          color: "teal",
          icon: <IconCheck size={16} />,
        });
      } else {
        await createTableMut.mutateAsync({ outletId, ...body });
        notifications.show({
          title: "Table Added",
          message: `Table "${trimmedName}" added successfully.`,
          color: "teal",
          icon: <IconCheck size={16} />,
        });
      }
      setTableModal({ open: false, editing: null });
    } catch (err: any) {
      notifications.show({
        title: "Failed to Save",
        message: err.message || "An error occurred while saving the table.",
        color: "red",
      });
    }
  };

  const handleToggleTable = async (t: any) => {
    try {
      await toggleTableMut.mutateAsync(t.id);
      notifications.show({
        title: t.active ? "Table Paused" : "Table Activated",
        message: `Table ${t.name} is now ${t.active ? "paused (inactive)" : "active"}.`,
        color: t.active ? "gray" : "teal",
      });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to toggle table status",
        color: "red",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!tableToDelete) return;
    try {
      await deleteTableMut.mutateAsync(tableToDelete.id);
      notifications.show({
        title: "Table Deleted",
        message: `Table "${tableToDelete.name}" was removed from the floor layout.`,
        color: "green",
      });
      setTableToDelete(null);
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to delete table",
        color: "red",
      });
    }
  };

  // ─── Bulk Multi-Add Handler ────────────────────────────────────────────────
  const bulkPreviewList = useMemo(() => {
    const list: string[] = [];
    const count = Math.min(Math.max(1, Number(bulkForm.count) || 1), 30);
    const start = Math.max(1, Number(bulkForm.startNum) || 1);
    for (let i = 0; i < count; i++) {
      list.push(`${bulkForm.prefix.trim()}${start + i}`);
    }
    return list;
  }, [bulkForm]);

  const handleBulkCreate = async () => {
    if (!outletId) return;
    setBulkSaving(true);
    let createdCount = 0;
    let skippedCount = 0;

    try {
      for (const name of bulkPreviewList) {
        // check duplicate
        if (tables.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
          skippedCount++;
          continue;
        }
        await createTableMut.mutateAsync({
          outletId,
          name,
          section: bulkForm.section.trim() || undefined,
          capacity: Number(bulkForm.capacity) || 4,
        });
        createdCount++;
      }

      notifications.show({
        title: "Bulk Creation Complete",
        message: `Created ${createdCount} tables in ${bulkForm.section}.${
          skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ""
        }`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setBulkModalOpen(false);
    } catch (err: any) {
      notifications.show({
        title: "Bulk Creation Error",
        message: err.message || "Failed to create all tables",
        color: "red",
      });
    } finally {
      setBulkSaving(false);
    }
  };

  // ─── QR Code Print Handlers ────────────────────────────────────────────────
  const getTableQrUrl = (tableName: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/menu?outletId=${outletId || ""}&table=${encodeURIComponent(
        tableName
      )}`;
    }
    return `https://dine.logixsoft.in/menu?outletId=${outletId || ""}&table=${encodeURIComponent(
      tableName
    )}`;
  };

  const handlePrintQrStand = (table: any) => {
    const qrUrl = getTableQrUrl(table.name);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Table ${table.name} QR Stand - ${currentOutlet?.name}</title>
          <style>
            @page { size: A5 portrait; margin: 10mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              text-align: center;
              margin: 0;
              padding: 40px 20px;
              color: #1a1a1a;
            }
            .card {
              max-width: 360px;
              margin: 0 auto;
              border: 2px solid #e0e0e0;
              border-radius: 20px;
              padding: 32px 24px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.06);
            }
            .brand { font-size: 18px; font-weight: 700; color: #7950f2; margin-bottom: 4px; }
            .outlet { font-size: 13px; color: #666; margin-bottom: 24px; }
            .table-badge {
              display: inline-block;
              background: #f3f0ff;
              color: #7950f2;
              font-size: 28px;
              font-weight: 800;
              padding: 6px 20px;
              border-radius: 12px;
              margin-bottom: 8px;
            }
            .section-badge {
              font-size: 13px;
              color: #888;
              font-weight: 500;
              margin-bottom: 20px;
            }
            .qr-box {
              background: #ffffff;
              padding: 16px;
              display: inline-block;
              border-radius: 16px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }
            .instruction {
              font-size: 15px;
              font-weight: 600;
              color: #333;
              margin-top: 20px;
              margin-bottom: 4px;
            }
            .sub-inst {
              font-size: 12px;
              color: #888;
              line-height: 1.4;
            }
            .powered {
              margin-top: 28px;
              font-size: 11px;
              color: #aaa;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">${restaurant?.name || "Logix Dine"}</div>
            <div class="outlet">${currentOutlet?.name || "Restaurant Floor"}</div>
            
            <div class="table-badge">TABLE ${table.name}</div>
            <div class="section-badge">${table.section || "Dining Floor"} · ${
      table.capacity || 4
    } Seats</div>
            
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                qrUrl
              )}" width="220" height="220" alt="QR Code" />
            </div>

            <div class="instruction">Scan with phone camera to order</div>
            <div class="sub-inst">Browse live digital menu, customize items & request service right from your seat.</div>
            
            <div class="powered">Powered by Logix Dine</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isSaving = createTableMut.isPending || updateTableMut.isPending;

  return (
    <Stack gap="lg" w="100%">
      {/* ─── Top Stats Bar (KPI Highlights) ─────────────────────────────────── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Paper p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Total Tables
              </Text>
              <Text size="xl" fw={700} mt={4}>
                {stats.totalTables}
              </Text>
              <Text size="xs" c="dimmed">
                Across {stats.sectionsCount} floor zones
              </Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="dinePrimary">
              <IconTable size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Seating Capacity
              </Text>
              <Text size="xl" fw={700} mt={4}>
                {stats.totalCapacity}
              </Text>
              <Text size="xs" c="dimmed">
                Total guest seats
              </Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="blue">
              <IconUsers size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Floor Sections
              </Text>
              <Text size="xl" fw={700} mt={4}>
                {stats.sectionsCount}
              </Text>
              <Text size="xs" c="dimmed">
                Physical dining areas
              </Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="teal">
              <IconLayoutGrid size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                Active Floor
              </Text>
              <Text size="xl" fw={700} mt={4} c="teal">
                {stats.activeTables}{" "}
                <Text component="span" size="sm" fw={500} c="dimmed">
                  / {stats.totalTables}
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                {stats.inactiveTables > 0
                  ? `${stats.inactiveTables} paused tables`
                  : "All tables active"}
              </Text>
            </div>
            <ThemeIcon size={38} radius="md" variant="light" color="teal">
              <IconCircleCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ─── Action Toolbar & Filter Header ──────────────────────────────────── */}
      <Paper p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              {currentOutlet && (
                <Badge variant="light" color="dinePrimary" size="lg" radius="sm">
                  {currentOutlet.name}
                </Badge>
              )}
              <Text size="sm" c="dimmed">
                Showing {filteredTables.length} of {tables.length} tables
              </Text>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Button
                variant="default"
                size="sm"
                leftSection={<IconPrinter size={15} />}
                onClick={() => {
                  setPrintSectionFilter(selectedSection);
                  setPrintSheetOpen(true);
                }}
                disabled={tables.length === 0}
              >
                Print Floor QRs
              </Button>

              <Button
                variant="light"
                color="dinePrimary"
                size="sm"
                leftSection={<IconPlaylistAdd size={16} />}
                onClick={() => setBulkModalOpen(true)}
                disabled={!outletId}
              >
                Bulk Add
              </Button>

              <Button
                color="dinePrimary"
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={() => openCreateTable(selectedSection !== "ALL" ? selectedSection : undefined)}
                disabled={!outletId}
              >
                Add Table
              </Button>
            </Group>
          </Group>

          <Divider />

          {/* Search, Status, View mode, and Section Filter Tabs */}
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <TextInput
              placeholder="Search table (e.g. T1, F2) or section..."
              size="sm"
              leftSection={<IconSearch size={15} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
              rightSection={
                searchQuery ? (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => setSearchQuery("")}
                  >
                    ×
                  </ActionIcon>
                ) : null
              }
            />

            <Group gap="xs" wrap="nowrap">
              <SegmentedControl
                size="sm"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as any)}
                data={[
                  { label: "All Status", value: "ALL" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Paused", value: "INACTIVE" },
                ]}
              />

              <SegmentedControl
                size="sm"
                value={viewMode}
                onChange={(v) => setViewMode(v as any)}
                data={[
                  {
                    value: "grouped",
                    label: (
                      <Group gap={4} wrap="nowrap">
                        <IconLayoutGrid size={14} />
                        <span>By Section</span>
                      </Group>
                    ),
                  },
                  {
                    value: "grid",
                    label: (
                      <Group gap={4} wrap="nowrap">
                        <IconList size={14} />
                        <span>Flat Grid</span>
                      </Group>
                    ),
                  },
                ]}
              />
            </Group>
          </Group>

          {/* Section Filter Pills / Tabs */}
          <Group gap="xs" wrap="wrap">
            <Button
              size="xs"
              variant={selectedSection === "ALL" ? "filled" : "default"}
              color="dinePrimary"
              radius="xl"
              onClick={() => setSelectedSection("ALL")}
            >
              All Sections ({tables.length})
            </Button>

            {existingSections.map((secName) => {
              const secCfg = getSectionConfig(secName);
              const count = tables.filter((t) => t.section?.trim() === secName).length;
              const isSelected = selectedSection === secName;
              return (
                <Button
                  key={secName}
                  size="xs"
                  variant={isSelected ? "filled" : "default"}
                  color={isSelected ? secCfg.color : "gray"}
                  radius="xl"
                  onClick={() => setSelectedSection(secName)}
                  leftSection={<span>{secCfg.emoji}</span>}
                >
                  {secName} ({count})
                </Button>
              );
            })}

            {tables.some((t) => !t.section?.trim()) && (
              <Button
                size="xs"
                variant={selectedSection === "UNASSIGNED" ? "filled" : "default"}
                color="gray"
                radius="xl"
                onClick={() => setSelectedSection("UNASSIGNED")}
              >
                Unassigned ({tables.filter((t) => !t.section?.trim()).length})
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>

      {/* ─── Tables Content ─────────────────────────────────────────────────── */}
      {tablesLoading ? (
        <Center py={80}>
          <Loader size="md" color="dinePrimary" />
        </Center>
      ) : filteredTables.length === 0 ? (
        <Paper p="xl" radius="md" style={{ textAlign: "center" }}>
          <Stack align="center" gap="sm" py={20}>
            <ThemeIcon size={56} radius="xl" variant="light" color="gray">
              <IconTable size={28} />
            </ThemeIcon>
            <Title order={4}>No tables found</Title>
            <Text size="sm" c="dimmed" maw={400}>
              {searchQuery
                ? `No tables match "${searchQuery}". Try clearing search or choosing another section.`
                : "No tables registered for this section or filter."}
            </Text>
            <Group mt="xs">
              {searchQuery && (
                <Button size="xs" variant="default" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              )}
              <Button
                size="xs"
                color="dinePrimary"
                leftSection={<IconPlus size={14} />}
                onClick={() => openCreateTable(selectedSection !== "ALL" ? selectedSection : undefined)}
              >
                Add Table
              </Button>
            </Group>
          </Stack>
        </Paper>
      ) : viewMode === "grouped" ? (
        /* ─── VIEW 1: Grouped By Section (Requested by user) ──────────────── */
        <Stack gap="xl">
          {groupedSections.map((group) => {
            const SectionIcon = group.config.icon;
            return (
              <Box key={group.name}>
                {/* Section Header */}
                <Group justify="space-between" align="center" mb="sm" wrap="wrap">
                  <Group gap="sm">
                    <ThemeIcon
                      size={36}
                      radius="md"
                      color={group.config.color}
                      variant="light"
                    >
                      <SectionIcon size={20} />
                    </ThemeIcon>
                    <div>
                      <Group gap="xs" align="center">
                        <Text fw={700} size="md">
                          {group.name}
                        </Text>
                        <Badge size="xs" color={group.config.color} variant="light">
                          {group.config.badgeLabel}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {group.tables.length} {group.tables.length === 1 ? "table" : "tables"} ·{" "}
                        {group.totalSeats} total seats · {group.activeCount} active
                      </Text>
                    </div>
                  </Group>

                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="subtle"
                      color={group.config.color}
                      leftSection={<IconPrinter size={14} />}
                      onClick={() => {
                        setPrintSectionFilter(group.name);
                        setPrintSheetOpen(true);
                      }}
                    >
                      Print Section QRs
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color={group.config.color}
                      leftSection={<IconPlus size={14} />}
                      onClick={() => openCreateTable(group.name === "Unassigned" ? undefined : group.name)}
                    >
                      Add Table
                    </Button>
                  </Group>
                </Group>

                {/* Section Tables Grid */}
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
                  {group.tables.map((t) => (
                    <TableCard
                      key={t.id}
                      table={t}
                      sectionColor={group.config.color}
                      onEdit={() => openEditTable(t)}
                      onToggle={() => handleToggleTable(t)}
                      onDelete={() => setTableToDelete(t)}
                      onQr={() => setQrModalTable(t)}
                    />
                  ))}
                </SimpleGrid>
              </Box>
            );
          })}
        </Stack>
      ) : (
        /* ─── VIEW 2: Flat Grid ───────────────────────────────────────────── */
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {filteredTables.map((t) => {
            const secCfg = getSectionConfig(t.section);
            return (
              <TableCard
                key={t.id}
                table={t}
                sectionColor={secCfg.color}
                onEdit={() => openEditTable(t)}
                onToggle={() => handleToggleTable(t)}
                onDelete={() => setTableToDelete(t)}
                onQr={() => setQrModalTable(t)}
              />
            );
          })}
        </SimpleGrid>
      )}

      {/* ─── Add / Edit Table Modal ─────────────────────────────────────────── */}
      <Modal
        opened={tableModal.open}
        onClose={() => setTableModal({ open: false, editing: null })}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="dinePrimary" variant="light">
              <IconTable size={16} />
            </ThemeIcon>
            <Text fw={700}>
              {tableModal.editing ? `Edit Table "${tableModal.editing.name}"` : "Add Dining Table"}
            </Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md" mt="xs">
          <TextInput
            label="Table Identifier / Name"
            placeholder="e.g. T1, T2, Window 4, Bar 3"
            required
            value={tableForm.name}
            error={tableFormError}
            onChange={(e) => {
              setTableForm((f) => ({ ...f, name: e.target.value }));
              if (tableFormError) setTableFormError(null);
            }}
          />

          <Autocomplete
            label="Floor Section"
            placeholder="e.g. Main Dining, AC Family Hall, Rooftop Garden"
            description="Select an existing floor zone or type a new section name"
            data={existingSections}
            value={tableForm.section}
            onChange={(val) => setTableForm((f) => ({ ...f, section: val }))}
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              Seating Capacity (Pax)
            </Text>
            <Group gap={6} mb="xs">
              {CAPACITY_PRESETS.map((cap) => (
                <Button
                  key={cap}
                  size="xs"
                  variant={Number(tableForm.capacity) === cap ? "filled" : "outline"}
                  color="dinePrimary"
                  radius="xl"
                  onClick={() => setTableForm((f) => ({ ...f, capacity: cap }))}
                >
                  {cap} Seats
                </Button>
              ))}
            </Group>
            <NumberInput
              placeholder="Custom capacity"
              min={1}
              max={100}
              value={tableForm.capacity}
              onChange={(val) => setTableForm((f) => ({ ...f, capacity: Number(val) || 4 }))}
            />
          </div>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setTableModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              onClick={saveTable}
              loading={isSaving}
              leftSection={<IconCheck size={16} />}
            >
              Save Table
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Bulk Multi-Add Modal ───────────────────────────────────────────── */}
      <Modal
        opened={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="dinePrimary" variant="light">
              <IconPlaylistAdd size={16} />
            </ThemeIcon>
            <Text fw={700}>Bulk Add Dining Tables</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md" mt="xs">
          <Text size="xs" c="dimmed">
            Quickly generate sequential tables for an entire section with 1 click.
          </Text>

          <SimpleGrid cols={2} spacing="md">
            <TextInput
              label="Table Prefix"
              placeholder="e.g. T, F, Booth "
              required
              value={bulkForm.prefix}
              onChange={(e) => setBulkForm((f) => ({ ...f, prefix: e.target.value }))}
            />
            <NumberInput
              label="Starting Number"
              min={1}
              required
              value={bulkForm.startNum}
              onChange={(v) => setBulkForm((f) => ({ ...f, startNum: Number(v) || 1 }))}
            />
          </SimpleGrid>

          <SimpleGrid cols={2} spacing="md">
            <NumberInput
              label="Number of Tables"
              min={1}
              max={25}
              required
              value={bulkForm.count}
              onChange={(v) => setBulkForm((f) => ({ ...f, count: Number(v) || 1 }))}
            />
            <NumberInput
              label="Seats Per Table"
              min={1}
              max={50}
              required
              value={bulkForm.capacity}
              onChange={(v) => setBulkForm((f) => ({ ...f, capacity: Number(v) || 4 }))}
            />
          </SimpleGrid>

          <Autocomplete
            label="Target Section"
            placeholder="e.g. Main Dining, Terrace"
            data={existingSections}
            value={bulkForm.section}
            onChange={(val) => setBulkForm((f) => ({ ...f, section: val }))}
          />

          {/* Live Preview Box */}
          <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
            <Text size="xs" fw={600} mb={6} c="dimmed" tt="uppercase">
              Live Preview of Tables to be Created ({bulkPreviewList.length} Tables):
            </Text>
            <Group gap={6} wrap="wrap">
              {bulkPreviewList.map((item) => (
                <Badge key={item} size="sm" variant="filled" color="dinePrimary">
                  {item}
                </Badge>
              ))}
            </Group>
            <Text size="xs" c="dimmed" mt={8}>
              {bulkPreviewList.length * bulkForm.capacity} total seats will be added to &quot;{bulkForm.section}&quot;.
            </Text>
          </Paper>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              onClick={handleBulkCreate}
              loading={bulkSaving}
              leftSection={<IconSparkles size={16} />}
            >
              Generate {bulkPreviewList.length} Tables
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Single Table QR Modal ─────────────────────────────────────────── */}
      <Modal
        opened={Boolean(qrModalTable)}
        onClose={() => setQrModalTable(null)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="dinePrimary" variant="light">
              <IconQrcode size={16} />
            </ThemeIcon>
            <Text fw={700}>Table QR Menu & Stand · {qrModalTable?.name}</Text>
          </Group>
        }
        size="md"
      >
        {qrModalTable && (
          <Stack gap="md" align="center" py="xs">
            <Paper
              withBorder
              p="lg"
              radius="lg"
              style={{
                textAlign: "center",
                background: "var(--mantine-color-body)",
                maxWidth: 320,
                width: "100%",
              }}
            >
              <Text size="xs" fw={700} c="dinePrimary" tt="uppercase" style={{ letterSpacing: 1 }}>
                {restaurant?.name || "Logix Dine"}
              </Text>
              <Text size="xs" c="dimmed" mb="sm">
                {currentOutlet?.name}
              </Text>

              <Badge size="xl" radius="sm" color="dinePrimary" variant="filled" mb="md">
                TABLE {qrModalTable.name}
              </Badge>

              <Center p="xs" bg="white" style={{ borderRadius: 12, display: "inline-flex" }}>
                <QRCode
                  value={getTableQrUrl(qrModalTable.name)}
                  size={190}
                />
              </Center>

              <Text size="sm" fw={600} mt="md">
                Scan to View Menu & Order
              </Text>
              <Text size="xs" c="dimmed">
                {qrModalTable.section || "Dining Floor"} · {qrModalTable.capacity || 4} Seats
              </Text>
            </Paper>

            <Group gap="xs" w="100%" justify="center">
              <CopyButton value={getTableQrUrl(qrModalTable.name)}>
                {({ copied, copy }) => (
                  <Button
                    size="sm"
                    variant={copied ? "filled" : "light"}
                    color={copied ? "teal" : "dinePrimary"}
                    leftSection={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                    onClick={copy}
                  >
                    {copied ? "Link Copied" : "Copy Menu Link"}
                  </Button>
                )}
              </CopyButton>

              <Button
                size="sm"
                variant="default"
                component="a"
                href={getTableQrUrl(qrModalTable.name)}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<IconExternalLink size={15} />}
              >
                Test Menu
              </Button>

              <Button
                size="sm"
                color="dinePrimary"
                leftSection={<IconPrinter size={15} />}
                onClick={() => handlePrintQrStand(qrModalTable)}
              >
                Print Stand
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* ─── Multi-Table Print Sheet Modal ─────────────────────────────────── */}
      <Modal
        opened={printSheetOpen}
        onClose={() => setPrintSheetOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="dinePrimary" variant="light">
              <IconPrinter size={16} />
            </ThemeIcon>
            <Text fw={700}>Print Floor QR Tent Cards</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Select
              label="Filter Section to Print"
              size="xs"
              value={printSectionFilter}
              onChange={(v: string | null) => setPrintSectionFilter(v || "ALL")}
              data={[
                { value: "ALL", label: `All Sections (${tables.length} tables)` },
                ...existingSections.map((s) => ({
                  value: s,
                  label: `${s} (${tables.filter((t) => t.section === s).length} tables)`,
                })),
              ]}
              style={{ minWidth: 240 }}
            />
            <Button
              color="dinePrimary"
              size="sm"
              leftSection={<IconPrinter size={16} />}
              onClick={() => {
                const targetTables = tables.filter((t) =>
                  printSectionFilter === "ALL" ? true : t.section === printSectionFilter
                );
                const printWin = window.open("", "_blank");
                if (!printWin) return;

                printWin.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Floor QR Cards - ${currentOutlet?.name}</title>
                      <style>
                        @page { size: A4 portrait; margin: 10mm; }
                        body {
                          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                          margin: 0;
                          padding: 10px;
                          background: #fff;
                        }
                        .grid {
                          display: grid;
                          grid-template-columns: repeat(2, 1fr);
                          gap: 16px;
                        }
                        .card {
                          border: 2px dashed #bbb;
                          border-radius: 12px;
                          padding: 16px;
                          text-align: center;
                          page-break-inside: avoid;
                        }
                        .brand { font-size: 14px; font-weight: 700; color: #7950f2; }
                        .outlet { font-size: 11px; color: #666; margin-bottom: 8px; }
                        .table-badge {
                          display: inline-block;
                          background: #f3f0ff;
                          color: #7950f2;
                          font-size: 20px;
                          font-weight: 800;
                          padding: 4px 14px;
                          border-radius: 8px;
                          margin-bottom: 8px;
                        }
                        .inst { font-size: 12px; font-weight: 600; margin-top: 8px; }
                        .sub { font-size: 10px; color: #888; }
                      </style>
                    </head>
                    <body>
                      <div class="grid">
                        ${targetTables
                          .map((t) => {
                            const url = getTableQrUrl(t.name);
                            return `
                            <div class="card">
                              <div class="brand">${restaurant?.name || "Logix Dine"}</div>
                              <div class="outlet">${currentOutlet?.name || ""} · ${t.section || "Floor"}</div>
                              <div class="table-badge">TABLE ${t.name}</div>
                              <div>
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                  url
                                )}" width="140" height="140" />
                              </div>
                              <div class="inst">Scan to View Menu & Order</div>
                              <div class="sub">${t.capacity || 4} Seats · Contactless Dining</div>
                            </div>
                          `;
                          })
                          .join("")}
                      </div>
                      <script>
                        window.onload = function() { window.print(); };
                      </script>
                    </body>
                  </html>
                `);
                printWin.document.close();
              }}
            >
              Print Cards Now
            </Button>
          </Group>

          <Paper withBorder p="md" radius="md" bg="var(--mantine-color-gray-0)">
            <Text size="xs" c="dimmed">
              Prints 4 table tent cards per A4 page. Perfect for printing acrylic stand inserts or table stickers.
            </Text>
          </Paper>
        </Stack>
      </Modal>

      {/* ─── Delete Table Confirmation Modal ───────────────────────────────── */}
      <Modal
        opened={Boolean(tableToDelete)}
        onClose={() => setTableToDelete(null)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="red" variant="light">
              <IconTrash size={16} />
            </ThemeIcon>
            <Text fw={700}>Delete Dining Table</Text>
          </Group>
        }
        size="sm"
      >
        <Stack gap="md" mt="xs">
          <Text size="sm">
            Are you sure you want to delete table <b>&quot;{tableToDelete?.name}&quot;</b>?
          </Text>
          <Text size="xs" c="dimmed">
            This will permanently remove the table from the floor plan and POS floor screen. Past settled orders will retain their historical table records.
          </Text>

          <Group justify="flex-end" gap="xs" mt="sm">
            <Button
              variant="default"
              size="sm"
              onClick={() => setTableToDelete(null)}
              disabled={deleteTableMut.isPending}
            >
              Cancel
            </Button>
            <Button
              color="red"
              size="sm"
              loading={deleteTableMut.isPending}
              onClick={handleConfirmDelete}
              leftSection={<IconTrash size={15} />}
            >
              Delete Table
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ─── Sub-component: Redesigned Table Card ──────────────────────────────────────
interface TableCardProps {
  table: any;
  sectionColor: string;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onQr: () => void;
}

function TableCard({
  table,
  sectionColor,
  onEdit,
  onToggle,
  onDelete,
  onQr,
}: TableCardProps) {
  return (
    <Card
      radius="md"
      p="md"
      style={{
        backgroundColor: "#ffffff",
        border: "none",
        boxShadow: "none",
        transition: "all 0.15s ease",
        opacity: table.active ? 1 : 0.75,
      }}
    >
      {/* Top Header: Table Name & Status */}
      <Group justify="space-between" align="center" mb={10}>
        <Group gap="xs">
          <Badge
            size="lg"
            radius="sm"
            color={sectionColor}
            variant="filled"
            style={{ fontWeight: 800, fontSize: "0.95rem" }}
          >
            {table.name}
          </Badge>
          {table.section && (
            <Text size="xs" c="dimmed" fw={500} truncate maw={110}>
              {table.section}
            </Text>
          )}
        </Group>

        <Badge
          size="xs"
          color={table.active ? "teal" : "gray"}
          variant="light"
          leftSection={
            table.active ? (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "var(--mantine-color-teal-6)",
                  display: "inline-block",
                }}
              />
            ) : undefined
          }
        >
          {table.active ? "Active" : "Paused"}
        </Badge>
      </Group>

      {/* Middle Specs: Capacity & QR Ready pill */}
      <Group justify="space-between" align="center" mb="xs">
        <Group gap={4}>
          <IconUsers size={14} color="var(--mantine-color-dimmed)" />
          <Text size="xs" c="dimmed">
            {table.capacity || 4} Seats
          </Text>
        </Group>

        <Tooltip label="View QR Menu Link" withArrow>
          <Badge
            size="xs"
            variant="outline"
            color="dinePrimary"
            leftSection={<IconQrcode size={11} />}
            style={{ cursor: "pointer" }}
            onClick={onQr}
          >
            QR Ready
          </Badge>
        </Tooltip>
      </Group>

      <Divider my={8} color="#f1f3f5" />

      {/* Action Toolbar */}
      <Group justify="space-between" align="center" mt={2}>
        <Tooltip label="Table QR Stand & Link" withArrow>
          <Button
            size="compact-xs"
            variant="subtle"
            color="dinePrimary"
            leftSection={<IconQrcode size={13} />}
            onClick={onQr}
          >
            QR Stand
          </Button>
        </Tooltip>

        <Group gap={4}>
          <Tooltip label="Edit Table" withArrow>
            <ActionIcon size="sm" variant="light" color="blue" onClick={onEdit}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip
            label={table.active ? "Pause Table" : "Activate Table"}
            withArrow
          >
            <ActionIcon
              size="sm"
              variant="light"
              color={table.active ? "gray" : "teal"}
              onClick={onToggle}
            >
              {table.active ? (
                <IconPlayerPause size={14} />
              ) : (
                <IconPlayerPlay size={14} />
              )}
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Delete Table" withArrow>
            <ActionIcon size="sm" variant="light" color="red" onClick={onDelete}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}
