"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Modal,
  Group,
  Stack,
  Text,
  Button,
  Badge,
  ActionIcon,
  Paper,
  Box,
  Textarea,
  Select,
  ThemeIcon,
  Tooltip,
  Alert,
  Divider,
  NumberInput,
  TextInput,
  SegmentedControl,
} from "@mantine/core";
import {
  IconMicrophone,
  IconPlayerStop,
  IconSparkles,
  IconToolsKitchen2,
  IconShoppingCart,
  IconTrash,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconPlus,
  IconMinus,
  IconVolume,
  IconEdit,
} from "@tabler/icons-react";
import {
  parseVoiceKot,
  type VoiceKotParseResult,
  type ParsedVoiceItem,
  type MenuItemForVoice,
  type TableForVoice,
} from "@/lib/voice-kot-parser";

interface VoiceKotModalProps {
  opened: boolean;
  onClose: () => void;
  menuItems: any[];
  tables: any[];
  currentTableNo: string;
  onApplyToCart: (data: {
    items: Array<{
      itemId: string;
      name: string;
      pricePaise: number;
      qty: number;
      note?: string;
      variant?: { id: string; name: string; pricePaise: number };
      addons?: Array<{ id: string; name: string; pricePaise: number }>;
    }>;
    tableNo?: string;
    orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
    directSendKot?: boolean;
  }) => void;
}

