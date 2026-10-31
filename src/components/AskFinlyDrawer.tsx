import { Component, createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import {
  X,
  Sparkles,
  Bot,
  Send,
  Trash2,
  Settings,
  Copy,
  Check,
  Loader2,
  TrendingUp,
  PieChart,
  Wallet,
  ArrowRight,
  Plus,
} from "./icons";
import { Account, BudgetItem, CategoryItem, LoanRecord, Transaction } from "../types/finance";
import { AIConfig, AIMessage, DEFAULT_AI_CONFIG } from "../utils/ai/types";
import { getAIConfig } from "../utils/ai/storage";
import { sendAIChatRequest, fetchOllamaModels } from "../utils/ai/client";
import {
  AdvisorData,
  FinlyActionPayload,
  buildFinancialSystemPrompt,
  calculateFinancialMetrics,
  generateLocalFinancialAnswer,
} from "../utils/ai/advisorContext";
import { FormattedMessage } from "./FormattedMessage";
import { parseLocalNaturalLanguage } from "../utils/ai/naturalLanguageParser";

export interface AskFinlyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  accounts: Account[];
  budgets: BudgetItem[];
  transactions: Transaction[];
  categories: CategoryItem[];
  loans: LoanRecord[];
  attachedTransactions?: Transaction[];
  onClearAttachedTransactions?: () => void;
  onUpdateTransaction?: (tx: Transaction) => Promise<void>;
  onCreateTransaction?: (tx: Omit<Transaction, "id">) => Promise<Transaction | void>;
  initialPrompt?: string;
  currencySymbol?: string;
  userName?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isError?: boolean;
}

const STORAGE_KEY = "finly_advisor_chat_history";

