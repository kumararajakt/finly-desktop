import { Transaction } from "../types/finance";

export function parseTransactionsCSV(csvText: string): Omit<Transaction, "id">[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const header = parseCSVLine(lines[0].toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes("date"));
  const detailsIdx = header.findIndex((h) => h.includes("detail") || h.includes("payee") || h.includes("description"));
  const typeIdx = header.findIndex((h) => h.includes("type"));
  const amountIdx = header.findIndex((h) => h.includes("amount"));
  const accountIdx = header.findIndex((h) => h.includes("account"));
  const categoryIdx = header.findIndex((h) => h.includes("category"));
  const notesIdx = header.findIndex((h) => h.includes("note"));

  const results: Omit<Transaction, "id">[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0 || !cols[dateIdx]) continue;

    const rawAmount = (cols[amountIdx] || "0").replace(/,/g, "").trim();
    const parsedAmount = Math.abs(parseFloat(rawAmount) || 0);

    const rawType = (cols[typeIdx] || "").toLowerCase().trim();
    const isCredit = rawType === "credit" || rawType === "income" || rawType === "inflow";

    const finalAmount = isCredit ? parsedAmount : -parsedAmount;

    results.push({
      date: cols[dateIdx]?.trim() || new Date().toISOString().split("T")[0],
      payee: cols[detailsIdx]?.trim() || "Untitled Transaction",
      category: cols[categoryIdx]?.trim() || "General",
      categoryColor: getCategoryColor(cols[categoryIdx]?.trim() || "General"),
      account: cols[accountIdx]?.trim() || "Main Account",
      amount: finalAmount,
      type: isCredit ? "income" : "expense",
      status: "cleared",
      notes: cols[notesIdx]?.trim() || undefined,
    });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function getCategoryColor(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("food") || cat.includes("dining") || cat.includes("cafeteria")) return "#f59e0b";
  if (cat.includes("fuel") || cat.includes("transport")) return "#8b5cf6";
  if (cat.includes("grocer")) return "#10b981";
  if (cat.includes("salary") || cat.includes("income") || cat.includes("waiver")) return "#10b981";
  if (cat.includes("shopping")) return "#ec4899";
  if (cat.includes("housing") || cat.includes("rent") || cat.includes("mortgage")) return "#2563eb";
  return "#64748b";
}
