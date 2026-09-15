'use client';

import { Container, Title, Text, Button, Group, Card, SimpleGrid, ThemeIcon, Badge, Stack, Box } from '@mantine/core';
import { IconQrcode, IconBuildingBank, IconBolt, IconShieldCheck, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { pgApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { LogoIcon } from '@/components/LogoIcon';

export default function LandingPage() {
  const [loadingDemo, setLoadingDemo] = useState(false);
  const router = useRouter();

  const handleTryDemo = async () => {
    setLoadingDemo(true);
    try {
      const order = await pgApi.createOrder({
        amountInRupees: 299,
        description: 'Logixsoft UPI Gateway Demo Order',
        customerName: 'Demo Customer',
      });
      router.push(`/pay/${order.orderId}`);
    } catch (err) {
      console.error(err);
      alert('Could not create demo order. Make sure pg-api is running.');
      setLoadingDemo(false);
    }
  };

  return (
    <Box bg="#f8fafc" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box component="header" py="md" px="xl" style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <Container size="lg">
          <Group justify="space-between">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Group gap="xs">
                <LogoIcon size={34} />
                <Text fw={800} size="lg" c="indigo.9">
                  Logixsoft UPI
                </Text>
                <Badge variant="light" color="indigo" size="sm">Gateway</Badge>
              </Group>
            </Link>

            <Group gap="sm">
              <Button component={Link} href="/developers" variant="subtle" color="gray" size="sm">
                Developers
              </Button>
              <Button component={Link} href="/login" variant="default" size="sm">
                Merchant Login
              </Button>
              <Button onClick={handleTryDemo} loading={loadingDemo} color="indigo" size="sm">
                Try Demo Checkout
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container size="lg" py={80} style={{ flex: 1 }}>
        <Stack align="center" gap="lg" style={{ textAlign: 'center' }}>
          <Badge size="lg" variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }}>
            Production-Ready Payment Gateway
          </Badge>

          <Title order={1} style={{ fontSize: '2.75rem', fontWeight: 800, maxWidth: 750, lineHeight: 1.2 }}>
            Accept UPI Payments Directly with Paytm
          </Title>

          <Text c="dimmed" size="lg" style={{ maxWidth: 600 }}>
            Automated dynamic UPI QR generation, instant server-to-server webhook verification, and
            seamless reconciliation directly into your merchant bank account.
          </Text>

          <Group mt="md" gap="md">
            <Button
              size="lg"
              color="indigo"
              rightSection={<IconArrowRight size={18} />}
              onClick={handleTryDemo}
              loading={loadingDemo}
            >
              Test Dynamic QR Checkout (₹299)
            </Button>
            <Button component={Link} href="/login" size="lg" variant="outline" color="indigo">
              Access Merchant Dashboard
            </Button>
          </Group>
        </Stack>

        {/* Feature Grid */}
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt={80}>
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <ThemeIcon color="indigo" size={48} radius="md" mb="md">
              <IconQrcode size={26} />
            </ThemeIcon>
            <Text fw={600} size="lg" mb="xs">
              Dynamic Amount QR Codes
            </Text>
            <Text size="sm" c="dimmed">
              Unique scannable QR generated for each order with the exact amount pre-configured.
              Zero customer tampering and 0% payment mismatch.
            </Text>
          </Card>

          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <ThemeIcon color="teal" size={48} radius="md" mb="md">
              <IconBolt size={26} />
            </ThemeIcon>
            <Text fw={600} size="lg" mb="xs">
              Instant Webhook Confirmation
            </Text>
            <Text size="sm" c="dimmed">
              Paytm S2S webhooks automatically notify your backend the instant money debits,
              triggering live order transitions on client screens.
            </Text>
          </Card>

          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <ThemeIcon color="blue" size={48} radius="md" mb="md">
              <IconBuildingBank size={26} />
            </ThemeIcon>
            <Text fw={600} size="lg" mb="xs">
              Direct Bank Settlement
            </Text>
            <Text size="sm" c="dimmed">
              No intermediary escrow withholding your funds. Direct settlement to your verified
              merchant current account via NPCI UPI rails.
            </Text>
          </Card>
        </SimpleGrid>
      </Container>

      {/* Footer */}
      <Box component="footer" py="xl" style={{ borderTop: '1px solid #e2e8f0', background: '#fff' }}>
        <Container size="lg">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              © {new Date().getFullYear()} Logixsoft UPI Payment Gateway Integration.
            </Text>
            <Group gap="lg">
              <Text component={Link} href="/login" size="sm" c="dimmed">
                Merchant Sign In
              </Text>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}

