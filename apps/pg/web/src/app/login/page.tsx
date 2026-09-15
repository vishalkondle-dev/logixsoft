'use client';

import { Container, Card, Title, Text, Stack, ThemeIcon, Box, Center, Anchor, Group, Button, Divider } from '@mantine/core';
import { IconLock, IconQrcode, IconShieldCheck } from '@tabler/icons-react';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogoIcon } from '@/components/LogoIcon';

export default function LoginPage() {
  const { isAuthenticated, demoLogin, checkAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    checkAuth().then(() => {
      if (isAuthenticated) {
        router.replace('/dashboard');
      }
    });
  }, [checkAuth, isAuthenticated, router]);

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        padding: '20px',
      }}
    >
      <Container size={420} style={{ width: '100%' }}>
        <Center mb="lg">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Group gap="sm">
              <LogoIcon size={42} />
              <Text fw={800} size="xl" c="indigo.9">
                Logixsoft PG
              </Text>
            </Group>
          </Link>
        </Center>

        <Card shadow="md" padding="xl" radius="lg" withBorder bg="#fff">
          <Stack align="center" gap="xs" mb="lg">
            <ThemeIcon size={42} radius="xl" color="indigo" variant="light">
              <IconLock size={20} />
            </ThemeIcon>
            <Title order={2} size="h3" fw={700}>
              Merchant Portal
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Sign in to manage your Paytm credentials, view transactions, and generate payment links.
            </Text>
          </Stack>

          <Stack gap="md" mt="sm">
            {/* Google Authentication */}
            <GoogleLoginButton label="Continue with Google" callbackPath="/dashboard" />

            <Divider label="or" labelPosition="center" my={4} />

            {/* Instant Merchant Access */}
            <Button
              variant="light"
              color="indigo"
              size="md"
              radius="md"
              fullWidth
              leftSection={<IconShieldCheck size={18} />}
              onClick={() => demoLogin('/dashboard')}
            >
              1-Click Merchant Access
            </Button>

            <Text size="xs" c="dimmed" ta="center" mt="xs">
              Authenticate via Google or use 1-Click Access to enter the merchant console.
            </Text>
          </Stack>
        </Card>

        <Center mt="md">
          <Anchor component={Link} href="/" size="sm" c="dimmed">
            ← Back to Home
          </Anchor>
        </Center>
      </Container>
    </Box>
  );
}
