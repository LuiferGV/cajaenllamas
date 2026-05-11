export type EntryKind = "loan" | "fixed_expense" | "variable_expense" | "recurring_expense";

export type Recurrence = "daily" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

export type LoanPlanMode = "fixed" | "schedule";

export type PaymentType = "cycle_payment" | "loan_installment" | "loan_extra_payment";

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
  principalAmount: number | null;
  principalRemaining: number | null;
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
  paymentType: PaymentType;
}

export interface FinanceState {
  items: FinanceItem[];
  history: PaymentHistoryEntry[];
}

export interface SharedLoanPaymentEntry {
  id: string;
  loanId: string;
  title: string;
  lenderUid: string;
  lenderEmail: string;
  borrowerUid: string;
  borrowerEmail: string;
  amount: number;
  paidAt: string;
  coveredDueDate: string | null;
  nextDueDate: string | null;
  installmentNumber: number | null;
  installmentsTotal: number | null;
  paymentType: Extract<PaymentType, "loan_installment" | "loan_extra_payment">;
  recordedByUid: string;
  recordedByEmail: string;
}

export interface SharedLoan {
  id: string;
  title: string;
  lenderUid: string;
  lenderEmail: string;
  borrowerUid: string;
  borrowerEmail: string;
  amount: number;
  principalAmount: number;
  principalRemaining: number;
  dueDate: string | null;
  notes: string;
  recurrence: "monthly";
  createdAt: string;
  updatedAt: string;
  lastPaidAt: string | null;
  installmentsTotal: number;
  installmentsPaid: number;
  isCompleted: boolean;
  history: SharedLoanPaymentEntry[];
}

export interface SharedLoanDraft {
  borrowerEmail: string;
  title: string;
  amount: string;
  principalAmount: string;
  installmentsTotal: string;
  dueDate: string;
  notes: string;
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
  principalAmount: string;
  historicalPaymentsCount: string;
  registerCurrentCycleAsPaid: "yes" | "no";
  currentCyclePaidAt: string;
}
