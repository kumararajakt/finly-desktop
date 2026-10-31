import { Component, createSignal, For } from "solid-js";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Tags,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
} from "./icons";
import { CategoryItem, Transaction } from "../types/finance";

interface CategoryPageProps {
  categories: CategoryItem[];
  transactions: Transaction[];
  currencySymbol?: string;
  onOpenAddCategory: () => void;
  onEditCategory: (category: CategoryItem) => void;
  onDeleteCategory: (category: CategoryItem) => void;
  onNavigateToTransactions: (categoryName: string) => void;
}

export const CategoryPage: Component<CategoryPageProps> = (props) => {
  const symbol = () => props.currencySymbol || "$";
  const [searchQuery, setSearchQuery] = createSignal("");
  const [activeFilter, setActiveFilter] = createSignal<"all" | "expense" | "income">("all");

  // Compute transactions and totals per category
  const getCategoryStats = (catName: string) => {
    const norm = catName.toLowerCase().trim();
    const matches = props.transactions.filter(
      (t) => t.category.toLowerCase().trim() === norm
    );

    const count = matches.length;
    let totalSpend = 0;
    let totalIncome = 0;

    for (const tx of matches) {
      if (tx.amount < 0) {
        totalSpend += Math.abs(tx.amount);
      } else if (tx.amount > 0 && tx.type !== "transfer") {
        totalIncome += tx.amount;
      }
    }

    return { count, totalSpend, totalIncome };
  };

  // Top metric calculations
  const totalCategories = () => props.categories.length;
  const expenseCategoriesCount = () =>
    props.categories.filter((c) => c.type === "expense" || c.type === "both").length;
  const incomeCategoriesCount = () =>
    props.categories.filter((c) => c.type === "income" || c.type === "both").length;

  // Filtered categories
  const filteredCategories = () => {
    const q = searchQuery().toLowerCase().trim();
    const f = activeFilter();

    return props.categories.filter((cat) => {
      // Filter by type
      if (f === "expense" && cat.type !== "expense" && cat.type !== "both") return false;
      if (f === "income" && cat.type !== "income" && cat.type !== "both") return false;

      // Filter by search
      if (q) {
        const matchesName = cat.name.toLowerCase().includes(q);
        const matchesDesc = cat.description?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  };

  return (
    <div class="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-main">Categories</h1>
          <p class="text-xs text-text-muted mt-0.5">
            Organize and classify your income and expenses with custom colors and labels
          </p>
        </div>

        {/* Search & Action */}
        <div class="flex items-center gap-3">
          <div class="relative w-64">
            <Search class="w-4 h-4 text-text-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full bg-card border border-card-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-text-main placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition shadow-xs"
            />
          </div>

          <button
            type="button"
            onClick={props.onOpenAddCategory}
            class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus class="w-4 h-4" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Categories */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Total Categories</span>
            <span class="p-1.5 rounded-lg bg-primary-light text-primary">
              <Tags class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-text-main tracking-tight">
              {totalCategories()}
            </span>
            <span class="text-xs text-text-muted ml-1.5 font-medium">labels active</span>
          </div>
          <div class="text-xs text-text-muted mt-2">Used across transactions & budgets</div>
        </div>

        {/* Expense Categories */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Expense Categories</span>
            <span class="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <ArrowUpRight class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
              {expenseCategoriesCount()}
            </span>
            <span class="text-xs text-text-muted ml-1.5 font-medium">expense types</span>
          </div>
          <div class="text-xs text-text-muted mt-2">Classify outgoing spending</div>
        </div>

        {/* Income Categories */}
        <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            <span>Income Categories</span>
            <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft class="w-4 h-4" />
            </span>
          </div>
          <div class="my-1">
            <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {incomeCategoriesCount()}
            </span>
            <span class="text-xs text-text-muted ml-1.5 font-medium">income types</span>
          </div>
          <div class="text-xs text-text-muted mt-2">Classify incoming revenue & salary</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="inline-flex rounded-xl bg-card-subtle p-1 border border-card-border text-xs font-medium self-start">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeFilter() === "all"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            All Categories ({props.categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("expense")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeFilter() === "expense"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Expenses ({expenseCategoriesCount()})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("income")}
            class={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeFilter() === "income"
                ? "bg-card text-text-main shadow-xs font-semibold"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            Income ({incomeCategoriesCount()})
          </button>
        </div>

        <div class="text-xs text-text-muted font-medium">
          Showing {filteredCategories().length} of {props.categories.length} categories
        </div>
      </div>

      {/* Categories Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <For
          each={filteredCategories()}
          fallback={
            <div class="col-span-full bg-card rounded-2xl border border-card-border p-12 text-center space-y-3">
              <div class="w-12 h-12 rounded-full bg-card-subtle flex items-center justify-center mx-auto text-text-muted">
                <Tags class="w-6 h-6" />
              </div>
              <h3 class="text-sm font-bold text-text-main">No categories found</h3>
              <p class="text-xs text-text-muted max-w-sm mx-auto">
                {searchQuery()
                  ? `No categories match "${searchQuery()}". Try searching for something else.`
                  : "Get started by creating your first category."}
              </p>
              <button
                type="button"
                onClick={props.onOpenAddCategory}
                class="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer mt-2"
              >
                <Plus class="w-4 h-4" />
                <span>Create Category</span>
              </button>
            </div>
          }
        >
          {(cat) => {
            const stats = () => getCategoryStats(cat.name);
            return (
              <div class="bg-card rounded-2xl border border-card-border p-5 shadow-xs flex flex-col justify-between hover:border-text-subtle/30 transition-colors">
                <div>
                  {/* Top: Color Dot, Title, Type, and Actions */}
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span
                        class="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ "background-color": cat.color }}
                      />
                      <h3 class="text-sm font-bold text-text-main truncate" title={cat.name}>
                        {cat.name}
                      </h3>
                      <span
                        class={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                          cat.type === "expense"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : cat.type === "income"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-primary-light text-primary"
                        }`}
                      >
                        {cat.type}
                      </span>
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => props.onEditCategory(cat)}
                        class="p-1.5 rounded-lg text-text-subtle hover:text-text-main hover:bg-card-subtle transition cursor-pointer"
                        title="Edit Category"
                      >
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onDeleteCategory(cat)}
                        class="p-1.5 rounded-lg text-text-subtle hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {cat.description ? (
                    <p class="text-xs text-text-muted mt-2 line-clamp-2">
                      {cat.description}
                    </p>
                  ) : (
                    <p class="text-xs text-text-subtle italic mt-2">
                      No description provided
                    </p>
                  )}
                </div>

                {/* Bottom Stats & Transaction Link */}
                <div class="pt-4 mt-4 border-t border-card-border flex items-center justify-between">
                  <div>
                    <div class="text-[10px] uppercase tracking-wider font-semibold text-text-muted">
                      Activity
                    </div>
                    <div class="text-xs font-bold text-text-main mt-0.5">
                      {stats().count} transaction{stats().count === 1 ? "" : "s"}
                      {stats().totalSpend > 0 && (
                        <span class="text-rose-500 font-semibold ml-1.5">
                          (-{symbol()}{stats().totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                        </span>
                      )}
                      {stats().totalIncome > 0 && (
                        <span class="text-emerald-500 font-semibold ml-1.5">
                          (+{symbol()}{stats().totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => props.onNavigateToTransactions(cat.name)}
                    class="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover hover:underline cursor-pointer"
                  >
                    <span>View</span>
                    <ArrowRight class="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
