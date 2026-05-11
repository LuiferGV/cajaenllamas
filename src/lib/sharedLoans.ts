import { createId, formatCurrency, parseAmount } from "./finance";
import type {
  SharedLoan,
  SharedLoanActivityEntry,
  SharedLoanDraft,
  SharedSplitDraftMode,
  SharedSplitType
} from "../types";

type SharedActor = {
  userId: string;
  userEmail: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nowTimestamp() {
  return new Date().toISOString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getSplitTypeFromDraftMode(mode: SharedSplitDraftMode): SharedSplitType {
  return mode === "current_paid_full" || mode === "counterparty_paid_full" ? "full_amount" : "equal_split";
}

function isCurrentUserPayer(mode: SharedSplitDraftMode) {
  return mode === "current_paid_equal" || mode === "current_paid_full";
}

function getSettlementAmount(totalAmount: number, splitType: SharedSplitType) {
  return splitType === "full_amount" ? totalAmount : Math.round(totalAmount / 2);
}

function clampAmount(value: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.min(Math.max(value, min), max);
}

function getPaidAmountFromLoan(loan: Pick<SharedLoan, "originalSettlementAmount" | "settlementAmount">) {
  return clampAmount(loan.originalSettlementAmount - loan.settlementAmount, 0, loan.originalSettlementAmount);
}

function buildActivityEntry(
  loanId: string,
  actor: SharedActor,
  action: SharedLoanActivityEntry["action"],
  summary: string
): SharedLoanActivityEntry {
  return {
    id: createId("shared-activity"),
    loanId,
    action,
    summary,
    changedByUid: actor.userId,
    changedByEmail: normalizeEmail(actor.userEmail),
    changedAt: nowTimestamp()
  };
}

function getDraftModeFromLoan(loan: SharedLoan, currentUserEmail: string | null): SharedSplitDraftMode {
  const normalizedCurrentUserEmail = normalizeEmail(currentUserEmail ?? "");
  const currentUserIsPayer = loan.lenderEmail === normalizedCurrentUserEmail;

  if (currentUserIsPayer && loan.splitType === "equal_split") return "current_paid_equal";
  if (currentUserIsPayer && loan.splitType === "full_amount") return "current_paid_full";
  if (!currentUserIsPayer && loan.splitType === "equal_split") return "counterparty_paid_equal";
  return "counterparty_paid_full";
}

export function createEmptySharedLoanDraft(): SharedLoanDraft {
  return {
    counterpartyEmail: "",
    title: "",
    totalAmount: "",
    splitMode: "current_paid_equal",
    notes: ""
  };
}

export function validateSharedLoanDraft(draft: SharedLoanDraft, currentUserEmail: string | null) {
  const counterpartyEmail = normalizeEmail(draft.counterpartyEmail);

  if (!counterpartyEmail) return "Escribe el email del otro usuario.";
  if (!EMAIL_PATTERN.test(counterpartyEmail)) return "Escribe un email valido para el otro usuario.";
  if (currentUserEmail && counterpartyEmail === normalizeEmail(currentUserEmail)) {
    return "No puedes compartir un gasto contigo mismo.";
  }
  if (!draft.title.trim()) return "Escribe el nombre o motivo del gasto compartido.";
  if (parseAmount(draft.totalAmount) <= 0) return "Indica el monto total del gasto.";
  return null;
}

export function buildSharedLoanFromDraft(draft: SharedLoanDraft, actor: SharedActor): SharedLoan {
  const actorEmail = normalizeEmail(actor.userEmail);
  const counterpartyEmail = normalizeEmail(draft.counterpartyEmail);
  const totalAmount = parseAmount(draft.totalAmount);
  const splitType = getSplitTypeFromDraftMode(draft.splitMode);
  const payerEmail = isCurrentUserPayer(draft.splitMode) ? actorEmail : counterpartyEmail;
  const participantEmail = payerEmail === actorEmail ? counterpartyEmail : actorEmail;
  const timestamp = nowTimestamp();
  const loanId = createId("shared-expense");

  const sharedExpense: SharedLoan = {
    id: loanId,
    title: draft.title.trim(),
    lenderUid: actor.userId,
    lenderEmail: payerEmail,
    borrowerUid: "",
    borrowerEmail: participantEmail,
    splitType,
    totalAmount,
    originalSettlementAmount: getSettlementAmount(totalAmount, splitType),
    settlementAmount: getSettlementAmount(totalAmount, splitType),
    notes: draft.notes.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUid: actor.userId,
    createdByEmail: actorEmail,
    lastEditedByUid: actor.userId,
    lastEditedByEmail: actorEmail,
    lastEditedAt: timestamp,
    isCompleted: false,
    history: []
  };

  const splitDescription =
    splitType === "equal_split" ? "dividido a partes iguales" : "con deuda completa para la otra parte";

  return {
    ...sharedExpense,
    history: [
      buildActivityEntry(sharedExpense.id, actor, "created", `Creó el gasto compartido ${splitDescription}.`)
    ]
  };
}

function normalizeLegacyHistoryEntry(
  loanId: string,
  changedByUid: string,
  changedByEmail: string,
  changedAt: string,
  summary: string
): SharedLoanActivityEntry {
  return {
    id: createId("shared-activity"),
    loanId,
    action: "updated",
    summary,
    changedByUid,
    changedByEmail: normalizeEmail(changedByEmail),
    changedAt
  };
}

export function normalizeSharedLoan(rawValue: Partial<SharedLoan> & { id?: string }): SharedLoan {
  const id = rawValue.id ?? createId("shared-expense");
  const legacySource = rawValue as Partial<SharedLoan> & {
    principalRemaining?: number;
    principalAmount?: number;
    amount?: number;
  };
  const fallbackUpdatedAt =
    typeof rawValue.updatedAt === "string"
      ? rawValue.updatedAt
      : typeof rawValue.createdAt === "string"
        ? rawValue.createdAt
        : nowTimestamp();

  if (typeof rawValue.totalAmount === "number" && typeof rawValue.settlementAmount === "number") {
    const history = Array.isArray(rawValue.history)
      ? rawValue.history
          .map((entry) => {
            const activity = entry as Partial<SharedLoanActivityEntry>;
            return {
              id: activity.id ?? createId("shared-activity"),
              loanId: activity.loanId ?? id,
              action:
                activity.action === "created" ||
                activity.action === "updated" ||
                activity.action === "partial_payment" ||
                activity.action === "settled" ||
                activity.action === "reopened"
                  ? activity.action
                  : "updated",
              summary: typeof activity.summary === "string" && activity.summary.trim() ? activity.summary.trim() : "Actualizacion compartida",
              changedByUid: activity.changedByUid ?? "",
              changedByEmail: typeof activity.changedByEmail === "string" ? normalizeEmail(activity.changedByEmail) : "",
              changedAt: typeof activity.changedAt === "string" ? activity.changedAt : fallbackUpdatedAt
            } satisfies SharedLoanActivityEntry;
          })
          .sort((left, right) => right.changedAt.localeCompare(left.changedAt))
      : [];

    return {
      id,
      title: typeof rawValue.title === "string" && rawValue.title.trim() ? rawValue.title.trim() : "Gasto compartido",
      lenderUid: rawValue.lenderUid ?? "",
      lenderEmail: typeof rawValue.lenderEmail === "string" ? normalizeEmail(rawValue.lenderEmail) : "",
      borrowerUid: rawValue.borrowerUid ?? "",
      borrowerEmail: typeof rawValue.borrowerEmail === "string" ? normalizeEmail(rawValue.borrowerEmail) : "",
      splitType: rawValue.splitType === "full_amount" ? "full_amount" : "equal_split",
      totalAmount: rawValue.totalAmount,
      originalSettlementAmount:
        typeof rawValue.originalSettlementAmount === "number" ? rawValue.originalSettlementAmount : rawValue.settlementAmount,
      settlementAmount: rawValue.settlementAmount,
      notes: typeof rawValue.notes === "string" ? rawValue.notes : "",
      createdAt: typeof rawValue.createdAt === "string" ? rawValue.createdAt : fallbackUpdatedAt,
      updatedAt: fallbackUpdatedAt,
      createdByUid: rawValue.createdByUid ?? rawValue.lenderUid ?? "",
      createdByEmail:
        typeof rawValue.createdByEmail === "string" ? normalizeEmail(rawValue.createdByEmail) : typeof rawValue.lenderEmail === "string" ? normalizeEmail(rawValue.lenderEmail) : "",
      lastEditedByUid: rawValue.lastEditedByUid ?? rawValue.lenderUid ?? "",
      lastEditedByEmail:
        typeof rawValue.lastEditedByEmail === "string"
          ? normalizeEmail(rawValue.lastEditedByEmail)
          : typeof rawValue.createdByEmail === "string"
            ? normalizeEmail(rawValue.createdByEmail)
            : typeof rawValue.lenderEmail === "string"
              ? normalizeEmail(rawValue.lenderEmail)
              : "",
      lastEditedAt: typeof rawValue.lastEditedAt === "string" ? rawValue.lastEditedAt : fallbackUpdatedAt,
      isCompleted: Boolean(rawValue.isCompleted),
      history
    };
  }

  const legacyTotalAmount =
    typeof legacySource.principalRemaining === "number" && legacySource.principalRemaining > 0
      ? legacySource.principalRemaining
      : typeof legacySource.principalAmount === "number" && legacySource.principalAmount > 0
        ? legacySource.principalAmount
        : typeof legacySource.amount === "number"
          ? legacySource.amount
          : 0;

  const legacyHistory = Array.isArray(rawValue.history)
    ? rawValue.history
        .map((entry) => {
          const activity = entry as {
            paymentType?: string;
            amount?: number;
            recordedByUid?: string;
            recordedByEmail?: string;
            paidAt?: string;
          };
          const summary =
            activity.paymentType === "loan_extra_payment"
              ? `Registro heredado: refuerzo por ${activity.amount ?? 0} Gs.`
              : `Registro heredado: movimiento de cuota por ${activity.amount ?? 0} Gs.`;

          return normalizeLegacyHistoryEntry(
            id,
            activity.recordedByUid ?? rawValue.lenderUid ?? "",
            activity.recordedByEmail ?? (typeof rawValue.lenderEmail === "string" ? rawValue.lenderEmail : ""),
            activity.paidAt ?? fallbackUpdatedAt,
            summary
          );
        })
        .sort((left, right) => right.changedAt.localeCompare(left.changedAt))
    : [];

  return {
    id,
    title: typeof rawValue.title === "string" && rawValue.title.trim() ? rawValue.title.trim() : "Gasto compartido heredado",
    lenderUid: rawValue.lenderUid ?? "",
    lenderEmail: typeof rawValue.lenderEmail === "string" ? normalizeEmail(rawValue.lenderEmail) : "",
    borrowerUid: rawValue.borrowerUid ?? "",
    borrowerEmail: typeof rawValue.borrowerEmail === "string" ? normalizeEmail(rawValue.borrowerEmail) : "",
    splitType: "full_amount",
    totalAmount: legacyTotalAmount,
    originalSettlementAmount: legacyTotalAmount,
    settlementAmount: legacyTotalAmount,
    notes: typeof rawValue.notes === "string" ? rawValue.notes : "",
    createdAt: typeof rawValue.createdAt === "string" ? rawValue.createdAt : fallbackUpdatedAt,
    updatedAt: fallbackUpdatedAt,
    createdByUid: rawValue.lenderUid ?? "",
    createdByEmail: typeof rawValue.lenderEmail === "string" ? normalizeEmail(rawValue.lenderEmail) : "",
    lastEditedByUid: legacyHistory[0]?.changedByUid ?? rawValue.lenderUid ?? "",
    lastEditedByEmail:
      legacyHistory[0]?.changedByEmail ?? (typeof rawValue.lenderEmail === "string" ? normalizeEmail(rawValue.lenderEmail) : ""),
    lastEditedAt: legacyHistory[0]?.changedAt ?? fallbackUpdatedAt,
    isCompleted: Boolean(rawValue.isCompleted),
    history:
      legacyHistory.length > 0
        ? legacyHistory
        : [
            normalizeLegacyHistoryEntry(
              id,
              rawValue.lenderUid ?? "",
              typeof rawValue.lenderEmail === "string" ? rawValue.lenderEmail : "",
              fallbackUpdatedAt,
              "Registro heredado migrado desde el formato anterior."
            )
          ]
  };
}

export function sortSharedLoans(left: SharedLoan, right: SharedLoan) {
  if (left.isCompleted !== right.isCompleted) return left.isCompleted ? 1 : -1;
  return right.updatedAt.localeCompare(left.updatedAt);
}

export function getSharedLoanCounterpartyEmail(loan: SharedLoan, currentUserEmail: string | null) {
  const normalizedCurrentUserEmail = normalizeEmail(currentUserEmail ?? "");
  return loan.lenderEmail === normalizedCurrentUserEmail ? loan.borrowerEmail : loan.lenderEmail;
}

export function isSharedLoanEditable(loan: SharedLoan, currentUserEmail: string | null) {
  const normalizedCurrentUserEmail = normalizeEmail(currentUserEmail ?? "");
  return normalizedCurrentUserEmail === loan.lenderEmail || normalizedCurrentUserEmail === loan.borrowerEmail;
}

export function getSharedLoanRoleLabel(loan: SharedLoan, currentUserEmail: string | null) {
  return loan.lenderEmail === normalizeEmail(currentUserEmail ?? "") ? "Me deben" : "Debo";
}

export function getSharedLoanSplitLabel(loan: SharedLoan) {
  return loan.splitType === "equal_split" ? "Mitades" : "Monto completo";
}

export function getSharedLoanPayerLabel(loan: SharedLoan, currentUserEmail: string | null) {
  return loan.lenderEmail === normalizeEmail(currentUserEmail ?? "") ? "Tu pagaste" : `${loan.lenderEmail} pago`;
}

export function getSharedLoanSummary(loan: SharedLoan, currentUserEmail: string | null) {
  const currentUserIsPayer = loan.lenderEmail === normalizeEmail(currentUserEmail ?? "");
  if (loan.splitType === "equal_split") {
    return currentUserIsPayer ? "Pagaste y se dividio a partes iguales." : "La otra persona pago y se dividio a partes iguales.";
  }

  return currentUserIsPayer ? "La otra persona te debe la cantidad total." : `Tu debes la cantidad total a ${loan.lenderEmail}.`;
}

export function getSharedLoanDraftFromItem(loan: SharedLoan, currentUserEmail: string | null): SharedLoanDraft {
  return {
    counterpartyEmail: getSharedLoanCounterpartyEmail(loan, currentUserEmail),
    title: loan.title,
    totalAmount: String(loan.totalAmount),
    splitMode: getDraftModeFromLoan(loan, currentUserEmail),
    notes: loan.notes
  };
}

export function updateSharedLoanFromDraft(
  loan: SharedLoan,
  draft: SharedLoanDraft,
  actor: SharedActor
): SharedLoan {
  const actorEmail = normalizeEmail(actor.userEmail);
  const counterpartyEmail = normalizeEmail(draft.counterpartyEmail);
  const totalAmount = parseAmount(draft.totalAmount);
  const splitType = getSplitTypeFromDraftMode(draft.splitMode);
  const payerEmail = isCurrentUserPayer(draft.splitMode) ? actorEmail : counterpartyEmail;
  const participantEmail = payerEmail === actorEmail ? counterpartyEmail : actorEmail;
  const timestamp = nowTimestamp();
  const nextOriginalSettlementAmount = getSettlementAmount(totalAmount, splitType);
  const paidAmount = getPaidAmountFromLoan(loan);
  const nextRemainingSettlementAmount = clampAmount(
    nextOriginalSettlementAmount - paidAmount,
    0,
    nextOriginalSettlementAmount
  );

  const updatedLoan: SharedLoan = {
    ...loan,
    title: draft.title.trim(),
    lenderEmail: payerEmail,
    borrowerEmail: participantEmail,
    splitType,
    totalAmount,
    originalSettlementAmount: nextOriginalSettlementAmount,
    settlementAmount: nextRemainingSettlementAmount,
    notes: draft.notes.trim(),
    updatedAt: timestamp,
    lastEditedByUid: actor.userId,
    lastEditedByEmail: actorEmail,
    lastEditedAt: timestamp,
    isCompleted: nextRemainingSettlementAmount <= 0
  };

  return {
    ...updatedLoan,
    history: [
      buildActivityEntry(updatedLoan.id, actor, "updated", "Actualizo el gasto compartido."),
      ...loan.history
    ].sort((left, right) => right.changedAt.localeCompare(left.changedAt))
  };
}

export function toggleSharedLoanCompleted(loan: SharedLoan, actor: SharedActor) {
  const nextCompleted = !loan.isCompleted;
  const timestamp = nowTimestamp();
  const nextSettlementAmount = nextCompleted ? 0 : loan.originalSettlementAmount;

  return {
    ...loan,
    settlementAmount: nextSettlementAmount,
    isCompleted: nextCompleted,
    updatedAt: timestamp,
    lastEditedByUid: actor.userId,
    lastEditedByEmail: normalizeEmail(actor.userEmail),
    lastEditedAt: timestamp,
    history: [
      buildActivityEntry(
        loan.id,
        actor,
        nextCompleted ? "settled" : "reopened",
        nextCompleted ? "Marco el gasto como saldado." : "Reabrio el gasto compartido desde el monto original."
      ),
      ...loan.history
    ].sort((left, right) => right.changedAt.localeCompare(left.changedAt))
  } satisfies SharedLoan;
}

export function registerSharedLoanPartialPayment(loan: SharedLoan, amount: number, actor: SharedActor) {
  const normalizedAmount = clampAmount(Math.round(amount), 0, loan.settlementAmount);
  if (normalizedAmount <= 0) return loan;

  const nextRemainingAmount = clampAmount(loan.settlementAmount - normalizedAmount, 0, loan.originalSettlementAmount);
  const timestamp = nowTimestamp();

  return {
    ...loan,
    settlementAmount: nextRemainingAmount,
    isCompleted: nextRemainingAmount <= 0,
    updatedAt: timestamp,
    lastEditedByUid: actor.userId,
    lastEditedByEmail: normalizeEmail(actor.userEmail),
    lastEditedAt: timestamp,
    history: [
      buildActivityEntry(
        loan.id,
        actor,
        "partial_payment",
        `Registro un abono de ${formatCurrency(normalizedAmount)}. Restan ${formatCurrency(nextRemainingAmount)}.`
      ),
      ...loan.history
    ].sort((left, right) => right.changedAt.localeCompare(left.changedAt))
  } satisfies SharedLoan;
}

export function getSharedLoanOriginalSettlementAmount(loan: SharedLoan) {
  return loan.originalSettlementAmount;
}

export function getSharedLoanSettlementAmount(loan: SharedLoan) {
  return loan.settlementAmount;
}

export function getSharedLoanPaidAmount(loan: SharedLoan) {
  return getPaidAmountFromLoan(loan);
}
