import { createSignal } from "solid-js";
import { Sidebar } from "./components/Sidebar";
import { TransactionsMainPage } from "./components/TransactionsMainPage";
import { TransactionModal } from "./components/TransactionModal";
import { Account, Transaction } from "./types/finance";
import "./App.css";

function App() {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [activeFilter, setActiveFilter] = createSignal("all");

  const [accounts, setAccounts] = createSignal<Account[]>([
    { id: "1", name: "Chase Checking", type: "checking", balance: 0.00 },
    { id: "2", name: "High-Yield Savings", type: "savings", balance: 0.00 },
    { id: "3", name: "Credit Card", type: "credit", balance: 0.00 },
  ]);

  // Clean empty transaction state (no dummy data)
  const [transactions, setTransactions] = createSignal<Transaction[]>([]);

  const handleAddTransaction = (newTx: Omit<Transaction, "id">) => {
    const created: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}`,
    };
    setTransactions([created, ...transactions()]);

    // Update account balance automatically
    setAccounts(
      accounts().map((acc) =>
        acc.name === newTx.account
          ? { ...acc, balance: acc.balance + newTx.amount }
          : acc
      )
    );
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions().find((t) => t.id === id);
    if (tx) {
      // Revert account balance
      setAccounts(
        accounts().map((acc) =>
          acc.name === tx.account
            ? { ...acc, balance: acc.balance - tx.amount }
            : acc
        )
      );
    }
    setTransactions(transactions().filter((t) => t.id !== id));
  };

  const handleToggleFlag = (id: string) => {
    setTransactions(
      transactions().map((t) =>
        t.id === id
          ? { ...t, status: t.status === "flagged" ? "cleared" : "flagged" }
          : t
      )
    );
  };

  const handleImportCSV = (imported: Omit<Transaction, "id">[]) => {
    const withIds: Transaction[] = imported.map((tx, idx) => ({
      ...tx,
      id: `tx-imp-${Date.now()}-${idx}`,
    }));
    setTransactions([...withIds, ...transactions()]);

    // Discover any new accounts in the CSV and update/create them
    const currentAccounts = [...accounts()];
    imported.forEach((tx) => {
      const existing = currentAccounts.find((a) => a.name.toLowerCase() === tx.account.toLowerCase());
      if (existing) {
        existing.balance += tx.amount;
      } else {
        currentAccounts.push({
          id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: tx.account,
          type: tx.account.toLowerCase().includes("credit") ? "credit" : "checking",
          balance: tx.amount,
        });
      }
    });
    setAccounts(currentAccounts);
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
