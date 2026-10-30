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
    { id: "1", name: "Chase Checking", type: "checking", balance: 4820.50 },
    { id: "2", name: "High-Yield Savings", type: "savings", balance: 24150.00 },
    { id: "3", name: "Amex Gold Card", type: "credit", balance: -850.20 },
    { id: "4", name: "Mortgage Loan", type: "loan", balance: -318537.81 },
  ]);

  const [transactions, setTransactions] = createSignal<Transaction[]>([
    {
      id: "tx-1",
      date: "2025-08-01",
      payee: "Mortgage Servicing Inc",
      category: "Housing",
      categoryColor: "#2563eb",
      account: "Chase Checking",
      amount: -2583.12,
      type: "expense",
      status: "cleared",
      notes: "Principal ($295.61) + Interest + PMI + Escrow",
    },
    {
      id: "tx-2",
      date: "2025-08-01",
      payee: "TechCorp Global (Payroll)",
      category: "Salary",
      categoryColor: "#10b981",
      account: "Chase Checking",
      amount: 4500.00,
      type: "income",
      status: "cleared",
      notes: "Bi-weekly direct deposit",
    },
    {
      id: "tx-3",
      date: "2025-08-02",
      payee: "Whole Foods Market",
      category: "Groceries",
      categoryColor: "#10b981",
      account: "Amex Gold Card",
      amount: -142.30,
      type: "expense",
      status: "cleared",
      notes: "Weekly organic groceries",
    },
    {
      id: "tx-4",
      date: "2025-08-03",
      payee: "Osteria Italian Restaurant",
      category: "Dining Out",
      categoryColor: "#f59e0b",
      account: "Amex Gold Card",
      amount: -92.50,
      type: "expense",
      status: "pending",
      notes: "Dinner with friends",
    },
    {
      id: "tx-5",
      date: "2025-08-04",
      payee: "Electric & Power Co",
      category: "Utilities",
      categoryColor: "#06b6d4",
      account: "Chase Checking",
      amount: -118.40,
      type: "expense",
      status: "cleared",
      notes: "July electric bill",
    },
    {
      id: "tx-6",
      date: "2025-08-04",
      payee: "Freelance Client Payment",
      category: "Salary",
      categoryColor: "#10b981",
      account: "Chase Checking",
      amount: 920.00,
      type: "income",
      status: "cleared",
      notes: "UI Design milestone #2",
    },
    {
      id: "tx-7",
      date: "2025-08-05",
      payee: "Target Superstore",
      category: "Groceries",
      categoryColor: "#10b981",
      account: "Amex Gold Card",
      amount: -65.20,
      type: "expense",
      status: "cleared",
      notes: "Household goods",
    },
    {
      id: "tx-8",
      date: "2025-08-06",
      payee: "Spotify / Netflix",
      category: "Entertainment",
      categoryColor: "#ec4899",
      account: "Amex Gold Card",
      amount: -28.98,
      type: "expense",
      status: "cleared",
      notes: "Monthly subscriptions",
    },
    {
      id: "tx-9",
      date: "2025-08-07",
      payee: "Unknown Wire Transfer",
      category: "Other",
      categoryColor: "#64748b",
      account: "Chase Checking",
      amount: -250.00,
      type: "expense",
      status: "flagged",
      notes: "Discrepancy: check bank statement vs schedule",
    },
    {
      id: "tx-10",
      date: "2025-08-08",
      payee: "Trader Joe's",
      category: "Groceries",
      categoryColor: "#10b981",
      account: "Amex Gold Card",
      amount: -74.15,
      type: "expense",
      status: "pending",
      notes: "Pending settlement",
    },
  ]);

  const handleAddTransaction = (newTx: Omit<Transaction, "id">) => {
    const created: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}`,
    };
    setTransactions([created, ...transactions()]);
  };

  const handleDeleteTransaction = (id: string) => {
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

  return (
    <div class="flex h-screen w-screen overflow-hidden bg-canvas font-sans text-text-main">
      {/* Sidebar with Transactions Navigation & Accounts */}
      <Sidebar
        accounts={accounts()}
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
