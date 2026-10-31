import { Component, createSignal, createMemo, For, Show } from "solid-js";
import {
  X,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  FileSpreadsheet,
  Eye,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
} from "./icons";
import { Account, Transaction } from "../types/finance";
import {
  parseRawCSV,
  detectDefaultMapping,
  convertRowsToTransactions,
  ColumnMappingConfig,
  AmountMode,
  ParsedTransactionRow,
} from "../utils/csv";

interface ImportTransactionsModalProps {
  csvText: string;
  fileName: string;
  accounts: Account[];
  currencySymbol?: string;
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

  // Convert CSV rows using current config
  const parsedData = createMemo(() => {
    return convertRowsToTransactions(
      parsedCSV().headers,
      parsedCSV().rows,
      config(),
      props.accounts
    );
  });

  // Keep selection synced when parsed rows change (unless user manually modified)
  const currentItems = () => parsedData().items;

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
    const sel = selectedRowIds();

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

    for (const it of items) {
      if (sel.has(it.id) && it.isValid) {
        selectedCount++;
        if (it.transaction.amount > 0) {
          income += it.transaction.amount;
        } else {
          expense += Math.abs(it.transaction.amount);
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

  // Helper updater for config fields
  const updateConfig = <K extends keyof ColumnMappingConfig>(
    key: K,
    value: ColumnMappingConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
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
                        <label class="block text-xs font-medium text-text-main flex items-center gap-1.5">
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
                        <label class="block text-xs font-medium text-text-main flex items-center gap-1.5">
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

                <div class="text-xs text-text-muted">
                  Showing {filteredPreviewRows().length} of {currentItems().length} rows
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
                                <div class="truncate max-w-xs">{item.transaction.payee}</div>
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
                                <span
                                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={{
                                    "background-color": `${item.transaction.categoryColor || "#64748b"}20`,
                                    color: item.transaction.categoryColor || "#64748b",
                                  }}
                                >
                                  {item.transaction.category}
                                </span>
                              </td>
                              <td class="py-2 px-3 whitespace-nowrap text-text-muted truncate max-w-[110px]">
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
    </div>
  );
};
