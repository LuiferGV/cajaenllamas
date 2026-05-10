export type EntryKind = "loan" | "fixed_expense" | "variable_expense";

export type Recurrence = "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

export type LoanPlanMode = "fixed" | "schedule";

export interface LoanInstallmentPlanEntry {
  installmentNumber: number;
  dueDate: string;
  amount: number;
}

export interface LoanInstallmentDraftEntry {
  installmentNumber: number;
  dueDate: string;
  amount: string;
}

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
  loanPlanMode: LoanPlanMode;
  installmentPlan: LoanInstallmentPlanEntry[] | null;
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
  loanPlanMode: LoanPlanMode;
  installmentPlan: LoanInstallmentDraftEntry[];
  historicalPaymentsCount: string;
  registerCurrentCycleAsPaid: "yes" | "no";
  currentCyclePaidAt: string;
}
