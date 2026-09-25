"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Box, Title, Tabs, TextInput, Button, Stack, Group, Text,
  Paper, Badge, ActionIcon, Modal, Loader, Grid, Select, MultiSelect, ScrollArea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore, IconCheck, IconTrash,
  IconEdit, IconPlus, IconStar, IconPrinter, IconUsers, IconTableAlias,
  IconBook, IconChartBar, IconArrowLeft, IconClock, IconReceiptTax,
  IconCreditCard, IconCoffee, IconQrcode, IconBrandWhatsapp, IconCalendarEvent,
  IconMotorbike,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useStaff, useTables,
  useInviteStaff, useUpdateStaff, useRemoveStaff,
  useCreateTable, useUpdateTable, useToggleTable, useDeleteTable,
  useCreateOutlet, useUpdateOutlet, useDeleteOutlet, useSetDefaultOutlet,
} from "@/lib/queries";
import {
  updateRestaurant,
} from "@/lib/api-client";
import { PrinterButton } from "@/components/print/printer-button";
import { MenuManagement } from "../menu/menu-management";
import { ReportsManagement } from "../reports/reports-management";
import { StoreHoursManagement } from "./store-hours-management";
import { InvoiceTaxManagement } from "./invoice-tax-management";
import { DiningOptionsManagement } from "./dining-options-management";
import { QrMenuManagement } from "./qr-menu-management";
import { WhatsappManagement } from "./whatsapp-management";
import { ReservationsManagement } from "./reservations-management";
import { RidersManagement } from "./riders-management";

const STAFF_ROLES = [
  { value: "MANAGER", label: "Manager — full access to assigned outlet(s)" },
  { value: "WAITER", label: "Waiter — take & settle orders" },
  { value: "KITCHEN", label: "Kitchen — view KDS only" },
];

export const VALID_SETTINGS_TABS = [
  "restaurant",
  "menu",
  "tables",
  "hours",
  "tax",
  "reports",
  "staff",
  "printing",
  "payments",
  "dining",
  "qr-menu",
  "whatsapp",
  "reservations",
  "riders",
] as const;

export type SettingsTab = (typeof VALID_SETTINGS_TABS)[number];

