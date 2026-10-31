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
  Filter,
  X,
  Download,
  Check,
  Sparkles,
} from "./icons";
import { Transaction, Account, CategoryItem } from "../types/finance";
import { ImportTransactionsModal } from "./ImportTransactionsModal";
import { exportTransactionsToCSV, downloadCSV } from "../utils/csv";

interface TransactionsMainPageProps {
  transactions: Transaction[];
  accounts?: Account[];
  categories?: CategoryItem[];
  activeFilter: string;
  currencySymbol?: string;
  isAiEnabled?: boolean;
  onFilterChange: (filter: string) => void;
  onOpenAddTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleFlagTransaction: (id: string) => void;
  onImportCSV?: (transactions: Omit<Transaction, "id">[]) => void;
  onOpenAskFinly?: (initialPrompt?: string, selectedTransactions?: Transaction[]) => void;
}

export const TransactionsMainPage: Component<TransactionsMainPageProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTxId, setSelectedTxId] = createSignal<string | null>(null);
  const [selectedTxIds, setSelectedTxIds] = createSignal<string[]>([]);
  const [importFile, setImportFile] = createSignal<{ fileName: string; text: string } | null>(null);

  // Advanced Filters State
  const [showFilters, setShowFilters] = createSignal(false);
  const [filterAccount, setFilterAccount] = createSignal("");
  const [filterCategory, setFilterCategory] = createSignal("");
  const [filterDatePreset, setFilterDatePreset] = createSignal<
    "all" | "this_month" | "last_month" | "last_30_days" | "this_year" | "custom"
  >("all");
  const [customStartDate, setCustomStartDate] = createSignal("");
  const [customEndDate, setCustomEndDate] = createSignal("");
  const [filterMinAmount, setFilterMinAmount] = createSignal("");
  const [filterMaxAmount, setFilterMaxAmount] = createSignal("");

  const activeFiltersCount = () => {
    let count = 0;
    if (filterAccount()) count++;
    if (filterCategory()) count++;
    if (filterDatePreset() !== "all") count++;
    if (filterMinAmount()) count++;
    if (filterMaxAmount()) count++;
    return count;
  };

  const clearAllFilters = () => {
    setFilterAccount("");
    setFilterCategory("");
    setFilterDatePreset("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
  };

  const [exportSuccessMessage, setExportSuccessMessage] = createSignal(false);

  const handleExportCSV = async () => {
    const list = sortedTransactions();
    if (list.length === 0) return;

    // Generate descriptive filename based on active filters
    const today = new Date().toISOString().slice(0, 10);
    let filename = `finly_transactions_${today}.csv`;
    if (filterCategory()) {
      filename = `finly_transactions_${filterCategory().toLowerCase().replace(/\s+/g, "_")}_${today}.csv`;
    } else if (filterAccount()) {
      filename = `finly_transactions_${filterAccount().toLowerCase().replace(/\s+/g, "_")}_${today}.csv`;
    } else if (activeFiltersCount() > 0 || props.activeFilter !== "all" || searchQuery().trim()) {
      filename = `finly_transactions_filtered_${today}.csv`;
    }

    const csvContent = exportTransactionsToCSV(list);
    const saved = await downloadCSV(filename, csvContent);

    if (saved) {
      setExportSuccessMessage(true);
      setTimeout(() => {
        setExportSuccessMessage(false);
      }, 2500);
    }
  };

  const allAccountsList = () => {
    const list = new Set<string>();
    props.accounts?.forEach((a) => list.add(a.name));
    props.transactions.forEach((t) => {
      if (t.account) list.add(t.account);
    });
    return Array.from(list);
  };

  const allCategoriesList = () => {
    const list = new Set<string>();
    props.categories?.forEach((c) => list.add(c.name));
    props.transactions.forEach((t) => {
      if (t.category) list.add(t.category);
    });
    return Array.from(list);
  };

  const matchesDatePreset = (txDate: string) => {
    const preset = filterDatePreset();
    if (preset === "all") return true;
    if (!txDate) return false;

    const now = new Date();
    const tx = new Date(txDate);
    if (isNaN(tx.getTime())) return true;

    if (preset === "this_month") {
      return (
        tx.getFullYear() === now.getFullYear() && tx.getMonth() === now.getMonth()
      );
    }
    if (preset === "last_month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return (
        tx.getFullYear() === lastMonth.getFullYear() &&
        tx.getMonth() === lastMonth.getMonth()
      );
    }
    if (preset === "last_30_days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return tx >= thirtyDaysAgo && tx <= now;
    }
    if (preset === "this_year") {
      return tx.getFullYear() === now.getFullYear();
    }
    if (preset === "custom") {
      const start = customStartDate();
      const end = customEndDate();
      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      return true;
    }
    return true;
  };

  const matchesAmountRange = (amount: number) => {
    const absAmt = Math.abs(amount);
    const min = parseFloat(filterMinAmount());
    const max = parseFloat(filterMaxAmount());
    if (!isNaN(min) && absAmt < min) return false;
    if (!isNaN(max) && absAmt > max) return false;
    return true;
  };

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

      // Filter by specific account
      if (filterAccount() && tx.account.toLowerCase() !== filterAccount().toLowerCase()) {
        return false;
      }

      // Filter by specific category
      if (filterCategory() && tx.category.toLowerCase() !== filterCategory().toLowerCase()) {
        return false;
      }

      // Filter by date range preset / custom
      if (!matchesDatePreset(tx.date)) {
        return false;
      }

      // Filter by amount range
      if (!matchesAmountRange(tx.amount)) {
        return false;
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

          {/* Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters())}
            class={`inline-flex items-center gap-1.5 border text-xs font-semibold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer ${
              showFilters() || activeFiltersCount() > 0
                ? "bg-primary-light border-primary text-primary"
                : "bg-card hover:bg-card-subtle border-card-border text-text-muted hover:text-text-main"
            }`}
          >
            <Filter class="w-3.5 h-3.5" />
            <span>Filters</span>
            <Show when={activeFiltersCount() > 0}>
              <span class="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary text-white">
                {activeFiltersCount()}
              </span>
            </Show>
          </button>

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
            onClick={handleExportCSV}
            disabled={sortedTransactions().length === 0}
            title={
              activeFiltersCount() > 0 || searchQuery().trim() || props.activeFilter !== "all"
                ? `Export ${sortedTransactions().length} filtered transaction${sortedTransactions().length === 1 ? "" : "s"} to CSV`
                : `Export all ${sortedTransactions().length} transaction${sortedTransactions().length === 1 ? "" : "s"} to CSV`
            }
            class={`inline-flex items-center gap-1.5 border text-xs font-semibold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer ${
              exportSuccessMessage()
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-card hover:bg-card-subtle border-card-border text-text-muted hover:text-text-main disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            <Show when={exportSuccessMessage()} fallback={<Download class="w-3.5 h-3.5" />}>
              <Check class="w-3.5 h-3.5 text-emerald-500" />
            </Show>
            <span>{exportSuccessMessage() ? "Exported!" : "Export CSV"}</span>
            <Show when={!exportSuccessMessage() && (activeFiltersCount() > 0 || searchQuery().trim() || props.activeFilter !== "all")}>
              <span class="text-[10px] text-text-muted font-normal">
                ({sortedTransactions().length})
              </span>
            </Show>
          </button>

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

      {/* Advanced Filter Panel */}
      <Show when={showFilters()}>
        <div class="bg-card rounded-2xl border border-card-border p-4 shadow-xs space-y-3 animate-in fade-in duration-150">
          <div class="flex items-center justify-between border-b border-card-border pb-2.5">
            <div class="flex items-center gap-2">
              <Filter class="w-4 h-4 text-primary" />
              <span class="text-xs font-bold text-text-main uppercase tracking-wider">
                Filter Transactions
              </span>
              <Show when={activeFiltersCount() > 0}>
                <span class="text-[11px] text-text-muted">
                  ({activeFiltersCount()} active filter{activeFiltersCount() > 1 ? "s" : ""})
                </span>
              </Show>
            </div>

            <div class="flex items-center gap-2">
              <Show when={activeFiltersCount() > 0}>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  class="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              </Show>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Account Filter */}
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Account
              </label>
              <select
                value={filterAccount()}
                onChange={(e) => setFilterAccount(e.currentTarget.value)}
                class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">All Accounts</option>
                <For each={allAccountsList()}>
                  {(acc) => <option value={acc}>{acc}</option>}
                </For>
              </select>
            </div>

            {/* Category Filter */}
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Category
              </label>
              <select
                value={filterCategory()}
                onChange={(e) => setFilterCategory(e.currentTarget.value)}
                class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">All Categories</option>
                <For each={allCategoriesList()}>
                  {(cat) => <option value={cat}>{cat}</option>}
                </For>
              </select>
            </div>

            {/* Date Preset Filter */}
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Date Range
              </label>
              <select
                value={filterDatePreset()}
                onChange={(e) => setFilterDatePreset(e.currentTarget.value as any)}
                class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>

            {/* Amount Range */}
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Amount ({symbol()})
              </label>
              <div class="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  placeholder="Min"
                  value={filterMinAmount()}
                  onInput={(e) => setFilterMinAmount(e.currentTarget.value)}
                  class="w-full bg-card-subtle border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filterMaxAmount()}
                  onInput={(e) => setFilterMaxAmount(e.currentTarget.value)}
                  class="w-full bg-card-subtle border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Custom Date Inputs (when Custom Range selected) */}
          <Show when={filterDatePreset() === "custom"}>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-card-border">
              <div class="space-y-1">
                <label class="block text-[11px] text-text-muted">Start Date</label>
                <input
                  type="date"
                  value={customStartDate()}
                  onInput={(e) => setCustomStartDate(e.currentTarget.value)}
                  class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div class="space-y-1">
                <label class="block text-[11px] text-text-muted">End Date</label>
                <input
                  type="date"
                  value={customEndDate()}
                  onInput={(e) => setCustomEndDate(e.currentTarget.value)}
                  class="w-full bg-card-subtle border border-card-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </Show>

          {/* Filter summary & quick export footer */}
          <div class="flex items-center justify-between pt-3 border-t border-card-border text-xs text-text-muted">
            <span>
              Showing <strong class="text-text-main">{sortedTransactions().length}</strong> of {props.transactions.length} transactions
            </span>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={sortedTransactions().length === 0}
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <Download class="w-3.5 h-3.5" />
              <span>Export Filtered ({sortedTransactions().length})</span>
            </button>
          </div>
        </div>
      </Show>

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
                <th class="py-3 px-3 w-10 text-center sticky top-0 bg-card-subtle">
                  <input
                    type="checkbox"
                    checked={
                      filteredTransactions().length > 0 &&
                      filteredTransactions().every((t) => selectedTxIds().includes(t.id))
                    }
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        setSelectedTxIds(filteredTransactions().map((t) => t.id));
                      } else {
                        setSelectedTxIds([]);
                      }
                    }}
                    class="rounded border-card-border text-primary focus:ring-primary cursor-pointer w-3.5 h-3.5 accent-primary"
                    title="Select all filtered transactions"
                  />
                </th>

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
                {(tx) => {
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
                      <td class="py-3.5 px-3 text-center text-text-subtle relative" onClick={(e) => e.stopPropagation()}>
                        {isSelected() && (
                          <span class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"></span>
                        )}
                        <input
                          type="checkbox"
                          checked={selectedTxIds().includes(tx.id)}
                          onChange={(e) => {
                            const isChecked = e.currentTarget.checked;
                            if (isChecked) {
                              setSelectedTxIds((prev) => [...prev, tx.id]);
                            } else {
                              setSelectedTxIds((prev) => prev.filter((id) => id !== tx.id));
                            }
                          }}
                          class="rounded border-card-border text-primary focus:ring-primary cursor-pointer w-3.5 h-3.5 accent-primary"
                        />
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

                      <td class="py-3.5 px-4 text-text-subtle truncate max-w-xs" title={tx.notes || ""}>
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
                          <Show when={props.isAiEnabled && props.onOpenAskFinly}>
                            <button
                              type="button"
                              onClick={() => {
                                props.onOpenAskFinly?.(
                                  `Can you review this transaction at ${tx.payee} for ${symbol()}${Math.abs(tx.amount).toFixed(2)} and verify if '${tx.category}' is the right category?`,
                                  [tx]
                                );
                              }}
                              class="p-1.5 rounded-lg text-text-subtle hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                              title="Ask Finly about this transaction"
                            >
                              <Sparkles class="w-3.5 h-3.5" />
                            </button>
                          </Show>
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

      {/* Floating Selection Action Bar */}
      <Show when={selectedTxIds().length > 0}>
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-primary/30 shadow-2xl rounded-2xl px-5 py-2.5 flex items-center gap-3.5 z-30 animate-in fade-in slide-in-from-bottom duration-200">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span class="text-xs font-bold text-text-main">
              {selectedTxIds().length} transaction{selectedTxIds().length > 1 ? "s" : ""} selected
            </span>
          </div>

          <Show when={props.isAiEnabled && props.onOpenAskFinly}>
            <button
              type="button"
              onClick={() => {
                const sel = props.transactions.filter((t) => selectedTxIds().includes(t.id));
                props.onOpenAskFinly?.(undefined, sel);
              }}
              class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Sparkles class="w-3.5 h-3.5" />
              <span>Ask Finly About Selected</span>
            </button>
          </Show>

          <button
            type="button"
            onClick={() => setSelectedTxIds([])}
            class="text-xs text-text-muted hover:text-text-main px-2 py-1 rounded-lg hover:bg-card-subtle transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </Show>

      {/* CSV Import Review & Preview Modal */}
      {importFile() && (
        <ImportTransactionsModal
          csvText={importFile()!.text}
          fileName={importFile()!.fileName}
          accounts={props.accounts || []}
          categories={props.categories || []}
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
