export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  avatar_url?: string | null;
  status_message?: string | null;
  bio?: string | null;
  signature?: string | null;
  sound_enabled?: number;
}

export interface Label {
  id: string;
  user_id?: string | null;
  name: string;
  color: string;
  created_at: number;
  message_count?: number;
}

export interface Alias {
  id: string;
  address: string;
  displayName: string;
  isPrimary?: boolean;
}

export interface EmailMessage {
  id: string;
  user_id: string;
  direction: "inbound" | "outbound";
  from_addr: string;
  to_addr: string;
  cc_addr?: string;
  bcc_addr?: string;
  subject: string;
  snippet?: string;
  status: string;
  created_at: number;
  read: number;
  starred: number;
  in_reply_to?: string;
  text_body?: string;
  html_body?: string;
  spam_verdict?: string;
  clef_analysis?: string;
  labels?: Label[];
}

export interface ClefAnalysisResult {
  validity: {
    category:
      | "valid_human"
      | "automated_transactional"
      | "junk_cold_outreach"
      | "phishing_scam"
      | "newsletter_promotional";
    label: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  tone: {
    primary:
      | "urgent_emergency"
      | "angry_escalated"
      | "collaborative_friendly"
      | "formal_business"
      | "threatening_coercive"
      | "skeptical_hesitant"
      | "promotional_sales";
    label: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  sentiment: {
    type: "positive" | "neutral" | "negative";
    confidence: number;
  };
  urgency: {
    level: "critical_same_day" | "moderate" | "low_or_none";
    label: string;
    confidence: number;
  };
  recommendedAction: {
    action:
      | "reply_urgently"
      | "deescalate_with_care"
      | "review_and_file"
      | "ignore_or_junk"
      | "block_or_report_phishing";
    label: string;
    advice: string;
  };
  inspectedAt: number;
}

export interface ClefToneCheckResult {
  overallTone:
    | "professional_diplomatic"
    | "friendly_engaging"
    | "overly_blunt_harsh"
    | "passive_aggressive"
    | "confusing_unclear"
    | "inappropriately_casual";
  label: string;
  confidence: number;
  isSafeToSend: boolean;
  advice: string;
  suggestions?: string[];
}

export interface Attachment {
  id: string;
  message_id: string;
  filename: string;
  mime_type?: string;
  content_type?: string;
  size_bytes?: number;
  size?: number;
  r2_key?: string;
}

export interface AiSearchMatch {
  id: string;
  relevanceScore: number;
  reason: string;
  message?: EmailMessage;
}

export interface AiGlobalSearchResult {
  query: string;
  summary: string;
  matches: AiSearchMatch[];
}
