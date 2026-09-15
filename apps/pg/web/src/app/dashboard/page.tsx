'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  SimpleGrid,
  Card,
  Text,
  Title,
  Group,
  ThemeIcon,
  Badge,
  Table,
  Button,
  Loader,
  Center,
  Stack,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconCurrencyRupee,
  IconCheck,
  IconClock,
  IconArrowUpRight,
  IconQrcode,
  IconRefresh,
} from '@tabler/icons-react';
import { pgApi } from '@/lib/api';
import Link from 'next/link';

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, txData] = await Promise.all([
        pgApi.getStats().catch(() => null),
        pgApi.getTransactions().catch(() => ({ transactions: [] })),
      ]);
      setStats(statsData);
      setTransactions(txData.transactions?.slice(0, 5) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !stats) {
    return (
      <Center style={{ minHeight: '60vh' }}>
        <Loader size="lg" color="indigo" />
      </Center>
    );
  }

  const totalRupees = stats ? (stats.totalRevenuePaise / 100).toFixed(2) : '0.00';
  const todayRupees = stats ? (stats.todayRevenuePaise / 100).toFixed(2) : '0.00';
  const successRate = stats ? stats.successRatePercentage : 100;
  const totalOrders = stats ? stats.totalOrdersCount : 0;
  const activeProvider = stats?.activeProvider || 'MOCK';

  return (
    <Container size="xl" py="sm">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} fw={700}>
            Merchant Dashboard
          </Title>
          <Text c="dimmed" size="sm">
            Live metrics and transaction health across your UPI gateways.
          </Text>
        </div>

        <Group gap="xs">
          <Tooltip label="Refresh Data">
            <ActionIcon variant="default" size="lg" onClick={loadData}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            component={Link}
            href="/dashboard/payment-links"
            leftSection={<IconQrcode size={18} />}
            color="indigo"
          >
            Create Quick Payment Link
          </Button>
        </Group>
      </Group>

      {/* Metric Cards Grid */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="lg">
        <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Total Volume
            </Text>
            <ThemeIcon color="indigo" variant="light" size="md">
              <IconCurrencyRupee size={18} />
            </ThemeIcon>
          </Group>
          <Title order={3} fw={800} mt="sm">
            ₹{totalRupees}
          </Title>
          <Text size="xs" c="dimmed" mt={4}>
            All-time processed settlements
          </Text>
        </Card>

        <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Today's Collections
            </Text>
            <ThemeIcon color="teal" variant="light" size="md">
              <IconArrowUpRight size={18} />
            </ThemeIcon>
          </Group>
          <Title order={3} fw={800} mt="sm">
            ₹{todayRupees}
          </Title>
          <Text size="xs" c="teal" mt={4}>
            {stats?.successOrdersCount || 0} completed orders
          </Text>
        </Card>

        <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Success Rate
            </Text>
            <ThemeIcon color="blue" variant="light" size="md">
              <IconCheck size={18} />
            </ThemeIcon>
          </Group>
          <Title order={3} fw={800} mt="sm">
            {successRate}%
          </Title>
          <Text size="xs" c="dimmed" mt={4}>
            Total {totalOrders} transactions
          </Text>
        </Card>

        <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Active Provider
            </Text>
            <ThemeIcon color="orange" variant="light" size="md">
              <IconQrcode size={18} />
            </ThemeIcon>
          </Group>
          <Group gap="xs" mt="sm">
            <Badge
              color={activeProvider === 'MOCK' ? 'orange' : 'teal'}
              size="lg"
              variant="filled"
            >
              {activeProvider}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            Configured via Gateway Settings
          </Text>
        </Card>
      </SimpleGrid>

      {/* Recent Transactions Section */}
      <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={4} fw={700}>
              Recent Transactions
            </Title>
            <Text size="xs" c="dimmed">
              Latest payment events recorded across webhooks & QR checks
            </Text>
          </div>
          <Button component={Link} href="/dashboard/transactions" variant="subtle" size="xs">
            View All
          </Button>
        </Group>

        {transactions.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconClock size={32} color="#94a3b8" />
              <Text size="sm" c="dimmed">
                No transactions yet. Create your first payment link to test!
              </Text>
            </Stack>
          </Center>
        ) : (
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order ID</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Provider</Table.Th>
                <Table.Th>UTR / Ref</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transactions.map((tx) => (
                <Table.Tr key={tx.id}>
                  <Table.Td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {tx.orderId}
                  </Table.Td>
                  <Table.Td fw={700}>₹{(tx.amount / 100).toFixed(2)}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        tx.status === 'SUCCESS'
                          ? 'teal'
                          : tx.status === 'FAILED'
                          ? 'red'
                          : 'yellow'
                      }
                      size="sm"
                    >
                      {tx.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{tx.provider}</Table.Td>
                  <Table.Td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {tx.bankReferenceNo || '—'}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Container>
  );
}
