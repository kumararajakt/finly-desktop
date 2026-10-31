import { Component, createSignal, For } from "solid-js";
import {
  PieChart,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TriangleAlert,
  CheckCircle2,
  Receipt,
  Wallet,
} from "./icons";
import { BudgetItem, Transaction } from "../types/finance";

interface BudgetPageProps {
  budgets: BudgetItem[];
  transactions: Transaction[];
  currencySymbol?: string;
  onOpenAddBudget: () => void;
  onEditBudget: (item: BudgetItem) => void;
  onDeleteBudget: (id: string) => void;
  onNavigateToTransactions: (category?: string) => void;
}

export const BudgetPage: Component<BudgetPageProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";
  const [filterStatus, setFilterStatus] = createSignal<"all" | "healthy" | "warning" | "over">("all");

  // Calculate spent amount per category based on transactions
  const getCategorySpent = (category: string) => {
    return props.transactions
      .filter(
        (t) =>
          t.category.toLowerCase() === category.toLowerCase() &&
          t.amount < 0 &&
          t.type !== "transfer"
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  };

  // Aggregates
  const totalBudget = () => props.budgets.reduce((sum, b) => sum + b.limit, 0);

  const totalSpentInBudgets = () => {
    return props.budgets.reduce((sum, b) => sum + getCategorySpent(b.category), 0);
  };

  const totalRemaining = () => totalBudget() - totalSpentInBudgets();

  const overallPercentage = () => {
    if (totalBudget() <= 0) return 0;
    return Math.min(100, Math.round((totalSpentInBudgets() / totalBudget()) * 100));
  };

  const budgetStatuses = () => {
    return props.budgets.map((b) => {
      const spent = getCategorySpent(b.category);
      const remaining = b.limit - spent;
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      let status: "healthy" | "warning" | "over" = "healthy";
      if (pct > 100) {
        status = "over";
      } else if (pct >= 80) {
        status = "warning";
      }
      return {
        ...b,
        spent,
        remaining,
        percentage: Math.round(pct),
        status,
      };
    });
  };

  const overCount = () => budgetStatuses().filter((b) => b.status === "over").length;
  const warningCount = () => budgetStatuses().filter((b) => b.status === "warning").length;
  const healthyCount = () => budgetStatuses().filter((b) => b.status === "healthy").length;

  const filteredBudgets = () => {
    const list = budgetStatuses();
    if (filterStatus() === "all") return list;
    return list.filter((b) => b.status === filterStatus());
  };

  return (
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-main">Budgets</h1>
          <p class="text-xs text-text-muted mt-0.5">
            Set target thresholds and track your actual spending against category limits
          </p>
        </div>

        {/* Action Button */}
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            onClick={props.onOpenAddBudget}
            class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>New Budget Limit</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budgeted */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Total Monthly Budget</span>
            <span class="p-1.5 rounded-lg bg-primary-light text-primary">
              <PieChart class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              {symbol()}{totalBudget().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">Across {props.budgets.length} target categories</div>
        </div>

        {/* Total Spent */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Total Spent</span>
            <span class="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <Receipt class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              {symbol()}{totalSpentInBudgets().toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">
            {totalBudget() > 0
              ? `${((totalSpentInBudgets() / totalBudget()) * 100).toFixed(1)}% of total limit`
              : "0% of total limit"}
          </div>
        </div>

        {/* Remaining Budget */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Remaining Buffer</span>
            <span
              class={`p-1.5 rounded-lg ${
                totalRemaining() >= 0
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              <Wallet class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span
              class={`text-2xl font-bold tracking-tight ${
                totalRemaining() >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {totalRemaining() < 0 ? "-" : "+"}{symbol()}
              {Math.abs(totalRemaining()).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">
            {totalRemaining() >= 0 ? "Available to spend safely" : "Overall budget exceeded!"}
          </div>
        </div>

        {/* Health Status */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Budget Health</span>
            <span class="p-1.5 rounded-lg bg-primary-light text-primary">
              <TrendingUp class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              {overallPercentage()}%
            </span>
            <span
              class={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                props.budgets.length === 0
                  ? "bg-card-subtle text-text-muted border border-card-border"
                  : overCount() > 0
                  ? "bg-rose-500/15 text-rose-500"
                  : warningCount() > 0
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-emerald-500/15 text-emerald-500"
              }`}
            >
              {props.budgets.length === 0
                ? "No Budgets"
                : overCount() > 0
                ? `${overCount()} Over Limit`
                : warningCount() > 0
                ? "Near Limit"
                : "On Track"}
            </span>
          </div>
          <div class="text-xs text-text-muted mt-2">
            {props.budgets.length === 0
              ? "No budget categories configured yet"
              : `${healthyCount()} of ${props.budgets.length} categories healthy`}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div class="flex items-center justify-between">
        <div class="inline-flex rounded-xl bg-card-subtle p-1 border border-card-border text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterStatus() === "all"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            All Categories ({props.budgets.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus("healthy")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterStatus() === "healthy"
                ? "bg-card text-emerald-500 shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            On Track ({healthyCount()})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus("warning")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterStatus() === "warning"
                ? "bg-card text-amber-500 shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Near Limit ({warningCount()})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus("over")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterStatus() === "over"
                ? "bg-card text-rose-500 shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Over Limit ({overCount()})
          </button>
        </div>

        <div class="text-xs text-text-muted font-medium">
          Showing {filteredBudgets().length} category limits
        </div>
      </div>

      {/* Budget Cards Grid */}
      {filteredBudgets().length === 0 ? (
        <div class="bg-card rounded-2xl border border-card-border p-12 text-center text-text-muted space-y-3 shadow-xs">
          <div class="w-12 h-12 rounded-2xl bg-card-subtle flex items-center justify-center text-text-subtle mx-auto">
            <PieChart class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-text-main">No budgets found</h3>
            <p class="text-xs text-text-subtle mt-0.5">
              {props.budgets.length === 0
                ? "Add your first category budget to start monitoring your spending targets."
                : "No categories match the active filter."}
            </p>
          </div>
          {props.budgets.length === 0 && (
            <button
              type="button"
              onClick={props.onOpenAddBudget}
              class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
            >
              <Plus class="w-4 h-4" />
              <span>Create Budget</span>
            </button>
          )}
        </div>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={filteredBudgets()}>
            {(b) => {
              const isOver = b.status === "over";
              const isWarning = b.status === "warning";

              return (
                <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-text-subtle/40 transition">
                  {/* Card Header */}
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2.5">
                      <span
                        class="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ "background-color": b.color || "#64748b" }}
                      ></span>
                      <div>
                        <h4 class="text-sm font-bold text-text-main">{b.category}</h4>
                        <span class="text-[10px] text-text-muted uppercase font-semibold">
                          Monthly Budget
                        </span>
                      </div>
                    </div>

                    {/* Edit / Delete actions */}
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => props.onEditBudget(b)}
                        class="p-1.5 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
                        title="Edit Limit"
                      >
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onDeleteBudget(b.id)}
                        class="p-1.5 rounded-lg text-text-subtle hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete Budget"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div class="space-y-1">
                    <div class="flex items-baseline justify-between">
                      <span class="text-xl font-bold text-text-main tracking-tight">
                        {symbol()}{b.spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span class="text-xs text-text-muted font-medium">
                        of {symbol()}{b.limit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div class="h-2.5 w-full bg-card-subtle rounded-full overflow-hidden">
                      <div
                        class={`h-full rounded-full transition-all duration-300 ${
                          isOver
                            ? "bg-rose-500"
                            : isWarning
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(100, b.percentage)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Card Footer: Status & Remaining */}
                  <div class="flex items-center justify-between pt-2 border-t border-card-border text-xs">
                    <span
                      class={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        isOver
                          ? "text-rose-500"
                          : isWarning
                          ? "text-amber-500"
                          : "text-emerald-500"
                      }`}
                    >
                      {isOver ? (
                        <>
                          <TriangleAlert class="w-3 h-3" />
                          <span>Over by {symbol()}{Math.abs(b.remaining).toFixed(2)}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 class="w-3 h-3" />
                          <span>{symbol()}{b.remaining.toFixed(2)} left</span>
                        </>
                      )}
                    </span>

                    <span class="text-[11px] font-bold text-text-muted">
                      {b.percentage}% spent
                    </span>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      )}
    </div>
  );
};
