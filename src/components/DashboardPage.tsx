import { Component, For } from "solid-js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  Wallet,
  CreditCard,
  Building2,
  Clock,
  Flag,
  Plus,
  ArrowRight,
  Receipt,
} from "./icons";
import { Account, Transaction } from "../types/finance";

interface DashboardPageProps {
  accounts: Account[];
  transactions: Transaction[];
  userName?: string;
  currencySymbol?: string;
  onNavigateToTransactions: (filter?: string) => void;
  onOpenAddTransaction: () => void;
  onOpenAddAccount: () => void;
}

export const DashboardPage: Component<DashboardPageProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";

  // Financial aggregates
  const totalNetWorth = () =>
    props.accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const totalAssets = () =>
    props.accounts
      .filter((a) => a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0);

  const totalLiabilities = () =>
    props.accounts
      .filter((a) => a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  const totalInflow = () =>
    props.transactions
      .filter((t) => t.amount > 0 && t.type !== "transfer")
      .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = () =>
    props.transactions
      .filter((t) => t.amount < 0 && t.type !== "transfer")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const netCashFlow = () => totalInflow() - totalOutflow();

  const savingsRate = () => {
    if (totalInflow() <= 0) return 0;
    const rate = (netCashFlow() / totalInflow()) * 100;
    return Math.max(0, rate);
  };

  const pendingCount = () =>
    props.transactions.filter((t) => t.status === "pending").length;

  const flaggedCount = () =>
    props.transactions.filter((t) => t.status === "flagged").length;

  // Category breakdown for expenses (excludes transfers)
  const categoryBreakdown = () => {
    const expenseTxs = props.transactions.filter((t) => t.amount < 0 && t.type !== "transfer");
    const totalExp = totalOutflow();
    if (totalExp === 0) return [];

    const catMap = new Map<string, { total: number; color?: string }>();
    for (const tx of expenseTxs) {
      const existing = catMap.get(tx.category) || {
        total: 0,
        color: tx.categoryColor || "#64748b",
      };
      existing.total += Math.abs(tx.amount);
      if (tx.categoryColor) existing.color = tx.categoryColor;
      catMap.set(tx.category, existing);
    }

    return Array.from(catMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.total,
        percentage: Math.round((data.total / totalExp) * 100),
        color: data.color || "#64748b",
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  // 5 latest transactions
  const recentTransactions = () => {
    return [...props.transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  };

  return (
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-main">
            {props.userName ? `Welcome back, ${props.userName}` : "Dashboard"}
          </h1>
          <p class="text-xs text-text-muted mt-0.5">
            Here is your financial summary, cash flow, and latest account activity.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            onClick={props.onOpenAddAccount}
            class="inline-flex items-center gap-1.5 bg-card hover:bg-card-subtle border border-card-border text-text-muted hover:text-text-main text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Building2 class="w-3.5 h-3.5 text-text-subtle" />
            <span>Add Account</span>
          </button>

          <button
            type="button"
            onClick={props.onOpenAddTransaction}
            class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>New Transaction</span>
          </button>
        </div>
      </div>

      {/* Action / Attention Items (Pending & Flagged) */}
      {(pendingCount() > 0 || flaggedCount() > 0) && (
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
          {pendingCount() > 0 && (
            <div
              onClick={() => props.onNavigateToTransactions("pending")}
              class="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs cursor-pointer hover:bg-amber-500/15 transition"
            >
              <div class="flex items-center gap-3">
                <span class="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                  <Clock class="w-4 h-4" />
                </span>
                <div>
                  <div class="font-bold text-text-main">
                    {pendingCount()} Pending {pendingCount() === 1 ? "Transaction" : "Transactions"}
                  </div>
                  <div class="text-[11px] text-text-muted">Awaiting bank settlement</div>
                </div>
              </div>
              <ArrowRight class="w-4 h-4 text-amber-500" />
            </div>
          )}

          {flaggedCount() > 0 && (
            <div
              onClick={() => props.onNavigateToTransactions("flagged")}
              class="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs cursor-pointer hover:bg-indigo-500/15 transition"
            >
              <div class="flex items-center gap-3">
                <span class="p-2 rounded-xl bg-primary-light text-primary">
                  <Flag class="w-4 h-4" />
                </span>
                <div>
                  <div class="font-bold text-text-main">
                    {flaggedCount()} Flagged {flaggedCount() === 1 ? "Transaction" : "Transactions"}
                  </div>
                  <div class="text-[11px] text-text-muted">Marked for review and verification</div>
                </div>
              </div>
              <ArrowRight class="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
      )}

      {/* Primary KPI Metrics */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Worth */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Net Worth</span>
            <span class="p-1.5 rounded-lg bg-primary-light text-primary">
              <Wallet class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              {totalNetWorth() < 0 ? "-" : ""}{symbol()}
              {Math.abs(totalNetWorth()).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2 flex items-center justify-between">
            <span>Assets: {symbol()}{totalAssets().toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            {totalLiabilities() > 0 && (
              <span class="text-rose-500">Debt: -{symbol()}{totalLiabilities().toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            )}
          </div>
        </div>

        {/* Total Income */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Total Inflow</span>
            <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              +{symbol()}{totalInflow().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">Total income tracked</div>
        </div>

        {/* Total Expenses */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Total Outflow</span>
            <span class="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <ArrowUpRight class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              -{symbol()}{totalOutflow().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">Total expenses recorded</div>
        </div>

        {/* Net Cash Flow & Savings Rate */}
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
          <div class="text-xs text-text-muted mt-2 flex items-center justify-between">
            <span>Savings Rate</span>
            <span class="font-bold text-primary">{savingsRate().toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Cash Flow Progress & Category Spending */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category Card */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-bold text-text-main">Top Expense Categories</h3>
              <p class="text-xs text-text-muted">Where your money goes across accounts</p>
            </div>
            <span class="text-xs font-semibold text-text-muted">
              {categoryBreakdown().length} Categories
            </span>
          </div>

          {categoryBreakdown().length === 0 ? (
            <div class="py-10 text-center text-text-muted text-xs space-y-2">
              <div class="w-10 h-10 rounded-xl bg-card-subtle flex items-center justify-center text-text-subtle mx-auto">
                <Receipt class="w-5 h-5" />
              </div>
              <p>No expenses recorded yet</p>
            </div>
          ) : (
            <div class="space-y-3.5">
              <For each={categoryBreakdown().slice(0, 5)}>
                {(cat) => (
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2">
                        <span
                          class="w-2.5 h-2.5 rounded-full"
                          style={{ "background-color": cat.color }}
                        ></span>
                        <span class="font-semibold text-text-main">{cat.name}</span>
                      </div>
                      <div class="flex items-center gap-2 text-text-muted font-medium">
                        <span>{cat.percentage}%</span>
                        <span class="font-bold text-text-main">
                          {symbol()}{cat.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div class="h-2 w-full bg-card-subtle rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${cat.percentage}%`,
                          "background-color": cat.color,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          )}
        </div>

        {/* Financial Accounts Breakdown */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-bold text-text-main">Accounts Breakdown</h3>
              <p class="text-xs text-text-muted">Liquid cash, savings, and credit cards</p>
            </div>
            <button
              type="button"
              onClick={props.onOpenAddAccount}
              class="text-xs font-semibold text-primary hover:text-primary-hover cursor-pointer"
            >
              + Add
            </button>
          </div>

          {props.accounts.length === 0 ? (
            <div class="py-10 text-center text-text-muted text-xs space-y-2">
              <div class="w-10 h-10 rounded-xl bg-card-subtle flex items-center justify-center text-text-subtle mx-auto">
                <Building2 class="w-5 h-5" />
              </div>
              <p>No accounts configured yet</p>
            </div>
          ) : (
            <div class="space-y-2.5 divide-y divide-card-border">
              <For each={props.accounts}>
                {(acc) => {
                  const isNegative = acc.balance < 0;
                  return (
                    <div class="flex items-center justify-between pt-2.5 first:pt-0">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-card-subtle flex items-center justify-center text-text-subtle">
                          {acc.type === "credit" ? (
                            <CreditCard class="w-4 h-4" />
                          ) : acc.type === "savings" ? (
                            <Wallet class="w-4 h-4" />
                          ) : acc.type === "investment" ? (
                            <TrendingUp class="w-4 h-4 text-primary" />
                          ) : (
                            <Building2 class="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div class="font-semibold text-xs text-text-main">{acc.name}</div>
                          <div class="text-[10px] text-text-muted capitalize">
                            {acc.type === "investment" ? "Investment / Brokerage" : `${acc.type} Account`}
                          </div>
                        </div>
                      </div>

                      <div
                        class={`text-xs font-bold ${
                          isNegative ? "text-rose-500" : "text-text-main"
                        }`}
                      >
                        {isNegative ? "-" : ""}{symbol()}
                        {Math.abs(acc.balance).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Recent Transactions */}
      <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-text-main">Recent Activity</h3>
            <p class="text-xs text-text-muted">Latest transactions processed across accounts</p>
          </div>

          <button
            type="button"
            onClick={() => props.onNavigateToTransactions()}
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions().length === 0 ? (
          <div class="py-12 text-center text-text-muted text-xs space-y-2">
            <div class="w-10 h-10 rounded-xl bg-card-subtle flex items-center justify-center text-text-subtle mx-auto">
              <Receipt class="w-5 h-5" />
            </div>
            <p>No transactions yet</p>
          </div>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-text-main border-collapse">
              <thead class="border-b border-card-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th class="py-2.5 px-3">Date</th>
                  <th class="py-2.5 px-3">Payee / Merchant</th>
                  <th class="py-2.5 px-3">Category</th>
                  <th class="py-2.5 px-3">Account</th>
                  <th class="py-2.5 px-3 text-right">Amount</th>
                  <th class="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-card-border">
                <For each={recentTransactions()}>
                  {(tx) => {
                    const isTransfer = tx.type === "transfer";
                    const isIncome = !isTransfer && tx.amount > 0;
                    return (
                      <tr class="hover:bg-card-subtle transition-colors">
                        <td class="py-3 px-3 text-text-muted whitespace-nowrap">{tx.date}</td>
                        <td class="py-3 px-3 font-semibold text-text-main">
                          <div class="flex items-center gap-1.5">
                            {isTransfer && (
                              <span class="p-0.5 rounded bg-primary-light text-primary" title="Transfer">
                                <ArrowLeftRight class="w-3 h-3" />
                              </span>
                            )}
                            <span>{tx.payee}</span>
                          </div>
                        </td>
                        <td class="py-3 px-3">
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-card-subtle text-text-main border border-card-border">
                            <span
                              class="w-1.5 h-1.5 rounded-full"
                              style={{ "background-color": tx.categoryColor || "#64748b" }}
                            ></span>
                            {tx.category}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-text-muted whitespace-nowrap">
                          {isTransfer && tx.toAccount ? (
                            <div class="inline-flex items-center gap-1.5 font-medium">
                              <span class="text-text-main">{tx.account}</span>
                              <ArrowLeftRight class="w-2.5 h-2.5 text-primary" />
                              <span class="text-primary font-semibold">{tx.toAccount}</span>
                            </div>
                          ) : (
                            tx.account
                          )}
                        </td>
                        <td
                          class={`py-3 px-3 text-right font-bold whitespace-nowrap ${
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
                        <td class="py-3 px-3 text-center whitespace-nowrap">
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
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
