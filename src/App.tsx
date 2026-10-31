import { createSignal, onMount, onCleanup } from "solid-js";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./components/DashboardPage";
import { BudgetPage } from "./components/BudgetPage";
import { CategoryPage } from "./components/CategoryPage";
import { LoansPage } from "./components/LoansPage";
import { TransactionsMainPage } from "./components/TransactionsMainPage";
import { TransactionModal } from "./components/TransactionModal";
import { AccountModal } from "./components/AccountModal";
import { BudgetModal } from "./components/BudgetModal";
import { CategoryModal } from "./components/CategoryModal";
import { DeleteCategoryModal } from "./components/DeleteCategoryModal";
import { LoanModal } from "./components/LoanModal";
import { LoanPaymentModal } from "./components/LoanPaymentModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { SettingsModal } from "./components/SettingsModal";
import { AskFinlyDrawer } from "./components/AskFinlyDrawer";
import { requestNotificationPermission } from "./utils/notifications";
import { getAIConfig } from "./utils/ai/storage";
import {
  Account,
  Transaction,
  UserProfile,
  ThemeMode,
  BudgetItem,
  CategoryItem,
  LoanRecord,
  LoanPayment,
} from "./types/finance";
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
  removeAccount,
  fetchBudgets,
  saveBudgets,
  fetchCategories,
  saveCategories,
  syncNewCategoriesFromTransactions,
  reassignCategoryTransactions,
  fetchLoans,
  saveLoans,
  fetchLoanPayments,
  saveLoanPayments,
  createLoanTransaction,
  createRepaymentTransaction,
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
  const [isLoanModalOpen, setIsLoanModalOpen] = createSignal(false);
  const [repayingLoan, setRepayingLoan] = createSignal<LoanRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [settingsTab, setSettingsTab] = createSignal<"general" | "ai">("general");
  const [isAskFinlyOpen, setIsAskFinlyOpen] = createSignal(false);
  const [isAiEnabled, setIsAiEnabled] = createSignal(false);
  const [attachedTransactions, setAttachedTransactions] = createSignal<Transaction[]>([]);
  const [askFinlyInitialPrompt, setAskFinlyInitialPrompt] = createSignal<string>("");
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [activeFilter, setActiveFilter] = createSignal("all");
  const [currentView, setCurrentView] = createSignal<"dashboard" | "transactions" | "budgets" | "categories" | "loans">("dashboard");
  const [accounts, setAccounts] = createSignal<Account[]>([]);
  const [transactions, setTransactions] = createSignal<Transaction[]>([]);
  const [budgets, setBudgets] = createSignal<BudgetItem[]>([]);
  const [categories, setCategories] = createSignal<CategoryItem[]>([]);
  const [loans, setLoans] = createSignal<LoanRecord[]>([]);
  const [loanPayments, setLoanPayments] = createSignal<LoanPayment[]>([]);
  const [userProfile, setUserProfile] = createSignal<UserProfile | null>(null);
  const [currentTheme, setCurrentTheme] = createSignal<ThemeMode>("auto");

  // Load persisted SQLite data, theme, and user profile on launch
  onMount(async () => {
    try {
      const [
        loadedProfile,
        loadedAccounts,
        loadedTransactions,
        loadedTheme,
        loadedBudgets,
        loadedCategories,
        loadedLoans,
        loadedPayments,
      ] = await Promise.all([
        getUserProfile(),
        fetchAccounts(),
        fetchTransactions(),
        getStoredTheme(),
        fetchBudgets(),
        fetchCategories(),
        fetchLoans(),
        fetchLoanPayments(),
      ]);

      setCurrentTheme(loadedTheme);
      applyTheme(loadedTheme);
      setBudgets(loadedBudgets);
      setCategories(loadedCategories);
      setLoans(loadedLoans);
      setLoanPayments(loadedPayments);

      if (loadedProfile) {
        setUserProfile(loadedProfile);
      } else {
        // If no profile exists yet, trigger onboarding dialog
        setShowOnboarding(true);
      }

      setAccounts(loadedAccounts);
      setTransactions(loadedTransactions);

      // Sync AI enabled status
      const syncAI = async () => {
        try {
          const cfg = await getAIConfig();
          setIsAiEnabled(cfg.enabled);
          if (!cfg.enabled) {
            setIsAskFinlyOpen(false);
          }
        } catch {
          setIsAiEnabled(false);
        }
      };
      await syncAI();

      // Request desktop notification permission if supported
      requestNotificationPermission().catch(() => {});

      if (typeof window !== "undefined") {
        window.addEventListener("finly:ai_config_updated", syncAI);
      }
    } catch (err) {
      console.error("Error loading SQLite database records:", err);
      setShowOnboarding(true);
    }
  });

  onCleanup(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("finly:ai_config_updated", () => {});
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

      const cfg = await getAIConfig();
      setIsAiEnabled(cfg.enabled);
      if (!cfg.enabled) {
        setIsAskFinlyOpen(false);
      }
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

  const handleDeleteAccount = async (account: Account) => {
    try {
      await removeAccount(account.id);
      setAccounts(accounts().filter((a) => a.id !== account.id));
    } catch (err) {
      console.error("Failed to delete account:", err);
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

  const handleOpenAskFinly = (prompt?: string, txs?: Transaction[]) => {
    setAskFinlyInitialPrompt(prompt || "");
    setAttachedTransactions(txs || []);
    setIsAskFinlyOpen(true);
  };

  const handleUpdateTransactionFromAI = async (updated: Transaction) => {
    try {
      const saved = await updateExistingTransaction(updated);
      setTransactions(transactions().map((t) => (t.id === saved.id ? saved : t)));
      setAttachedTransactions(
        attachedTransactions().map((t) => (t.id === saved.id ? saved : t))
      );
    } catch (err) {
      console.error("Failed to update transaction from AI action:", err);
    }
  };

  const handleImportCSV = async (imported: Omit<Transaction, "id">[]) => {
    try {
      // 1. Automatically detect & create new categories not yet present in Finly
      const currentCats = categories().length > 0 ? categories() : await fetchCategories();
      const { updatedCategories, newCategoriesAdded } = await syncNewCategoriesFromTransactions(
        imported,
        currentCats
      );
      if (newCategoriesAdded.length > 0) {
        setCategories(updatedCategories);
      }

      // 2. Import transactions into SQLite / storage
      await batchImportTransactions(imported);

      // 3. Re-fetch all fresh records and balances from SQLite
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

  const handleCreateLoan = async (loan: LoanRecord) => {
    try {
      const tx = createLoanTransaction(loan);
      await handleSaveTransaction(tx);
      const updatedLoans = [loan, ...loans()];
      setLoans(updatedLoans);
      await saveLoans(updatedLoans);
      setIsLoanModalOpen(false);
    } catch (err) {
      console.error("Failed to create loan record:", err);
    }
  };

  const handleRecordPayment = async (payment: LoanPayment) => {
    try {
      const loan = loans().find((l) => l.id === payment.loanId);
      if (!loan) return;

      const tx = createRepaymentTransaction(payment, loan);
      await handleSaveTransaction(tx);

      const newRemaining = Math.max(0, loan.remainingAmount - payment.amount);
      const nextStatus = newRemaining <= 0 ? "settled" : "active";

      const updatedLoans = loans().map((l) =>
        l.id === loan.id
          ? { ...l, remainingAmount: newRemaining, status: nextStatus as any }
          : l
      );
      setLoans(updatedLoans);
      await saveLoans(updatedLoans);

      const updatedPayments = [payment, ...loanPayments()];
      setLoanPayments(updatedPayments);
      await saveLoanPayments(updatedPayments);

      setRepayingLoan(null);
    } catch (err) {
      console.error("Failed to record loan payment:", err);
    }
  };

  const handleDeleteLoan = async (id: string) => {
    try {
      const updatedLoans = loans().filter((l) => l.id !== id);
      setLoans(updatedLoans);
      await saveLoans(updatedLoans);
    } catch (err) {
      console.error("Failed to delete loan:", err);
    }
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
        isAiEnabled={isAiEnabled()}
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
        onDeleteAccount={handleDeleteAccount}
        onOpenSettings={() => {
          setSettingsTab("general");
          setIsSettingsOpen(true);
        }}
        onOpenAskFinly={() => handleOpenAskFinly()}
      />

      {/* Main Page Area */}
      {currentView() === "dashboard" ? (
        <DashboardPage
          accounts={accounts()}
          transactions={transactions()}
          budgets={budgets()}
          categories={categories()}
          loans={loans()}
          userName={userProfile()?.name}
          currencySymbol={userProfile()?.currencySymbol}
          isAiEnabled={isAiEnabled()}
          onNavigateToTransactions={(filter) => {
            if (filter) setActiveFilter(filter);
            setCurrentView("transactions");
          }}
          onOpenAddTransaction={() => {
            setEditingTransaction(null);
            setIsModalOpen(true);
          }}
          onOpenAddAccount={() => setIsAccountModalOpen(true)}
          onOpenAskFinly={(prompt) => handleOpenAskFinly(prompt)}
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
      ) : currentView() === "loans" ? (
        <LoansPage
          loans={loans()}
          loanPayments={loanPayments()}
          currencySymbol={userProfile()?.currencySymbol}
          onOpenAddLoan={() => setIsLoanModalOpen(true)}
          onOpenRecordPayment={(loan) => setRepayingLoan(loan)}
          onDeleteLoan={handleDeleteLoan}
          onNavigateToTransactions={(q) => {
            if (q) setActiveFilter(q);
            setCurrentView("transactions");
          }}
        />
      ) : (
        <TransactionsMainPage
          transactions={transactions()}
          accounts={accounts()}
          categories={categories()}
          activeFilter={activeFilter()}
          currencySymbol={userProfile()?.currencySymbol}
          isAiEnabled={isAiEnabled()}
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
          onOpenAskFinly={handleOpenAskFinly}
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

      {/* Loan Creation Modal */}
      {isLoanModalOpen() && (
        <LoanModal
          accounts={accounts()}
          currencySymbol={userProfile()?.currencySymbol}
          existingContacts={Array.from(new Set(loans().map((l) => l.contactName)))}
          onClose={() => setIsLoanModalOpen(false)}
          onSave={handleCreateLoan}
        />
      )}

      {/* Loan Payment Repayment Modal */}
      {repayingLoan() && (
        <LoanPaymentModal
          loan={repayingLoan()!}
          accounts={accounts()}
          currencySymbol={userProfile()?.currencySymbol}
          onClose={() => setRepayingLoan(null)}
          onSavePayment={handleRecordPayment}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen() && (
        <SettingsModal
          currentProfile={userProfile()}
          currentTheme={currentTheme()}
          initialTab={settingsTab()}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}

      {/* "Ask Finly" Conversational Financial Advisor Drawer (Only rendered when AI is enabled) */}
      {isAiEnabled() && (
        <AskFinlyDrawer
          isOpen={isAskFinlyOpen()}
          onClose={() => setIsAskFinlyOpen(false)}
          onOpenSettings={() => {
            setSettingsTab("ai");
            setIsSettingsOpen(true);
          }}
          accounts={accounts()}
          budgets={budgets()}
          transactions={transactions()}
          categories={categories()}
          loans={loans()}
          attachedTransactions={attachedTransactions()}
          onClearAttachedTransactions={() => setAttachedTransactions([])}
          onUpdateTransaction={handleUpdateTransactionFromAI}
          onCreateTransaction={handleSaveTransaction}
          initialPrompt={askFinlyInitialPrompt()}
          currencySymbol={userProfile()?.currencySymbol}
          userName={userProfile()?.name}
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
