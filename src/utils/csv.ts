import { Transaction, Account } from "../types/finance";

export type AmountMode = "single" | "double" | "type_column";

export interface ColumnMappingConfig {
  dateCol: string;
  dateFormat: "auto" | "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
  payeeCol: string;
  notesCol: string;
  
  // Account config
  accountSource: "column" | "fixed";
  accountCol: string;
  fixedAccount: string;
  
  // Category config
  categorySource: "column" | "auto" | "fixed";
  categoryCol: string;
  fixedCategory: string;

  // Amount config
  amountMode: AmountMode;
  
  // Single column mode (+ / - in one column)
  singleAmountCol: string;
  invertSingleAmount: boolean; // true if positive = expense, negative = income

  // Double column mode (Debit / Credit separate)
  debitCol: string;   // Expense / Outflow
  creditCol: string;  // Income / Inflow

  // Type column mode (Amount + Debit/Credit type)
  amountCol: string;
  typeCol: string;
  creditIndicators: string; // e.g. "credit, cr, deposit, income, inflow"
  debitIndicators: string;  // e.g. "debit, dr, withdrawal, expense, outflow"

  defaultStatus: "cleared" | "pending";
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface ParsedTransactionRow {
  id: string;
  rawRowIndex: number;
  selected: boolean;
  isValid: boolean;
  error?: string;
  transaction: Omit<Transaction, "id">;
  rawRow: string[];
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  selectedCount: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
}

/**
 * Robust CSV string parser handling quotes, commas inside quotes, escaped quotes,
 * and different line delimiters.
 */
export function parseRawCSV(csvText: string): ParsedCSV {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const firstLine = csvText.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const delimiter =
    semiCount > commaCount && semiCount > tabCount
      ? ";"
      : tabCount > commaCount
      ? "\t"
      : ",";

  let i = 0;
  while (i < csvText.length) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }
    if (!inQuotes && char === delimiter) {
      row.push(cell.trim());
      cell = "";
      i++;
      continue;
    }
    if (!inQuotes && (char === "\r" || char === "\n")) {
      if (char === "\r" && csvText[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) lines.push(row);
      row = [];
      i++;
      continue;
    }
    cell += char;
    i++;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) lines.push(row);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // Strip byte order marks from first header if present
  const rawHeaders = lines[0].map((h, idx) => {
    let clean = h.replace(/^\uFEFF/, "").trim();
    return clean || `Column ${idx + 1}`;
  });

  const dataRows = lines.slice(1).filter((r) => r.some((c) => c.trim().length > 0));

  return {
    headers: rawHeaders,
    rows: dataRows,
    totalRows: dataRows.length,
  };
}

/**
 * Intelligent auto-detection of column mapping based on standard bank CSV headers.
 */
