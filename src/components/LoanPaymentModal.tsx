import { Component, createSignal, For } from "solid-js";
import { X, Check, ArrowDownLeft, ArrowUpRight } from "./icons";
import { Account, LoanRecord, LoanPayment } from "../types/finance";

interface LoanPaymentModalProps {
  loan: LoanRecord;
  accounts: Account[];
  currencySymbol?: string;
  onClose: () => void;
  onSavePayment: (payment: LoanPayment) => void;
}

export const LoanPaymentModal: Component<LoanPaymentModalProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";
  const isLent = () => props.loan.type === "lent";

  const [amount, setAmount] = createSignal(String(props.loan.remainingAmount));
  const [account, setAccount] = createSignal(
    props.accounts.find((a) => a.name === props.loan.account)?.name ||
      props.accounts[0]?.name ||
      "Main Account"
  );
  const [date, setDate] = createSignal(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");

  const parsedAmount = () => parseFloat(amount()) || 0;
  const remainingAfter = () => Math.max(0, props.loan.remainingAmount - parsedAmount());
  const isFullSettlement = () => parsedAmount() >= props.loan.remainingAmount;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const val = parsedAmount();
    if (isNaN(val) || val <= 0) {
      setError("Please enter a valid repayment amount greater than 0");
      return;
    }

    const payment: LoanPayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      loanId: props.loan.id,
      contactName: props.loan.contactName,
      date: date(),
      amount: val,
      account: account(),
      notes: notes().trim() || undefined,
    };

    props.onSavePayment(payment);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div class="relative w-full max-w-md bg-card rounded-2xl border border-card-border p-6 shadow-2xl">
        {/* Header */}
        <div class="flex items-center justify-between pb-3.5 border-b border-card-border mb-4">
          <div class="flex items-center gap-2.5">
            <div
              class={`p-2 rounded-xl ${
                isLent()
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              {isLent() ? <ArrowDownLeft class="w-5 h-5" /> : <ArrowUpRight class="w-5 h-5" />}
            </div>
            <div>
              <h2 class="text-base font-bold text-text-main">
                {isLent() ? "Record Return from Friend" : "Record Repayment to Friend"}
              </h2>
              <p class="text-xs text-text-muted mt-0.5">
                Contact: <span class="font-semibold text-text-main">{props.loan.contactName}</span>
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

        {/* Balance Status Card */}
        <div class="p-3.5 bg-card-subtle rounded-xl border border-card-border flex items-center justify-between mb-4">
          <div>
            <div class="text-[10px] uppercase font-bold text-text-muted tracking-wider">
              Outstanding Balance
            </div>
            <div class="text-lg font-bold text-text-main mt-0.5">
              {symbol()}{props.loan.remainingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] uppercase font-bold text-text-muted tracking-wider">
              Initial Loan
            </div>
            <div class="text-xs font-semibold text-text-muted mt-0.5">
              {symbol()}{props.loan.initialAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Amount and Quick Presets */}
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-text-main">
                Payment Amount <span class="text-rose-500">*</span>
              </label>
              <div class="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAmount(String(props.loan.remainingAmount))}
                  class="text-primary hover:underline font-semibold cursor-pointer"
                >
                  Full ({symbol()}{props.loan.remainingAmount})
                </button>
                <span class="text-text-subtle">•</span>
                <button
                  type="button"
                  onClick={() =>
                    setAmount(String((props.loan.remainingAmount / 2).toFixed(2)))
                  }
                  class="text-primary hover:underline font-semibold cursor-pointer"
                >
                  50%
                </button>
              </div>
            </div>

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
                autofocus
              />
            </div>
          </div>

          {/* Account */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">
              {isLent() ? "Deposit Money Into Account" : "Pay Money From Account"}
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

          {/* Date */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">Repayment Date</label>
            <input
              type="date"
              value={date()}
              onInput={(e) => setDate(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

          {/* Notes */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">
              Notes <span class="text-text-subtle font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Bank transfer, cash returned"
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

          {/* Status Preview */}
          <div class="p-3 bg-card-subtle rounded-xl border border-card-border text-xs flex items-center justify-between">
            <span class="text-text-muted">Remaining after payment:</span>
            <span
              class={`font-bold ${
                isFullSettlement()
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-text-main"
              }`}
            >
              {isFullSettlement() ? (
                <span class="inline-flex items-center gap-1">
                  <Check class="w-3.5 h-3.5" />
                  <span>Fully Settled!</span>
                </span>
              ) : (
                `${symbol()}${remainingAfter().toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}`
              )}
            </span>
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
              Confirm Repayment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
