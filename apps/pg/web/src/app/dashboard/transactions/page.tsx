'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Group,
  TextInput,
  Select,
  Table,
  Badge,
  Button,
  Modal,
  Stack,
  Divider,
  ActionIcon,
  Tooltip,
  Center,
  Loader,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSearch, IconEye, IconRefresh, IconDownload, IconArrowLeft } from '@tabler/icons-react';
import { pgApi } from '@/lib/api';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('ALL');
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await pgApi.getTransactions(statusFilter || undefined);
      setTransactions(data.transactions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter]);

  const filtered = transactions.filter((tx) => {
    const s = search.toLowerCase();
    return (
      tx.orderId.toLowerCase().includes(s) ||
      (tx.customerName && tx.customerName.toLowerCase().includes(s)) ||
      (tx.bankReferenceNo && tx.bankReferenceNo.toLowerCase().includes(s))
    );
  });

  const handleRowClick = (tx: any) => {
    setSelectedTx(tx);
    openModal();
  };

  return (
    <Container size="xl" py="sm">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} fw={700}>
            Transactions
          </Title>
          <Text c="dimmed" size="sm">
            Search, filter, and inspect detailed payment events and bank UTRs.
          </Text>
        </div>

        <Group gap="xs">
          <Tooltip label="Refresh">
            <ActionIcon variant="default" size="lg" onClick={fetchTransactions}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
        {/* Filters bar */}
        <Group justify="space-between" mb="md">
          <Group gap="sm" style={{ flex: 1 }}>
            <TextInput
              placeholder="Search by Order ID, Customer, or UTR..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 280 }}
            />
            <Select
              data={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'SUCCESS', label: 'Success' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'FAILED', label: 'Failed' },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              style={{ width: 160 }}
            />
          </Group>
          <Text size="xs" c="dimmed">
            Showing {filtered.length} of {transactions.length} records
          </Text>
        </Group>

        {loading ? (
          <Center py="xl">
            <Loader color="indigo" size="md" />
          </Center>
        ) : filtered.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed" size="sm">
              No transactions match your search criteria.
            </Text>
          </Center>
        ) : (
          <Table verticalSpacing="md" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order ID</Table.Th>
                <Table.Th>Amount (₹)</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Provider</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Bank UTR</Table.Th>
                <Table.Th>Date & Time</Table.Th>
                <Table.Th>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((tx) => (
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
                  <Table.Td>
                    <Badge variant="outline" size="xs">
                      {tx.provider}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{tx.customerName || 'Walk-in'}</Text>
                  </Table.Td>
                  <Table.Td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {tx.bankReferenceNo || '—'}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(tx.createdAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="indigo" onClick={() => handleRowClick(tx)}>
                      <IconEye size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={<Text fw={700}>Transaction #{selectedTx?.orderId}</Text>}
        size="lg"
      >
        {selectedTx && (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Amount</Text>
              <Title order={3}>₹{(selectedTx.amount / 100).toFixed(2)}</Title>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Status</Text>
              <Badge
                color={
                  selectedTx.status === 'SUCCESS'
                    ? 'teal'
                    : selectedTx.status === 'FAILED'
                    ? 'red'
                    : 'yellow'
                }
              >
                {selectedTx.status}
              </Badge>
            </Group>

            <Divider />

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Bank Reference / UTR</Text>
              <Text size="sm" fw={600} style={{ fontFamily: 'monospace' }}>
                {selectedTx.bankReferenceNo || 'Pending receipt from bank'}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Provider Transaction ID</Text>
              <Text size="sm" style={{ fontFamily: 'monospace' }}>
                {selectedTx.providerReferenceId || '—'}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Provider Rail</Text>
              <Text size="sm" fw={500}>{selectedTx.provider}</Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Created At</Text>
              <Text size="sm">{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</Text>
            </Group>

            {selectedTx.paidAt && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Paid At</Text>
                <Text size="sm">{new Date(selectedTx.paidAt).toLocaleString('en-IN')}</Text>
              </Group>
            )}

            <Divider />

            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              UPI Intent Deep Link
            </Text>
            <Text size="xs" style={{ fontFamily: 'monospace', wordBreak: 'break-all', backgroundColor: '#f1f5f9', padding: 8, borderRadius: 6 }}>
              {selectedTx.upiString || 'None'}
            </Text>

            <Button
              component="a"
              href={`/pay/${selectedTx.orderId}`}
              target="_blank"
              variant="light"
              color="indigo"
              fullWidth
              mt="sm"
            >
              Open Customer Checkout View
            </Button>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
