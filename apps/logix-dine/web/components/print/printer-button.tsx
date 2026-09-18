"use client";

import React, { useState, useEffect } from "react";
import { Group, Button, Text, Badge, Stack, ActionIcon, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBluetooth, IconBluetoothOff, IconPrinter, IconX } from "@tabler/icons-react";
import {
  getStatus,
  getPairedName,
  pair,
  forget,
  isSupported,
  type PrinterStatus,
} from "@/lib/bluetooth-printer";
import { printHtml } from "@/lib/print";
import { buildKotPayload } from "@/lib/ticket";

export function PrinterButton() {
  const [status, setStatus] = useState<PrinterStatus>("unsupported");
  const [name, setName] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setStatus(getStatus());
    setName(getPairedName());
  }, []);

  const handlePair = async () => {
    setPairing(true);
    try {
      const deviceName = await pair();
      setStatus("paired");
      setName(deviceName);
      notifications.show({ title: "Printer paired", message: deviceName, color: "green", icon: <IconBluetooth size={16} /> });
    } catch (err: any) {
      if (!err.message?.includes("cancelled")) {
        notifications.show({ title: "Pairing failed", message: err.message, color: "red" });
      }
    } finally {
      setPairing(false);
    }
  };

  const handleForget = () => {
    forget();
    setStatus("unpaired");
    setName(null);
    notifications.show({ title: "Printer removed", message: "", color: "gray" });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const testPayload = buildKotPayload(
        {
          order: { orderNo: 0, tableNo: "TEST", createdAt: new Date().toISOString(), subtotalPaise: 0 },
          items: [{ name: "Test Item", qty: 1, pricePaiseSnapshot: 0 }],
        },
        { name: "Logix Dine", address: "Printer Test" }
      );
      testPayload.type = "KOT";
      // Always use HTML for test so it works without pairing too
      const { print: blePrint, isPaired: isBLEPaired } = await import("@/lib/bluetooth-printer");
      if (isBLEPaired()) {
        const { encodeTicket } = await import("@/lib/escpos");
        const bytes = encodeTicket({ ...testPayload, restaurantName: "Logix Dine — Printer OK" });
        await blePrint(bytes);
        notifications.show({ title: "Test page sent via Bluetooth", message: "", color: "green" });
      } else {
        printHtml({ ...testPayload, restaurantName: "Logix Dine — Printer OK" });
      }
    } catch (err: any) {
      notifications.show({ title: "Test failed", message: err.message, color: "red" });
    } finally {
      setTesting(false);
    }
  };

  if (!isSupported()) {
    return (
      <Text size="sm" c="dimmed">
        Web Bluetooth is not supported in this browser. Use Chrome on Android or desktop.
      </Text>
    );
  }

  if (status === "paired") {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <IconBluetooth size={18} color="var(--mantine-color-blue-6)" />
          <Text size="sm" fw={500}>{name}</Text>
          <Badge color="green" size="sm">Connected</Badge>
          <Tooltip label="Remove printer">
            <ActionIcon variant="subtle" color="red" size="sm" onClick={handleForget}>
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPrinter size={14} />}
            onClick={handleTest}
            loading={testing}
          >
            Test Print
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Button
      leftSection={<IconBluetooth size={16} />}
      loading={pairing}
      onClick={handlePair}
      variant="light"
    >
      Pair Printer via Bluetooth
    </Button>
  );
}