export function SettingsView({ currentTab }: { currentTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { restaurant, outlets: ctxOutlets, activeOutlet, refresh, role } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const isOwner = role === "OWNER";

  const getTabFromPath = (path: string | null) => {
    if (!path) return currentTab || "restaurant";
    const parts = path.split("/").filter(Boolean);
    const settingsIdx = parts.indexOf("settings");
    if (settingsIdx !== -1 && parts[settingsIdx + 1]) {
      const tabName = parts[settingsIdx + 1];
      if (tabName === "outlets") return "restaurant";
      if (VALID_SETTINGS_TABS.includes(tabName as any)) {
        return tabName;
      }
    }
    return currentTab || "restaurant";
  };

  const [activeTab, setActiveTab] = useState<string>(() => getTabFromPath(pathname));

  useEffect(() => {
    const nextTab = getTabFromPath(pathname);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [pathname]);

  const handleTabChange = (val: string | null) => {
    if (!val) return;
    setActiveTab(val);
    router.push(`/settings/${val}`);
  };

  const [restForm, setRestForm] = useState({ name: "", address: "", phone: "" });
  const [restSaving, setRestSaving] = useState(false);
  const [outletModal, setOutletModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [outletForm, setOutletForm] = useState({ name: "", address: "", phone: "", upiId: "" });
  const [outletSaving, setOutletSaving] = useState(false);

  // Staff — React Query
  const { data: staff = [], isLoading: staffLoading } = useStaff(restaurantId, isOwner);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ phone: "", role: "WAITER", outletIds: [] as string[] });

  // Table — React Query (shared cache with POS page)
  const tableOutletId = activeOutlet?.id ?? (ctxOutlets[0]?.id || null);
  const { data: tables = [], isLoading: tablesLoading } = useTables(restaurantId, tableOutletId, { includeInactive: true });
  const [tableModal, setTableModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [tableForm, setTableForm] = useState({ name: "", section: "", capacity: "" });
  const [tableFormError, setTableFormError] = useState<string | null>(null);
  const [tableToDelete, setTableToDelete] = useState<any | null>(null);

  // Outlet mutations
  const createOutletMut = useCreateOutlet(restaurantId);
  const updateOutletMut = useUpdateOutlet(restaurantId);
  const deleteOutletMut = useDeleteOutlet(restaurantId);
  const setDefaultMut = useSetDefaultOutlet(restaurantId);

  // Staff mutations
  const inviteStaffMut = useInviteStaff(restaurantId);
  const updateStaffMut = useUpdateStaff(restaurantId);
  const removeStaffMut = useRemoveStaff(restaurantId);

  // Table mutations
  const createTableMut = useCreateTable(restaurantId, tableOutletId);
  const updateTableMut = useUpdateTable(restaurantId, tableOutletId);
  const toggleTableMut = useToggleTable(restaurantId, tableOutletId);
  const deleteTableMut = useDeleteTable(restaurantId, tableOutletId);

  // Outlets from context (still managed there for the header switcher)
  const outlets = ctxOutlets;

  useEffect(() => {
    if (restaurant) setRestForm({ name: restaurant.name, address: restaurant.address, phone: restaurant.phone ?? "" });
  }, [restaurant]);

  // ─── Save / Update restaurant ────────────────────────────────────────────
  const saveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestSaving(true);
    try {
      await updateRestaurant(restaurantId, { name: restForm.name, address: restForm.address, phone: restForm.phone || null });
      await refresh();
      notifications.show({ title: "Saved", message: "Restaurant updated", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally { setRestSaving(false); }
  };

  // ─── Outlet handlers ────────────────────────────────────────────────────
  const openCreateOutlet = () => {
    setOutletForm({ name: "", address: "", phone: "", upiId: "" });
    setOutletModal({ open: true, editing: null });
  };

  const openEditOutlet = (o: any) => {
    setOutletForm({
      name: o.name,
      address: o.address ?? "",
      phone: o.phone ?? "",
      upiId: o.upiId ?? "",
    });
    setOutletModal({ open: true, editing: o });
  };

  const saveOutlet = async () => {
    if (!outletForm.name.trim()) return;
    setOutletSaving(true);
    try {
      if (outletModal.editing) {
        await updateOutletMut.mutateAsync({
          id: outletModal.editing.id,
          body: {
            name: outletForm.name.trim(),
            address: outletForm.address?.trim() || null,
            phone: outletForm.phone?.trim() || null,
            upiId: outletForm.upiId?.trim() || null,
          },
        });
      } else {
        await createOutletMut.mutateAsync({
          name: outletForm.name.trim(),
          address: outletForm.address?.trim() || undefined,
          phone: outletForm.phone?.trim() || undefined,
          upiId: outletForm.upiId?.trim() || undefined,
        });
      }
      await refresh();
      setOutletModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Outlet saved", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setOutletSaving(false);
    }
  };

  const handleSetDefault = async (outlet: any) => {
    try {
      await setDefaultMut.mutateAsync(outlet.id);
      await refresh();
      notifications.show({ title: "Updated", message: `Default outlet set to ${outlet.name}`, color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleDeleteOutlet = async (outlet: any) => {
    if (!confirm(`Delete outlet "${outlet.name}"?`)) return;
    try {
      await deleteOutletMut.mutateAsync(outlet.id);
      await refresh();
      notifications.show({ title: "Deleted", message: `Outlet ${outlet.name} removed`, color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // ─── Staff handlers ─────────────────────────────────────────────────────

  const openInvite = () => {
    const defaultOutletId = activeOutlet?.id || outlets[0]?.id;
    setInviteForm({ phone: "", role: "WAITER", outletIds: defaultOutletId ? [defaultOutletId] : [] });
    setInviteModal(true);
  };

  const saveInvite = async () => {
    if (!inviteForm.phone.trim() || !inviteForm.outletIds.length) {
      notifications.show({ title: "Missing info", message: "Phone and at least one outlet are required", color: "orange" });
      return;
    }
    try {
      await inviteStaffMut.mutateAsync(inviteForm);
      setInviteModal(false);
      notifications.show({ title: "Invited", message: "Staff member invited — they can now sign in to access it", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleRoleChange = async (member: any, newRole: string) => {
    try {
      await updateStaffMut.mutateAsync({ id: member.id, body: { role: newRole } });
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  const handleOutletsChange = async (member: any, outletIds: string[]) => {
    try {
      await updateStaffMut.mutateAsync({ id: member.id, body: { outletIds } });
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  const handleRemoveStaff = async (member: any) => {
    if (!confirm(`Remove ${member.phone} from staff?`)) return;
    try {
      await removeStaffMut.mutateAsync(member.id);
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  // ─── Table handlers ─────────────────────────────────────────────────────

  const openCreateTable = () => {
    setTableForm({ name: "", section: "", capacity: "" });
    setTableFormError(null);
    setTableModal({ open: true, editing: null });
  };
  const openEditTable = (t: any) => {
    setTableForm({ name: t.name, section: t.section ?? "", capacity: t.capacity ? String(t.capacity) : "" });
    setTableFormError(null);
    setTableModal({ open: true, editing: t });
  };

  const saveTable = async () => {
    if (!tableForm.name.trim()) {
      setTableFormError("Table name is required");
      return;
    }
    if (!tableOutletId) {
      notifications.show({ title: "Error", message: "Please select an outlet first", color: "orange" });
      return;
    }
    setTableFormError(null);
    try {
      const body = {
        name: tableForm.name.trim(),
        section: tableForm.section || undefined,
        capacity: tableForm.capacity ? Number(tableForm.capacity) : undefined,
      };
      if (tableModal.editing) {
        await updateTableMut.mutateAsync({ id: tableModal.editing.id, body });
      } else {
        await createTableMut.mutateAsync({ outletId: tableOutletId, ...body });
      }
      setTableModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Table saved", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleToggleTable = async (t: any) => {
    try {
      await toggleTableMut.mutateAsync(t.id);
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  const handleDeleteTable = (t: any) => {
    setTableToDelete(t);
  };

  const handleConfirmDeleteTable = async () => {
    if (!tableToDelete) return;
    try {
      await deleteTableMut.mutateAsync(tableToDelete.id);
      notifications.show({ title: "Removed", message: `Table "${tableToDelete.name}" removed`, color: "green" });
      setTableToDelete(null);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const tableSaving = createTableMut.isPending || updateTableMut.isPending;
  const inviteSaving = inviteStaffMut.isPending;

  const OutletCard = ({ outlet }: { outlet: any }) => (
    <Paper key={outlet.id} p="md" radius="md">
      <Group justify="space-between" align="center" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} truncate>{outlet.name}</Text>
            {outlet.isDefault && <Badge size="xs" color="dinePrimary">Default</Badge>}
          </Group>
          {outlet.address && <Text size="xs" c="dimmed" truncate>{outlet.address}</Text>}
          {outlet.phone && <Text size="xs" c="dimmed">{outlet.phone}</Text>}
          {outlet.upiId && <Text size="xs" c="teal" fw={500} truncate>UPI: {outlet.upiId}</Text>}
        </div>
        <Group gap="xs" wrap="nowrap">
          {!outlet.isDefault && (
            <ActionIcon variant="light" color="yellow" size="sm" onClick={() => handleSetDefault(outlet)} title="Set as default">
              <IconStar size={14} />
            </ActionIcon>
          )}
          <ActionIcon variant="light" size="sm" onClick={() => openEditOutlet(outlet)} title="Edit outlet">
            <IconEdit size={14} />
          </ActionIcon>
          {!outlet.isDefault && (
            <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDeleteOutlet(outlet)} title="Delete outlet">
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Paper>
  );

  if (!restaurant) return <Loader />;

  const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
    restaurant: {
      title: "Store & Outlets",
      subtitle: "Configure store details, contact, and outlets",
    },
    menu: {
      title: "Menu Catalog",
      subtitle: "Add, categorize, and edit menu items & add-ons",
    },
    tables: {
      title: "Table Management",
      subtitle: "Manage dining tables, sections, and seating",
    },
    hours: {
      title: "Store Hours",
      subtitle: "Configure daily opening, closing, and break timings",
    },
    tax: {
      title: "Invoice & Tax",
      subtitle: "GST slabs, inclusive/exclusive pricing, invoice series & charges",
    },
    reports: {
      title: "Analytics & Reports",
      subtitle: "View sales summaries, item sales, and tax reports",
    },
    staff: {
      title: "Staff & Team",
      subtitle: "Manage team members, roles, and outlet access",
    },
    printing: {
      title: "Thermal Printers",
      subtitle: "Configure Bluetooth & network thermal printers for bills & KOTs",
    },
    payments: {
      title: "Payment Types & UPI",
      subtitle: "Configure accepted payments, UPI IDs, and dynamic QR",
    },
    dining: {
      title: "Dining Options",
      subtitle: "Toggle dine-in, takeaway, and delivery modes",
    },
    "qr-menu": {
      title: "QR Menu Ordering",
      subtitle: "Customise table QR code ordering & self-checkout",
    },
    whatsapp: {
      title: "WhatsApp Alerts",
      subtitle: "Send instant e-bills and order updates via WhatsApp",
    },
    reservations: {
      title: "Table Reservations",
      subtitle: "Manage guest reservations, time slots, and party sizes",
    },
    riders: {
      title: "Delivery & Riders",
      subtitle: "Manage delivery riders, external couriers, and dispatch",
    },
  };

  const currentTabMeta = TAB_TITLES[activeTab] || TAB_TITLES.restaurant;

  return (
    <Box pt="md" pb={100} px={{ base: "xs", sm: "md" }}>
      <Group justify="space-between" align="center" mb="lg">
        <div>
          <Title order={2}>{currentTabMeta.title}</Title>
          <Text size="sm" c="dimmed">{currentTabMeta.subtitle}</Text>
        </div>
      </Group>

      <Tabs value={activeTab} onChange={(v) => v && router.push(`/settings/${v}`)}>

        {/* Restaurant tab */}
        <Tabs.Panel value="restaurant">
          <Grid gap="md">
            {/* Restaurant Details on the left */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper p="md" radius="md">
                <form onSubmit={saveRestaurant}>
                  <Stack gap="sm">
                    <Text fw={600}>Restaurant Details</Text>
                    <TextInput label="Restaurant Name" required value={restForm.name} onChange={(e) => setRestForm((f) => ({ ...f, name: e.target.value }))} />
                    <TextInput label="Address" required value={restForm.address} onChange={(e) => setRestForm((f) => ({ ...f, address: e.target.value }))} />
                    <TextInput label="Phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} value={restForm.phone} onChange={(e) => setRestForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
                    <Button type="submit" color="dinePrimary" loading={restSaving} leftSection={<IconCheck size={16} />} mt="xs">Save Changes</Button>
                  </Stack>
                </form>
              </Paper>
            </Grid.Col>

            {/* Outlets on the right */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600}>Outlets</Text>
                    <Text size="xs" c="dimmed">Manage outlets, billing address, and UPI IDs</Text>
                  </div>
                  <Button size="xs" variant="light" color="dinePrimary" leftSection={<IconPlus size={12} />} onClick={openCreateOutlet}>
                    Add Outlet
                  </Button>
                </Group>
                {outlets.map((o) => <OutletCard key={o.id} outlet={o} />)}
                {!outlets.length && <Text size="sm" c="dimmed">No outlets yet.</Text>}
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Menu tab */}
        <Tabs.Panel value="menu">
          <MenuManagement embedded />
        </Tabs.Panel>

        {/* Tables tab */}
        <Tabs.Panel value="tables">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              {activeOutlet ? (
                <Badge variant="light" color="dinePrimary" size="md">
                  {activeOutlet.name}
                </Badge>
              ) : <div />}
              <Button color="dinePrimary" leftSection={<IconPlus size={14} />} onClick={openCreateTable} disabled={!tableOutletId}>
                Add Table
              </Button>
            </Group>

            {tablesLoading ? (
              <Loader size="sm" />
            ) : (
              <Grid gap="sm">
                {tables.map((t) => (
                  <Grid.Col key={t.id} span={{ base: 12, sm: 6, md: 4 }}>
                    <Paper p="md" radius="md">
                      <Group justify="space-between">
                        <div>
                          <Group gap="xs">
                            <Text fw={600}>{t.name}</Text>
                            <Badge size="xs" color={t.active ? "green" : "gray"}>
                              {t.active ? "Active" : "Inactive"}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {[t.section, t.capacity ? `${t.capacity} seats` : null].filter(Boolean).join(" · ") || "—"}
                          </Text>
                        </div>
                        <Group gap={4}>
                          <ActionIcon size="sm" variant="light" onClick={() => openEditTable(t)}><IconEdit size={14} /></ActionIcon>
                          <ActionIcon size="sm" variant="light" color={t.active ? "gray" : "green"} onClick={() => handleToggleTable(t)} title={t.active ? "Deactivate" : "Activate"}>
                            {t.active ? "⏸" : "▶"}
                          </ActionIcon>
                          <ActionIcon size="sm" variant="light" color="red" onClick={() => handleDeleteTable(t)}><IconTrash size={14} /></ActionIcon>
                        </Group>
                      </Group>
                    </Paper>
                  </Grid.Col>
                ))}
                {!tables.length && (
                  <Grid.Col span={12}><Text size="sm" c="dimmed" ta="center" py="md">No tables yet for this outlet.</Text></Grid.Col>
                )}
              </Grid>
            )}
          </Stack>
        </Tabs.Panel>

        {/* Store Hours tab */}
        <Tabs.Panel value="hours">
          <StoreHoursManagement />
        </Tabs.Panel>

        {/* Invoice & Tax tab */}
        <Tabs.Panel value="tax">
          <InvoiceTaxManagement />
        </Tabs.Panel>

        {/* Reports tab */}
        <Tabs.Panel value="reports">
          <ReportsManagement embedded />
        </Tabs.Panel>

        {/* Staff tab */}
        {isOwner && (
          <Tabs.Panel value="staff">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={600} size="sm">Team Members</Text>
                  <Text size="xs" c="dimmed">Manage roles and outlet access for each staff member</Text>
                </div>
                <Button size="sm" color="dinePrimary" leftSection={<IconPlus size={14} />} onClick={openInvite}>Invite Staff</Button>
              </Group>
              {staffLoading ? (
                <Loader size="sm" />
              ) : !staff.length ? (
                <Paper p="xl" radius="md" ta="center">
                  <Text size="sm" c="dimmed">
                    No staff yet. Invite a Manager, Waiter, or Kitchen member to get started.
                  </Text>
                  <Button size="xs" variant="light" color="dinePrimary" mt="md" leftSection={<IconPlus size={14} />} onClick={openInvite}>
                    Invite First Staff Member
                  </Button>
                </Paper>
              ) : (
                <Stack gap="sm">
                  {staff.map((m) => (
                    <Paper key={m.id} p="md" radius="md">
                      {/* Row 1 — identity */}
                      <Group justify="space-between" mb="sm" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                          <Group gap="xs" wrap="nowrap">
                            <Text fw={700} size="sm" style={{ fontFamily: "monospace" }}>{m.phone}</Text>
                            <Badge size="xs" variant="light" color={m.inviteStatus === "ACCEPTED" ? "green" : "orange"}>
                              {m.inviteStatus === "ACCEPTED" ? "Active" : "Pending"}
                            </Badge>
                          </Group>
                        </div>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleRemoveStaff(m)}
                          title="Remove staff member"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>

                      {/* Row 2 — role + outlet selectors */}
                      <Grid gap="xs">
                        <Grid.Col span={{ base: 12, xs: 4, sm: 3 }}>
                          <Select
                            size="xs"
                            label="Role"
                            value={m.role}
                            onChange={(v) => v && handleRoleChange(m, v)}
                            data={STAFF_ROLES.map((r) => ({ value: r.value, label: r.value }))}
                            allowDeselect={false}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, xs: 8, sm: 9 }}>
                          <MultiSelect
                            size="xs"
                            label="Outlet Access"
                            placeholder="Select outlet(s)"
                            value={m.outletIds ?? []}
                            onChange={(v) => handleOutletsChange(m, v)}
                            data={outlets.map((o) => ({ value: o.id, label: o.name }))}
                            maxDropdownHeight={200}
                            readOnly={outlets.length <= 1}
                            rightSection={outlets.length <= 1 ? null : undefined}
                          />
                        </Grid.Col>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>
        )}

        {/* Printing tab */}
        <Tabs.Panel value="printing">
          <Paper p="xl" radius="md" maw={{ base: "100%", md: 560 }}>
            <Stack gap="md">
              <Text fw={600}>Bluetooth Printer</Text>
              <Text size="sm" c="dimmed">
                Pair your 58mm thermal printer once. KOT and bills will print automatically via Bluetooth.
                Requires Chrome on Android or desktop.
              </Text>
              <PrinterButton />
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Payment Types & UPI tab */}
        <Tabs.Panel value="payments">
          <Stack gap="md" maw={{ base: "100%", md: 800 }}>
            <Paper p="md" radius="md">
              <Group justify="space-between" mb="xs">
                <div>
                  <Text fw={600} size="lg">Accepted Payment Types</Text>
                  <Text size="xs" c="dimmed">Manage how guests and staff settle orders across counter, tables, and delivery</Text>
                </div>
              </Group>
              <Grid gap="sm">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Paper p="sm" radius="sm" withBorder>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text size="lg">💵</Text>
                        <div>
                          <Text size="sm" fw={600}>Cash Settlement</Text>
                          <Text size="xs" c="dimmed">Direct counter cash payment</Text>
                        </div>
                      </Group>
                      <Badge color="green" variant="light" size="sm">Active</Badge>
                    </Group>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Paper p="sm" radius="sm" withBorder>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text size="lg">📱</Text>
                        <div>
                          <Text size="sm" fw={600}>UPI & Dynamic QR</Text>
                          <Text size="xs" c="dimmed">Auto-generated dynamic QR code</Text>
                        </div>
                      </Group>
                      <Badge color="blue" variant="light" size="sm">Active</Badge>
                    </Group>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Paper p="sm" radius="sm" withBorder>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text size="lg">💳</Text>
                        <div>
                          <Text size="sm" fw={600}>Card & EDC Machine</Text>
                          <Text size="xs" c="dimmed">Credit/Debit POS card swipe</Text>
                        </div>
                      </Group>
                      <Badge color="teal" variant="light" size="sm">Active</Badge>
                    </Group>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Paper p="sm" radius="sm" withBorder>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text size="lg">⚡</Text>
                        <div>
                          <Text size="sm" fw={600}>Customer Self-Order Pay</Text>
                          <Text size="xs" c="dimmed">Guest portal online checkout</Text>
                        </div>
                      </Group>
                      <Badge color="grape" variant="light" size="sm">Active</Badge>
                    </Group>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Paper>

            <Paper p="md" radius="md">
              <Group justify="space-between" mb="xs">
                <div>
                  <Text fw={600} size="lg">Outlet UPI IDs & Dynamic QR</Text>
                  <Text size="xs" c="dimmed">Configure individual UPI VPAs for each outlet to receive instant digital payments</Text>
                </div>
              </Group>

              <Stack gap="sm">
                {outlets.map((outlet) => (
                  <Paper key={outlet.id} p="md" radius="sm" withBorder>
                    <Group justify="space-between" align="center" wrap="wrap">
                      <div>
                        <Group gap="xs">
                          <Text fw={600} size="sm">{outlet.name}</Text>
                          {outlet.isDefault && <Badge size="xs" color="dinePrimary">Default</Badge>}
                        </Group>
                        {outlet.upiId ? (
                          <Text size="xs" fw={700} c="dinePrimary" mt={2}>
                            UPI ID: {outlet.upiId}
                          </Text>
                        ) : (
                          <Text size="xs" c="orange" fw={500} mt={2}>
                            ⚠️ No UPI ID configured — click Configure to enable dynamic QR
                          </Text>
                        )}
                      </div>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="dinePrimary"
                          leftSection={<IconEdit size={14} />}
                          onClick={() => openEditOutlet(outlet)}
                        >
                          {outlet.upiId ? "Edit UPI ID" : "Configure UPI ID"}
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* Dining Options tab */}
        <Tabs.Panel value="dining">
          <DiningOptionsManagement />
        </Tabs.Panel>

        {/* QR Menu tab */}
        <Tabs.Panel value="qr-menu">
          <QrMenuManagement />
        </Tabs.Panel>

        {/* WhatsApp tab */}
        <Tabs.Panel value="whatsapp">
          <WhatsappManagement />
        </Tabs.Panel>

        {/* Reservations tab */}
        <Tabs.Panel value="reservations">
          <ReservationsManagement />
        </Tabs.Panel>

        {/* Riders tab */}
        <Tabs.Panel value="riders">
          <RidersManagement />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={outletModal.open} onClose={() => setOutletModal({ open: false, editing: null })} title={outletModal.editing ? "Edit Outlet" : "Add Outlet"}>
        <Stack gap="md">
          <TextInput label="Name" required value={outletForm.name} onChange={(e) => setOutletForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Address" value={outletForm.address} onChange={(e) => setOutletForm((f) => ({ ...f, address: e.target.value }))} />
          <TextInput label="Phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} value={outletForm.phone} onChange={(e) => setOutletForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
          <TextInput
            label="UPI ID (VPA)"
            placeholder="e.g. restaurant@okaxis or 9876543210@paytm"
            description="Used to display dynamic QR code with amount and order reference when UPI is selected during settlement"
            value={outletForm.upiId}
            onChange={(e) => setOutletForm((f) => ({ ...f, upiId: e.target.value.trim() }))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOutletModal({ open: false, editing: null })}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveOutlet} loading={outletSaving}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={inviteModal} onClose={() => setInviteModal(false)} title="Invite Staff">
        <Stack gap="md">
          <TextInput
            label="Phone Number"
            placeholder="10-digit mobile number"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            required
            value={inviteForm.phone}
            onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
          />
          <Select
            label="Role"
            required
            value={inviteForm.role}
            onChange={(v) => v && setInviteForm((f) => ({ ...f, role: v }))}
            data={STAFF_ROLES}
          />
          <MultiSelect
            label="Outlet Access"
            required
            placeholder="Select outlet(s)"
            value={inviteForm.outletIds}
            onChange={(v) => setInviteForm((f) => ({ ...f, outletIds: v }))}
            data={outlets.map((o) => ({ value: o.id, label: o.name }))}
            readOnly={outlets.length <= 1}
            rightSection={outlets.length <= 1 ? null : undefined}
          />
          <Text size="xs" c="dimmed">
            They'll be notified on WhatsApp with a link to sign in using this number. No password needed — same OTP login as you.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setInviteModal(false)}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveInvite} loading={inviteSaving}>Send Invite</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={tableModal.open} onClose={() => setTableModal({ open: false, editing: null })} title={tableModal.editing ? "Edit Table" : "Add Table"}>
        <Stack gap="md">
          <TextInput
            label="Name"
            required
            placeholder="T1, Window 3, Bar 2..."
            value={tableForm.name}
            error={tableFormError}
            onChange={(e) => {
              setTableForm((f) => ({ ...f, name: e.target.value }));
              if (tableFormError) setTableFormError(null);
            }}
          />
          <TextInput label="Section" placeholder="Ground Floor, Terrace..." value={tableForm.section} onChange={(e) => setTableForm((f) => ({ ...f, section: e.target.value }))} />
          <TextInput label="Capacity" placeholder="4" value={tableForm.capacity} onChange={(e) => setTableForm((f) => ({ ...f, capacity: e.target.value.replace(/\D/g, "") }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setTableModal({ open: false, editing: null })}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveTable} loading={tableSaving}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Table Confirmation Modal */}
      <Modal
        opened={Boolean(tableToDelete)}
        onClose={() => setTableToDelete(null)}
        title="Delete Table Confirmation"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete table <b>"{tableToDelete?.name}"</b>?
            This will remove it from the floor layout.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="sm" onClick={() => setTableToDelete(null)} disabled={deleteTableMut.isPending}>
              Cancel
            </Button>
            <Button
              color="red"
              size="sm"
              loading={deleteTableMut.isPending}
              onClick={handleConfirmDeleteTable}
              leftSection={<IconTrash size={16} />}
            >
              Delete Table
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
