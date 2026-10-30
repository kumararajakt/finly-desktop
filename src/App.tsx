import { createSignal, onMount } from "solid-js";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./components/DashboardPage";
import { BudgetPage } from "./components/BudgetPage";
import { TransactionsMainPage } from "./components/TransactionsMainPage";
import { TransactionModal } from "./components/TransactionModal";
import { AccountModal } from "./components/AccountModal";
import { BudgetModal } from "./components/BudgetModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { SettingsModal } from "./components/SettingsModal";
import { Account, Transaction, UserProfile, ThemeMode, BudgetItem } from "./types/finance";
import { applyTheme, getStoredTheme, setStoredTheme } from "./utils/theme";
import {
  fetchAccounts,
  fetchTransactions,
  insertTransaction,
  removeTransaction,
  toggleTransactionFlag,
  batchImportTransactions,
  getUserProfile,
  saveUserProfile,
  insertAccount,
  fetchBudgets,
  saveBudgets,
} from "./utils/db";
import "./App.css";

function App() {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = createSignal(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = createSignal(false);
  const [editingBudget, setEditingBudget] = createSignal<BudgetItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [activeFilter, setActiveFilter] = createSignal("all");
  const [currentView, setCurrentView] = createSignal<"dashboard" | "transactions" | "budgets">("dashboard");
  const [accounts, setAccounts] = createSignal<Account[]>([]);
  const [transactions, setTransactions] = createSignal<Transaction[]>([]);
  const [budgets, setBudgets] = createSignal<BudgetItem[]>([]);
  const [userProfile, setUserProfile] = createSignal<UserProfile | null>(null);
  const [currentTheme, setCurrentTheme] = createSignal<ThemeMode>("auto");

  // Load persisted SQLite data, theme, and user profile on launch
  onMount(async () => {
    try {
      const [loadedProfile, loadedAccounts, loadedTransactions, loadedTheme, loadedBudgets] = await Promise.all([
        getUserProfile(),
        fetchAccounts(),
        fetchTransactions(),
        getStoredTheme(),
        fetchBudgets(),
      ]);

      setCurrentTheme(loadedTheme);
      applyTheme(loadedTheme);
      setBudgets(loadedBudgets);

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

  const handleAddTransaction = async (newTx: Omit<Transaction, "id">) => {
    try {
      const created = await insertTransaction(newTx);
      setTransactions([created, ...transactions()]);

      // Refresh accounts with updated balances from SQLite
      const updatedAccounts = await fetchAccounts();
      setAccounts(updatedAccounts);
    } catch (err) {
      console.error("Failed to insert transaction:", err);
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
        onOpenAddTransaction={() => setIsModalOpen(true)}
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
          onOpenAddTransaction={() => setIsModalOpen(true)}
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
      ) : (
        <TransactionsMainPage
          transactions={transactions()}
          activeFilter={activeFilter()}
          currencySymbol={userProfile()?.currencySymbol}
          onFilterChange={(filter) => setActiveFilter(filter)}
          onOpenAddTransaction={() => setIsModalOpen(true)}
          onDeleteTransaction={handleDeleteTransaction}
          onToggleFlagTransaction={handleToggleFlag}
          onImportCSV={handleImportCSV}
        />
      )}

      {/* Transaction Modal */}
      {isModalOpen() && (
        <TransactionModal
          accounts={accounts()}
          currencySymbol={userProfile()?.currencySymbol}
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddTransaction}
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
          currencySymbol={userProfile()?.currencySymbol}
          onClose={() => {
            setIsBudgetModalOpen(false);
            setEditingBudget(null);
          }}
          onSave={handleSaveBudget}
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
