export type TransactionType = "expense" | "income" | "transfer";

export type TransactionStatus = "cleared" | "pending" | "reconciled" | "flagged";

export interface Transaction {
  id: string;
  date: string;
  payee: string;
  category: string;
  categoryColor?: string;
  account: string;
  toAccount?: string;
  amount: number; // positive for income, negative for expense
  type: TransactionType;
  status: TransactionStatus;
  notes?: string;
}

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment" | "loan";
  balance: number;
}

export interface UserProfile {
  name: string;
  country: string;
  currencyCode: string; // e.g. "INR", "USD"
  currencySymbol: string; // e.g. "₹", "$"
  theme?: ThemeMode;
}

export type ThemeMode = "light" | "dark" | "auto";

export interface BudgetItem {
  id: string;
  category: string;
  limit: number;
  period?: "monthly" | "yearly";
  color?: string;
}

export type CategoryType = "expense" | "income" | "both";

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
  type: CategoryType;
  icon?: string;
  description?: string;
  isDefault?: boolean;
}

export type LoanType = "lent" | "borrowed"; // "lent" = they owe you; "borrowed" = you owe them
export type LoanStatus = "active" | "settled";

export interface LoanRecord {
  id: string;
  contactName: string;
  type: LoanType;
  initialAmount: number;
  remainingAmount: number;
  account: string; // The bank account used to disburse/receive funds
  startDate: string;
  dueDate?: string;
  notes?: string;
  status: LoanStatus;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  contactName: string;
  date: string;
  amount: number;
  account: string; // Destination/Source account
  notes?: string;
}
