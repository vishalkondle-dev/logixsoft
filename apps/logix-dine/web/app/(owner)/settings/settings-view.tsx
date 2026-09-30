"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Box, Title, Tabs, TextInput, Button, Stack, Group, Text, Switch,
  Paper, Badge, ActionIcon, Modal, Loader, Grid, Select, MultiSelect, ScrollArea, ThemeIcon, Center, Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore, IconCheck, IconTrash,
  IconEdit, IconPlus, IconStar, IconPrinter, IconUsers, IconTableAlias,
  IconBook, IconChartBar, IconArrowLeft, IconClock, IconReceiptTax,
  IconCreditCard, IconCoffee, IconQrcode, IconBrandWhatsapp, IconCalendarEvent,
  IconMotorbike, IconPlayerPause, IconPlayerPlay, IconCash, IconDeviceMobile, IconAlertTriangle,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useAuth } from "@/lib/auth-context";
import {
  useStaff, useTables, useRoles,
  useAddStaff, useInviteStaff, useUpdateStaff, useRemoveStaff,
  useCreateTable, useUpdateTable, useToggleTable, useDeleteTable,
  useCreateOutlet, useUpdateOutlet, useDeleteOutlet, useSetDefaultOutlet,
} from "@/lib/queries";
import dynamic from "next/dynamic";
import {
  updateRestaurant,
} from "@/lib/api-client";
import { PrinterButton } from "@/components/print/printer-button";
import { MenuManagement } from "../menu/menu-management";
import { StoreHoursManagement } from "./store-hours-management";
import { RolesManagement } from "./roles-management";

const ReportsManagement = dynamic(
  () => import("../reports/reports-management").then((m) => m.ReportsManagement),
  {
    ssr: false,
    loading: () => (
      <Center py={60}>
        <Loader color="dinePrimary" />
      </Center>
    ),
  }
);
const InventoryManagement = dynamic(
  () => import("./inventory-management").then((m) => m.InventoryManagement),
  {
    ssr: false,
    loading: () => (
      <Center py={60}>
        <Loader color="teal" />
      </Center>
    ),
  }
);
import { InvoiceTaxManagement } from "./invoice-tax-management";
import { DiningOptionsManagement } from "./dining-options-management";
import { QrMenuManagement } from "./qr-menu-management";
import { WhatsappManagement } from "./whatsapp-management";
import { ReservationsManagement } from "./reservations-management";
import { RidersManagement } from "./riders-management";
import { AggregatorsManagement } from "./aggregators-management";
import { FeedbackManagement } from "./feedback-management";
import { BillingManagement } from "./billing-management";

const STAFF_ROLES = [
  { value: "MANAGER", label: "Manager — full access to assigned outlet(s)" },
  { value: "CASHIER", label: "Cashier — POS counter & billing" },
  { value: "CAPTAIN", label: "Captain — Floor orders & calls" },
  { value: "WAITER", label: "Waiter — take & settle orders" },
  { value: "KITCHEN", label: "Kitchen — view KDS only" },
  { value: "RIDER", label: "Rider — delivery orders" },
];

export const VALID_SETTINGS_TABS = [
  "restaurant",
  "menu",
  "inventory",
  "tables",
  "hours",
  "tax",
  "reports",
  "staff",
  "roles",
  "printing",
  "dining",
  "qr-menu",
  "whatsapp",
  "reservations",
  "riders",
  "aggregators",
  "feedback",
  "billing",
] as const;

export type SettingsTab = (typeof VALID_SETTINGS_TABS)[number];

