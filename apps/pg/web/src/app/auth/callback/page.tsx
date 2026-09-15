'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader, Stack, Text } from '@mantine/core';
import { useAuth } from '@/lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { checkAuth } = useAuth();

  useEffect(() => {
    async function verify() {
      try {
        await checkAuth(true);
        router.replace('/dashboard');
      } catch (err) {
        console.error('Failed to verify session', err);
        router.replace('/login');
      }
    }
    verify();
  }, [checkAuth, router]);

  return (
    <Center style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Stack align="center" gap="md">
        <Loader size="lg" color="indigo" />
        <Text c="dimmed" size="sm">
          Signing you in...
        </Text>
      </Stack>
    </Center>
  );
}

