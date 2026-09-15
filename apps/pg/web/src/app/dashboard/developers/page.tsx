'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Table,
  TextInput,
  Modal,
  CopyButton,
  ActionIcon,
  Tooltip,
  Code,
  Tabs,
  Badge,
  Center,
  Loader,
  Switch,
  Alert,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconKey,
  IconPlus,
  IconTrash,
  IconCopy,
  IconCheck,
  IconCode,
  IconWebhook,
  IconPlayerPlay,
  IconRefresh,
  IconDeviceDesktop,
  IconShieldCheck,
  IconExternalLink,
} from '@tabler/icons-react';
import { pgApi } from '@/lib/api';

export default function DevelopersPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Webhook states
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookActive, setWebhookActive] = useState(true);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Live Modal Testing states
  const [testingModal, setTestingModal] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<any>(null);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const data = await pgApi.getApiKeys();
      setKeys(data.keys || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhook = async () => {
    setLoadingWebhook(true);
    try {
      const res = await pgApi.getWebhook();
      if (res.webhook) {
        setWebhookUrl(res.webhook.url || '');
        setWebhookSecret(res.webhook.secret || '');
        setWebhookActive(res.webhook.isActive !== false);
      }
    } catch (e) {
      console.error('Failed to load webhook:', e);
    } finally {
      setLoadingWebhook(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchWebhook();

    // Ensure checkout.js is loaded for testing
    if (typeof window !== 'undefined') {
      const existingScript = document.getElementById('logixsoft-checkout-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'logixsoft-checkout-script';
        script.src = '/checkout.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setCreating(true);
    try {
      const res = await pgApi.createApiKey(keyName);
      setNewlyCreatedKey(res.key.key);
      setKeyName('');
      fetchKeys();
    } catch (e) {
      alert('Failed to generate key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await pgApi.deleteApiKey(id);
      fetchKeys();
    } catch {
      alert('Failed to revoke API key');
    }
  };

  const handleSaveWebhook = async (regenerate = false) => {
    if (!webhookUrl.trim()) {
      alert('Please enter a valid webhook URL.');
      return;
    }
    setSavingWebhook(true);
    setTestResult(null);
    try {
      const res = await pgApi.saveWebhook({
        url: webhookUrl.trim(),
        regenerateSecret: regenerate,
        isActive: webhookActive,
      });
      if (res.webhook) {
        setWebhookUrl(res.webhook.url);
        setWebhookSecret(res.webhook.secret);
        setWebhookActive(res.webhook.isActive);
        alert(regenerate ? 'Webhook secret regenerated and saved!' : 'Webhook URL saved successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save webhook settings');
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      alert('Please save a webhook URL first.');
      return;
    }
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await pgApi.testWebhook({
        url: webhookUrl.trim(),
        secret: webhookSecret,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleLaunchModalDemo = async () => {
    setTestingModal(true);
    setModalTestResult(null);
    try {
      // 1. Create a test order
      const order = await pgApi.createOrder({
        amountInRupees: 199,
        description: 'Interactive Modal Checkout Test',
        customerName: 'Demo Customer',
        customerPhone: '9876543210',
      });

      // 2. Open via LogixsoftCheckout SDK
      const LogixsoftCheckout = (window as any).LogixsoftCheckout;
      if (!LogixsoftCheckout) {
        alert('Checkout SDK is loading, please try again in a moment.');
        setTestingModal(false);
        return;
      }

      const checkout = new LogixsoftCheckout({
        orderId: order.orderId,
        onSuccess: function (data: any) {
          setModalTestResult({
            status: 'SUCCESS',
            message: 'Payment verified and completed!',
            data,
          });
        },
        onFailure: function (data: any) {
          setModalTestResult({
            status: 'FAILED',
            message: 'Payment simulation was declined or failed.',
            data,
          });
        },
        onClose: function () {
          console.log('Customer closed test modal');
        },
      });

      checkout.open();
    } catch (err: any) {
      console.error(err);
      alert('Could not start test checkout: ' + (err.message || err));
    } finally {
      setTestingModal(false);
    }
  };

  return (
    <Container size="xl" py="sm">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} fw={700}>
            Developer APIs & Integration
          </Title>
          <Text c="dimmed" size="sm">
            Integrate Logixsoft Payment Gateway into your eCommerce storefront, custom web apps, or POS systems.
          </Text>
        </div>

        <Group gap="sm">
          <Button
            variant="light"
            color="indigo"
            leftSection={<IconExternalLink size={16} />}
            component="a"
            href="/developers"
            target="_blank"
          >
            Public API Docs
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            color="indigo"
            onClick={() => {
              setNewlyCreatedKey(null);
              openModal();
            }}
          >
            Generate API Key
          </Button>
        </Group>
      </Group>

      <Stack gap="xl">
        {/* Interactive In-Page Modal Demo Banner */}
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{
            background: 'linear-gradient(135deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%)',
            color: '#fff',
          }}
        >
          <Group justify="space-between" align="center">
            <Stack gap="xs">
              <Group gap="xs">
                <Badge color="cyan" variant="filled">
                  New Feature
                </Badge>
                <Title order={3} c="#fff">
                  In-Page Popup Modal (checkout.js)
                </Title>
              </Group>
              <Text size="sm" c="#e0e7ff" style={{ maxWidth: 650 }}>
                Customers stay directly on your eCommerce site without redirecting. Our lightweight drop-in SDK renders
                a modern UPI QR modal and invokes your callback on completion.
              </Text>
            </Stack>

            <Button
              size="md"
              color="white"
              variant="white"
              c="indigo.9"
              fw={700}
              leftSection={<IconPlayerPlay size={18} />}
              onClick={handleLaunchModalDemo}
              loading={testingModal}
            >
              Test Popup Checkout (₹199)
            </Button>
          </Group>

          {modalTestResult && (
            <Alert
              mt="md"
              radius="md"
              color={modalTestResult.status === 'SUCCESS' ? 'teal' : 'red'}
              variant="light"
              title={modalTestResult.message}
              withCloseButton
              onClose={() => setModalTestResult(null)}
              bg="#fff"
            >
              <Text size="xs" style={{ fontFamily: 'monospace' }}>
                {JSON.stringify(modalTestResult.data, null, 2)}
              </Text>
            </Alert>
          )}
        </Card>

        {/* API Keys Table */}
        <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
          <Title order={4} mb="md">
            Active API Keys
          </Title>

          {loading ? (
            <Center py="lg">
              <Loader color="indigo" size="md" />
            </Center>
          ) : keys.length === 0 ? (
            <Center py="xl">
              <Text size="sm" c="dimmed">
                No API keys generated yet. Create one to authenticate programmatic requests.
              </Text>
            </Center>
          ) : (
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>API Key</Table.Th>
                  <Table.Th>Last Used</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {keys.map((k) => (
                  <Table.Tr key={k.id}>
                    <Table.Td fw={600}>{k.name}</Table.Td>
                    <Table.Td style={{ fontFamily: 'monospace' }}>
                      <Group gap="xs">
                        <span>{k.maskedKey}</span>
                        <CopyButton value={k.key}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Copied' : 'Copy Key'}>
                              <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" size="xs" onClick={copy}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteKey(k.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Webhook Configuration Card */}
        <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconWebhook size={20} color="#4f46e5" />
              <Title order={4}>Server-to-Server Webhook Settings</Title>
            </Group>
            <Badge color={webhookActive && webhookUrl ? 'teal' : 'gray'} variant="light">
              {webhookActive && webhookUrl ? 'Active' : 'Not Configured'}
            </Badge>
          </Group>

          <Text size="sm" c="dimmed" mb="md">
            When a customer finishes payment, our gateway sends an HMAC-SHA256 signed POST notification to your backend
            for 100% reliable order fulfillment.
          </Text>

          {loadingWebhook ? (
            <Center py="md">
              <Loader color="indigo" size="sm" />
            </Center>
          ) : (
            <Stack gap="md">
              <TextInput
                label="Webhook Endpoint URL"
                placeholder="https://yourdomain.com/api/webhooks/logixsoft"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                description="Must be an HTTPS URL that accepts JSON POST requests."
              />

              {webhookSecret && (
                <div>
                  <Text size="xs" fw={500} mb={4}>
                    Webhook Signing Secret (HMAC-SHA256)
                  </Text>
                  <Group gap="xs">
                    <TextInput
                      value={webhookSecret}
                      readOnly
                      style={{ flex: 1, fontFamily: 'monospace' }}
                    />
                    <CopyButton value={webhookSecret}>
                      {({ copied, copy }) => (
                        <Button color={copied ? 'teal' : 'default'} variant="default" onClick={copy}>
                          {copied ? 'Copied' : 'Copy Secret'}
                        </Button>
                      )}
                    </CopyButton>
                    <Button
                      variant="outline"
                      color="orange"
                      onClick={() => {
                        if (confirm('Regenerating secret will invalidate your current signature verification. Continue?')) {
                          handleSaveWebhook(true);
                        }
                      }}
                    >
                      Regenerate
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    Use this secret to verify the <Code>x-logixsoft-signature</Code> header on incoming webhooks.
                  </Text>
                </div>
              )}

              <Group justify="space-between" mt="sm">
                <Switch
                  label="Enable Webhook Notifications"
                  checked={webhookActive}
                  onChange={(e) => setWebhookActive(e.currentTarget.checked)}
                />

                <Group gap="sm">
                  <Button
                    variant="default"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleTestWebhook}
                    loading={testingWebhook}
                    disabled={!webhookUrl}
                  >
                    Test Webhook
                  </Button>
                  <Button
                    color="indigo"
                    onClick={() => handleSaveWebhook(false)}
                    loading={savingWebhook}
                  >
                    Save Webhook Settings
                  </Button>
                </Group>
              </Group>

              {testResult && (
                <Alert
                  radius="md"
                  color={testResult.success ? 'teal' : 'red'}
                  variant="light"
                  title={testResult.message || (testResult.success ? 'Test Webhook Delivered' : 'Test Webhook Failed')}
                  withCloseButton
                  onClose={() => setTestResult(null)}
                >
                  {testResult.durationMs && (
                    <Text size="xs">Latency: {testResult.durationMs}ms | HTTP Status: {testResult.httpStatus}</Text>
                  )}
                  {testResult.error && <Text size="xs">Error: {testResult.error}</Text>}
                </Alert>
              )}
            </Stack>
          )}
        </Card>

        {/* Integration Documentation & Snippets */}
        <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
          <Group gap="xs" mb="xs">
            <IconCode size={20} color="#4f46e5" />
            <Title order={4}>Integration Code Library</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Choose your integration method below:
          </Text>

          <Tabs defaultValue="modal">
            <Tabs.List>
              <Tabs.Tab value="modal" leftSection={<IconDeviceDesktop size={16} />}>
                1. In-Page Popup (checkout.js)
              </Tabs.Tab>
              <Tabs.Tab value="api" leftSection={<IconCode size={16} />}>
                2. Server Order API
              </Tabs.Tab>
              <Tabs.Tab value="webhook" leftSection={<IconShieldCheck size={16} />}>
                3. Webhook Signature Verification
              </Tabs.Tab>
            </Tabs.List>

            {/* TAB 1: MODAL */}
            <Tabs.Panel value="modal" pt="md">
              <Stack gap="sm">
                <Text size="sm">
                  <strong>Step 1:</strong> Include our universal checkout script in your website's HTML:
                </Text>
                <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`<script src="https://payment.logixsoft.in/checkout.js"></script>`}
                </Code>

                <Text size="sm">
                  <strong>Step 2:</strong> When the user clicks "Pay", create an order from your backend and trigger the modal:
                </Text>
                <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`// 1. Fetch orderId from your backend server
const { orderId } = await fetch('/api/create-order', { method: 'POST' }).then(r => r.json());

// 2. Open Logixsoft Checkout Modal
const checkout = new LogixsoftCheckout({
  orderId: orderId,
  onSuccess: function (response) {
    console.log('Payment Completed!', response);
    // response = { orderId, amount, bankReferenceNo, status: "SUCCESS", paidAt }
    window.location.href = '/order-success?orderId=' + response.orderId;
  },
  onFailure: function (response) {
    alert('Payment was not completed: ' + (response.reason || 'Failed'));
  },
  onClose: function () {
    console.log('User closed modal');
  }
});

checkout.open();`}
                </Code>
              </Stack>
            </Tabs.Panel>

            {/* TAB 2: SERVER API */}
            <Tabs.Panel value="api" pt="md">
              <Tabs defaultValue="curl_api">
                <Tabs.List>
                  <Tabs.Tab value="curl_api">cURL</Tabs.Tab>
                  <Tabs.Tab value="node_api">Node.js / TypeScript</Tabs.Tab>
                  <Tabs.Tab value="python_api">Python</Tabs.Tab>
                  <Tabs.Tab value="php_api">PHP</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="curl_api" pt="sm">
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`curl -X POST https://payment-api.logixsoft.in/api/v1/orders/create \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "amountInRupees": 499,
    "customerName": "Aman Sharma",
    "customerPhone": "9876543210",
    "description": "eCommerce Order #1042"
  }'`}
                  </Code>
                </Tabs.Panel>

                <Tabs.Panel value="node_api" pt="sm">
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`const response = await fetch("https://payment-api.logixsoft.in/api/v1/orders/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.LOGIXSOFT_API_KEY,
  },
  body: JSON.stringify({
    amountInRupees: 499,
    customerName: "Aman Sharma",
    customerPhone: "9876543210",
    description: "eCommerce Order #1042",
  }),
});

const { orderId, paymentUrl, upiString } = await response.json();
// Pass orderId to frontend LogixsoftCheckout or redirect to paymentUrl`}
                  </Code>
                </Tabs.Panel>

                <Tabs.Panel value="python_api" pt="sm">
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`import requests

url = "https://payment-api.logixsoft.in/api/v1/orders/create"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_API_KEY"
}
payload = {
    "amountInRupees": 499,
    "customerName": "Aman Sharma",
    "customerPhone": "9876543210",
    "description": "eCommerce Order #1042"
}

res = requests.post(url, json=payload, headers=headers)
order = res.json()
print("Order ID:", order["orderId"])`}
                  </Code>
                </Tabs.Panel>

                <Tabs.Panel value="php_api" pt="sm">
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`<?php
$ch = curl_init('https://payment-api.logixsoft.in/api/v1/orders/create');
$payload = json_encode([
    'amountInRupees' => 499,
    'customerName'   => 'Aman Sharma',
    'customerPhone'  => '9876543210',
    'description'    => 'eCommerce Order #1042'
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-key: YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);
echo "Order ID: " . $response['orderId'];
?>`}
                  </Code>
                </Tabs.Panel>
              </Tabs>
            </Tabs.Panel>

            {/* TAB 3: WEBHOOK VERIFICATION */}
            <Tabs.Panel value="webhook" pt="md">
              <Tabs defaultValue="node_wh">
                <Tabs.List>
                  <Tabs.Tab value="node_wh">Node.js / Express</Tabs.Tab>
                  <Tabs.Tab value="python_wh">Python / FastAPI</Tabs.Tab>
                  <Tabs.Tab value="php_wh">PHP</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="node_wh" pt="sm">
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`import crypto from 'node:crypto';
import express from 'express';

const app = express();
// Ensure you read raw body string for cryptographic HMAC verification
app.use(express.text({ type: 'application/json' }));

app.post('/api/webhooks/logixsoft', (req, res) => {
  const sigHeader = req.headers['x-logixsoft-signature']; // e.g. "t=1726300000,v1=abc..."
  const timestamp = req.headers['x-logixsoft-timestamp'];
  const rawBody = req.body;
  const webhookSecret = process.env.LOGIXSOFT_WEBHOOK_SECRET;

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');

  const receivedSig = sigHeader.split('v1=')[1];
  if (expectedSig !== receivedSig) {
    return res.status(401).send('Invalid webhook signature');
  }

  const payload = JSON.parse(rawBody);
  if (payload.event === 'payment.success') {
    const { orderId, amount, bankReferenceNo } = payload.data;
    console.log(\`Order \${orderId} paid successfully! UTR: \${bankReferenceNo}\`);
    // Fulfill order in your database
  }

  res.status(200).json({ received: true });
});`}
                  </Code>
                </Tabs.Panel>

                <Tabs.Panel value="python_wh" pt="sm">
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = "whsec_your_secret_here"

@app.post("/api/webhooks/logixsoft")
async def handle_webhook(request: Request):
    raw_body = await request.body()
    timestamp = request.headers.get("x-logixsoft-timestamp", "")
    sig_header = request.headers.get("x-logixsoft-signature", "")
    
    signed_payload = f"{timestamp}.".encode() + raw_body
    expected_sig = hmac.new(WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256).hexdigest()
    
    received_sig = sig_header.split("v1=")[-1] if "v1=" in sig_header else ""
    if not hmac.compare_digest(expected_sig, received_sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()
    if data.get("event") == "payment.success":
        order = data["data"]
        print(f"Order {order['orderId']} fulfilled! UTR: {order['bankReferenceNo']}")
        
    return {"status": "ok"}`}
                  </Code>
                </Tabs.Panel>

                <Tabs.Panel value="php_wh" pt="sm">
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`<?php
$secret = 'whsec_your_secret_here';
$rawBody = file_get_contents('php://input');
$timestamp = $_SERVER['HTTP_X_LOGIXSOFT_TIMESTAMP'] ?? '';
$sigHeader = $_SERVER['HTTP_X_LOGIXSOFT_SIGNATURE'] ?? '';

$expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);
preg_match('/v1=([a-f0-9]+)/', $sigHeader, $matches);
$received = $matches[1] ?? '';

if (!hash_equals($expected, $received)) {
    http_response_code(401);
    die('Signature verification failed');
}

$payload = json_decode($rawBody, true);
if ($payload['event'] === 'payment.success') {
    $order = $payload['data'];
    // Fulfill order in DB
}

http_response_code(200);
echo json_encode(['received' => true]);
?>`}
                  </Code>
                </Tabs.Panel>
              </Tabs>
            </Tabs.Panel>
          </Tabs>
        </Card>
      </Stack>

      {/* Create Key Modal */}
      <Modal opened={modalOpened} onClose={closeModal} title="Generate New API Key">
        {newlyCreatedKey ? (
          <Stack gap="md">
            <Text size="sm" c="teal" fw={600}>
              API Key Generated Successfully!
            </Text>
            <Text size="xs" c="dimmed">
              Please copy and store this key securely. You will not be able to see it again in full.
            </Text>
            <Group gap="xs">
              <TextInput value={newlyCreatedKey} readOnly style={{ flex: 1, fontFamily: 'monospace' }} />
              <CopyButton value={newlyCreatedKey}>
                {({ copied, copy }) => (
                  <Button color={copied ? 'teal' : 'indigo'} onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Button variant="default" onClick={closeModal} fullWidth mt="sm">
              Done
            </Button>
          </Stack>
        ) : (
          <form onSubmit={handleCreateKey}>
            <Stack gap="md">
              <TextInput
                label="Key Label / Purpose"
                placeholder="e.g. Production eCommerce Store or POS Integration"
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
              <Button type="submit" color="indigo" fullWidth loading={creating}>
                Create Key
              </Button>
            </Stack>
          </form>
        )}
      </Modal>
    </Container>
  );
}