export function SettingsView({ currentTab }: { currentTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { restaurant, outlets: ctxOutlets, activeOutlet, refresh, role, can } = useRestaurant();
  const { user } = useAuth();
  const restaurantId = restaurant?.id ?? "";
  const isOwner = role === "OWNER" || (user as any)?.role === "ADMIN";
  const canViewStaff = isOwner || can("staff:view");
  const canManageRoles = isOwner || can("roles:manage");

  const { data: rolesData } = useRoles(restaurantId, !!restaurantId && (isOwner || canManageRoles));
  const staffRoleOptions = React.useMemo(() => {
    if (rolesData?.roles && rolesData.roles.length > 0) {
      return rolesData.roles
        .filter((r) => r.name !== "OWNER")
        .map((r) => ({
          value: r.name,
          label: `${r.name}${r.description ? ` — ${r.description}` : ""}`,
        }));
    }
    return STAFF_ROLES;
  }, [rolesData]);

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
  const [outletForm, setOutletForm] = useState({
    name: "",
    address: "",
    phone: "",
    upiId: "",
    planTier: "BASIC",
    billingCycle: "MONTHLY",
  });
  const [outletSaving, setOutletSaving] = useState(false);

  // Staff — React Query
  const { data: staff = [], isLoading: staffLoading } = useStaff(restaurantId, isOwner);
  const [staffModal, setStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", phone: "", role: "WAITER", outletIds: [] as string[] });

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
  const addStaffMut = useAddStaff(restaurantId);
  const inviteStaffMut = addStaffMut;
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
    setOutletForm({
      name: "",
      address: "",
      phone: "",
      upiId: "",
      planTier: "PRO",
      billingCycle: "MONTHLY",
    });
    setOutletModal({ open: true, editing: null });
  };

  const openEditOutlet = (o: any) => {
    setOutletForm({
      name: o.name,
      address: o.address ?? "",
      phone: o.phone ?? "",
      upiId: o.upiId ?? "",
      planTier: o.planTier || "PRO",
      billingCycle: o.billingCycle || "MONTHLY",
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
            planTier: outletForm.planTier,
            billingCycle: outletForm.billingCycle,
          },
        });
      } else {
        await createOutletMut.mutateAsync({
          name: outletForm.name.trim(),
          address: outletForm.address?.trim() || undefined,
          phone: outletForm.phone?.trim() || undefined,
          upiId: outletForm.upiId?.trim() || undefined,
          planTier: outletForm.planTier,
          billingCycle: outletForm.billingCycle,
        });
      }
      await refresh();
      setOutletModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Outlet and subscription plan saved", color: "green", icon: <IconCheck size={16} /> });
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

  const openAddStaff = () => {
    const defaultOutletId = activeOutlet?.id || outlets[0]?.id;
    setStaffForm({ name: "", phone: "", role: "WAITER", outletIds: defaultOutletId ? [defaultOutletId] : [] });
    setStaffModal(true);
  };
  const openInvite = openAddStaff;

  const saveStaff = async () => {
    if (!staffForm.name.trim() || !staffForm.phone.trim() || !staffForm.outletIds.length) {
      notifications.show({ title: "Missing info", message: "Name, 10-digit mobile number, and branch are required", color: "orange" });
      return;
    }
    if (staffForm.phone.trim().length !== 10) {
      notifications.show({ title: "Invalid phone", message: "Please enter a valid 10-digit mobile number", color: "orange" });
      return;
    }
    const cleanStaffPhone = staffForm.phone.trim().replace(/\D/g, "").slice(-10);
    if (cleanStaffPhone === "7276718848") {
      notifications.show({
        title: "Forbidden",
        message: "Cannot assign platform superadmin as restaurant staff. Admin must have only the ADMIN role.",
        color: "red",
      });
      return;
    }
    try {
      await addStaffMut.mutateAsync(staffForm);
      setStaffModal(false);
      setStaffForm({ name: "", phone: "", role: "WAITER", outletIds: [] });
      notifications.show({ title: "Staff Added", message: `${staffForm.name} is active and ready to log in`, color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };
  const saveInvite = saveStaff;

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

  const handleStatusToggle = async (member: any) => {
    const newStatus = member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateStaffMut.mutateAsync({ id: member.id, body: { status: newStatus } });
      notifications.show({
        title: newStatus === "ACTIVE" ? "Staff Activated" : "Staff Deactivated",
        message: `${member.name || member.phone} is now ${newStatus.toLowerCase()}`,
        color: newStatus === "ACTIVE" ? "green" : "gray",
      });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleRemoveStaff = async (member: any) => {
    if (!confirm(`Remove ${member.name || member.phone} from staff?`)) return;
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
  const staffSaving = addStaffMut.isPending;
  const inviteSaving = staffSaving;

  const OutletCard = ({ outlet }: { outlet: any }) => (
    <Paper key={outlet.id} p="md" radius="md" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Group gap="xs" wrap="wrap" mb={4}>
            <Text fw={600} truncate>{outlet.name}</Text>
            {outlet.isDefault && <Badge size="xs" color="dinePrimary">Default</Badge>}
            {outlet.planTier && (
              <Badge
                size="xs"
                variant="light"
                color={outlet.planTier === "PRO" ? "indigo" : "blue"}
              >
                {outlet.planTier} Plan
              </Badge>
            )}
            {outlet.status === "EXPIRED" && (
              <Badge size="xs" color="red" variant="filled">
                Expired
              </Badge>
            )}
          </Group>
          {outlet.address && <Text size="xs" c="dimmed" truncate>{outlet.address}</Text>}
          {outlet.phone && <Text size="xs" c="dimmed">{outlet.phone}</Text>}
          {outlet.upiId && <Text size="xs" c="teal" fw={500} truncate>UPI: {outlet.upiId}</Text>}
          <Group gap="xs" mt={8}>
            <Link href={`/settings/billing?outletId=${outlet.id}`} style={{ textDecoration: "none" }}>
              <Text size="xs" c="dinePrimary" fw={600} style={{ cursor: "pointer" }}>
                Manage Subscription &amp; Plan &rarr;
              </Text>
            </Link>
          </Group>
        </div>
        <Group gap="xs" wrap="nowrap">
          <Button
            size="xs"
            variant="light"
            color="dinePrimary"
            leftSection={<IconCreditCard size={13} />}
            onClick={() => router.push(`/settings/billing?outletId=${outlet.id}`)}
          >
            Change Plan
          </Button>
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
    inventory: {
      title: "Inventory & Recipes",
      subtitle: "Track raw materials, recipe cost (BOM), supplier purchases, and stock deductions",
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
    roles: {
      title: "Roles & Permissions Matrix",
      subtitle: "Configure granular sub-feature privileges, team roles, and outlet authorization policies",
    },
    printing: {
      title: "Thermal Printers",
      subtitle: "Configure Bluetooth & network thermal printers for bills & KOTs",
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
    aggregators: {
      title: "Online Delivery Partners & Aggregators",
      subtitle: "Configure credentials, store IDs, prep time, price markups, and webhooks for Swiggy, Zomato, Magicpin & ONDC",
    },
    feedback: {
      title: "Customer Reviews & Ratings",
      subtitle: "Authentic customer feedback, rating metrics, dish ratings & official responses",
    },
    billing: {
      title: "Subscription & Billing",
      subtitle: "Manage SaaS plan tiers, outlet licenses, renewals, and invoice history",
    },
  };

  const currentTabMeta = TAB_TITLES[activeTab] || TAB_TITLES.restaurant;

  return (
    <Box pt="sm" pb={120} px={{ base: "xs", sm: "md" }}>
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

        {/* Inventory tab */}
        <Tabs.Panel value="inventory">
          <InventoryManagement />
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
                            {t.active ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
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
        {(isOwner || canViewStaff) && (
          <Tabs.Panel value="staff">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={600} size="sm">Team Members</Text>
                  <Text size="xs" c="dimmed">Directly add staff, assign roles, and manage branch access</Text>
                </div>
                <Button size="sm" color="dinePrimary" leftSection={<IconPlus size={14} />} onClick={openAddStaff}>Add Staff</Button>
              </Group>
              {staffLoading ? (
                <Loader size="sm" />
              ) : !staff.length ? (
                <Paper p="xl" radius="md" ta="center">
                  <Text size="sm" c="dimmed">
                    No staff members yet. Add a Manager, Waiter, Cashier, or Kitchen member to get started.
                  </Text>
                  <Button size="xs" variant="light" color="dinePrimary" mt="md" leftSection={<IconPlus size={14} />} onClick={openAddStaff}>
                    Add First Staff Member
                  </Button>
                </Paper>
              ) : (
                <Stack gap="sm">
                  {staff.map((m: any) => (
                    <Paper key={m.id} p="md" radius="md">
                      {/* Row 1 — identity & status */}
                      <Group justify="space-between" mb="sm" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                          <Group gap="xs" wrap="nowrap">
                            <Text fw={700} size="sm">{m.name || "Staff Member"}</Text>
                            <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>{m.phone}</Text>
                            <Badge size="xs" variant="light" color={m.status === "ACTIVE" ? "green" : "gray"}>
                              {m.status === "ACTIVE" ? "Active" : "Inactive"}
                            </Badge>
                          </Group>
                        </div>
                        <Group gap="xs">
                          <Switch
                            size="xs"
                            checked={m.status === "ACTIVE"}
                            onChange={() => handleStatusToggle(m)}
                            color="green"
                            title={m.status === "ACTIVE" ? "Click to deactivate" : "Click to activate"}
                          />
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
                      </Group>

                      {/* Row 2 — role + outlet selectors */}
                      <Grid gap="xs">
                        <Grid.Col span={{ base: 12, xs: 4, sm: 3 }}>
                          <Select
                            size="xs"
                            label="Role"
                            value={m.role}
                            onChange={(v) => v && handleRoleChange(m, v)}
                            data={
                              staffRoleOptions.some((opt) => opt.value === m.role)
                                ? staffRoleOptions
                                : [{ value: m.role, label: m.role }, ...staffRoleOptions]
                            }
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

        {/* Roles & Permissions tab */}
        {(isOwner || canManageRoles) && (
          <Tabs.Panel value="roles">
            <RolesManagement embedded />
          </Tabs.Panel>
        )}

        {/* Printing tab */}
        <Tabs.Panel value="printing">
          <Paper p="xl" radius="md" w="100%">
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

        {/* Online Delivery Partners / Aggregators tab */}
        <Tabs.Panel value="aggregators">
          <AggregatorsManagement />
        </Tabs.Panel>

        {/* Feedback tab */}
        <Tabs.Panel value="feedback">
          <FeedbackManagement />
        </Tabs.Panel>

        {/* Subscription & Billing tab */}
        <Tabs.Panel value="billing">
          <BillingManagement />
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
          <Divider label="Branch SaaS Subscription" labelPosition="center" my="xs" />
          <Select
            label="Branch Subscription Plan"
            description="Assign the right plan tier for this specific outlet branch"
            value={outletForm.planTier}
            onChange={(v) => v && setOutletForm((f) => ({ ...f, planTier: v }))}
            data={[
              { value: "BASIC", label: "Starter Plan — ₹999/mo" },
              { value: "PRO", label: "Pro Plan — ₹1,499/mo" },
            ]}
          />
          <Select
            label="Billing Cycle"
            value={outletForm.billingCycle}
            onChange={(v) => v && setOutletForm((f) => ({ ...f, billingCycle: v }))}
            data={[
              { value: "MONTHLY", label: "Monthly Recurring" },
              { value: "ANNUAL", label: "Annual (15% Savings / 2 Months Free)" },
            ]}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOutletModal({ open: false, editing: null })}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveOutlet} loading={outletSaving}>Save Outlet</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={staffModal} onClose={() => setStaffModal(false)} title="Add Staff Member">
        <Stack gap="md">
          <TextInput
            label="Staff Name"
            placeholder="e.g. Ramesh Kumar"
            required
            value={staffForm.name}
            onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Mobile Number"
            placeholder="10-digit mobile number"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            required
            value={staffForm.phone}
            onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
          />
          <Select
            label="Role"
            required
            value={staffForm.role}
            onChange={(v) => v && setStaffForm((f) => ({ ...f, role: v }))}
            data={staffRoleOptions}
          />
          <MultiSelect
            label="Branch / Outlet Access"
            required
            placeholder="Select branch(es)"
            value={staffForm.outletIds}
            onChange={(v) => setStaffForm((f) => ({ ...f, outletIds: v }))}
            data={outlets.map((o) => ({ value: o.id, label: o.name }))}
            readOnly={outlets.length <= 1}
            rightSection={outlets.length <= 1 ? null : undefined}
          />
          <Text size="xs" c="dimmed">
            Staff are added directly and active immediately. They can sign in using this mobile number via WhatsApp OTP to access their role screen.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setStaffModal(false)}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveStaff} loading={staffSaving}>Add Staff Member</Button>
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
