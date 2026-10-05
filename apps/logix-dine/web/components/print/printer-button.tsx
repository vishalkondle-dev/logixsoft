"use client";

import React, { useState, useEffect } from "react";
import {
  Group,
  Button,
  Text,
  Badge,
  Stack,
  ActionIcon,
  Tooltip,
  Indicator,
  Modal,
  Paper,
  TextInput,
  Code,
  ScrollArea,
  Divider,
  CopyButton,
  Alert,
  Menu,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBluetooth,
  IconPrinter,
  IconX,
  IconAdjustments,
  IconCopy,
  IconCheck,
  IconInfoCircle,
  IconDeviceFloppy,
  IconRefresh,
  IconChevronDown,
} from "@tabler/icons-react";
import {
  getStatus,
  getPairedName,
  getPairedProfile,
  setCustomProfile,
  clearCustomProfile,
  pair,
  forget,
  isSupported,
  type PrinterStatus,
  type PairedPrinterProfile,
} from "@/lib/bluetooth-printer";
import { buildKotPayload } from "@/lib/ticket";

export function PrinterButton({ compact = false }: { compact?: boolean } = {}) {
  const [status, setStatus] = useState<PrinterStatus>("unsupported");
  const [name, setName] = useState<string | null>(null);
  const [profile, setProfile] = useState<PairedPrinterProfile | null>(null);
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [diagOpened, setDiagOpened] = useState(false);

  // Custom GATT inputs in modal
  const [customSvc, setCustomSvc] = useState("");
  const [customChar, setCustomChar] = useState("");

  const refreshState = () => {
    const s = getStatus();
    const p = getPairedProfile();
    setStatus(s);
    setName(getPairedName());
    setProfile(p);
    setCustomSvc(p.customServiceUuid || "");
    setCustomChar(p.customCharUuid || "");
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handlePair = async () => {
    setPairing(true);
    try {
      const deviceName = await pair();
      refreshState();
      notifications.show({
        title: "Printer connected successfully!",
        message: `${deviceName} is ready for automatic KOT & receipt printing.`,
        color: "green",
        icon: <IconBluetooth size={16} />,
      });
    } catch (err: any) {
      refreshState();
      if (!err.message?.includes("User cancelled") && !err.message?.includes("cancelled")) {
        notifications.show({
          title: "Pairing failed",
          message: err.message,
          color: "red",
          autoClose: 10000,
        });
      }
    } finally {
      setPairing(false);
    }
  };

  const handleForget = () => {
    forget();
    refreshState();
    notifications.show({ title: "Printer removed", message: "", color: "gray" });
  };

  const handleSaveCustom = () => {
    if (!customSvc.trim() || !customChar.trim()) {
      notifications.show({
        title: "Missing UUIDs",
        message: "Please enter both a Service UUID and a Characteristic UUID.",
        color: "red",
      });
      return;
    }
    setCustomProfile(customSvc.trim(), customChar.trim());
    refreshState();
    notifications.show({
      title: "Custom GATT profile saved",
      message: "Printer will prioritize these UUIDs during connections.",
      color: "teal",
      icon: <IconCheck size={16} />,
    });
  };

  const handleClearCustom = () => {
    clearCustomProfile();
    refreshState();
    notifications.show({
      title: "Custom profile cleared",
      message: "Reset to automatic GATT characteristic discovery.",
      color: "gray",
    });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const testPayload = buildKotPayload(
        {
          order: { orderNo: 101, tableNo: "T1", createdAt: new Date().toISOString(), subtotalPaise: 0 },
          items: [{ name: "Printer Test Item", qty: 1, pricePaiseSnapshot: 0 }],
        },
        { name: "Logix Dine", address: "Bluetooth Thermal Printer Test" }
      );
      testPayload.type = "KOT";

      const { print: blePrint, isPaired: isBLEPaired } = await import("@/lib/bluetooth-printer");
      if (isBLEPaired()) {
        const { encodeTicket } = await import("@/lib/escpos");
        const bytes = encodeTicket({ ...testPayload, restaurantName: "Logix Dine — Printer OK" });
        await blePrint(bytes);
        notifications.show({
          title: "Test ticket printed!",
          message: "Data successfully sent via Bluetooth.",
          color: "green",
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: "No printer paired",
          message: "Please pair a thermal printer before testing.",
          color: "orange",
        });
      }
    } catch (err: any) {
      notifications.show({
        title: "Test print failed",
        message: err.message,
        color: "red",
        autoClose: 10000,
      });
    } finally {
      setTesting(false);
    }
  };

  if (compact) {
    if (!isSupported()) {
      return (
        <Tooltip label="Web Bluetooth requires Google Chrome or Microsoft Edge" withArrow>
          <ActionIcon
            size={29}
            variant="subtle"
            color="gray"
            disabled
            radius="md"
            aria-label="Thermal Printer Unsupported"
            style={{ flexShrink: 0 }}
          >
            <IconPrinter size={17} />
          </ActionIcon>
        </Tooltip>
      );
    }
    return status === "paired" ? (
      <Menu shadow="md" width={220} position="bottom-end">
        <Menu.Target>
          <Tooltip label={`Thermal Printer: ${name || "Connected"}`} withArrow>
            <Indicator size={8} offset={2} color="green" withBorder processing>
              <ActionIcon
                size={29}
                variant="light"
                color="green"
                radius="md"
                aria-label={`Thermal Printer: ${name || "Connected"}`}
                style={{ flexShrink: 0 }}
              >
                <IconPrinter size={17} />
              </ActionIcon>
            </Indicator>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{name || "Thermal Printer Connected"}</Menu.Label>
          <Menu.Item leftSection={<IconPrinter size={14} />} onClick={handleTest} disabled={testing}>
            Test Print
          </Menu.Item>
          <Menu.Item leftSection={<IconBluetooth size={14} />} onClick={handlePair} disabled={pairing}>
            Pair Different Printer
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<IconX size={14} />} onClick={handleForget}>
            Disconnect Printer
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    ) : (
      <Tooltip label="Connect Thermal Printer" withArrow>
        <ActionIcon
          size={29}
          variant="light"
          color="orange"
          radius="md"
          loading={pairing}
          onClick={handlePair}
          aria-label="Connect Thermal Printer"
          style={{ flexShrink: 0 }}
        >
          <IconPrinter size={17} />
        </ActionIcon>
      </Tooltip>
    );
  }

  if (!isSupported()) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Browser Not Supported">
        <Text size="sm">
          Web Bluetooth is not supported in this browser. Please use <strong>Google Chrome</strong> or{" "}
          <strong>Microsoft Edge</strong> on Android, Windows, macOS, or Linux.
        </Text>
      </Alert>
    );
  }

  const hasDiagnostics = profile?.discoveredUuids && profile.discoveredUuids !== "{}";

  return (
    <>
      {status === "paired" ? (
        <Stack gap="xs">
          <Group gap="xs">
            <IconBluetooth size={18} color="var(--mantine-color-blue-6)" />
            <Text size="sm" fw={600}>
              {name || "Thermal Printer"}
            </Text>
            <Badge color="green" size="sm" variant="light">
              Connected
            </Badge>
            <Tooltip label="Remove printer">
              <ActionIcon variant="subtle" color="red" size="sm" onClick={handleForget}>
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {profile?.serviceUuid && profile?.charUuid && (
            <Text size="xs" c="dimmed">
              GATT Profile: Service{" "}
              <Code style={{ fontSize: 10 }}>{profile.serviceUuid.slice(0, 8)}...</Code> → Char{" "}
              <Code style={{ fontSize: 10 }}>{profile.charUuid.slice(0, 8)}...</Code>
            </Text>
          )}

          <Group gap="xs" mt={2}>
            <Button
              size="xs"
              variant="filled"
              color="dinePrimary"
              leftSection={<IconPrinter size={14} />}
              onClick={handleTest}
              loading={testing}
            >
              Test Print
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconAdjustments size={14} />}
              onClick={() => {
                refreshState();
                setDiagOpened(true);
              }}
            >
              Diagnostics
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="xs" align="flex-start">
          <Group gap="xs">
            <Button
              leftSection={<IconBluetooth size={16} />}
              loading={pairing}
              onClick={handlePair}
              color="dinePrimary"
              size="sm"
            >
              Pair Printer via Bluetooth
            </Button>
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              leftSection={<IconAdjustments size={16} />}
              onClick={() => {
                refreshState();
                setDiagOpened(true);
              }}
            >
              Diagnostics
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Supports standard ESC/POS 58mm &amp; 80mm Bluetooth printers (Xprinter, Everycom, TVS, NGX, POS-58, PT-210, etc.)
          </Text>
        </Stack>
      )}

      {/* Bluetooth Diagnostics & GATT Inspector Modal */}
      <Modal
        opened={diagOpened}
        onClose={() => setDiagOpened(false)}
        title={
          <Group gap="xs">
            <IconBluetooth size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={600}>Bluetooth Printer Diagnostics</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <Paper p="sm" withBorder radius="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={700} c="dimmed">
                  DEVICE STATUS
                </Text>
                <Badge size="xs" color={status === "paired" ? "green" : "gray"}>
                  {status === "paired" ? "PAIRED" : "NOT PAIRED"}
                </Badge>
              </Group>
              <Text size="sm">
                <strong>Device Name:</strong> {profile?.name || "None"}
              </Text>
              <Text size="sm">
                <strong>Device ID:</strong>{" "}
                <Code style={{ fontSize: 11 }}>{profile?.id || "None"}</Code>
              </Text>
              <Text size="sm">
                <strong>Active Service UUID:</strong>{" "}
                <Code style={{ fontSize: 11 }}>{profile?.serviceUuid || "None"}</Code>
              </Text>
              <Text size="sm">
                <strong>Active Write Characteristic:</strong>{" "}
                <Code style={{ fontSize: 11 }}>{profile?.charUuid || "None"}</Code>
              </Text>
            </Stack>
          </Paper>

          {/* Discovered GATT Services & Characteristics */}
          <Paper p="sm" withBorder radius="md">
            <Group justify="space-between" mb="xs">
              <div>
                <Text size="xs" fw={700} c="dimmed">
                  DISCOVERED GATT PROFILE
                </Text>
                <Text size="xs" c="dimmed">
                  Actual services and characteristics detected by browser
                </Text>
              </div>
              {hasDiagnostics && (
                <CopyButton value={profile?.discoveredUuids || ""}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="light"
                      color={copied ? "teal" : "gray"}
                      leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      onClick={copy}
                    >
                      {copied ? "Copied" : "Copy JSON"}
                    </Button>
                  )}
                </CopyButton>
              )}
            </Group>

            {hasDiagnostics ? (
              <ScrollArea.Autosize mah={180}>
                <Code block style={{ fontSize: 11, whiteHeight: "pre-wrap" }}>
                  {profile?.discoveredUuids}
                </Code>
              </ScrollArea.Autosize>
            ) : (
              <Text size="xs" c="dimmed" fs="italic">
                No GATT profile recorded yet. Click &quot;Pair Printer via Bluetooth&quot; to probe device.
              </Text>
            )}
          </Paper>

          {/* Custom GATT Override */}
          <Paper p="sm" withBorder radius="md">
            <Stack gap="xs">
              <Text size="xs" fw={700} c="dimmed">
                CUSTOM GATT UUID OVERRIDE (OPTIONAL)
              </Text>
              <Text size="xs" c="dimmed">
                If your printer uses a non-standard proprietary UUID, you can specify it here manually:
              </Text>
              <TextInput
                label="Custom Service UUID"
                placeholder="e.g. 0000ff00-0000-1000-8000-00805f9b34fb"
                value={customSvc}
                onChange={(e) => setCustomSvc(e.target.value)}
                size="xs"
              />
              <TextInput
                label="Custom Write Characteristic UUID"
                placeholder="e.g. 0000ff02-0000-1000-8000-00805f9b34fb"
                value={customChar}
                onChange={(e) => setCustomChar(e.target.value)}
                size="xs"
              />
              <Group justify="flex-end" gap="xs" mt="xs">
                {profile?.customServiceUuid && (
                  <Button size="xs" variant="subtle" color="red" onClick={handleClearCustom}>
                    Reset to Auto
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="light"
                  color="dinePrimary"
                  leftSection={<IconDeviceFloppy size={14} />}
                  onClick={handleSaveCustom}
                >
                  Save Override
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Divider />

          <Group justify="space-between">
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                color="dinePrimary"
                leftSection={<IconRefresh size={14} />}
                onClick={handlePair}
                loading={pairing}
              >
                Scan &amp; Pair Again
              </Button>
              {status === "paired" && (
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconPrinter size={14} />}
                  onClick={handleTest}
                  loading={testing}
                >
                  Test Print
                </Button>
              )}
            </Group>
            <Button size="xs" variant="default" onClick={() => setDiagOpened(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
