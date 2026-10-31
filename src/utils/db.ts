import { invoke } from "@tauri-apps/api/core";
import { Account, Transaction, UserProfile, BudgetItem, CategoryItem } from "../types/finance";

// Detect if we are running inside Tauri's webview
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function getUserProfile(): Promise<UserProfile | null> {
  if (isTauri()) {
    try {
      const json = await invoke<string | null>("get_setting", { key: "user_profile" });
      if (json) return JSON.parse(json);
    } catch (err) {
      console.error("Failed to load user profile from SQLite:", err);
    }
  }

  const local = localStorage.getItem("finly_user_profile");
  return local ? JSON.parse(local) : null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("set_setting", {
        key: "user_profile",
        value: JSON.stringify(profile),
      });
      return;
    } catch (err) {
      console.error("Failed to save user profile to SQLite:", err);
    }
  }

  localStorage.setItem("finly_user_profile", JSON.stringify(profile));
}

export async function fetchTransactions(): Promise<Transaction[]> {
  if (isTauri()) {
    try {
      return await invoke<Transaction[]>("get_transactions");
    } catch (err) {
      console.error("Failed to fetch transactions from SQLite:", err);
    }
  }

  // Browser fallback
  const local = localStorage.getItem("finly_transactions");
  return local ? JSON.parse(local) : [];
}

export async function insertTransaction(
  tx: Omit<Transaction, "id">
): Promise<Transaction> {
  if (isTauri()) {
    try {
      return await invoke<Transaction>("add_transaction", { transaction: tx });
    } catch (err) {
      console.error("Failed to add transaction to SQLite:", err);
    }
  }

  // Browser fallback
  const created: Transaction = {
    ...tx,
    id: `tx-${Date.now()}`,
  };
  const current = await fetchTransactions();
  localStorage.setItem("finly_transactions", JSON.stringify([created, ...current]));
  return created;
}

export async function updateExistingTransaction(
  tx: Transaction
): Promise<Transaction> {
  if (isTauri()) {
    try {
      return await invoke<Transaction>("update_transaction", { transaction: tx });
    } catch (err) {
      console.error("Failed to update transaction in SQLite:", err);
    }
  }

  // Browser fallback
  const current = await fetchTransactions();
  const updated = current.map((t) => (t.id === tx.id ? tx : t));
  localStorage.setItem("finly_transactions", JSON.stringify(updated));
  return tx;
}

export async function removeTransaction(id: string): Promise<boolean> {
  if (isTauri()) {
    try {
      return await invoke<boolean>("delete_transaction", { id });
    } catch (err) {
      console.error("Failed to delete transaction from SQLite:", err);
    }
  }

  // Browser fallback
  const current = await fetchTransactions();
  const filtered = current.filter((t) => t.id !== id);
  localStorage.setItem("finly_transactions", JSON.stringify(filtered));
  return true;
}

export async function toggleTransactionFlag(id: string): Promise<string> {
  if (isTauri()) {
    try {
      return await invoke<string>("toggle_flag_transaction", { id });
    } catch (err) {
      console.error("Failed to toggle flag in SQLite:", err);
    }
  }

  // Browser fallback
  const current = await fetchTransactions();
  let nextStatus = "flagged";
  const updated = current.map((t) => {
    if (t.id === id) {
      nextStatus = t.status === "flagged" ? "cleared" : "flagged";
      return { ...t, status: nextStatus as any };
    }
    return t;
  });
  localStorage.setItem("finly_transactions", JSON.stringify(updated));
  return nextStatus;
}

export async function batchImportTransactions(
  transactions: Omit<Transaction, "id">[]
): Promise<number> {
  if (isTauri()) {
    try {
      return await invoke<number>("import_transactions", { transactions });
    } catch (err) {
      console.error("Failed to bulk import transactions to SQLite:", err);
    }
  }

  // Browser fallback
  const withIds: Transaction[] = transactions.map((t, idx) => ({
    ...t,
    id: `tx-imp-${Date.now()}-${idx}`,
  }));
  const current = await fetchTransactions();
  localStorage.setItem("finly_transactions", JSON.stringify([...withIds, ...current]));
  return withIds.length;
}

export async function fetchAccounts(): Promise<Account[]> {
  if (isTauri()) {
    try {
      return await invoke<Account[]>("get_accounts");
    } catch (err) {
      console.error("Failed to fetch accounts from SQLite:", err);
    }
  }

  // Browser fallback
  const local = localStorage.getItem("finly_accounts");
  return local ? JSON.parse(local) : [];
}

