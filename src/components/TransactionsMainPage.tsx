import { Component, createSignal, For } from "solid-js";
import {
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Filter,
  Trash2,
  Flag,
  CheckCircle2,
  Download,
} from "lucide-solid";
import { Transaction } from "../types/finance";

interface TransactionsMainPageProps {
  transactions: Transaction[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onOpenAddTransaction: () => void;
  onDeleteTransaction: (id: string) => void;
  onToggleFlagTransaction: (id: string) => void;
}

export const TransactionsMainPage: Component<TransactionsMainPageProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTxId, setSelectedTxId] = createSignal<string | null>(null);

  // Compute metrics
  const totalInflow = () =>
    props.transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = () =>
    props.transactions
      .filter((t) => t.amount < 0)
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
      if (props.activeFilter === "income" && tx.amount <= 0) return false;
      if (props.activeFilter === "expense" && tx.amount >= 0) return false;

      // Filter by search query
      if (searchQuery().trim()) {
        const query = searchQuery().toLowerCase();
        const matchesPayee = tx.payee.toLowerCase().includes(query);
        const matchesCat = tx.category.toLowerCase().includes(query);
        const matchesAcc = tx.account.toLowerCase().includes(query);
        const matchesNotes = tx.notes?.toLowerCase().includes(query) ?? false;
        if (!matchesPayee && !matchesCat && !matchesAcc && !matchesNotes) return false;
      }

      return true;
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
              class="w-full bg-white border border-card-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

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
        <div class="bg-white rounded-2xl border border-card-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Inflow / Income</span>
            <span class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownLeft class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              +${totalInflow().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">Current month total</div>
        </div>

        {/* Outflow Card */}
        <div class="bg-white rounded-2xl border border-card-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Outflow / Expenses</span>
            <span class="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <ArrowUpRight class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              -${totalOutflow().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">Tracked across all accounts</div>
        </div>

        {/* Net Savings Card */}
        <div class="bg-white rounded-2xl border border-card-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Net Cash Flow</span>
            <span class="p-1.5 rounded-lg bg-indigo-50 text-[#5842e3]">
              <TrendingUp class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span
              class={`text-2xl font-bold tracking-tight ${
                netCashFlow() >= 0 ? "text-[#5842e3]" : "text-rose-600"
              }`}
            >
              {netCashFlow() >= 0 ? "+" : "-"}$
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
        <div class="bg-white rounded-2xl border border-card-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Pending Review</span>
            <span class="p-1.5 rounded-lg bg-amber-50 text-amber-600">
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
        <div class="inline-flex rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 text-xs font-medium self-start">
          <button
            type="button"
            onClick={() => props.onFilterChange("all")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "all"
                ? "bg-white text-text-main shadow-xs font-semibold"
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
                ? "bg-white text-text-main shadow-xs font-semibold"
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
                ? "bg-white text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => props.onFilterChange("pending")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              props.activeFilter === "pending"
                ? "bg-white text-text-main shadow-xs font-semibold"
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
                ? "bg-white text-text-main shadow-xs font-semibold"
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
      <div class="bg-white rounded-2xl border border-card-border shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-text-main">
            <thead>
              <tr class="border-b border-card-border text-[11px] font-bold text-text-muted uppercase tracking-wider bg-slate-50/60">
                <th class="py-3 px-4 w-10 text-center">#</th>
                <th class="py-3 px-4 w-28">Date</th>
                <th class="py-3 px-4">Payee / Description</th>
                <th class="py-3 px-4">Category</th>
                <th class="py-3 px-4">Account</th>
                <th class="py-3 px-4">Notes</th>
                <th class="py-3 px-4 text-right">Amount</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-right w-20">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <For
                each={filteredTransactions()}
                fallback={
                  <tr>
                    <td colspan="9" class="py-12 text-center text-text-muted">
                      <div class="space-y-2">
                        <Filter class="w-8 h-8 text-slate-300 mx-auto" />
                        <div class="text-xs font-semibold text-text-main">No transactions found</div>
                        <div class="text-[11px] text-text-subtle">
                          Try adjusting your search query or switching active filters.
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              >
                {(tx, idx) => {
                  const isSelected = () => selectedTxId() === tx.id;
                  const isIncome = tx.amount > 0;

                  return (
                    <tr
                      onClick={() => setSelectedTxId(tx.id)}
                      class={`transition-colors cursor-pointer relative ${
                        isSelected()
                          ? "bg-indigo-50/30 font-medium"
                          : "hover:bg-slate-50/70"
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
                        {tx.payee}
                      </td>

                      <td class="py-3.5 px-4">
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full"
                            style={{ "background-color": tx.categoryColor || "#64748b" }}
                          ></span>
                          {tx.category}
                        </span>
                      </td>

                      <td class="py-3.5 px-4 text-text-muted whitespace-nowrap">
                        {tx.account}
                      </td>

                      <td class="py-3.5 px-4 text-text-subtle truncate max-w-xs">
                        {tx.notes || "—"}
                      </td>

                      <td
                        class={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${
                          isIncome ? "text-emerald-600" : "text-text-main"
                        }`}
                      >
                        {isIncome ? "+" : "-"}$
                        {Math.abs(tx.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td class="py-3.5 px-4 text-center whitespace-nowrap">
                        {tx.status === "cleared" ? (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#dcfce7] text-[#15803d]">
                            Cleared
                          </span>
                        ) : tx.status === "flagged" ? (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-[#fef3c7] text-[#b45309]">
                            Flagged
                          </span>
                        ) : (
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600">
                            Pending
                          </span>
                        )}
                      </td>

                      <td class="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div class="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => props.onToggleFlagTransaction(tx.id)}
                            class={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              tx.status === "flagged"
                                ? "text-amber-600 hover:bg-amber-50"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            }`}
                            title="Toggle Flag"
                          >
                            <Flag class="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => props.onDeleteTransaction(tx.id)}
                            class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
    </div>
  );
};
