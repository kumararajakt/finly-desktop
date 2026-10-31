import { createSignal, onMount } from "solid-js";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./components/DashboardPage";
import { BudgetPage } from "./components/BudgetPage";
import { CategoryPage } from "./components/CategoryPage";
import { TransactionsMainPage } from "./components/TransactionsMainPage";
import { TransactionModal } from "./components/TransactionModal";
import { AccountModal } from "./components/AccountModal";
import { BudgetModal } from "./components/BudgetModal";
import { CategoryModal } from "./components/CategoryModal";
import { DeleteCategoryModal } from "./components/DeleteCategoryModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { SettingsModal } from "./components/SettingsModal";
import { Account, Transaction, UserProfile, ThemeMode, BudgetItem, CategoryItem } from "./types/finance";
import { applyTheme, getStoredTheme, setStoredTheme } from "./utils/theme";
import {
  fetchAccounts,
  fetchTransactions,
  insertTransaction,
  updateExistingTransaction,
  removeTransaction,
  toggleTransactionFlag,
  batchImportTransactions,
  getUserProfile,
  saveUserProfile,
  insertAccount,
  fetchBudgets,
  saveBudgets,
  fetchCategories,
  saveCategories,
  reassignCategoryTransactions,
} from "./utils/db";
import "./App.css";

