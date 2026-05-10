import { buildDisplayName, EMPTY_STATE, parseLoanPlanMode, sortItems, todayKey, toLoanInstallmentPlanEntries } from "./finance";
import type {
  EntryKind,
  FinanceItem,
  FinanceState,
  LoanInstallmentDraftEntry,
  LoanInstallmentPlanEntry,
  PaymentHistoryEntry,
  Recurrence
} from "../types";

const STORAGE_KEY = "finances.personal.v1";

function normalizeKind(kind: string | undefined): EntryKind {
  if (kind === "loan") return "loan";
  if (kind === "variable_expense") return "variable_expense";
  return "fixed_expense";
}

function normalizeRecurrence(recurrence: string | undefined): Recurrence {
  if (recurrence === "bimonthly") return "bimonthly";
  if (recurrence === "quarterly") return "quarterly";
  if (recurrence === "semiannual") return "semiannual";
  if (recurrence === "annual") return "annual";
  return "monthly";
}

function normalizeItem(rawItem: Partial<FinanceItem> & { kind?: string; recurrence?: string }): FinanceItem {
  const kind = normalizeKind(rawItem.kind);
  const installmentsTotal =
    kind === "loan" && typeof rawItem.installmentsTotal === "number" ? rawItem.installmentsTotal : null;
  const installmentsPaid = kind === "loan" && typeof rawItem.installmentsPaid === "number" ? rawItem.installmentsPaid : 0;
  const loanPlanMode = kind === "loan" ? parseLoanPlanMode(rawItem.loanPlanMode) : "fixed";
  const installmentPlan =
    kind === "loan" && Array.isArray(rawItem.installmentPlan)
      ? toLoanInstallmentPlanEntries(
          rawItem.installmentPlan.map((entry) => ({
            installmentNumber: entry.installmentNumber,
            dueDate: entry.dueDate,
            amount: String(entry.amount ?? "")
          })) as LoanInstallmentDraftEntry[]
        )
      : null;
  const currentScheduledInstallment =
    loanPlanMode === "schedule" && installmentPlan?.length ? installmentPlan[installmentsPaid] ?? null : null;
  const isCompleted =
    typeof rawItem.isCompleted === "boolean"
      ? rawItem.isCompleted
      : kind === "loan" && installmentsTotal !== null
        ? installmentsPaid >= installmentsTotal || (loanPlanMode === "schedule" && !currentScheduledInstallment)
        : false;

  const entityName =
    typeof rawItem.entityName === "string" && rawItem.entityName.trim() ? rawItem.entityName : rawItem.name ?? "Registro";
  const conceptName = typeof rawItem.conceptName === "string" ? rawItem.conceptName : "";

  return {
    id: rawItem.id ?? `legacy-item-${Math.random().toString(36).slice(2, 8)}`,
    name: buildDisplayName(entityName, conceptName),
    entityName,
    conceptName,
    kind,
    amount:
      kind === "loan" && loanPlanMode === "schedule"
        ? currentScheduledInstallment?.amount ?? (typeof rawItem.amount === "number" ? rawItem.amount : 0)
        : typeof rawItem.amount === "number"
          ? rawItem.amount
          : 0,
    recurrence: kind === "loan" ? "monthly" : normalizeRecurrence(rawItem.recurrence),
    dueDate:
      isCompleted
        ? null
        : kind === "loan" && loanPlanMode === "schedule"
          ? currentScheduledInstallment?.dueDate ?? rawItem.dueDate ?? todayKey()
          : rawItem.dueDate ?? todayKey(),
    notes: rawItem.notes ?? "",
    createdAt: rawItem.createdAt ?? todayKey(),
    updatedAt: rawItem.updatedAt ?? rawItem.createdAt ?? todayKey(),
    lastPaidAt: rawItem.lastPaidAt ?? null,
    installmentsTotal,
    installmentsPaid,
    loanPlanMode,
    installmentPlan,
    isCompleted
  };
}

function normalizeHistoryEntry(
  rawEntry: Partial<PaymentHistoryEntry> & { kind?: string; recurrence?: string }
): PaymentHistoryEntry {
  const entityName =
    typeof rawEntry.entityName === "string" && rawEntry.entityName.trim()
      ? rawEntry.entityName
      : rawEntry.itemName ?? "Registro";
  const conceptName = typeof rawEntry.conceptName === "string" ? rawEntry.conceptName : "";

  return {
    id: rawEntry.id ?? `legacy-payment-${Math.random().toString(36).slice(2, 8)}`,
    itemId: rawEntry.itemId ?? "",
    itemName: buildDisplayName(entityName, conceptName),
    entityName,
    conceptName,
    kind: normalizeKind(rawEntry.kind),
    amount: typeof rawEntry.amount === "number" ? rawEntry.amount : 0,
    recurrence: normalizeRecurrence(rawEntry.recurrence),
    paidAt: rawEntry.paidAt ?? todayKey(),
    coveredDueDate: rawEntry.coveredDueDate ?? null,
    nextDueDate: rawEntry.nextDueDate ?? null,
    installmentNumber: typeof rawEntry.installmentNumber === "number" ? rawEntry.installmentNumber : null,
    installmentsTotal: typeof rawEntry.installmentsTotal === "number" ? rawEntry.installmentsTotal : null
  };
}

export function normalizeFinanceState(parsed: Partial<FinanceState>): FinanceState {
  if (!Array.isArray(parsed.items) || !Array.isArray(parsed.history)) {
    return EMPTY_STATE;
  }

  return {
    items: parsed.items.map((item) => normalizeItem(item as Partial<FinanceItem>)).sort(sortItems),
    history: parsed.history
      .map((entry) => normalizeHistoryEntry(entry as Partial<PaymentHistoryEntry>))
      .sort((left, right) => right.paidAt.localeCompare(left.paidAt))
  };
}

export function loadFinanceState(): FinanceState {
  if (typeof window === "undefined") return EMPTY_STATE;

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return EMPTY_STATE;

    const parsed = JSON.parse(rawValue) as Partial<FinanceState>;
    return normalizeFinanceState(parsed);
  } catch (error) {
    console.error("No se pudo leer el almacenamiento local", error);
    return EMPTY_STATE;
  }
}

export function parseFinanceStateJson(rawValue: string): FinanceState {
  const parsed = JSON.parse(rawValue) as Partial<FinanceState>;
  return normalizeFinanceState(parsed);
}

export function exportFinanceStateJson(state: FinanceState) {
  return JSON.stringify(state, null, 2);
}

export function saveFinanceState(state: FinanceState) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
