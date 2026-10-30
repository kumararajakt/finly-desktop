import { Component } from "solid-js";
import {
  Receipt,
  LayoutDashboard,
  Wallet,
  PieChart,
  Settings,
  CreditCard,
  Plus,
  ShieldCheck,
  Building2,
  TrendingDown,
  CheckCircle2,
  Clock,
  Flag,
} from "lucide-solid";
import { Account, Transaction } from "../types/finance";

interface SidebarProps {
  accounts: Account[];
  transactions: Transaction[];
  activeFilter: string;
  onSelectFilter: (filterId: string) => void;
  onOpenAddTransaction: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const totalNetWorth = () =>
    props.accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const pendingCount = () =>
    props.transactions.filter((t) => t.status === "pending").length;

  const flaggedCount = () =>
    props.transactions.filter((t) => t.status === "flagged").length;

  return (
    <aside class="w-64 bg-white border-r border-card-border h-screen flex flex-col justify-between shrink-0 select-none">
      {/* Top Branding & Main Navigation */}
      <div class="p-4 space-y-6 overflow-y-auto">
        {/* Brand */}
        <div class="flex items-center justify-between px-2 pt-1">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm font-bold text-sm tracking-wide">
              F
            </div>
            <div>
              <div class="font-bold text-sm text-text-main tracking-tight leading-tight">Finly</div>
              <div class="text-[10px] text-text-muted font-medium">Personal Finance</div>
            </div>
          </div>
          <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Sync
          </span>
        </div>

        {/* Quick Action Button */}
        <button
          type="button"
          onClick={props.onOpenAddTransaction}
          class="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>New Transaction</span>
        </button>

        {/* Primary App Views */}
        <div class="space-y-1">
          <div class="text-[10px] font-bold text-text-subtle uppercase tracking-wider px-2 mb-1.5">
            Overview
          </div>

          <button
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <LayoutDashboard class="w-4 h-4 text-slate-400" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-main hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <PieChart class="w-4 h-4 text-slate-400" />
            <span>Budgets</span>
          </button>
        </div>

        {/* Transactions Sidebar Section (Requested Focus) */}
        <div class="space-y-1">
          <div class="text-[10px] font-bold text-text-subtle uppercase tracking-wider px-2 mb-1.5">
            Transactions
          </div>

          <button
            type="button"
            onClick={() => props.onSelectFilter("all")}
            class={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              props.activeFilter === "all"
                ? "bg-primary-light text-primary font-semibold"
                : "text-text-muted hover:text-text-main hover:bg-slate-50"
            }`}
          >
            <div class="flex items-center gap-3">
              <Receipt class={`w-4 h-4 ${props.activeFilter === "all" ? "text-primary" : "text-slate-400"}`} />
              <span>All Transactions</span>
            </div>
            <span class="text-[11px] font-bold text-slate-400">{props.transactions.length}</span>
          </button>

          <button
            type="button"
            onClick={() => props.onSelectFilter("pending")}
            class={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              props.activeFilter === "pending"
                ? "bg-primary-light text-primary font-semibold"
                : "text-text-muted hover:text-text-main hover:bg-slate-50"
            }`}
          >
            <div class="flex items-center gap-3">
              <Clock class={`w-4 h-4 ${props.activeFilter === "pending" ? "text-primary" : "text-slate-400"}`} />
              <span>Pending</span>
            </div>
            {pendingCount() > 0 && (
              <span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                {pendingCount()}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => props.onSelectFilter("cleared")}
            class={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              props.activeFilter === "cleared"
                ? "bg-primary-light text-primary font-semibold"
                : "text-text-muted hover:text-text-main hover:bg-slate-50"
            }`}
          >
            <div class="flex items-center gap-3">
              <CheckCircle2 class={`w-4 h-4 ${props.activeFilter === "cleared" ? "text-primary" : "text-slate-400"}`} />
              <span>Cleared</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => props.onSelectFilter("flagged")}
            class={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              props.activeFilter === "flagged"
                ? "bg-primary-light text-primary font-semibold"
                : "text-text-muted hover:text-text-main hover:bg-slate-50"
            }`}
          >
            <div class="flex items-center gap-3">
              <Flag class={`w-4 h-4 ${props.activeFilter === "flagged" ? "text-primary" : "text-slate-400"}`} />
              <span>Flagged for Review</span>
            </div>
            {flaggedCount() > 0 && (
              <span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                {flaggedCount()}
              </span>
            )}
          </button>
        </div>

        {/* Accounts List Section */}
        <div class="space-y-1">
          <div class="flex items-center justify-between px-2 mb-1.5">
            <span class="text-[10px] font-bold text-text-subtle uppercase tracking-wider">
              Accounts
            </span>
            <button
              type="button"
              class="text-[11px] text-primary hover:text-primary-hover font-semibold cursor-pointer"
            >
              + Add
            </button>
          </div>

          {props.accounts.map((acc) => {
            const isNegative = acc.balance < 0;
            return (
              <div class="flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-slate-50 transition-colors">
                <div class="flex items-center gap-2.5 truncate">
                  {acc.type === "credit" ? (
                    <CreditCard class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : acc.type === "savings" ? (
                    <Wallet class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <Building2 class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span class="text-text-main font-medium truncate">{acc.name}</span>
                </div>
                <span
                  class={`font-semibold shrink-0 ml-2 ${
                    isNegative ? "text-slate-900" : "text-text-main"
                  }`}
                >
                  {isNegative ? "-" : ""}${Math.abs(acc.balance).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Profile / Sync status */}
      <div class="p-3 border-t border-card-border bg-slate-50/50 space-y-2">
        <div class="flex items-center justify-between px-2 py-1">
          <div class="text-[11px] text-text-muted font-medium">Net Worth</div>
          <div class="text-xs font-bold text-text-main">
            ${totalNetWorth().toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 px-1">
          <div class="flex items-center gap-2">
            <ShieldCheck class="w-4 h-4 text-emerald-600" />
            <span class="text-[11px] text-text-muted">Local & Encrypted</span>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
