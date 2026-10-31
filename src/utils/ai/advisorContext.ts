import { Account, BudgetItem, CategoryItem, LoanRecord, Transaction } from "../../types/finance";
import { parseLocalNaturalLanguage } from "./naturalLanguageParser";

export interface AdvisorData {
  accounts: Account[];
  budgets: BudgetItem[];
  transactions: Transaction[];
  categories: CategoryItem[];
  loans: LoanRecord[];
  selectedTransactions?: Transaction[];
  currencySymbol?: string;
  userName?: string;
}

export interface FinlyActionPayload {
  type: "update_category" | "clear_flag" | "update_payee" | "create_transaction";
  txId?: string;
  payee: string;
  newPayee?: string;
  amount?: number;
  oldCategory?: string;
  newCategory?: string;
  category?: string;
  account?: string;
  toAccount?: string;
  transactionType?: "expense" | "income" | "transfer";
  date?: string;
  notes?: string;
}

/**
 * Calculates financial analytics metrics across accounts, budgets, and transactions,
 * matching DashboardPage and BudgetPage calculations.
 */
export function calculateFinancialMetrics(data: AdvisorData) {
  const sym = data.currencySymbol || "$";
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Net worth & Accounts
  const totalNetWorth = data.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalAssets = data.accounts
    .filter((a) => a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = data.accounts
    .filter((a) => a.balance < 0)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  let totalCashAndSavings = 0;
  let totalCreditDebt = 0;
  let totalInvestments = 0;

  for (const acc of data.accounts) {
    if (acc.type === "credit") {
      totalCreditDebt += Math.abs(acc.balance);
    } else if (acc.type === "investment") {
      totalInvestments += acc.balance;
    } else {
      totalCashAndSavings += acc.balance;
    }
  }

  // Monthly & All-time transactions analysis
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  let totalInflow = 0;
  let totalOutflow = 0;

  const categorySpendMap: Record<string, number> = {};
  const payeeSpendMap: Record<string, number> = {};

  for (const tx of data.transactions) {
    if (tx.type === "transfer") continue;

    const amt = Math.abs(tx.amount);
    const isIncome = tx.amount > 0 || tx.type === "income";
    const isExpense = tx.amount < 0 || tx.type === "expense";

    if (isIncome) totalInflow += amt;
    if (isExpense) totalOutflow += amt;

    const txDate = new Date(tx.date);
    const isCurrentMonth =
      !isNaN(txDate.getTime()) &&
      txDate.getFullYear() === currentYear &&
      txDate.getMonth() === currentMonth;

    if (isCurrentMonth) {
      if (isIncome) {
        currentMonthIncome += amt;
      } else if (isExpense) {
        currentMonthExpense += amt;
        const cat = (tx.category || "Uncategorized").trim();
        categorySpendMap[cat] = (categorySpendMap[cat] || 0) + amt;

        const payee = (tx.payee || "Unknown").trim();
        payeeSpendMap[payee] = (payeeSpendMap[payee] || 0) + amt;
      }
    }
  }

  // Top categories sorted by spend this month
  const sortedCategories = Object.entries(categorySpendMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: currentMonthExpense > 0 ? (amount / currentMonthExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Top payees sorted by spend this month
  const sortedPayees = Object.entries(payeeSpendMap)
    .map(([payee, amount]) => ({ payee, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Budgets status: compare each budget category against total spending in that category
  const budgetStatuses = data.budgets.map((b) => {
    const catLower = b.category.toLowerCase().trim();
    const spent = data.transactions
      .filter(
        (t) =>
          t.category.toLowerCase().trim() === catLower &&
          (t.amount < 0 || t.type === "expense") &&
          t.type !== "transfer"
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const remaining = b.limit - spent;
    const percentUsed = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    let status: "healthy" | "warning" | "exceeded" = "healthy";
    if (percentUsed > 100) status = "exceeded";
    else if (percentUsed >= 80) status = "warning";

    return {
      category: b.category,
      limit: b.limit,
      spent,
      remaining,
      percentUsed,
      status,
    };
  });

  const totalBudgeted = data.budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalBudgetSpent = budgetStatuses.reduce((sum, b) => sum + b.spent, 0);
  const exceededBudgets = budgetStatuses.filter((b) => b.status === "exceeded");
  const warningBudgets = budgetStatuses.filter((b) => b.status === "warning");

  // Loans summary
  const totalLent = data.loans
    .filter((l) => l.type === "lent" && l.status !== "settled")
    .reduce((sum, l) => sum + (l.remainingAmount ?? l.initialAmount), 0);

  const totalBorrowed = data.loans
    .filter((l) => l.type === "borrowed" && l.status !== "settled")
    .reduce((sum, l) => sum + (l.remainingAmount ?? l.initialAmount), 0);

  // Flagged & Pending
  const pendingTransactions = data.transactions.filter((t) => t.status === "pending");
  const flaggedTransactions = data.transactions.filter((t) => t.status === "flagged");

  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const netSavings = currentMonthIncome - currentMonthExpense;
  const savingsRate =
    currentMonthIncome > 0
      ? Math.max(0, (netSavings / currentMonthIncome) * 100)
      : 0;

  return {
    sym,
    monthName,
    totalNetWorth,
    totalAssets,
    totalLiabilities,
    totalCashAndSavings,
    totalCreditDebt,
    totalInvestments,
    currentMonthIncome,
    currentMonthExpense,
    totalInflow,
    totalOutflow,
    netSavings,
    savingsRate,
    sortedCategories,
    sortedPayees,
    budgetStatuses,
    totalBudgeted,
    totalBudgetSpent,
    exceededBudgets,
    warningBudgets,
    totalLent,
    totalBorrowed,
    pendingTransactions,
    flaggedTransactions,
    recentTransactions: [...data.transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10),
  };
}

/**
 * Builds a structured system prompt rich in user's real financial data.
 */
export function buildFinancialSystemPrompt(data: AdvisorData): string {
  const m = calculateFinancialMetrics(data);
  const sym = m.sym;
  const userName = data.userName?.trim() || "User";
  const validCategories = data.categories.map((c) => c.name).join(", ");
  const validAccounts = data.accounts.map((a) => `"${a.name}"`).join(", ");

  const accountsSummary =
    data.accounts.length === 0
      ? "No accounts recorded yet."
      : data.accounts
          .map((a) => `- Account Name: "${a.name}" | Type: ${a.type} | Current Balance: ${a.balance < 0 ? "-" : ""}${sym}${Math.abs(a.balance).toFixed(2)}`)
          .join("\n");

  const budgetsSummary =
    m.budgetStatuses.length === 0
      ? "No budgets defined yet."
      : m.budgetStatuses
          .map(
            (b) =>
              `- ${b.category}: Spent ${sym}${b.spent.toFixed(2)} of ${sym}${b.limit.toFixed(2)} (${b.percentUsed.toFixed(0)}%) [Status: ${b.status.toUpperCase()}]`
          )
          .join("\n");

  const topCategoriesSummary =
    m.sortedCategories.length === 0
      ? "No categorized expenses this month."
      : m.sortedCategories
          .slice(0, 5)
          .map(
            (c) =>
              `- ${c.category}: ${sym}${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}% of month total)`
          )
          .join("\n");

  const topPayeesSummary =
    m.sortedPayees.length === 0
      ? "No payee data available."
      : m.sortedPayees.map((p) => `- ${p.payee}: ${sym}${p.amount.toFixed(2)}`).join("\n");

  const recentTxSummary =
    m.recentTransactions.length === 0
      ? "No transactions yet."
      : m.recentTransactions
          .map(
            (t) =>
              `- ID: "${t.id}" | ${t.date} | ${t.payee} | ${t.category} | ${t.amount < 0 ? "EXPENSE" : "INCOME"}: ${sym}${Math.abs(t.amount).toFixed(2)} | Status: ${t.status}`
          )
          .join("\n");

  // Format explicitly selected transactions if any
  let selectedSection = "";
  if (data.selectedTransactions && data.selectedTransactions.length > 0) {
    selectedSection = `\n*** HIGH PRIORITY: SPECIFIC TRANSACTIONS SELECTED BY USER FOR INQUIRY ***\nThe user has specifically selected the following ${data.selectedTransactions.length} transaction(s) to inspect or modify:\n` +
      data.selectedTransactions
        .map(
          (t) =>
            `- ID: "${t.id}" | Date: ${t.date} | Payee: "${t.payee}" | Category: "${t.category}" | Amount: ${sym}${Math.abs(t.amount).toFixed(2)} (${t.amount < 0 ? "EXPENSE" : "INCOME"}) | Account: "${t.account}" | Status: ${t.status} | Notes: "${t.notes || "None"}"`
        )
        .join("\n") +
      `\nFocus your answer primarily on these selected transactions!\n`;
  }

  // Format flagged transactions
  const flaggedDetails = m.flaggedTransactions.length === 0
    ? "None"
    : m.flaggedTransactions.map(
        (t) => `- ID: "${t.id}" | ${t.date} | ${t.payee} | ${t.category} | ${sym}${Math.abs(t.amount).toFixed(2)}`
      ).join("\n");

  return `You are Finly, a warm, highly skilled, and actionable personal financial advisor embedded directly within the Finly desktop app.
You are chatting with ${userName}.

CRITICAL INSTRUCTIONS:
- Answer directly, clearly, and concisely in friendly markdown.
- Do NOT output chain of thought or internal thinking steps.
- Always provide your direct conversational response and explanation first.
- When the user mentions an expense, spending, purchase, income, or transaction to record (e.g. "dinner with alex for 320rs", "spent 50 on groceries", "salary 5000"), you MUST append the :::finly_action block for create_transaction so the user can confirm it with 1 click!
- If recommending a category change or action on an existing transaction, explain why and append the action block at the end.

CURRENT DATE & CONTEXT:
- Today is: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
- Active reporting month: ${m.monthName}
- Currency: ${sym}
- Valid System Categories: [${validCategories || "Healthcare, Housing, Groceries, Dining Out, Utilities, Entertainment, Shopping, Transportation, Investments, Salary"}]
- Valid Existing Accounts: [${validAccounts}] (You MUST use the exact Name from this list!)
${selectedSection}
USER'S REAL FINANCIAL SNAPSHOT:
1. NET WORTH & ACCOUNTS:
- Total Net Worth: ${sym}${m.totalNetWorth.toFixed(2)}
- Total Assets: ${sym}${m.totalAssets.toFixed(2)}
- Total Liabilities: ${sym}${m.totalLiabilities.toFixed(2)}
Accounts:
${accountsSummary}

2. THIS MONTH'S CASH FLOW (${m.monthName}):
- Total Income: ${sym}${m.currentMonthIncome.toFixed(2)}
- Total Expenses: ${sym}${m.currentMonthExpense.toFixed(2)}
- Net Cash Flow: ${sym}${m.netSavings.toFixed(2)}
- Savings Rate: ${m.savingsRate.toFixed(1)}%

3. TOP SPENDING CATEGORIES THIS MONTH:
${topCategoriesSummary}

4. TOP PAYEES / MERCHANTS:
${topPayeesSummary}

5. BUDGET PERFORMANCE:
${budgetsSummary}

6. FLAGGED TRANSACTIONS FOR REVIEW (${m.flaggedTransactions.length}):
${flaggedDetails}

7. RECENT TRANSACTIONS (Latest 10):
${recentTxSummary}

ACTION PROTOCOL:
If the user mentions an expense, spending, purchase, income, or asks to create/record a transaction (e.g. "dinner with alex for 320rs", "Add dinner with Alex for $42", "I spent 150 on groceries", "Record salary 5000", "Transfer 200 from Chase to Savings"):
:::finly_action
{"type":"create_transaction","payee":"<PAYEE>","amount":<AMOUNT>,"transactionType":"expense"|"income"|"transfer","category":"<CATEGORY>","account":"<ACCOUNT>","date":"YYYY-MM-DD","notes":"<NOTES_OR_EMPTY>"}
:::

If the user asks to clean up, clarify, or make the transaction description/payee name more meaningful (e.g. converting messy bank codes like "BIL/ONL/.../Test" to a clean readable name):
:::finly_action
{"type":"update_payee","txId":"<TRANSACTION_ID>","payee":"<CURRENT_PAYEE>","newPayee":"<CLEAN_READABLE_NAME>","amount":<AMOUNT>}
:::

If the user asks to change or fix a transaction's category (e.g. "change Starbucks to Dining", "set category to Groceries"), or if you suggest fixing an incorrect category:
:::finly_action
{"type":"update_category","txId":"<TRANSACTION_ID>","payee":"<PAYEE>","amount":<AMOUNT>,"oldCategory":"<OLD_CATEGORY>","newCategory":"<NEW_CATEGORY>"}
:::

Or to clear a flag:
:::finly_action
{"type":"clear_flag","txId":"<TRANSACTION_ID>","payee":"<PAYEE>"}
:::

RULES FOR ACTIONS:
- For create_transaction, amount must be a positive number. Specify transactionType ("expense", "income", or "transfer").
- <ACCOUNT> must be the exact name string from Valid Existing Accounts: [${validAccounts}]. NEVER append suffixes like "(credit)", "(savings)", or "(checking)".
- <TRANSACTION_ID> must be the exact ID of the transaction (when updating existing transactions).
- newCategory or category should match one of the Valid System Categories if possible, or a sensible category name.
- Always explain clearly why you are recommending or performing the change.
- The UI will render this block as an interactive 1-click confirmation card for the user.`;
}

/**
 * Provides an instant, rule-based calculation answer when AI is offline or disabled.
 */
export function generateLocalFinancialAnswer(question: string, data: AdvisorData): string {
  const q = question.toLowerCase().trim();
  const m = calculateFinancialMetrics(data);
  const sym = m.sym;

  // Selected transactions inquiry
  if (data.selectedTransactions && data.selectedTransactions.length > 0) {
    const selected = data.selectedTransactions;

    // Request to clean or make description meaningful
    if (q.includes("description") || q.includes("meaningful") || q.includes("understandable") || q.includes("rename") || q.includes("clean")) {
      const firstTx = selected[0];
      const cleaned = firstTx.payee
        .replace(/^(?:BIL\/ONL\/\d+\/|UPI\/\d+\/|ACH\/[^\/]+\/)/i, "")
        .replace(/[\/-]/g, " ")
        .replace(/\b(?:remarkstest\w*|testname)\b/gi, "")
        .trim();
      const suggestedName = cleaned.length > 2 ? cleaned : "Utility / Bill Payment";

      return [
        `### 🏷️ Clean Transaction Description`,
        `The current description **"${firstTx.payee}"** appears to contain raw bank codes.`,
        `I recommend renaming it to **"${suggestedName}"** to make your records clean and recognizable.`,
        "",
        `Click the card below to apply this update:`,
        "",
        `:::finly_action`,
        JSON.stringify({
          type: "update_payee",
          txId: firstTx.id,
          payee: firstTx.payee,
          newPayee: suggestedName,
          amount: Math.abs(firstTx.amount),
        }),
        `:::`,
      ].join("\n");
    }

    // Request to change category
    if (q.includes("change") || q.includes("set") || q.includes("category") || q.includes("recategorize")) {
      // Find matching category in user categories
      const targetCategory = data.categories.find((c) =>
        q.includes(c.name.toLowerCase().trim())
      );

      const firstTx = selected[0];
      const newCat = targetCategory ? targetCategory.name : "Dining";

      return [
        `### 🏷️ Category Recategorization`,
        `I found the selected transaction for **${firstTx.payee}** (${sym}${Math.abs(firstTx.amount).toFixed(2)}) currently categorized under **${firstTx.category}**.`,
        "",
        `Click the card below to apply this update:`,
        "",
        `:::finly_action`,
        JSON.stringify({
          type: "update_category",
          txId: firstTx.id,
          payee: firstTx.payee,
          amount: Math.abs(firstTx.amount),
          oldCategory: firstTx.category,
          newCategory: newCat,
        }),
        `:::`,
      ].join("\n");
    }

    // Duplicate check
    if (q.includes("duplicate") || q.includes("same")) {
      const duplicates = data.transactions.filter(
        (t) =>
          selected.some((s) => s.id !== t.id && s.payee.toLowerCase() === t.payee.toLowerCase() && Math.abs(s.amount) === Math.abs(t.amount))
      );

      if (duplicates.length === 0) {
        return `### 🔍 Duplicate Check\nNo matching duplicate transactions found for the selected items in your records.`;
      }

      return [
        `### ⚠️ Potential Duplicate Transactions Found`,
        `Found ${duplicates.length} other transaction(s) with matching payee and amount:`,
        ...duplicates.map((d) => `- **${d.date}**: ${d.payee} (${d.category}) — ${sym}${Math.abs(d.amount).toFixed(2)}`),
      ].join("\n");
    }

    // Default breakdown of selected transactions
    return [
      `### 🔍 Selected Transactions (${selected.length})`,
      ...selected.map(
        (t) =>
          `- **${t.date}** | **${t.payee}** | Category: *${t.category}* | **${sym}${Math.abs(t.amount).toFixed(2)}** [Status: ${t.status}]`
      ),
      "",
      `*You can ask me to change categories, check for duplicates, or verify budget impact for these transactions.*`,
    ].join("\n");
  }

  // Natural language transaction creation request (e.g. "Add dinner for 42", "Spent 50 on groceries", "Record salary 5000")
  if (
    q.startsWith("add ") ||
    q.startsWith("record ") ||
    q.startsWith("log ") ||
    q.startsWith("create ") ||
    q.startsWith("spent ") ||
    q.startsWith("bought ") ||
    q.includes("add transaction") ||
    q.includes("record transaction") ||
    ((q.includes("spent") || q.includes("paid") || q.includes("for") || q.includes("salary")) && /\d+/.test(q))
  ) {
    const parsed = parseLocalNaturalLanguage(question, {
      accounts: data.accounts,
      categories: data.categories,
      currencySymbol: data.currencySymbol,
    });

    if (parsed.amount && parsed.amount > 0) {
      const typeLabel = parsed.type === "income" ? "Income" : parsed.type === "transfer" ? "Transfer" : "Expense";
      return [
        `### ➕ New Transaction Proposal`,
        `I've parsed your request and prepared a new **${typeLabel}** for **${parsed.payee}** (${sym}${parsed.amount.toFixed(2)}) under **${parsed.category || "Other"}**.`,
        "",
        `Click the card below to add it directly to your transaction records:`,
        "",
        `:::finly_action`,
        JSON.stringify({
          type: "create_transaction",
          payee: parsed.payee,
          amount: parsed.amount,
          transactionType: parsed.type,
          category: parsed.category || "Other",
          account: parsed.account || data.accounts[0]?.name || "Primary",
          toAccount: parsed.toAccount,
          date: parsed.date,
          notes: parsed.notes || "",
        }),
        `:::`,
      ].join("\n");
    }
  }

  // Net worth & Accounts
  if (
    q.includes("net worth") ||
    q.includes("total balance") ||
    q.includes("how much money") ||
    q.includes("all accounts") ||
    q.includes("account balance")
  ) {
    const lines = [
      `### 💰 Net Worth Overview`,
      `Your current **Net Worth is ${sym}${m.totalNetWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**.`,
      "",
      `**Assets vs Liabilities:**`,
      `- 📈 **Total Assets:** ${sym}${m.totalAssets.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      `- 📉 **Total Liabilities:** ${sym}${m.totalLiabilities.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      `- 💵 **Liquid Cash & Savings:** ${sym}${m.totalCashAndSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      "",
      `**Accounts (${data.accounts.length}):**`,
      ...data.accounts.map(
        (a) =>
          `- **${a.name}** (${a.type}): ${a.balance < 0 ? "-" : ""}${sym}${Math.abs(a.balance).toFixed(2)}`
      ),
    ];
    return lines.join("\n");
  }

  // Budget status & Over budget
  if (
    q.includes("budget") ||
    q.includes("over budget") ||
    q.includes("limit") ||
    q.includes("remaining")
  ) {
    if (data.budgets.length === 0) {
      return `### 📊 Budget Status\nYou don't have any budgets set up yet. Head over to the **Budgets** tab to set monthly limits for your categories!`;
    }

    const lines = [
      `### 📊 Budget Status Overview`,
      `Total Spent: **${sym}${m.totalBudgetSpent.toFixed(2)}** of **${sym}${m.totalBudgeted.toFixed(2)}** limit across ${data.budgets.length} budget(s).`,
      "",
    ];

    if (m.exceededBudgets.length > 0) {
      lines.push(`⚠️ **Exceeded Budgets (${m.exceededBudgets.length}):**`);
      for (const b of m.exceededBudgets) {
        lines.push(
          `- **${b.category}**: ${b.percentUsed.toFixed(0)}% used (${sym}${b.spent.toFixed(2)} / ${sym}${b.limit.toFixed(2)}) — Over by ${sym}${Math.abs(b.remaining).toFixed(2)}`
        );
      }
      lines.push("");
    }

    if (m.warningBudgets.length > 0) {
      lines.push(`⚡ **Approaching Limit (${m.warningBudgets.length}):**`);
      for (const b of m.warningBudgets) {
        lines.push(
          `- **${b.category}**: ${b.percentUsed.toFixed(0)}% used (${sym}${b.remaining.toFixed(2)} remaining)`
        );
      }
      lines.push("");
    }

    const healthy = m.budgetStatuses.filter((b) => b.status === "healthy");
    if (healthy.length > 0) {
      lines.push(`✅ **Healthy Budgets (${healthy.length}):**`);
      for (const b of healthy) {
        lines.push(
          `- **${b.category}**: ${b.percentUsed.toFixed(0)}% used (${sym}${b.remaining.toFixed(2)} left)`
        );
      }
    }

    return lines.join("\n");
  }

  // Spending / Expenses this month
  if (
    q.includes("spend") ||
    q.includes("expense") ||
    q.includes("cost") ||
    q.includes("outflow") ||
    q.includes("where did my money go")
  ) {
    const lines = [
      `### 💳 Spending Summary for ${m.monthName}`,
      `You have spent **${sym}${m.currentMonthExpense.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** this month.`,
      `*(Total recorded all-time expenses: ${sym}${m.totalOutflow.toLocaleString("en-US", { minimumFractionDigits: 2 })})*`,
      "",
    ];

    if (m.sortedCategories.length > 0) {
      lines.push(`**Top Spending Categories This Month:**`);
      for (const c of m.sortedCategories.slice(0, 5)) {
        lines.push(
          `- **${c.category}**: ${sym}${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}% of month total)`
        );
      }
      lines.push("");
    }

    if (m.sortedPayees.length > 0) {
      lines.push(`**Top Merchants / Payees This Month:**`);
      for (const p of m.sortedPayees) {
        lines.push(`- **${p.payee}**: ${sym}${p.amount.toFixed(2)}`);
      }
    }

    return lines.join("\n");
  }

  // Income / Cash flow / Savings rate
  if (
    q.includes("income") ||
    q.includes("cash flow") ||
    q.includes("savings rate") ||
    q.includes("save") ||
    q.includes("cut")
  ) {
    const isPositive = m.netSavings >= 0;
    const lines = [
      `### 📈 Cash Flow & Savings (${m.monthName})`,
      `- **Total Income:** ${sym}${m.currentMonthIncome.toFixed(2)}`,
      `- **Total Expenses:** ${sym}${m.currentMonthExpense.toFixed(2)}`,
      `- **Net Cash Flow:** ${isPositive ? "+" : "-"}${sym}${Math.abs(m.netSavings).toFixed(2)}`,
      `- **Savings Rate:** ${m.savingsRate.toFixed(1)}%`,
      "",
      `### 💡 Finly's Recommendations:`,
    ];

    if (m.exceededBudgets.length > 0) {
      lines.push(
        `- 🎯 **Rein in over-budget categories:** You've exceeded limits on **${m.exceededBudgets.map((b) => b.category).join(", ")}**. Look into pausing discretionary purchases in these categories.`
      );
    }

    if (m.sortedCategories.length > 0) {
      const top = m.sortedCategories[0];
      lines.push(
        `- 🔍 **Audit your largest expense:** Your highest spending category this month is **${top.category}** at ${sym}${top.amount.toFixed(2)} (${top.percentage.toFixed(0)}% of your total spending). Trimming 10% here could save **${sym}${(top.amount * 0.1).toFixed(2)}**.`
      );
    }

    return lines.join("\n");
  }

  // Pending / Flagged transactions
  if (q.includes("pending") || q.includes("flagged") || q.includes("review")) {
    const lines = [`### 🔍 Transactions Awaiting Attention`];
    if (m.pendingTransactions.length === 0 && m.flaggedTransactions.length === 0) {
      lines.push(
        `All clear! You have no pending transactions or items flagged for review. Your accounts are fully up to date.`
      );
    } else {
      if (m.pendingTransactions.length > 0) {
        lines.push(`**Pending Transactions (${m.pendingTransactions.length}):**`);
        for (const t of m.pendingTransactions.slice(0, 5)) {
          lines.push(`- ${t.date} | ${t.payee} (${t.category}): ${sym}${Math.abs(t.amount).toFixed(2)}`);
        }
        lines.push("");
      }
      if (m.flaggedTransactions.length > 0) {
        lines.push(`🚩 **Flagged for Review (${m.flaggedTransactions.length}):**`);
        for (const t of m.flaggedTransactions.slice(0, 5)) {
          lines.push(`- ${t.date} | ${t.payee} (${t.category}): ${sym}${Math.abs(t.amount).toFixed(2)}`);
        }
      }
    }
    return lines.join("\n");
  }

  // Recent transactions
  if (q.includes("recent") || q.includes("latest") || q.includes("last transaction")) {
    if (m.recentTransactions.length === 0) {
      return `### 🧾 Recent Transactions\nNo transactions found in your records.`;
    }
    const lines = [
      `### 🧾 Latest Transactions`,
      ...m.recentTransactions.map(
        (t) =>
          `- **${t.date}**: ${t.payee} (${t.category}) — ${t.amount < 0 ? "-" : "+"}${sym}${Math.abs(t.amount).toFixed(2)} [${t.status}]`
      ),
    ];
    return lines.join("\n");
  }

  // General fallback summary
  return [
    `### 👋 Hello! I'm Finly, your Financial Advisor.`,
    `Here is a quick snapshot of your finances:`,
    `- **Net Worth:** ${sym}${m.totalNetWorth.toFixed(2)} across ${data.accounts.length} account(s)`,
    `- **This Month's Spending:** ${sym}${m.currentMonthExpense.toFixed(2)}`,
    `- **This Month's Income:** ${sym}${m.currentMonthIncome.toFixed(2)}`,
    `- **Budgets Status:** ${m.exceededBudgets.length} exceeded, ${m.warningBudgets.length} nearing limit`,
    "",
    `💡 *Tip: You can select transactions in the table and click 'Ask Finly About Selected' to inspect or recategorize them.*`,
  ].join("\n");
}
