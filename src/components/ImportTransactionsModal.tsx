import { Component, createSignal, createMemo, onMount, For, Show } from "solid-js";
import {
  X,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  CircleAlert,
  FileSpreadsheet,
  Eye,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Tags,
  Sparkles,
  Loader2,
} from "./icons";
import { Account, Transaction, CategoryItem } from "../types/finance";
import {
  parseRawCSV,
  detectDefaultMapping,
  convertRowsToTransactions,
  ColumnMappingConfig,
  ParsedTransactionRow,
  getCategoryColor,
} from "../utils/csv";
import {
  classifyTransactionsWithAI,
  CategorizationInput,
} from "../utils/ai/smartCategorizer";
import { getAIConfig } from "../utils/ai/storage";
import { AIConfig, DEFAULT_AI_CONFIG } from "../utils/ai/types";

interface ImportTransactionsModalProps {
  csvText: string;
  fileName: string;
  accounts: Account[];
  categories?: CategoryItem[];
  currencySymbol?: string;
  isAiEnabled?: boolean;
  onClose: () => void;
  onImport: (transactions: Omit<Transaction, "id">[]) => void;
}

export const ImportTransactionsModal: Component<ImportTransactionsModalProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";

  // Step state
  const [step, setStep] = createSignal<"review" | "preview">("review");

  // Raw CSV & file state
  const [rawText, setRawText] = createSignal(props.csvText);
  const [activeFileName, setActiveFileName] = createSignal(props.fileName);

  // Parsed CSV content
  const parsedCSV = createMemo(() => parseRawCSV(rawText()));

  // Column Mapping Configuration
  const [config, setConfig] = createSignal<ColumnMappingConfig>(
    detectDefaultMapping(parsedCSV().headers, parsedCSV().rows, props.accounts)
  );

  // Selected row IDs for preview
  const [selectedRowIds, setSelectedRowIds] = createSignal<Set<string>>(new Set());
  const [hasManuallyChangedSelection, setHasManuallyChangedSelection] = createSignal(false);

  // Preview filtering & search
  const [previewSearch, setPreviewSearch] = createSignal("");
  const [previewFilter, setPreviewFilter] = createSignal<"all" | "income" | "expense">("all");
  const [showRawSample, setShowRawSample] = createSignal(true);
  const [isImporting, setIsImporting] = createSignal(false);

  // Smart Auto-Categorization state & row overrides
  const [aiConfig, setAiConfig] = createSignal<AIConfig>(DEFAULT_AI_CONFIG);
  const [rowOverrides, setRowOverrides] = createSignal<Record<string, Partial<ParsedTransactionRow>>>({});
  const [showSmartModal, setShowSmartModal] = createSignal(false);
  const [smartScope, setSmartScope] = createSignal<"uncategorized" | "all">("uncategorized");
  const [isClassifying, setIsClassifying] = createSignal(false);
  const [classificationProgress, setClassificationProgress] = createSignal({ done: 0, total: 0 });

  onMount(async () => {
    try {
      const cfg = await getAIConfig();
      setAiConfig(cfg);
    } catch {
      // ignore
    }
  });

  // Convert CSV rows using current config
  const parsedData = createMemo(() => {
    return convertRowsToTransactions(
      parsedCSV().headers,
      parsedCSV().rows,
      config(),
      props.accounts,
      props.categories || []
    );
  });

  // Keep selection and items synced when parsed rows change or overrides are applied
  const currentItems = createMemo(() => {
    const base = parsedData().items;
    const overrides = rowOverrides();
    if (Object.keys(overrides).length === 0) return base;
    return base.map((item) => {
      const o = overrides[item.id];
      if (!o) return item;
      return {
        ...item,
        ...o,
        transaction: {
          ...item.transaction,
          ...(o.transaction || {}),
        },
      };
    });
  });

  // Count unmapped or general rows
  const uncategorizedCount = createMemo(() => {
    return currentItems().filter(
      (it) =>
        it.isValid &&
        (!it.transaction.category ||
          it.transaction.category.toLowerCase() === "general" ||
          it.transaction.category.toLowerCase() === "uncategorized")
    ).length;
  });

  // Initialize selectedRowIds on first parse or when not manually modified
  createMemo(() => {
    const items = currentItems();
    if (!hasManuallyChangedSelection()) {
      const validIds = new Set(items.filter((it) => it.isValid).map((it) => it.id));
      setSelectedRowIds(validIds);
    }
  });

  // Filtered rows for Preview Table
  const filteredPreviewRows = createMemo(() => {
    const q = previewSearch().toLowerCase().trim();
    const f = previewFilter();

    return currentItems().filter((item) => {
      // Filter by type
      if (f === "income" && item.transaction.type !== "income") return false;
      if (f === "expense" && item.transaction.type !== "expense") return false;

      // Filter by search query
      if (q) {
        const t = item.transaction;
        const matchesPayee = t.payee.toLowerCase().includes(q);
        const matchesCat = t.category.toLowerCase().includes(q);
        const matchesAcc = t.account.toLowerCase().includes(q);
        const matchesNotes = t.notes?.toLowerCase().includes(q) ?? false;
        const matchesAmount = String(Math.abs(t.amount)).includes(q);
        if (!matchesPayee && !matchesCat && !matchesAcc && !matchesNotes && !matchesAmount) {
          return false;
        }
      }

      return true;
    });
  });

  // Dynamic statistics based on currently selected items
  const stats = createMemo(() => {
    const items = currentItems();
    const sel = selectedRowIds();
    let income = 0;
    let expense = 0;
    let selectedCount = 0;
    const newCats = new Set<string>();

    for (const it of items) {
      if (sel.has(it.id) && it.isValid) {
        selectedCount++;
        if (it.transaction.amount > 0) {
          income += it.transaction.amount;
        } else {
          expense += Math.abs(it.transaction.amount);
        }
        if (it.isNewCategory && it.transaction.category) {
          newCats.add(it.transaction.category);
        }
      }
    }

    return {
      selectedCount,
      totalValid: parsedData().summary.validRows,
      invalidCount: parsedData().summary.invalidRows,
      totalIncome: income,
      totalExpense: expense,
      netCashFlow: income - expense,
      newCategories: Array.from(newCats),
    };
  });

  // Handle toggling single row selection
  const toggleRow = (id: string) => {
    setHasManuallyChangedSelection(true);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all currently filtered rows
  const toggleSelectAllFiltered = () => {
    setHasManuallyChangedSelection(true);
    const displayed = filteredPreviewRows().filter((i) => i.isValid);
    const allSelected = displayed.every((i) => selectedRowIds().has(i.id));

    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        displayed.forEach((i) => next.delete(i.id));
      } else {
        displayed.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  // Handle switching CSV file inside modal
  const handleFileUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setRawText(text);
        setActiveFileName(file.name);
        const newParsed = parseRawCSV(text);
        setConfig(detectDefaultMapping(newParsed.headers, newParsed.rows, props.accounts));
        setHasManuallyChangedSelection(false);
        setRowOverrides({});
      }
    };
    reader.readAsText(file);
    input.value = "";
  };

  // Perform Final Import
  const handleConfirmImport = () => {
    const items = currentItems();
    const sel = selectedRowIds();
    const toImport = items
      .filter((it) => it.isValid && sel.has(it.id))
      .map((it) => it.transaction);

    if (toImport.length === 0) return;

    setIsImporting(true);
    try {
      props.onImport(toImport);
      props.onClose();
    } catch (err) {
      console.error("Failed to import transactions:", err);
      setIsImporting(false);
    }
  };

  // Handle batch Smart Auto-Categorization
  const handleRunSmartCategorize = async () => {
    if (isClassifying()) return;
    const items = currentItems();
    const scope = smartScope();

    const targetRows = items.filter((it) => {
      if (!it.isValid) return false;
      if (scope === "uncategorized") {
        const cat = (it.transaction.category || "").toLowerCase();
        return !cat || cat === "general" || cat === "uncategorized";
      }
      return true;
    });

    if (targetRows.length === 0) {
      setShowSmartModal(false);
      return;
    }

    setIsClassifying(true);
    setClassificationProgress({ done: 0, total: targetRows.length });

    try {
      const inputs: CategorizationInput[] = targetRows.map((r) => ({
        id: r.id,
        rawDescription: r.originalPayee || r.transaction.payee,
        amount: r.transaction.amount,
        type: r.transaction.type,
        date: r.transaction.date,
        currentCategory: r.transaction.category,
      }));

      const results = await classifyTransactionsWithAI(
        inputs,
        props.categories || [],
        aiConfig(),
        (done, total) => setClassificationProgress({ done, total })
      );

      const newOverrides: Record<string, Partial<ParsedTransactionRow>> = {};
      for (const res of results) {
        const existingCat = (props.categories || []).find(
          (c) => c.name.toLowerCase() === res.category.toLowerCase()
        );
        const catColor = existingCat
          ? existingCat.color
          : getCategoryColor(res.category, props.categories);

        const target = targetRows.find((t) => t.id === res.id);
        if (target) {
          newOverrides[res.id] = {
            isSmartCategorized: true,
            categorizationConfidence: res.confidence,
            categorizationReason: res.reason,
            isNewCategory: res.isNewCategory,
            originalPayee: inputs.find((i) => i.id === res.id)?.rawDescription,
            transaction: {
              ...target.transaction,
              payee: res.cleanPayee,
              category: res.category,
              categoryColor: catColor,
            },
          };
        }
      }

      setRowOverrides((prev) => ({ ...prev, ...newOverrides }));
      setShowSmartModal(false);
    } catch (err) {
      console.error("Smart categorization failed:", err);
    } finally {
      setIsClassifying(false);
    }
  };

  // Update single row category inline from table dropdown
  const handleUpdateRowCategory = (rowId: string, newCategoryName: string) => {
    const existingCat = (props.categories || []).find(
      (c) => c.name.toLowerCase() === newCategoryName.toLowerCase()
    );
    const catColor = existingCat
      ? existingCat.color
      : getCategoryColor(newCategoryName, props.categories);

    const baseRow = currentItems().find((i) => i.id === rowId);
    if (!baseRow) return;

    setRowOverrides((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        isNewCategory: !existingCat,
        transaction: {
          ...(prev[rowId]?.transaction || baseRow.transaction),
          category: newCategoryName,
          categoryColor: catColor,
        },
      },
    }));
  };

  // Helper updater for config fields
  const updateConfig = <K extends keyof ColumnMappingConfig>(
    key: K,
    value: ColumnMappingConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setRowOverrides({});
  };

  const headers = () => parsedCSV().headers;
  const rawRows = () => parsedCSV().rows;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div class="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-card rounded-2xl border border-card-border shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div class="flex items-center justify-between px-6 py-4 border-b border-card-border bg-card">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-xl bg-primary-light text-primary">
              <FileSpreadsheet class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-text-main">Import Transactions</h2>
                <span class="inline-flex items-center gap-1 text-[11px] font-medium bg-card-subtle text-text-muted px-2 py-0.5 rounded-md border border-card-border">
                  {activeFileName()}
                </span>
              </div>
              <p class="text-xs text-text-muted mt-0.5">
                {headers().length} columns detected • {rawRows().length} data rows found
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            {/* Change File button */}
            <label class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main bg-card-subtle hover:bg-card border border-card-border px-2.5 py-1.5 rounded-lg transition cursor-pointer">
              <Upload class="w-3.5 h-3.5" />
              <span>Change CSV</span>
              <input type="file" accept=".csv" class="hidden" onChange={handleFileUpload} />
            </label>

            {/* Stepper Tabs */}
            <div class="hidden sm:inline-flex rounded-xl bg-card-subtle p-1 border border-card-border text-xs">
              <button
                type="button"
                onClick={() => setStep("review")}
                class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  step() === "review"
                    ? "bg-card text-text-main shadow-xs font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                <SlidersHorizontal class="w-3.5 h-3.5" />
                <span>1. Review & Map</span>
              </button>
              <button
                type="button"
                onClick={() => setStep("preview")}
                class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  step() === "preview"
                    ? "bg-card text-text-main shadow-xs font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                <Eye class="w-3.5 h-3.5" />
                <span>2. Preview & Confirm</span>
                <span class="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                  {stats().selectedCount}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: REVIEW & COLUMN MAPPING */}
          <Show when={step() === "review"}>
            <div class="space-y-6">
              {/* CSV Raw Data Preview Card */}
              <div class="bg-card-subtle rounded-xl border border-card-border p-4">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-text-main">CSV File Sample</span>
                    <span class="text-[11px] text-text-muted">(First 3 data rows)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRawSample(!showRawSample())}
                    class="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    {showRawSample() ? "Hide sample" : "Show sample"}
                  </button>
                </div>

                <Show when={showRawSample()}>
                  <div class="overflow-x-auto rounded-lg border border-card-border bg-card">
                    <table class="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr class="bg-card-subtle text-text-muted font-semibold border-b border-card-border">
                          <For each={headers()}>
                            {(h) => (
                              <th class="py-2 px-3 text-[11px] whitespace-nowrap">{h}</th>
                            )}
                          </For>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-card-border font-mono text-[11px] text-text-main">
                        <For each={rawRows().slice(0, 3)}>
                          {(row) => (
                            <tr class="hover:bg-card-subtle/50">
                              <For each={headers()}>
                                {(_, idx) => (
                                  <td class="py-2 px-3 whitespace-nowrap">
                                    {row[idx()] || <span class="text-text-subtle italic">-</span>}
                                  </td>
                                )}
                              </For>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </div>

              {/* Grid: Column Mapping Form */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CARD 1: Core Fields (Date & Payee) */}
                <div class="bg-card border border-card-border rounded-xl p-5 space-y-4">
                  <div class="border-b border-card-border pb-2.5">
                    <h3 class="text-xs font-bold text-text-main uppercase tracking-wider">
                      1. Required Transaction Fields
                    </h3>
                    <p class="text-[11px] text-text-muted mt-0.5">
                      Identify which columns contain the date and description
                    </p>
                  </div>

                  {/* Date Column */}
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-text-main">
                      Date Column <span class="text-rose-500">*</span>
                    </label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={config().dateCol}
                        onChange={(e) => updateConfig("dateCol", e.currentTarget.value)}
                        class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <For each={headers()}>
                          {(h) => <option value={h}>{h}</option>}
                        </For>
                      </select>

                      <select
                        value={config().dateFormat}
                        onChange={(e) =>
                          updateConfig("dateFormat", e.currentTarget.value as any)
                        }
                        class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="auto">Date Format: Auto-detect</option>
                        <option value="YYYY-MM-DD">Format: YYYY-MM-DD</option>
                        <option value="DD/MM/YYYY">Format: DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">Format: MM/DD/YYYY</option>
                      </select>
                    </div>
                  </div>

                  {/* Payee Column */}
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-text-main">
                      Payee / Description Column <span class="text-rose-500">*</span>
                    </label>
                    <select
                      value={config().payeeCol}
                      onChange={(e) => updateConfig("payeeCol", e.currentTarget.value)}
                      class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <For each={headers()}>
                        {(h) => <option value={h}>{h}</option>}
                      </For>
                    </select>
                  </div>

                  {/* Notes / Memo Column */}
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-text-main">
                      Notes / Memo Column <span class="text-text-subtle">(Optional)</span>
                    </label>
                    <select
                      value={config().notesCol}
                      onChange={(e) => updateConfig("notesCol", e.currentTarget.value)}
                      class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">(None - leave blank)</option>
                      <For each={headers()}>
                        {(h) => <option value={h}>{h}</option>}
                      </For>
                    </select>
                  </div>
                </div>

                {/* CARD 2: Account & Category Organization */}
                <div class="bg-card border border-card-border rounded-xl p-5 space-y-4">
                  <div class="border-b border-card-border pb-2.5">
                    <h3 class="text-xs font-bold text-text-main uppercase tracking-wider">
                      2. Account & Category Assignment
                    </h3>
                    <p class="text-[11px] text-text-muted mt-0.5">
                      Assign to your Finly accounts and set categorization rules
                    </p>
                  </div>

                  {/* Account Mapping */}
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <label class="block text-xs font-medium text-text-main">
                        Destination Account
                      </label>
                      <div class="flex items-center gap-2 text-[11px] text-text-muted">
                        <label class="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="accountSource"
                            checked={config().accountSource === "fixed"}
                            onChange={() => updateConfig("accountSource", "fixed")}
                          />
                          <span>Specific Account</span>
                        </label>
                        <label class="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="accountSource"
                            checked={config().accountSource === "column"}
                            onChange={() => updateConfig("accountSource", "column")}
                          />
                          <span>From CSV Column</span>
                        </label>
                      </div>
                    </div>

                    <Show
                      when={config().accountSource === "fixed"}
                      fallback={
                        <select
                          value={config().accountCol}
                          onChange={(e) => updateConfig("accountCol", e.currentTarget.value)}
                          class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">(Select CSV Column)</option>
                          <For each={headers()}>
                            {(h) => <option value={h}>{h}</option>}
                          </For>
                        </select>
                      }
                    >
                      <select
                        value={config().fixedAccount}
                        onChange={(e) => updateConfig("fixedAccount", e.currentTarget.value)}
                        class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <For each={props.accounts}>
                          {(acc) => <option value={acc.name}>{acc.name} ({acc.type})</option>}
                        </For>
                      </select>
                    </Show>
                  </div>

                  {/* Category Mapping */}
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <label class="block text-xs font-medium text-text-main">
                        Category Mode
                      </label>
                      <div class="flex items-center gap-2 text-[11px] text-text-muted">
                        <label class="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="categorySource"
                            checked={config().categorySource === "auto"}
                            onChange={() => updateConfig("categorySource", "auto")}
                          />
                          <span>Smart Auto</span>
                        </label>
                        <label class="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="categorySource"
                            checked={config().categorySource === "column"}
                            onChange={() => updateConfig("categorySource", "column")}
                          />
                          <span>CSV Column</span>
                        </label>
                      </div>
                    </div>

                    <Show
                      when={config().categorySource === "column"}
                      fallback={
                        <div class="text-[11px] text-text-muted bg-card-subtle p-2.5 rounded-lg border border-card-border">
                          Finly will automatically categorize transactions based on payee keywords
                          (e.g., Grocery stores, Restaurants, Utilities).
                        </div>
                      }
                    >
                      <select
                        value={config().categoryCol}
                        onChange={(e) => updateConfig("categoryCol", e.currentTarget.value)}
                        class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">(Select CSV Column)</option>
                        <For each={headers()}>
                          {(h) => <option value={h}>{h}</option>}
                        </For>
                      </select>
                    </Show>
                  </div>

                  {/* Default Status */}
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-text-main">
                      Initial Status
                    </label>
                    <select
                      value={config().defaultStatus}
                      onChange={(e) =>
                        updateConfig("defaultStatus", e.currentTarget.value as any)
                      }
                      class="w-full bg-card-subtle border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="cleared">Cleared (Standard)</option>
                      <option value="pending">Pending (Awaiting settlement)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* CARD 3: AMOUNT CONFIGURATION (Featured card) */}
              <div class="bg-card border-2 border-primary/30 rounded-xl p-5 space-y-4 shadow-xs">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-card-border pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="p-1 rounded-md bg-primary-light text-primary font-bold text-xs">
                        $
                      </span>
                      <h3 class="text-xs font-bold text-text-main uppercase tracking-wider">
                        3. Amount Mapping & Handling
                      </h3>
                    </div>
                    <p class="text-[11px] text-text-muted mt-0.5">
                      Select how amounts and debit/credit are formatted in your bank CSV
                    </p>
                  </div>

                  {/* Amount Mode Pills */}
                  <div class="inline-flex rounded-lg bg-card-subtle p-1 border border-card-border text-xs">
                    <button
                      type="button"
                      onClick={() => updateConfig("amountMode", "single")}
                      class={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                        config().amountMode === "single"
                          ? "bg-card text-text-main shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      Single Column (+ / -)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig("amountMode", "double")}
                      class={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                        config().amountMode === "double"
                          ? "bg-card text-text-main shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      Separate Debit & Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig("amountMode", "type_column")}
                      class={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                        config().amountMode === "type_column"
                          ? "bg-card text-text-main shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      Amount + Type Column
                    </button>
                  </div>
                </div>

                {/* Sub-Panel: Mode 1 - Single Column */}
                <Show when={config().amountMode === "single"}>
                  <div class="space-y-3 bg-card-subtle/50 p-4 rounded-xl border border-card-border">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-text-main">
                        Single Column with Signed Numbers
                      </span>
                      <span class="text-[11px] text-text-muted">
                        (e.g., negative for expenses like -50.00, positive for income like +1200.00)
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div class="space-y-1">
                        <label class="block text-xs font-medium text-text-main">
                          Amount Column <span class="text-rose-500">*</span>
                        </label>
                        <select
                          value={config().singleAmountCol}
                          onChange={(e) =>
                            updateConfig("singleAmountCol", e.currentTarget.value)
                          }
                          class="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <For each={headers()}>
                            {(h) => <option value={h}>{h}</option>}
                          </For>
                        </select>
                      </div>

                      <div class="pt-4 sm:pt-5">
                        <label class="inline-flex items-center gap-2 cursor-pointer text-xs text-text-main">
                          <input
                            type="checkbox"
                            checked={config().invertSingleAmount}
                            onChange={(e) =>
                              updateConfig("invertSingleAmount", e.currentTarget.checked)
                            }
                            class="rounded border-card-border text-primary focus:ring-primary"
                          />
                          <span class="font-medium">Invert +/- Signs</span>
                          <span class="text-[11px] text-text-muted">
                            (Check if statement shows purchases as positive numbers)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </Show>

                {/* Sub-Panel: Mode 2 - Double Columns (Debit & Credit) */}
                <Show when={config().amountMode === "double"}>
                  <div class="space-y-3 bg-card-subtle/50 p-4 rounded-xl border border-card-border">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-text-main">
                        Separate Debit and Credit Columns
                      </span>
                      <span class="text-[11px] text-text-muted">
                        (Withdrawals in one column, deposits in another)
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Debit Column */}
                      <div class="space-y-1">
                        <label class="text-xs font-medium text-text-main flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span>Debit / Outflow Column (Expenses)</span>
                        </label>
                        <select
                          value={config().debitCol}
                          onChange={(e) => updateConfig("debitCol", e.currentTarget.value)}
                          class="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">(None)</option>
                          <For each={headers()}>
                            {(h) => <option value={h}>{h}</option>}
                          </For>
                        </select>
                      </div>

                      {/* Credit Column */}
                      <div class="space-y-1">
                        <label class="text-xs font-medium text-text-main flex items-center gap-1.5">
                          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Credit / Inflow Column (Income)</span>
                        </label>
                        <select
                          value={config().creditCol}
                          onChange={(e) => updateConfig("creditCol", e.currentTarget.value)}
                          class="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">(None)</option>
                          <For each={headers()}>
                            {(h) => <option value={h}>{h}</option>}
                          </For>
                        </select>
                      </div>
                    </div>
                  </div>
                </Show>

                {/* Sub-Panel: Mode 3 - Amount + Type Column */}
                <Show when={config().amountMode === "type_column"}>
                  <div class="space-y-3 bg-card-subtle/50 p-4 rounded-xl border border-card-border">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-text-main">
                        Amount in One Column, Type in Another
                      </span>
                      <span class="text-[11px] text-text-muted">
                        (Amount has number, Type has CR/DR, Debit/Credit, Income/Expense)
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Amount Column */}
                      <div class="space-y-1">
                        <label class="block text-xs font-medium text-text-main">
                          Amount Column <span class="text-rose-500">*</span>
                        </label>
                        <select
                          value={config().amountCol}
                          onChange={(e) => updateConfig("amountCol", e.currentTarget.value)}
                          class="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <For each={headers()}>
                            {(h) => <option value={h}>{h}</option>}
                          </For>
                        </select>
                      </div>

                      {/* Type Column */}
                      <div class="space-y-1">
                        <label class="block text-xs font-medium text-text-main">
                          Type Column (Debit / Credit) <span class="text-rose-500">*</span>
                        </label>
                        <select
                          value={config().typeCol}
                          onChange={(e) => updateConfig("typeCol", e.currentTarget.value)}
                          class="w-full bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <For each={headers()}>
                            {(h) => <option value={h}>{h}</option>}
                          </For>
                        </select>
                      </div>
                    </div>

                    {/* Indicators customization */}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div class="space-y-1">
                        <label class="block text-[11px] text-text-muted">
                          Credit / Income words (comma separated)
                        </label>
                        <input
                          type="text"
                          value={config().creditIndicators}
                          onInput={(e) =>
                            updateConfig("creditIndicators", e.currentTarget.value)
                          }
                          class="w-full bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>
                      <div class="space-y-1">
                        <label class="block text-[11px] text-text-muted">
                          Debit / Expense words (comma separated)
                        </label>
                        <input
                          type="text"
                          value={config().debitIndicators}
                          onInput={(e) =>
                            updateConfig("debitIndicators", e.currentTarget.value)
                          }
                          class="w-full bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* STEP 2: PREVIEW & IMPORT CONFIRMATION */}
          <Show when={step() === "preview"}>
            <div class="space-y-4">
              {/* Summary KPIs */}
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-card-subtle p-3 rounded-xl border border-card-border">
                  <div class="text-[11px] font-medium text-text-muted">Selected to Import</div>
                  <div class="text-lg font-bold text-text-main mt-0.5">
                    {stats().selectedCount}{" "}
                    <span class="text-xs font-normal text-text-muted">
                      / {stats().totalValid} valid
                    </span>
                  </div>
                </div>

                <div class="bg-card-subtle p-3 rounded-xl border border-card-border">
                  <div class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ArrowDownLeft class="w-3.5 h-3.5" />
                    <span>Total Inflow</span>
                  </div>
                  <div class="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{symbol()}{stats().totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div class="bg-card-subtle p-3 rounded-xl border border-card-border">
                  <div class="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <ArrowUpRight class="w-3.5 h-3.5" />
                    <span>Total Outflow</span>
                  </div>
                  <div class="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    -{symbol()}{stats().totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div class="bg-card-subtle p-3 rounded-xl border border-card-border">
                  <div class="text-[11px] font-medium text-text-muted">Net Cash Flow</div>
                  <div
                    class={`text-lg font-bold mt-0.5 ${
                      stats().netCashFlow >= 0 ? "text-primary" : "text-rose-500"
                    }`}
                  >
                    {stats().netCashFlow >= 0 ? "+" : "-"}{symbol()}
                    {Math.abs(stats().netCashFlow).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Warning banner for invalid rows */}
              <Show when={stats().invalidCount > 0}>
                <div class="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs">
                  <CircleAlert class="w-4 h-4 shrink-0" />
                  <span>
                    {stats().invalidCount} row(s) had missing dates or zero amounts and will be skipped.
                  </span>
                </div>
              </Show>

              {/* Notice banner for new categories */}
              <Show when={stats().newCategories.length > 0}>
                <div class="flex items-center gap-2.5 p-3 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs">
                  <Tags class="w-4 h-4 shrink-0" />
                  <span>
                    <strong>{stats().newCategories.length} new {stats().newCategories.length === 1 ? "category" : "categories"}</strong> detected ({stats().newCategories.join(", ")}) and will be automatically created in Finly.
                  </span>
                </div>
              </Show>

              {/* Filter and Search Bar */}
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex items-center gap-2">
                  <div class="relative w-64">
                    <Search class="w-3.5 h-3.5 text-text-subtle absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search preview records..."
                      value={previewSearch()}
                      onInput={(e) => setPreviewSearch(e.currentTarget.value)}
                      class="w-full bg-card-subtle border border-card-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div class="inline-flex rounded-lg bg-card-subtle p-0.5 border border-card-border text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("all")}
                      class={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                        previewFilter() === "all"
                          ? "bg-card text-text-main shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("expense")}
                      class={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                        previewFilter() === "expense"
                          ? "bg-card text-text-main shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      Expenses
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("income")}
                      class={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                        previewFilter() === "income"
                          ? "bg-card text-text-main shadow-xs font-semibold"
                          : "text-text-muted hover:text-text-main"
                      }`}
                    >
                      Income
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSmartModal(true)}
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 via-primary to-cyan-500 hover:opacity-95 text-white shadow-xs transition cursor-pointer"
                  >
                    <Sparkles class="w-3.5 h-3.5" />
                    <span>Smart Categorize</span>
                    <Show when={uncategorizedCount() > 0}>
                      <span class="text-[10px] bg-white/25 px-1.5 py-0.2 rounded-full font-bold">
                        {uncategorizedCount()} unmapped
                      </span>
                    </Show>
                  </button>

                  <div class="text-xs text-text-muted">
                    Showing {filteredPreviewRows().length} of {currentItems().length} rows
                  </div>
                </div>
              </div>

              {/* Transactions Preview Table */}
              <div class="bg-card rounded-xl border border-card-border shadow-xs overflow-hidden flex flex-col max-h-[46vh]">
                <div class="overflow-x-auto overflow-y-auto">
                  <table class="w-full text-left text-xs text-text-main border-collapse">
                    <thead class="sticky top-0 z-10 bg-card-subtle shadow-[0_1px_0_0_var(--color-card-border)]">
                      <tr class="text-[11px] font-bold text-text-muted uppercase tracking-wider bg-card-subtle">
                        <th class="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredPreviewRows().length > 0 &&
                              filteredPreviewRows()
                                .filter((i) => i.isValid)
                                .every((i) => selectedRowIds().has(i.id))
                            }
                            onChange={toggleSelectAllFiltered}
                            class="rounded border-card-border text-primary focus:ring-primary cursor-pointer"
                          />
                        </th>
                        <th class="py-2.5 px-3 w-10 text-center">#</th>
                        <th class="py-2.5 px-3 w-24">Date</th>
                        <th class="py-2.5 px-3">Payee / Description</th>
                        <th class="py-2.5 px-3 w-28">Category</th>
                        <th class="py-2.5 px-3 w-28">Account</th>
                        <th class="py-2.5 px-3 w-28 text-right">Amount</th>
                        <th class="py-2.5 px-3 w-20 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-card-border font-normal">
                      <For
                        each={filteredPreviewRows()}
                        fallback={
                          <tr>
                            <td colspan={8} class="py-8 text-center text-text-muted text-xs">
                              No records found matching filters
                            </td>
                          </tr>
                        }
                      >
                        {(item) => {
                          const isSelected = () => selectedRowIds().has(item.id);
                          return (
                            <tr
                              class={`hover:bg-card-subtle/50 transition-colors ${
                                !item.isValid ? "opacity-50 bg-rose-500/5" : ""
                              } ${isSelected() ? "" : "opacity-60"}`}
                            >
                              <td class="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={!item.isValid}
                                  checked={isSelected()}
                                  onChange={() => toggleRow(item.id)}
                                  class="rounded border-card-border text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td class="py-2 px-3 text-center text-text-subtle font-mono text-[10px]">
                                {item.rawRowIndex + 1}
                              </td>
                              <td class="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-text-muted">
                                {item.transaction.date}
                              </td>
                              <td class="py-2 px-3 font-medium">
                                <div class="flex items-center gap-1.5">
                                  <div class="truncate max-w-xs">{item.transaction.payee}</div>
                                  <Show when={item.isSmartCategorized}>
                                    <span
                                      title={item.categorizationReason || "Smart cleaned & categorized"}
                                      class="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0"
                                    >
                                      <Sparkles class="w-2.5 h-2.5" />
                                      <span>AI</span>
                                    </span>
                                  </Show>
                                </div>
                                <Show when={item.originalPayee && item.originalPayee !== item.transaction.payee}>
                                  <div class="text-[10px] text-text-subtle truncate max-w-xs font-mono" title={item.originalPayee}>
                                    Raw: {item.originalPayee}
                                  </div>
                                </Show>
                                <Show when={item.transaction.notes}>
                                  <div class="text-[10px] text-text-subtle truncate max-w-xs">
                                    {item.transaction.notes}
                                  </div>
                                </Show>
                                <Show when={!item.isValid && item.error}>
                                  <div class="text-[10px] text-rose-500 font-medium">
                                    {item.error}
                                  </div>
                                </Show>
                              </td>
                              <td class="py-2 px-3 whitespace-nowrap">
                                <div class="inline-flex items-center gap-1.5">
                                  <div class="relative group">
                                    <select
                                      value={item.transaction.category}
                                      onChange={(e) => handleUpdateRowCategory(item.id, e.currentTarget.value)}
                                      class="appearance-none text-[10px] font-semibold px-2 py-0.5 pr-4 rounded-full border border-card-border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                                      style={{
                                        "background-color": `${item.transaction.categoryColor || "#64748b"}20`,
                                        color: item.transaction.categoryColor || "#64748b",
                                      }}
                                    >
                                      <Show
                                        when={
                                          !(props.categories || []).some(
                                            (c) =>
                                              c.name.toLowerCase() ===
                                              item.transaction.category.toLowerCase()
                                          )
                                        }
                                      >
                                        <option value={item.transaction.category} selected>
                                          {item.transaction.category}
                                        </option>
                                      </Show>
                                      <For each={props.categories || []}>
                                        {(c) => (
                                          <option
                                            value={c.name}
                                            selected={
                                              c.name.toLowerCase() ===
                                              item.transaction.category.toLowerCase()
                                            }
                                          >
                                            {c.name}
                                          </option>
                                        )}
                                      </For>
                                      <option value="General">General</option>
                                    </select>
                                    <div class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] opacity-70">
                                      ▼
                                    </div>
                                  </div>
                                  <Show when={item.isNewCategory}>
                                    <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-primary/15 text-primary border border-primary/25">
                                      New
                                    </span>
                                  </Show>
                                </div>
                              </td>
                              <td class="py-2 px-3 whitespace-nowrap text-text-muted truncate max-w-27.5">
                                {item.transaction.account}
                              </td>
                              <td class="py-2 px-3 text-right whitespace-nowrap font-bold">
                                <span
                                  class={
                                    item.transaction.amount > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }
                                >
                                  {item.transaction.amount > 0 ? "+" : "-"}
                                  {symbol()}
                                  {Math.abs(item.transaction.amount).toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </td>
                              <td class="py-2 px-3 text-center whitespace-nowrap">
                                <span
                                  class={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium capitalize ${
                                    item.transaction.status === "cleared"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-amber-500/10 text-amber-500"
                                  }`}
                                >
                                  {item.transaction.status}
                                </span>
                              </td>
                            </tr>
                          );
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Modal Sticky Bottom Navigation & Actions */}
        <div class="flex items-center justify-between px-6 py-4 border-t border-card-border bg-card">
          <div>
            <Show when={step() === "preview"}>
              <button
                type="button"
                onClick={() => setStep("review")}
                class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main font-semibold px-3 py-2 rounded-xl transition hover:bg-card-subtle cursor-pointer"
              >
                <ArrowLeft class="w-3.5 h-3.5" />
                <span>Back to Mapping</span>
              </button>
            </Show>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main transition hover:bg-card-subtle rounded-xl cursor-pointer"
            >
              Cancel
            </button>

            <Show
              when={step() === "review"}
              fallback={
                <button
                  type="button"
                  disabled={stats().selectedCount === 0 || isImporting()}
                  onClick={handleConfirmImport}
                  class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Check class="w-4 h-4" />
                  <span>
                    {isImporting()
                      ? "Importing..."
                      : `Import ${stats().selectedCount} Transactions`}
                  </span>
                </button>
              }
            >
              <button
                type="button"
                onClick={() => setStep("preview")}
                class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition shadow-xs cursor-pointer"
              >
                <span>Preview Transactions</span>
                <ArrowRight class="w-4 h-4" />
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Smart Auto-Categorization Configuration & Progress Modal */}
      <Show when={showSmartModal()}>
        <div class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div class="relative w-full max-w-md bg-card rounded-2xl border border-card-border p-6 shadow-2xl space-y-5">
            <div class="flex items-center justify-between pb-3 border-b border-card-border">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 p-0.5 flex items-center justify-center text-white">
                  <Sparkles class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="text-sm font-bold text-text-main">Smart Auto-Categorization</h3>
                  <p class="text-[11px] text-text-muted">
                    {aiConfig().enabled
                      ? `Using ${aiConfig().provider.toUpperCase()} (${aiConfig().provider === "ollama" ? aiConfig().ollamaModel : aiConfig().provider === "gemini" ? aiConfig().geminiModel : "Cloud"})`
                      : "Using Finly Fast Local Heuristics"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isClassifying()}
                onClick={() => setShowSmartModal(false)}
                class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle cursor-pointer"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <div class="space-y-3 text-xs text-text-main">
              <p class="text-text-muted leading-relaxed">
                Cleans obscure statement prefixes (e.g. <code class="bg-card-subtle px-1 rounded text-text-main">UPI/</code>, <code class="bg-card-subtle px-1 rounded text-text-main">POS</code>, <code class="bg-card-subtle px-1 rounded text-text-main">ACH</code>, reference IDs) and auto-classifies transactions against your categories.
              </p>

              <div class="space-y-2 pt-1">
                <label class="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">Scope</label>
                <div class="space-y-1.5">
                  <label class="flex items-center gap-2.5 p-2.5 rounded-xl border border-card-border hover:bg-card-subtle cursor-pointer transition">
                    <input
                      type="radio"
                      name="smartScope"
                      value="uncategorized"
                      checked={smartScope() === "uncategorized"}
                      onChange={() => setSmartScope("uncategorized")}
                      disabled={isClassifying()}
                      class="text-primary focus:ring-primary"
                    />
                    <div class="flex-1 flex items-center justify-between">
                      <span class="font-medium">Uncategorized & General rows only</span>
                      <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-card-subtle text-text-muted">
                        {uncategorizedCount()} rows
                      </span>
                    </div>
                  </label>

                  <label class="flex items-center gap-2.5 p-2.5 rounded-xl border border-card-border hover:bg-card-subtle cursor-pointer transition">
                    <input
                      type="radio"
                      name="smartScope"
                      value="all"
                      checked={smartScope() === "all"}
                      onChange={() => setSmartScope("all")}
                      disabled={isClassifying()}
                      class="text-primary focus:ring-primary"
                    />
                    <div class="flex-1 flex items-center justify-between">
                      <span class="font-medium">All valid statement rows</span>
                      <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-card-subtle text-text-muted">
                        {stats().totalValid} rows
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Progress Display */}
              <Show when={isClassifying()}>
                <div class="pt-3 space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-primary flex items-center gap-1.5">
                      <Loader2 class="w-3.5 h-3.5 animate-spin" />
                      <span>Classifying transactions...</span>
                    </span>
                    <span class="font-mono text-text-muted">
                      {classificationProgress().done} / {classificationProgress().total}
                    </span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-card-subtle overflow-hidden border border-card-border">
                    <div
                      class="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                      style={{
                        width: `${
                          classificationProgress().total > 0
                            ? Math.round((classificationProgress().done / classificationProgress().total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </Show>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-card-border">
              <button
                type="button"
                disabled={isClassifying()}
                onClick={() => setShowSmartModal(false)}
                class="px-3.5 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main transition rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClassifying() || (smartScope() === "uncategorized" && uncategorizedCount() === 0)}
                onClick={handleRunSmartCategorize}
                class="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-primary hover:opacity-95 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
              >
                <Show when={isClassifying()} fallback={<Sparkles class="w-3.5 h-3.5" />}>
                  <Loader2 class="w-3.5 h-3.5 animate-spin" />
                </Show>
                <span>{isClassifying() ? "Classifying..." : "Start Auto-Categorization"}</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
