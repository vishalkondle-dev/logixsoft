"use client";

import React, { useState } from "react";
import {
  Modal,
  Text,
  Title,
  Button,
  Group,
  Stack,
  SimpleGrid,
  Paper,
  TextInput,
  ThemeIcon,
  Badge,
} from "@mantine/core";
import {
  IconDroplet,
  IconToolsKitchen2,
  IconReceipt,
  IconSparkles,
  IconMessage,
  IconBellRinging,
  IconCheck,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useCallWaiter } from "@/lib/queries";
import type { CustomerPortalOrder } from "@/lib/api-client";

interface CallWaiterModalProps {
  opened: boolean;
  onClose: () => void;
  order: CustomerPortalOrder | null;
  onSuccess?: (serviceLabel: string) => void;
}

type ServiceType = "WATER" | "CUTLERY" | "BILL" | "CLEAN_TABLE" | "OTHER";

const SERVICE_OPTIONS: Array<{
  type: ServiceType;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    type: "WATER",
    label: "Water Refill",
    sublabel: "Glass refill or water bottle",
    icon: <IconDroplet size={24} />,
    color: "blue",
  },
  {
    type: "CUTLERY",
    label: "Cutlery & Napkins",
    sublabel: "Forks, spoons, extra plates",
    icon: <IconToolsKitchen2 size={24} />,
    color: "teal",
  },
  {
    type: "BILL",
    label: "Request Bill",
    sublabel: "Bring check & card/UPI device",
    icon: <IconReceipt size={24} />,
    color: "grape",
  },
  {
    type: "CLEAN_TABLE",
    label: "Clean Table",
    sublabel: "Clear plates or wipe table",
    icon: <IconSparkles size={24} />,
    color: "orange",
  },
  {
    type: "OTHER",
    label: "Other Assistance",
    sublabel: "General staff help / inquiry",
    icon: <IconMessage size={24} />,
    color: "gray",
  },
];

export function CallWaiterModal({ opened, onClose, order, onSuccess }: CallWaiterModalProps) {
  const [selectedType, setSelectedType] = useState<ServiceType>("WATER");
  const [customNote, setCustomNote] = useState("");
  const callWaiterMutation = useCallWaiter();

  if (!order) return null;

  const handleSubmit = async () => {
    try {
      const res = await callWaiterMutation.mutateAsync({
        orderId: order.id,
        body: {
          serviceType: selectedType,
          note: customNote.trim() || undefined,
        },
      });

      notifications.show({
        title: "🛎️ Staff Notified!",
        message: `${res.serviceLabel} requested for Table ${order.tableNo}. Someone is on their way!`,
        color: "teal",
        icon: <IconCheck size={18} />,
        autoClose: 6000,
      });

      if (onSuccess) {
        onSuccess(res.serviceLabel);
      }
      setCustomNote("");
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Request Failed",
        message: err.message || "Failed to notify staff. Please try again.",
        color: "red",
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size={32} radius="md" color="yellow" variant="light">
            <IconBellRinging size={18} />
          </ThemeIcon>
          <div>
            <Title order={4} style={{ fontSize: 16, fontWeight: 700 }}>
              Call Waiter & Assistance
            </Title>
            <Text size="xs" c="dimmed">
              Table: {order.tableNo} • Token #{order.tokenNo || order.orderNo || "—"}
            </Text>
          </div>
        </Group>
      }
      centered
      radius="md"
      padding="md"
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Choose the service you need. Our floor staff will receive an instant chime on their screens.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {SERVICE_OPTIONS.map((opt) => {
            const isSelected = selectedType === opt.type;
            return (
              <Paper
                key={opt.type}
                p="sm"
                radius="md"
                withBorder
                onClick={() => setSelectedType(opt.type)}
                style={{
                  cursor: "pointer",
                  border: isSelected ? "2px solid #af73d7" : "1px solid #dee2e6",
                  backgroundColor: isSelected ? "rgba(175, 115, 215, 0.06)" : "#fff",
                  transition: "all 0.15s ease",
                }}
              >
                <Group wrap="nowrap" align="center" gap="sm">
                  <ThemeIcon
                    size={38}
                    radius="md"
                    color={opt.color}
                    variant={isSelected ? "filled" : "light"}
                  >
                    {opt.icon}
                  </ThemeIcon>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" align="center">
                      <Text fw={600} size="sm">
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Badge size="xs" color="violet" variant="filled">
                          Selected
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {opt.sublabel}
                    </Text>
                  </div>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>

        <TextInput
          label="Optional message or note for waiter"
          placeholder="e.g. 2 glasses of warm water, extra tissues"
          value={customNote}
          onChange={(e) => setCustomNote(e.currentTarget.value)}
          maxLength={150}
          size="sm"
        />

        <Group justify="flex-end" gap="xs" mt="xs">
          <Button variant="default" size="sm" onClick={onClose} disabled={callWaiterMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="orange"
            size="sm"
            leftSection={<IconBellRinging size={16} />}
            loading={callWaiterMutation.isPending}
            onClick={handleSubmit}
          >
            Ring Staff
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
