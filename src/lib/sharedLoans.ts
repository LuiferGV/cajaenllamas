import { createId, formatDateKey, getNextDueDate, parseAmount, todayKey } from "./finance";
import type { SharedLoan, SharedLoanDraft, SharedLoanPaymentEntry } from "../types";

type SharedCounterparty = {
  borrowerEmail: string;
  lenderUid: string;
  lenderEmail: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createEmptySharedLoanDraft(): SharedLoanDraft {
  return {
    borrowerEmail: "",
    title: "",
    amount: "",
    principalAmount: "",
    installmentsTotal: "",
    dueDate: todayKey(),
    notes: ""
  };
}

export function validateSharedLoanDraft(draft: SharedLoanDraft, currentUserEmail: string | null) {
  const borrowerEmail = draft.borrowerEmail.trim().toLowerCase();

  if (!borrowerEmail) return "Escribe el email de la persona que te debe.";
  if (!EMAIL_PATTERN.test(borrowerEmail)) {
    return "Escribe un email valido para el usuario que te debe.";
  }
  if (currentUserEmail && borrowerEmail === currentUserEmail.trim().toLowerCase()) {
    return "No puedes crearte un prestamo compartido contigo mismo.";
  }
  if (!draft.title.trim()) return "Escribe un nombre o motivo para el prestamo compartido.";
  if (parseAmount(draft.principalAmount) <= 0) return "Indica el monto total del prestamo compartido.";
  if (parseAmount(draft.amount) <= 0) return "Indica el monto de la cuota mensual.";
  if (parseAmount(draft.installmentsTotal) <= 0) return "Indica cuantas cuotas tendra este prestamo.";
  if (!draft.dueDate) return "Selecciona la fecha de la primera cuota.";
  return null;
}

export function buildSharedLoanFromDraft(
  draft: SharedLoanDraft,
  counterpart: SharedCounterparty
): SharedLoan {
  const now = todayKey();
  const principalAmount = parseAmount(draft.principalAmount);
  const amount = parseAmount(draft.amount);
  const installmentsTotal = parseAmount(draft.installmentsTotal);

  return {
    id: createId("shared-loan"),
    title: draft.title.trim(),
    lenderUid: counterpart.lenderUid,
    lenderEmail: counterpart.lenderEmail.trim().toLowerCase(),
    borrowerUid: "",
    borrowerEmail: counterpart.borrowerEmail.trim().toLowerCase(),
    amount,
    principalAmount,
    principalRemaining: principalAmount,
    dueDate: draft.dueDate,
    notes: draft.notes.trim(),
    recurrence: "monthly",
    createdAt: now,
    updatedAt: now,
    lastPaidAt: null,
    installmentsTotal,
    installmentsPaid: 0,
    isCompleted: false,
    history: []
  };
}

export function normalizeSharedLoan(rawValue: Partial<SharedLoan> & { id?: string }): SharedLoan {
  const principalAmount = typeof rawValue.principalAmount === "number" ? rawValue.principalAmount : 0;
  const installmentsPaid = typeof rawValue.installmentsPaid === "number" ? rawValue.installmentsPaid : 0;
  const installmentsTotal = typeof rawValue.installmentsTotal === "number" ? rawValue.installmentsTotal : 0;
  const amount = typeof rawValue.amount === "number" ? rawValue.amount : 0;
  const inferredRemaining = Math.max(principalAmount - amount * installmentsPaid, 0);
  const history = Array.isArray(rawValue.history)
    ? rawValue.history
        .map((entry) => normalizeSharedLoanPayment(entry as Partial<SharedLoanPaymentEntry>))
        .sort((left, right) => right.paidAt.localeCompare(left.paidAt))
    : [];

  return {
    id: rawValue.id ?? createId("shared-loan"),
    title: typeof rawValue.title === "string" && rawValue.title.trim() ? rawValue.title.trim() : "Prestamo compartido",
    lenderUid: rawValue.lenderUid ?? "",
    lenderEmail: typeof rawValue.lenderEmail === "string" ? rawValue.lenderEmail.toLowerCase() : "",
    borrowerUid: rawValue.borrowerUid ?? "",
    borrowerEmail: typeof rawValue.borrowerEmail === "string" ? rawValue.borrowerEmail.toLowerCase() : "",
    amount,
    principalAmount,
    principalRemaining:
      typeof rawValue.principalRemaining === "number" ? Math.max(rawValue.principalRemaining, 0) : inferredRemaining,
    dueDate: typeof rawValue.dueDate === "string" ? rawValue.dueDate : null,
    notes: typeof rawValue.notes === "string" ? rawValue.notes : "",
    recurrence: "monthly",
    createdAt: typeof rawValue.createdAt === "string" ? rawValue.createdAt : todayKey(),
    updatedAt: typeof rawValue.updatedAt === "string" ? rawValue.updatedAt : todayKey(),
    lastPaidAt: typeof rawValue.lastPaidAt === "string" ? rawValue.lastPaidAt : null,
    installmentsTotal,
    installmentsPaid,
    isCompleted:
      typeof rawValue.isCompleted === "boolean"
        ? rawValue.isCompleted
        : installmentsPaid >= installmentsTotal || inferredRemaining <= 0,
    history
  };
}

function normalizeSharedLoanPayment(rawValue: Partial<SharedLoanPaymentEntry>): SharedLoanPaymentEntry {
  return {
    id: rawValue.id ?? createId("shared-payment"),
    loanId: rawValue.loanId ?? "",
    title: typeof rawValue.title === "string" ? rawValue.title : "Prestamo compartido",
    lenderUid: rawValue.lenderUid ?? "",
    lenderEmail: typeof rawValue.lenderEmail === "string" ? rawValue.lenderEmail.toLowerCase() : "",
    borrowerUid: rawValue.borrowerUid ?? "",
    borrowerEmail: typeof rawValue.borrowerEmail === "string" ? rawValue.borrowerEmail.toLowerCase() : "",
    amount: typeof rawValue.amount === "number" ? rawValue.amount : 0,
    paidAt: typeof rawValue.paidAt === "string" ? rawValue.paidAt : todayKey(),
    coveredDueDate: typeof rawValue.coveredDueDate === "string" ? rawValue.coveredDueDate : null,
    nextDueDate: typeof rawValue.nextDueDate === "string" ? rawValue.nextDueDate : null,
    installmentNumber: typeof rawValue.installmentNumber === "number" ? rawValue.installmentNumber : null,
    installmentsTotal: typeof rawValue.installmentsTotal === "number" ? rawValue.installmentsTotal : null,
    paymentType: rawValue.paymentType === "loan_extra_payment" ? "loan_extra_payment" : "loan_installment",
    recordedByUid: rawValue.recordedByUid ?? "",
    recordedByEmail: typeof rawValue.recordedByEmail === "string" ? rawValue.recordedByEmail.toLowerCase() : ""
  };
}

export function sortSharedLoans(left: SharedLoan, right: SharedLoan) {
  if (left.isCompleted !== right.isCompleted) return left.isCompleted ? 1 : -1;
  const leftDue = left.dueDate ?? "9999-12-31";
  const rightDue = right.dueDate ?? "9999-12-31";
  const dueCompare = leftDue.localeCompare(rightDue);
  if (dueCompare !== 0) return dueCompare;
  return left.title.localeCompare(right.title);
}

export function getSharedLoanCounterpartyEmail(loan: SharedLoan, currentUserEmail: string | null) {
  const normalizedEmail = currentUserEmail?.trim().toLowerCase() ?? "";
  return loan.lenderEmail === normalizedEmail ? loan.borrowerEmail : loan.lenderEmail;
}

export function isSharedLoanEditable(loan: SharedLoan, currentUserEmail: string | null) {
  return Boolean(currentUserEmail) && loan.lenderEmail === currentUserEmail?.trim().toLowerCase();
}

export function registerSharedLoanInstallment(
  loan: SharedLoan,
  recorderUid: string,
  recorderEmail: string,
  paidAt = todayKey()
) {
  const nextInstallmentsPaid = loan.installmentsPaid + 1;
  const nextPrincipalRemaining = Math.max(loan.principalRemaining - loan.amount, 0);
  const completesLoan = nextInstallmentsPaid >= loan.installmentsTotal || nextPrincipalRemaining <= 0;
  const nextDueDate =
    completesLoan || loan.dueDate === null ? null : getNextDueDate(loan.dueDate, loan.recurrence, paidAt);
  const payment: SharedLoanPaymentEntry = {
    id: createId("shared-payment"),
    loanId: loan.id,
    title: loan.title,
    lenderUid: loan.lenderUid,
    lenderEmail: loan.lenderEmail,
    borrowerUid: loan.borrowerUid,
    borrowerEmail: loan.borrowerEmail,
    amount: loan.amount,
    paidAt,
    coveredDueDate: loan.dueDate,
    nextDueDate,
    installmentNumber: nextInstallmentsPaid,
    installmentsTotal: loan.installmentsTotal,
    paymentType: "loan_installment",
    recordedByUid: recorderUid,
    recordedByEmail: recorderEmail.toLowerCase()
  };

  return {
    ...loan,
    principalRemaining: nextPrincipalRemaining,
    dueDate: nextDueDate,
    lastPaidAt: paidAt,
    updatedAt: paidAt,
    installmentsPaid: nextInstallmentsPaid,
    isCompleted: completesLoan,
    history: [payment, ...loan.history].sort((left, right) => right.paidAt.localeCompare(left.paidAt))
  } satisfies SharedLoan;
}

export function registerSharedLoanExtraPayment(
  loan: SharedLoan,
  amount: number,
  recorderUid: string,
  recorderEmail: string,
  paidAt = todayKey()
) {
  const nextPrincipalRemaining = Math.max(loan.principalRemaining - amount, 0);
  const completesLoan = nextPrincipalRemaining <= 0;
  const payment: SharedLoanPaymentEntry = {
    id: createId("shared-payment"),
    loanId: loan.id,
    title: loan.title,
    lenderUid: loan.lenderUid,
    lenderEmail: loan.lenderEmail,
    borrowerUid: loan.borrowerUid,
    borrowerEmail: loan.borrowerEmail,
    amount,
    paidAt,
    coveredDueDate: loan.dueDate,
    nextDueDate: completesLoan ? null : loan.dueDate,
    installmentNumber: null,
    installmentsTotal: loan.installmentsTotal,
    paymentType: "loan_extra_payment",
    recordedByUid: recorderUid,
    recordedByEmail: recorderEmail.toLowerCase()
  };

  return {
    ...loan,
    principalRemaining: nextPrincipalRemaining,
    dueDate: completesLoan ? null : loan.dueDate,
    lastPaidAt: paidAt,
    updatedAt: paidAt,
    isCompleted: completesLoan,
    history: [payment, ...loan.history].sort((left, right) => right.paidAt.localeCompare(left.paidAt))
  } satisfies SharedLoan;
}

export function getSharedLoanInstallmentsAfterCurrent(loan: SharedLoan) {
  if (loan.isCompleted) return 0;
  return Math.max(loan.installmentsTotal - (loan.installmentsPaid + 1), 0);
}

export function getSharedLoanCurrentInstallmentNumber(loan: SharedLoan) {
  if (loan.isCompleted) return loan.installmentsTotal;
  return Math.min(loan.installmentsPaid + 1, loan.installmentsTotal);
}

export function getSharedLoanRoleLabel(loan: SharedLoan, currentUserEmail: string | null) {
  return loan.lenderEmail === currentUserEmail?.trim().toLowerCase() ? "Me deben" : "Debo";
}
