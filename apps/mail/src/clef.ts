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

export async function runClefFlash(
  env: { AI?: any; CF_ACCOUNT_ID?: string; CF_API_TOKEN?: string },
  state: string,
  questions: Record<string, any>
): Promise<any> {
  // 1. Try Workers AI native binding first
  if (env.AI && typeof env.AI.run === "function") {
    try {
      const res = await env.AI.run("@cf/cloudflare/clef-flash", {
        model: "clef-flash",
        state,
        questions,
      });
      if (res && (res.answers || res.result?.answers)) {
        return res.answers || res.result?.answers;
      }
    } catch (e: any) {
      console.warn("Clef-Flash Workers AI binding error, trying REST API:", e.message);
    }
  }

  // 2. Fallback to Cloudflare AI REST API
  if (env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/@cf/cloudflare/clef-flash`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "clef-flash",
        state,
        questions,
      }),
    });

    const data = (await res.json()) as any;
    if (data.success && data.result?.answers) {
      return data.result.answers;
    }
    throw new Error(data.errors?.[0]?.message || "Clef-Flash API execution failed");
  }

  throw new Error("No AI binding or API credentials available for Clef-Flash");
}

export async function inspectEmailWithClef(
  env: any,
  email: {
    from: string;
    to: string;
    subject: string;
    body: string;
  }
): Promise<ClefAnalysisResult> {
  const compactState = `From: ${email.from}\nTo: ${email.to}\nSubject: ${email.subject}\nBody:\n${email.body.slice(0, 2500)}`;

  const questions = {
    validity: {
      type: "choice",
      instructions: "Determine the validity, authenticity, and classification of this email",
      criteria: {
        valid_human: "Genuine personal or real-world business correspondence between people",
        automated_transactional: "Legitimate automated notification (order, receipt, password, invoice, security alert)",
        newsletter_promotional: "Marketing email, subscribed newsletter, product update, or blog digest",
        junk_cold_outreach: "Unsolicited cold sales solicitation, mass outreach, or commercial pitch",
        phishing_scam: "Fraudulent attempt to steal credentials, fake urgent account suspension, impersonation, or dangerous scam",
      },
    },
    tone: {
      type: "choice",
      instructions: "Detect the sender's primary emotional and psychological tone",
      criteria: {
        urgent_emergency: "Critical time-sensitive situation requiring rapid action or emergency fix",
        angry_escalated: "Frustrated, displeased, complaining, or demanding escalation/cancellation",
        collaborative_friendly: "Helpful, appreciative, warm, polite, and constructive",
        formal_business: "Standard professional, executive, or contractual matter-of-fact tone",
        threatening_coercive: "Coercive urgency, intimidation, artificial penalty, or threatening lock-out",
        skeptical_hesitant: "Expressing doubts, objections, price hesitation, or uncertainty",
        promotional_sales: "Sales pitch or advertising product features",
      },
    },
    sentiment: {
      type: "choice",
      instructions: "Overall sentiment of the message",
      criteria: {
        positive: "Optimistic, satisfied, complimentary, or pleased",
        neutral: "Informational and objective",
        negative: "Dissatisfied, critical, disappointed, or hostile",
      },
    },
    urgency: {
      type: "choice",
      instructions: "Required speed of attention or reply",
      criteria: {
        critical_same_day: "Requires immediate attention today",
        moderate: "Standard response needed within 1-2 business days",
        low_or_none: "Fyi or informational, no urgent reply needed",
      },
    },
    recommended_action: {
      type: "choice",
      instructions: "Optimal next action for recipient",
      criteria: {
        reply_urgently: "Respond promptly with direct answers or actions",
        deescalate_with_care: "Acknowledge frustration, apologize if needed, and offer direct resolution",
        review_and_file: "Read and archive or file for records",
        ignore_or_junk: "Low-value solicitation, safe to ignore or mark junk",
        block_or_report_phishing: "Dangerous threat, do not click links, mark phishing",
      },
    },
  };

  const answers = await runClefFlash(env, compactState, questions);

  const valChoice = answers.validity?.choice || "valid_human";
  const toneChoice = answers.tone?.choice || "formal_business";
  const sentChoice = answers.sentiment?.choice || "neutral";
  const urgChoice = answers.urgency?.choice || "moderate";
  const actChoice = answers.recommended_action?.choice || "review_and_file";

  const validityLabels: Record<string, string> = {
    valid_human: "Valid Human Email",
    automated_transactional: "Transactional Notification",
    newsletter_promotional: "Newsletter / Promo",
    junk_cold_outreach: "Junk / Cold Outreach",
    phishing_scam: "⚠️ High Phishing Risk",
  };

  const toneLabels: Record<string, string> = {
    urgent_emergency: "🚨 Urgent / Emergency",
    angry_escalated: "😡 Frustrated / Escalated",
    collaborative_friendly: "🤝 Friendly / Collaborative",
    formal_business: "💼 Formal / Executive",
    threatening_coercive: "⚠️ Coercive / Threatening",
    skeptical_hesitant: "🤔 Skeptical / Hesitant",
    promotional_sales: "📢 Sales / Pitch",
  };

  const urgencyLabels: Record<string, string> = {
    critical_same_day: "High Urgency (Today)",
    moderate: "Normal Urgency (1-2 Days)",
    low_or_none: "Low / Informational",
  };

  const actionAdviceMap: Record<string, { label: string; advice: string }> = {
    reply_urgently: {
      label: "Reply Promptly",
      advice: "This email has time-sensitive requests. Provide a fast acknowledgment or ETA.",
    },
    deescalate_with_care: {
      label: "De-escalate with Empathy",
      advice: "Sender is unhappy or frustrated. Acknowledge their concern directly and outline immediate steps.",
    },
    review_and_file: {
      label: "Review & Archive",
      advice: "Standard informational message. Read at your convenience and file away.",
    },
    ignore_or_junk: {
      label: "Ignore or Move to Junk",
      advice: "Automated or cold solicitation detected. Safe to ignore or move to Junk.",
    },
    block_or_report_phishing: {
      label: "Do Not Click Any Links",
      advice: "High probability of credential harvesting or spoofed sender. Mark as Phishing.",
    },
  };

  return {
    validity: {
      category: valChoice,
      label: validityLabels[valChoice] || valChoice,
      confidence: Math.round((answers.validity?.confidence || 0.8) * 100),
      probabilities: answers.validity?.probabilities || {},
    },
    tone: {
      primary: toneChoice,
      label: toneLabels[toneChoice] || toneChoice,
      confidence: Math.round((answers.tone?.confidence || 0.8) * 100),
      probabilities: answers.tone?.probabilities || {},
    },
    sentiment: {
      type: sentChoice,
      confidence: Math.round((answers.sentiment?.confidence || 0.8) * 100),
    },
    urgency: {
      level: urgChoice,
      label: urgencyLabels[urgChoice] || urgChoice,
      confidence: Math.round((answers.urgency?.confidence || 0.8) * 100),
    },
    recommendedAction: {
      action: actChoice,
      label: actionAdviceMap[actChoice]?.label || actChoice,
      advice: actionAdviceMap[actChoice]?.advice || "Review and reply if appropriate.",
    },
    inspectedAt: Math.floor(Date.now() / 1000),
  };
}

export async function checkOutgoingToneWithClef(
  env: any,
  draft: {
    subject: string;
    body: string;
    recipient?: string;
  }
): Promise<ClefToneCheckResult> {
  const compactState = `Recipient: ${draft.recipient || "Not specified"}\nSubject: ${draft.subject}\nDraft Body:\n${draft.body.slice(0, 2000)}`;

  const questions = {
    tone: {
      type: "choice",
      instructions: "Analyze the tone and professionalism of this outgoing draft",
      criteria: {
        professional_diplomatic: "Well-calibrated, polite, executive, and clear",
        friendly_engaging: "Warm, personable, and approachable",
        overly_blunt_harsh: "Could sound demanding, curt, overly direct, or unintentionally rude",
        passive_aggressive: "Subtle resentment, sarcasm, or defensive phrasing",
        confusing_unclear: "Vague, hard to follow, or rambling",
        inappropriately_casual: "Too informal for serious business correspondence",
      },
    },
    safe_to_send: {
      type: "choice",
      instructions: "Is this draft ready and safe to send without risking bad impressions?",
      criteria: {
        yes: "Ready to send safely",
        needs_softening: "Needs slight softening or clarification before sending",
      },
    },
  };

  const answers = await runClefFlash(env, compactState, questions);

  const tone = answers.tone?.choice || "professional_diplomatic";
  const isSafe = answers.safe_to_send?.choice === "yes";

  const toneLabels: Record<string, string> = {
    professional_diplomatic: "Professional & Diplomatic",
    friendly_engaging: "Warm & Engaging",
    overly_blunt_harsh: "Blunt / Curt",
    passive_aggressive: "Passive-Aggressive phrasing detected",
    confusing_unclear: "Unclear or Ambiguous",
    inappropriately_casual: "Overly Casual",
  };

  const adviceMap: Record<string, string> = {
    professional_diplomatic: "Your message sounds polished, respectful, and clear. Ready to send!",
    friendly_engaging: "Your message has a warm, collaborative tone that will build good rapport.",
    overly_blunt_harsh: "Consider softening the opening or closing to avoid sounding confrontational.",
    passive_aggressive: "Phrases like 'as previously noted' or 'per my last email' can seem defensive. Consider rephrasing more directly.",
    confusing_unclear: "The core request might be buried. Add a crisp bullet point or clear call to action.",
    inappropriately_casual: "If communicating with an external client or executive, consider a slightly more formal opening.",
  };

  return {
    overallTone: tone,
    label: toneLabels[tone] || tone,
    confidence: Math.round((answers.tone?.confidence || 0.85) * 100),
    isSafeToSend: isSafe,
    advice: adviceMap[tone] || "Review draft before sending.",
  };
}
