import { Component, createSignal, For, Show } from "solid-js";
import {
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  Clock,
  Trash2,
  Pencil,
  Flag,
  Upload,
  Receipt,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "./icons";
import { Transaction, Account } from "../types/finance";
import { ImportTransactionsModal } from "./ImportTransactionsModal";

interface TransactionsMainPageProps {
  transactions: Transaction[];
  accounts?: Account[];
  activeFilter: string;
  currencySymbol?: string;
  onFilterChange: (filter: string) => void;
  onOpenAddTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleFlagTransaction: (id: string) => void;
  onImportCSV?: (transactions: Omit<Transaction, "id">[]) => void;
}

export const TransactionsMainPage: Component<TransactionsMainPageProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTxId, setSelectedTxId] = createSignal<string | null>(null);
  const [importFile, setImportFile] = createSignal<{ fileName: string; text: string } | null>(null);

  // Sorting state
  type SortField = "date" | "payee" | "category" | "account" | "amount" | "status";
  type SortDirection = "asc" | "desc";

  const [sortField, setSortField] = createSignal<SortField>("date");
  const [sortDirection, setSortDirection] = createSignal<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortDirection(sortDirection() === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "amount" || field === "date" ? "desc" : "asc");
    }
  };

  const handleCSVFilePicked = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setImportFile({ fileName: file.name, text });
      }
    };
    reader.readAsText(file);
  };

  // Compute metrics (transfers are asset/liability shifts, excluded from income/expense)
  const totalInflow = () =>
    props.transactions
      .filter((t) => t.amount > 0 && t.type !== "transfer")
      .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = () =>
    props.transactions
      .filter((t) => t.amount < 0 && t.type !== "transfer")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const netCashFlow = () => totalInflow() - totalOutflow();

  const pendingCount = () =>
    props.transactions.filter((t) => t.status === "pending").length;

  // Filtered transactions
  const filteredTransactions = () => {
    return props.transactions.filter((tx) => {
      // Filter by tab
      if (props.activeFilter === "pending" && tx.status !== "pending") return false;
      if (props.activeFilter === "cleared" && tx.status !== "cleared") return false;
      if (props.activeFilter === "flagged" && tx.status !== "flagged") return false;
      if (props.activeFilter === "income" && (tx.amount <= 0 || tx.type === "transfer")) return false;
      if (props.activeFilter === "expense" && (tx.amount >= 0 || tx.type === "transfer")) return false;
      if (props.activeFilter === "transfer" && tx.type !== "transfer") return false;

      // Filter by search query
      if (searchQuery().trim()) {
        const query = searchQuery().toLowerCase();
        const matchesPayee = tx.payee.toLowerCase().includes(query);
        const matchesCat = tx.category.toLowerCase().includes(query);
        const matchesAcc = tx.account.toLowerCase().includes(query);
        const matchesToAcc = tx.toAccount?.toLowerCase().includes(query) ?? false;
        const matchesNotes = tx.notes?.toLowerCase().includes(query) ?? false;
        if (!matchesPayee && !matchesCat && !matchesAcc && !matchesToAcc && !matchesNotes) return false;
      }

      return true;
    });
  };

  // Sorted transactions
  const sortedTransactions = () => {
    const list = [...filteredTransactions()];
    const field = sortField();
    const dir = sortDirection() === "asc" ? 1 : -1;

    return list.sort((a, b) => {
      switch (field) {
        case "date": {
          const dA = a.date || "";
          const dB = b.date || "";
          if (dA !== dB) return dA.localeCompare(dB) * dir;
          return (b.id || "").localeCompare(a.id || "");
        }
        case "payee": {
          return (
            (a.payee || "").localeCompare(b.payee || "", undefined, {
              sensitivity: "base",
            }) * dir
          );
        }
        case "category": {
          return (
            (a.category || "").localeCompare(b.category || "", undefined, {
              sensitivity: "base",
            }) * dir
          );
        }
        case "account": {
          return (
            (a.account || "").localeCompare(b.account || "", undefined, {
              sensitivity: "base",
            }) * dir
          );
        }
        case "amount": {
          return (a.amount - b.amount) * dir;
        }
        case "status": {
          return (a.status || "").localeCompare(b.status || "") * dir;
        }
        default:
          return 0;
      }
    });
  };

  return (
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-main">Transactions</h1>
          <p class="text-xs text-text-muted mt-0.5">
            Manage your daily transactions, categorize spending, and review activity
          </p>
        </div>

        {/* Search & Actions */}
        <div class="flex items-center gap-3">
          <div class="relative w-64">
            <Search class="w-4 h-4 text-text-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

          <label class="inline-flex items-center gap-1.5 bg-card hover:bg-card-subtle border border-card-border text-text-muted hover:text-text-main text-xs font-semibold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer">
            <Upload class="w-3.5 h-3.5" />
            <span>Import CSV</span>
            <input
              type="file"
              accept=".csv"
              class="hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) handleCSVFilePicked(file);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <button
            type="button"
            onClick={props.onOpenAddTransaction}
            class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards (Matching theme from screenshot) */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income Card */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Inflow / Income</span>
            <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              +{symbol()}{totalInflow().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">Current month total</div>
        </div>

        {/* Outflow Card */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Outflow / Expenses</span>
            <span class="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <ArrowUpRight class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              -{symbol()}{totalOutflow().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">Tracked across all accounts</div>
        </div>

        {/* Net Savings Card */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Net Cash Flow</span>
            <span class="p-1.5 rounded-lg bg-primary-light text-primary">
              <TrendingUp class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span
              class={`text-2xl font-bold tracking-tight ${
                netCashFlow() >= 0 ? "text-primary" : "text-rose-500"
              }`}
            >
              {netCashFlow() >= 0 ? "+" : "-"}{symbol()}
              {Math.abs(netCashFlow()).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">
            {totalInflow() > 0
              ? `${((netCashFlow() / totalInflow()) * 100).toFixed(1)}% savings rate`
              : "0.0% savings rate"}
          </div>
        </div>

        {/* Pending Card */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Pending Review</span>
            <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Clock class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1 flex items-baseline gap-1.5">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              {pendingCount()}
            </span>
            <span class="text-xs font-medium text-text-muted">transactions</span>
          </div>
          <div class="text-xs text-text-muted mt-2">Awaiting bank settlement</div>
        </div>
      </div>

      {/* Sub-filters & Pill Tabs */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="inline-flex rounded-xl bg-card-subtle p-1 border border-card-border text-xs font-medium self-start">
          <button
            type="button"
            onClick={() => props.onFilterChange("all")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "all"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => props.onFilterChange("expense")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "expense"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => props.onFilterChange("income")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "income"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => props.onFilterChange("transfer")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "transfer"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Transfers
          </button>
          <button
            type="button"
            onClick={() => props.onFilterChange("pending")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "pending"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => props.onFilterChange("flagged")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "flagged"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Flagged
          </button>
        </div>

        <div class="text-xs text-text-muted font-medium">
          Showing {filteredTransactions().length} of {props.transactions.length} records
        </div>
      </div>

      {/* Main Transactions Register Table */}
      <div class="bg-card rounded-2xl border border-card-border shadow-xs overflow-hidden flex flex-col">
        <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-340px)]">
          <table class="w-full text-left text-xs text-text-main border-collapse">
            <thead class="sticky top-0 z-10 bg-card-subtle shadow-[0_1px_0_0_var(--color-card-border)] select-none">
              <tr class="text-[11px] font-bold text-text-muted uppercase tracking-wider bg-card-subtle">
                <th class="py-3 px-4 w-10 text-center sticky top-0 bg-card-subtle">#</th>

                {/* Sortable Date Header */}
                <th
                  onClick={() => handleSort("date")}
                  class="py-3 px-4 w-28 sticky top-0 bg-card-subtle cursor-pointer hover:text-text-main transition-colors"
                >
                  <div class="flex items-center gap-1.5">
                    <span>Date</span>
                    <Show
                      when={sortField() === "date"}
                      fallback={<ArrowUpDown class="w-3 h-3 text-text-subtle opacity-40" />}
                    >
                      {sortDirection() === "asc" ? (
                        <ArrowUp class="w-3 h-3 text-primary stroke-[2.5]" />
                      ) : (
                        <ArrowDown class="w-3 h-3 text-primary stroke-[2.5]" />
                      )}
                    </Show>
                  </div>
                </th>

                {/* Sortable Payee Header */}
                <th
                  onClick={() => handleSort("payee")}
                  class="py-3 px-4 sticky top-0 bg-card-subtle cursor-pointer hover:text-text-main transition-colors"
                >
                  <div class="flex items-center gap-1.5">
                    <span>Payee / Description</span>
                    <Show
                      when={sortField() === "payee"}
                      fallback={<ArrowUpDown class="w-3 h-3 text-text-subtle opacity-40" />}
                    >
                      {sortDirection() === "asc" ? (
                        <ArrowUp class="w-3 h-3 text-primary stroke-[2.5]" />
                      ) : (
                        <ArrowDown class="w-3 h-3 text-primary stroke-[2.5]" />
                      )}
                    </Show>
                  </div>
                </th>

                {/* Sortable Category Header */}
                <th
                  onClick={() => handleSort("category")}
                  class="py-3 px-4 sticky top-0 bg-card-subtle cursor-pointer hover:text-text-main transition-colors"
                >
                  <div class="flex items-center gap-1.5">
                    <span>Category</span>
                    <Show
                      when={sortField() === "category"}
                      fallback={<ArrowUpDown class="w-3 h-3 text-text-subtle opacity-40" />}
                    >
                      {sortDirection() === "asc" ? (
                        <ArrowUp class="w-3 h-3 text-primary stroke-[2.5]" />
                      ) : (
                        <ArrowDown class="w-3 h-3 text-primary stroke-[2.5]" />
                      )}
                    </Show>
                  </div>
                </th>

                {/* Sortable Account Header */}
                <th
                  onClick={() => handleSort("account")}
                  class="py-3 px-4 sticky top-0 bg-card-subtle cursor-pointer hover:text-text-main transition-colors"
                >
                  <div class="flex items-center gap-1.5">
                    <span>Account</span>
                    <Show
                      when={sortField() === "account"}
                      fallback={<ArrowUpDown class="w-3 h-3 text-text-subtle opacity-40" />}
                    >
                      {sortDirection() === "asc" ? (
                        <ArrowUp class="w-3 h-3 text-primary stroke-[2.5]" />
                      ) : (
                        <ArrowDown class="w-3 h-3 text-primary stroke-[2.5]" />
                      )}
                    </Show>
                  </div>
                </th>

                <th class="py-3 px-4 sticky top-0 bg-card-subtle">Notes</th>

                {/* Sortable Amount Header */}
                <th
                  onClick={() => handleSort("amount")}
                  class="py-3 px-4 text-right sticky top-0 bg-card-subtle cursor-pointer hover:text-text-main transition-colors"
                >
                  <div class="flex items-center justify-end gap-1.5">
                    <span>Amount</span>
                    <Show
                      when={sortField() === "amount"}
                      fallback={<ArrowUpDown class="w-3 h-3 text-text-subtle opacity-40" />}
                    >
                      {sortDirection() === "asc" ? (
                        <ArrowUp class="w-3 h-3 text-primary stroke-[2.5]" />
                      ) : (
                        <ArrowDown class="w-3 h-3 text-primary stroke-[2.5]" />
                      )}
                    </Show>
                  </div>
                </th>

                {/* Sortable Status Header */}
                <th
                  onClick={() => handleSort("status")}
                  class="py-3 px-4 text-center sticky top-0 bg-card-subtle cursor-pointer hover:text-text-main transition-colors"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    <Show
                      when={sortField() === "status"}
                      fallback={<ArrowUpDown class="w-3 h-3 text-text-subtle opacity-40" />}
                    >
                      {sortDirection() === "asc" ? (
                        <ArrowUp class="w-3 h-3 text-primary stroke-[2.5]" />
                      ) : (
                        <ArrowDown class="w-3 h-3 text-primary stroke-[2.5]" />
                      )}
                    </Show>
                  </div>
                </th>

                <th class="py-3 px-4 text-right w-20 sticky top-0 bg-card-subtle">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-card-border">
              <For
                each={sortedTransactions()}
                fallback={
                  <tr>
                    <td colspan="9" class="py-16 text-center text-text-muted">
                      <div class="max-w-xs mx-auto space-y-3">
                        <div class="w-12 h-12 rounded-2xl bg-card-subtle flex items-center justify-center text-text-subtle mx-auto">
                          <Receipt class="w-6 h-6" />
                        </div>
                        <div class="space-y-1">
                          <div class="text-sm font-bold text-text-main">
                            {props.transactions.length === 0
                              ? "No transactions yet"
                              : "No matching transactions found"}
                          </div>
                          <div class="text-xs text-text-subtle">
                            {props.transactions.length === 0
                              ? "Record your first expense or income to start tracking your finances."
                              : "Try adjusting your search query or selecting a different filter."}
                          </div>
                        </div>
                        {props.transactions.length === 0 && (
                          <div class="pt-2 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={props.onOpenAddTransaction}
                              class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
                            >
                              <Plus class="w-4 h-4" />
                              <span>Add Transaction</span>
                            </button>
                            <label class="inline-flex items-center gap-1.5 bg-card hover:bg-card-subtle border border-card-border text-text-muted hover:text-text-main text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer">
                              <Upload class="w-3.5 h-3.5" />
                              <span>Import CSV</span>
                              <input
                                type="file"
                                accept=".csv"
                                class="hidden"
                                onChange={(e) => {
                                  const file = e.currentTarget.files?.[0];
                                  if (file) handleCSVFilePicked(file);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                }
              >
                {(tx, idx) => {
                  const isSelected = () => selectedTxId() === tx.id;
                  const isTransfer = tx.type === "transfer";
                  const isIncome = !isTransfer && tx.amount > 0;

                  return (
                    <tr
                      onClick={() => setSelectedTxId(tx.id)}
                      onDblClick={() => props.onEditTransaction(tx)}
                      class={`transition-colors cursor-pointer relative ${
                        isSelected()
                          ? "bg-primary-light font-medium"
                          : "hover:bg-card-subtle"
                      }`}
                    >
                      <td class="py-3.5 px-4 text-center text-text-subtle relative">
                        {isSelected() && (
                          <span class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"></span>
                        )}
                        {idx() + 1}
                      </td>

                      <td class="py-3.5 px-4 text-text-muted whitespace-nowrap">
                        {tx.date}
                      </td>

                      <td class="py-3.5 px-4 font-semibold text-text-main">
                        <div class="flex items-center gap-2">
                          {isTransfer && (
                            <span class="p-1 rounded-md bg-primary-light text-primary shrink-0" title="Transfer">
                              <ArrowLeftRight class="w-3 h-3" />
                            </span>
                          )}
                          <span>{tx.payee}</span>
                        </div>
                      </td>

                      <td class="py-3.5 px-4">
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-card-subtle text-text-main border border-card-border"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full"
                            style={{ "background-color": tx.categoryColor || "#64748b" }}
                          ></span>
                          {tx.category}
                        </span>
                      </td>

                      <td class="py-3.5 px-4 text-text-muted whitespace-nowrap">
                        {isTransfer && tx.toAccount ? (
                          <div class="inline-flex items-center gap-1.5 font-medium">
                            <span class="text-text-main">{tx.account}</span>
                            <ArrowLeftRight class="w-3 h-3 text-primary shrink-0" />
                            <span class="text-primary font-semibold">{tx.toAccount}</span>
                          </div>
                        ) : (
                          tx.account
                        )}
                      </td>

                      <td class="py-3.5 px-4 text-text-subtle truncate max-w-xs">
                        {tx.notes || "—"}
                      </td>

                      <td
                        class={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${
                          isTransfer
                            ? "text-primary"
                            : isIncome
                            ? "text-emerald-500"
                            : "text-text-main"
                        }`}
                      >
                        {isTransfer ? "" : isIncome ? "+" : "-"}{symbol()}
                        {Math.abs(tx.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td class="py-3.5 px-4 text-center whitespace-nowrap">
                        {tx.status === "cleared" ? (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-badge-paid-bg text-badge-paid-text">
                            Cleared
                          </span>
                        ) : tx.status === "flagged" ? (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-badge-flag-bg text-badge-flag-text">
                            Flagged
                          </span>
                        ) : (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-card-subtle text-text-muted border border-card-border">
                            Pending
                          </span>
                        )}
                      </td>

                      <td class="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div class="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => props.onEditTransaction(tx)}
                            class="p-1.5 rounded-lg text-text-subtle hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                            title="Edit Transaction"
                          >
                            <Pencil class="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => props.onToggleFlagTransaction(tx.id)}
                            class={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              tx.status === "flagged"
                                ? "text-amber-500 hover:bg-amber-500/10"
                                : "text-text-subtle hover:text-text-main hover:bg-card-subtle"
                            }`}
                            title="Toggle Flag"
                          >
                            <Flag class="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => props.onDeleteTransaction(tx.id)}
                            class="p-1.5 rounded-lg text-text-subtle hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Transaction"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Import Review & Preview Modal */}
      {importFile() && (
        <ImportTransactionsModal
          csvText={importFile()!.text}
          fileName={importFile()!.fileName}
          accounts={props.accounts || []}
          currencySymbol={props.currencySymbol}
          onClose={() => setImportFile(null)}
          onImport={(imported) => {
            if (props.onImportCSV) {
              props.onImportCSV(imported);
            }
            setImportFile(null);
          }}
        />
      )}
    </div>
  );
};