export async function insertAccount(
  account: { name: string; type: string; balance?: number }
): Promise<Account> {
  if (isTauri()) {
    try {
      return await invoke<Account>("add_account", { account });
    } catch (err) {
      console.error("Failed to add account to SQLite:", err);
    }
  }

  const created: Account = {
    id: `acc-${Date.now()}`,
    name: account.name,
    type: account.type as any,
    balance: account.balance || 0.0,
  };
  const current = await fetchAccounts();
  localStorage.setItem("finly_accounts", JSON.stringify([...current, created]));
  return created;
}

export async function fetchBudgets(): Promise<BudgetItem[]> {
  if (isTauri()) {
    try {
      const json = await invoke<string | null>("get_setting", { key: "user_budgets" });
      if (json) return JSON.parse(json);
    } catch (err) {
      console.error("Failed to load budgets from SQLite:", err);
    }
  }

  const local = localStorage.getItem("finly_budgets");
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // fallback
    }
  }

  return [];
}

export async function saveBudgets(budgets: BudgetItem[]): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("set_setting", {
        key: "user_budgets",
        value: JSON.stringify(budgets),
      });
      return;
    } catch (err) {
      console.error("Failed to save budgets to SQLite:", err);
    }
  }

  localStorage.setItem("finly_budgets", JSON.stringify(budgets));
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "cat-housing", name: "Housing", color: "#2563eb", type: "expense", description: "Rent, mortgage, and home maintenance", isDefault: true },
  { id: "cat-groceries", name: "Groceries", color: "#10b981", type: "expense", description: "Food, household essentials, supermarkets", isDefault: true },
  { id: "cat-dining", name: "Dining Out", color: "#f59e0b", type: "expense", description: "Restaurants, cafes, food delivery", isDefault: true },
  { id: "cat-transport", name: "Transportation", color: "#8b5cf6", type: "expense", description: "Gas, transit, flights, rideshare", isDefault: true },
  { id: "cat-utilities", name: "Utilities", color: "#06b6d4", type: "expense", description: "Electricity, water, internet, phone", isDefault: true },
  { id: "cat-salary", name: "Salary", color: "#10b981", type: "income", description: "Employment income, payroll, wages", isDefault: true },
  { id: "cat-entertainment", name: "Entertainment", color: "#ec4899", type: "expense", description: "Movies, games, streaming services", isDefault: true },
  { id: "cat-healthcare", name: "Healthcare", color: "#ef4444", type: "expense", description: "Doctor visits, prescriptions, medical care", isDefault: true },
  { id: "cat-shopping", name: "Shopping", color: "#f97316", type: "expense", description: "Clothing, gadgets, retail purchases", isDefault: true },
  { id: "cat-travel", name: "Travel", color: "#14b8a6", type: "expense", description: "Hotels, vacations, travel bookings", isDefault: true },
  { id: "cat-education", name: "Education", color: "#6366f1", type: "expense", description: "Tuition, courses, books, learning", isDefault: true },
  { id: "cat-investment", name: "Investments", color: "#0ea5e9", type: "both", description: "Dividends, returns, capital gains", isDefault: true },
  { id: "cat-other", name: "Other", color: "#64748b", type: "both", description: "Miscellaneous expenses and income", isDefault: true },
];

export async function fetchCategories(): Promise<CategoryItem[]> {
  if (isTauri()) {
    try {
      const json = await invoke<string | null>("get_setting", { key: "user_categories" });
      if (json) {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error("Failed to load categories from SQLite:", err);
    }
  }

  const local = localStorage.getItem("finly_categories");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fallback to defaults
    }
  }

  // Seed default categories if none exist
  await saveCategories(DEFAULT_CATEGORIES);
  return DEFAULT_CATEGORIES;
}

export async function saveCategories(categories: CategoryItem[]): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("set_setting", {
        key: "user_categories",
        value: JSON.stringify(categories),
      });
      return;
    } catch (err) {
      console.error("Failed to save categories to SQLite:", err);
    }
  }

  localStorage.setItem("finly_categories", JSON.stringify(categories));
}

export async function reassignCategoryTransactions(
  oldCatName: string,
  newCatName: string,
  newColor: string
): Promise<number> {
  const allTxs = await fetchTransactions();
  const normalizedOld = oldCatName.toLowerCase().trim();
  const affected = allTxs.filter((t) => t.category.toLowerCase().trim() === normalizedOld);

  if (affected.length === 0) return 0;

  for (const tx of affected) {
    const updated: Transaction = {
      ...tx,
      category: newCatName,
      categoryColor: newColor,
    };
    await updateExistingTransaction(updated);
  }

  return affected.length;
}
