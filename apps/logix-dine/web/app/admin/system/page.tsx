"use client";

import React, { useState, Suspense } from "react";
import {
  Stack,
  Group,
  Text,
  Card,
  SimpleGrid,
  Badge,
  Button,
  Select,
  Textarea,
  Modal,
  Alert,
  Center,
  Loader,
  ScrollArea,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconDatabase,
  IconAlertCircle,
  IconCheck,
  IconPlayerPlay,
  IconTrash,
} from "@tabler/icons-react";
import { useAdmin } from "../admin-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function SystemContent() {
  const { restaurants, fetchGlobalMetadata } = useAdmin();

  const [purgeModalOpened, setPurgeModalOpened] = useState(false);
  const [purgeTargetRestId, setPurgeTargetRestId] = useState("");
  const [purging, setPurging] = useState(false);

  // SQL Runner State
  const [sqlQuery, setSqlQuery] = useState('SELECT id, name, "phoneNumber", role FROM "user" LIMIT 5;');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlRunning, setSqlRunning] = useState(false);

  const handlePurgeOrders = async () => {
    setPurging(true);
    try {
      const res = await fetch(`${API_BASE}/admin/purge-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ restaurantId: purgeTargetRestId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Purge failed");
      notifications.show({ title: "Purge Complete", message: data.message, color: "teal" });
      setPurgeModalOpened(false);
      fetchGlobalMetadata();
    } catch (err: any) {
      notifications.show({ title: "Purge Failed", message: err.message, color: "red" });
    } finally {
      setPurging(false);
    }
  };

  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setSqlRunning(true);
    setSqlResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/execute-sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sql: sqlQuery }),
      });
      const data = await res.json();
      setSqlResult(data);
      if (!res.ok) {
        notifications.show({ title: "Query Error", message: data.message || "SQL Error", color: "red" });
      } else {
        notifications.show({ title: "Query Executed", message: "SQL executed successfully.", color: "teal" });
      }
    } catch (err: any) {
      setSqlResult({ error: err.message });
      notifications.show({ title: "Network Error", message: err.message, color: "red" });
    } finally {
      setSqlRunning(false);
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Text fw={800} size="xl">
          Operations, DB & SQL Runner
        </Text>
        <Text size="sm" c="dimmed">
          Superadmin system diagnostic tools, platform-wide order purge utilities, and live database query runner.
        </Text>
      </div>

      {/* System Infrastructure Telemetry */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder padding="md" radius="md">
          <Text fw={700} size="sm" mb="xs">
            Infrastructure Status
          </Text>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs">Cloudflare Worker Gateway</Text>
              <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
                Normal (Edge)
              </Badge>
            </Group>
            <Group justify="space-between">
              <Text size="xs">Hyperdrive Pooled PostgreSQL Node</Text>
              <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
                Connected
              </Badge>
            </Group>
            <Group justify="space-between">
              <Text size="xs">Real-Time Kitchen WebSocket Relay</Text>
              <Badge size="xs" color="green" leftSection={<IconCheck size={10} />}>
                Listening
              </Badge>
            </Group>
            <Group justify="space-between">
              <Text size="xs">Edge Caching Layer</Text>
              <Badge size="xs" color="teal">
                Active
              </Badge>
            </Group>
          </Stack>
        </Card>

        {/* Order Purge Tool */}
        <Card withBorder padding="md" radius="md">
          <Text fw={700} size="sm" mb="xs" c="red">
            Order Purge Tool
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            Wipe staging or test orders across the entire platform or for a specific restaurant store.
          </Text>
          <Group justify="flex-start">
            <Button
              color="red"
              variant="light"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={() => setPurgeModalOpened(true)}
            >
              Configure & Purge Orders
            </Button>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Superadmin SQL Runner */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={700} size="md">
              Live SQL Query Runner
            </Text>
            <Text size="xs" c="dimmed">
              Direct Superadmin SQL execution with raw query result rendering.
            </Text>
          </div>
          <Button
            color="dinePrimary"
            size="xs"
            leftSection={<IconPlayerPlay size={14} />}
            loading={sqlRunning}
            onClick={handleExecuteSql}
          >
            Execute SQL
          </Button>
        </Group>

        <Textarea
          value={sqlQuery}
          onChange={(e) => setSqlQuery(e.target.value)}
          minRows={3}
          autosize
          styles={{ input: { fontFamily: "monospace", fontSize: 13 } }}
        />

        {sqlResult && (
          <Box mt="md">
            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={700}>
                Query Results:
              </Text>
              {sqlResult.durationMs !== undefined && (
                <Badge size="xs" variant="light" color="teal">
                  {sqlResult.durationMs}ms
                </Badge>
              )}
            </Group>
            <ScrollArea.Autosize mah={350}>
              <Box
                component="pre"
                p="sm"
                style={{
                  background: "#1a1b1e",
                  color: "#a5d8ff",
                  borderRadius: 6,
                  fontSize: 12,
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(sqlResult.result || sqlResult.data || sqlResult.rows || sqlResult, null, 2)}
              </Box>
            </ScrollArea.Autosize>
          </Box>
        )}
      </Card>

      {/* Modal: Order Purge */}
      <Modal
        opened={purgeModalOpened}
        onClose={() => setPurgeModalOpened(false)}
        title={
          <Text fw={700} c="red">
            Purge Orders Confirmation
          </Text>
        }
      >
        <Stack gap="sm">
          <Text size="sm">Select target store or wipe platform-wide:</Text>
          <Select
            label="Target Scope"
            value={purgeTargetRestId}
            onChange={(v) => setPurgeTargetRestId(v || "")}
            data={[
              { value: "", label: "ALL Restaurants (Platform-wide Purge)" },
              ...restaurants.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            This action permanently deletes orders, items, and audit trails.
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setPurgeModalOpened(false)}>
              Cancel
            </Button>
            <Button color="red" loading={purging} onClick={handlePurgeOrders}>
              Confirm Purge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function SystemPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <SystemContent />
    </Suspense>
  );
}
