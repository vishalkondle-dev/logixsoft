'use client';

import { useEffect, useState, use } from 'react';
import {
  Container,
  Card,
  Text,
  Title,
  Stack,
  Group,
  Badge,
  Button,
  Loader,
  Center,
  Box,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { IconCheck, IconPrinter, IconArrowLeft } from '@tabler/icons-react';
import { pgApi } from '@/lib/api';
import Link from 'next/link';
import { LogoIcon } from '@/components/LogoIcon';

export default function PaymentSuccessPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await pgApi.getOrderStatus(orderId);
        setOrder(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId]);

  if (loading) {
    return (
      <Center style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
        <Loader size="lg" color="teal" />
      </Center>
    );
  }

  const amountRupees = order?.amount ? (order.amount / 100).toFixed(2) : '0.00';
  const utr = order?.bankReferenceNo || `UTR${Date.now()}`;
  const paidTime = order?.paidAt ? new Date(order.paidAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

  return (
    <Box bg="#f8fafc" style={{ minHeight: '100vh', padding: '40px 16px' }}>
      <Container size={440}>
        <Center mb="md">
          <Group gap="xs">
            <LogoIcon size={24} />
            <Text fw={700} size="sm" c="dimmed">
              Logixsoft UPI Gateway
            </Text>
          </Group>
        </Center>
        <Card shadow="md" padding="xl" radius="lg" withBorder bg="#fff">
          <Stack align="center" gap="sm" mb="md">
            <ThemeIcon size={64} radius="xl" color="teal">
              <IconCheck size={36} stroke={2.5} />
            </ThemeIcon>
            <Title order={2} style={{ color: '#0f766e', fontWeight: 700 }}>
              Payment Successful!
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Your transaction has been securely processed and settled via UPI.
            </Text>
          </Stack>

          <Center my="sm">
            <Title order={1} style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>
              ₹{amountRupees}
            </Title>
          </Center>

          <Divider my="md" />

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Order ID</Text>
              <Text size="sm" fw={600} style={{ fontFamily: 'monospace' }}>{orderId}</Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Bank UTR / Ref No.</Text>
              <Text size="sm" fw={600} style={{ fontFamily: 'monospace' }}>{utr}</Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Provider</Text>
              <Badge color="indigo" variant="light" size="sm">
                {order?.provider || 'UPI'}
              </Badge>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Paid On</Text>
              <Text size="sm" fw={500}>{paidTime}</Text>
            </Group>
          </Stack>

          <Divider my="md" />

          <Group gap="sm" grow>
            <Button
              variant="default"
              leftSection={<IconPrinter size={16} />}
              onClick={() => window.print()}
            >
              Print Receipt
            </Button>
            <Button
              component={Link}
              href="/"
              color="indigo"
              leftSection={<IconArrowLeft size={16} />}
            >
              Done
            </Button>
          </Group>
        </Card>
      </Container>
    </Box>
  );
}

