import { Account, CategoryItem, TransactionType } from "../../types/finance";
import { AIConfig } from "./types";
import { sendAIChatRequest } from "./client";

export interface ParsedTransactionFields {
  type: TransactionType;
  payee: string;
  amount?: number;
  category?: string;
  account?: string;
  toAccount?: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  confidence: number;
  matchedFields: string[];
}

export interface ParserContext {
  accounts: Account[];
  categories?: CategoryItem[];
  currencySymbol?: string;
  aiConfig?: AIConfig;
}

/**
 * Standard keyword mappings to common personal finance categories
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Dining Out": [
    "dinner",
    "lunch",
    "breakfast",
    "brunch",
    "coffee",
    "cafe",
    "starbucks",
    "dunkin",
    "burger",
    "pizza",
    "restaurant",
    "bar",
    "drinks",
    "food",
    "swiggy",
    "zomato",
    "ubereats",
    "doordash",
    "takeout",
    "snack",
    "bakery",
  ],
  Groceries: [
    "groceries",
    "grocery",
    "supermarket",
    "walmart",
    "target",
    "whole foods",
    "trader joe",
    "costco",
    "aldi",
    "market",
    "milk",
    "produce",
    "vegetables",
    "fruits",
    "bread",
    "eggs",
  ],
  Transportation: [
    "uber",
    "lyft",
    "cab",
    "taxi",
    "gas",
    "petrol",
    "diesel",
    "fuel",
    "subway",
    "metro",
    "bus",
    "train",
    "transit",
    "parking",
    "toll",
    "auto",
    "flight",
    "airline",
  ],
  Utilities: [
    "electric",
    "electricity",
    "power",
    "water bill",
    "gas bill",
    "utility",
    "utilities",
    "internet",
    "wifi",
    "broadband",
    "phone",
    "mobile",
    "recharge",
    "trash",
    "sewer",
  ],
  Entertainment: [
    "movie",
    "cinema",
    "theatre",
    "netflix",
    "spotify",
    "hulu",
    "disney",
    "hbo",
    "steam",
    "game",
    "gaming",
    "concert",
    "ticket",
    "show",
    "bowling",
    "amusement",
    "event",
  ],
  Healthcare: [
    "doctor",
    "dentist",
    "clinic",
    "hospital",
    "pharmacy",
    "medicine",
    "pills",
    "prescription",
    "gym",
    "fitness",
    "workout",
    "yoga",
    "therapy",
    "optometry",
    "glasses",
  ],
  Shopping: [
    "amazon",
    "ebay",
    "clothes",
    "clothing",
    "shoes",
    "apparel",
    "electronics",
    "gadgets",
    "shopping",
    "mall",
    "store",
    "furniture",
    "ikea",
    "home depot",
    "best buy",
  ],
  Housing: [
    "rent",
    "mortgage",
    "lease",
    "property tax",
    "hoa",
    "home insurance",
    "maintenance",
    "plumber",
    "repairs",
    "carpenter",
  ],
  Travel: [
    "hotel",
    "motel",
    "airbnb",
    "hostel",
    "resort",
    "vacation",
    "trip",
    "booking",
    "expedia",
  ],
  Salary: [
    "salary",
    "paycheck",
    "payroll",
    "wages",
    "stipend",
    "bonus",
    "commission",
  ],
  Investments: [
    "dividend",
    "interest",
    "stock",
    "stocks",
    "crypto",
    "etf",
    "shares",
    "capital gain",
    "yield",
  ],
};

/**
 * Format a Date object to YYYY-MM-DD
 */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Deterministic, instant local rule-based NLP parser
 */
