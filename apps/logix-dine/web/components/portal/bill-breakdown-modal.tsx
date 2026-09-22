"use client";

import React from "react";
import {
  Modal,
  Text,
  Title,
  Button,
  Group,
  Stack,
  Divider,
  Paper,
  Badge,
  Table,
  Box,
} from "@mantine/core";
import {
  IconReceipt,
  IconBrandWhatsapp,
  IconBellRinging,
  IconNotes,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import type { CustomerPortalOrder } from "@/lib/api-client";

interface BillBreakdownModalProps {
  opened: boolean;
  onClose: () => void;
  order: CustomerPortalOrder | null;
  onRequestBill?: () => void;
}

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BillBreakdownModal({
  opened,
  onClose,
  order,
  onRequestBill,
}: BillBreakdownModalProps) {
  if (!order) return null;

  const subtotalPaise = order.subtotalPaise || 0;
  // Compute standard 5% restaurant GST (CGST 2.5% + SGST 2.5%)
  const cgstPaise = Math.round(subtotalPaise * 0.025);
  const sgstPaise = Math.round(subtotalPaise * 0.025);
  const totalTaxPaise = cgstPaise + sgstPaise;
  const grandTotalPaise = subtotalPaise + totalTaxPaise;

  const shareReceiptWhatsApp = () => {
    const itemsText = order.items
      .map(
        (it) =>
          `• ${it.name} × ${it.qty} = ₹${((it.pricePaise * it.qty) / 100).toFixed(2)}`
      )
      .join("\n");

    const message = `🧾 *Logix Dine Bill Summary*
🍽️ *${order.restaurantName}* (${order.outletName})
🎫 Token #${order.tokenNo || "N/A"} | Table: ${order.tableNo}
--------------------------------
${itemsText}
--------------------------------
Subtotal: ${formatINR(subtotalPaise)}
CGST (2.5%): ${formatINR(cgstPaise)}
SGST (2.5%): ${formatINR(sgstPaise)}
*Estimated Total: ${formatINR(grandTotalPaise)}*
--------------------------------
Thank you for dining with us!`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconReceipt size={22} color="#af73d7" />
          <div>
            <Title order={4} style={{ fontSize: 16, fontWeight: 700 }}>
              Running Bill & Tax Breakdown
            </Title>
            <Text size="xs" c="dimmed">
              Table {order.tableNo} • Token #{order.tokenNo || "—"}
            </Text>
          </div>
        </Group>
      }
      centered
      radius="md"
      padding="md"
      size="lg"
    >
      <Stack gap="sm">
        <Paper p="xs" radius="md" withBorder style={{ backgroundColor: "#f8f9fa" }}>
          <Group justify="space-between" align="center">
            <div>
              <Text fw={700} size="sm">
                {order.restaurantName}
              </Text>
              <Text size="xs" c="dimmed">
                {order.outletName} {order.outletAddress ? `• ${order.outletAddress}` : ""}
              </Text>
            </div>
            <Badge color="violet" variant="light">
              Table: {order.tableNo}
            </Badge>
          </Group>
        </Paper>

        {/* Order Note / Special Instructions */}
        {order.note && (
          <Paper
            p="xs"
            radius="sm"
            style={{
              backgroundColor: "rgba(175, 115, 215, 0.08)",
              border: "1px dashed #af73d7",
            }}
          >
            <Group gap={6} align="flex-start" wrap="nowrap">
              <IconNotes size={14} color="#af73d7" style={{ marginTop: 2, flexShrink: 0 }} />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={700} c="violet.9">
                  Order Instructions:
                </Text>
                <Text size="xs" c="dark.4" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {order.note}
                </Text>
              </Box>
            </Group>
          </Paper>
        )}

        {/* Itemized Table */}
        <Box style={{ maxHeight: 260, overflowY: "auto" }}>
          <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ fontSize: 12 }}>Item</Table.Th>
                <Table.Th style={{ fontSize: 12, textAlign: "center" }}>Qty</Table.Th>
                <Table.Th style={{ fontSize: 12, textAlign: "right" }}>Price</Table.Th>
                <Table.Th style={{ fontSize: 12, textAlign: "right" }}>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {order.items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Group gap={6} align="flex-start" wrap="nowrap">
                      <Box style={{ flexShrink: 0, marginTop: 4 }}>
                        <VegNonVegIcon isNonVeg={item.isNonVeg} size={13} />
                      </Box>
                      <div>
                        <Text size="xs" fw={600} lineClamp={1}>
                          {item.name}
                        </Text>
                        {item.variant?.name && (
                          <Badge size="xs" variant="outline" color="gray">
                            {item.variant.name}
                          </Badge>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <Text size="10px" c="dimmed">
                            +{item.addons.map((a: any) => a.name).join(", ")}
                          </Text>
                        )}
                        {item.note && (
                          <Text size="10px" fw={600} c="yellow.9" style={{ fontStyle: "italic" }}>
                            Note: {item.note}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "center", fontSize: 12, fontWeight: 600 }}>
                    {item.qty}
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right", fontSize: 12 }}>
                    {formatINR(item.pricePaise)}
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right", fontSize: 12, fontWeight: 700 }}>
                    {formatINR(item.pricePaise * item.qty)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        <Divider />

        {/* Totals & Tax Calculation */}
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Items Subtotal ({order.itemsCount} items)
            </Text>
            <Text size="xs" fw={600}>
              {formatINR(subtotalPaise)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              CGST (2.5%)
            </Text>
            <Text size="xs" fw={500}>
              {formatINR(cgstPaise)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              SGST (2.5%)
            </Text>
            <Text size="xs" fw={500}>
              {formatINR(sgstPaise)}
            </Text>
          </Group>
          <Divider my={4} />
          <Group justify="space-between">
            <Text fw={700} size="sm">
              Estimated Total (Incl. Taxes)
            </Text>
            <Text fw={800} size="md" style={{ color: "#af73d7" }}>
              {formatINR(grandTotalPaise)}
            </Text>
          </Group>
          <Text size="10px" c="dimmed" style={{ fontStyle: "italic" }}>
            *Final bill at the billing counter may include outlet discounts or service charges.
          </Text>
        </Stack>

        <Group justify="space-between" mt="sm" wrap="wrap" gap="xs">
          <Button
            variant="light"
            color="teal"
            size="xs"
            leftSection={<IconBrandWhatsapp size={14} />}
            onClick={shareReceiptWhatsApp}
          >
            Share Bill
          </Button>

          <Group gap="xs">
            {onRequestBill && (
              <Button
                variant="filled"
                color="orange"
                size="xs"
                leftSection={<IconBellRinging size={14} />}
                onClick={() => {
                  onClose();
                  onRequestBill();
                }}
              >
                Request Bill at Table
              </Button>
            )}
            <Button variant="default" size="xs" onClick={onClose}>
              Close
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
