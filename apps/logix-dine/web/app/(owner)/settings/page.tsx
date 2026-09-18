"use client";

import React, { useState, useEffect } from "react";
import {
  Container, Title, Tabs, TextInput, Button, Stack, Group, Text,
  Paper, Badge, ActionIcon, Modal, Loader, Grid, Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore, IconCheck, IconTrash,
  IconEdit, IconPlus, IconStar, IconPrinter,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  updateRestaurant, getOutlets, createOutlet, updateOutlet, deleteOutlet, setDefaultOutlet,
} from "@/lib/api-client";
import { PrinterButton } from "@/components/print/printer-button";

export default function SettingsPage() {
  const { restaurant, outlets: ctxOutlets, refresh } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";

  const [restForm, setRestForm] = useState({ name: "", address: "", phone: "" });
  const [restSaving, setRestSaving] = useState(false);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletModal, setOutletModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [outletForm, setOutletForm] = useState({ name: "", address: "", phone: "" });
  const [outletSaving, setOutletSaving] = useState(false);

  useEffect(() => {
    if (restaurant) setRestForm({ name: restaurant.name, address: restaurant.address, phone: restaurant.phone ?? "" });
  }, [restaurant]);

  useEffect(() => { setOutlets(ctxOutlets); }, [ctxOutlets]);

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
        await updateOutlet(restaurantId, outletModal.editing.id, { name: outletForm.name, address: outletForm.address || null, phone: outletForm.phone || null });
      } else {
        await createOutlet(restaurantId, { name: outletForm.name, address: outletForm.address || undefined, phone: outletForm.phone || undefined });
      }
      const updated = await getOutlets(restaurantId);
      setOutlets(updated);
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
      await deleteOutlet(restaurantId, outlet.id);
      setOutlets((o) => o.filter((x) => x.id !== outlet.id));
      await refresh();
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

  const handleSetDefault = async (outlet: any) => {
    try {
      await setDefaultOutlet(restaurantId, outlet.id);
      setOutlets(await getOutlets(restaurantId));
      await refresh();
    } catch (err: any) { notifications.show({ title: "Error", message: err.message, color: "red" }); }
  };

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
        <Tabs defaultValue="restaurant">
          <Tabs.List mb="md">
            <Tabs.Tab value="restaurant" leftSection={<IconBuildingStore size={16} />}>Restaurant</Tabs.Tab>
            <Tabs.Tab value="outlets" leftSection={<IconBuildingStore size={16} />}>Outlets</Tabs.Tab>
            <Tabs.Tab value="printing" leftSection={<IconPrinter size={16} />}>Printing</Tabs.Tab>
          </Tabs.List>

          {/* Restaurant tab: form left, outlets right on desktop */}
          <Tabs.Panel value="restaurant">
            <Grid gap="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper withBorder p="xl" radius="md">
                  <form onSubmit={saveRestaurant}>
                    <Stack gap="md">
                      <TextInput label="Restaurant Name" required value={restForm.name} onChange={(e) => setRestForm((f) => ({ ...f, name: e.target.value }))} />
                      <TextInput label="Address" required value={restForm.address} onChange={(e) => setRestForm((f) => ({ ...f, address: e.target.value }))} />
                      <TextInput label="Phone" value={restForm.phone} onChange={(e) => setRestForm((f) => ({ ...f, phone: e.target.value }))} />
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

          <Tabs.Panel value="outlets">
            <Stack gap="md">
              {outlets.map((o) => <OutletCard key={o.id} outlet={o} />)}
              <Button variant="light" color="dinePrimary" leftSection={<IconPlus size={16} />} onClick={openCreateOutlet} w="fit-content">
                Add Outlet
              </Button>
            </Stack>
          </Tabs.Panel>

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
            <TextInput label="Phone" value={outletForm.phone} onChange={(e) => setOutletForm((f) => ({ ...f, phone: e.target.value }))} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOutletModal({ open: false, editing: null })}>Cancel</Button>
              <Button color="dinePrimary" onClick={saveOutlet} loading={outletSaving}>Save</Button>
            </Group>
          </Stack>
        </Modal>
    </Container>
  );
}
