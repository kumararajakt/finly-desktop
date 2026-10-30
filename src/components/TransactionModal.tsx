import { Component, createSignal } from "solid-js";
import { X } from "./icons";
import { Account, Transaction } from "../types/finance";

interface TransactionModalProps {
  accounts: Account[];
  currencySymbol?: string;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, "id">) => void;
}

export const TransactionModal: Component<TransactionModalProps> = (props) => {
  const [payee, setPayee] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [type, setType] = createSignal<"expense" | "income">("expense");
  const [category, setCategory] = createSignal("Groceries");
  const [account, setAccount] = createSignal(props.accounts[0]?.name || "");
  const [date, setDate] = createSignal(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = createSignal("");
  const [isPending, setIsPending] = createSignal(false);

  const categories = [
    { name: "Housing", color: "#2563eb" },
    { name: "Groceries", color: "#10b981" },
    { name: "Dining Out", color: "#f59e0b" },
    { name: "Transportation", color: "#8b5cf6" },
    { name: "Utilities", color: "#06b6d4" },
    { name: "Salary", color: "#10b981" },
    { name: "Entertainment", color: "#ec4899" },
    { name: "Other", color: "#64748b" },
  ];

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount());
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const matchedCat = categories.find((c) => c.name === category());

    props.onSave({
      date: date(),
      payee: payee() || "Untitled Transaction",
      category: category(),
      categoryColor: matchedCat?.color || "#64748b",
      account: account(),
      amount: type() === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
      type: type(),
      status: isPending() ? "pending" : "cleared",
      notes: notes() || undefined,
    });

    props.onClose();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div class="bg-card rounded-2xl border border-card-border shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div class="flex items-center justify-between border-b border-card-border pb-3">
          <h2 class="text-base font-bold text-text-main">New Transaction</h2>
          <button
            type="button"
            onClick={props.onClose}
            class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle cursor-pointer transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Expense vs Income toggle */}
          <div class="flex rounded-xl bg-card-subtle p-1 border border-card-border">
            <button
              type="button"
              onClick={() => setType("expense")}
              class={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                type() === "expense"
                  ? "bg-card text-text-main shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              class={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                type() === "income"
                  ? "bg-card text-emerald-500 shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Income
            </button>
          </div>

          {/* Amount input */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Amount ({props.currencySymbol || "$"})
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={amount()}
              onInput={(e) => setAmount(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-base font-bold text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          {/* Payee input */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Payee / Merchant
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Trader Joe's, Apple, Employer"
              value={payee()}
              onInput={(e) => setPayee(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          {/* Category & Account Grid */}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category()}
                onChange={(e) => setCategory(e.currentTarget.value)}
                class="w-full bg-card border border-card-border rounded-xl px-3 pr-9 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer appearance-none"
              >
                {categories.map((c) => (
                  <option value={c.name} class="bg-card text-text-main">{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                Account
              </label>
              {props.accounts.length > 0 ? (
                <select
                  value={account()}
                  onChange={(e) => setAccount(e.currentTarget.value)}
                  class="w-full bg-card border border-card-border rounded-xl px-3 pr-9 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer appearance-none"
                >
                  {props.accounts.map((a) => (
                    <option value={a.name} class="bg-card text-text-main">{a.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="e.g. Checking"
                  value={account()}
                  onInput={(e) => setAccount(e.currentTarget.value)}
                  class="w-full bg-card border border-card-border rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              )}
            </div>
          </div>

          {/* Date */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              value={date()}
              onChange={(e) => setDate(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          {/* Notes */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="Add additional details..."
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          {/* Pending Toggle */}
          <label class="flex items-center gap-2 cursor-pointer text-xs text-text-muted select-none pt-1">
            <input
              type="checkbox"
              checked={isPending()}
              onChange={(e) => setIsPending(e.currentTarget.checked)}
              class="w-4 h-4 rounded border-card-border text-primary focus:ring-primary"
            />
            <span>Mark as pending transaction</span>
          </label>

          {/* Modal Actions */}
          <div class="flex items-center justify-end gap-2.5 pt-4 border-t border-card-border">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-active text-white transition shadow-xs cursor-pointer"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
