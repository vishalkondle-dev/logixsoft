"use client";

import React from "react";
import { Paper, Stack, Group, Text, Badge, Box, Button, CopyButton } from "@mantine/core";
import { IconQrcode, IconDeviceMobile, IconCheck, IconCopy } from "@tabler/icons-react";
import { QRCode } from "@gfazioli/mantine-qr-code";

export interface UpiQrCodeProps {
  upiId?: string | null;
  payeeName?: string | null;
  amount: number; // In Rupees
  transactionId: string;
  note?: string;
  size?: number;
}

/**
 * Builds standard NPCI UPI URI
 * upi://pay?pa={vpa}&pn={name}&am={amount}&cu=INR&tn={note}&tr={refId}
 */
export function buildUpiUri({
  upiId,
  payeeName,
  amount,
  transactionId,
  note,
}: {
  upiId: string;
  payeeName?: string | null;
  amount: number;
  transactionId: string;
  note?: string;
}): string {
  const cleanUpi = upiId.trim();
  const cleanName = (payeeName || "Restaurant").trim().slice(0, 50);
  const formattedAmount = amount.toFixed(2);
  const cleanTxnId = transactionId.trim().replace(/[^a-zA-Z0-9_-]/g, "") || String(Date.now());
  const cleanNote = (
    note || `Order ${transactionId} Rs ${amount.toFixed(0)}`
  ).trim().slice(0, 50);

  const query = new URLSearchParams({
    pa: cleanUpi,
    pn: cleanName,
    am: formattedAmount,
    cu: "INR",
    tn: cleanNote,
    tr: cleanTxnId,
  });

  return `upi://pay?${query.toString()}`;
}

export function UpiQrCode({
  upiId,
  payeeName,
  amount,
  transactionId,
  note,
  size = 200,
}: UpiQrCodeProps) {
  // Shown ONLY if upi id is configured for the outlet
  if (!upiId || !upiId.trim() || amount <= 0) {
    return null;
  }

  const upiUri = buildUpiUri({
    upiId,
    payeeName,
    amount,
    transactionId,
    note,
  });

  return (
    <Paper
      p="sm"
      radius="md"
      bg="white"
      shadow="xs"
    >
      <Stack align="center" gap="xs">
        <Group justify="space-between" w="100%">
          <Badge color="teal" variant="light" size="sm" leftSection={<IconQrcode size={13} />}>
            UPI QR Code
          </Badge>
          <Text size="xs" fw={600} c="dimmed">
            Ref: {transactionId}
          </Text>
        </Group>

        <Box
          style={{
            background: "#ffffff",
            padding: 10,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <QRCode
            value={upiUri}
            size={size}
            image="/logo.png"
            imageSize={0.22}
            imageRadius="sm"
            imageExcavate
            errorCorrectionLevel="H"
            dotStyle="rounded"
            cornerStyle="rounded"
            color="#0f172a"
            background="#ffffff"
          />
        </Box>

        <Stack align="center" gap={2}>
          <Text size="xl" fw={800} c="dinePrimary">
            ₹{amount.toFixed(2)}
          </Text>
          <Text size="xs" c="dimmed">
            Pay to: <Text span fw={600} c="dark">{upiId.trim()}</Text>
          </Text>
          <Text size="xs" c="dimmed">
            Scan with GPay, PhonePe, Paytm or any UPI App
          </Text>
        </Stack>

        <Group gap="xs" justify="center" mt={2}>
          <Button
            component="a"
            href={upiUri}
            size="xs"
            variant="light"
            color="teal"
            leftSection={<IconDeviceMobile size={13} />}
            style={{ textDecoration: "none" }}
          >
            Open in UPI App
          </Button>
          <CopyButton value={upiId.trim()}>
            {({ copied, copy }) => (
              <Button
                size="xs"
                variant="subtle"
                color={copied ? "teal" : "gray"}
                leftSection={copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                onClick={copy}
              >
                {copied ? "Copied" : "Copy UPI"}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Stack>
    </Paper>
  );
}