export function parseLocalNaturalLanguage(
  input: string,
  context: ParserContext
): ParsedTransactionFields {
  const original = input.trim();
  let text = original.toLowerCase();

  const matchedFields: string[] = [];
  let confidence = 0.5;

  // 1. Transaction Type Detection
  let type: TransactionType = "expense";
  if (
    text.includes("transfer") ||
    text.includes("move") ||
    text.includes("moved") ||
    text.includes("sent to my") ||
    text.includes("transfer to")
  ) {
    type = "transfer";
    matchedFields.push("type");
    confidence += 0.15;
  } else if (
    text.includes("salary") ||
    text.includes("paycheck") ||
    text.includes("dividend") ||
    text.includes("earned") ||
    text.includes("received") ||
    text.includes("got paid") ||
    text.includes("income") ||
    text.includes("refund")
  ) {
    type = "income";
    matchedFields.push("type");
    confidence += 0.15;
  }

  // 2. Amount Extraction
  // Look for currency symbols: $, ₹, €, £, or words: dollars, bucks, rs, inr
  let amount: number | undefined;
  const amountPatterns = [
    /(?:[\$₹€£¥]\s*|\brs\.?\s*|\binr\s*)([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:[\$₹€£¥]|dollars?|bucks?|rs\.?|inr|eur|gbp)/i,
    /(?:for|at|of|cost|amounting\s+to|spending)\s+([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /\b([0-9]+(?:\.[0-9]{1,2}))\b/,
    /\b([0-9]+)\b/,
  ];

  for (const pat of amountPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/,/g, "");
      const val = parseFloat(cleanNum);
      if (!isNaN(val) && val > 0 && val < 100000000) {
        amount = val;
        matchedFields.push("amount");
        confidence += 0.25;
        // Remove amount from text to avoid interfering with payee extraction
        text = text.replace(match[0], " ");
        break;
      }
    }
  }

  // 3. Date Detection
  let dateStr = formatDate(new Date());
  const now = new Date();

  if (text.includes("day before yesterday")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    dateStr = formatDate(d);
    matchedFields.push("date");
    text = text.replace("day before yesterday", " ");
  } else if (text.includes("yesterday")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    dateStr = formatDate(d);
    matchedFields.push("date");
    text = text.replace("yesterday", " ");
  } else if (text.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    dateStr = formatDate(d);
    matchedFields.push("date");
    text = text.replace("tomorrow", " ");
  } else if (text.includes("today")) {
    dateStr = formatDate(now);
    matchedFields.push("date");
    text = text.replace("today", " ");
  } else {
    // Check specific dates like "oct 12", "12 oct", "2026-10-12"
    const isoMatch = text.match(/\b(20\d{2}[-/][01]\d[-/][0-3]\d)\b/);
    if (isoMatch) {
      dateStr = isoMatch[1].replace(/\//g, "-");
      matchedFields.push("date");
      text = text.replace(isoMatch[0], " ");
    } else {
      const monthNames = [
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
      ];
      const monthRegex = new RegExp(
        `(?:\\bon\\s+)?(${monthNames.join("|")})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
        "i"
      );
      const mMatch = text.match(monthRegex);
      if (mMatch) {
        const mIdx = monthNames.indexOf(mMatch[1].toLowerCase().slice(0, 3));
        const day = parseInt(mMatch[2], 10);
        if (mIdx >= 0 && day >= 1 && day <= 31) {
          const d = new Date(now.getFullYear(), mIdx, day);
          dateStr = formatDate(d);
          matchedFields.push("date");
          text = text.replace(mMatch[0], " ");
        }
      }
    }
  }

  // 4. Account Matching
  let matchedAccount: string | undefined;
  let matchedToAccount: string | undefined;

  if (context.accounts && context.accounts.length > 0) {
    // Check transfer accounts (e.g. "from Chase to Savings")
    if (type === "transfer") {
      for (const acc of context.accounts) {
        const accLower = acc.name.toLowerCase();
        if (new RegExp(`(?:from)\\s+${accLower}\\b`, "i").test(text)) {
          matchedAccount = acc.name;
          text = text.replace(new RegExp(`(?:from)\\s+${accLower}\\b`, "i"), " ");
        }
        if (new RegExp(`(?:to)\\s+${accLower}\\b`, "i").test(text)) {
          matchedToAccount = acc.name;
          text = text.replace(new RegExp(`(?:to)\\s+${accLower}\\b`, "i"), " ");
        }
      }
    }

    // Standard account matching
    if (!matchedAccount) {
      for (const acc of context.accounts) {
        const accLower = acc.name.toLowerCase();
        if (
          new RegExp(`\\b(?:on|from|using|with|via)\\s+${accLower}\\b`, "i").test(text) ||
          new RegExp(`\\b${accLower}\\b`, "i").test(text)
        ) {
          matchedAccount = acc.name;
          matchedFields.push("account");
          text = text.replace(new RegExp(`\\b${accLower}\\b`, "i"), " ");
          break;
        }
      }
    }
  }

  // 5. Category Matching
  let matchedCategory: string | undefined;

  // First, check user-defined categories
  if (context.categories && context.categories.length > 0) {
    for (const cat of context.categories) {
      const catLower = cat.name.toLowerCase();
      if (new RegExp(`\\b${catLower}\\b`, "i").test(text)) {
        matchedCategory = cat.name;
        matchedFields.push("category");
        confidence += 0.2;
        break;
      }
    }
  }

  // Second, check dictionary of keywords
  if (!matchedCategory) {
    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const kw of keywords) {
        if (new RegExp(`\\b${kw}\\b`, "i").test(text)) {
          // Check if user has this category or a close equivalent
          const existing = context.categories?.find(
            (c) =>
              c.name.toLowerCase() === catName.toLowerCase() ||
              c.name.toLowerCase().includes(catName.toLowerCase()) ||
              catName.toLowerCase().includes(c.name.toLowerCase())
          );
          matchedCategory = existing ? existing.name : catName;
          matchedFields.push("category");
          confidence += 0.2;
          break;
        }
      }
      if (matchedCategory) break;
    }
  }

  // 6. Clean Payee Name
  // Strip out noise words, action verbs, prepositions for amount/date, and extra symbols
  let payeeCandidate = text
    .replace(/\b(?:add|record|log|create|paid|spent|bought|purchased|cost|expense|income)\b/gi, "")
    .replace(/\b(?:for|via|using|in)\b/gi, " ")
    .replace(/[,\.;:!\?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Capitalize payee appropriately
  if (payeeCandidate.length > 0) {
    payeeCandidate = payeeCandidate
      .split(" ")
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ");
    matchedFields.push("payee");
    confidence += 0.15;
  } else {
    // Fallback if cleaned text was empty
    payeeCandidate =
      matchedCategory ? `${matchedCategory} Expense` : original.slice(0, 30);
  }

  // If transfer, set sensible payee
  if (type === "transfer" && matchedToAccount) {
    payeeCandidate = `Transfer to ${matchedToAccount}`;
  }

  return {
    type,
    payee: payeeCandidate,
    amount,
    category: matchedCategory,
    account: matchedAccount || (context.accounts[0]?.name ?? "Primary"),
    toAccount: matchedToAccount,
    date: dateStr,
    confidence: Math.min(confidence, 1.0),
    matchedFields,
  };
}

/**
 * Hybrid Parser: Tries AI if configured and enabled, with instant local deterministic NLP fallback
 */
export async function parseNaturalLanguageTransaction(
  input: string,
  context: ParserContext
): Promise<ParsedTransactionFields> {
  const localResult = parseLocalNaturalLanguage(input, context);

  // If AI is not enabled or no provider configured, return instant local result
  if (!context.aiConfig || !context.aiConfig.enabled) {
    return localResult;
  }

  try {
    const validCats = context.categories?.map((c) => c.name).join(", ") || "";
    const validAccs = context.accounts.map((a) => a.name).join(", ");
    const todayStr = formatDate(new Date());

    const systemPrompt = `You are a financial natural language transaction parser.
Extract structured transaction details from the user's input phrase.
Current Date: ${todayStr}
Valid Categories: [${validCats}]
Valid Accounts: [${validAccs}]

Return ONLY a strict JSON object with these keys (do NOT wrap in markdown or explanation):
{
  "type": "expense" | "income" | "transfer",
  "payee": "Merchant or Description (clean and capitalized)",
  "amount": number (positive float),
  "category": "one of the Valid Categories, or best match",
  "account": "one of the Valid Accounts if mentioned, else null",
  "toAccount": "destination account name if transfer, else null",
  "date": "YYYY-MM-DD",
  "notes": "any extra context mentioned (e.g. Alex, for project, etc.) or null"
}`;

    const responseText = await sendAIChatRequest(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.trim() },
      ],
      context.aiConfig
    );

    // Extract JSON block
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const matchedFields: string[] = [];

      if (parsed.payee) matchedFields.push("payee");
      if (parsed.amount && !isNaN(Number(parsed.amount))) matchedFields.push("amount");
      if (parsed.category) matchedFields.push("category");
      if (parsed.date) matchedFields.push("date");
      if (parsed.type) matchedFields.push("type");
      if (parsed.account) matchedFields.push("account");

      return {
        type: (parsed.type === "income" || parsed.type === "transfer" ? parsed.type : "expense"),
        payee: String(parsed.payee || localResult.payee),
        amount: parsed.amount ? Number(parsed.amount) : localResult.amount,
        category: parsed.category || localResult.category,
        account: parsed.account || localResult.account,
        toAccount: parsed.toAccount || localResult.toAccount,
        date: parsed.date || localResult.date,
        notes: parsed.notes ? String(parsed.notes) : localResult.notes,
        confidence: 0.95,
        matchedFields,
      };
    }
  } catch (err) {
    console.warn("AI natural language parse failed, using local NLP parser:", err);
  }

  return localResult;
}
