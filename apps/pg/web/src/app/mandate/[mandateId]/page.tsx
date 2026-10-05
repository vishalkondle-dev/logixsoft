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
  ThemeIcon,
  Divider,
  Alert,
} from '@mantine/core';
import { QRCode } from '@gfazioli/mantine-qr-code';
import {
  IconCheck,
  IconX,
  IconRepeat,
  IconLock,
  IconShieldCheck,
  IconSparkles,
} from '@tabler/icons-react';
import { pgApi } from '@/lib/api';
import { useCheckoutStore } from '@/stores';

function MandateContent({ mandateId }: { mandateId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  const mandate = useCheckoutStore((s) => s.mandate);
  const setMandate = useCheckoutStore((s) => s.setMandate);
  const loading = useCheckoutStore((s) => s.loading);
  const setLoading = useCheckoutStore((s) => s.setLoading);
  const simulating = useCheckoutStore((s) => s.simulating);
  const setSimulating = useCheckoutStore((s) => s.setSimulating);
  const activeSuccess = useCheckoutStore((s) => s.activeSuccess);
  const setActiveSuccess = useCheckoutStore((s) => s.setActiveSuccess);

  useEffect(() => {
    let interval: any = null;

    async function checkStatus() {
      try {
        const data = await pgApi.getMandateStatus(mandateId);
        setMandate(data);

        if (data.status === 'ACTIVE') {
          setActiveSuccess(data);
          if (isEmbed && typeof window !== 'undefined' && window.parent) {
            window.parent.postMessage(
              {
                type: 'LOGIXSOFT_MANDATE_SUCCESS',
                data: {
                  mandateId: data.mandateId,
                  umn: data.umn,
                  status: 'ACTIVE',
                  recurringAmount: data.recurringAmount,
                  frequency: data.frequency,
                  nextBillingDate: data.nextBillingDate,
                  metadata: data.metadata,
                },
              },
              '*'
            );
          }
        }
      } catch (err) {
        console.error('Failed to poll mandate status', err);
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
    interval = setInterval(checkStatus, 2500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mandateId, isEmbed]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await pgApi.simulateMandateAuthorize(mandateId, 'owner@okhdfcbank');
      if (res.status === 'ACTIVE') {
        const updated = await pgApi.getMandateStatus(mandateId);
        setMandate(updated);
        setActiveSuccess(updated);
        if (isEmbed && typeof window !== 'undefined' && window.parent) {
          window.parent.postMessage(
            {
              type: 'LOGIXSOFT_MANDATE_SUCCESS',
              data: {
                mandateId: updated.mandateId,
                umn: updated.umn,
                status: 'ACTIVE',
                recurringAmount: updated.recurringAmount,
                frequency: updated.frequency,
                nextBillingDate: updated.nextBillingDate,
                metadata: updated.metadata,
              },
            },
            '*'
          );
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  if (loading && !mandate) {
    return (
      <Center py={100}>
        <Stack align="center" gap="sm">
          <Loader size="lg" color="indigo" />
          <Text size="sm" c="dimmed">Loading UPI AutoPay details...</Text>
        </Stack>
      </Center>
    );
  }

  if (!mandate) {
    return (
      <Center py={100}>
        <Card p="xl" withBorder radius="md" style={{ maxWidth: 400, textAlign: 'center' }}>
          <ThemeIcon size={50} color="red" radius="xl" mx="auto" mb="md">
            <IconX size={28} />
          </ThemeIcon>
          <Title order={4}>Mandate Not Found</Title>
          <Text size="xs" c="dimmed" mt="xs">This recurring subscription mandate does not exist or has expired.</Text>
        </Card>
      </Center>
    );
  }

  const recurringRupees = (mandate.recurringAmount / 100).toLocaleString('en-IN');
  const maxRupees = ((mandate.maxAmount || 1500000) / 100).toLocaleString('en-IN');
  const isCompleted = mandate.status === 'ACTIVE' || activeSuccess;

  return (
    <Container size="xs" py={isEmbed ? 'xs' : 'xl'}>
      <Card withBorder radius="lg" p="lg" shadow="sm" bg="white">
        {/* Header */}
        <Group justify="space-between" align="center" mb="sm">
          <Group gap="xs">
            <ThemeIcon size={34} radius="md" color="indigo" variant="light">
              <IconRepeat size={18} />
            </ThemeIcon>
            <div>
              <Text size="xs" fw={700} tt="uppercase" c="indigo">UPI AutoPay</Text>
              <Text size="sm" fw={600} truncate>{mandate.mandateName}</Text>
            </div>
          </Group>
          <Badge color={isCompleted ? 'teal' : 'blue'} variant="light">
            {isCompleted ? 'Authorized' : 'Awaiting Authorization'}
          </Badge>
        </Group>

        <Divider my="sm" />

        {/* Mandate Plan Breakdown */}
        <Box p="md" bg="gray.0" style={{ borderRadius: 8 }} mb="md">
          <Group justify="space-between" align="baseline">
            <Text size="xs" c="dimmed" fw={500}>Recurring Debit Amount</Text>
            <Title order={3} c="dark">
              ₹{recurringRupees}
              <Text component="span" size="xs" c="dimmed" fw={400}> / month</Text>
            </Title>
          </Group>
          <Group justify="space-between" mt={6}>
            <Text size="xs" c="dimmed">Frequency</Text>
            <Text size="xs" fw={600}>Monthly Recurring</Text>
          </Group>
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">Max Debit Limit (Cap)</Text>
            <Text size="xs" fw={500}>₹{maxRupees}</Text>
          </Group>
        </Box>

        {isCompleted ? (
          /* Success Screen */
          <Stack align="center" gap="sm" py="md">
            <ThemeIcon size={64} radius="xl" color="teal">
              <IconCheck size={36} />
            </ThemeIcon>
            <Title order={3} ta="center">UPI AutoPay Active!</Title>
            <Text size="xs" c="dimmed" ta="center" style={{ maxWidth: 300 }}>
              Recurring debit mandate successfully registered. Your subscription will renew automatically every month.
            </Text>
            {mandate.umn && (
              <Badge size="md" color="gray" variant="outline" mt="xs">
                NPCI UMN: {mandate.umn}
              </Badge>
            )}
            {isEmbed && (
              <Button
                mt="md"
                color="teal"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.parent) {
                    window.parent.postMessage({ type: 'LOGIXSOFT_CHECKOUT_CLOSE' }, '*');
                  }
                }}
              >
                Close &amp; Return to Dashboard
              </Button>
            )}
          </Stack>
        ) : (
          /* Active Payment / Authorization Screen */
          <Stack gap="md">
            {/* Dynamic QR Code */}
            <Center py="xs">
              <Box p="xs" bg="white" style={{ border: '2px solid #e0e7ff', borderRadius: 12 }}>
                <QRCode
                  value={mandate.upiString || `upi://mandate?tr=${mandate.mandateId}`}
                  size={190}
                />
              </Box>
            </Center>

            <Text size="xs" c="dimmed" ta="center">
              Scan this QR code with <strong>Google Pay</strong>, <strong>PhonePe</strong>, <strong>Paytm</strong>, or <strong>BHIM</strong> to authorize UPI AutoPay.
            </Text>

            {/* Mobile Intent Button */}
            <Button
              component="a"
              href={mandate.upiString || '#'}
              color="indigo"
              fullWidth
              size="md"
              radius="md"
              leftSection={<IconRepeat size={18} />}
            >
              Open UPI App to Authorize
            </Button>

            {/* Mock / Sandbox Simulator Button */}
            <Button
              variant="light"
              color="teal"
              fullWidth
              size="sm"
              loading={simulating}
              leftSection={<IconSparkles size={16} />}
              onClick={handleSimulate}
            >
              Simulate UPI AutoPay Success (Mock MPIN)
            </Button>

            <Alert icon={<IconShieldCheck size={16} />} color="blue" variant="light" p="xs">
              <Text size="xs">
                Under RBI e-mandate rules, you will receive an official notification 24 hours before each debit, and you can cancel anytime from your UPI app.
              </Text>
            </Alert>
          </Stack>
        )}

        {/* Footer */}
        <Divider my="md" />
        <Group justify="center" gap="xs">
          <IconLock size={12} color="gray" />
          <Text size="xs" c="dimmed">
            Secured by Logixsoft Payment Gateway &amp; NPCI UPI AutoPay
          </Text>
        </Group>
      </Card>
    </Container>
  );
}

export default function MandateCheckoutPage({ params }: { params: Promise<{ mandateId: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<Center py={80}><Loader color="indigo" /></Center>}>
      <MandateContent mandateId={resolvedParams.mandateId} />
    </Suspense>
  );
}
