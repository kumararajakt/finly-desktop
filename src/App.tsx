import { createSignal, onMount } from "solid-js";
import { Sidebar } from "./components/Sidebar";
import { TransactionsMainPage } from "./components/TransactionsMainPage";
import { TransactionModal } from "./components/TransactionModal";
import { Account, Transaction } from "./types/finance";
import {
  fetchAccounts,
  fetchTransactions,
  insertTransaction,
  removeTransaction,
  toggleTransactionFlag,
  batchImportTransactions,
} from "./utils/db";
import "./App.css";

function App() {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [activeFilter, setActiveFilter] = createSignal("all");
  const [accounts, setAccounts] = createSignal<Account[]>([]);
  const [transactions, setTransactions] = createSignal<Transaction[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Load persisted SQLite data on application launch
  onMount(async () => {
    try {
      const [loadedAccounts, loadedTransactions] = await Promise.all([
        fetchAccounts(),
        fetchTransactions(),
      ]);
      setAccounts(loadedAccounts);
      setTransactions(loadedTransactions);
    } catch (err) {
      console.error("Error loading SQLite database records:", err);
    } finally {
      setLoading(false);
    }
  });

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

  return (
    <div class="flex h-screen w-screen overflow-hidden bg-canvas font-sans text-text-main">
      {/* Sidebar with Transactions Navigation & Accounts */}
      <Sidebar
        accounts={accounts()}
        transactions={transactions()}
        activeFilter={activeFilter()}
        onSelectFilter={(filter) => setActiveFilter(filter)}
        onOpenAddTransaction={() => setIsModalOpen(true)}
      />

      {/* Main Page Area */}
      <TransactionsMainPage
        transactions={transactions()}
        activeFilter={activeFilter()}
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
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddTransaction}
        />
      )}
    </div>
  );
}

export default App;
