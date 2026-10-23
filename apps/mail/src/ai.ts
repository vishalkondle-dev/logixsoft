export async function runAI(
  env: { AI?: any; CF_ACCOUNT_ID?: string; CF_API_TOKEN?: string },
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // 1. Try Workers AI native binding first
  if (env.AI && typeof env.AI.run === "function") {
    try {
      const result = await env.AI.run(model, { messages });
      const text = result?.response || result?.choices?.[0]?.message?.content || "";
      if (text) return text.trim();
    } catch (e: any) {
      console.warn("Workers AI binding error, attempting REST fallback:", e.message);
    }
  }

  // 2. Fallback to Cloudflare AI REST API
  if (env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/${model}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const data = (await response.json()) as any;
    if (data.success) {
      return (data.result?.response || data.result?.choices?.[0]?.message?.content || "").trim();
    }
  }

  throw new Error("Workers AI execution failed");
}

export async function summarizeEmail(
  env: any,
  subject: string,
  body: string
): Promise<string> {
  const prompt = `You are an executive email assistant. Summarize the following email in 1 or 2 concise, clear sentences. Focus on the core message and any actionable requests.

Subject: ${subject}
Content:
${body.slice(0, 3000)}`;

  return await runAI(env, "@cf/meta/llama-3.1-8b-instruct", [
    { role: "system", content: "You are a concise executive email summarizer. Output only the summary." },
    { role: "user", content: prompt },
  ]);
}

export async function generateQuickReplies(
  env: any,
  subject: string,
  body: string
): Promise<string[]> {
  const prompt = `Analyze this email and generate exactly 3 distinct, professional short reply options (max 10 words each) that the recipient could send back.
Return ONLY valid JSON array of 3 strings. Example format: ["Thanks, I will review this by tomorrow.", "Received, let me know if you need any info.", "Unfortunately I cannot make that time."]

Subject: ${subject}
Email Content:
${body.slice(0, 2000)}`;

  try {
    const raw = await runAI(env, "@cf/meta/llama-3.1-8b-instruct", [
      { role: "system", content: "You are an assistant that outputs strictly valid JSON arrays of strings." },
      { role: "user", content: prompt },
    ]);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback if model doesn't output strict JSON
  }

  return [
    "Thank you, I've received your email and will follow up shortly.",
    "Sounds good, let's proceed with this plan.",
    "Thanks for the update. Could you share more details?",
  ];
}

