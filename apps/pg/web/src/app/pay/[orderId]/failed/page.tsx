'use client';

import { useEffect, useState, use } from 'react';
import {
  Container,
  Card,
  Text,
  Title,
  Stack,
  Button,
  Loader,
  Center,
  Box,
  ThemeIcon,
  Group,
} from '@mantine/core';
import { IconX, IconRefresh, IconArrowLeft } from '@tabler/icons-react';
import { pgApi } from '@/lib/api';
import Link from 'next/link';
import { LogoIcon } from '@/components/LogoIcon';

export default function PaymentFailedPage({ params }: { params: Promise<{ orderId: string }> }) {
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
        <Loader size="lg" color="red" />
      </Center>
    );
  }

  const reason = order?.failureReason || (order?.status === 'EXPIRED' ? 'QR Code Expired' : 'Payment was declined or timed out.');

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
            <ThemeIcon size={64} radius="xl" color="red">
              <IconX size={36} stroke={2.5} />
            </ThemeIcon>
            <Title order={2} style={{ color: '#b91c1c', fontWeight: 700 }}>
              Payment Unsuccessful
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              {reason}
            </Text>
          </Stack>

          <Stack gap="sm" mt="lg">
            <Button
              component={Link}
              href={`/pay/${orderId}`}
              color="indigo"
              leftSection={<IconRefresh size={16} />}
            >
              Retry Payment
            </Button>
            <Button
              component={Link}
              href="/"
              variant="default"
              leftSection={<IconArrowLeft size={16} />}
            >
              Return Home
            </Button>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}

