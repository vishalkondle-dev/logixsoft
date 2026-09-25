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
  IconMotorbike,
  IconShoppingBag,
  IconToolsKitchen2,
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

  const totalItemQty = order.items.reduce((acc, it) => acc + (Number(it.qty) || 1), 0);
  const itemsSubtotalPaise = order.items.reduce(
    (sum, it) => sum + (it.pricePaise || 0) * (it.qty || 1),
    0
  );
  const packagingChargePaise = order.packagingChargePaise || 0;
  const deliveryChargePaise = order.deliveryChargePaise || 0;

  // Compute standard 5% restaurant GST (CGST 2.5% + SGST 2.5%) on items subtotal
  const cgstPaise = Math.round(itemsSubtotalPaise * 0.025);
  const sgstPaise = Math.round(itemsSubtotalPaise * 0.025);
  const totalTaxPaise = cgstPaise + sgstPaise;
  const grandTotalPaise = itemsSubtotalPaise + packagingChargePaise + deliveryChargePaise + totalTaxPaise;

  const shareReceiptWhatsApp = () => {
    const itemsText = order.items
      .map((it) => {
        const variantText = it.variant?.name ? ` (${it.variant.name})` : "";
        const eachPriceText = it.qty > 1 ? ` (@ ₹${(it.pricePaise / 100).toFixed(2)} each)` : "";
        return `• ${it.name}${variantText} × ${it.qty} = ₹${((it.pricePaise * it.qty) / 100).toFixed(2)}${eachPriceText}`;
      })
      .join("\n");

    const isDelivery = order.orderType === "DELIVERY" || Boolean(order.delivery) || order.tableNo === "Delivery";
    const isTakeaway = (order.tableNo || "").toLowerCase() === "takeaway" || order.orderType === "TAKEAWAY";
    const restaurantName = order.restaurantName || order.outlet?.restaurantName || "Restaurant";
    const outletName = order.outletName || order.outlet?.name || "";
    const channelLabel = isDelivery ? "Direct Delivery" : isTakeaway ? "Takeaway" : `Table: ${order.tableNo}`;

    const chargesLines: string[] = [];
    chargesLines.push(`Items Subtotal: ${formatINR(itemsSubtotalPaise)}`);
    if (packagingChargePaise > 0) {
      chargesLines.push(`Packaging Fee: ${formatINR(packagingChargePaise)}`);
    }
    if (deliveryChargePaise > 0) {
      chargesLines.push(`Delivery Fee: ${formatINR(deliveryChargePaise)}`);
    }
    chargesLines.push(`CGST (2.5%): ${formatINR(cgstPaise)}`);
    chargesLines.push(`SGST (2.5%): ${formatINR(sgstPaise)}`);

    const message = `*Logix Dine Bill Summary*
*${restaurantName}*${outletName ? ` (${outletName})` : ""}
Token #${order.tokenNo || order.orderNo || "N/A"} | ${channelLabel}
--------------------------------
${itemsText}
--------------------------------
${chargesLines.join("\n")}
--------------------------------
*Estimated Total: ${formatINR(grandTotalPaise)}*
--------------------------------
Thank you for dining with us!`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const isDelivery = order.orderType === "DELIVERY" || Boolean(order.delivery) || order.tableNo === "Delivery";
  const isTakeaway = (order.tableNo || "").toLowerCase() === "takeaway" || order.orderType === "TAKEAWAY";
  const restaurantName = order.restaurantName || order.outlet?.restaurantName || "Restaurant";
  const outletName = order.outletName || order.outlet?.name || "";
  const channelTitle = isDelivery ? "Delivery" : isTakeaway ? "Takeaway" : `Table ${order.tableNo}`;

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
              {channelTitle} • Token #{order.tokenNo || order.orderNo || "—"}
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
                {restaurantName}
              </Text>
              {outletName && (
                <Text size="xs" c="dimmed">
                  {outletName} {order.outletAddress ? `• ${order.outletAddress}` : ""}
                </Text>
              )}
            </div>
            {isDelivery ? (
              <Badge color="teal" variant="light" leftSection={<IconMotorbike size={12} />}>
                Delivery
              </Badge>
            ) : isTakeaway ? (
              <Badge color="teal" variant="light" leftSection={<IconShoppingBag size={12} />}>
                Takeaway
              </Badge>
            ) : (
              <Badge color="violet" variant="light" leftSection={<IconToolsKitchen2 size={12} />}>
                Table: {order.tableNo}
              </Badge>
            )}
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
                    <div>
                      <Text size="xs" fw={600} lineClamp={2} style={{ lineHeight: 1.35 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            verticalAlign: "text-top",
                            marginRight: 6,
                          }}
                        >
                          <VegNonVegIcon isNonVeg={item.isNonVeg} size={13} />
                        </span>
                        {item.name}
                      </Text>
                      {item.variant?.name && !item.name.toLowerCase().includes(item.variant.name.toLowerCase()) && (
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
              Items Subtotal ({totalItemQty} {totalItemQty === 1 ? "item" : "items"})
            </Text>
            <Text size="xs" fw={600}>
              {formatINR(itemsSubtotalPaise)}
            </Text>
          </Group>
          {(order.packagingChargePaise || 0) > 0 && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Packaging Fee
              </Text>
              <Text size="xs" fw={500}>
                {formatINR(order.packagingChargePaise)}
              </Text>
            </Group>
          )}
          {(order.deliveryChargePaise || 0) > 0 && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Delivery Fee
              </Text>
              <Text size="xs" fw={500}>
                {formatINR(order.deliveryChargePaise)}
              </Text>
            </Group>
          )}
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
            {onRequestBill && !isDelivery && !isTakeaway && (
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