export function extractDisplayNameFromEmail(
  emailOrHeader: string,
  explicitDisplayName?: string
): { fullName: string; firstName: string; isGenericRole: boolean } {
  if (explicitDisplayName && explicitDisplayName.trim() && !explicitDisplayName.includes("@")) {
    const clean = explicitDisplayName.trim();
    const parts = clean.split(/\s+/);
    return { fullName: clean, firstName: parts[0], isGenericRole: false };
  }

  const str = (emailOrHeader || "").trim();
  if (!str) {
    return { fullName: "", firstName: "", isGenericRole: true };
  }

  // Handle format: "Jane Doe <jane@example.com>"
  const angleMatch = str.match(/^(?:["']?)(.*?)(?:["']?)\s*<([^>]+)>/);
  if (angleMatch && angleMatch[1].trim() && !angleMatch[1].includes("@")) {
    const name = angleMatch[1].trim().replace(/^["']|["']$/g, "");
    const parts = name.split(/\s+/);
    return { fullName: name, firstName: parts[0], isGenericRole: false };
  }

  const rawEmail = angleMatch ? angleMatch[2].trim() : str;
  const localPart = rawEmail.split("@")[0] || "";

  const roleMap: Record<string, string> = {
    admin: "LogixSoft Admin",
    administrator: "System Administrator",
    support: "Support Team",
    billing: "Billing Team",
    sales: "Sales Team",
    info: "LogixSoft Team",
    contact: "LogixSoft Team",
    help: "Support Team",
    hello: "LogixSoft Team",
    team: "The Team",
    hr: "HR Team",
    marketing: "Marketing Team",
    dev: "Engineering Team",
    engineering: "Engineering Team",
    finance: "Finance Team",
    legal: "Legal Team",
    operations: "Operations Team",
    noreply: "LogixSoft",
    no_reply: "LogixSoft",
  };

  const lowerLocal = localPart.toLowerCase();
  if (roleMap[lowerLocal]) {
    return { fullName: roleMap[lowerLocal], firstName: roleMap[lowerLocal], isGenericRole: true };
  }

  // Split name parts on dot, underscore, dash
  const cleanParts = localPart
    .split(/[._+-]+/)
    .filter((p) => p && !/^\d+$/.test(p))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());

  if (cleanParts.length >= 2) {
    const fullName = cleanParts.join(" ");
    return { fullName, firstName: cleanParts[0], isGenericRole: false };
  } else if (cleanParts.length === 1 && cleanParts[0].length > 1) {
    return { fullName: cleanParts[0], firstName: cleanParts[0], isGenericRole: false };
  }

  return { fullName: localPart, firstName: localPart, isGenericRole: false };
}

export async function draftEmailWithAI(
  env: any,
  prompt: string,
  tone: string = "professional",
  recipient: string = "",
  existingSubject: string = "",
  from: string = "",
  senderName: string = "",
  userRealName: string = ""
): Promise<{ subject: string; body: string }> {
  let resolvedSenderName = senderName || userRealName || "";
  if (!resolvedSenderName && from) {
    const extracted = extractDisplayNameFromEmail(from);
    resolvedSenderName = extracted.fullName;
  }
  if (!resolvedSenderName) {
    resolvedSenderName = "LogixSoft Team";
  }

  let recipientGreeting = "";
  let cleanRecipientName = "";
  if (recipient && recipient.trim()) {
    const recInfo = extractDisplayNameFromEmail(recipient);
    if (recInfo.isGenericRole) {
      cleanRecipientName = recInfo.fullName;
      recipientGreeting = `Dear ${recInfo.fullName},`;
    } else if (recInfo.firstName) {
      cleanRecipientName = recInfo.firstName;
      recipientGreeting = `Hi ${recInfo.firstName},`;
    } else {
      recipientGreeting = "Hello,";
    }
  } else {
    recipientGreeting = "Hello,";
  }

  let instruction = "";
  if (prompt && prompt.trim()) {
    instruction = `User Prompt/Instruction: "${prompt.trim()}"`;
    if (existingSubject && existingSubject.trim()) {
      instruction += `\nUser Subject: "${existingSubject.trim()}" (Write the body to align with this subject).`;
    }
  } else if (existingSubject && existingSubject.trim()) {
    instruction = `The user provided the email Subject: "${existingSubject.trim()}". Write a complete, relevant, and well-structured email body for this subject.`;
  } else {
    instruction = "Write a courteous follow-up email.";
  }

  const fullPrompt = `You are an expert email copywriter. Draft a ${tone} email according to this request:
${instruction}

Sender & Recipient Context:
- From / Sender Name: "${resolvedSenderName}"
${from ? `- Sender Email Address: "${from}"` : ""}
${recipient ? `- To / Recipient: "${recipient}"` : "- To / Recipient: Not specified"}
- Greeting to use: "${recipientGreeting}"

MANDATORY RULES (DO NOT VIOLATE):
1. ZERO PLACEHOLDERS: NEVER use brackets or template variables such as [Your Name], [Recipient's Name], [Company Name], [Your Position], [Insert Date], [Phone Number], etc.
2. GREETING: Open the email with "${recipientGreeting}". Do NOT write "[Recipient Name]" or "[Name]".
3. SIGN-OFF: Sign off the email using "${resolvedSenderName}"${from ? `\n${from}` : ""}. Do NOT write "[Your Name]" or "[Your Title]".
4. Ensure the entire email is fully written, natural, and ready to send immediately without the user having to fill in bracketed gaps.

Return the response in this exact format:
Subject: <Suggested Subject Line or echo the user's subject>

<Email Body text (greeting, body paragraphs, and sign-off)>`;

  const raw = await runAI(env, "@cf/meta/llama-3.1-8b-instruct", [
    {
      role: "system",
      content: `You are an executive email copywriter. You write polished, ready-to-send emails.
CRITICAL RULES:
- NEVER output placeholder brackets like [Your Name], [Your Title], [Recipient's Name], [Company Name], or [Date].
- Always sign off using the sender's actual name provided in the prompt ("${resolvedSenderName}").
- Always greet using the recipient name provided ("${recipientGreeting}").
- Output clean text without markdown code blocks, conversational remarks, or trailing explanations.`,
    },
    { role: "user", content: fullPrompt },
  ]);

  const subjectMatch = raw.match(/Subject:\s*(.*)/i);
  const subject =
    existingSubject && existingSubject.trim()
      ? existingSubject.trim()
      : subjectMatch
      ? subjectMatch[1].trim()
      : "Follow up";

  let body = raw.replace(/^Subject:\s*.*(\r?\n)+/im, "").trim();

  // Safety post-processing sanitizer:
  body = body.replace(/\[\s*(?:Your|Sender|My)?\s*Name\s*\]/gi, resolvedSenderName);
  if (cleanRecipientName) {
    body = body.replace(/\[\s*(?:Recipient|Client|Customer|Contact)(?:'s)?\s*Name\s*\]/gi, cleanRecipientName);
  } else {
    body = body.replace(/(?:Dear|Hi|Hello)\s*\[\s*(?:Recipient|Client|Customer|Contact)(?:'s)?\s*Name\s*\]/gi, "Hello");
    body = body.replace(/\[\s*(?:Recipient|Client|Customer|Contact)(?:'s)?\s*Name\s*\]/gi, "there");
  }
  body = body.replace(/\[\s*(?:Company\s*Name|Your\s*Company|Company|Organization)\s*\]/gi, env.DOMAIN || "LogixSoft");
  body = body.replace(/\[\s*(?:Your\s*)?(?:Title|Position|Role)\s*\]/gi, "");
  body = body.replace(/\[\s*(?:Insert|Add)\s+[^\]]+\]/gi, "");
  body = body.replace(/\[\s*\]/g, "");

  if (resolvedSenderName && !body.includes(resolvedSenderName)) {
    if (/(?:Best regards|Warm regards|Sincerely|Thanks|Thank you|Regards|Cheers),?\s*$/i.test(body)) {
      body = body + `\n${resolvedSenderName}`;
    }
  }

  body = body.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return { subject, body };
}

export interface AiSearchMatchResult {
  id: string;
  relevanceScore: number;
  reason: string;
}

export interface AiGlobalSearchResult {
  query: string;
  summary: string;
  matches: AiSearchMatchResult[];
}

export async function performAiGlobalSearch(
  env: any,
  query: string,
  candidates: Array<{
    id: string;
    from_addr: string;
    to_addr: string;
    subject: string;
    snippet?: string;
    text_body?: string;
    clef_analysis?: string;
    created_at: number;
  }>
): Promise<AiGlobalSearchResult> {
  if (!candidates || candidates.length === 0) {
    return {
      query,
      summary: "No candidate emails found to search across.",
      matches: [],
    };
  }

  const summaries = candidates
    .slice(0, 25)
    .map((c, i) => {
      let toneTag = "";
      if (c.clef_analysis) {
        try {
          const parsed = JSON.parse(c.clef_analysis);
          toneTag = `[Tone: ${parsed.tone?.label || ""}, Validity: ${parsed.validity?.label || ""}]`;
        } catch {}
      }
      const preview = (c.snippet || c.text_body || "").slice(0, 180).replace(/\s+/g, " ");
      return `Message #${i + 1}:
- ID: ${c.id}
- From: ${c.from_addr}
- Subject: "${c.subject || "(No Subject)"}"
- Metadata: ${toneTag}
- Content snippet: "${preview}"`;
    })
    .join("\n\n");

  const prompt = `You are an intelligent email search assistant. The user wants to search their inbox using natural language: "${query}".

Analyze the candidate emails below and find the most relevant matches:
${summaries}

Instructions:
1. Select the emails that logically, semantically, or sentimentally match the user's inquiry "${query}".
2. Rank the top matches by relevanceScore (1 to 100).
3. For each match, provide a 1-sentence reason explaining why it satisfies the query.
4. Write a concise executive synthesis "summary" (2-3 sentences max) answering the query and synthesizing the email contents.
5. Return ONLY a valid JSON object matching this exact schema:
{
  "summary": "<concise answer/synthesis for the user>",
  "matches": [
    {
      "id": "<exact email ID from candidate list>",
      "relevanceScore": <number 1-100>,
      "reason": "<one sentence explanation of why this matches>"
    }
  ]
}
If absolutely no candidates match, return: {"summary": "No matching emails found for this query.", "matches": []}`;

  try {
    const raw = await runAI(env, "@cf/meta/llama-3.1-8b-instruct", [
      {
        role: "system",
        content: "You are an intelligent email search analyzer. Output strictly valid JSON matching the schema.",
      },
      { role: "user", content: prompt },
    ]);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        query,
        summary: parsed.summary || "Search complete.",
        matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      };
    }
  } catch (err: any) {
    console.warn("AI global search parsing error:", err.message);
  }

  // Fallback if AI fails: simple keyword match ranking
  const lowerQ = query.toLowerCase();
  const fallbackMatches = candidates
    .filter((c) => {
      const text = `${c.subject} ${c.from_addr} ${c.snippet || ""}`.toLowerCase();
      return text.includes(lowerQ) || lowerQ.split(" ").some((w) => w.length > 3 && text.includes(w));
    })
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      relevanceScore: 80,
      reason: `Matches keyword criteria from "${c.subject}"`,
    }));

  return {
    query,
    summary:
      fallbackMatches.length > 0
        ? `Found ${fallbackMatches.length} emails relevant to "${query}".`
        : `No direct matches found for "${query}".`,
    matches: fallbackMatches,
  };
}

