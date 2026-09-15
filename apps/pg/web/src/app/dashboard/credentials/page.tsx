'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Stack,
  Group,
  Radio,
  TextInput,
  Select,
  Button,
  Divider,
  Alert,
  CopyButton,
  ActionIcon,
  Tooltip,
  Loader,
  Center,
  Box,
  Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSettings, IconCopy, IconCheck, IconShieldLock, IconInfoCircle, IconBuildingBank, IconTestPipe } from '@tabler/icons-react';
import { pgApi } from '@/lib/api';

export default function CredentialsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Active Provider state
  const [activeProvider, setActiveProvider] = useState<string>('PAYTM');

  // Paytm-specific states
  const [paytmMerchantName, setPaytmMerchantName] = useState('Logix Software Solutions');
  const [paytmVpa, setPaytmVpa] = useState('');
  const [paytmMerchantId, setPaytmMerchantId] = useState('');
  const [paytmMerchantKey, setPaytmMerchantKey] = useState('');
  const [paytmWebsite, setPaytmWebsite] = useState('DEFAULT');
  const [paytmEnv, setPaytmEnv] = useState<'STAGING' | 'PROD'>('PROD');
  const [paytmWebhookUrl, setPaytmWebhookUrl] = useState('');

  // Sandbox Simulator (Mock)-specific states
  const [mockMerchantName, setMockMerchantName] = useState('Demo Merchant Store');
  const [mockVpa, setMockVpa] = useState('merchant@upi');

  useEffect(() => {
    async function load() {
      try {
        const data = await pgApi.getCredentials();
        setActiveProvider(data.activeProvider || 'PAYTM');

        // Populate Paytm provider details
        if (data.paytm) {
          setPaytmMerchantName(data.paytm.merchantName || 'Logix Software Solutions');
          setPaytmVpa(data.paytm.vpa || '');
          setPaytmMerchantId(data.paytm.merchantId || '');
          setPaytmMerchantKey(data.paytm.merchantKey || '');
          setPaytmWebsite(data.paytm.website || 'DEFAULT');
          setPaytmEnv(data.paytm.env || 'PROD');
          setPaytmWebhookUrl(data.paytm.webhookUrl || '');
        } else {
          setPaytmMerchantName(data.paytmMerchantName || data.merchantName || 'Logix Software Solutions');
          setPaytmVpa(data.paytmVpa || data.vpa || '');
          setPaytmMerchantId(data.paytmMerchantId || '');
          setPaytmMerchantKey(data.paytmMerchantKey || '');
          setPaytmWebsite(data.paytmWebsite || 'DEFAULT');
          setPaytmEnv(data.paytmEnv || 'PROD');
          setPaytmWebhookUrl(data.paytmWebhookUrl || '');
        }

        // Populate Mock provider details
        if (data.mock) {
          setMockMerchantName(data.mock.merchantName || 'Demo Merchant Store');
          setMockVpa(data.mock.vpa || 'merchant@upi');
        } else {
          setMockMerchantName(data.mockMerchantName || 'Demo Merchant Store');
          setMockVpa(data.mockVpa || 'merchant@upi');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await pgApi.updateCredentials({
        activeProvider,
        paytm: {
          merchantName: paytmMerchantName,
          vpa: paytmVpa,
          merchantId: paytmMerchantId,
          merchantKey: paytmMerchantKey,
          website: paytmWebsite,
          env: paytmEnv,
        },
        mock: {
          merchantName: mockMerchantName,
          vpa: mockVpa,
        },
        // Legacy flat fallbacks
        paytmMerchantName,
        paytmVpa,
        paytmMerchantId,
        paytmMerchantKey,
        paytmWebsite,
        paytmEnv,
        mockMerchantName,
        mockVpa,
      });

      notifications.show({
        title: 'Settings Saved',
        message: 'Provider accounts and UPI configurations updated successfully',
        color: 'teal',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Save Failed',
        message: err.message || 'Could not save credentials',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Center style={{ minHeight: '60vh' }}>
        <Loader size="lg" color="indigo" />
      </Center>
    );
  }

  return (
    <Container size="md" py="sm">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} fw={700}>
            Gateway Provider Settings
          </Title>
          <Text c="dimmed" size="sm">
            Configure merchant UPI IDs and API credentials linked directly to each provider.
          </Text>
        </div>
      </Group>

      <form onSubmit={handleSave}>
        <Stack gap="lg">
          {/* Active Provider Selection */}
          <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
            <Title order={4} mb="xs">
              Active Payment Provider
            </Title>
            <Text size="xs" c="dimmed" mb="md">
              Select which merchant gateway account actively processes incoming customer checkout requests.
            </Text>

            <Radio.Group
              value={activeProvider}
              onChange={setActiveProvider}
            >
              <Stack gap="sm">
                <Radio
                  value="PAYTM"
                  label="Paytm Payment Gateway (Production PG API)"
                  description="Processes live UPI payments using your official Paytm Merchant MID and Paytm UPI ID."
                />
                <Radio
                  value="MOCK"
                  label="Sandbox Simulator (Instant Test Mode)"
                  description="Generates simulated dynamic QR codes for testing order flows without debiting real bank accounts."
                />
              </Stack>
            </Radio.Group>
          </Card>

          {/* Paytm Provider Account */}
          <Card
            shadow="xs"
            padding="lg"
            radius="md"
            withBorder
            bg="#fff"
            style={{
              borderColor: activeProvider === 'PAYTM' ? '#6366f1' : undefined,
              borderWidth: activeProvider === 'PAYTM' ? 2 : 1,
            }}
          >
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <IconBuildingBank size={20} color="#6366f1" />
                <Title order={4}>Paytm Provider Configuration</Title>
              </Group>
              <Group gap="xs">
                {activeProvider === 'PAYTM' ? (
                  <Badge color="indigo" variant="filled">ACTIVE GATEWAY</Badge>
                ) : (
                  <Badge color="gray" variant="light">INACTIVE</Badge>
                )}
                <Select
                  data={[
                    { value: 'STAGING', label: 'Staging (Sandbox)' },
                    { value: 'PROD', label: 'Production (Live)' },
                  ]}
                  value={paytmEnv}
                  onChange={(v) => setPaytmEnv(v as any)}
                  style={{ width: 140 }}
                  size="xs"
                />
              </Group>
            </Group>

            <Stack gap="sm">
              <Group grow>
                <TextInput
                  label="Paytm Display Name"
                  placeholder="e.g. Logix Software Solutions"
                  value={paytmMerchantName}
                  onChange={(e) => setPaytmMerchantName(e.target.value)}
                  required
                />
                <TextInput
                  label="Paytm Merchant UPI ID (VPA)"
                  description="Your official Paytm UPI address where payments will be deposited"
                  placeholder="e.g. paytmqr...@paytm or yourname@paytm"
                  value={paytmVpa}
                  onChange={(e) => setPaytmVpa(e.target.value)}
                  required
                  error={paytmVpa === 'merchant@upi' ? "Enter your real Paytm UPI ID (ends with @paytm)" : undefined}
                />
              </Group>

              {paytmVpa === 'merchant@upi' && (
                <Alert color="orange" title="Demo UPI Address Detected" icon={<IconInfoCircle size={18} />}>
                  Your Paytm UPI ID is currently set to <b>merchant@upi</b>. Please enter your real Paytm UPI ID from your Paytm for Business app (e.g. <code>yourmobile@paytm</code> or <code>paytmqr...@paytm</code>).
                </Alert>
              )}

              <TextInput
                label="Paytm Merchant ID (MID)"
                placeholder="e.g. TSBTBs96640022716081"
                value={paytmMerchantId}
                onChange={(e) => setPaytmMerchantId(e.target.value)}
                required
              />

              <Group grow>
                <TextInput
                  label="Paytm Merchant Key"
                  placeholder="Your Paytm Merchant Encryption Key"
                  value={paytmMerchantKey}
                  onChange={(e) => setPaytmMerchantKey(e.target.value)}
                  type="password"
                  required
                />
                <TextInput
                  label="Website Name"
                  placeholder="DEFAULT"
                  value={paytmWebsite}
                  onChange={(e) => setPaytmWebsite(e.target.value)}
                />
              </Group>

              {paytmWebhookUrl && (
                <Box mt="xs">
                  <Text size="xs" fw={600} c="dimmed">
                    Your Verified Paytm Webhook Callback URL:
                  </Text>
                  <Group gap="xs" mt={4}>
                    <TextInput value={paytmWebhookUrl} readOnly size="xs" style={{ flex: 1 }} />
                    <CopyButton value={paytmWebhookUrl}>
                      {({ copied, copy }) => (
                        <ActionIcon color={copied ? 'teal' : 'gray'} variant="light" size="sm" onClick={copy}>
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      )}
                    </CopyButton>
                  </Group>
                  <Text size="11px" c="dimmed" mt={2}>
                    Configured in your Paytm Business Dashboard Webhook settings for instant payment confirmation.
                  </Text>
                </Box>
              )}
            </Stack>
          </Card>

          {/* Sandbox Simulator Account */}
          <Card
            shadow="xs"
            padding="lg"
            radius="md"
            withBorder
            bg="#fff"
            style={{
              borderColor: activeProvider === 'MOCK' ? '#0ea5e9' : undefined,
              borderWidth: activeProvider === 'MOCK' ? 2 : 1,
            }}
          >
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <IconTestPipe size={20} color="#0ea5e9" />
                <Title order={4}>Sandbox Simulator Configuration</Title>
              </Group>
              {activeProvider === 'MOCK' ? (
                <Badge color="cyan" variant="filled">ACTIVE GATEWAY</Badge>
              ) : (
                <Badge color="gray" variant="light">INACTIVE</Badge>
              )}
            </Group>

            <Stack gap="sm">
              <Group grow>
                <TextInput
                  label="Sandbox Store Name"
                  placeholder="e.g. Demo Merchant Store"
                  value={mockMerchantName}
                  onChange={(e) => setMockMerchantName(e.target.value)}
                  required
                />
                <TextInput
                  label="Sandbox Test UPI ID (VPA)"
                  description="Test VPA used for sandbox simulations"
                  placeholder="merchant@upi"
                  value={mockVpa}
                  onChange={(e) => setMockVpa(e.target.value)}
                  required
                />
              </Group>
              <Text size="xs" c="dimmed">
                The Sandbox Simulator generates standard NPCI UPI QRs and simulates 1-click order completions without connecting to external banking APIs.
              </Text>
            </Stack>
          </Card>

          <Button type="submit" color="indigo" size="md" loading={saving}>
            Save Gateway Settings
          </Button>
        </Stack>
      </form>
    </Container>
  );
}