export const AskFinlyDrawer: Component<AskFinlyDrawerProps> = (props) => {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [aiConfig, setAiConfig] = createSignal<AIConfig>(DEFAULT_AI_CONFIG);
  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [appliedActions, setAppliedActions] = createSignal<Record<string, boolean>>({});
  const [isApplyingAction, setIsApplyingAction] = createSignal<string | null>(null);

  const getActionKey = (action: FinlyActionPayload) =>
    action.type === "create_transaction"
      ? `create_${action.payee}_${action.amount}_${action.date || ""}`
      : `${action.type}_${action.txId || ""}_${action.newCategory || ""}_${action.newPayee || ""}`;

  const getResolvedAccountName = (accName?: string) => {
    if (!accName || props.accounts.length === 0) return props.accounts[0]?.name || "Primary";
    const clean = accName.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
    const direct = props.accounts.find((a) => a.name.toLowerCase().trim() === clean);
    if (direct) return direct.name;
    const partial = props.accounts.find((a) => {
      const aLower = a.name.toLowerCase().trim();
      return aLower === clean || aLower.includes(clean) || clean.includes(aLower);
    });
    if (partial) return partial.name;
    const wordMatch = props.accounts.find((a) => {
      const aWords = a.name.toLowerCase().split(/\s+/);
      const rawWords = clean.split(/\s+/);
      return rawWords.some((rw) => aWords.includes(rw));
    });
    return wordMatch ? wordMatch.name : props.accounts[0]?.name || "Primary";
  };

  let messagesEndRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const symbol = () => props.currencySymbol || "$";

  const refreshConfig = async () => {
    try {
      let cfg = await getAIConfig();
      if (cfg.provider === "ollama") {
        try {
          const models = await fetchOllamaModels(cfg.ollamaEndpoint);
          if (models.length > 0 && (!cfg.ollamaModel || !models.includes(cfg.ollamaModel))) {
            cfg = { ...cfg, ollamaModel: models[0] };
          }
        } catch {
          // ignore
        }
      }
      setAiConfig(cfg);
    } catch (e) {
      console.error("Failed to load AI config:", e);
    }
  };

  // Load chat history from localStorage and AI config on mount
  onMount(async () => {
    await refreshConfig();

    if (typeof window !== "undefined") {
      window.addEventListener("focus", refreshConfig);
      window.addEventListener("finly:ai_config_updated", refreshConfig);
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
  });

  onCleanup(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", refreshConfig);
      window.removeEventListener("finly:ai_config_updated", refreshConfig);
    }
  });

  // Re-fetch AI config & handle initialPrompt whenever the drawer opens
  createEffect(() => {
    if (props.isOpen) {
      refreshConfig();

      if (props.initialPrompt) {
        const p = props.initialPrompt;
        setTimeout(() => {
          handleSendMessage(p);
        }, 200);
      }

      // Auto-focus input
      setTimeout(() => {
        inputRef?.focus();
        scrollToBottom();
      }, 150);
    }
  });

  // Handle ESC key to close
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.isOpen) {
      props.onClose();
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
    }
  });

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const saveMessagesToStorage = (newMsgs: ChatMessage[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMsgs));
    } catch {
      // ignore
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const getAdvisorData = (): AdvisorData => ({
    accounts: props.accounts,
    budgets: props.budgets,
    transactions: props.transactions,
    categories: props.categories,
    loans: props.loans,
    selectedTransactions: props.attachedTransactions,
    currencySymbol: props.currencySymbol,
    userName: props.userName,
  });

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Helper to extract finly action payload from message text
  const parseMessageActions = (content: string) => {
    const actionRegex = /:::finly_action\s*([\s\S]*?)\s*:::/g;
    const actions: FinlyActionPayload[] = [];
    let match;
    while ((match = actionRegex.exec(content)) !== null) {
      try {
        let rawJson = match[1].replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(rawJson);
        if (parsed.type && (parsed.txId || parsed.type === "create_transaction")) {
          actions.push(parsed);
        }
      } catch {
        // ignore malformed action json
      }
    }
    let cleanContent = content.replace(actionRegex, "").trim();
    if (!cleanContent && actions.length > 0) {
      cleanContent = "Here is the proposed update for this transaction:";
    } else if (!cleanContent) {
      cleanContent = content.trim();
    }
    return { cleanContent, actions };
  };

  const handleApplyAction = async (action: FinlyActionPayload) => {
    const actionKey = getActionKey(action);

    if (action.type === "create_transaction") {
      if (!props.onCreateTransaction || appliedActions()[actionKey]) return;
      setIsApplyingAction(actionKey);
      try {
        const cat = props.categories.find(
          (c) => c.name.toLowerCase() === (action.category || "Other").toLowerCase()
        );
        const isExpense = action.transactionType !== "income";
        const numAmt = action.amount ? Math.abs(action.amount) : 0;
        await props.onCreateTransaction({
          date: action.date || new Date().toISOString().split("T")[0],
          payee: action.payee,
          category: action.category || "Other",
          categoryColor: cat?.color || "#64748b",
          account: getResolvedAccountName(action.account),
          toAccount: action.toAccount,
          amount: isExpense ? -numAmt : numAmt,
          type: action.transactionType || "expense",
          status: "cleared",
          notes: action.notes || undefined,
        });
        setAppliedActions((prev) => ({ ...prev, [actionKey]: true }));
      } catch (err) {
        console.error("Failed to create transaction from AI action:", err);
      } finally {
        setIsApplyingAction(null);
      }
      return;
    }

    if (!props.onUpdateTransaction || appliedActions()[actionKey]) return;

    setIsApplyingAction(actionKey);
    try {
      const targetTx = props.transactions.find((t) => t.id === action.txId) ||
        (props.attachedTransactions ? props.attachedTransactions.find((t) => t.id === action.txId) : undefined);

      if (targetTx) {
        let updated: Transaction = { ...targetTx };

        if (action.type === "update_category" && action.newCategory) {
          const cat = props.categories.find(
            (c) => c.name.toLowerCase() === action.newCategory!.toLowerCase()
          );
          updated = {
            ...updated,
            category: action.newCategory,
            categoryColor: cat?.color || updated.categoryColor,
          };
        } else if (action.type === "update_payee" && action.newPayee) {
          updated = {
            ...updated,
            payee: action.newPayee,
          };
        } else if (action.type === "clear_flag") {
          updated = {
            ...updated,
            status: "cleared",
          };
        }

        await props.onUpdateTransaction(updated);
        setAppliedActions((prev) => ({ ...prev, [actionKey]: true }));
      }
    } catch (err) {
      console.error("Failed to apply AI action:", err);
    } finally {
      setIsApplyingAction(null);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend ?? inputPrompt();
    const prompt = rawText.trim();
    if (!prompt || isLoading()) return;

    setInputPrompt("");

    const userMsg: ChatMessage = {
      id: "u_" + Date.now(),
      role: "user",
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated = [...messages(), userMsg];
    setMessages(updated);
    saveMessagesToStorage(updated);
    scrollToBottom();

    setIsLoading(true);

    const advisorData = getAdvisorData();
    const cfg = aiConfig();

    try {
      let reply = "";

      if (cfg.enabled) {
        // Prepare AI conversation context with full financial snapshot
        const systemPrompt = buildFinancialSystemPrompt(advisorData);

        // Include last 6 messages for conversational context (clean any past error banners)
        const recentHistory: AIMessage[] = updated
          .filter((m) => !m.isError)
          .slice(-6)
          .map((m) => {
            let clean = m.content.replace(/:::finly_action[\s\S]*?:::/g, "").trim();
            if (clean.startsWith("⚠️ *Could not connect to")) {
              const parts = clean.split("\n\n");
              clean = parts.slice(1).join("\n\n").trim();
            }
            return {
              role: m.role,
              content: clean || m.content,
            };
          });

        const aiMessages: AIMessage[] = [
          { role: "system", content: systemPrompt },
          ...recentHistory,
        ];

        try {
          reply = await sendAIChatRequest(aiMessages, cfg);

          // Safety net: if AI model did not emit :::finly_action block, but user entered a transaction/expense phrase
          if (
            !reply.includes(":::finly_action") &&
            (!props.attachedTransactions || props.attachedTransactions.length === 0)
          ) {
            const parsed = parseLocalNaturalLanguage(prompt, {
              accounts: props.accounts,
              categories: props.categories,
              currencySymbol: symbol(),
            });
            if (parsed.amount && parsed.amount > 0) {
              reply = `${reply.trim()}\n\n:::finly_action\n${JSON.stringify({
                type: "create_transaction",
                payee: parsed.payee,
                amount: parsed.amount,
                transactionType: parsed.type,
                category: parsed.category || "Dining Out",
                account: parsed.account || props.accounts[0]?.name || "Primary",
                toAccount: parsed.toAccount,
                date: parsed.date,
                notes: parsed.notes || "",
              })}\n:::`;
            }
          }
        } catch (apiErr: any) {
          console.warn("AI provider error, falling back to local advisor:", apiErr);
          const localFallback = generateLocalFinancialAnswer(prompt, advisorData);
          reply = `⚠️ *Could not connect to ${cfg.provider.toUpperCase()} (${apiErr.message || "Unknown error"}). Here is Finly's local calculation:* \n\n${localFallback}`;
        }
      } else {
        // Fallback: smart rule-based local answer
        reply = generateLocalFinancialAnswer(prompt, advisorData);
      }

      if (!reply || !reply.trim()) {
        reply = generateLocalFinancialAnswer(prompt, advisorData);
      }

      const botMsg: ChatMessage = {
        id: "b_" + Date.now(),
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const finalMsgs = [...updated, botMsg];
      setMessages(finalMsgs);
      saveMessagesToStorage(finalMsgs);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: "err_" + Date.now(),
        role: "assistant",
        content: `Sorry, I encountered an error while processing your request: ${err.message || "Unknown error"}. Please check your connection or AI settings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
      };
      const finalMsgs = [...updated, errorMsg];
      setMessages(finalMsgs);
      saveMessagesToStorage(finalMsgs);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const metrics = () => calculateFinancialMetrics(getAdvisorData());

  const quickQuestions = () => {
    if (props.attachedTransactions && props.attachedTransactions.length > 0) {
      if (props.attachedTransactions.length === 1) {
        const tx = props.attachedTransactions[0];
        return [
          `Make description meaningful for ${tx.payee}`,
          `Is '${tx.category}' the right category for ${tx.payee}?`,
          `Check for duplicate transactions of ${tx.payee}`,
          `Does this ${symbol()}${Math.abs(tx.amount).toFixed(2)} expense fit my budget?`,
        ];
      }
      return [
        "Make descriptions clean and meaningful",
        "Verify categories for these selected transactions",
        "Summarize these selected transactions",
        "Are any of these transactions duplicates?",
        "Recategorize these selected transactions",
      ];
    }

    return [
      `Add dinner with Alex for ${symbol()}42`,
      "How much did I spend this month?",
      "Which budgets are nearing their limit?",
      "What is my total net worth breakdown?",
      "Where can I cut expenses to save money?",
      "Audit my transactions for incorrect categories",
      "Are there any pending or flagged items?",
    ];
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div
        onClick={props.onClose}
        class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Container */}
      <aside
        class="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[530px] bg-card border-l border-card-border shadow-2xl z-50 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300 select-none"
      >
        {/* Header */}
        <div class="px-4 py-3.5 border-b border-card-border bg-card-subtle flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="relative w-9 h-9 rounded-xl bg-linear-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary/25">
              <Bot class="w-5 h-5" />
              <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-text-main tracking-tight">Ask Finly</span>
                <span class="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                  <Sparkles class="w-2.5 h-2.5" />
                  Advisor
                </span>
              </div>
              <div class="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                <Show
                  when={aiConfig().enabled}
                  fallback={
                    <span class="flex items-center gap-1 text-amber-500 font-medium">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Local Offline Mode
                    </span>
                  }
                >
                  <span class="flex items-center gap-1 text-emerald-500 font-medium">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {aiConfig().provider === "ollama"
                      ? `Ollama (${aiConfig().ollamaModel || "qwen3.5:4b"})`
                      : aiConfig().provider === "gemini"
                      ? `Gemini (${aiConfig().geminiModel || "flash"})`
                      : aiConfig().provider === "openai"
                      ? `OpenAI (${aiConfig().openaiModel || "gpt-4o-mini"})`
                      : `Claude (${aiConfig().anthropicModel || "haiku"})`}
                  </span>
                </Show>
              </div>
            </div>
          </div>

          {/* Header Controls */}
          <div class="flex items-center gap-1">
            <Show when={messages().length > 0}>
              <button
                type="button"
                onClick={handleClearChat}
                class="p-1.5 rounded-lg text-text-subtle hover:text-rose-500 hover:bg-card transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </Show>

            <button
              type="button"
              onClick={() => {
                if (props.onOpenSettings) {
                  props.onOpenSettings();
                }
              }}
              class="p-1.5 rounded-lg text-text-subtle hover:text-text-main hover:bg-card transition-colors cursor-pointer"
              title="AI Assistant Settings"
            >
              <Settings class="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-text-subtle hover:text-text-main hover:bg-card transition-colors cursor-pointer ml-1"
              title="Close drawer (Esc)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Thread Area */}
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <Show
            when={messages().length > 0}
            fallback={
              /* Welcome Hero / Empty State */
              <div class="py-4 space-y-5 animate-in fade-in duration-300">
                {/* Hero Card */}
                <div class="p-4 rounded-2xl bg-linear-to-b from-primary/10 via-primary/5 to-transparent border border-primary/20 text-center space-y-2.5">
                  <div class="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto shadow-inner">
                    <Sparkles class="w-6 h-6" />
                  </div>
                  <div>
                    <h3 class="font-bold text-sm text-text-main">
                      {props.userName ? `Hello, ${props.userName}!` : "Welcome to Finly Advisor"}
                    </h3>
                    <p class="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                      Ask natural language questions about your accounts, budget limits, spending trends, or select transactions to inspect and recategorize them.
                    </p>
                  </div>
                </div>

                {/* Instant Snapshot Metrics */}
                <div class="grid grid-cols-2 gap-2.5">
                  <div class="p-3 rounded-xl bg-card-subtle border border-card-border space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-text-muted font-medium">
                      <span>Net Worth</span>
                      <Wallet class="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div class="text-sm font-bold text-text-main truncate">
                      {metrics().sym}
                      {metrics().totalNetWorth.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div class="p-3 rounded-xl bg-card-subtle border border-card-border space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-text-muted font-medium">
                      <span>This Month Spend</span>
                      <TrendingUp class="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <div class="text-sm font-bold text-text-main truncate">
                      {metrics().sym}
                      {metrics().currentMonthExpense.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div class="p-3 rounded-xl bg-card-subtle border border-card-border space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-text-muted font-medium">
                      <span>Budget Alerts</span>
                      <PieChart class="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div class="text-sm font-bold text-text-main truncate">
                      {metrics().exceededBudgets.length > 0 ? (
                        <span class="text-rose-500">{metrics().exceededBudgets.length} exceeded</span>
                      ) : metrics().warningBudgets.length > 0 ? (
                        <span class="text-amber-500">{metrics().warningBudgets.length} near limit</span>
                      ) : (
                        <span class="text-emerald-500">All healthy</span>
                      )}
                    </div>
                  </div>

                  <div class="p-3 rounded-xl bg-card-subtle border border-card-border space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-text-muted font-medium">
                      <span>Flagged for Review</span>
                      <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    </div>
                    <div class="text-sm font-bold text-text-main truncate">
                      {metrics().flaggedTransactions.length > 0
                        ? `${metrics().flaggedTransactions.length} item(s)`
                        : "0 flagged"}
                    </div>
                  </div>
                </div>

                {/* Suggested Questions */}
                <div class="space-y-2">
                  <div class="text-[11px] font-bold text-text-subtle uppercase tracking-wider px-1">
                    {props.attachedTransactions && props.attachedTransactions.length > 0
                      ? "Selected Transaction Prompts"
                      : "Suggested Questions"}
                  </div>
                  <div class="space-y-1.5">
                    <For each={quickQuestions()}>
                      {(q) => (
                        <button
                          type="button"
                          onClick={() => handleSendMessage(q)}
                          class="w-full text-left p-2.5 rounded-xl bg-card hover:bg-card-subtle border border-card-border hover:border-primary/40 text-xs text-text-main font-medium transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                        >
                          <span class="truncate">{q}</span>
                          <ArrowRight class="w-3.5 h-3.5 text-text-subtle group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            }
          >
            {/* Conversation Messages */}
            <For each={messages()}>
              {(msg) => {
                const isUser = msg.role === "user";
                const { cleanContent, actions } = parseMessageActions(msg.content);

                return (
                  <div
                    class={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in fade-in duration-150`}
                  >
                    <div class="flex items-center gap-1.5 mb-1 px-1">
                      <Show
                        when={!isUser}
                        fallback={<span class="text-[10px] text-text-subtle font-medium">You</span>}
                      >
                        <div class="flex items-center gap-1 text-[10px] text-text-subtle font-medium">
                          <Bot class="w-3 h-3 text-primary" />
                          <span>Finly</span>
                        </div>
                      </Show>
                      <span class="text-[10px] text-text-subtle">· {msg.timestamp}</span>
                    </div>

                    <div
                      class={`max-w-[92%] rounded-2xl px-4 py-3 text-xs ${
                        isUser
                          ? "bg-primary text-white rounded-tr-xs shadow-xs"
                          : msg.isError
                          ? "bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-tl-xs"
                          : "bg-card-subtle border border-card-border text-text-main rounded-tl-xs shadow-xs"
                      }`}
                    >
                      <Show
                        when={!isUser}
                        fallback={<div class="whitespace-pre-wrap leading-relaxed select-text">{msg.content}</div>}
                      >
                        <FormattedMessage content={cleanContent || "I have analyzed this transaction."} />

                        {/* Interactive Action Cards */}
                        <Show when={actions.length > 0}>
                          <div class="mt-3 space-y-2 pt-2 border-t border-card-border/60">
                            <For each={actions}>
                              {(action) => {
                                const actionKey = getActionKey(action);
                                const isApplied = () => {
                                  if (appliedActions()[actionKey]) return true;
                                  if (action.type === "create_transaction") {
                                    const match = props.transactions.find(
                                      (t) =>
                                        t.payee.toLowerCase().trim() === action.payee.toLowerCase().trim() &&
                                        Math.abs(t.amount) === (action.amount ? Math.abs(action.amount) : 0) &&
                                        t.date === (action.date || new Date().toISOString().split("T")[0])
                                    );
                                    if (match) return true;
                                  }
                                  const current = props.transactions.find((t) => t.id === action.txId) ||
                                    props.attachedTransactions?.find((t) => t.id === action.txId);
                                  if (current) {
                                    if (action.type === "update_category" && action.newCategory && current.category.toLowerCase() === action.newCategory.toLowerCase()) {
                                      return true;
                                    }
                                    if (action.type === "update_payee" && action.newPayee && current.payee.toLowerCase().trim() === action.newPayee.toLowerCase().trim()) {
                                      return true;
                                    }
                                    if (action.type === "clear_flag" && current.status !== "flagged") {
                                      return true;
                                    }
                                  }
                                  return false;
                                };
                                const isBusy = () => isApplyingAction() === actionKey;

                                return (
                                  <div class="p-3 rounded-xl bg-card border border-primary/25 shadow-xs space-y-2">
                                    <div class="flex items-center justify-between">
                                      <div class="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                                        <Sparkles class="w-3.5 h-3.5" />
                                        <span>
                                          {action.type === "update_category"
                                            ? "Category Update Proposal"
                                            : action.type === "update_payee"
                                            ? "Rename Description Proposal"
                                            : action.type === "create_transaction"
                                            ? "New Transaction Proposal"
                                            : "Clear Flag Proposal"}
                                        </span>
                                      </div>
                                      <Show when={action.amount !== undefined}>
                                        <span class={`text-xs font-mono font-semibold ${
                                          action.transactionType === "income" ? "text-emerald-500 font-bold" : "text-text-main"
                                        }`}>
                                          {action.transactionType === "income" ? "+" : action.type === "create_transaction" ? "-" : ""}{symbol()}{action.amount?.toFixed(2)}
                                        </span>
                                      </Show>
                                    </div>

                                    <div class="text-xs text-text-main font-semibold truncate">
                                      {action.payee}
                                    </div>

                                    <Show when={action.type === "update_category"}>
                                      <div class="flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg bg-card-subtle border border-card-border">
                                        <span class="line-through text-text-muted">{action.oldCategory || "Current"}</span>
                                        <ArrowRight class="w-3 h-3 text-primary shrink-0" />
                                        <span class="font-bold text-primary">{action.newCategory}</span>
                                      </div>
                                    </Show>

                                    <Show when={action.type === "update_payee"}>
                                      <div class="flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg bg-card-subtle border border-card-border">
                                        <span class="line-through text-text-muted truncate max-w-[150px]">{action.payee}</span>
                                        <ArrowRight class="w-3 h-3 text-primary shrink-0" />
                                        <span class="font-bold text-primary truncate max-w-[180px]">{action.newPayee}</span>
                                      </div>
                                    </Show>

                                    <Show when={action.type === "create_transaction"}>
                                      <div class="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                                        <span class="px-2 py-0.5 rounded-md bg-card-subtle border border-card-border font-semibold text-primary">
                                          {action.category || "General"}
                                        </span>
                                        <span class="text-text-muted">•</span>
                                        <span class="text-text-muted">{getResolvedAccountName(action.account)}</span>
                                        <span class="text-text-muted">•</span>
                                        <span class="text-text-muted font-mono">{action.date || "Today"}</span>
                                      </div>
                                    </Show>

                                    <div class="flex items-center justify-end gap-2 pt-1 border-t border-card-border/60">
                                      <Show
                                        when={isApplied()}
                                        fallback={
                                          <button
                                            type="button"
                                            onClick={() => handleApplyAction(action)}
                                            disabled={isBusy()}
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                          >
                                            <Show
                                              when={isBusy()}
                                              fallback={action.type === "create_transaction" ? <Plus class="w-3.5 h-3.5" /> : <Check class="w-3.5 h-3.5" />}
                                            >
                                              <Loader2 class="w-3.5 h-3.5 animate-spin" />
                                            </Show>
                                            <span>{action.type === "create_transaction" ? "Add to Transactions" : "Apply Change"}</span>
                                          </button>
                                        }
                                      >
                                        <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                                          <Check class="w-3.5 h-3.5" />
                                          <span>{action.type === "create_transaction" ? "Added to Transactions" : "Updated in Database"}</span>
                                        </span>
                                      </Show>
                                    </div>
                                  </div>
                                );
                              }}
                            </For>
                          </div>
                        </Show>

                        {/* Copy button */}
                        <div class="mt-2 pt-2 border-t border-card-border/60 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, cleanContent || msg.content)}
                            class="inline-flex items-center gap-1 text-[10px] text-text-subtle hover:text-text-main transition-colors cursor-pointer"
                            title="Copy reply"
                          >
                            <Show
                              when={copiedId() === msg.id}
                              fallback={
                                <>
                                  <Copy class="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              }
                            >
                              <Check class="w-3 h-3 text-emerald-500" />
                              <span class="text-emerald-500">Copied!</span>
                            </Show>
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>

            {/* Thinking / Loading indicator */}
            <Show when={isLoading()}>
              <div class="flex flex-col items-start animate-in fade-in duration-200">
                <div class="flex items-center gap-1 text-[10px] text-text-subtle font-medium mb-1 px-1">
                  <Bot class="w-3 h-3 text-primary animate-bounce" />
                  <span>Finly is analyzing...</span>
                </div>
                <div class="bg-card-subtle border border-card-border rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-2.5 text-xs text-text-muted shadow-xs">
                  <Loader2 class="w-4 h-4 text-primary animate-spin" />
                  <span>Reviewing your accounts, budgets, and transactions...</span>
                </div>
              </div>
            </Show>

            <div ref={messagesEndRef} />
          </Show>
        </div>

        {/* Footer Area: Attached transactions badge, Quick follow-up chips & Input Box */}
        <div class="border-t border-card-border bg-card-subtle shrink-0">
          {/* Attached Transactions Context Strip */}
          <Show when={props.attachedTransactions && props.attachedTransactions.length > 0}>
            <div class="px-3.5 py-2 bg-primary-light/50 border-b border-primary/20 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 truncate">
                <span class="text-primary font-bold text-[11px] shrink-0">
                  📎 Attached Context ({props.attachedTransactions!.length}):
                </span>
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <For each={props.attachedTransactions}>
                    {(tx) => (
                      <span class="shrink-0 bg-card border border-primary/25 text-text-main text-[10px] px-2 py-0.5 rounded-md font-medium truncate max-w-[150px] shadow-2xs">
                        {tx.payee} ({symbol()}{Math.abs(tx.amount).toFixed(2)})
                      </span>
                    )}
                  </For>
                </div>
              </div>

              <Show when={props.onClearAttachedTransactions}>
                <button
                  type="button"
                  onClick={props.onClearAttachedTransactions}
                  class="p-1 rounded-md text-text-subtle hover:text-text-main hover:bg-card transition-colors cursor-pointer shrink-0"
                  title="Clear attached transactions"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </Show>
            </div>
          </Show>

          <div class="p-3 space-y-2">
            {/* Quick followup chips when messages exist */}
            <Show when={messages().length > 0}>
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <For
                  each={
                    props.attachedTransactions && props.attachedTransactions.length > 0
                      ? [
                          "Is category correct?",
                          "Check for duplicate",
                          "Fit in budget?",
                          "Change category",
                        ]
                      : [
                          "Audit categories",
                          "Budget check",
                          "Top 3 expenses",
                          "Net worth summary",
                        ]
                  }
                >
                  {(chip) => (
                    <button
                      type="button"
                      onClick={() => handleSendMessage(chip)}
                      class="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-card hover:bg-primary-light hover:text-primary border border-card-border transition-colors cursor-pointer text-text-muted"
                    >
                      {chip}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Input and Send button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              class="flex items-center gap-2"
            >
              <div class="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputPrompt()}
                  onInput={(e) => setInputPrompt(e.currentTarget.value)}
                  placeholder={
                    props.attachedTransactions && props.attachedTransactions.length > 0
                      ? "Ask about selected transaction(s), change category, or check duplicates..."
                      : "Ask Finly about spending, budgets, accounts..."
                  }
                  disabled={isLoading()}
                  class="w-full bg-card border border-card-border focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3.5 py-2.5 text-xs text-text-main placeholder-text-subtle transition-all outline-hidden disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading() || !inputPrompt().trim()}
                class="w-9 h-9 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-white flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                title="Send message"
              >
                <Show
                  when={isLoading()}
                  fallback={<Send class="w-4 h-4" />}
                >
                  <Loader2 class="w-4 h-4 animate-spin" />
                </Show>
              </button>
            </form>

            <div class="text-[10px] text-center text-text-subtle">
              Finly calculates insights from your local database. Data never leaves your computer unless an external AI provider is configured.
            </div>
          </div>
        </div>
      </aside>
    </Show>
  );
};
