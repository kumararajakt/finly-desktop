import { Component, createSignal } from "solid-js";
import { X } from "./icons";

interface AccountModalProps {
  currencySymbol?: string;
  onClose: () => void;
  onSave: (account: { name: string; type: "checking" | "savings" | "credit" | "loan"; balance: number }) => void;
}

export const AccountModal: Component<AccountModalProps> = (props) => {
  const [name, setName] = createSignal("");
  const [type, setType] = createSignal<"checking" | "savings" | "credit" | "loan">("checking");
  const [balance, setBalance] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!name().trim()) return;

    const parsedBalance = parseFloat(balance()) || 0.0;
    props.onSave({
      name: name().trim(),
      type: type(),
      balance: type() === "credit" || type() === "loan" ? -Math.abs(parsedBalance) : parsedBalance,
    });
    props.onClose();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div class="bg-card rounded-2xl border border-card-border shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div class="flex items-center justify-between border-b border-card-border pb-3">
          <h2 class="text-base font-bold text-text-main">Add Account</h2>
          <button
            type="button"
            onClick={props.onClose}
            class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle cursor-pointer transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Account Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. HDFC Checking, ICICI Bank"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Account Type
            </label>
            <select
              value={type()}
              onChange={(e) => setType(e.currentTarget.value as any)}
              class="w-full bg-card border border-card-border rounded-xl px-3 pr-9 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer appearance-none"
            >
              <option value="checking" class="bg-card text-text-main">Checking / Bank Account</option>
              <option value="savings" class="bg-card text-text-main">Savings Account</option>
              <option value="credit" class="bg-card text-text-main">Credit Card</option>
              <option value="loan" class="bg-card text-text-main">Loan / Mortgage</option>
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Starting Balance ({props.currencySymbol || "$"})
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={balance()}
              onInput={(e) => setBalance(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-card-border">
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
              Add Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
