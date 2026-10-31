import { Component, createSignal, For } from "solid-js";
import { X, HandCoins } from "./icons";
import { Account, LoanRecord, LoanType } from "../types/finance";

interface LoanModalProps {
  accounts: Account[];
  currencySymbol?: string;
  existingContacts?: string[];
  onClose: () => void;
  onSave: (loan: LoanRecord) => void;
}

export const LoanModal: Component<LoanModalProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";

  const [type, setType] = createSignal<LoanType>("lent");
  const [contactName, setContactName] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [account, setAccount] = createSignal(props.accounts[0]?.name || "Main Account");
  const [startDate, setStartDate] = createSignal(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const trimmedContact = contactName().trim();
    if (!trimmedContact) {
      setError("Friend / Contact name is required");
      return;
    }

    const parsedAmount = parseFloat(amount());
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    const newLoan: LoanRecord = {
      id: `loan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      contactName: trimmedContact,
      type: type(),
      initialAmount: parsedAmount,
      remainingAmount: parsedAmount,
      account: account(),
      startDate: startDate(),
      dueDate: dueDate().trim() || undefined,
      notes: notes().trim() || undefined,
      status: "active",
    };

    props.onSave(newLoan);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div class="relative w-full max-w-md bg-card rounded-2xl border border-card-border p-6 shadow-2xl">
        {/* Header */}
        <div class="flex items-center justify-between pb-3.5 border-b border-card-border mb-4">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-xl bg-primary-light text-primary">
              <HandCoins class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-base font-bold text-text-main">
                {type() === "lent" ? "New Loan Given" : "New Loan Received"}
              </h2>
              <p class="text-xs text-text-muted mt-0.5">
                Track personal debts without creating extra accounts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="text-text-subtle hover:text-text-main p-1 rounded-lg hover:bg-card-subtle transition cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Type Selector (Lent vs Borrowed) */}
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-text-main">Loan Type</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("lent")}
                class={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                  type() === "lent"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "bg-card-subtle border-card-border text-text-muted hover:text-text-main"
                }`}
              >
                I Lent (They owe me)
              </button>
              <button
                type="button"
                onClick={() => setType("borrowed")}
                class={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                  type() === "borrowed"
                    ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "bg-card-subtle border-card-border text-text-muted hover:text-text-main"
                }`}
              >
                I Borrowed (I owe them)
              </button>
            </div>
          </div>

          {/* Friend / Contact Name */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">
              {type() === "lent" ? "Borrower (Friend's Name)" : "Lender (Friend's Name)"}{" "}
              <span class="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Alex, Bob, Sarah"
              list="contact-suggestions"
              value={contactName()}
              onInput={(e) => {
                setContactName(e.currentTarget.value);
                if (error()) setError("");
              }}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
              autofocus
            />
            <datalist id="contact-suggestions">
              <For each={props.existingContacts || []}>
                {(name) => <option value={name} />}
              </For>
            </datalist>
          </div>

          {/* Amount and Account */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-text-main">
                Amount <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                  {symbol()}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount()}
                  onInput={(e) => {
                    setAmount(e.currentTarget.value);
                    if (error()) setError("");
                  }}
                  class="w-full bg-card border border-card-border rounded-xl pl-7 pr-3 py-2 text-xs font-semibold text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-text-main">
                {type() === "lent" ? "Deduct From Account" : "Deposit To Account"}
              </label>
              <select
                value={account()}
                onChange={(e) => setAccount(e.currentTarget.value)}
                class="w-full bg-card border border-card-border rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
              >
                <For each={props.accounts}>
                  {(acc) => (
                    <option value={acc.name}>
                      {acc.name} ({symbol()}{acc.balance.toLocaleString()})
                    </option>
                  )}
                </For>
              </select>
            </div>
          </div>

          {/* Start Date and Due Date */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-text-main">Date Given</label>
              <input
                type="date"
                value={startDate()}
                onInput={(e) => setStartDate(e.currentTarget.value)}
                class="w-full bg-card border border-card-border rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-text-main">
                Due Date <span class="text-text-subtle font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={dueDate()}
                onInput={(e) => setDueDate(e.currentTarget.value)}
                class="w-full bg-card border border-card-border rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">
              Notes / Purpose <span class="text-text-subtle font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Concert tickets, emergency repair, trip split"
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

          {/* Helpful context card */}
          <div class="p-3 bg-card-subtle rounded-xl border border-card-border text-[11px] text-text-muted leading-relaxed">
            {type() === "lent" ? (
              <span>
                💡 <strong>Cash flow neutral:</strong> Lending money decreases your{" "}
                <span class="font-medium text-text-main">{account()}</span> balance without inflating your monthly expenses.
              </span>
            ) : (
              <span>
                💡 <strong>Cash flow neutral:</strong> Borrowing money increases your{" "}
                <span class="font-medium text-text-main">{account()}</span> balance without inflating your monthly income.
              </span>
            )}
          </div>

          {error() && <p class="text-xs text-rose-500 font-semibold">{error()}</p>}

          {/* Actions */}
          <div class="flex items-center justify-end gap-3 pt-3 border-t border-card-border">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main transition hover:bg-card-subtle rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover active:bg-primary-active transition rounded-xl shadow-xs cursor-pointer"
            >
              Save Loan Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
