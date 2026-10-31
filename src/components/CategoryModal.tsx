import { Component, createSignal, For } from "solid-js";
import { X, Check } from "./icons";
import { CategoryItem, CategoryType } from "../types/finance";

interface CategoryModalProps {
  category?: CategoryItem | null;
  existingCategories: CategoryItem[];
  onClose: () => void;
  onSave: (category: CategoryItem) => void;
}

const PRESET_COLORS = [
  "#2563eb", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#ef4444", // Red
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#6366f1", // Indigo
  "#84cc16", // Lime
  "#a855f7", // Violet
  "#0284c7", // Sky
  "#e11d48", // Rose
  "#64748b", // Slate
  "#0d9488", // Dark Teal
];

export const CategoryModal: Component<CategoryModalProps> = (props) => {
  const isEditing = () => !!props.category;

  const [name, setName] = createSignal(props.category?.name || "");
  const [type, setType] = createSignal<CategoryType>(props.category?.type || "expense");
  const [color, setColor] = createSignal(props.category?.color || "#2563eb");
  const [description, setDescription] = createSignal(props.category?.description || "");
  const [error, setError] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) {
      setError("Category name is required");
      return;
    }

    // Check duplicate name (case-insensitive, ignoring self when editing)
    const duplicate = props.existingCategories.some(
      (c) =>
        c.name.toLowerCase().trim() === trimmed.toLowerCase() &&
        c.id !== props.category?.id
    );

    if (duplicate) {
      setError("A category with this name already exists");
      return;
    }

    const item: CategoryItem = {
      id: props.category?.id || `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: trimmed,
      type: type(),
      color: color(),
      description: description().trim() || undefined,
      isDefault: props.category?.isDefault ?? false,
    };

    props.onSave(item);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div class="relative w-full max-w-md bg-card rounded-2xl border border-card-border p-6 shadow-xl">
        {/* Header */}
        <div class="flex items-center justify-between pb-4 border-b border-card-border mb-5">
          <div class="flex items-center gap-3">
            <span
              class="w-4 h-4 rounded-full shrink-0 shadow-xs"
              style={{ "background-color": color() }}
            />
            <h2 class="text-base font-bold text-text-main">
              {isEditing() ? "Edit Category" : "New Category"}
            </h2>
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
          {/* Category Name */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">
              Category Name <span class="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Groceries, Gym, Freelance"
              value={name()}
              onInput={(e) => {
                setName(e.currentTarget.value);
                if (error()) setError("");
              }}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
              autofocus
            />
            {error() && (
              <p class="text-[11px] text-rose-500 font-medium">{error()}</p>
            )}
          </div>

          {/* Category Type */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">
              Category Type
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType("expense")}
                class={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer text-center ${
                  type() === "expense"
                    ? "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-semibold"
                    : "bg-card-subtle border-card-border text-text-muted hover:text-text-main"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                class={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer text-center ${
                  type() === "income"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "bg-card-subtle border-card-border text-text-muted hover:text-text-main"
                }`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setType("both")}
                class={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer text-center ${
                  type() === "both"
                    ? "bg-primary-light border-primary text-primary font-semibold"
                    : "bg-card-subtle border-card-border text-text-muted hover:text-text-main"
                }`}
              >
                Both
              </button>
            </div>
          </div>

          {/* Color Palette */}
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-text-main">
                Badge Color
              </label>
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-text-muted font-mono">{color()}</span>
                <input
                  type="color"
                  value={color()}
                  onInput={(e) => setColor(e.currentTarget.value)}
                  class="w-6 h-6 rounded-md cursor-pointer border border-card-border bg-transparent p-0"
                  title="Pick custom color"
                />
              </div>
            </div>

            <div class="grid grid-cols-8 gap-2 p-2 bg-card-subtle rounded-xl border border-card-border">
              <For each={PRESET_COLORS}>
                {(c) => {
                  const isSelected = () => color().toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      type="button"
                      onClick={() => setColor(c)}
                      class="w-7 h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-xs"
                      style={{ "background-color": c }}
                    >
                      {isSelected() && <Check class="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Description */}
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-text-main">
              Description <span class="text-text-subtle font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Daily coffee, office lunches"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl px-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

          {/* Live Preview Badge */}
          <div class="pt-1">
            <div class="text-[11px] font-semibold text-text-muted mb-1.5">Preview:</div>
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-card-border bg-card">
              <span
                class="w-2.5 h-2.5 rounded-full"
                style={{ "background-color": color() }}
              />
              <span class="text-xs font-bold text-text-main">
                {name().trim() || "Category Name"}
              </span>
              <span class="text-[10px] text-text-muted capitalize">
                ({type()})
              </span>
            </div>
          </div>

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
              {isEditing() ? "Save Changes" : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
