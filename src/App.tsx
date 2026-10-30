import { createSignal, onMount } from "solid-js";
import { Sidebar } from "./components/Sidebar";
import { TransactionsMainPage } from "./components/TransactionsMainPage";
import { TransactionModal } from "./components/TransactionModal";
import { AccountModal } from "./components/AccountModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { SettingsModal } from "./components/SettingsModal";
import { Account, Transaction, UserProfile } from "./types/finance";
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
} from "./utils/db";
import "./App.css";

function App() {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = createSignal(false);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [activeFilter, setActiveFilter] = createSignal("all");
  const [accounts, setAccounts] = createSignal<Account[]>([]);
  const [transactions, setTransactions] = createSignal<Transaction[]>([]);
  const [userProfile, setUserProfile] = createSignal<UserProfile | null>(null);
  const [loading, setLoading] = createSignal(true);

  // Load persisted SQLite data and user profile on launch
  onMount(async () => {
    try {
      const [loadedProfile, loadedAccounts, loadedTransactions] = await Promise.all([
        getUserProfile(),
        fetchAccounts(),
        fetchTransactions(),
      ]);

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
    } finally {
      setLoading(false);
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

  return (
    <div class="flex h-screen w-screen overflow-hidden bg-canvas font-sans text-text-main">
      {/* Sidebar with Transactions Navigation & Accounts */}
      <Sidebar
        accounts={accounts()}
        transactions={transactions()}
        activeFilter={activeFilter()}
        userName={userProfile()?.name}
        currencySymbol={userProfile()?.currencySymbol}
        onSelectFilter={(filter) => setActiveFilter(filter)}
        onOpenAddTransaction={() => setIsModalOpen(true)}
        onOpenAddAccount={() => setIsAccountModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Page Area */}
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

      {/* Settings Modal */}
      {isSettingsOpen() && (
        <SettingsModal
          currentProfile={userProfile()}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleCompleteOnboarding}
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
