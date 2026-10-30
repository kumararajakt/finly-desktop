import { invoke } from "@tauri-apps/api/core";
import { Account, Transaction, UserProfile } from "../types/finance";

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
  return local
    ? JSON.parse(local)
    : [
        { id: "1", name: "Chase Checking", type: "checking", balance: 0.0 },
        { id: "2", name: "High-Yield Savings", type: "savings", balance: 0.0 },
        { id: "3", name: "Credit Card", type: "credit", balance: 0.0 },
      ];
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
