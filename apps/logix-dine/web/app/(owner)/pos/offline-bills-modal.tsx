"use client";

import React, { useState } from "react";
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Paper,
  Table,
  ThemeIcon,
  Alert,
  Loader,
  ScrollArea,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconWifiOff,
  IconRefresh,
  IconCheck,
  IconAlertCircle,
  IconPrinter,
  IconTrash,
  IconClock,
  IconReceipt2,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  getQueuedOfflineOrders,
  removeOfflineOrder,
  clearSyncedOfflineOrders,
  syncOfflineOrders,
  type QueuedOfflineOrder,
} from "@/lib/offline-pos";
import { buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";

interface OfflineBillsModalProps {
  opened: boolean;
  onClose: () => void;
  orders: QueuedOfflineOrder[];
  onRefresh: () => void;
  restaurantId: string;
  outletId: string;
  restaurant: any;
  isOnline: boolean;
}

export function OfflineBillsModal({
  opened,
  onClose,
  orders,
  onRefresh,
  restaurantId,
  outletId,
  restaurant,
  isOnline,
}: OfflineBillsModalProps) {
  const [syncing, setSyncing] = useState(false);

  const pendingOrders = orders.filter((o) => !o.synced);
  const totalPendingPaise = pendingOrders.reduce((s, o) => s + (o.totalPaise || 0), 0);

  const handleSyncAll = async () => {
    if (!isOnline) {
      notifications.show({
        title: "Still Offline",
        message: "Please ensure your device is connected to the internet before syncing.",
        color: "orange",
        icon: <IconWifiOff size={16} />,
      });
      return;
    }

    setSyncing(true);
    try {
      const res = await syncOfflineOrders(restaurantId, outletId);
      onRefresh();

      if (res.synced > 0) {
        notifications.show({
          title: "Cloud Sync Complete! ☁️",
          message: `${res.synced} offline order(s) successfully synchronized to the server.`,
          color: "teal",
          icon: <IconCheck size={16} />,
        });
      }
      if (res.failed > 0) {
        notifications.show({
          title: "Some Orders Failed Sync",
          message: `${res.failed} order(s) could not be synced. Check order details below.`,
          color: "red",
          icon: <IconAlertCircle size={16} />,
        });
      }
    } catch (err: any) {
      notifications.show({
        title: "Sync Failed",
        message: err.message || "An error occurred during synchronization",
        color: "red",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleReprintOrder = (o: QueuedOfflineOrder) => {
    try {
      const mockResult = {
        order: {
          id: o.id,
          orderNo: o.offlineOrderNo,
          tableNo: o.tableNo,
          subtotalPaise: o.subtotalPaise,
          paidPaise: o.totalPaise,
          method: o.method,
          orderType: o.orderType,
          createdAt: o.createdAt,
          status: "PAID",
          isOffline: true,
        },
        items: o.items.map((i) => ({
          id: `${o.id}_${i.itemId}`,
          nameSnapshot: i.name,
          pricePaiseSnapshot: i.pricePaise,
          qty: i.qty,
          variant: i.variant,
          addons: i.addons,
          note: i.note,
        })),
        delivery: o.delivery,
      };

      printTicket(buildBillPayload(mockResult, restaurant)).then(() => {
        notifications.show({
          title: "Reprinted Offline Bill",
          message: `Bill #${o.offlineOrderNo} sent to thermal printer.`,
          color: "teal",
          icon: <IconPrinter size={16} />,
        });
      });
    } catch (err: any) {
      notifications.show({
        title: "Print Failed",
        message: err.message || "Could not print bill",
        color: "red",
      });
    }
  };

  const handleDelete = (id: string) => {
    removeOfflineOrder(id);
    onRefresh();
    notifications.show({
      title: "Removed Order",
      message: "Order deleted from local offline queue.",
      color: "gray",
    });
  };

  const handleClearSynced = () => {
    clearSyncedOfflineOrders(outletId);
    onRefresh();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size="md" color="yellow" variant="light" radius="md">
            <IconWifiOff size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="md">
              Offline Billing Queue
            </Text>
            <Text size="xs" c="dimmed">
              Orders created and settled without internet connection
            </Text>
          </div>
        </Group>
      }
      size="xl"
      radius="md"
    >
      <Stack gap="md">
        {/* Status Banner */}
        <Paper withBorder p="sm" radius="md" bg={isOnline ? "teal.0" : "yellow.0"}>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <ThemeIcon size="sm" color={isOnline ? "teal" : "yellow"} variant="filled" radius="xl">
                {isOnline ? <IconCheck size={12} /> : <IconWifiOff size={12} />}
              </ThemeIcon>
              <div>
                <Text size="xs" fw={700} c={isOnline ? "teal.9" : "yellow.9"}>
                  {isOnline ? "Device is Online" : "Zero Internet Mode Active"}
                </Text>
                <Text size="11px" c="dimmed">
                  {pendingOrders.length} order(s) pending sync · Total: ₹{((totalPendingPaise || 0) / 100).toLocaleString("en-IN")}
                </Text>
              </div>
            </Group>

            <Group gap="xs">
              <Button
                size="xs"
                color="teal"
                leftSection={syncing ? <Loader size={12} color="white" /> : <IconRefresh size={14} />}
                onClick={handleSyncAll}
                disabled={syncing || pendingOrders.length === 0 || !isOnline}
              >
                Sync Now ({pendingOrders.length})
              </Button>
            </Group>
          </Group>
        </Paper>

        {orders.length === 0 ? (
          <Paper p="xl" withBorder radius="md" style={{ textAlign: "center" }}>
            <ThemeIcon size={48} radius="xl" color="gray" variant="light" mb="xs">
              <IconCheck size={24} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              All Orders are Synchronized!
            </Text>
            <Text size="xs" c="dimmed">
              No pending offline orders in queue.
            </Text>
          </Paper>
        ) : (
          <ScrollArea.Autosize mah={400}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ticket No</Table.Th>
                  <Table.Th>Type / Table</Table.Th>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th>Mode</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: "center" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orders.map((o) => {
                  const timeStr = new Date(o.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <Table.Tr key={o.id}>
                      <Table.Td>
                        <Text size="xs" fw={700}>
                          #{o.offlineOrderNo}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {o.orderType} · {o.tableNo}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {timeStr}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {o.items.reduce((s, i) => s + i.qty, 0)} items
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="outline" color={o.method === "Cash" ? "green" : "blue"}>
                          {o.method}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <Text size="xs" fw={700}>
                          ₹{((o.totalPaise || 0) / 100).toLocaleString("en-IN")}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {o.synced ? (
                          <Badge size="xs" color="teal" variant="light">
                            Synced ✓
                          </Badge>
                        ) : o.syncError ? (
                          <Tooltip label={o.syncError}>
                            <Badge size="xs" color="red" variant="light">
                              Error ⚠️
                            </Badge>
                          </Tooltip>
                        ) : (
                          <Badge size="xs" color="yellow" variant="light">
                            Pending ⏳
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center">
                          <Tooltip label="Reprint thermal bill">
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="blue"
                              onClick={() => handleReprintOrder(o)}
                            >
                              <IconPrinter size={14} />
                            </ActionIcon>
                          </Tooltip>
                          {!o.synced && (
                            <Tooltip label="Delete from queue">
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="red"
                                onClick={() => handleDelete(o.id)}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        )}

        <Group justify="space-between" align="center" pt="xs">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={handleClearSynced}
          >
            Clear Synced History
          </Button>

          <Button size="xs" variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
