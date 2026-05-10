export type EntryKind = "loan" | "fixed_expense" | "variable_expense";

export type Recurrence = "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

export interface FinanceItem {
  id: string;
  name: string;
  entityName: string;
  conceptName: string;
  kind: EntryKind;
  amount: number;
  recurrence: Recurrence;
  dueDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastPaidAt: string | null;
  installmentsTotal: number | null;
  installmentsPaid: number;
  isCompleted: boolean;
}

export interface PaymentHistoryEntry {
  id: string;
  itemId: string;
  itemName: string;
  entityName: string;
  conceptName: string;
  kind: EntryKind;
  amount: number;
  recurrence: Recurrence;
  paidAt: string;
  coveredDueDate: string | null;
  nextDueDate: string | null;
  installmentNumber: number | null;
  installmentsTotal: number | null;
}

export interface FinanceState {
  items: FinanceItem[];
  history: PaymentHistoryEntry[];
}

export interface FinanceDraft {
  entityName: string;
  conceptName: string;
  kind: EntryKind;
  amount: string;
  recurrence: Recurrence;
  dueDate: string;
  notes: string;
  installmentsTotal: string;
  installmentsPaid: string;
  currentInstallmentNumber: string;
  historicalPaymentsCount: string;
  registerCurrentCycleAsPaid: "yes" | "no";
  currentCyclePaidAt: string;
}