function App() {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [editingTransaction, setEditingTransaction] = createSignal<Transaction | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = createSignal(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = createSignal(false);
  const [editingBudget, setEditingBudget] = createSignal<BudgetItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = createSignal(false);
  const [editingCategory, setEditingCategory] = createSignal<CategoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = createSignal<CategoryItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [activeFilter, setActiveFilter] = createSignal("all");
  const [currentView, setCurrentView] = createSignal<"dashboard" | "transactions" | "budgets" | "categories">("dashboard");
  const [accounts, setAccounts] = createSignal<Account[]>([]);
  const [transactions, setTransactions] = createSignal<Transaction[]>([]);
  const [budgets, setBudgets] = createSignal<BudgetItem[]>([]);
  const [categories, setCategories] = createSignal<CategoryItem[]>([]);
  const [userProfile, setUserProfile] = createSignal<UserProfile | null>(null);
  const [currentTheme, setCurrentTheme] = createSignal<ThemeMode>("auto");

  // Load persisted SQLite data, theme, and user profile on launch
  onMount(async () => {
    try {
      const [loadedProfile, loadedAccounts, loadedTransactions, loadedTheme, loadedBudgets, loadedCategories] = await Promise.all([
        getUserProfile(),
        fetchAccounts(),
        fetchTransactions(),
        getStoredTheme(),
        fetchBudgets(),
        fetchCategories(),
      ]);

      setCurrentTheme(loadedTheme);
      applyTheme(loadedTheme);
      setBudgets(loadedBudgets);
      setCategories(loadedCategories);

      if (loadedProfile) {
        setUserProfile(loadedProfile);
      } else {
        // If no profile exists yet, trigger onboarding dialog
        setShowOnboarding(true);
      }

      setAccounts(loadedAccounts);
      setTransactions(loadedTransactions);
    } catch (err) {
      console.error("Error loading SQLite database records:", err);
      setShowOnboarding(true);
    }
  });

  const handleCompleteOnboarding = async (profile: UserProfile) => {
    try {
      await saveUserProfile(profile);
      setUserProfile(profile);
      setShowOnboarding(false);
    } catch (err) {
      console.error("Failed to save user profile:", err);
    }
  };

  const handleSaveSettings = async (profile: UserProfile, theme: ThemeMode) => {
    try {
      await Promise.all([
        saveUserProfile(profile),
        setStoredTheme(theme),
      ]);
      setUserProfile(profile);
      setCurrentTheme(theme);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleSaveTransaction = async (txData: Omit<Transaction, "id">, id?: string) => {
    try {
      if (id) {
        const updated = await updateExistingTransaction({ ...txData, id });
        setTransactions(transactions().map((t) => (t.id === id ? updated : t)));
      } else {
        const created = await insertTransaction(txData);
        setTransactions([created, ...transactions()]);
      }

      // Refresh accounts with updated balances from SQLite
      const updatedAccounts = await fetchAccounts();
      setAccounts(updatedAccounts);
    } catch (err) {
      console.error("Failed to save transaction:", err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await removeTransaction(id);
      setTransactions(transactions().filter((t) => t.id !== id));

      // Refresh accounts with reverted balances from SQLite
      const updatedAccounts = await fetchAccounts();
      setAccounts(updatedAccounts);
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  };

  const handleToggleFlag = async (id: string) => {
    try {
      const nextStatus = await toggleTransactionFlag(id);
      setTransactions(
        transactions().map((t) =>
          t.id === id ? { ...t, status: nextStatus as any } : t
        )
      );
    } catch (err) {
      console.error("Failed to toggle transaction flag:", err);
    }
  };

  const handleImportCSV = async (imported: Omit<Transaction, "id">[]) => {
    try {
      await batchImportTransactions(imported);

      // Re-fetch all fresh records and balances from SQLite
      const [refreshedTxs, refreshedAccs] = await Promise.all([
        fetchTransactions(),
        fetchAccounts(),
      ]);
      setTransactions(refreshedTxs);
      setAccounts(refreshedAccs);
    } catch (err) {
      console.error("Failed to batch import transactions:", err);
    }
  };

  const handleCreateAccount = async (newAcc: { name: string; type: string; balance: number }) => {
    try {
      await insertAccount(newAcc);
      const updated = await fetchAccounts();
      setAccounts(updated);
    } catch (err) {
      console.error("Failed to add account:", err);
    }
  };

  const handleSaveBudget = async (item: BudgetItem) => {
    const current = budgets();
    const existingIndex = current.findIndex((b) => b.id === item.id);
    let updated: BudgetItem[];
    if (existingIndex >= 0) {
      updated = current.map((b) => (b.id === item.id ? item : b));
    } else {
      updated = [...current, item];
    }
    setBudgets(updated);
    await saveBudgets(updated);
  };

  const handleDeleteBudget = async (id: string) => {
    const updated = budgets().filter((b) => b.id !== id);
    setBudgets(updated);
    await saveBudgets(updated);
  };

  const handleSaveCategory = async (item: CategoryItem) => {
    const current = categories();
    const existingIndex = current.findIndex((c) => c.id === item.id);
    let updated: CategoryItem[];

    if (existingIndex >= 0) {
      const oldCat = current[existingIndex];
      updated = current.map((c) => (c.id === item.id ? item : c));
      // If name or color changed, update matching transactions
      if (oldCat.name !== item.name || oldCat.color !== item.color) {
        await reassignCategoryTransactions(oldCat.name, item.name, item.color);
        const refreshedTxs = await fetchTransactions();
        setTransactions(refreshedTxs);
      }
    } else {
      updated = [...current, item];
    }

    setCategories(updated);
    await saveCategories(updated);
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (id: string, reassignToCatName?: string) => {
    const catToDelete = categories().find((c) => c.id === id);
    if (!catToDelete) return;

    if (reassignToCatName) {
      const targetCat = categories().find(
        (c) => c.name.toLowerCase() === reassignToCatName.toLowerCase()
      );
      const targetColor = targetCat?.color || "#64748b";
      await reassignCategoryTransactions(catToDelete.name, reassignToCatName, targetColor);
      const refreshedTxs = await fetchTransactions();
      setTransactions(refreshedTxs);
    }

    const updated = categories().filter((c) => c.id !== id);
    setCategories(updated);
    await saveCategories(updated);
    setDeletingCategory(null);
  };

  return (
    <div class="flex h-screen w-screen overflow-hidden bg-canvas font-sans text-text-main">
      {/* Sidebar with Transactions Navigation & Accounts */}
      <Sidebar
        accounts={accounts()}
        transactions={transactions()}
        activeFilter={activeFilter()}
        activeView={currentView()}
        userName={userProfile()?.name}
        currencySymbol={userProfile()?.currencySymbol}
        onSelectView={(view) => setCurrentView(view)}
        onSelectFilter={(filter) => {
          setActiveFilter(filter);
          setCurrentView("transactions");
        }}
        onOpenAddTransaction={() => {
          setEditingTransaction(null);
          setIsModalOpen(true);
        }}
        onOpenAddAccount={() => setIsAccountModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Page Area */}
      {currentView() === "dashboard" ? (
        <DashboardPage
          accounts={accounts()}
          transactions={transactions()}
          userName={userProfile()?.name}
          currencySymbol={userProfile()?.currencySymbol}
          onNavigateToTransactions={(filter) => {
            if (filter) setActiveFilter(filter);
            setCurrentView("transactions");
          }}
          onOpenAddTransaction={() => {
          setEditingTransaction(null);
          setIsModalOpen(true);
        }}
          onOpenAddAccount={() => setIsAccountModalOpen(true)}
        />
      ) : currentView() === "budgets" ? (
        <BudgetPage
          budgets={budgets()}
          transactions={transactions()}
          currencySymbol={userProfile()?.currencySymbol}
          onOpenAddBudget={() => {
            setEditingBudget(null);
            setIsBudgetModalOpen(true);
          }}
          onEditBudget={(item) => {
            setEditingBudget(item);
            setIsBudgetModalOpen(true);
          }}
          onDeleteBudget={handleDeleteBudget}
          onNavigateToTransactions={() => {
            setCurrentView("transactions");
          }}
        />
      ) : currentView() === "categories" ? (
        <CategoryPage
          categories={categories()}
          transactions={transactions()}
          currencySymbol={userProfile()?.currencySymbol}
          onOpenAddCategory={() => {
            setEditingCategory(null);
            setIsCategoryModalOpen(true);
          }}
          onEditCategory={(cat) => {
            setEditingCategory(cat);
            setIsCategoryModalOpen(true);
          }}
          onDeleteCategory={(cat) => {
            setDeletingCategory(cat);
          }}
          onNavigateToTransactions={() => {
            setActiveFilter("all");
            setCurrentView("transactions");
          }}
        />
      ) : (
        <TransactionsMainPage
          transactions={transactions()}
          accounts={accounts()}
          activeFilter={activeFilter()}
          currencySymbol={userProfile()?.currencySymbol}
          onFilterChange={(filter) => setActiveFilter(filter)}
          onOpenAddTransaction={() => {
            setEditingTransaction(null);
            setIsModalOpen(true);
          }}
          onEditTransaction={(tx) => {
            setEditingTransaction(tx);
            setIsModalOpen(true);
          }}
          onDeleteTransaction={handleDeleteTransaction}
          onToggleFlagTransaction={handleToggleFlag}
          onImportCSV={handleImportCSV}
        />
      )}

      {/* Transaction Modal */}
      {isModalOpen() && (
        <TransactionModal
          transaction={editingTransaction()}
          accounts={accounts()}
          categories={categories()}
          currencySymbol={userProfile()?.currencySymbol}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
          }}
          onSave={handleSaveTransaction}
        />
      )}

      {/* Account Modal */}
      {isAccountModalOpen() && (
        <AccountModal
          currencySymbol={userProfile()?.currencySymbol}
          onClose={() => setIsAccountModalOpen(false)}
          onSave={handleCreateAccount}
        />
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen() && (
        <BudgetModal
          budget={editingBudget()}
          categories={categories()}
          currencySymbol={userProfile()?.currencySymbol}
          onClose={() => {
            setIsBudgetModalOpen(false);
            setEditingBudget(null);
          }}
          onSave={handleSaveBudget}
        />
      )}

      {/* Category Create / Edit Modal */}
      {isCategoryModalOpen() && (
        <CategoryModal
          category={editingCategory()}
          existingCategories={categories()}
          onClose={() => {
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
          }}
          onSave={handleSaveCategory}
        />
      )}

      {/* Category Delete & Reassignment Dialog */}
      {deletingCategory() && (
        <DeleteCategoryModal
          category={deletingCategory()!}
          allCategories={categories()}
          affectedCount={
            transactions().filter(
              (t) =>
                t.category.toLowerCase().trim() ===
                deletingCategory()!.name.toLowerCase().trim()
            ).length
          }
          onClose={() => setDeletingCategory(null)}
          onConfirmDelete={(reassignToCatName) =>
            handleDeleteCategory(deletingCategory()!.id, reassignToCatName)
          }
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen() && (
        <SettingsModal
          currentProfile={userProfile()}
          currentTheme={currentTheme()}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Initial Welcome & Country / Currency Onboarding Dialog */}
      {showOnboarding() && (
        <OnboardingModal onComplete={handleCompleteOnboarding} />
      )}
    </div>
  );
}

export default App;
