'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  SimpleGrid,
  Card,
  Title,
  Text,
  NumberInput,
  TextInput,
  Button,
  Stack,
  Group,
  Badge,
  Center,
  Box,
  CopyButton,
  ActionIcon,
  Tooltip,
  Alert,
  Loader,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { QRCode } from '@gfazioli/mantine-qr-code';
import {
  IconQrcode,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconSparkles,
  IconCircleCheckFilled,
  IconRefresh,
  IconVolume,
} from '@tabler/icons-react';
import { pgApi } from '@/lib/api';

function playSuccessChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
}

export default function PaymentLinksPage() {
  const [amount, setAmount] = useState<number | string>(500);
  const [description, setDescription] = useState('Counter Payment');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [orderStatus, setOrderStatus] = useState<string>('PENDING');
  const [verifiedDetails, setVerifiedDetails] = useState<any>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1) {
      alert('Please enter a valid amount (minimum ₹1)');
      return;
    }

    setLoading(true);
    setOrderStatus('PENDING');
    setVerifiedDetails(null);
    try {
      const res = await pgApi.createOrder({
        amountInRupees: numAmount,
        description: description || 'Counter Payment',
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      });
      setCreatedOrder(res);
    } catch (err: any) {
      alert(err.message || 'Failed to generate payment link');
    } finally {
      setLoading(false);
    }
  };

  const [confirming, setConfirming] = useState(false);

  // Poll for counter status updates once created
  useEffect(() => {
    if (!createdOrder?.orderId || orderStatus === 'SUCCESS') return;

    const interval = setInterval(async () => {
      try {
        const data = await pgApi.getOrderStatus(createdOrder.orderId);
        if (data.status === 'SUCCESS') {
          setOrderStatus('SUCCESS');
          setVerifiedDetails(data);
          playSuccessChime();
        }
      } catch {
        // ignore polling error
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [createdOrder, orderStatus]);

  const handleConfirmReceived = async () => {
    if (!createdOrder?.orderId) return;
    setConfirming(true);
    try {
      const res = await pgApi.confirmPayment(createdOrder.orderId);
      setOrderStatus('SUCCESS');
      setVerifiedDetails(res);
      playSuccessChime();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm payment');
    } finally {
      setConfirming(false);
    }
  };

  const handleResetForNext = () => {
    setCreatedOrder(null);
    setOrderStatus('PENDING');
    setVerifiedDetails(null);
  };

  const checkoutUrl = createdOrder
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${createdOrder.orderId}`
    : '';

  return (
    <Container size="xl" py="sm">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} fw={700}>
            Counter QR & Payment Links
          </Title>
          <Text c="dimmed" size="sm">
            Generate an on-the-spot dynamic UPI QR for counter checkout or share a payment link.
          </Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        {/* Creation Form */}
        <Box>
          <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
            <Title order={4} mb="md">
              Create Payment Request
            </Title>

            <form onSubmit={handleGenerate}>
              <Stack gap="md">
                <NumberInput
                  label="Amount (₹)"
                  placeholder="e.g. 500"
                  prefix="₹ "
                  decimalScale={2}
                  min={1}
                  required
                  value={amount}
                  onChange={(val) => setAmount(val)}
                  size="md"
                />

                <TextInput
                  label="Description / Purpose"
                  placeholder="e.g. Table 4 Dinner Bill"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <TextInput
                  label="Customer Name (Optional)"
                  placeholder="e.g. John Doe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />

                <TextInput
                  label="Customer Mobile (Optional)"
                  placeholder="e.g. 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />

                <Button
                  type="submit"
                  color="indigo"
                  size="md"
                  fullWidth
                  loading={loading}
                  leftSection={<IconSparkles size={18} />}
                >
                  Generate Dynamic UPI QR
                </Button>
              </Stack>
            </form>
          </Card>
        </Box>

        {/* Live QR Display & Status */}
        <Box>
          <Card
            shadow="xs"
            padding="xl"
            radius="md"
            withBorder
            bg="#fff"
            style={{ minHeight: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            {createdOrder ? (
              <Stack align="center" gap="md" style={{ width: '100%' }}>
                <Group justify="space-between" style={{ width: '100%' }}>
                  <Text fw={700} size="xl">
                    ₹{Number(amount).toFixed(2)}
                  </Text>
                  <Badge
                    color={orderStatus === 'SUCCESS' ? 'teal' : 'blue'}
                    size="lg"
                    variant="filled"
                  >
                    {orderStatus === 'SUCCESS' ? 'PAID AT COUNTER ✓' : 'AWAITING PAYMENT'}
                  </Badge>
                </Group>

                {orderStatus === 'SUCCESS' ? (
                  <Stack align="center" gap="sm" style={{ width: '100%', padding: '24px 0' }}>
                    <ThemeIcon color="teal" size={72} radius="xl" variant="light">
                      <IconCircleCheckFilled size={52} color="#059669" />
                    </ThemeIcon>

                    <Title order={3} c="teal.9" fw={800} ta="center">
                      Payment Received!
                    </Title>

                    <Text size="sm" c="dimmed" ta="center">
                      ₹{Number(amount).toFixed(2)} received into merchant account.
                    </Text>

                    {verifiedDetails?.bankReferenceNo && (
                      <Badge variant="outline" color="teal" size="lg">
                        UTR: {verifiedDetails.bankReferenceNo}
                      </Badge>
                    )}

                    <Button
                      mt="md"
                      color="indigo"
                      size="md"
                      fullWidth
                      leftSection={<IconRefresh size={18} />}
                      onClick={handleResetForNext}
                    >
                      Create Next Payment
                    </Button>
                  </Stack>
                ) : (
                  <>
                    <Box
                      p="md"
                      style={{
                        background: '#fff',
                        border: '2px solid #e2e8f0',
                        borderRadius: 16,
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                      }}
                    >
                      <QRCode
                        value={createdOrder.upiString}
                        size={220}
                      />
                    </Box>

                    <Group gap="xs">
                      <Loader size={14} color="indigo" />
                      <Text size="xs" c="indigo.8" fw={600}>
                        Listening in real-time — auto-confirms upon payment
                      </Text>
                    </Group>

                    <Text size="xs" c="dimmed" ta="center">
                      Scan with any UPI app (Paytm, GPay, BHIM)
                    </Text>

                    {/* Secondary Manual Confirmation for Cash / Counter Override */}
                    <Button
                      variant="subtle"
                      color="gray"
                      size="compact-xs"
                      loading={confirming}
                      onClick={handleConfirmReceived}
                    >
                      Manual Confirm (Cash / Soundbox override)
                    </Button>
                  </>
                )}

                <Divider my="xs" style={{ width: '100%' }} />

                <Group gap="xs" style={{ width: '100%' }}>
                  <TextInput
                    value={checkoutUrl}
                    readOnly
                    style={{ flex: 1 }}
                    size="sm"
                  />
                  <CopyButton value={checkoutUrl}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy Link'}>
                        <ActionIcon color={copied ? 'teal' : 'gray'} variant="light" size="lg" onClick={copy}>
                          {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  <Tooltip label="Open Customer Checkout">
                    <ActionIcon
                      component="a"
                      href={checkoutUrl}
                      target="_blank"
                      variant="light"
                      color="indigo"
                      size="lg"
                    >
                      <IconExternalLink size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Stack>
            ) : (
              <Stack align="center" gap="sm">
                <IconQrcode size={64} color="#cbd5e1" />
                <Text size="sm" c="dimmed">
                  Fill out the form and click generate to render a dynamic UPI QR.
                </Text>
              </Stack>
            )}
          </Card>
        </Box>
      </SimpleGrid>
    </Container>
  );
}
