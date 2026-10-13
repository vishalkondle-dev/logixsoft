/**
 * Bilingual Voice-to-KOT Natural Language Engine for Logix Dine
 * Intelligently parses Indian restaurant speech (Hinglish, Hindi, English)
 * into structured menu items, quantities, variants, cooking notes, and table numbers.
 */

export interface ParsedVoiceItem {
  id: string; // generated client ID
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
  variant?: { id: string; name: string; pricePaise: number };
  addons?: { id: string; name: string; pricePaise: number }[];
  note?: string;
  confidence: "exact" | "high" | "fuzzy";
  matchedPhrase: string;
}

export interface VoiceKotParseResult {
  rawText: string;
  detectedTable?: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  items: ParsedVoiceItem[];
  unmatchedPhrases: string[];
}

export interface MenuItemForVoice {
  id: string;
  name: string;
  pricePaise: number;
  variants?: Array<{ id: string; name: string; pricePaise: number }>;
  addons?: Array<{ id: string; name: string; pricePaise: number }>;
  categoryName?: string;
}

export interface TableForVoice {
  id: string;
  name: string;
}

// ─── Multilingual Pan-Indian Quantity Dictionary ───────────────────────────
const NUMBER_WORDS: Record<string, number> = {
  // English digits & words
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
  "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
  // Hindi & Urdu
  "ek": 1, "aik": 1, "ikk": 1,
  "do": 2, "doh": 2,
  "teen": 3, "tin": 3,
  "chaar": 4, "char": 4,
  "paanch": 5, "panch": 5,
  "chhe": 6, "che": 6, "chhah": 6,
  "saat": 7, "sat": 7,
  "aath": 8, "ath": 8,
  "nau": 9, "no": 9,
  "das": 10, "duss": 10,
  // Telugu (తెలుగు)
  "okati": 1, "okti": 1, "vokati": 1,
  "rendu": 2, "rend": 2,
  "moodu": 3, "mudu": 3,
  "naalugu": 4, "nalugu": 4,
  "aidu": 5, "ayidu": 5,
  "aaru": 6,
  "yedu": 7, "edu": 7,
  "enimidi": 8,
  "tommidi": 9,
  "padi": 10,
  // Tamil (தமிழ்)
  "onnu": 1, "ondru": 1,
  "moonu": 3, "moondru": 3,
  "naalu": 4, "naangu": 4,
  "anju": 5, "ainthu": 5,
  "ezhu": 7,
  "ettu": 8,
  "ombadhu": 9, "ombathu": 9,
  "pathu": 10,
  // Kannada (ಕನ್ನಡ)
  "ondu": 1,
  "eradu": 2,
  "mooru": 3,
  "naalku": 4, "nalku": 4,
  "eelu": 7,
  "entu": 8,
  "ombattu": 9,
  "hattu": 10,
  // Marathi (मराठी)
  "don": 2,
  "paach": 5,
  "saha": 6,
  "daha": 10,
  // Bengali (বাংলা)
  "dui": 2,
  "chhoy": 6,
  "aat": 8,
  "noy": 9,
  "dosh": 10,
  // Gujarati (ગુજરાતી)
  "be": 2,
  "tran": 3,
  "chha": 6,
  "nav": 9,
  // Malayalam (മലയാളം)
  "moonnu": 3,
  "anchu": 5,
  "onpathu": 9,
  // Punjabi (ਪੰਜਾਬੀ)
  "tinn": 3,
  "panj": 5,
  "satt": 7,
  "atth": 8,
  // Portions / portions counted as 1
  "single": 1, "double": 2,
};

