import { Component, createSignal, For, Show } from "solid-js";
import {
  Search,
  Plus,
  Trash2,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  ChevronDown,
} from "./icons";
import { LoanRecord, LoanPayment } from "../types/finance";

interface LoansPageProps {
  loans: LoanRecord[];
  loanPayments: LoanPayment[];
  currencySymbol?: string;
  onOpenAddLoan: () => void;
  onOpenRecordPayment: (loan: LoanRecord) => void;
  onDeleteLoan: (id: string) => void;
  onNavigateToTransactions: (searchQuery?: string) => void;
}

export const LoansPage: Component<LoansPageProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";
  const [searchQuery, setSearchQuery] = createSignal("");
  const [activeFilter, setActiveFilter] = createSignal<"all" | "lent" | "borrowed" | "settled">("all");
  const [expandedLoanId, setExpandedLoanId] = createSignal<string | null>(null);

  // KPI Calculations
  const totalLentOutstanding = () =>
    props.loans
      .filter((l) => l.type === "lent" && l.status === "active")
      .reduce((sum, l) => sum + l.remainingAmount, 0);

  const totalBorrowedOutstanding = () =>
    props.loans
      .filter((l) => l.type === "borrowed" && l.status === "active")
      .reduce((sum, l) => sum + l.remainingAmount, 0);

  const netBalance = () => totalLentOutstanding() - totalBorrowedOutstanding();

  const activeCount = () => props.loans.filter((l) => l.status === "active").length;
  const settledCount = () => props.loans.filter((l) => l.status === "settled").length;
  const lentCount = () => props.loans.filter((l) => l.type === "lent" && l.status === "active").length;
  const borrowedCount = () =>
    props.loans.filter((l) => l.type === "borrowed" && l.status === "active").length;

  // Filtered loans
  const filteredLoans = () => {
    const q = searchQuery().toLowerCase().trim();
    const f = activeFilter();

    return props.loans.filter((loan) => {
      // Filter by tab
      if (f === "lent" && (loan.type !== "lent" || loan.status !== "active")) return false;
      if (f === "borrowed" && (loan.type !== "borrowed" || loan.status !== "active")) return false;
      if (f === "settled" && loan.status !== "settled") return false;

      // Filter by search
      if (q) {
        const matchesName = loan.contactName.toLowerCase().includes(q);
        const matchesNotes = loan.notes?.toLowerCase().includes(q) ?? false;
        const matchesAccount = loan.account.toLowerCase().includes(q);
        if (!matchesName && !matchesNotes && !matchesAccount) return false;
      }

      return true;
    });
  };

  const getPaymentsForLoan = (loanId: string) => {
    return props.loanPayments.filter((p) => p.loanId === loanId);
  };

  return (
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-main">Loans & Debts</h1>
          <p class="text-xs text-text-muted mt-0.5">
            Track money lent to friends and borrowed without cluttering your bank accounts
          </p>
        </div>

        {/* Search & Actions */}
        <div class="flex items-center gap-3">
          <div class="relative w-64">
            <Search class="w-4 h-4 text-text-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by friend, notes..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

          <button
            type="button"
            onClick={props.onOpenAddLoan}
            class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>New Loan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Lent (Owed to you) */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Lent (They Owe You)</span>
            <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ArrowUpRight class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{symbol()}{totalLentOutstanding().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">
            {lentCount()} active loan{lentCount() === 1 ? "" : "s"} receivable
          </div>
        </div>

        {/* Total Borrowed (You owe) */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Borrowed (You Owe)</span>
            <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <ArrowDownLeft class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              -{symbol()}{totalBorrowedOutstanding().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">
            {borrowedCount()} active debt{borrowedCount() === 1 ? "" : "s"} payable
          </div>
        </div>

        {/* Net Outstanding Balance */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Net Balance</span>
            <span class="p-1.5 rounded-lg bg-primary-light text-primary">
              <TrendingUp class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span
              class={`text-2xl font-bold tracking-tight ${
                netBalance() >= 0 ? "text-primary" : "text-rose-500"
              }`}
            >
              {netBalance() >= 0 ? "+" : "-"}{symbol()}
              {Math.abs(netBalance()).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">
            Overall peer lending position
          </div>
        </div>

        {/* Active vs Settled */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Loan Status</span>
            <span class="p-1.5 rounded-lg bg-card-subtle text-text-muted">
              <HandCoins class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              {activeCount()}
            </span>
            <span class="text-xs font-medium text-text-muted">active</span>
            <span class="text-text-subtle">•</span>
            <span class="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {settledCount()}
            </span>
            <span class="text-xs font-medium text-text-muted">settled</span>
          </div>
          <div class="text-xs text-text-muted mt-2">Personal ledger history</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="inline-flex rounded-xl bg-card-subtle p-1 border border-card-border text-xs font-medium self-start">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeFilter() === "all"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            All Loans ({props.loans.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("lent")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeFilter() === "lent"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Lent ({lentCount()})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("borrowed")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeFilter() === "borrowed"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Borrowed ({borrowedCount()})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("settled")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeFilter() === "settled"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Settled ({settledCount()})
          </button>
        </div>

        <div class="text-xs text-text-muted font-medium">
          Showing {filteredLoans().length} of {props.loans.length} loans
        </div>
      </div>

      {/* Loans Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <For
          each={filteredLoans()}
          fallback={
            <div class="col-span-full bg-card rounded-2xl border border-card-border p-12 text-center space-y-3">
              <div class="w-12 h-12 rounded-full bg-card-subtle flex items-center justify-center mx-auto text-text-muted">
                <HandCoins class="w-6 h-6" />
              </div>
              <h3 class="text-sm font-bold text-text-main">No loans found</h3>
              <p class="text-xs text-text-muted max-w-sm mx-auto">
                {searchQuery()
                  ? `No loan records match "${searchQuery()}".`
                  : "Track your first personal loan to easily record repayments."}
              </p>
              <button
                type="button"
                onClick={props.onOpenAddLoan}
                class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer mt-2"
              >
                <Plus class="w-4 h-4" />
                <span>Create Loan</span>
              </button>
            </div>
          }
        >
          {(loan) => {
            const isLent = () => loan.type === "lent";
            const isSettled = () => loan.status === "settled";
            const repaidAmount = () => loan.initialAmount - loan.remainingAmount;
            const progressPercent = () =>
              Math.min(100, Math.round((repaidAmount() / loan.initialAmount) * 100));

            const isExpanded = () => expandedLoanId() === loan.id;
            const payments = () => getPaymentsForLoan(loan.id);

            return (
              <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between hover:border-text-subtle/30 transition-colors">
                <div>
                  {/* Top: Avatar, Name, Type Badge, and Actions */}
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        class={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 ${
                          isLent()
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {loan.contactName.charAt(0)}
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <h3 class="text-sm font-bold text-text-main truncate" title={loan.contactName}>
                            {loan.contactName}
                          </h3>
                        </div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                          <span
                            class={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              isLent()
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {isLent() ? "They Owe You" : "You Owe"}
                          </span>
                          <Show when={isSettled()}>
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 class="w-3 h-3" />
                              <span>Settled</span>
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => props.onDeleteLoan(loan.id)}
                      class="p-1.5 rounded-lg text-text-subtle hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Delete Loan Record"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Amount Breakdown & Progress */}
                  <div class="mt-4 p-3 bg-card-subtle rounded-xl border border-card-border space-y-2">
                    <div class="flex items-baseline justify-between">
                      <span class="text-[11px] font-semibold text-text-muted">
                        {isSettled() ? "Total Settled" : "Remaining"}
                      </span>
                      <span
                        class={`text-lg font-bold ${
                          isSettled()
                            ? "text-text-muted"
                            : isLent()
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {symbol()}{loan.remainingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div class="w-full bg-canvas rounded-full h-1.5 overflow-hidden">
                      <div
                        class={`h-full transition-all duration-300 ${
                          isSettled()
                            ? "bg-emerald-500"
                            : isLent()
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${progressPercent()}%` }}
                      />
                    </div>

                    <div class="flex items-center justify-between text-[10px] text-text-muted">
                      <span>
                        Repaid: {symbol()}{repaidAmount().toLocaleString("en-US", { minimumFractionDigits: 2 })} ({progressPercent()}%)
                      </span>
                      <span>Initial: {symbol()}{loan.initialAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Metadata (Account, Date, Notes) */}
                  <div class="mt-3 space-y-1 text-xs text-text-muted">
                    <div class="flex items-center justify-between text-[11px]">
                      <span>Account:</span>
                      <span class="font-medium text-text-main">{loan.account}</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px]">
                      <span>Date:</span>
                      <span class="font-medium text-text-main">{loan.startDate}</span>
                    </div>
                    <Show when={loan.dueDate}>
                      <div class="flex items-center justify-between text-[11px]">
                        <span>Due Date:</span>
                        <span class="font-medium text-text-main flex items-center gap-1">
                          <Clock class="w-3 h-3 text-text-subtle" />
                          <span>{loan.dueDate}</span>
                        </span>
                      </div>
                    </Show>
                    <Show when={loan.notes}>
                      <div class="text-[11px] text-text-subtle italic pt-1 truncate">
                        "{loan.notes}"
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div class="pt-4 mt-4 border-t border-card-border space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <Show
                      when={!isSettled()}
                      fallback={
                        <div class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 class="w-3.5 h-3.5" />
                          <span>Paid in Full</span>
                        </div>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => props.onOpenRecordPayment(loan)}
                        class="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold py-2 px-3 rounded-xl transition shadow-xs cursor-pointer"
                      >
                        <Plus class="w-3.5 h-3.5" />
                        <span>Record Return</span>
                      </button>
                    </Show>

                    {/* Expand History Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLoanId(isExpanded() ? null : loan.id)
                      }
                      class="text-xs font-semibold text-text-muted hover:text-text-main px-2.5 py-2 rounded-xl hover:bg-card-subtle transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>History ({payments().length})</span>
                      <ChevronDown
                        class={`w-3.5 h-3.5 transition-transform ${
                          isExpanded() ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expandable Repayment History */}
                  <Show when={isExpanded()}>
                    <div class="pt-2 border-t border-card-border space-y-1.5 animate-in fade-in duration-150">
                      <div class="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        Repayment Ledger
                      </div>
                      <For
                        each={payments()}
                        fallback={
                          <div class="text-[11px] text-text-subtle italic py-1">
                            No repayments recorded yet.
                          </div>
                        }
                      >
                        {(pay) => (
                          <div class="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-card-subtle/50">
                            <div>
                              <span class="font-medium text-text-main">
                                +{symbol()}{pay.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                              <span class="text-[10px] text-text-muted ml-1.5">
                                ({pay.date})
                              </span>
                            </div>
                            <span class="text-[10px] text-text-subtle truncate max-w-[100px]">
                              {pay.account}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
