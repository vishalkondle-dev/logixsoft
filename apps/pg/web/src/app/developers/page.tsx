'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Code,
  Tabs,
  Badge,
  Box,
  SimpleGrid,
  ThemeIcon,
  Alert,
} from '@mantine/core';
import {
  IconDeviceDesktop,
  IconCode,
  IconShieldCheck,
  IconPlayerPlay,
  IconCheck,
  IconArrowRight,
  IconBolt,
  IconBuildingBank,
} from '@tabler/icons-react';
import { LogoIcon } from '@/components/LogoIcon';
import Link from 'next/link';
import { pgApi } from '@/lib/api';

export default function PublicDevelopersPage() {
  const [testingModal, setTestingModal] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<any>(null);

  useEffect(() => {
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

  const handleLaunchModalDemo = async () => {
    setTestingModal(true);
    setModalTestResult(null);
    try {
      const order = await pgApi.createOrder({
        amountInRupees: 299,
        description: 'Public Developer Playground Order',
        customerName: 'Aman Sharma',
        customerPhone: '9876543210',
      });

      const LogixsoftCheckout = (window as any).LogixsoftCheckout;
      if (!LogixsoftCheckout) {
        alert('Loading checkout script, please retry in 1 second.');
        setTestingModal(false);
        return;
      }

      const checkout = new LogixsoftCheckout({
        orderId: order.orderId,
        onSuccess: function (data: any) {
          setModalTestResult({
            status: 'SUCCESS',
            message: 'Payment completed successfully!',
            data,
          });
        },
        onFailure: function (data: any) {
          setModalTestResult({
            status: 'FAILED',
            message: 'Payment simulation declined.',
            data,
          });
        },
      });

      checkout.open();
    } catch (err: any) {
      alert('Demo order creation failed. Ensure pg-api is running.');
    } finally {
      setTestingModal(false);
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
                <Badge variant="light" color="indigo" size="sm">
                  Developer Docs
                </Badge>
              </Group>
            </Link>

            <Group gap="sm">
              <Button component={Link} href="/login" variant="default" size="sm">
                Merchant Portal
              </Button>
              <Button component={Link} href="/dashboard/developers" color="indigo" size="sm">
                Get API Keys
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Main Content */}
      <Container size="lg" py={50} style={{ flex: 1 }}>
        <Stack gap="xl">
          {/* Hero Banner */}
          <Box style={{ textAlign: 'center' }} py={20}>
            <Badge size="lg" variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }} mb="sm">
              Developer Documentation
            </Badge>
            <Title order={1} style={{ fontSize: '2.5rem', fontWeight: 800 }}>
              Integrate UPI Payment Gateway in Minutes
            </Title>
            <Text c="dimmed" size="lg" style={{ maxWidth: 680, margin: '12px auto 0' }}>
              Accept payments seamlessly on any eCommerce store, SaaS web app, or mobile site using our in-page popup modal
              and server-to-server webhook verification.
            </Text>
          </Box>

          {/* Feature Highlights */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
              <ThemeIcon color="indigo" size={40} radius="md" mb="sm">
                <IconDeviceDesktop size={22} />
              </ThemeIcon>
              <Text fw={700} size="md" mb={4}>
                In-Page Popup Modal
              </Text>
              <Text size="sm" c="dimmed">
                No redirects. Customers scan dynamic QR or tap UPI intent apps directly within a smooth modal on your domain.
              </Text>
            </Card>

            <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
              <ThemeIcon color="teal" size={40} radius="md" mb="sm">
                <IconBolt size={22} />
              </ThemeIcon>
              <Text fw={700} size="md" mb={4}>
                Zero Transaction Fees
              </Text>
              <Text size="sm" c="dimmed">
                Direct settlement into your verified merchant current account via Paytm / NPCI UPI rails.
              </Text>
            </Card>

            <Card shadow="xs" padding="lg" radius="md" withBorder bg="#fff">
              <ThemeIcon color="blue" size={40} radius="md" mb="sm">
                <IconShieldCheck size={22} />
              </ThemeIcon>
              <Text fw={700} size="md" mb={4}>
                Signed Webhooks
              </Text>
              <Text size="sm" c="dimmed">
                HMAC-SHA256 encrypted callbacks ensure 100% reliable order reconciliation even if the customer's browser closes.
              </Text>
            </Card>
          </SimpleGrid>

          {/* Live Playground Card */}
          <Card
            shadow="sm"
            padding="xl"
            radius="md"
            withBorder
            style={{
              background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #6366f1 100%)',
              color: '#fff',
            }}
          >
            <Group justify="space-between" align="center">
              <Stack gap="xs">
                <Badge color="cyan" variant="filled">
                  Live Interactive Demo
                </Badge>
                <Title order={3} c="#fff">
                  Try the In-Page Checkout Modal
                </Title>
                <Text size="sm" c="#e0e7ff" style={{ maxWidth: 600 }}>
                  Click to experience the drop-in checkout modal just as your shoppers will on your storefront.
                </Text>
              </Stack>

              <Button
                size="lg"
                color="white"
                variant="white"
                c="indigo.9"
                fw={700}
                leftSection={<IconPlayerPlay size={20} />}
                onClick={handleLaunchModalDemo}
                loading={testingModal}
              >
                Launch Checkout Demo (₹299)
              </Button>
            </Group>

            {modalTestResult && (
              <Alert
                mt="lg"
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

          {/* Integration Guide Tabs */}
          <Card shadow="xs" padding="xl" radius="md" withBorder bg="#fff">
            <Title order={3} mb="xs">
              Complete Integration Walkthrough
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              Follow these three straightforward steps to go live with Logixsoft Payment Gateway:
            </Text>

            <Tabs defaultValue="step1">
              <Tabs.List>
                <Tabs.Tab value="step1" leftSection={<IconDeviceDesktop size={16} />}>
                  Step 1: In-Page Modal (checkout.js)
                </Tabs.Tab>
                <Tabs.Tab value="step2" leftSection={<IconCode size={16} />}>
                  Step 2: Server-to-Server Order Creation
                </Tabs.Tab>
                <Tabs.Tab value="step3" leftSection={<IconShieldCheck size={16} />}>
                  Step 3: Webhook Verification
                </Tabs.Tab>
              </Tabs.List>

              {/* STEP 1 */}
              <Tabs.Panel value="step1" pt="lg">
                <Stack gap="md">
                  <Text size="sm">
                    <strong>1. Include our universal SDK in your frontend HTML:</strong>
                  </Text>
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`<script src="https://payment.logixsoft.in/checkout.js"></script>`}
                  </Code>

                  <Text size="sm">
                    <strong>2. When the user clicks "Proceed to Pay", trigger the modal:</strong>
                  </Text>
                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`// Create an order on your server and retrieve the orderId
const { orderId } = await fetch('/api/create-order', { method: 'POST' }).then(res => res.json());

// Initialize and open modal
const checkout = new LogixsoftCheckout({
  orderId: orderId,
  onSuccess: function (response) {
    console.log('Payment Successful:', response);
    // response = { orderId, amount, bankReferenceNo, status: "SUCCESS", paidAt }
    window.location.href = '/order-confirmation?orderId=' + response.orderId;
  },
  onFailure: function (response) {
    alert('Payment was not completed: ' + (response.reason || 'Declined'));
  },
  onClose: function () {
    console.log('Modal dismissed by customer');
  }
});

checkout.open();`}
                  </Code>
                </Stack>
              </Tabs.Panel>

              {/* STEP 2 */}
              <Tabs.Panel value="step2" pt="lg">
                <Stack gap="md">
                  <Text size="sm">
                    Create orders securely from your backend server using your <strong>API Key</strong>:
                  </Text>

                  <Tabs defaultValue="node">
                    <Tabs.List>
                      <Tabs.Tab value="node">Node.js</Tabs.Tab>
                      <Tabs.Tab value="curl">cURL</Tabs.Tab>
                      <Tabs.Tab value="python">Python</Tabs.Tab>
                      <Tabs.Tab value="php">PHP</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="node" pt="sm">
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
    description: "eCommerce Order #ORD-1042",
  }),
});