export function VoiceKotModal({
  opened,
  onClose,
  menuItems,
  tables,
  currentTableNo,
  onApplyToCart,
}: VoiceKotModalProps) {
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lang, setLang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [speechSupported, setSpeechSupported] = useState(true);

  // Parsed Order Staging
  const [stagedItems, setStagedItems] = useState<ParsedVoiceItem[]>([]);
  const [stagedTable, setStagedTable] = useState<string>(currentTableNo || "Takeaway");
  const [stagedOrderType, setStagedOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [unmatchedPhrases, setUnmatchedPhrases] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEditVal, setNoteEditVal] = useState("");

  const recognitionRef = useRef<any>(null);

  // Normalize menu items for parser
  const voiceMenuCatalog: MenuItemForVoice[] = useMemo(() => {
    return (menuItems || []).map((m) => ({
      id: m.id,
      name: m.name,
      pricePaise: m.pricePaise || 0,
      variants: Array.isArray(m.variants)
        ? m.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            pricePaise: v.pricePaise || m.pricePaise,
          }))
        : undefined,
      addons: Array.isArray(m.addons)
        ? m.addons.map((a: any) => ({
            id: a.id,
            name: a.name,
            pricePaise: a.pricePaise || 0,
          }))
        : undefined,
      categoryName: m.category?.name,
    }));
  }, [menuItems]);

  const voiceTables: TableForVoice[] = useMemo(() => {
    return (tables || []).map((t) => ({ id: t.id, name: t.name }));
  }, [tables]);

  // Check speech recognition capability
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Set initial table when modal opens
  useEffect(() => {
    if (opened) {
      if (currentTableNo) {
        setStagedTable(currentTableNo);
      }
    } else {
      stopListening();
    }
  }, [opened, currentTableNo]);

  // Start or Stop Speech Recognition
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalStr += res[0].transcript + " ";
          } else {
            interimStr += res[0].transcript;
          }
        }

        if (finalStr) {
          setTranscript((prev) => {
            const updated = (prev + " " + finalStr).trim();
            handleParseSpeech(updated);
            return updated;
          });
        }
        setInterimTranscript(interimStr);
      };

      rec.onerror = (event: any) => {
        console.warn("[Voice-KOT] Recognition error:", event.error);
        if (event.error !== "no-speech") {
          setIsListening(false);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("[Voice-KOT] Failed to start recognition:", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript("");
  };

  // Run the natural language parser on speech
  const handleParseSpeech = (text: string) => {
    if (!text.trim()) return;

    const result: VoiceKotParseResult = parseVoiceKot(text, voiceMenuCatalog, voiceTables);

    if (result.detectedTable) {
      setStagedTable(result.detectedTable);
    }
    setStagedOrderType(result.orderType);
    setStagedItems(result.items);
    setUnmatchedPhrases(result.unmatchedPhrases);
  };

  // Adjust item quantity in stage
  const handleUpdateQty = (itemId: string, delta: number) => {
    setStagedItems((prev) =>
      prev
        .map((item) => {
          if (item.id === itemId) {
            const nextQty = Math.max(1, item.qty + delta);
            return { ...item, qty: nextQty };
          }
          return item;
        })
        .filter((item) => item.qty > 0)
    );
  };

  // Remove item from stage
  const handleRemoveItem = (itemId: string) => {
    setStagedItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Update item note
  const handleSaveNote = (itemId: string) => {
    setStagedItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, note: noteEditVal.trim() || undefined } : i))
    );
    setEditingNoteId(null);
    setNoteEditVal("");
  };

  // Clear everything
  const handleClearAll = () => {
    stopListening();
    setTranscript("");
    setInterimTranscript("");
    setStagedItems([]);
    setUnmatchedPhrases([]);
  };

  // Add staged items to POS Cart
  const handleApply = (directSendKot = false) => {
    if (stagedItems.length === 0) return;

    onApplyToCart({
      items: stagedItems.map((i) => ({
        itemId: i.itemId,
        name: i.name,
        pricePaise: i.pricePaise,
        qty: i.qty,
        note: i.note,
        variant: i.variant,
        addons: i.addons,
      })),
      tableNo: stagedOrderType === "TAKEAWAY" ? "Takeaway" : stagedTable,
      orderType: stagedOrderType,
      directSendKot,
    });

    handleClearAll();
    onClose();
  };

  // Calculate staged total
  const stagedSubtotal = stagedItems.reduce((sum, item) => sum + item.pricePaise * item.qty, 0);

  return (
    <Modal
      opened={opened}
      onClose={() => {
        stopListening();
        onClose();
      }}
      size="lg"
      radius="lg"
      title={
        <Group gap="xs" align="center">
          <ThemeIcon size={34} radius="md" color="violet" variant="gradient" gradient={{ from: "violet", to: "indigo" }}>
            <IconMicrophone size={18} />
          </ThemeIcon>
          <div>
            <Group gap={6} align="center">
              <Text fw={700} size="md">
                Voice-to-KOT Assistant
              </Text>
              <Badge color="violet" variant="light" size="xs">
                Bilingual AI
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Speak naturally in Hinglish, Hindi, or English (e.g. &ldquo;Table 4 do butter naan, ek paneer butter masala bina pyaaz ke&rdquo;)
            </Text>
          </div>
        </Group>
      }
      styles={{
        header: {
          borderBottom: "1px solid var(--mantine-color-default-border)",
          paddingBottom: "12px",
        },
      }}
    >
      <Stack gap="md" pt="xs">
        {/* Language Selection & Status */}
        <Group justify="space-between" align="center">
          <SegmentedControl
            size="xs"
            radius="md"
            value={lang}
            onChange={(val) => {
              setLang(val as "en-IN" | "hi-IN");
              if (isListening) {
                stopListening();
              }
            }}
            data={[
              { label: "Hinglish / Indian English (en-IN)", value: "en-IN" },
              { label: "Hindi / हिन्दी (hi-IN)", value: "hi-IN" },
            ]}
          />

          <Badge
            color={isListening ? "red" : "gray"}
            variant="dot"
            size="sm"
            styles={{ root: { textTransform: "none" } }}
          >
            {isListening ? "Listening live..." : "Mic Idle"}
          </Badge>
        </Group>

        {/* Microphone Pulse Card */}
        <Paper
          p="lg"
          radius="md"
          withBorder
          style={{
            background: isListening
              ? "radial-gradient(circle at center, rgba(239, 68, 68, 0.12) 0%, rgba(243, 244, 246, 0.4) 100%)"
              : "rgba(249, 250, 251, 0.7)",
            borderColor: isListening ? "rgba(239, 68, 68, 0.4)" : undefined,
            textAlign: "center",
            transition: "all 0.3s ease",
          }}
        >
          <Stack align="center" gap="xs">
            <ActionIcon
              size={68}
              radius="xl"
              color={isListening ? "red" : "violet"}
              variant="filled"
              onClick={toggleListening}
              style={{
                boxShadow: isListening
                  ? "0 0 0 10px rgba(239, 68, 68, 0.2), 0 0 0 20px rgba(239, 68, 68, 0.1)"
                  : "0 4px 14px rgba(124, 58, 237, 0.3)",
                transform: isListening ? "scale(1.05)" : "scale(1)",
                transition: "all 0.2s ease",
              }}
            >
              {isListening ? <IconPlayerStop size={28} /> : <IconMicrophone size={28} />}
            </ActionIcon>

            <Text fw={700} size="sm" c={isListening ? "red" : "dark"}>
              {isListening ? "Tap to Stop Listening" : "Tap Microphone to Speak Order"}
            </Text>

            <Text size="xs" c="dimmed">
              Supports quantities (ek, do, teen, 4), items, portions (half/full), and notes (bina pyaaz, less spicy, extra cheese).
            </Text>
          </Stack>
        </Paper>

        {!speechSupported && (
          <Alert color="orange" icon={<IconAlertCircle size={16} />}>
            Web speech recognition is not supported in this browser. You can type or paste the order speech text in the box below.
          </Alert>
        )}

        {/* Live Speech Transcript Box */}
        <Box>
          <Group justify="space-between" align="center" mb={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Live Speech Transcript
            </Text>
            {transcript && (
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                leftSection={<IconRefresh size={12} />}
                onClick={handleClearAll}
              >
                Clear Speech
              </Button>
            )}
          </Group>

          <Textarea
            placeholder='Or type speech here, e.g. "Table 4 do butter naan, ek paneer butter masala bina pyaaz ke, aur 2 coke"'
            value={transcript + (interimTranscript ? ` (${interimTranscript})` : "")}
            onChange={(e) => {
              const val = e.currentTarget.value;
              setTranscript(val);
              handleParseSpeech(val);
            }}
            rows={2}
            autosize
            minRows={2}
            maxRows={4}
            radius="md"
          />
        </Box>

        {/* Unmatched Phrases Warning */}
        {unmatchedPhrases.length > 0 && (
          <Alert color="yellow" variant="light" py="xs" icon={<IconAlertCircle size={16} />}>
            <Text size="xs">
              <b>Unmatched phrase(s):</b> {unmatchedPhrases.join(", ")}. Please verify if these dishes exist in the menu.
            </Text>
          </Alert>
        )}

        {/* Parsed Staged Order Overview */}
        {stagedItems.length > 0 && (
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#fbfcfe" }}>
            <Stack gap="sm">
              {/* Header: Table & Channel */}
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs" align="center">
                  <Badge color="violet" size="md" variant="filled">
                    {stagedOrderType === "TAKEAWAY"
                      ? "Takeaway / Parcel"
                      : stagedOrderType === "DELIVERY"
                      ? "Delivery"
                      : stagedTable || "Table 1"}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {stagedItems.length} item(s) recognized
                  </Text>
                </Group>

                <Group gap="xs" align="center">
                  {stagedOrderType === "DINE_IN" && (
                    <Select
                      size="xs"
                      w={130}
                      placeholder="Select Table"
                      data={voiceTables.map((t) => ({ value: t.name, label: t.name }))}
                      value={stagedTable}
                      onChange={(v) => v && setStagedTable(v)}
                    />
                  )}
                  <Text fw={700} size="sm" c="teal">
                    ₹{(stagedSubtotal / 100).toFixed(2)}
                  </Text>
                </Group>
              </Group>

              <Divider />

              {/* Items List */}
              <Stack gap={8}>
                {stagedItems.map((item) => (
                  <Paper
                    key={item.id}
                    p="xs"
                    radius="sm"
                    withBorder
                    style={{ backgroundColor: "#ffffff" }}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={6} align="center" wrap="nowrap">
                          <Text fw={600} size="sm" lineClamp={1}>
                            {item.name}
                          </Text>
                          {item.variant && (
                            <Badge size="xs" color="blue" variant="light">
                              {item.variant.name}
                            </Badge>
                          )}
                          <Badge
                            size="xs"
                            color={item.confidence === "exact" ? "teal" : item.confidence === "high" ? "blue" : "yellow"}
                            variant="dot"
                          >
                            {item.confidence}
                          </Badge>
                        </Group>

                        {/* Cooking Note */}
                        {editingNoteId === item.id ? (
                          <Group gap={4} mt={4} wrap="nowrap">
                            <TextInput
                              size="xs"
                              placeholder="e.g. No Onion, Less Spicy"
                              value={noteEditVal}
                              onChange={(e) => setNoteEditVal(e.currentTarget.value)}
                              style={{ flex: 1 }}
                            />
                            <ActionIcon
                              size="sm"
                              color="teal"
                              variant="light"
                              onClick={() => handleSaveNote(item.id)}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Group>
                        ) : (
                          item.note && (
                            <Group gap={4} mt={2} align="center">
                              <Badge size="xs" color="orange" variant="light">
                                Note: {item.note}
                              </Badge>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="gray"
                                onClick={() => {
                                  setEditingNoteId(item.id);
                                  setNoteEditVal(item.note || "");
                                }}
                              >
                                <IconEdit size={12} />
                              </ActionIcon>
                            </Group>
                          )
                        )}
                      </Box>

                      {/* Quantity Stepper & Price */}
                      <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
                        <Group gap={4} align="center">
                          <ActionIcon
                            size="sm"
                            variant="default"
                            onClick={() => handleUpdateQty(item.id, -1)}
                          >
                            <IconMinus size={12} />
                          </ActionIcon>
                          <Text fw={700} size="sm" w={22} ta="center">
                            {item.qty}
                          </Text>
                          <ActionIcon
                            size="sm"
                            variant="default"
                            onClick={() => handleUpdateQty(item.id, 1)}
                          >
                            <IconPlus size={12} />
                          </ActionIcon>
                        </Group>

                        <Text fw={700} size="sm" w={65} ta="right">
                          ₹{((item.pricePaise * item.qty) / 100).toFixed(2)}
                        </Text>

                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}

        {/* Action Buttons */}
        <Group justify="space-between" align="center" pt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>

          <Group gap="xs">
            <Button
              color="teal"
              variant="light"
              leftSection={<IconShoppingCart size={16} />}
              disabled={stagedItems.length === 0}
              onClick={() => handleApply(false)}
            >
              Add to Cart ({stagedItems.length})
            </Button>

            <Button
              color="violet"
              leftSection={<IconToolsKitchen2 size={16} />}
              disabled={stagedItems.length === 0}
              onClick={() => handleApply(true)}
            >
              Add &amp; Punch KOT
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