export function detectDefaultMapping(
  headers: string[],
  rows: string[][],
  accounts: Account[]
): ColumnMappingConfig {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const findHeaderMatch = (
    exactKeywords: string[],
    substringKeywords: string[]
  ): string => {
    // 1. Exact match check
    for (const kw of exactKeywords) {
      const idx = lowerHeaders.findIndex(
        (h) => h === kw || h.replace(/[^a-z0-9]/g, "") === kw
      );
      if (idx !== -1) return headers[idx];
    }
    // 2. Substring / word boundary check
    for (const kw of substringKeywords) {
      const idx = lowerHeaders.findIndex((h) => {
        const words = h.replace(/[^a-z0-9]/g, " ").split(/\s+/);
        return words.includes(kw) || h.includes(kw);
      });
      if (idx !== -1) return headers[idx];
    }
    return "";
  };

  const dateCol =
    findHeaderMatch(
      ["date", "txn date", "tx date", "value date", "booking date", "posting date"],
      ["date", "time"]
    ) || (headers.length > 0 ? headers[0] : "");

  const payeeCol =
    findHeaderMatch(
      ["description", "payee", "particulars", "narration", "narrative", "merchant", "details", "beneficiary"],
      ["description", "payee", "desc", "details", "narrat", "partic", "merchant", "name"]
    ) || (headers.length > 1 ? headers[1] : "");

  const debitCol = findHeaderMatch(
    ["debit", "withdrawal", "withdrawals", "dr", "paid out", "outflow", "spent"],
    ["debit", "withdrawal", "paid out", "outflow", "debit amount"]
  );

  const creditCol = findHeaderMatch(
    ["credit", "deposit", "deposits", "cr", "paid in", "inflow", "received"],
    ["credit", "deposit", "paid in", "inflow", "credit amount"]
  );

  const typeCol = findHeaderMatch(
    ["type", "txn type", "trans type", "cr/dr", "cr_dr", "d/c", "status"],
    ["type", "dr/cr", "cr/dr"]
  );

  const amountCol = findHeaderMatch(
    ["amount", "amt", "net amount", "total", "value", "sum", "trans amount"],
    ["amount", "amt", "total", "value"]
  );

  const categoryCol = findHeaderMatch(
    ["category", "cat", "classification", "tag"],
    ["category", "tag"]
  );

  const accountCol = findHeaderMatch(
    ["account", "acc", "account name", "account number"],
    ["account"]
  );

  const notesCol = findHeaderMatch(
    ["notes", "note", "memo", "reference", "ref no", "chq no", "remarks", "comment"],
    ["notes", "note", "memo", "reference", "remark"]
  );

  // Determine amount mode
  let amountMode: AmountMode = "single";
  if (debitCol && creditCol && debitCol !== creditCol) {
    amountMode = "double";
  } else if (typeCol && amountCol && typeCol !== amountCol) {
    amountMode = "type_column";
  }

  const defaultAccountName = accounts[0]?.name || "Main Account";

  return {
    dateCol,
    dateFormat: "auto",
    payeeCol,
    notesCol: notesCol || "",
    accountSource: accountCol ? "column" : "fixed",
    accountCol: accountCol || "",
    fixedAccount: defaultAccountName,
    categorySource: categoryCol ? "column" : "auto",
    categoryCol: categoryCol || "",
    fixedCategory: "General",
    amountMode,
    singleAmountCol: amountCol || debitCol || creditCol || (headers[2] || ""),
    invertSingleAmount: false,
    debitCol: debitCol || "",
    creditCol: creditCol || "",
    amountCol: amountCol || (headers[2] || ""),
    typeCol: typeCol || "",
    creditIndicators: "credit, cr, deposit, income, inflow, refund, +",
    debitIndicators: "debit, dr, withdrawal, expense, outflow, payment, fee, -",
    defaultStatus: "cleared",
  };
}

/**
 * Parse an amount string into numeric value with signs handled.
 * Supports: -45.50, +1200, (100.00), $1,250.00, ₹ 45,000.50, 1.250,50 (European)
 */
export function parseNumericAmount(raw: string | undefined): number {
  if (!raw) return 0;
  let str = raw.trim();
  if (!str) return 0;

  const isParenNegative = /^\(.*\)$/.test(str);
  if (isParenNegative) {
    str = str.replace(/^\(|\)$/g, "").trim();
  }

  const isNegative = isParenNegative || str.startsWith("-") || str.endsWith("-");

  // Keep only digits, dots, commas
  str = str.replace(/[^0-9.,]/g, "");
  if (!str) return 0;

  // Handle European comma decimals
  if (str.includes(",") && str.includes(".")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      // 1.250,50 -> dot is thousand, comma is decimal
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,250.50 -> comma is thousand, dot is decimal
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      str = str.replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  }

  const val = parseFloat(str);
  if (isNaN(val)) return 0;
  return isNegative ? -Math.abs(val) : Math.abs(val);
}

/**
 * Standardize date strings to YYYY-MM-DD
 */
