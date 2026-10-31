import { Component, createSignal, For, onMount, Show } from "solid-js";
import { X, HandCoins, Sparkles, Check, Loader2, RotateCcw } from "./icons";
import { Account, Transaction, TransactionType, CategoryItem } from "../types/finance";
import { parseNaturalLanguageTransaction } from "../utils/ai/naturalLanguageParser";
import { getAIConfig } from "../utils/ai/storage";
import { AIConfig } from "../utils/ai/types";

interface TransactionModalProps {
  transaction?: Transaction | null;
  accounts: Account[];
  categories?: CategoryItem[];
  currencySymbol?: string;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, "id">, id?: string) => void;
}

export const TransactionModal: Component<TransactionModalProps> = (props) => {
  const isEditing = () => !!props.transaction;

  const defaultCategoryList = [
    { name: "Housing", color: "#2563eb" },
    { name: "Groceries", color: "#10b981" },
    { name: "Dining Out", color: "#f59e0b" },
    { name: "Transportation", color: "#8b5cf6" },
    { name: "Utilities", color: "#06b6d4" },
    { name: "Salary", color: "#10b981" },
    { name: "Entertainment", color: "#ec4899" },
    { name: "Healthcare", color: "#ef4444" },
    { name: "Shopping", color: "#f97316" },
    { name: "Travel", color: "#14b8a6" },
    { name: "Education", color: "#6366f1" },
    { name: "Loan Lent", color: "#8b5cf6" },
    { name: "Loan Repayment", color: "#10b981" },
    { name: "Other", color: "#64748b" },
  ];

  const allCategories = () => {
    const base =
      props.categories && props.categories.length > 0
        ? props.categories.map((c) => ({ name: c.name, color: c.color }))
        : defaultCategoryList;

    const list = [...base];
    const txCat = props.transaction?.category;
    if (txCat && !list.some((c) => c.name.toLowerCase() === txCat.toLowerCase())) {
      list.unshift({
        name: txCat,
        color: props.transaction?.categoryColor || "#64748b",
      });
    }
    return list;
  };

  const getInitialCategory = () => {
    const txCat = props.transaction?.category;
    if (txCat) return txCat;
    if (props.categories && props.categories.length > 0) {
      return props.categories[0].name;
    }
    return "Groceries";
  };

  const allAccounts = () => {
    const list = props.accounts.map((a) => a.name);
    const txAcc = props.transaction?.account;
    if (txAcc && !list.some((a) => a.toLowerCase() === txAcc.toLowerCase())) {
      list.unshift(txAcc);
    }
    return list;
  };

  // Determine initial tab and loan direction
  const isInitialLoan = () => {
    const cat = props.transaction?.category?.toLowerCase() || "";
    return cat.includes("loan") || cat.includes("repay");
  };

  const initialTab = (): "expense" | "income" | "transfer" | "loan" => {
    if (isInitialLoan()) return "loan";
    return props.transaction?.type || "expense";
  };

  const initialLoanDirection = (): "lent" | "received" => {
    if (props.transaction) {
      const cat = props.transaction.category.toLowerCase();
      if (cat.includes("lent") || props.transaction.amount < 0) return "lent";
      if (cat.includes("repay") || cat.includes("borrow") || props.transaction.amount > 0)
        return "received";
    }
    return "lent";
  };

  const [activeTab, setActiveTab] = createSignal<"expense" | "income" | "transfer" | "loan">(
    initialTab()
  );
  const [loanDirection, setLoanDirection] = createSignal<"lent" | "received">(
    initialLoanDirection()
  );

  const [payee, setPayee] = createSignal(props.transaction?.payee || "");
  const [amount, setAmount] = createSignal(
    props.transaction ? String(Math.abs(props.transaction.amount)) : ""
  );
  const [category, setCategory] = createSignal(getInitialCategory());
  const [account, setAccount] = createSignal(
    props.transaction?.account || props.accounts[0]?.name || ""
  );
  const [toAccount, setToAccount] = createSignal(
    props.transaction?.toAccount ||
      (props.accounts.find((a) => a.name !== props.transaction?.account)?.name ||
        props.accounts[1]?.name ||
        "")
  );
  const [date, setDate] = createSignal(
    props.transaction?.date || new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = createSignal(props.transaction?.notes || "");
  const [isPending, setIsPending] = createSignal(props.transaction?.status === "pending");

  // Natural Language Quick-Add state
  const [magicInput, setMagicInput] = createSignal("");
  const [isParsing, setIsParsing] = createSignal(false);
  const [magicSuccess, setMagicSuccess] = createSignal<string | null>(null);
  const [highlightedFields, setHighlightedFields] = createSignal<string[]>([]);
  const [undoSnapshot, setUndoSnapshot] = createSignal<{
    tab: "expense" | "income" | "transfer" | "loan";
    payee: string;
    amount: string;
    category: string;
    account: string;
    toAccount: string;
    date: string;
    notes: string;
  } | null>(null);
  const [aiConfig, setAiConfig] = createSignal<AIConfig | undefined>(undefined);

  onMount(async () => {
    try {
      const cfg = await getAIConfig();
      setAiConfig(cfg);
    } catch {
      // ignore
    }
  });

  const handleMagicParse = async () => {
    const raw = magicInput().trim();
    if (!raw || isParsing()) return;

    // Snapshot for Undo
    setUndoSnapshot({
      tab: activeTab(),
      payee: payee(),
      amount: amount(),
      category: category(),
      account: account(),
      toAccount: toAccount(),
      date: date(),
      notes: notes(),
    });

    setIsParsing(true);
    setMagicSuccess(null);

    try {
      const parsed = await parseNaturalLanguageTransaction(raw, {
        accounts: props.accounts,
        categories: props.categories,
        currencySymbol: props.currencySymbol,
        aiConfig: aiConfig(),
      });

      const updated: string[] = [];

      if (parsed.type) {
        setActiveTab(parsed.type);
        updated.push("Type");
      }
      if (parsed.payee) {
        setPayee(parsed.payee);
        updated.push("Payee");
      }
      if (parsed.amount !== undefined) {
        setAmount(String(parsed.amount));
        updated.push("Amount");
      }
      if (parsed.category) {
        setCategory(parsed.category);
        updated.push("Category");
      }
      if (parsed.account) {
        setAccount(parsed.account);
        updated.push("Account");
      }
      if (parsed.toAccount) {
        setToAccount(parsed.toAccount);
        updated.push("To Account");
      }
      if (parsed.date) {
        setDate(parsed.date);
        updated.push("Date");
      }
      if (parsed.notes) {
        setNotes(parsed.notes);
      }

      setHighlightedFields(updated);
      setMagicSuccess(`Auto-filled: ${updated.join(", ")}`);

      // Clear field highlight animation after 2.5s
      setTimeout(() => {
        setHighlightedFields([]);
      }, 2500);
    } catch (err) {
      console.error("Magic parse error:", err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleUndoMagic = () => {
    const s = undoSnapshot();
    if (!s) return;
    setActiveTab(s.tab);
    setPayee(s.payee);
    setAmount(s.amount);
    setCategory(s.category);
    setAccount(s.account);
    setToAccount(s.toAccount);
    setDate(s.date);
    setNotes(s.notes);
    setUndoSnapshot(null);
    setMagicSuccess(null);
    setHighlightedFields([]);
  };

  const handleMagicKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleMagicParse();
    }
  };

  const isFieldHighlighted = (name: string) => highlightedFields().includes(name);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount());
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (activeTab() === "loan") {
      const isLent = loanDirection() === "lent";
      const resolvedAmount = isLent ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
      const resolvedCat = isLent ? "Loan Lent" : "Loan Repayment";
      const resolvedColor = isLent ? "#8b5cf6" : "#10b981";
      const resolvedPayee =
        payee().trim() || (isLent ? "Loan to Friend" : "Repayment from Friend");

      props.onSave(
        {
          date: date(),
          payee: resolvedPayee,
          category: resolvedCat,
          categoryColor: resolvedColor,
          account: account(),
          toAccount: undefined, // Single account!
          amount: resolvedAmount,
          type: "transfer", // Cash flow neutral
          status: isPending()
            ? "pending"
            : props.transaction?.status === "flagged"
            ? "flagged"
            : "cleared",
          notes: notes() || undefined,
        },
        props.transaction?.id
      );
      props.onClose();
      return;
    }

    const matchedCat = allCategories().find(
      (c) => c.name.toLowerCase() === category().toLowerCase()
    );

    const resolvedPayee =
      payee().trim() ||
      (activeTab() === "transfer" ? `Transfer to ${toAccount()}` : "Untitled Transaction");
    const resolvedCat = activeTab() === "transfer" ? "Transfer" : category();
    const resolvedColor =
      activeTab() === "transfer"
        ? "#6366f1"
        : matchedCat?.color || props.transaction?.categoryColor || "#64748b";
    const resolvedAmount =
      activeTab() === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    props.onSave(
      {
        date: date(),
        payee: resolvedPayee,
        category: resolvedCat,
        categoryColor: resolvedColor,
        account: account(),
        toAccount: activeTab() === "transfer" ? toAccount() : undefined,
        amount: resolvedAmount,
        type: (activeTab() === "transfer" ? "transfer" : activeTab()) as TransactionType,
        status: isPending()
          ? "pending"
          : props.transaction?.status === "flagged"
          ? "flagged"
          : "cleared",
        notes: notes() || undefined,
      },
      props.transaction?.id
    );

    props.onClose();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div class="bg-card rounded-2xl border border-card-border shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div class="flex items-center justify-between border-b border-card-border pb-3">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold text-text-main">
              {isEditing() ? "Edit Transaction" : "New Transaction"}
            </h2>
            <Show when={activeTab() === "loan"}>
              <span class="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary-light text-primary px-2 py-0.5 rounded-full">
                <HandCoins class="w-3 h-3" />
                <span>P2P Loan</span>
              </span>
            </Show>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle cursor-pointer transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Natural Language Quick-Add Bar */}
          <Show when={!isEditing()}>
            <div class="space-y-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <Sparkles class="w-3.5 h-3.5" />
                  <span>Natural Language Quick-Add</span>
                </label>
                <Show when={aiConfig()?.enabled}>
                  <span class="text-[9px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                    AI Assisted
                  </span>
                </Show>
              </div>
              <div class="flex items-center gap-1.5">
                <input
                  type="text"
                  value={magicInput()}
                  onInput={(e) => setMagicInput(e.currentTarget.value)}
                  onKeyDown={handleMagicKeyDown}
                  placeholder='e.g. "Dinner with Alex for $42" or "Salary $5000"'
                  class="w-full text-xs px-3 py-2 rounded-lg bg-card border border-card-border text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleMagicParse}
                  disabled={!magicInput().trim() || isParsing()}
                  class="px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all shrink-0 shadow-xs"
                  title="Auto-fill fields from phrase (Enter)"
                >
                  <Show when={isParsing()} fallback={<Sparkles class="w-3.5 h-3.5" />}>
                    <Loader2 class="w-3.5 h-3.5 animate-spin" />
                  </Show>
                  <span>Auto-fill</span>
                </button>
              </div>
              <Show when={magicSuccess()}>
                <div class="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5 px-0.5 animate-in fade-in">
                  <span class="flex items-center gap-1 truncate max-w-[280px]">
                    <Check class="w-3.5 h-3.5 shrink-0" />
                    <span class="truncate">{magicSuccess()}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleUndoMagic}
                    class="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-text-main font-semibold cursor-pointer underline hover:no-underline shrink-0"
                  >
                    <RotateCcw class="w-2.5 h-2.5" />
                    <span>Undo</span>
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          {/* 4-Pill Mode Switcher: Expense | Income | Transfer | Loan / Debt */}
          <div class={`grid grid-cols-4 gap-1 rounded-xl bg-card-subtle p-1 border transition-all duration-300 ${
            isFieldHighlighted("Type") ? "border-primary ring-2 ring-primary/30" : "border-card-border"
          }`}>
            <button
              type="button"
              onClick={() => {
                setActiveTab("expense");
                if (category() === "Transfer" || category().includes("Loan"))
                  setCategory("Groceries");
              }}
              class={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab() === "expense"
                  ? "bg-card text-text-main shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("income");
                if (category() === "Transfer" || category().includes("Loan"))
                  setCategory("Salary");
              }}
              class={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab() === "income"
                  ? "bg-card text-emerald-500 shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("transfer");
                setCategory("Transfer");
                if (!toAccount() || toAccount() === account()) {
                  const target = props.accounts.find((a) => a.name !== account());
                  if (target) setToAccount(target.name);
                }
              }}
              class={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab() === "transfer"
                  ? "bg-card text-primary shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Transfer
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("loan");
              }}
              class={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab() === "loan"
                  ? "bg-card text-primary shadow-xs font-bold"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Loan / Debt
            </button>
          </div>

          {/* Sub-selector for Loan / Debt: Lent vs Received */}
          <Show when={activeTab() === "loan"}>
            <div class="grid grid-cols-2 gap-2 p-1 bg-card-subtle rounded-xl border border-card-border">
              <button
                type="button"
                onClick={() => setLoanDirection("lent")}
                class={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                  loanDirection() === "lent"
                    ? "bg-card text-rose-500 shadow-xs font-bold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                Lent to Friend (Out)
              </button>
              <button
                type="button"
                onClick={() => setLoanDirection("received")}
                class={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                  loanDirection() === "received"
                    ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                Received / Return (In)
              </button>
            </div>
          </Show>

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
              class={`w-full bg-card border rounded-xl px-3.5 py-2 text-base font-bold text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 ${
                isFieldHighlighted("Amount") ? "border-primary ring-2 ring-primary/40 shadow-xs" : "border-card-border"
              }`}
            />
          </div>

          {/* Payee / Description / Friend input */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              {activeTab() === "loan"
                ? "Friend / Contact Name & Purpose"
                : activeTab() === "transfer"
                ? "Description / Note"
                : "Payee / Merchant"}
            </label>
            <input
              type="text"
              placeholder={
                activeTab() === "loan"
                  ? "e.g. Aganathavenkatesh M, Alex"
                  : activeTab() === "transfer"
                  ? `e.g. Card bill payment, Transfer to ${toAccount() || "Account"}`
                  : "e.g. Trader Joe's, Apple, Employer"
              }
              value={payee()}
              onInput={(e) => setPayee(e.currentTarget.value)}
              class={`w-full bg-card border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 ${
                isFieldHighlighted("Payee") ? "border-primary ring-2 ring-primary/40 shadow-xs" : "border-card-border"
              }`}
            />
          </div>

          {/* Accounts & Category Fields */}
          <Show
            when={activeTab() !== "loan"}
            fallback={
              <div class="space-y-3">
                <div>
                  <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    {loanDirection() === "lent"
                      ? "Deduct From Account"
                      : "Deposit Into Account"}
                  </label>
                  <select
                    value={account()}
                    onChange={(e) => setAccount(e.currentTarget.value)}
                    class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer"
                  >
                    <For each={allAccounts()}>
                      {(accName) => (
                        <option value={accName} class="bg-card text-text-main">
                          {accName}
                        </option>
                      )}
                    </For>
                  </select>
                </div>

                <div class="p-2.5 bg-card-subtle rounded-xl border border-card-border flex items-center justify-between text-xs">
                  <span class="text-text-muted">Category:</span>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
                    style={{
                      "background-color":
                        loanDirection() === "lent" ? "#8b5cf620" : "#10b98120",
                      color: loanDirection() === "lent" ? "#8b5cf6" : "#10b981",
                    }}
                  >
                    {loanDirection() === "lent" ? "Loan Lent" : "Loan Repayment"}
                  </span>
                </div>
              </div>
            }
          >
            {activeTab() === "transfer" ? (
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    From Account (Debit)
                  </label>
                  <select
                    value={account()}
                    onChange={(e) => {
                      setAccount(e.currentTarget.value);
                      if (toAccount() === e.currentTarget.value) {
                        const other = props.accounts.find(
                          (a) => a.name !== e.currentTarget.value
                        );
                        if (other) setToAccount(other.name);
                      }
                    }}
                    class={`w-full bg-card border rounded-xl px-3 pr-9 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 cursor-pointer appearance-none ${
                      isFieldHighlighted("Account") ? "border-primary ring-2 ring-primary/40 shadow-xs" : "border-card-border"
                    }`}
                  >
                    <For each={allAccounts()}>
                      {(accName) => (
                        <option
                          value={accName}
                          selected={account().toLowerCase() === accName.toLowerCase()}
                          class="bg-card text-text-main"
                        >
                          {accName}
                        </option>
                      )}
                    </For>
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    To Account (Credit)
                  </label>
                  <select
                    value={toAccount()}
                    onChange={(e) => setToAccount(e.currentTarget.value)}
                    class={`w-full bg-card border rounded-xl px-3 pr-9 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 cursor-pointer appearance-none ${
                      isFieldHighlighted("To Account") ? "border-primary ring-2 ring-primary/40 shadow-xs" : "border-card-border"
                    }`}
                  >
                    <For each={allAccounts()}>
                      {(accName) => (
                        <option
                          value={accName}
                          selected={toAccount().toLowerCase() === accName.toLowerCase()}
                          disabled={accName.toLowerCase() === account().toLowerCase()}
                          class="bg-card text-text-main"
                        >
                          {accName}{" "}
                          {accName.toLowerCase() === account().toLowerCase()
                            ? "(Same account)"
                            : ""}
                        </option>
                      )}
                    </For>
                  </select>
                </div>
              </div>
            ) : (
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={category()}
                    onChange={(e) => setCategory(e.currentTarget.value)}
                    class={`w-full bg-card border rounded-xl px-3 pr-9 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 cursor-pointer appearance-none ${
                      isFieldHighlighted("Category") ? "border-primary ring-2 ring-primary/40 shadow-xs" : "border-card-border"
                    }`}
                  >
                    <For each={allCategories()}>
                      {(c) => (
                        <option
                          value={c.name}
                          selected={category().toLowerCase() === c.name.toLowerCase()}
                          class="bg-card text-text-main"
                        >
                          {c.name}
                        </option>
                      )}
                    </For>
                  </select>
                </div>

                <div>
                  <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    Account
                  </label>
                  <select
                    value={account()}
                    onChange={(e) => setAccount(e.currentTarget.value)}
                    class={`w-full bg-card border rounded-xl px-3 pr-9 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 cursor-pointer appearance-none ${
                      isFieldHighlighted("Account") ? "border-primary ring-2 ring-primary/40 shadow-xs" : "border-card-border"
                    }`}
                  >
                    <For each={allAccounts()}>
                      {(accName) => (
                        <option
                          value={accName}
                          selected={account().toLowerCase() === accName.toLowerCase()}
                          class="bg-card text-text-main"
                        >
                          {accName}
                        </option>
                      )}
                    </For>
                  </select>
                </div>
              </div>
            )}
          </Show>

          {/* Date input */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={date()}
              onInput={(e) => setDate(e.currentTarget.value)}
              class={`w-full bg-card border rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 ${
                isFieldHighlighted("Date") ? "border-primary ring-2 ring-primary/40 shadow-xs" : "border-card-border"
              }`}
            />
          </div>

          {/* Notes input (Multi-line) */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Add extra context, transaction reference, breakdown..."
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition leading-relaxed resize-y"
            />
          </div>

          {/* Pending Toggle */}
          <div class="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPending"
              checked={isPending()}
              onChange={(e) => setIsPending(e.currentTarget.checked)}
              class="rounded border-card-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <label for="isPending" class="text-xs text-text-muted select-none cursor-pointer">
              Mark as pending transaction
            </label>
          </div>

          {/* Action buttons */}
          <div class="flex items-center justify-end gap-3 pt-3 border-t border-card-border">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-5 py-2 rounded-xl transition shadow-xs cursor-pointer"
            >
              {isEditing() ? "Update Transaction" : "Save Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
