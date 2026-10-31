/**
 * Financial Health Digest Engine
 * Computes automated monthly trend analysis, budget anomalies, and actionable savings opportunities
 * with local heuristic analytics and multi-provider AI narrative synthesis.
 */

import { Account, BudgetItem, CategoryItem, LoanRecord, Transaction } from "../../types/finance";
import { AIConfig, AIMessage } from "./types";
import { sendAIChatRequest } from "./client";
import { notifyLLMCompletion } from "../notifications";

export interface DigestDataInput {
  accounts: Account[];
  transactions: Transaction[];
  budgets: BudgetItem[];
  categories: CategoryItem[];
  loans?: LoanRecord[];
  currencySymbol?: string;
  userName?: string;
}

export interface DigestAnomaly {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  category?: string;
  amount?: number;
}

export interface DigestSavingsSuggestion {
  id: string;
  title: string;
  description: string;
  estimatedMonthlySavings: number;
  category?: string;
  actionPrompt?: string;
}

export interface FinancialHealthDigest {
  timestamp: number;
  healthScore: number;
  healthRating: "Excellent" | "Strong" | "Fair" | "Needs Attention";
  healthSummary: string;
  trendAnalysis: {
    currentMonthExpense: number;
    prevMonthExpense: number;
    momChangePct: number;
    currentMonthIncome: number;
    prevMonthIncome: number;
    netCashFlow: number;
    savingsRate: number;
    topSurgingCategory?: {
      name: string;
      current: number;
      previous: number;
      changePct: number;
    };
    narrative: string;
  };
  anomalies: DigestAnomaly[];
  savingsSuggestions: DigestSavingsSuggestion[];
  source: "ai" | "local";
}

const STORAGE_CACHE_KEY = "finly_dashboard_health_digest";

/**
 * Calculates deterministic monthly metrics, variances, health scores, and anomalies locally.
 */
