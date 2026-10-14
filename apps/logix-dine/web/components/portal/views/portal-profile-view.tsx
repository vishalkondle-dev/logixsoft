"use client";

import React, { useState } from "react";
import {
  Stack,
  Paper,
  Group,
  Text,
  Title,
  Avatar,
  Badge,
  Button,
  SimpleGrid,
  ThemeIcon,
  Switch,
  Divider,
  Box,
  Modal,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import {
  IconUser,
  IconEdit,
  IconPhone,
  IconMail,
  IconMapPin,
  IconPlus,
  IconBrandWhatsapp,
  IconLogout,
  IconShieldLock,
  IconHeadset,
  IconHeart,
  IconToolsKitchen2,
  IconStar,
  IconCheck,
  IconTrash,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type { CustomerPortalData } from "@/lib/api-client";

interface PortalProfileViewProps {
  data?: CustomerPortalData;
  onOpenEditModal: () => void;
  onSignOut: () => void;
}

interface SavedAddress {
  id: string;
  tag: string;
  address: string;
  landmark?: string;
}

export function PortalProfileView({
  data,
  onOpenEditModal,
  onSignOut,
}: PortalProfileViewProps) {
  const customer = data?.customer;

  // Saved Addresses State (user-managed delivery locations)
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [newTag, setNewTag] = useState("Other");
  const [newAddress, setNewAddress] = useState("");
  const [newLandmark, setNewLandmark] = useState("");

  const [whatsappReceipts, setWhatsappReceipts] = useState(true);
  const [chefInvites, setChefInvites] = useState(true);

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.trim()) return;

    setAddresses((prev) => [
      ...prev,
      {
        id: `addr_${Date.now()}`,
        tag: newTag,
        address: newAddress.trim(),
        landmark: newLandmark.trim() || undefined,
      },
    ]);

    notifications.show({
      title: "Address Saved",
      message: "Delivery address added successfully.",
      color: "teal",
      icon: <IconCheck size={16} />,
    });

    setNewAddress("");
    setNewLandmark("");
    setIsAddAddressOpen(false);
  };

  return (
    <Stack gap="lg" pb={40}>
      {/* ─── Profile Summary Card ─── */}
      <Paper p={{ base: "md", sm: "lg" }} radius="xl" withBorder style={{ background: "#fff" }}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Group gap="sm" wrap="nowrap">
            <Avatar size="lg" radius="xl" color="dinePrimary" style={{ border: "2px solid #7950f2" }}>
              {customer?.name ? customer.name.slice(0, 2).toUpperCase() : "G"}
            </Avatar>
            <div>
              <Group gap={8} align="center">
                <Title order={3} style={{ fontSize: "1.2rem", fontWeight: 800 }}>
                  {customer?.name || "Customer"}
                </Title>
              </Group>
              <Text size="xs" c="dimmed" mt={2}>
                {customer?.phone}
              </Text>
              {customer?.email && (
                <Text size="xs" c="dimmed">
                  {customer.email}
                </Text>
              )}
            </div>
          </Group>

          <Button
            size="xs"
            variant="light"
            color="dinePrimary"
            radius="md"
            leftSection={<IconEdit size={14} />}
            onClick={onOpenEditModal}
          >
            Edit Profile
          </Button>
        </Group>
      </Paper>

      {/* ─── Saved Delivery Addresses ─── */}
      <Paper p="md" radius="lg" withBorder style={{ background: "#fff" }}>
        <Group justify="space-between" align="center" mb="sm">
          <div>
            <Text fw={700} size="sm">
              Saved Delivery Addresses
            </Text>
            <Text size="xs" c="dimmed">
              For direct food deliveries and takeaway pickups
            </Text>
          </div>
          <Button
            size="compact-xs"
            variant="light"
            color="dinePrimary"
            radius="xl"
            leftSection={<IconPlus size={12} />}
            onClick={() => setIsAddAddressOpen(true)}
          >
            Add Address
          </Button>
        </Group>

        {addresses.length === 0 ? (
          <Paper p="md" radius="md" withBorder style={{ background: "#fbfbfc", textAlign: "center" }}>
            <Text size="xs" c="dimmed">
              No saved delivery addresses yet. Click &quot;Add Address&quot; to save a location.
            </Text>
          </Paper>
        ) : (
          <Stack gap="xs">
            {addresses.map((addr) => (
              <Paper key={addr.id} p="sm" radius="md" withBorder style={{ background: "#fbfbfc" }}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group gap="xs" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon size="sm" radius="md" color="violet" variant="light" mt={2} style={{ flexShrink: 0 }}>
                      <IconMapPin size={13} />
                    </ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Text size="xs" fw={700}>
                        {addr.tag}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {addr.address}
                      </Text>
                      {addr.landmark && (
                        <Text size="11px" c="violet.7" mt={2}>
                          Landmark: {addr.landmark}
                        </Text>
                      )}
                    </Box>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => {
                      setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
                      notifications.show({
                        title: "Address Removed",
                        message: "Delivery address has been removed.",
                        color: "gray",
                      });
                    }}
                    title="Remove address"
                    style={{ flexShrink: 0 }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* ─── Notification & WhatsApp Settings ─── */}
      <Paper p="md" radius="lg" withBorder style={{ background: "#fff" }}>
        <Text fw={700} size="sm" mb="sm" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Digital Communications
        </Text>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon size="md" radius="md" color="teal" variant="light">
                <IconBrandWhatsapp size={16} />
              </ThemeIcon>
              <div>
                <Text size="xs" fw={600}>WhatsApp Digital Bill Receipts</Text>
                <Text size="11px" c="dimmed">Receive instant tax invoices and settled bill copies</Text>
              </div>
            </Group>
            <Switch
              checked={whatsappReceipts}
              onChange={(e) => setWhatsappReceipts(e.currentTarget.checked)}
              color="teal"
            />
          </Group>

          <Group justify="space-between" align="center">
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon size="md" radius="md" color="violet" variant="light">
                <IconToolsKitchen2 size={16} />
              </ThemeIcon>
              <div>
                <Text size="xs" fw={600}>Chef Specials & Seasonal Previews</Text>
                <Text size="11px" c="dimmed">Invites to seasonal menu tasting events</Text>
              </div>
            </Group>
            <Switch
              checked={chefInvites}
              onChange={(e) => setChefInvites(e.currentTarget.checked)}
              color="violet"
            />
          </Group>
        </Stack>
      </Paper>

      {/* ─── Support & Security ─── */}
      <Paper p="md" radius="lg" withBorder style={{ background: "#fff" }}>
        <Group justify="space-between" align="center" mb="sm">
          <div>
            <Text fw={700} size="sm">
              Session & Security
            </Text>
            <Text size="xs" c="dimmed">
              Signed in via verified WhatsApp phone authentication
            </Text>
          </div>
          <Button
            color="red"
            variant="light"
            size="xs"
            radius="md"
            leftSection={<IconLogout size={14} />}
            onClick={onSignOut}
          >
            Sign Out
          </Button>
        </Group>
      </Paper>

      {/* Add Address Modal */}
      <Modal
        opened={isAddAddressOpen}
        onClose={() => setIsAddAddressOpen(false)}
        title={<Text fw={700}>Add Delivery Address</Text>}
        radius="md"
        centered
      >
        <form onSubmit={handleAddAddress}>
          <Stack gap="md">
            <TextInput
              label="Address Label"
              placeholder="e.g. Home, Office, Studio"
              required
              value={newTag}
              onChange={(e) => setNewTag(e.currentTarget.value)}
            />
            <TextInput
              label="Complete Address"
              placeholder="House/Flat No, Apartment, Street, Area"
              required
              value={newAddress}
              onChange={(e) => setNewAddress(e.currentTarget.value)}
            />
            <TextInput
              label="Nearby Landmark"
              placeholder="e.g. Opposite Metro Pillar 12"
              value={newLandmark}
              onChange={(e) => setNewLandmark(e.currentTarget.value)}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" size="xs" onClick={() => setIsAddAddressOpen(false)}>
                Cancel
              </Button>
              <Button color="dinePrimary" size="xs" type="submit">
                Save Address
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
