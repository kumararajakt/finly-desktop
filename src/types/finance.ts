export type TransactionType = "expense" | "income" | "transfer";

export type TransactionStatus = "cleared" | "pending" | "reconciled" | "flagged";

export interface Transaction {
  id: string;
  date: string;
  payee: string;
  category: string;
  categoryColor?: string;
  account: string;
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
