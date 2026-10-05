'use client';

import { useEffect, useState, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Progress,
  ActionIcon,
  ThemeIcon,
  Avatar,
} from '@mantine/core';
import { QRCode } from '@gfazioli/mantine-qr-code';
import {
  IconClock,
  IconCheck,
  IconX,
  IconBolt,
  IconLock,
} from '@tabler/icons-react';
import { pgApi } from '@/lib/api';
import { useCheckoutStore } from '@/stores';

function CheckoutContent({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  const order = useCheckoutStore((s) => s.order);
  const setOrder = useCheckoutStore((s) => s.setOrder);
  const loading = useCheckoutStore((s) => s.loading);
  const setLoading = useCheckoutStore((s) => s.setLoading);
  const simulating = useCheckoutStore((s) => s.simulating);
  const setSimulating = useCheckoutStore((s) => s.setSimulating);
  const timeLeftSeconds = useCheckoutStore((s) => s.timeLeftSeconds);
  const setTimeLeftSeconds = useCheckoutStore((s) => s.setTimeLeftSeconds);
  const paymentSuccess = useCheckoutStore((s) => s.paymentSuccess);
  const setPaymentSuccess = useCheckoutStore((s) => s.setPaymentSuccess);

  // Initial fetch and auto-polling
  useEffect(() => {
    let interval: any = null;

    async function checkStatus() {
      try {
        const data = await pgApi.getOrderStatus(orderId);
        setOrder(data);

        if (data.status === 'SUCCESS') {
          if (isEmbed) {
            setPaymentSuccess(data);
            if (typeof window !== 'undefined' && window.parent) {
              window.parent.postMessage(
                {
                  type: 'LOGIXSOFT_PAYMENT_SUCCESS',
                  data: {
                    orderId: data.orderId,
                    amount: data.amount,
                    bankReferenceNo: data.bankReferenceNo || `UTR${Date.now()}`,
                    status: 'SUCCESS',
                    paidAt: data.paidAt || new Date().toISOString(),
                  },
                },
                '*'
              );
            }
          } else {
            router.replace(`/pay/${orderId}/success`);
          }
          return;
        }

        if (data.status === 'FAILED' || data.status === 'EXPIRED') {
          if (isEmbed) {
            if (typeof window !== 'undefined' && window.parent) {
              window.parent.postMessage(
                {
                  type: 'LOGIXSOFT_PAYMENT_FAILED',
                  data: {
                    orderId: data.orderId,
                    status: data.status,
                    reason: data.failureReason || 'Payment failed or timed out',
                  },
                },
                '*'
              );
            }
          } else {
            router.replace(`/pay/${orderId}/failed`);
          }
          return;
        }

        // Calculate remaining seconds if expiresAt exists
        if (data.expiresAt) {
          const diff = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
          setTimeLeftSeconds(diff);
        }
      } catch (err) {
        console.error('Status check error:', err);
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
    interval = setInterval(checkStatus, 2500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [orderId, router, isEmbed]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeftSeconds <= 0) return;
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeftSeconds]);

  const handleCloseModal = () => {
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({ type: 'LOGIXSOFT_MODAL_CLOSE' }, '*');
    }
  };

  const handleMockAction = async (action: 'SUCCESS' | 'FAILED') => {
    setSimulating(true);
    try {
      await pgApi.simulateMockPayment(orderId, action);
      if (action === 'SUCCESS') {
        if (isEmbed) {
          setPaymentSuccess({
            ...order,
            status: 'SUCCESS',
            bankReferenceNo: `UTR${Date.now()}`,
            paidAt: new Date().toISOString(),
          });
          if (typeof window !== 'undefined' && window.parent) {
            window.parent.postMessage(
              {
                type: 'LOGIXSOFT_PAYMENT_SUCCESS',
                data: {
                  orderId,
                  amount: order?.amount || 0,
                  bankReferenceNo: `UTR${Date.now()}`,
                  status: 'SUCCESS',
                  paidAt: new Date().toISOString(),
                },
              },
              '*'
            );
          }
        } else {
          router.replace(`/pay/${orderId}/success`);
        }
      } else {
        if (isEmbed) {
          if (typeof window !== 'undefined' && window.parent) {
            window.parent.postMessage(
              {
                type: 'LOGIXSOFT_PAYMENT_FAILED',
                data: {
                  orderId,
                  status: 'FAILED',
                  reason: 'Simulation failed by user',
                },
              },
              '*'
            );
          }
        } else {
          router.replace(`/pay/${orderId}/failed`);
        }
      }
    } catch (err) {
      alert('Simulation failed');
      setSimulating(false);
    }
  };

  if (loading && !order) {
    return (
      <Center style={{ minHeight: isEmbed ? '400px' : '100vh', backgroundColor: isEmbed ? '#fff' : '#f8fafc' }}>
        <Stack align="center" gap="sm">
          <Loader color="indigo" size="md" />
          <Text size="xs" c="dimmed">Connecting securely...</Text>
        </Stack>
      </Center>
    );
  }

  if (!order) {
    return (
      <Center style={{ minHeight: isEmbed ? '300px' : '100vh', backgroundColor: '#fff' }}>
        <Stack align="center" gap="xs">
          <Text c="red.6" size="sm" fw={600}>Order not found or expired.</Text>
          {isEmbed && (
            <Button size="xs" variant="light" color="gray" onClick={handleCloseModal}>
              Close
            </Button>
          )}
        </Stack>
      </Center>
    );
  }

  // Embedded Success Screen
  if (paymentSuccess) {
    const successAmount = (paymentSuccess.amount / 100).toFixed(2);
    return (
      <Box p="xl" bg="#fff" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Stack align="center" gap="md" py={30}>
          <ThemeIcon size={64} radius="xl" color="teal">
            <IconCheck size={36} stroke={3} />
          </ThemeIcon>
          <Title order={3} c="teal.8" ta="center" fw={700}>
            Payment Successful!
          </Title>
          <Title order={1} style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a' }}>
            ₹{successAmount}
          </Title>
          <Text size="xs" c="dimmed" ta="center">
            Ref: <span style={{ fontFamily: 'monospace' }}>{paymentSuccess.bankReferenceNo || `UTR${Date.now()}`}</span>
          </Text>
          <Badge color="teal" variant="light" size="md">
            Settled via UPI
          </Badge>
          <Text size="xs" c="dimmed" mt="xs">
            Redirecting to merchant store...
          </Text>
        </Stack>
      </Box>
    );
  }

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  const progressPercent = Math.min(100, Math.max(0, (timeLeftSeconds / 600) * 100));

  const amountRupees = (order.amount / 100).toFixed(2);
  const upiString = order.upiString || '';

  return (
    <Box
      bg={isEmbed ? '#ffffff' : '#f8fafc'}
      style={{
        minHeight: isEmbed ? '100%' : '100vh',
        padding: isEmbed ? '14px 18px 12px' : '36px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isEmbed ? 'flex-start' : 'center',
        alignItems: 'center',
      }}
    >
      <Container size={isEmbed ? 380 : 420} p={0} style={{ width: '100%' }}>
        <Card
          shadow={isEmbed ? 'none' : 'md'}
          padding={isEmbed ? 0 : 'xl'}
          radius={isEmbed ? 0 : '22px'}
          withBorder={!isEmbed}
          bg={isEmbed ? 'transparent' : '#ffffff'}
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header Branding & Close Button */}
          <Group justify="space-between" align="center" pb="xs" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <Group gap="xs">
              <Avatar
                size={32}
                radius="md"
                color="indigo"
                variant="light"
                styles={{ placeholder: { fontWeight: 700, fontSize: 13 } }}
              >
                {order.merchantName ? order.merchantName.charAt(0).toUpperCase() : 'M'}
              </Avatar>
              <Stack gap={0}>
                <Group gap={4} align="center">
                  <Text fw={700} size="sm" c="#0f172a" lineClamp={1}>
                    {order.merchantName || 'Logixsoft Merchant'}
                  </Text>
                  <ThemeIcon size={14} radius="xl" color="teal" variant="light">
                    <IconCheck size={9} stroke={3} />
                  </ThemeIcon>
                </Group>
                <Text size="10px" c="dimmed" fw={500}>
                  Verified Business
                </Text>
              </Stack>
            </Group>

            {isEmbed && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="xl"
                onClick={handleCloseModal}
                title="Close checkout"
              >
                <IconX size={16} />
              </ActionIcon>
            )}
          </Group>

          {/* Amount Display */}
          <Stack align="center" gap={2} pt="xs" pb="xs">
            <Text size="10px" c="dimmed" tt="uppercase" fw={600} lts={0.8}>
              Amount Payable
            </Text>
            <Title order={1} style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              ₹{amountRupees}
            </Title>
            <Text size="11px" c="dimmed" lineClamp={1}>
              {order.description || `Order #${order.orderId}`}
            </Text>
          </Stack>

          {/* QR Code Container with Centered Logo & Smooth Dots */}
          <Stack align="center" gap={6} my={2}>
            <Box
              p={10}
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QRCode
                value={upiString}
                size={isEmbed ? 180 : 205}
                color="#0f172a"
                dotStyle="rounded"
                cornerStyle="rounded"
                image="/icon-192.png"
                imageSize={0.22}
                imageRadius={6}
                imagePadding={1}
                imageExcavate={true}
                errorCorrectionLevel="H"
              />
            </Box>

            {/* Supported UPI Apps Pills */}
            <Stack align="center" gap={3} mt={2}>
              <Text size="11px" fw={600} c="dimmed">
                Scan with any UPI app
              </Text>
              <Group gap={4} justify="center">
                {['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'CRED'].map((app) => (
                  <Badge
                    key={app}
                    size="xs"
                    variant="light"
                    color="gray"
                    radius="sm"
                    styles={{ root: { fontSize: '10px', height: 18, textTransform: 'none', color: '#64748b' } }}
                  >
                    {app}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </Stack>

          {/* Expiry Countdown Timer */}
          <Box my="xs" px="xs">
            <Group justify="space-between" mb={3}>
              <Group gap={4}>
                <IconClock size={12} color={timeLeftSeconds < 60 ? '#ef4444' : '#64748b'} />
                <Text size="11px" c={timeLeftSeconds < 60 ? 'red.6' : 'dimmed'} fw={500}>
                  QR Expires in
                </Text>
              </Group>
              <Text size="11px" fw={700} c={timeLeftSeconds < 60 ? 'red' : 'indigo.7'}>
                {formattedTime}
              </Text>
            </Group>
            <Progress
              value={progressPercent}
              color={timeLeftSeconds < 60 ? 'red' : 'indigo'}
              size={3}
              radius="xl"
            />
          </Box>

          {/* Primary Filled Pay Button */}
          <Stack gap={6} mt={2}>
            <Button
              component="a"
              href={upiString}
              variant="filled"
              color="indigo"
              fullWidth
              size="md"
              radius="md"
              style={{
                fontWeight: 600,
                height: 44,
                fontSize: '15px',
                boxShadow: '0 4px 14px -1px rgba(79, 70, 229, 0.35)',
              }}
              leftSection={<IconBolt size={18} fill="currentColor" />}
            >
              Pay ₹{amountRupees}
            </Button>
          </Stack>

          {/* Real-time Listening & Security Trust Footer */}
          <Stack gap={3} align="center" mt="xs" pb={2}>
            <Group justify="center" gap={6}>
              <Box
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
                }}
              />
              <Text size="11px" c="dimmed" fw={500}>
                Waiting for payment confirmation
              </Text>
            </Group>

            <Group justify="center" gap={4}>
              <IconLock size={11} color="#94a3b8" />
              <Text size="10px" c="dimmed" fw={400}>
                Secured by Logixsoft Payments
              </Text>
            </Group>
          </Stack>

          {/* Compact Mock Sandbox Bar */}
          {order.isMock && (
            <Box
              mt="xs"
              pt={6}
              style={{ borderTop: '1px dashed #e2e8f0' }}
            >
              <Group justify="space-between" align="center">
                <Badge size="xs" color="orange" variant="light" radius="xs">
                  🧪 Test Sandbox
                </Badge>
                <Group gap={4}>
                  <Button
                    size="compact-xs"
                    color="teal"
                    variant="light"
                    leftSection={<IconCheck size={10} stroke={3} />}
                    onClick={() => handleMockAction('SUCCESS')}
                    loading={simulating}
                  >
                    Simulate Success
                  </Button>
                  <Button
                    size="compact-xs"
                    color="red"
                    variant="subtle"
                    leftSection={<IconX size={10} stroke={3} />}
                    onClick={() => handleMockAction('FAILED')}
                    loading={simulating}
                  >
                    Fail
                  </Button>
                </Group>
              </Group>
            </Box>
          )}
        </Card>
      </Container>
    </Box>
  );
}

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  return (
    <Suspense
      fallback={
        <Center style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
          <Loader color="indigo" size="md" />
        </Center>
      }
    >
      <CheckoutContent orderId={orderId} />
    </Suspense>
  );
}
