import React, { useState } from "react";
import {
  Paper,
  Group,
  Text,
  Badge,
  Button,
  Stack,
  Progress,
  ThemeIcon,
  Collapse,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconShieldCheck,
  IconAlertTriangle,
  IconBolt,
  IconMoodSmile,
  IconMoodAngry,
  IconClock,
  IconSparkles,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconTarget,
} from "@tabler/icons-react";
import { ClefAnalysisResult, EmailMessage } from "../types";
import { api } from "../api";

interface ClefInspectionCardProps {
  message: EmailMessage;
  onApplyStrategy?: (suggestedTone: string, advice: string) => void;
}

export const ClefInspectionCard: React.FC<ClefInspectionCardProps> = ({
  message,
  onApplyStrategy,
}) => {
  const [analysis, setAnalysis] = useState<ClefAnalysisResult | null>(() => {
    if (message.clef_analysis) {
      try {
        return JSON.parse(message.clef_analysis);
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(true);

  const handleInspect = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await api.clefInspect({
        messageId: message.id,
        from: message.from_addr,
        to: message.to_addr,
        subject: message.subject,
        body: message.text_body || message.html_body?.replace(/<[^>]*>/g, "") || "",
        forceRefresh,
      });
      setAnalysis(res);
      setOpened(true);
    } catch (err) {
      console.error("Clef inspection failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getValidityColor = (category?: string) => {
    switch (category) {
      case "valid_human":
        return "teal";
      case "automated_transactional":
        return "blue";
      case "newsletter_promotional":
        return "violet";
      case "junk_cold_outreach":
        return "orange";
      case "phishing_scam":
        return "red";
      default:
        return "gray";
    }
  };

  const getToneColor = (tone?: string) => {
    switch (tone) {
      case "urgent_emergency":
        return "red";
      case "angry_escalated":
        return "grape";
      case "collaborative_friendly":
        return "teal";
      case "formal_business":
        return "cyan";
      case "threatening_coercive":
        return "red";
      case "skeptical_hesitant":
        return "yellow";
      default:
        return "gray";
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    if (sentiment === "positive") return <IconMoodSmile size={14} color="#0ca678" />;
    if (sentiment === "negative") return <IconMoodAngry size={14} color="#fa5252" />;
    return <IconClock size={14} color="#868e96" />;
  };

  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      mb="md"
      style={{
        background: "linear-gradient(135deg, rgba(12, 166, 120, 0.04) 0%, rgba(34, 139, 230, 0.04) 100%)",
        borderColor: analysis?.validity.category === "phishing_scam" ? "#ff8787" : "#63e6be",
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <ThemeIcon
            size="md"
            radius="md"
            variant="light"
            color={analysis?.validity.category === "phishing_scam" ? "red" : "teal"}
          >
            {analysis?.validity.category === "phishing_scam" ? (
              <IconAlertTriangle size={18} />
            ) : (
              <IconSparkles size={18} />
            )}
          </ThemeIcon>
          <div>
            <Group gap={6}>
              <Text fw={700} size="sm" c="dark.8">
                Clef-Flash Intelligence
              </Text>
              <Badge size="xs" variant="gradient" gradient={{ from: "teal", to: "cyan" }}>
                AI Decision Engine
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Deep emotional tone, validity, phishing risk & response strategy
            </Text>
          </div>
        </Group>

        <Group gap="xs">
          {!analysis ? (
            <Button
              size="xs"
              variant="filled"
              color="teal"
              loading={loading}
              onClick={() => handleInspect(false)}
              leftSection={<IconBolt size={14} />}
            >
              Analyze with Clef
            </Button>
          ) : (
            <>
              <Tooltip label="Re-scan with Clef-Flash">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  loading={loading}
                  onClick={() => handleInspect(true)}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => setOpened(!opened)}
              >
                {opened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              </ActionIcon>
            </>
          )}
        </Group>
      </Group>

      {analysis && (
        <Collapse expanded={opened}>
          <Stack gap="xs" mt="sm">
            {/* Top Row: Validity & Emotional Tone Badges */}
            <Group gap="sm" wrap="wrap">
              <Group gap={4}>
                <Text size="xs" fw={600} c="dimmed">
                  Validity:
                </Text>
                <Badge
                  color={getValidityColor(analysis.validity.category)}
                  variant="light"
                  size="sm"
                  leftSection={
                    analysis.validity.category === "phishing_scam" ? (
                      <IconAlertTriangle size={12} />
                    ) : (
                      <IconShieldCheck size={12} />
                    )
                  }
                >
                  {analysis.validity.label} ({analysis.validity.confidence}%)
                </Badge>
              </Group>

              <Group gap={4}>
                <Text size="xs" fw={600} c="dimmed">
                  Sender Tone:
                </Text>
                <Badge color={getToneColor(analysis.tone.primary)} variant="light" size="sm">
                  {analysis.tone.label}
                </Badge>
              </Group>

              <Group gap={4}>
                <Text size="xs" fw={600} c="dimmed">
                  Urgency:
                </Text>
                <Badge
                  color={analysis.urgency.level === "critical_same_day" ? "red" : "blue"}
                  variant="outline"
                  size="sm"
                >
                  {analysis.urgency.label}
                </Badge>
              </Group>

              <Group gap={4}>
                <Text size="xs" fw={600} c="dimmed">
                  Sentiment:
                </Text>
                <Badge color="gray" variant="subtle" size="sm" leftSection={getSentimentIcon(analysis.sentiment.type)}>
                  {analysis.sentiment.type.toUpperCase()}
                </Badge>
              </Group>
            </Group>

            {/* Confidence Bar for Category */}
            <div>
              <Group justify="space-between" mb={2}>
                <Text size="xs" c="dimmed">
                  Clef Authenticity Confidence
                </Text>
                <Text size="xs" fw={600} c={getValidityColor(analysis.validity.category)}>
                  {analysis.validity.confidence}% Match
                </Text>
              </Group>
              <Progress
                value={analysis.validity.confidence}
                color={getValidityColor(analysis.validity.category)}
                size="xs"
                radius="xl"
              />
            </div>

            {/* Recommended Action Box */}
            <Paper
              p="xs"
              radius="sm"
              style={{
                backgroundColor:
                  analysis.validity.category === "phishing_scam"
                    ? "#fff5f5"
                    : analysis.urgency.level === "critical_same_day"
                    ? "#fff9db"
                    : "#f4fcf9",
                border: "1px dashed",
                borderColor:
                  analysis.validity.category === "phishing_scam"
                    ? "#ffa8a8"
                    : analysis.urgency.level === "critical_same_day"
                    ? "#ffe066"
                    : "#96f2d7",
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="xs" align="flex-start">
                  <ThemeIcon size="sm" variant="transparent" color="teal">
                    <IconTarget size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" fw={700} c="dark.7">
                      Strategy: {analysis.recommendedAction.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {analysis.recommendedAction.advice}
                    </Text>
                  </div>
                </Group>

                {onApplyStrategy && analysis.validity.category !== "phishing_scam" && (
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="teal"
                    onClick={() =>
                      onApplyStrategy(
                        analysis.tone.primary === "angry_escalated"
                          ? "empathetic & de-escalating"
                          : analysis.tone.primary === "urgent_emergency"
                          ? "concise & prompt"
                          : "professional",
                        analysis.recommendedAction.advice
                      )
                    }
                  >
                    Reply with Strategy
                  </Button>
                )}
              </Group>
            </Paper>
          </Stack>
        </Collapse>
      )}
    </Paper>
  );
};