export function computeLocalHealthDigest(data: DigestDataInput): FinancialHealthDigest {
  const sym = data.currencySymbol || "$";
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Previous month dates
  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dayElapsed = now.getDate();
  const monthProgressPct = Math.round((dayElapsed / daysInMonth) * 100);

  // 1. Separate current month and previous month transactions
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  let prevMonthIncome = 0;
  let prevMonthExpense = 0;

  const currentCatSpend: Record<string, number> = {};
  const prevCatSpend: Record<string, number> = {};
  const currentPayeeSpend: Record<string, { count: number; total: number; category: string }> = {};

  const currentExpensesList: number[] = [];

  for (const tx of data.transactions) {
    if (tx.type === "transfer") continue;

    const amt = Math.abs(tx.amount);
    const d = new Date(tx.date);
    if (isNaN(d.getTime())) continue;

    const y = d.getFullYear();
    const m = d.getMonth();

    const isCurrent = y === currentYear && m === currentMonth;
    const isPrev = y === prevYear && m === prevMonth;

    if (isCurrent) {
      if (tx.amount > 0 || tx.type === "income") {
        currentMonthIncome += amt;
      } else {
        currentMonthExpense += amt;
        currentExpensesList.push(amt);
        const cat = (tx.category || "General").trim();
        currentCatSpend[cat] = (currentCatSpend[cat] || 0) + amt;

        const payee = (tx.payee || "Unknown").trim();
        const existing = currentPayeeSpend[payee] || { count: 0, total: 0, category: cat };
        existing.count += 1;
        existing.total += amt;
        currentPayeeSpend[payee] = existing;
      }
    } else if (isPrev) {
      if (tx.amount > 0 || tx.type === "income") {
        prevMonthIncome += amt;
      } else {
        prevMonthExpense += amt;
        const cat = (tx.category || "General").trim();
        prevCatSpend[cat] = (prevCatSpend[cat] || 0) + amt;
      }
    }
  }

  // MoM Change Percentage
  const momChangePct =
    prevMonthExpense > 0
      ? Math.round(((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100)
      : 0;

  const netCashFlow = currentMonthIncome - currentMonthExpense;
  const savingsRate =
    currentMonthIncome > 0
      ? Math.max(0, Math.round((netCashFlow / currentMonthIncome) * 100))
      : 0;

  // 2. Identify top surging category MoM
  let topSurgingCategory:
    | { name: string; current: number; previous: number; changePct: number }
    | undefined = undefined;
  let maxSurgePct = -Infinity;

  for (const [cat, currAmt] of Object.entries(currentCatSpend)) {
    const prevAmt = prevCatSpend[cat] || 0;
    if (prevAmt > 0 && currAmt > prevAmt) {
      const surgePct = Math.round(((currAmt - prevAmt) / prevAmt) * 100);
      if (surgePct > maxSurgePct && currAmt >= 50) {
        maxSurgePct = surgePct;
        topSurgingCategory = {
          name: cat,
          current: currAmt,
          previous: prevAmt,
          changePct: surgePct,
        };
      }
    }
  }

  // 3. Detect Budget Anomalies
  const anomalies: DigestAnomaly[] = [];

  for (const b of data.budgets) {
    const catName = b.category.trim();
    const spent = currentCatSpend[catName] || 0;
    const limit = b.limit;

    if (limit > 0) {
      const pctUsed = Math.round((spent / limit) * 100);

      if (spent > limit) {
        anomalies.push({
          id: `anomaly-over-${b.id}`,
          title: `${catName} Over Budget`,
          description: `You have spent ${sym}${spent.toFixed(0)} of your ${sym}${limit.toFixed(0)} budget (${pctUsed}%).`,
          severity: "high",
          category: catName,
          amount: spent - limit,
        });
      } else if (pctUsed >= 80 && monthProgressPct < 65) {
        anomalies.push({
          id: `anomaly-pacing-${b.id}`,
          title: `${catName} Accelerating Fast`,
          description: `Used ${pctUsed}% of monthly budget with ${daysInMonth - dayElapsed} days left in the month.`,
          severity: "medium",
          category: catName,
          amount: spent,
        });
      }
    }
  }

  // Check for unusual spending spikes (transactions > 3.5x average transaction)
  if (currentExpensesList.length >= 3) {
    const avgTx = currentMonthExpense / currentExpensesList.length;
    const threshold = Math.max(avgTx * 3.5, 100);

    const spikeTxs = data.transactions.filter((tx) => {
      const d = new Date(tx.date);
      const isCurrent =
        !isNaN(d.getTime()) &&
        d.getFullYear() === currentYear &&
        d.getMonth() === currentMonth;
      return isCurrent && tx.amount < 0 && Math.abs(tx.amount) >= threshold;
    });

    for (const spike of spikeTxs.slice(0, 2)) {
      anomalies.push({
        id: `anomaly-spike-${spike.id}`,
        title: `Spike Expense: ${spike.payee}`,
        description: `Unusual single expense of ${sym}${Math.abs(spike.amount).toFixed(2)} recorded on ${spike.date}.`,
        severity: "medium",
        category: spike.category,
        amount: Math.abs(spike.amount),
      });
    }
  }

  // Flagged transactions check
  const flaggedCount = data.transactions.filter((t) => t.status === "flagged").length;
  if (flaggedCount > 0) {
    anomalies.push({
      id: "anomaly-flagged",
      title: `${flaggedCount} Flagged ${flaggedCount === 1 ? "Item" : "Items"}`,
      description: "You have unreviewed flagged transactions requiring verification.",
      severity: "low",
    });
  }

  // 4. Generate Actionable Savings Suggestions
  const savingsSuggestions: DigestSavingsSuggestion[] = [];

  // A. Dining vs Grocery ratio
  const diningSpend = (currentCatSpend["Dining Out"] || 0) + (currentCatSpend["Food & Dining"] || 0);
  const grocerySpend = (currentCatSpend["Groceries"] || 0) + (currentCatSpend["Supermarket"] || 0);

  if (diningSpend > 100 && (grocerySpend === 0 || diningSpend > grocerySpend * 1.4)) {
    const potential = Math.round(diningSpend * 0.28);
    savingsSuggestions.push({
      id: "sav-dining",
      title: "Rebalance Dining vs. Groceries",
      description: `Dining out accounts for ${sym}${diningSpend.toFixed(0)} this month. Preparing meals at home 2 extra days weekly could preserve ~${sym}${potential}/mo.`,
      estimatedMonthlySavings: potential,
      category: "Food & Dining",
      actionPrompt: "How can I balance my dining out and groceries spending?",
    });
  }

  // B. Recurring Subscriptions
  const subscriptionPayees = Object.entries(currentPayeeSpend).filter(([name]) => {
    const n = name.toLowerCase();
    return (
      n.includes("netflix") ||
      n.includes("spotify") ||
      n.includes("prime") ||
      n.includes("youtube") ||
      n.includes("hulu") ||
      n.includes("gym") ||
      n.includes("membership") ||
      n.includes("sub")
    );
  });

  if (subscriptionPayees.length >= 2) {
    const totalSub = subscriptionPayees.reduce((sum, [, p]) => sum + p.total, 0);
    const potential = Math.round(totalSub * 0.35);
    savingsSuggestions.push({
      id: "sav-subs",
      title: "Audit Active Subscriptions",
      description: `Detected ${subscriptionPayees.length} recurring services totaling ${sym}${totalSub.toFixed(0)}/mo. Pausing unused services could save ~${sym}${potential}/mo.`,
      estimatedMonthlySavings: potential,
      category: "Entertainment",
      actionPrompt: "Audit my subscriptions and show where I can reduce recurring costs.",
    });
  }

  // C. Discretionary Spending Trim
  const discretionarySpend =
    (currentCatSpend["Shopping"] || 0) +
    (currentCatSpend["Entertainment"] || 0) +
    diningSpend;

  if (currentMonthExpense > 0 && discretionarySpend / currentMonthExpense > 0.45 && currentMonthExpense > 200) {
    const potential = Math.round(discretionarySpend * 0.15);
    savingsSuggestions.push({
      id: "sav-discretionary",
      title: "Trim High Discretionary Spending",
      description: `Non-essential categories consume ${Math.round((discretionarySpend / currentMonthExpense) * 100)}% of your monthly outflows. A 15% trim retains ${sym}${potential}/mo.`,
      estimatedMonthlySavings: potential,
      category: "Shopping",
      actionPrompt: "Show my discretionary expenses and help me create a savings target.",
    });
  }

  // Fallback suggestion if needed
  if (savingsSuggestions.length === 0) {
    const estSave = Math.max(Math.round(currentMonthExpense * 0.1), 50);
    savingsSuggestions.push({
      id: "sav-default",
      title: "Build 10% Cash Cushion",
      description: `Setting an automatic transfer of ${sym}${estSave} to savings at the start of each month builds emergency liquidity.`,
      estimatedMonthlySavings: estSave,
      actionPrompt: "What is the best emergency fund target for my current income?",
    });
  }

  // 5. Composite Health Score Calculation (0 - 100)
  let score = 55;

  // Savings rate factor (+20 to -15)
  if (savingsRate >= 25) score += 20;
  else if (savingsRate >= 15) score += 12;
  else if (savingsRate >= 5) score += 5;
  else if (currentMonthIncome > 0 && netCashFlow < 0) score -= 15;

  // Budget compliance (+15 to -15)
  const overBudgetCount = anomalies.filter((a) => a.severity === "high").length;
  if (data.budgets.length > 0) {
    if (overBudgetCount === 0) score += 15;
    else if (overBudgetCount === 1) score -= 5;
    else score -= 15;
  } else {
    score += 5; // Neutral
  }

  // Net worth & Debt ratio factor (+15 to -15)
  const totalAssets = data.accounts
    .filter((a) => a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0);
  const totalDebt = data.accounts
    .filter((a) => a.balance < 0)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  if (totalDebt === 0) score += 12;
  else if (totalAssets > 0 && totalDebt / totalAssets <= 0.25) score += 8;
  else if (totalAssets > 0 && totalDebt / totalAssets > 0.6) score -= 12;

  // MoM spending direction factor
  if (momChangePct < -5) score += 5;
  else if (momChangePct > 20) score -= 8;

  score = Math.max(18, Math.min(98, score));

  let healthRating: "Excellent" | "Strong" | "Fair" | "Needs Attention" = "Strong";
  if (score >= 85) healthRating = "Excellent";
  else if (score >= 70) healthRating = "Strong";
  else if (score >= 50) healthRating = "Fair";
  else healthRating = "Needs Attention";

  let healthSummary = "";
  if (healthRating === "Excellent") {
    healthSummary = `Exceptional financial health with a ${savingsRate}% savings rate and strong budget discipline.`;
  } else if (healthRating === "Strong") {
    healthSummary = `Healthy financial foundation with positive net cash flow of ${sym}${netCashFlow.toLocaleString("en-US", { maximumFractionDigits: 0 })}.`;
  } else if (healthRating === "Fair") {
    healthSummary = `Fair cash flow balance, but pacing high in certain categories requiring closer review.`;
  } else {
    healthSummary = `Spending currently outpaces income. Immediate adjustments recommended in high-velocity categories.`;
  }

  // Narrative summary for Monthly Trend
  let trendNarrative = "";
  if (prevMonthExpense > 0) {
    const dir = momChangePct >= 0 ? "increased" : "decreased";
    trendNarrative = `Total expenses ${dir} by ${Math.abs(momChangePct)}% compared to this point last month (${sym}${currentMonthExpense.toFixed(0)} vs ${sym}${prevMonthExpense.toFixed(0)}).`;
    if (topSurgingCategory) {
      trendNarrative += ` ${topSurgingCategory.name} was the largest driver, surging +${topSurgingCategory.changePct}%.`;
    }
  } else {
    trendNarrative = `Tracking ${sym}${currentMonthExpense.toFixed(0)} in expenses against ${sym}${currentMonthIncome.toFixed(0)} in inflow for ${now.toLocaleString("default", { month: "long" })}.`;
  }

  return {
    timestamp: Date.now(),
    healthScore: score,
    healthRating,
    healthSummary,
    trendAnalysis: {
      currentMonthExpense,
      prevMonthExpense,
      momChangePct,
      currentMonthIncome,
      prevMonthIncome,
      netCashFlow,
      savingsRate,
      topSurgingCategory,
      narrative: trendNarrative,
    },
    anomalies: anomalies.slice(0, 4),
    savingsSuggestions: savingsSuggestions.slice(0, 3),
    source: "local",
  };
}

/**
 * Loads cached digest from localStorage if available and not stale (< 4 hours old).
 */
export function getCachedHealthDigest(): FinancialHealthDigest | null {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FinancialHealthDigest;
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > FOUR_HOURS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Saves generated digest to localStorage cache.
 */
export function saveCachedHealthDigest(digest: FinancialHealthDigest) {
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(digest));
  } catch {
    // ignore
  }
}

/**
 * Synthesizes an AI Financial Health Digest using the configured LLM provider.
 */
export async function generateAIFinancialDigest(
  data: DigestDataInput,
  config: AIConfig
): Promise<FinancialHealthDigest> {
  const local = computeLocalHealthDigest(data);
  const sym = data.currencySymbol || "$";

  if (!config.enabled) {
    saveCachedHealthDigest(local);
    return local;
  }

  try {
    const prompt = `You are Finly's Senior Financial Advisor.
Analyze the user's monthly financial metrics and synthesize an insightful, empowering Financial Health Digest.

Financial Snapshot:
- User Name: ${data.userName || "User"}
- Currency: ${sym}
- Current Month Inflow: ${sym}${local.trendAnalysis.currentMonthIncome.toFixed(2)}
- Current Month Outflow: ${sym}${local.trendAnalysis.currentMonthExpense.toFixed(2)}
- Net Cash Flow: ${sym}${local.trendAnalysis.netCashFlow.toFixed(2)}
- Savings Rate: ${local.trendAnalysis.savingsRate}%
- MoM Spending Change: ${local.trendAnalysis.momChangePct}% (vs Previous Month Outflow: ${sym}${local.trendAnalysis.prevMonthExpense.toFixed(2)})
- Detected Surging Category: ${local.trendAnalysis.topSurgingCategory ? `${local.trendAnalysis.topSurgingCategory.name} (+${local.trendAnalysis.topSurgingCategory.changePct}%)` : "None"}
- Health Score: ${local.healthScore}/100 (${local.healthRating})
- Detected Anomalies: ${JSON.stringify(local.anomalies)}
- Local Savings Opportunities: ${JSON.stringify(local.savingsSuggestions)}

Instructions:
Synthesize this into a polished, executive digest.
Output ONLY pure JSON in this exact structure without markdown backticks:
{
  "healthSummary": "A punchy, empathetic 1-sentence executive summary of their financial state.",
  "trendNarrative": "A 2-sentence narrative explaining their cash flow velocity and MoM trajectory.",
  "anomalies": [
    {
      "id": "a_1",
      "title": "Short Alert Title",
      "description": "Specific context with numbers",
      "severity": "high" | "medium" | "low",
      "category": "Category name if applicable"
    }
  ],
  "savingsSuggestions": [
    {
      "id": "s_1",
      "title": "Actionable Strategy Title",
      "description": "Concrete 1-sentence advice with rationale",
      "estimatedMonthlySavings": number,
      "category": "Target category",
      "actionPrompt": "A prompt the user can ask Finly for help"
    }
  ]
}`;

    const messages: AIMessage[] = [
      {
        role: "system",
        content:
          "You are a professional financial planner. Respond ONLY with valid JSON. Never wrap in markdown code blocks.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const reply = await sendAIChatRequest(messages, config);
    const cleanJson = reply.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    const merged: FinancialHealthDigest = {
      timestamp: Date.now(),
      healthScore: local.healthScore,
      healthRating: local.healthRating,
      healthSummary: parsed.healthSummary || local.healthSummary,
      trendAnalysis: {
        ...local.trendAnalysis,
        narrative: parsed.trendNarrative || local.trendAnalysis.narrative,
      },
      anomalies: Array.isArray(parsed.anomalies) && parsed.anomalies.length > 0
        ? parsed.anomalies
        : local.anomalies,
      savingsSuggestions: Array.isArray(parsed.savingsSuggestions) && parsed.savingsSuggestions.length > 0
        ? parsed.savingsSuggestions
        : local.savingsSuggestions,
      source: "ai",
    };

    saveCachedHealthDigest(merged);

    // Notify user via Tauri desktop notification
    notifyLLMCompletion({
      title: "Finly Health Digest",
      body: `Monthly Health Score: ${merged.healthScore}/100 (${merged.healthRating}). ${merged.healthSummary}`,
    }).catch(() => {});

    return merged;
  } catch (err) {
    console.warn("AI digest generation failed, using local calculations:", err);
    saveCachedHealthDigest(local);
    return local;
  }
}