// Modifiers / Notes Dictionary across Pan-Indian Languages
const COOKING_NOTE_PATTERNS: Array<{ regex: RegExp; note: string }> = [
  // No Onion
  { regex: /\b(bina\s+pyaaz(\s+ke)?|no\s+onion|without\s+onion|ulli\s+lekunda|vulli\s+lekunda|vengayam\s+(vendam|ilamal)|eerulli\s+beda|kanda\s+nako|peyaj\s+chara|dungli\s+vagar|ulli\s+venda)\b/gi, note: "No Onion" },
  // No Garlic
  { regex: /\b(bina\s+lehsun(\s+ke)?|bina\s+lahsun|no\s+garlic|without\s+garlic|vellulli\s+lekunda|poondu\s+vendam|bellulli\s+beda|lasun\s+nako|rosun\s+chara|lasan\s+vagar|veluthulli\s+venda)\b/gi, note: "No Garlic" },
  // Jain Preparation
  { regex: /\b(jain(\s+prep(aration)?)?)\b/gi, note: "Jain Prep (No Onion/Garlic)" },
  // Less Spicy
  { regex: /\b(kam\s+mirchi|kam\s+teekha|less\s+spicy|mild|thoda\s+kam\s+spicy|takkuva\s+kaaram|kaaram\s+takkuva|kaaram\s+(koraivaga|kammi)|khara\s+kammi|kami\s+teekhat|kom\s+jhal|ocho\s+teekho|erivu\s+kuravu)\b/gi, note: "Less Spicy" },
  // Extra Spicy
  { regex: /\b(zyada\s+teekha|jyada\s+spicy|extra\s+spicy|very\s+spicy|tez\s+mirchi|ekkuva\s+kaaram|kaaram\s+ekkuva|(romba|adhigam)\s+kaaram|jasti\s+khara|jast\s+teekhat|beshi\s+jhal|vadhu\s+teekho|kooduthal\s+erivu)\b/gi, note: "Extra Spicy" },
  // Extra Cheese
  { regex: /\b(extra\s+cheese|zyada\s+cheese|jyada\s+cheese|ekkuva\s+cheese|jasti\s+cheese)\b/gi, note: "Extra Cheese" },
  // Less Sugar
  { regex: /\b(kam\s+cheeni|kam\s+meetha|less\s+sugar|takkuva\s+sugar|kammi\s+sugar)\b/gi, note: "Less Sugar" },
  // No Sugar
  { regex: /\b(bina\s+cheeni|without\s+sugar|sugar\s+free|no\s+sugar|chekkera\s+lekunda|sugar\s+lekunda|sakkarai\s+vendam|sakkare\s+beda)\b/gi, note: "No Sugar" },
  // No Ice
  { regex: /\b(bina\s+barf|without\s+ice|no\s+ice|ice\s+lekunda|ice\s+vendam|ice\s+beda|ice\s+nako)\b/gi, note: "No Ice" },
  // Serve Hot
  { regex: /\b(garam|piping\s+hot|very\s+hot|vedi|bisi)\b/gi, note: "Serve Hot" },
  // Make Crispy
  { regex: /\b(crispy|karara|kurkura|well\s+done|moru\s+moru)\b/gi, note: "Make Crispy" },
  // Dry
  { regex: /\b(dry|sukha)\b/gi, note: "Dry" },
  // With Gravy
  { regex: /\b(gravy|with\s+gravy|saaru|jhol)\b/gi, note: "With Gravy" },
];

/**
 * Levenshtein distance for fuzzy menu matching
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

/**
 * Calculates similarity ratio between 0 and 1.
 */