const { orderId, paymentUrl, upiString } = await response.json();
res.json({ orderId });`}
                      </Code>
                    </Tabs.Panel>

                    <Tabs.Panel value="curl" pt="sm">
                      <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`curl -X POST https://payment-api.logixsoft.in/api/v1/orders/create \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "amountInRupees": 499,
    "customerName": "Aman Sharma",
    "customerPhone": "9876543210",
    "description": "eCommerce Order #ORD-1042"
  }'`}
                      </Code>
                    </Tabs.Panel>

                    <Tabs.Panel value="python" pt="sm">
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
    "description": "eCommerce Order #ORD-1042"
}

res = requests.post(url, json=payload, headers=headers)
print(res.json())`}
                      </Code>
                    </Tabs.Panel>

                    <Tabs.Panel value="php" pt="sm">
                      <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`<?php
$ch = curl_init('https://payment-api.logixsoft.in/api/v1/orders/create');
$payload = json_encode([
    'amountInRupees' => 499,
    'customerName'   => 'Aman Sharma',
    'customerPhone'  => '9876543210',
    'description'    => 'eCommerce Order #ORD-1042'
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-key: YOUR_API_KEY'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);
?>`}
                      </Code>
                    </Tabs.Panel>
                  </Tabs>
                </Stack>
              </Tabs.Panel>

              {/* STEP 3 */}
              <Tabs.Panel value="step3" pt="lg">
                <Stack gap="md">
                  <Text size="sm">
                    Configure your Webhook Endpoint in the Merchant Console. Each webhook request contains an
                    HMAC-SHA256 signature in the <Code>x-logixsoft-signature</Code> header:
                  </Text>

                  <Code block style={{ fontSize: '13px', borderRadius: 8, padding: 16 }}>
{`import crypto from 'node:crypto';
import express from 'express';

const app = express();
app.use(express.text({ type: 'application/json' }));

app.post('/api/webhooks/logixsoft', (req, res) => {
  const sigHeader = req.headers['x-logixsoft-signature'];
  const timestamp = req.headers['x-logixsoft-timestamp'];
  const rawBody = req.body;
  const webhookSecret = process.env.LOGIXSOFT_WEBHOOK_SECRET;

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');

  const receivedSig = sigHeader.split('v1=')[1];
  if (expectedSig !== receivedSig) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = JSON.parse(rawBody);
  if (event === 'payment.success') {
    console.log(\`Order \${data.orderId} verified! UTR: \${data.bankReferenceNo}\`);
    // Fulfill order in your database
  }

  res.status(200).json({ received: true });
});`}
                  </Code>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Stack>
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
              <Text component={Link} href="/" size="sm" c="dimmed">
                Home
              </Text>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
