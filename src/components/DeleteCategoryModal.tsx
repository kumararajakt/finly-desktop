import { Component, createSignal, For, Show } from "solid-js";
import { X, TriangleAlert, Trash2 } from "./icons";
import { CategoryItem } from "../types/finance";

interface DeleteCategoryModalProps {
  category: CategoryItem;
  allCategories: CategoryItem[];
  affectedCount: number;
  onClose: () => void;
  onConfirmDelete: (reassignToCatName?: string) => void;
}

export const DeleteCategoryModal: Component<DeleteCategoryModalProps> = (props) => {
  const otherCategories = () =>
    props.allCategories.filter((c) => c.id !== props.category.id);

  // Default reassignment candidate (prefer "Other" or "General", else first other category)
  const defaultTarget = () => {
    const list = otherCategories();
    const foundOther = list.find(
      (c) =>
        c.name.toLowerCase() === "other" ||
        c.name.toLowerCase() === "general"
    );
    return foundOther ? foundOther.name : list[0]?.name || "";
  };

  const [selectedTargetCat, setSelectedTargetCat] = createSignal(defaultTarget());

  const handleConfirm = () => {
    if (props.affectedCount > 0) {
      if (!selectedTargetCat()) return;
      props.onConfirmDelete(selectedTargetCat());
    } else {
      props.onConfirmDelete(undefined);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div class="relative w-full max-w-md bg-card rounded-2xl border border-card-border p-6 shadow-2xl">
        {/* Header */}
        <div class="flex items-start justify-between pb-3 border-b border-card-border mb-4">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <Trash2 class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-base font-bold text-text-main">Delete Category</h2>
              <p class="text-xs text-text-muted mt-0.5">
                {props.category.name}
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

        {/* Body */}
        <div class="space-y-4">
          <Show
            when={props.affectedCount > 0}
            fallback={
              <div class="text-xs text-text-muted leading-relaxed">
                Are you sure you want to delete the{" "}
                <span class="font-bold text-text-main">{props.category.name}</span> category?
                There are currently no transactions assigned to it.
              </div>
            }
          >
            {/* Warning when transactions are attached */}
            <div class="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p class="font-semibold">
                  {props.affectedCount} transaction{props.affectedCount > 1 ? "s are" : " is"} currently attached
                </p>
                <p class="text-[11px] mt-0.5 text-amber-700 dark:text-amber-300">
                  Before deleting this category, please select another category to move these transactions to, or cancel.
                </p>
              </div>
            </div>

            {/* Target Category Selection */}
            <div class="space-y-1.5 pt-1">
              <label class="block text-xs font-semibold text-text-main">
                Move {props.affectedCount} transaction{props.affectedCount > 1 ? "s" : ""} to:
              </label>
              <select
                value={selectedTargetCat()}
                onChange={(e) => setSelectedTargetCat(e.currentTarget.value)}
                class="w-full bg-card-subtle border border-card-border rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs cursor-pointer font-medium"
              >
                <For each={otherCategories()}>
                  {(cat) => (
                    <option value={cat.name}>
                      {cat.name} ({cat.type})
                    </option>
                  )}
                </For>
              </select>
            </div>
          </Show>
        </div>

        {/* Actions */}
        <div class="flex items-center justify-end gap-3 pt-5 border-t border-card-border mt-5">
          <button
            type="button"
            onClick={props.onClose}
            class="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main transition hover:bg-card-subtle rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            class="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>
              {props.affectedCount > 0
                ? "Move Transactions & Delete"
                : "Delete Category"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
