"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Container, Title, Tabs, TextInput, Button, Stack, Group, Text,
  Paper, Badge, ActionIcon, Modal, Loader, Grid, Select, MultiSelect, ScrollArea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore, IconCheck, IconTrash,
  IconEdit, IconPlus, IconStar, IconPrinter, IconUsers, IconTableAlias,
  IconBook, IconChartBar,
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

const STAFF_ROLES = [
  { value: "MANAGER", label: "Manager — full access to assigned outlet(s)" },
  { value: "WAITER", label: "Waiter — take & settle orders" },
  { value: "KITCHEN", label: "Kitchen — view KDS only" },
];

export const VALID_SETTINGS_TABS = [
  "restaurant",
  "menu",
  "tables",
  "reports",
  "staff",
  "printing",
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

  useEffect(() => {
    if (pathname === "/settings" || pathname === "/settings/") {
      router.replace("/settings/restaurant");
    }
  }, [pathname, router]);

  const handleTabChange = (val: string | null) => {
    if (!val) return;
    setActiveTab(val);
    router.push(`/settings/${val}`);
  };

  const [restForm, setRestForm] = useState({ name: "", address: "", phone: "" });
  const [restSaving, setRestSaving] = useState(false);
  const [outletModal, setOutletModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [outletForm, setOutletForm] = useState({ name: "", address: "", phone: "" });
  const [outletSaving, setOutletSaving] = useState(false);

  // Staff — React Query
  const { data: staff = [], isLoading: staffLoading } = useStaff(restaurantId, isOwner);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ phone: "", role: "WAITER", outletIds: [] as string[] });

  // Table — React Query (shared cache with POS page)
  const tableOutletId = activeOutlet?.id ?? (ctxOutlets[0]?.id || null);
  const { data: tables = [], isLoading: tablesLoading } = useTables(restaurantId, tableOutletId);
  const [tableModal, setTableModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [tableForm, setTableForm] = useState({ name: "", section: "", capacity: "" });

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

  const openCreateOutlet = () => { setOutletForm({ name: "", address: "", phone: "" }); setOutletModal({ open: true, editing: null }); };
  const openEditOutlet = (o: any) => { setOutletForm({ name: o.name, address: o.address ?? "", phone: o.phone ?? "" }); setOutletModal({ open: true, editing: o }); };

  const saveOutlet = async () => {
    setOutletSaving(true);
    try {
      if (outletModal.editing) {
        await updateOutletMut.mutateAsync({ id: outletModal.editing.id, body: { name: outletForm.name, address: outletForm.address || null, phone: outletForm.phone || null } });
      } else {
        await createOutletMut.mutateAsync({ name: outletForm.name, address: outletForm.address || undefined, phone: outletForm.phone || undefined });
      }
      await refresh();
      setOutletModal({ open: false, editing: null });
      notifications.show({ title: "Saved", message: "Outlet saved", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally { setOutletSaving(false); }
  };

  const handleDeleteOutlet = async (outlet: any) => {
    if (!confirm(`Delete outlet "${outlet.name}"?`)) return;
    try {
      await deleteOutletMut.mutateAsync(outlet.id);
      await refresh();
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  const handleSetDefault = async (outlet: any) => {
    try {
      await setDefaultMut.mutateAsync(outlet.id);
      await refresh();
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  // ─── Staff handlers ─────────────────────────────────────────────────────

  const openInvite = () => {
    setInviteForm({ phone: "", role: "WAITER", outletIds: outlets[0] ? [outlets[0].id] : [] });
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

  const openCreateTable = () => { setTableForm({ name: "", section: "", capacity: "" }); setTableModal({ open: true, editing: null }); };
  const openEditTable = (t: any) => { setTableForm({ name: t.name, section: t.section ?? "", capacity: t.capacity ? String(t.capacity) : "" }); setTableModal({ open: true, editing: t }); };

  const saveTable = async () => {
    if (!tableOutletId || !tableForm.name.trim()) return;
    try {
      const body = {
        name: tableForm.name,
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

  const handleDeleteTable = async (t: any) => {
    if (!confirm(`Remove table "${t.name}"?`)) return;
    try {
      await deleteTableMut.mutateAsync(t.id);
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  const tableSaving = createTableMut.isPending || updateTableMut.isPending;
  const inviteSaving = inviteStaffMut.isPending;

  const OutletCard = ({ outlet }: { outlet: any }) => (
    <Paper key={outlet.id} withBorder p="md" radius="md">
      <Group justify="space-between">
        <div>
          <Group gap="xs">
            <Text fw={600}>{outlet.name}</Text>
            {outlet.isDefault && <Badge size="xs" color="dinePrimary">Default</Badge>}
          </Group>
          {outlet.address && <Text size="xs" c="dimmed">{outlet.address}</Text>}
          {outlet.phone && <Text size="xs" c="dimmed">{outlet.phone}</Text>}
        </div>
        <Group gap="xs">
          {!outlet.isDefault && (
            <ActionIcon variant="light" color="yellow" size="sm" onClick={() => handleSetDefault(outlet)} title="Set as default">
              <IconStar size={14} />
            </ActionIcon>
          )}
          <ActionIcon variant="light" size="sm" onClick={() => openEditOutlet(outlet)}>
            <IconEdit size={14} />
          </ActionIcon>
          {!outlet.isDefault && (
            <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDeleteOutlet(outlet)}>
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Paper>
  );

  if (!restaurant) return <Loader />;

  return (
    <Container size="xl" pt="sm" pb={100} px={{ base: "sm", sm: "md" }}>
      <Title order={2} mb="md">Settings</Title>
      <Tabs value={activeTab} onChange={handleTabChange}>
        <ScrollArea type="auto" offsetScrollbars={false} scrollbars="x">
          <Tabs.List mb="md" style={{ flexWrap: "nowrap", width: "max-content", minWidth: "100%" }}>
            <Tabs.Tab value="restaurant" leftSection={<IconBuildingStore size={16} />} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Restaurant</Tabs.Tab>
            <Tabs.Tab value="menu" leftSection={<IconBook size={16} />} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Menu</Tabs.Tab>
            <Tabs.Tab value="tables" leftSection={<IconTableAlias size={16} />} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Tables</Tabs.Tab>
            <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Reports</Tabs.Tab>
            {isOwner && <Tabs.Tab value="staff" leftSection={<IconUsers size={16} />} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Staff</Tabs.Tab>}
            <Tabs.Tab value="printing" leftSection={<IconPrinter size={16} />} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Printing</Tabs.Tab>
          </Tabs.List>
        </ScrollArea>

        {/* Restaurant tab */}
        <Tabs.Panel value="restaurant">
          <Grid gap="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper withBorder p="xl" radius="md">
                <form onSubmit={saveRestaurant}>
                  <Stack gap="md">
                    <TextInput label="Restaurant Name" required value={restForm.name} onChange={(e) => setRestForm((f) => ({ ...f, name: e.target.value }))} />
                    <TextInput label="Address" required value={restForm.address} onChange={(e) => setRestForm((f) => ({ ...f, address: e.target.value }))} />
                    <TextInput label="Phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} value={restForm.phone} onChange={(e) => setRestForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
                    <Button type="submit" color="dinePrimary" loading={restSaving} leftSection={<IconCheck size={16} />}>Save Changes</Button>
                  </Stack>
                </form>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Text fw={600}>Outlets</Text>
                  <Button size="xs" variant="light" color="dinePrimary" leftSection={<IconPlus size={12} />} onClick={openCreateOutlet}>Add</Button>
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
                    <Paper withBorder p="md" radius="md">
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

        {/* Reports tab */}
        <Tabs.Panel value="reports">
          <ReportsManagement embedded />
        </Tabs.Panel>

        {/* Staff tab */}
        {isOwner && (
          <Tabs.Panel value="staff">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600}>Team Members</Text>
                <Button size="sm" color="dinePrimary" leftSection={<IconPlus size={14} />} onClick={openInvite}>Invite Staff</Button>
              </Group>
              {staffLoading ? (
                <Loader size="sm" />
              ) : !staff.length ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  No staff yet — the restaurant works fully with just you as owner. Invite a Manager, Waiter or Kitchen member any time.
                </Text>
              ) : (
                <Stack gap="xs">
                  {staff.map((m) => (
                    <Paper key={m.id} withBorder p="md" radius="md">
                      <Group justify="space-between" wrap="wrap" gap="sm">
                        <div>
                          <Group gap="xs">
                            <Text fw={600}>{m.phone}</Text>
                            <Badge size="xs" color={m.inviteStatus === "ACCEPTED" ? "green" : "orange"}>
                              {m.inviteStatus === "ACCEPTED" ? "Active" : "Pending"}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {(m.outletIds ?? []).map((id: string) => outlets.find((o) => o.id === id)?.name ?? id).join(", ") || "No outlets assigned"}
                          </Text>
                        </div>
                        <Group gap="xs" wrap="wrap">
                          <Select
                            size="xs"
                            w={110}
                            value={m.role}
                            onChange={(v) => v && handleRoleChange(m, v)}
                            data={STAFF_ROLES.map((r) => ({ value: r.value, label: r.value }))}
                          />
                          <MultiSelect
                            size="xs"
                            w={200}
                            placeholder="Outlets"
                            value={m.outletIds ?? []}
                            onChange={(v) => handleOutletsChange(m, v)}
                            data={outlets.map((o) => ({ value: o.id, label: o.name }))}
                          />
                          <ActionIcon variant="light" color="red" size="sm" onClick={() => handleRemoveStaff(m)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>
        )}

        {/* Printing tab */}
        <Tabs.Panel value="printing">
          <Paper withBorder p="xl" radius="md" maw={{ base: "100%", md: 560 }}>
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
      </Tabs>

      <Modal opened={outletModal.open} onClose={() => setOutletModal({ open: false, editing: null })} title={outletModal.editing ? "Edit Outlet" : "Add Outlet"}>
        <Stack gap="md">
          <TextInput label="Name" required value={outletForm.name} onChange={(e) => setOutletForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Address" value={outletForm.address} onChange={(e) => setOutletForm((f) => ({ ...f, address: e.target.value }))} />
          <TextInput label="Phone" type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} value={outletForm.phone} onChange={(e) => setOutletForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
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
          <TextInput label="Name" required placeholder="T1, Window 3, Bar 2..." value={tableForm.name} onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Section" placeholder="Ground Floor, Terrace..." value={tableForm.section} onChange={(e) => setTableForm((f) => ({ ...f, section: e.target.value }))} />
          <TextInput label="Capacity" placeholder="4" value={tableForm.capacity} onChange={(e) => setTableForm((f) => ({ ...f, capacity: e.target.value.replace(/\D/g, "") }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setTableModal({ open: false, editing: null })}>Cancel</Button>
            <Button color="dinePrimary" onClick={saveTable} loading={tableSaving}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