export function parseCustomDate(
  raw: string | undefined,
  format: "auto" | "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" = "auto"
): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  const s = raw.trim();

  // Check textual month representation e.g. "15-Mar-2024", "15 Mar 2024", "March 15, 2024"
  const monthsMap: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  const textMatch = s.match(/(\d{1,2})[-/\s]+([a-zA-Z]{3,})[-/\s,]+(\d{2,4})/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, "0");
    const mStr = textMatch[2].toLowerCase().slice(0, 3);
    const month = monthsMap[mStr] || "01";
    let yr = textMatch[3];
    if (yr.length === 2) yr = "20" + yr;
    return `${yr}-${month}-${day}`;
  }

  const textMatch2 = s.match(/([a-zA-Z]{3,})[-/\s]+(\d{1,2})[-/\s,]+(\d{2,4})/);
  if (textMatch2) {
    const mStr = textMatch2[1].toLowerCase().slice(0, 3);
    const month = monthsMap[mStr] || "01";
    const day = textMatch2[2].padStart(2, "0");
    let yr = textMatch2[3];
    if (yr.length === 2) yr = "20" + yr;
    return `${yr}-${month}-${day}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    let year = slashMatch[3];
    if (year.length === 2) {
      year = (parseInt(year, 10) > 70 ? "19" : "20") + year;
    }

    let day = p1;
    let month = p2;
    if (format === "MM/DD/YYYY" || (format === "auto" && p1 <= 12 && p2 > 12)) {
      month = p1;
      day = p2;
    } else if (format === "DD/MM/YYYY" || (format === "auto" && p1 > 12 && p2 <= 12)) {
      day = p1;
      month = p2;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Generic fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split("T")[0];
}

/**
 * Calculates transaction amount and income/expense type based on configuration
 */
export function resolveRowAmount(
  row: string[],
  colIndices: Record<string, number>,
  config: ColumnMappingConfig
): { amount: number; type: "income" | "expense" } | null {
  if (config.amountMode === "single") {
    const colIdx = colIndices[config.singleAmountCol];
    if (colIdx === undefined || !row[colIdx]) return null;

    const rawVal = row[colIdx];
    let num = parseNumericAmount(rawVal);
    if (isNaN(num) || num === 0) return null;

    if (config.invertSingleAmount) {
      num = -num;
    }

    const isIncome = num > 0;
    return {
      amount: num,
      type: isIncome ? "income" : "expense",
    };
  }

  if (config.amountMode === "double") {
    const debitIdx = colIndices[config.debitCol];
    const creditIdx = colIndices[config.creditCol];

    const rawDebit = debitIdx !== undefined ? row[debitIdx] : "";
    const rawCredit = creditIdx !== undefined ? row[creditIdx] : "";

    const debitVal = Math.abs(parseNumericAmount(rawDebit));
    const creditVal = Math.abs(parseNumericAmount(rawCredit));

    if (creditVal > 0 && debitVal === 0) {
      return { amount: creditVal, type: "income" };
    }
    if (debitVal > 0 && creditVal === 0) {
      return { amount: -debitVal, type: "expense" };
    }
    if (creditVal > 0 && debitVal > 0) {
      const net = creditVal - debitVal;
      return {
        amount: net,
        type: net >= 0 ? "income" : "expense",
      };
    }
    return null;
  }

  if (config.amountMode === "type_column") {
    const amountIdx = colIndices[config.amountCol];
    const typeIdx = colIndices[config.typeCol];

    if (amountIdx === undefined || !row[amountIdx]) return null;

    const rawAmount = row[amountIdx];
    const rawType = typeIdx !== undefined ? (row[typeIdx] || "").toLowerCase().trim() : "";

    const magnitude = Math.abs(parseNumericAmount(rawAmount));
    if (magnitude === 0) return null;

    const creditKeywords = config.creditIndicators
      .toLowerCase()
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const debitKeywords = config.debitIndicators
      .toLowerCase()
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const isCredit = creditKeywords.some((kw) => rawType.includes(kw) || rawType === kw);
    const isDebit = debitKeywords.some((kw) => rawType.includes(kw) || rawType === kw);

    if (isCredit) {
      return { amount: magnitude, type: "income" };
    }
    if (isDebit) {
      return { amount: -magnitude, type: "expense" };
    }

    // If ambiguous type column, inspect raw amount sign
    const signAmount = parseNumericAmount(rawAmount);
    return {
      amount: signAmount >= 0 ? magnitude : -magnitude,
      type: signAmount >= 0 ? "income" : "expense",
    };
  }

  return null;
}

/**
 * Intelligent categorization based on payee keywords
 */
export function autoCategorizeByPayee(payee: string): string {
  const p = payee.toLowerCase();
  if (p.includes("walmart") || p.includes("kroger") || p.includes("whole food") || p.includes("trader joe") || p.includes("grocer") || p.includes("supermarket") || p.includes("costco") || p.includes("target")) {
    return "Groceries";
  }
  if (p.includes("restaurant") || p.includes("cafe") || p.includes("coffee") || p.includes("starbucks") || p.includes("mcdonald") || p.includes("subway") || p.includes("burger") || p.includes("pizza") || p.includes("dining") || p.includes("bistro")) {
    return "Dining Out";
  }
  if (p.includes("uber") || p.includes("lyft") || p.includes("shell") || p.includes("chevron") || p.includes("exxon") || p.includes("gas") || p.includes("fuel") || p.includes("transit") || p.includes("metro") || p.includes("airline") || p.includes("flight")) {
    return "Transportation";
  }
  if (p.includes("electric") || p.includes("water") || p.includes("utility") || p.includes("internet") || p.includes("at&t") || p.includes("verizon") || p.includes("t-mobile") || p.includes("wifi")) {
    return "Utilities";
  }
  if (p.includes("salary") || p.includes("payroll") || p.includes("direct dep") || p.includes("stipend") || p.includes("employer") || p.includes("dividend") || p.includes("interest")) {
    return "Salary";
  }
  if (p.includes("netflix") || p.includes("spotify") || p.includes("cinema") || p.includes("movie") || p.includes("theatre") || p.includes("hulu") || p.includes("disney") || p.includes("game") || p.includes("steam") || p.includes("playstation")) {
    return "Entertainment";
  }
  if (p.includes("pharmacy") || p.includes("doctor") || p.includes("hospital") || p.includes("clinic") || p.includes("health") || p.includes("dental") || p.includes("cvs") || p.includes("walgreens")) {
    return "Healthcare";
  }
  if (p.includes("amazon") || p.includes("clothing") || p.includes("apparel") || p.includes("shoes") || p.includes("mall") || p.includes("ebay") || p.includes("store")) {
    return "Shopping";
  }
  if (p.includes("rent") || p.includes("mortgage") || p.includes("apartment") || p.includes("realty") || p.includes("landlord")) {
    return "Housing";
  }
  if (p.includes("tuition") || p.includes("udemy") || p.includes("coursera") || p.includes("school") || p.includes("college") || p.includes("course") || p.includes("book")) {
    return "Education";
  }
  return "General";
}

export function getCategoryColor(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("food") || cat.includes("dining") || cat.includes("cafeteria") || cat.includes("restaurant")) return "#f59e0b";
  if (cat.includes("fuel") || cat.includes("transport") || cat.includes("gas") || cat.includes("transit")) return "#8b5cf6";
  if (cat.includes("grocer") || cat.includes("market") || cat.includes("supermarket")) return "#10b981";
  if (cat.includes("salary") || cat.includes("income") || cat.includes("waiver") || cat.includes("dividend") || cat.includes("deposit")) return "#10b981";
  if (cat.includes("shopping") || cat.includes("clothing") || cat.includes("store")) return "#ec4899";
  if (cat.includes("housing") || cat.includes("rent") || cat.includes("mortgage")) return "#2563eb";
  if (cat.includes("utilit") || cat.includes("bill") || cat.includes("electric") || cat.includes("water") || cat.includes("internet")) return "#06b6d4";
  if (cat.includes("health") || cat.includes("medical") || cat.includes("pharmacy")) return "#ef4444";
  if (cat.includes("entertain") || cat.includes("movie") || cat.includes("game")) return "#ec4899";
  if (cat.includes("educat") || cat.includes("course") || cat.includes("school")) return "#6366f1";
  if (cat.includes("transfer")) return "#6366f1";
  return "#64748b";
}

/**
 * Transforms CSV rows into validated parsed transaction items ready for preview & import.
 */
export function convertRowsToTransactions(
  headers: string[],
  rows: string[][],
  config: ColumnMappingConfig,
  accounts: Account[]
): { items: ParsedTransactionRow[]; summary: ImportSummary } {
  const colIndices: Record<string, number> = {};
  headers.forEach((h, idx) => {
    colIndices[h] = idx;
  });

  const dateIdx = colIndices[config.dateCol];
  const payeeIdx = colIndices[config.payeeCol];
  const notesIdx = config.notesCol ? colIndices[config.notesCol] : undefined;
  const catIdx = config.categoryCol ? colIndices[config.categoryCol] : undefined;
  const accIdx = config.accountCol ? colIndices[config.accountCol] : undefined;

  const defaultAccountName = config.fixedAccount || accounts[0]?.name || "Main Account";

  let totalIncome = 0;
  let totalExpense = 0;
  let validRows = 0;
  let invalidRows = 0;

  const items: ParsedTransactionRow[] = rows.map((row, rIdx) => {
    const rawDate = dateIdx !== undefined ? row[dateIdx] : undefined;
    const rawPayee = payeeIdx !== undefined ? row[payeeIdx] : undefined;
    const rawNotes = notesIdx !== undefined ? row[notesIdx] : undefined;

    const amountResult = resolveRowAmount(row, colIndices, config);

    let isValid = true;
    let error: string | undefined = undefined;

    if (!amountResult) {
      isValid = false;
      error = "Missing or invalid amount";
    } else if (!rawDate || rawDate.trim().length === 0) {
      isValid = false;
      error = "Missing date";
    }

    const parsedDate = parseCustomDate(rawDate, config.dateFormat);
    const payee = (rawPayee || "").trim() || "Untitled Transaction";

    // Resolve Category
    let category = "General";
    if (config.categorySource === "fixed") {
      category = config.fixedCategory || "General";
    } else if (config.categorySource === "column" && catIdx !== undefined && row[catIdx]?.trim()) {
      category = row[catIdx].trim();
    } else if (config.categorySource === "auto" || !category || category === "General") {
      category = autoCategorizeByPayee(payee);
    }

    // Resolve Account
    let account = defaultAccountName;
    if (config.accountSource === "column" && accIdx !== undefined && row[accIdx]?.trim()) {
      account = row[accIdx].trim();
    } else {
      account = config.fixedAccount || defaultAccountName;
    }

    const amount = amountResult ? amountResult.amount : 0;
    const type = amountResult ? amountResult.type : "expense";

    if (isValid) {
      validRows++;
      if (amount > 0) {
        totalIncome += amount;
      } else {
        totalExpense += Math.abs(amount);
      }
    } else {
      invalidRows++;
    }

    return {
      id: `row-${rIdx}`,
      rawRowIndex: rIdx,
      selected: isValid,
      isValid,
      error,
      transaction: {
        date: parsedDate,
        payee,
        category,
        categoryColor: getCategoryColor(category),
        account,
        amount,
        type,
        status: config.defaultStatus || "cleared",
        notes: rawNotes?.trim() || undefined,
      },
      rawRow: row,
    };
  });

  return {
    items,
    summary: {
      totalRows: rows.length,
      validRows,
      invalidRows,
      selectedCount: validRows,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
    },
  };
}

/**
 * Legacy one-shot parser kept for compatibility
 */
export function parseTransactionsCSV(csvText: string): Omit<Transaction, "id">[] {
  const parsed = parseRawCSV(csvText);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) return [];

  const config = detectDefaultMapping(parsed.headers, parsed.rows, []);
  const { items } = convertRowsToTransactions(parsed.headers, parsed.rows, config, []);

  return items.filter((item) => item.isValid).map((item) => item.transaction);
}
