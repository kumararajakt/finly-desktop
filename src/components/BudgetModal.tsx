import { Component, createSignal, For } from "solid-js";
import { X, Check } from "./icons";
import { BudgetItem } from "../types/finance";

interface BudgetModalProps {
  budget?: BudgetItem | null;
  currencySymbol?: string;
  onClose: () => void;
  onSave: (item: BudgetItem) => void;
}

export const BudgetModal: Component<BudgetModalProps> = (props) => {
  const isEditing = () => !!props.budget;

  const [category, setCategory] = createSignal(props.budget?.category || "Groceries");
  const [isCustomCategory, setIsCustomCategory] = createSignal(false);
  const [customName, setCustomName] = createSignal("");
  const [limit, setLimit] = createSignal(props.budget ? String(props.budget.limit) : "500");
  const [selectedColor, setSelectedColor] = createSignal(props.budget?.color || "#10b981");

  const standardCategories = [
    { name: "Housing", defaultColor: "#2563eb" },
    { name: "Groceries", defaultColor: "#10b981" },
    { name: "Dining Out", defaultColor: "#f59e0b" },
    { name: "Transportation", defaultColor: "#8b5cf6" },
    { name: "Utilities", defaultColor: "#06b6d4" },
    { name: "Entertainment", defaultColor: "#ec4899" },
    { name: "Healthcare", defaultColor: "#ef4444" },
    { name: "Shopping", defaultColor: "#f97316" },
    { name: "Travel", defaultColor: "#14b8a6" },
    { name: "Education", defaultColor: "#6366f1" },
    { name: "Other", defaultColor: "#64748b" },
  ];

  const colorPalette = [
    "#2563eb", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#06b6d4", // cyan
    "#ec4899", // pink
    "#ef4444", // red
    "#f97316", // orange
    "#14b8a6", // teal
    "#6366f1", // indigo
    "#64748b", // slate
  ];

  const handleCategorySelect = (catName: string) => {
    setCategory(catName);
    const matched = standardCategories.find((c) => c.name === catName);
    if (matched && !props.budget) {
      setSelectedColor(matched.defaultColor);
    }
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const parsedLimit = parseFloat(limit());
    if (isNaN(parsedLimit) || parsedLimit <= 0) return;

    const resolvedCategory = isCustomCategory() && !isEditing()
      ? customName().trim()
      : category().trim();

    if (!resolvedCategory) return;

    const item: BudgetItem = {
      id: props.budget?.id || `b-${Date.now()}`,
      category: resolvedCategory,
      limit: parsedLimit,
      period: "monthly",
      color: selectedColor(),
    };

    props.onSave(item);
    props.onClose();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div class="bg-card rounded-2xl border border-card-border shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div class="flex items-center justify-between border-b border-card-border pb-3">
          <h2 class="text-base font-bold text-text-main">
            {isEditing() ? "Edit Budget Limit" : "New Category Budget"}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            class="p-1 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle cursor-pointer transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="space-y-4">
          {/* Category selection */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Category
            </label>
            <div class="space-y-2">
              <select
                value={isCustomCategory() ? "__custom__" : category()}
                onChange={(e) => {
                  if (e.currentTarget.value === "__custom__") {
                    setIsCustomCategory(true);
                  } else {
                    setIsCustomCategory(false);
                    handleCategorySelect(e.currentTarget.value);
                  }
                }}
                disabled={isEditing()}
                class="w-full bg-card border border-card-border rounded-xl px-3.5 pr-9 py-2 text-xs font-medium text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition cursor-pointer appearance-none disabled:opacity-60"
              >
                <For each={standardCategories}>
                  {(cat) => (
                    <option value={cat.name} class="bg-card text-text-main">
                      {cat.name}
                    </option>
                  )}
                </For>
                {!isEditing() && (
                  <option value="__custom__" class="bg-card text-text-main">
                    + Custom Category...
                  </option>
                )}
              </select>

              {isCustomCategory() && !isEditing() && (
                <input
                  type="text"
                  required
                  placeholder="Type custom category name..."
                  value={customName()}
                  onInput={(e) => setCustomName(e.currentTarget.value)}
                  class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              )}
            </div>
          </div>

          {/* Monthly Budget Limit */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">
              Monthly Limit ({props.currencySymbol || "$"})
            </label>
            <input
              type="number"
              step="1"
              min="1"
              required
              placeholder="e.g. 500"
              value={limit()}
              onInput={(e) => setLimit(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-sm font-bold text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
          </div>

          {/* Color Palette */}
          <div>
            <label class="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Category Color
            </label>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <For each={colorPalette}>
                {(col) => (
                  <button
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    class="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition transform hover:scale-110"
                    style={{ "background-color": col }}
                  >
                    {selectedColor() === col && <Check class="w-3.5 h-3.5 text-white" />}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Actions */}
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
              {isEditing() ? "Update Budget" : "Create Budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