function similarityScore(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

/**
 * Clean & normalize a spoken phrase
 */
function cleanPhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[,\.\?!;:_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects Table number or Order Channel from speech
 */
function extractTableAndChannel(
  text: string,
  availableTables: TableForVoice[]
): { table?: string; orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY"; cleanedText: string } {
  let cleaned = text;
  let detectedTable: string | undefined = undefined;
  let orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY" = "DINE_IN";

  // Check Takeaway / Parcel / Packing
  if (/\b(takeaway|take\s+away|parcel|packing|to\s+go)\b/i.test(cleaned)) {
    orderType = "TAKEAWAY";
    cleaned = cleaned.replace(/\b(takeaway|take\s+away|parcel|packing|to\s+go)\b/gi, "");
  } else if (/\b(delivery|home\s+delivery)\b/i.test(cleaned)) {
    orderType = "DELIVERY";
    cleaned = cleaned.replace(/\b(delivery|home\s+delivery)\b/gi, "");
  }

  // If Takeaway or Delivery, skip table number matching
  if (orderType !== "DINE_IN") {
    return { table: undefined, orderType, cleanedText: cleaned.trim() };
  }

  // 1. First check if speech directly mentions any available table name (e.g. "Lounge 1", "Rooftop 2", "Table 4")
  for (const tbl of availableTables) {
    const cleanTbl = cleanPhrase(tbl.name);
    if (cleanTbl.length > 1) {
      // Escape special characters for regex
      const escaped = cleanTbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const tblRegex = new RegExp(`\\b${escaped}\\b`, "i");
      if (tblRegex.test(cleaned)) {
        detectedTable = tbl.name;
        cleaned = cleaned.replace(tblRegex, "");
        return { table: detectedTable, orderType, cleanedText: cleaned.trim() };
      }
    }
  }

  // 2. Generic Table patterns:
  // a. "Table 4", "Table no 4", "Table chaar", "Tbl 2"
  // b. Short forms: "T4", "T-4", "T 4" (digits only)
  const fullTableRegex = /\b(table|tbl)\s*(?:no|number)?\s*([0-9]{1,3}|[a-z]{1,10})\b/i;
  const shortTRegex = /\bt[\s\-_]*([0-9]{1,3})\b/i;

  const fullMatch = cleaned.match(fullTableRegex);
  const shortMatch = !fullMatch ? cleaned.match(shortTRegex) : null;
  const match = fullMatch || shortMatch;

  if (match) {
    const rawVal = (fullMatch ? match[2] : match[1]).toLowerCase();
    const isDigits = /^\d+$/.test(rawVal);
    const numericFromWord = NUMBER_WORDS[rawVal];
    const tableIdentifier = isDigits ? rawVal : numericFromWord !== undefined ? String(numericFromWord) : rawVal;

    // Only accept if numeric, in NUMBER_WORDS, or matches an actual table in availableTables
    const matchedTableObj = availableTables.find((t) => {
      const tClean = cleanPhrase(t.name);
      return (
        tClean === tableIdentifier ||
        tClean.replace(/^table\s*/i, "") === tableIdentifier ||
        t.name.toLowerCase() === `table ${tableIdentifier}` ||
        t.name.toLowerCase() === `t${tableIdentifier}` ||
        t.name.toLowerCase() === `t-${tableIdentifier}`
      );
    });

    if (matchedTableObj) {
      detectedTable = matchedTableObj.name;
      cleaned = cleaned.replace(match[0], "");
    } else if (isDigits || numericFromWord !== undefined) {
      detectedTable = `Table ${tableIdentifier.toUpperCase()}`;
      cleaned = cleaned.replace(match[0], "");
    }
  }

  return { table: detectedTable, orderType, cleanedText: cleaned.trim() };
}

/**
 * Extracts global or item-level cooking notes from phrase
 */
function extractCookingNotes(text: string): { notes: string[]; remainingText: string } {
  const notes: string[] = [];
  let remaining = text;

  for (const item of COOKING_NOTE_PATTERNS) {
    if (item.regex.test(remaining)) {
      notes.push(item.note);
      remaining = remaining.replace(item.regex, " ");
    }
  }

  return {
    notes,
    remainingText: remaining.replace(/\s+/g, " ").trim(),
  };
}

/**
 * Tokenizes speech into candidate item chunks using commas, Indian conjunctions, and connectors:
 * ",", "aur", "and", "plus", "ke saath", "bhi"
 */
function splitIntoItemSegments(text: string): string[] {
  // Normalize punctuation and conjunctions to delimiter '|'
  const normalized = text
    .replace(/[,;]/g, "|")
    .replace(/\b(aur\s+bhi|aur|and|plus|\+)\b/gi, "|")
    .replace(/\b(ke\s+saath|saath\s+mein)\b/gi, "|");

  return normalized
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extracts quantity from the beginning or end of a segment:
 * e.g. "do butter naan" -> qty: 2, item: "butter naan"
 * e.g. "butter naan do" -> qty: 2, item: "butter naan"
 * e.g. "3 cappuccino" -> qty: 3, item: "cappuccino"
 */
function extractQuantityAndItemText(segment: string): { qty: number; text: string; portion?: "half" | "full" } {
  let clean = cleanPhrase(segment);
  let portion: "half" | "full" | undefined;

  // Check for portion words
  if (/\b(half|aadha|adha)\b/i.test(clean)) {
    portion = "half";
    clean = clean.replace(/\b(half|aadha|adha)\b/gi, " ").trim();
  } else if (/\b(full|pura)\b/i.test(clean)) {
    portion = "full";
    clean = clean.replace(/\b(full|pura)\b/gi, " ").trim();
  }

  // Remove filler words
  clean = clean.replace(/\b(plate|portion|glass|cup|bottle|piece|order|banao|kar\s+do|de\s+do|lao|chahiye)\b/gi, " ").replace(/\s+/g, " ").trim();

  const words = clean.split(" ");
  let qty = 1;

  // Check leading word for number (e.g. "do butter naan", "2 butter naan")
  if (words.length > 1 && NUMBER_WORDS[words[0]] !== undefined) {
    qty = NUMBER_WORDS[words[0]];
    words.shift();
    return { qty, text: words.join(" "), portion };
  }

  // Check trailing word for number (e.g. "butter naan do", "cold coffee 2")
  if (words.length > 1 && NUMBER_WORDS[words[words.length - 1]] !== undefined) {
    qty = NUMBER_WORDS[words[words.length - 1]];
    words.pop();
    return { qty, text: words.join(" "), portion };
  }

  // Check if first word is digits (e.g. "2x butter naan", "2pcs butter naan")
  const leadingNumMatch = words[0]?.match(/^(\d+)(x|pcs|pc)?$/i);
  if (leadingNumMatch) {
    qty = parseInt(leadingNumMatch[1], 10);
    words.shift();
    return { qty, text: words.join(" "), portion };
  }

  return { qty, text: words.join(" "), portion };
}

/**
 * Matches candidate item text against menu catalog using exact, substring, and fuzzy matching.
 */
function findBestMenuItemMatch(
  queryText: string,
  portion: "half" | "full" | undefined,
  menuItems: MenuItemForVoice[]
): {
  item: MenuItemForVoice;
  variant?: { id: string; name: string; pricePaise: number };
  confidence: "exact" | "high" | "fuzzy";
  score: number;
} | null {
  const cleanQuery = cleanPhrase(queryText);
  if (!cleanQuery) return null;

  let bestMatch: {
    item: MenuItemForVoice;
    variant?: { id: string; name: string; pricePaise: number };
    confidence: "exact" | "high" | "fuzzy";
    score: number;
  } | null = null;

  for (const item of menuItems) {
    const cleanItemName = cleanPhrase(item.name);

    // 1. Exact Name Match
    if (cleanQuery === cleanItemName) {
      let matchedVariant = undefined;
      if (portion && item.variants && item.variants.length > 0) {
        matchedVariant = item.variants.find((v) => cleanPhrase(v.name).includes(portion));
      }
      return { item, variant: matchedVariant, confidence: "exact", score: 1.0 };
    }

    // 2. Substring or Containment Match (e.g. "paneer butter" matches "Paneer Butter Masala")
    if (cleanItemName.includes(cleanQuery) || cleanQuery.includes(cleanItemName)) {
      const score = Math.min(cleanQuery.length, cleanItemName.length) / Math.max(cleanQuery.length, cleanItemName.length);
      if (score > (bestMatch?.score || 0)) {
        let matchedVariant = undefined;
        if (portion && item.variants && item.variants.length > 0) {
          matchedVariant = item.variants.find((v) => cleanPhrase(v.name).includes(portion));
        }
        bestMatch = { item, variant: matchedVariant, confidence: "high", score: Math.max(0.85, score) };
      }
    }

    // 3. Word Token Overlap & Fuzzy Token Match
    const queryTokens = cleanQuery.split(" ").filter((w) => w.length > 1);
    const itemTokens = cleanItemName.split(" ").filter((w) => w.length > 1);

    if (queryTokens.length > 0 && itemTokens.length > 0) {
      let matchedWeight = 0;
      for (const qt of queryTokens) {
        let bestTokenSim = 0;
        for (const it of itemTokens) {
          if (it === qt || it.includes(qt) || qt.includes(it)) {
            bestTokenSim = Math.max(bestTokenSim, 1.0);
          } else {
            const sim = similarityScore(qt, it);
            if (sim >= 0.75) {
              bestTokenSim = Math.max(bestTokenSim, sim);
            }
          }
        }
        matchedWeight += bestTokenSim;
      }

      // How much of the user query was satisfied by this item?
      const queryCoverage = matchedWeight / queryTokens.length;

      if (queryCoverage >= 0.75 && queryCoverage > (bestMatch?.score || 0)) {
        let matchedVariant = undefined;
        if (portion && item.variants && item.variants.length > 0) {
          matchedVariant = item.variants.find((v) => cleanPhrase(v.name).includes(portion));
        }
        bestMatch = { item, variant: matchedVariant, confidence: queryCoverage >= 0.95 ? "high" : "fuzzy", score: queryCoverage };
      }
    }

    // 4. Full String Fuzzy Levenshtein Match (for typos / minor speech engine misspellings)
    const fuzzyRatio = similarityScore(cleanQuery, cleanItemName);
    if (fuzzyRatio >= 0.70 && fuzzyRatio > (bestMatch?.score || 0)) {
      let matchedVariant = undefined;
      if (portion && item.variants && item.variants.length > 0) {
        matchedVariant = item.variants.find((v) => cleanPhrase(v.name).includes(portion));
      }
      bestMatch = { item, variant: matchedVariant, confidence: "fuzzy", score: fuzzyRatio };
    }
  }

  return bestMatch;
}

/**
 * Main Bilingual Voice-to-KOT Parser
 */
export function parseVoiceKot(
  rawSpeech: string,
  menuItems: MenuItemForVoice[],
  availableTables: TableForVoice[] = []
): VoiceKotParseResult {
  if (!rawSpeech || !rawSpeech.trim()) {
    return {
      rawText: "",
      orderType: "DINE_IN",
      items: [],
      unmatchedPhrases: [],
    };
  }

  const rawText = rawSpeech.trim();

  // 1. Detect Table and Order Channel
  const { table, orderType, cleanedText: textAfterTable } = extractTableAndChannel(rawText, availableTables);

  // 2. Split into candidate item segments by commas and conjunctions
  const segments = splitIntoItemSegments(textAfterTable);

  const matchedItems: ParsedVoiceItem[] = [];
  const unmatchedPhrases: string[] = [];

  for (const segment of segments) {
    if (!segment.trim()) continue;

    // Extract cooking notes specific to this segment
    const { notes: segNotes, remainingText: segAfterNotes } = extractCookingNotes(segment);

    // Extract quantity and candidate item name
    const { qty, text: candidateItemText, portion } = extractQuantityAndItemText(segAfterNotes);

    if (!candidateItemText.trim()) {
      if (segNotes.length > 0 && matchedItems.length > 0) {
        // Attach note to preceding item
        const prevNote = matchedItems[matchedItems.length - 1].note;
        matchedItems[matchedItems.length - 1].note = prevNote ? `${prevNote}, ${segNotes.join(", ")}` : segNotes.join(", ");
      }
      continue;
    }

    // Find best match in menu catalog
    const match = findBestMenuItemMatch(candidateItemText, portion, menuItems);

    if (match) {
      const unitPrice = match.variant ? match.variant.pricePaise : match.item.pricePaise;
      matchedItems.push({
        id: `vitem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemId: match.item.id,
        name: match.item.name,
        pricePaise: unitPrice,
        qty: Math.max(1, qty),
        variant: match.variant,
        addons: [],
        note: segNotes.length > 0 ? segNotes.join(", ") : undefined,
        confidence: match.confidence,
        matchedPhrase: candidateItemText,
      });
    } else {
      unmatchedPhrases.push(segment.trim());
    }
  }

  return {
    rawText,
    detectedTable: table,
    orderType,
    items: matchedItems,
    unmatchedPhrases,
  };
}
