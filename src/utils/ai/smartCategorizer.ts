/**
 * Smart CSV Auto-Categorization & Merchant Description Cleaning Engine
 * Combines local heuristic pattern recognition with batch LLM classification
 * for obscure bank statement descriptions.
 */

import { CategoryItem } from "../../types/finance";
import { AIConfig, AIMessage } from "./types";
import { sendAIChatRequest } from "./client";
import { notifyLLMCompletion } from "../notifications";

export interface CategorizationInput {
  id: string;
  rawDescription: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date?: string;
  currentCategory?: string;
}

export interface CategorizationResult {
  id: string;
  cleanPayee: string;
  category: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  isNewCategory?: boolean;
}

/**
 * Strips noisy banking prefixes, reference numbers, terminal IDs, UPI handles,
 * and location tags to extract a clean, recognizable merchant/payee name.
 */
export function cleanBankDescription(raw: string): string {
  if (!raw || !raw.trim()) return "Unknown Payee";

  let text = raw.trim();

  // 1. Handle Slash-Delimited UPI Strings (e.g. "UPI/CR/43019284910/Swiggy/swiggy@icici/Order")
  if (text.toUpperCase().startsWith("UPI/") || text.toUpperCase().startsWith("UPI-")) {
    const parts = text.split(/[/|-]/).map((p) => p.trim()).filter(Boolean);
    // Find candidate merchant name part that is not purely numeric and not an internal code
    const skipWords = new Set(["UPI", "CR", "DR", "P2A", "P2U", "PAYMENT", "ORDER", "REF", "NA"]);
    const candidates = parts.filter(
      (p) => !skipWords.has(p.toUpperCase()) && !/^\d+$/.test(p) && !p.includes("@")
    );
    if (candidates.length > 0) {
      // Pick the first substantive candidate
      const best = candidates.find((c) => c.length > 2) || candidates[0];
      return formatTitleCase(best);
    }
  }

  // 2. Remove Common Transaction & Banking Prefixes
  const prefixPatterns = [
    /^(?:POS\s+[0-9A-Z*#]+\s+)/i,
    /^(?:ACH\s+DEBIT\s+|ACH\s+CREDIT\s+|ACH\s+DEP\s+)/i,
    /^(?:NEFT[-/\s]+(?:CR|DR)?[-/\s]*[A-Z0-9]+[-/\s]+)/i,
    /^(?:RTGS[-/\s]+(?:CR|DR)?[-/\s]*[A-Z0-9]+[-/\s]+)/i,
    /^(?:IMPS[-/\s]+(?:P2A|P2U)?[-/\s]*[0-9]+[-/\s]+)/i,
    /^(?:CMS[-/][0-9]+[-/])/i,
    /^(?:DEB[-/]ATM\s+WDL[-/0-9]*[-/])/i,
    /^(?:CARD\s+NO\s+[0-9X\s]+)/i,
    /^(?:PURCHASE\s+ON\s+[0-9/-]+\s+)/i,
    /^(?:IN\*\s*)/i,
    /^(?:INT\.PD:\s*)/i,
    /^(?:AUTOPAY[-/]\s*)/i,
    /^(?:DIRECT\s+DEP\s+|DIRECT\s+DEPOSIT\s+)/i,
    /^(?:CHECK\s+#[0-9]+\s+)/i,
    /^(?:TRANSFER\s+(?:TO|FROM)\s+[0-9A-Z]+\s+)/i,
  ];

  for (const regex of prefixPatterns) {
    text = text.replace(regex, "");
  }

  // 3. Remove Suffixes: UPI handles, payment gateway names, location tags, reference IDs
  // e.g. "Swiggy swiggy@icici Payment", "AMZN MKTP US*1234 SEATTLE WA"
  text = text.replace(/@(?:icici|okaxis|okhdfcbank|okicici|paytm|ybl|hdfcbank|sbi|axl|ibl|postbank|upi)\b.*/i, "");
  text = text.replace(/\b(?:BILLDESK|PAYU|RAZORPAY|CCAVENUE|CASHFREE|EASYPAY|GATEWAY)\b.*/i, "");
  text = text.replace(/\b(?:MUMBAI|DELHI|BANGALORE|BENGALURU|PUNE|HYDERABAD|CHENNAI|KOLKATA|NOIDA|GURGAON|SEATTLE|HOUSTON|SAN FRANCISCO|NEW YORK)\b(?:\s+(?:IN|US|CA|TX|NY|WA|UK|SG))?/i, "");
  text = text.replace(/\s+(?:IN|US|CA|TX|NY|WA|UK|SG)$/i, "");
  text = text.replace(/\b(?:AMZN\s*MKTP|AMZN\.COM\/BILL|AMAZON\.COM)\b/i, "Amazon");
  text = text.replace(/\b(?:APPLE\.COM\/BILL)\b/i, "Apple");
  text = text.replace(/\b(?:NETFLIX\.COM)\b/i, "Netflix");
  text = text.replace(/\b(?:SPOTIFY\.COM)\b/i, "Spotify");

  // Remove trailing reference numbers, phone numbers, asterisks and punctuation
  text = text.replace(/(?:\b[0-9]{3}[-.]?[0-9]{3}[-.]?[0-9]{4}\b)/g, ""); // phone numbers
  text = text.replace(/[/|-]\s*(?:SALARY|PAYMENT|ORDER|PURCHASE|BILL)\b/i, "");
  text = text.replace(/\b(?:US|CA|IN|UK)\*/i, "");
  text = text.replace(/[*#]\s*[0-9A-Z]+/g, "");
  text = text.replace(/\b[0-9]{4,}\b/g, "");
  text = text.replace(/[-/]\s*$/, "").trim();

  // If text became empty or too short, revert to raw cleaned
  if (text.length < 2) {
    text = raw.replace(/[^\w\s]/g, " ").trim();
  }

  return formatTitleCase(text);
}

/**
 * Format all-caps or all-lower string to readable Title Case
 */
function formatTitleCase(str: string): string {
  const s = str.trim().replace(/\s+/g, " ");
  if (!s) return "";

  // Common acronyms to preserve
  const acronyms = new Set(["ATM", "UPI", "SBI", "HDFC", "ICICI", "TCS", "IRCTC", "BESCOM", "PG&E", "AWS", "AI"]);

  return s
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      if (word.length <= 1) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Matches a category name to the user's existing categories (case-insensitive fuzzy match),
 * or returns a sensible default category.
 */
export function resolveCategoryName(
  suggestedName: string,
  categories: CategoryItem[]
): { name: string; isNew: boolean } {
  const norm = suggestedName.trim().toLowerCase();
  const existing = categories.find((c) => c.name.trim().toLowerCase() === norm);
  if (existing) {
    return { name: existing.name, isNew: false };
  }

  // Synonym & mapping checks
  const mapping: Record<string, string[]> = {
    "Food & Dining": ["dining out", "restaurants", "dining", "food", "cafe", "coffee", "restaurant", "fast food"],
    "Groceries": ["supermarket", "grocery", "household essentials", "provisions"],
    "Transportation": ["fuel", "gas", "petrol", "cab", "transit", "taxi", "flights", "travel"],
    "Shopping": ["clothing", "retail", "apparel", "electronics", "online shopping", "e-commerce"],
    "Entertainment": ["subscriptions", "movies", "streaming", "music", "gaming", "leisure"],
    "Utilities": ["bills", "electricity", "water", "wifi", "internet", "phone", "broadband"],
    "Salary": ["payroll", "income", "compensation", "wages", "earnings"],
    "Investments & Dividend": ["investments", "dividend", "stocks", "mutual funds", "crypto"],
    "Health & Pharmacy": ["healthcare", "medical", "pharmacy", "medicine", "doctor", "hospital"],
    "Housing": ["rent", "mortgage", "maintenance", "home"],
    "Education": ["tuition", "courses", "books", "training", "school"],
  };

  for (const [standardCategory, synonyms] of Object.entries(mapping)) {
    // Check if user has this standard category or any synonym
    const userMatch = categories.find(
      (c) =>
        c.name.trim().toLowerCase() === standardCategory.toLowerCase() ||
        synonyms.includes(c.name.trim().toLowerCase())
    );
    if (userMatch && (norm === standardCategory.toLowerCase() || synonyms.includes(norm))) {
      return { name: userMatch.name, isNew: false };
    }
  }

  return { name: formatTitleCase(suggestedName), isNew: true };
}

/**
 * Fast local heuristic categorization for obscure bank statements.
 * Checks 150+ merchant keywords, abbreviations, and banking patterns.
 */
export function classifyBankDescriptionLocal(
  rawText: string,
  categories: CategoryItem[]
): { category: string; cleanPayee: string; confidence: "high" | "medium" | "low"; isNew: boolean } {
  const cleanPayee = cleanBankDescription(rawText);
  const p = (cleanPayee + " " + rawText).toLowerCase();

  let detectedCategory = "General";
  let confidence: "high" | "medium" | "low" = "low";

  // 1. Food & Dining
  if (
    p.includes("swiggy") ||
    p.includes("zomato") ||
    p.includes("starbucks") ||
    p.includes("mcdonald") ||
    p.includes("domino") ||
    p.includes("pizza") ||
    p.includes("subway") ||
    p.includes("burger") ||
    p.includes("kfc") ||
    p.includes("cafe") ||
    p.includes("restaurant") ||
    p.includes("bistro") ||
    p.includes("bakery") ||
    p.includes("hungerbox") ||
    p.includes("haldiram") ||
    p.includes("barbeque") ||
    p.includes("chipotle") ||
    p.includes("dunkin") ||
    p.includes("taco bell") ||
    p.includes("doordash") ||
    p.includes("ubereats") ||
    p.includes("deliveroo")
  ) {
    detectedCategory = "Food & Dining";
    confidence = "high";
  }
  // 2. Groceries
  else if (
    p.includes("blinkit") ||
    p.includes("zepto") ||
    p.includes("instamart") ||
    p.includes("bigbasket") ||
    p.includes("bb daily") ||
    p.includes("dmart") ||
    p.includes("walmart") ||
    p.includes("kroger") ||
    p.includes("costco") ||
    p.includes("target") ||
    p.includes("trader joe") ||
    p.includes("whole food") ||
    p.includes("grocer") ||
    p.includes("supermarket") ||
    p.includes("spencer") ||
    p.includes("nature's basket") ||
    p.includes("milk") ||
    p.includes("vegetable")
  ) {
    detectedCategory = "Groceries";
    confidence = "high";
  }
  // 3. Transportation & Fuel
  else if (
    p.includes("uber") ||
    p.includes("ola cabs") ||
    p.includes("rapido") ||
    p.includes("lyft") ||
    p.includes("irctc") ||
    p.includes("metro") ||
    p.includes("shell") ||
    p.includes("petrol") ||
    p.includes("fuel") ||
    p.includes("indian oil") ||
    p.includes("iocl") ||
    p.includes("bpcl") ||
    p.includes("hpcl") ||
    p.includes("chevron") ||
    p.includes("exxon") ||
    p.includes("gas station") ||
    p.includes("indigo") ||
    p.includes("air india") ||
    p.includes("spicejet") ||
    p.includes("airline") ||
    p.includes("flight") ||
    p.includes("toll") ||
    p.includes("fastag")
  ) {
    detectedCategory = "Transportation";
    confidence = "high";
  }
  // 4. Shopping
  else if (
    p.includes("amazon") ||
    p.includes("amzn") ||
    p.includes("flipkart") ||
    p.includes("myntra") ||
    p.includes("ajio") ||
    p.includes("nykaa") ||
    p.includes("ebay") ||
    p.includes("zara") ||
    p.includes("h&m") ||
    p.includes("uniqlo") ||
    p.includes("apple") ||
    p.includes("croma") ||
    p.includes("reliance digital") ||
    p.includes("ikea") ||
    p.includes("decathlon") ||
    p.includes("apparel") ||
    p.includes("clothing") ||
    p.includes("shoes")
  ) {
    detectedCategory = "Shopping";
    confidence = "high";
  }
  // 5. Entertainment & Subscriptions
  else if (
    p.includes("netflix") ||
    p.includes("spotify") ||
    p.includes("hotstar") ||
    p.includes("prime video") ||
    p.includes("youtube") ||
    p.includes("disney") ||
    p.includes("apple.com/bill") ||
    p.includes("hulu") ||
    p.includes("steam") ||
    p.includes("playstation") ||
    p.includes("nintendo") ||
    p.includes("bookmyshow") ||
    p.includes("pvr") ||
    p.includes("inox") ||
    p.includes("cinema") ||
    p.includes("theatre") ||
    p.includes("patreon")
  ) {
    detectedCategory = "Entertainment";
    confidence = "high";
  }
  // 6. Utilities & Bills
  else if (
    p.includes("bescom") ||
    p.includes("electricity") ||
    p.includes("water bill") ||
    p.includes("gas bill") ||
    p.includes("airtel") ||
    p.includes("jio") ||
    p.includes("vodafone") ||
    p.includes("verizon") ||
    p.includes("at&t") ||
    p.includes("t-mobile") ||
    p.includes("act fibernet") ||
    p.includes("broadband") ||
    p.includes("wifi") ||
    p.includes("recharge")
  ) {
    detectedCategory = "Utilities";
    confidence = "high";
  }
  // 7. Salary & Income
  else if (
    p.includes("salary") ||
    p.includes("payroll") ||
    p.includes("stipend") ||
    p.includes("direct dep") ||
    p.includes("bonus") ||
    p.includes("tata consultancy") ||
    p.includes("infosys") ||
    p.includes("wipro") ||
    p.includes("accenture") ||
    p.includes("google") ||
    p.includes("microsoft") ||
    p.includes("amazon salary")
  ) {
    detectedCategory = "Salary";
    confidence = "high";
  }
  // 8. Health & Pharmacy
  else if (
    p.includes("apollo") ||
    p.includes("pharmeasy") ||
    p.includes("1mg") ||
    p.includes("medplus") ||
    p.includes("pharmacy") ||
    p.includes("hospital") ||
    p.includes("clinic") ||
    p.includes("dr ") ||
    p.includes("doctor") ||
    p.includes("dental") ||
    p.includes("diagnostic") ||
    p.includes("pathology") ||
    p.includes("cvs") ||
    p.includes("walgreens") ||
    p.includes("gym") ||
    p.includes("cult.fit")
  ) {
    detectedCategory = "Health & Pharmacy";
    confidence = "high";
  }
  // 9. Investments & Dividends
  else if (
    p.includes("zerodha") ||
    p.includes("groww") ||
    p.includes("upstox") ||
    p.includes("vanguard") ||
    p.includes("fidelity") ||
    p.includes("charles schwab") ||
    p.includes("mutual fund") ||
    p.includes("dividend") ||
    p.includes("interest paid") ||
    p.includes("int.pd") ||
    p.includes("securities") ||
    p.includes("etf")
  ) {
    detectedCategory = "Investments & Dividend";
    confidence = "high";
  }
  // 10. Housing & Rent
  else if (
    p.includes("rent") ||
    p.includes("landlord") ||
    p.includes("society maintenance") ||
    p.includes("apartment") ||
    p.includes("housing") ||
    p.includes("nobroker")
  ) {
    detectedCategory = "Housing";
    confidence = "medium";
  }

  const resolved = resolveCategoryName(detectedCategory, categories);
  return {
    category: resolved.name,
    cleanPayee,
    confidence,
    isNew: resolved.isNew,
  };
}

/**
 * Batches transactions and calls the configured LLM to classify obscure descriptions.
 * Falls back safely to local heuristic rules if the AI provider fails.
 */
export async function classifyTransactionsWithAI(
  items: CategorizationInput[],
  categories: CategoryItem[],
  config: AIConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = [];
  const BATCH_SIZE = 15;
  const total = items.length;

  const categoryNames = categories.map((c) => c.name);

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    if (config.enabled) {
      try {
        const batchPrompt = `You are a financial classification assistant for Finly.
Classify the following bank statement transactions into the most appropriate category.
Available User Categories: [${categoryNames.join(", ")}].
If an existing category fits well, ALWAYS choose it. If none fits, provide a concise, clean category name (e.g. "Food & Dining", "Groceries", "Transportation", "Shopping", "Entertainment", "Utilities", "Healthcare", "Salary").
Also extract a clean, human-readable merchant/entity name (strip prefixes like UPI/, POS, ACH, card numbers, locations, and terminal codes).

Return ONLY valid JSON in this exact structure:
[
  {
    "id": "row_id",
    "cleanPayee": "Clean Merchant Name",
    "category": "Matched Category",
    "confidence": "high" | "medium" | "low",
    "reason": "Brief 3-6 word explanation"
  }
]

Transactions to classify:
${JSON.stringify(
  batch.map((b) => ({
    id: b.id,
    raw: b.rawDescription,
    amount: b.amount,
    type: b.type,
  })),
  null,
  2
)}`;

        const messages: AIMessage[] = [
          {
            role: "system",
            content:
              "You are an expert banking transaction categorizer. Output ONLY pure JSON array without markdown fences or additional conversational prose.",
          },
          {
            role: "user",
            content: batchPrompt,
          },
        ];

        const aiResponse = await sendAIChatRequest(messages, config);
        const cleanedJson = aiResponse.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);

        if (Array.isArray(parsed)) {
          const map = new Map<string, any>(parsed.map((p) => [String(p.id), p]));
          for (const item of batch) {
            const aiItem = map.get(item.id);
            if (aiItem && aiItem.category) {
              const resolved = resolveCategoryName(aiItem.category, categories);
              results.push({
                id: item.id,
                cleanPayee: aiItem.cleanPayee || cleanBankDescription(item.rawDescription),
                category: resolved.name,
                confidence: aiItem.confidence || "high",
                reason: aiItem.reason || "Classified by Finly AI",
                isNewCategory: resolved.isNew,
              });
              continue;
            }
            // Fallback for missing item in AI response
            const local = classifyBankDescriptionLocal(item.rawDescription, categories);
            results.push({
              id: item.id,
              cleanPayee: local.cleanPayee,
              category: local.category,
              confidence: local.confidence,
              reason: "Heuristic pattern match",
              isNewCategory: local.isNew,
            });
          }
        } else {
          throw new Error("Invalid AI JSON structure");
        }
      } catch (err) {
        console.warn("AI batch classification error, falling back to local heuristics:", err);
        // Fallback for this batch
        for (const item of batch) {
          const local = classifyBankDescriptionLocal(item.rawDescription, categories);
          results.push({
            id: item.id,
            cleanPayee: local.cleanPayee,
            category: local.category,
            confidence: local.confidence,
            reason: "Rule-based match (AI fallback)",
            isNewCategory: local.isNew,
          });
        }
      }
    } else {
      // Local heuristic categorization only
      for (const item of batch) {
        const local = classifyBankDescriptionLocal(item.rawDescription, categories);
        results.push({
          id: item.id,
          cleanPayee: local.cleanPayee,
          category: local.category,
          confidence: local.confidence,
          reason: "Fast heuristic match",
          isNewCategory: local.isNew,
        });
      }
    }

    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }

  // Trigger desktop completion notification
  notifyLLMCompletion({
    title: "Finly Smart Categorization",
    body: `Successfully categorized ${results.length} statement transactions.`,
  }).catch(() => {});

  return results;
}
