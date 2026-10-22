import { CONFIG } from "./config";

export async function runWorkersAI(model: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/ai/run/${model}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  const data = (await response.json()) as any;
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || "Workers AI execution failed");
  }

  return (
    data.result?.response ||
    data.result?.choices?.[0]?.message?.content ||
    ""
  ).trim();
}

export async function summarizeEmail(subject: string, body: string): Promise<string> {
  const prompt = `You are an executive email assistant. Summarize the following email in 1 or 2 concise, clear sentences. Focus on the core message and any actionable requests.

Subject: ${subject}
Content:
${body.slice(0, 3000)}`;

  return await runWorkersAI("@cf/meta/llama-3.1-8b-instruct", [
    { role: "system", content: "You are a concise executive email summarizer. Output only the summary." },
    { role: "user", content: prompt },
  ]);
}

export async function generateQuickReplies(subject: string, body: string): Promise<string[]> {
  const prompt = `Analyze this email and generate exactly 3 distinct, professional short reply options (max 10 words each) that the recipient could send back.
Return ONLY valid JSON array of 3 strings. Example format: ["Thanks, I will review this by tomorrow.", "Received, let me know if you need any info.", "Unfortunately I cannot make that time."]

Subject: ${subject}
Email Content:
${body.slice(0, 2000)}`;

  try {
    const raw = await runWorkersAI("@cf/meta/llama-3.1-8b-instruct", [
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

export async function draftEmailWithAI(prompt: string, tone = "professional", recipient = ""): Promise<{ subject: string; body: string }> {
  const fullPrompt = `Draft a ${tone} email based on this instruction:
"${prompt}"
${recipient ? `Recipient: ${recipient}` : ""}

Return the response in this exact format:
Subject: <Suggested Subject Line>

<Email Body text>`;

  const raw = await runWorkersAI("@cf/meta/llama-3.1-8b-instruct", [
    { role: "system", content: `You are an expert email copywriter. Write a clean, well-formatted, ${tone} email.` },
    { role: "user", content: fullPrompt },
  ]);

  const subjectMatch = raw.match(/Subject:\s*(.*)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : "Follow up";
  const body = raw.replace(/Subject:\s*.*(\r?\n)+/i, "").trim();

  return { subject, body };
}
