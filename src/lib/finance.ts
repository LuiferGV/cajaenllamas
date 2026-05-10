import type {
  EntryKind,
  FinanceDraft,
  FinanceItem,
  FinanceState,
  LoanInstallmentDraftEntry,
  LoanInstallmentPlanEntry,
  LoanPlanMode,
  PaymentHistoryEntry,
  Recurrence
} from "../types";

interface SegmentMetrics {
  paidAmount: number;
  pendingAmount: number;
  monthlyBase: number;
  activeCount: number;
  overdueCount: number;
}

interface LoanMetrics extends SegmentMetrics {
  completedCount: number;
  paidInstallments: number;
  totalInstallments: number;
  remainingInstallments: number;
}

export interface DashboardMetrics {
  overview: SegmentMetrics;
  loans: LoanMetrics;
  fixedExpenses: SegmentMetrics;
  variableExpenses: SegmentMetrics;
}

export const RECURRENCE_OPTIONS: Array<{ value: Recurrence; label: string; months: number }> = [
  { value: "monthly", label: "Mensual", months: 1 },
  { value: "bimonthly", label: "Bimestral", months: 2 },
  { value: "quarterly", label: "Trimestral", months: 3 },
  { value: "semiannual", label: "Semestral", months: 6 },
  { value: "annual", label: "Anual", months: 12 }
];

export const KIND_OPTIONS: Array<{ value: EntryKind; label: string }> = [
  { value: "loan", label: "Prestamo" },
  { value: "variable_expense", label: "Gasto variable" },
  { value: "fixed_expense", label: "Gasto fijo" }
];

export function getKindTheme(kind: EntryKind) {
  if (kind === "loan") return "loan" as const;
  if (kind === "fixed_expense") return "fixed" as const;
  return "variable" as const;
}

export const EMPTY_STATE: FinanceState = {
  items: [],
  history: []
};

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayKey() {
  return formatDateKey(new Date());
}

export function createEmptyDraft(): FinanceDraft {
  return {
    entityName: "",
    conceptName: "",
    kind: "fixed_expense",
    amount: "",
    recurrence: "monthly",
    dueDate: todayKey(),
    notes: "",
    installmentsTotal: "",
    installmentsPaid: "0",
    currentInstallmentNumber: "1",
    loanPlanMode: "fixed",
    installmentPlan: [],
    historicalPaymentsCount: "0",
    registerCurrentCycleAsPaid: "no",
    currentCyclePaidAt: todayKey()
  };
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parseDateKey(value));
}

export function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("es-PY", {
    month: "long",
    year: "numeric"
  }).format(parseDateKey(value));
}

export function getRecurrenceLabel(recurrence: Recurrence) {
  return RECURRENCE_OPTIONS.find((option) => option.value === recurrence)?.label ?? recurrence;
}

export function getKindLabel(kind: EntryKind) {
  return KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export function buildDisplayName(entityName: string, conceptName: string) {
  const entity = entityName.trim();
  const concept = conceptName.trim();

  if (entity && concept) return `${concept} - ${entity}`;
  return concept || entity || "Registro sin nombre";
}

type DisplayEntry = {
  name?: string;
  itemName?: string;
  entityName: string;
  conceptName: string;
};

export function getDisplayTitle(entry: DisplayEntry) {
  return entry.conceptName.trim() || entry.name?.trim() || entry.itemName?.trim() || "Registro sin nombre";
}

export function getDisplayEntity(entry: Pick<DisplayEntry, "name" | "itemName" | "entityName">) {
  return entry.entityName.trim() || entry.name?.trim() || entry.itemName?.trim() || "Registro";
}

export function parseAmount(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

export function parseCount(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

export function parseLoanPlanMode(value: string | undefined): LoanPlanMode {
  return value === "schedule" ? "schedule" : "fixed";
}

export function sanitizeInstallmentPlanEntries(
  entries: Array<LoanInstallmentDraftEntry | LoanInstallmentPlanEntry> | null | undefined
) {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => ({
      installmentNumber:
        typeof entry.installmentNumber === "number" ? entry.installmentNumber : parseCount(String(entry.installmentNumber ?? "")),
      dueDate: typeof entry.dueDate === "string" ? entry.dueDate : "",
      amount:
        typeof entry.amount === "number" ? String(entry.amount) : typeof entry.amount === "string" ? entry.amount : ""
    }))
    .filter((entry) => entry.installmentNumber > 0)
    .sort((left, right) => left.installmentNumber - right.installmentNumber);
}

export function toLoanInstallmentPlanEntries(entries: LoanInstallmentDraftEntry[]) {
  return sanitizeInstallmentPlanEntries(entries)
    .map((entry) => ({
      installmentNumber: entry.installmentNumber,
      dueDate: entry.dueDate,
      amount: parseAmount(entry.amount)
    }))
    .filter((entry) => entry.amount > 0 && Boolean(entry.dueDate))
    .sort((left, right) => left.installmentNumber - right.installmentNumber);
}

export function generateInstallmentPlanDraft(
  totalInstallments: number,
  currentInstallmentNumber: number,
  currentDueDate: string,
  defaultAmount: string,
  existingEntries: LoanInstallmentDraftEntry[] = []
) {
  if (totalInstallments <= 0 || currentInstallmentNumber <= 0 || !currentDueDate) return [];

  const existingByInstallment = new Map(
    sanitizeInstallmentPlanEntries(existingEntries).map((entry) => [entry.installmentNumber, entry] as const)
  );

  return Array.from({ length: totalInstallments }, (_, index) => {
    const installmentNumber = index + 1;
    const generatedDueDate = shiftCycleDate(currentDueDate, "monthly", installmentNumber - currentInstallmentNumber);
    const existingEntry = existingByInstallment.get(installmentNumber);

    return {
      installmentNumber,
      dueDate: existingEntry?.dueDate || generatedDueDate,
      amount: existingEntry?.amount || defaultAmount
    } satisfies LoanInstallmentDraftEntry;
  });
}

export function isLoan(item: Pick<FinanceItem, "kind">) {
  return item.kind === "loan";
}

export function isExpense(item: Pick<FinanceItem, "kind">) {
  return item.kind === "fixed_expense" || item.kind === "variable_expense";
}

export function buildItemFromDraft(
  draft: FinanceDraft,
  itemId?: string,
  previous?: FinanceItem,
  options?: { mode?: "create" | "edit" }
): FinanceItem {
  const now = todayKey();
  const installmentsTotal = draft.kind === "loan" ? parseCount(draft.installmentsTotal) : null;
  const loanPlanMode = draft.kind === "loan" ? draft.loanPlanMode : "fixed";
  const installmentsPaid =
    draft.kind === "loan"
      ? options?.mode === "create"
        ? Math.max(parseCount(draft.currentInstallmentNumber) - 1, 0)
        : parseCount(draft.installmentsPaid)
      : 0;
  const entityName = draft.entityName.trim();
  const conceptName = draft.conceptName.trim();
  const installmentPlan =
    draft.kind === "loan" && loanPlanMode === "schedule" ? toLoanInstallmentPlanEntries(draft.installmentPlan) : null;
  const currentScheduledInstallment =
    installmentPlan && installmentPlan.length > 0 ? installmentPlan[installmentsPaid] ?? null : null;
  const amount =
    draft.kind === "loan" && loanPlanMode === "schedule"
      ? currentScheduledInstallment?.amount ?? parseAmount(draft.amount)
      : parseAmount(draft.amount);
  const isCompleted =
    draft.kind === "loan"
      ? installmentsTotal !== null && (installmentsPaid >= installmentsTotal || (loanPlanMode === "schedule" && !currentScheduledInstallment))
      : false;
  const dueDate =
    draft.kind === "loan" && loanPlanMode === "schedule"
      ? isCompleted
        ? null
        : currentScheduledInstallment?.dueDate ?? draft.dueDate
      : isCompleted
        ? null
        : draft.dueDate;

  return {
    id: itemId ?? previous?.id ?? createId("item"),
    name: buildDisplayName(entityName, conceptName),
    entityName,
    conceptName,
    kind: draft.kind,
    amount,
    recurrence: draft.kind === "loan" ? "monthly" : draft.recurrence,
    dueDate,
    notes: draft.notes.trim(),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    lastPaidAt: previous?.lastPaidAt ?? null,
    installmentsTotal,
    installmentsPaid,
    loanPlanMode,
    installmentPlan,
    isCompleted
  };
}

export function draftFromItem(item: FinanceItem): FinanceDraft {
  const nextInstallmentNumber = item.kind === "loan" ? getCurrentInstallmentNumber(item) ?? 1 : 1;

  return {
    entityName: item.entityName,
    conceptName: item.conceptName || item.name,
    kind: item.kind,
    amount: String(item.amount),
    recurrence: item.recurrence,
    dueDate: item.dueDate ?? todayKey(),
    notes: item.notes,
    installmentsTotal: item.installmentsTotal ? String(item.installmentsTotal) : "",
    installmentsPaid: String(item.installmentsPaid),
    currentInstallmentNumber: String(nextInstallmentNumber),
    loanPlanMode: item.loanPlanMode ?? "fixed",
    installmentPlan:
      item.installmentPlan?.map((entry) => ({
        installmentNumber: entry.installmentNumber,
        dueDate: entry.dueDate,
        amount: String(entry.amount)
      })) ?? [],
    historicalPaymentsCount: "0",
    registerCurrentCycleAsPaid: "no",
    currentCyclePaidAt: todayKey()
  };
}

export function validateDraft(draft: FinanceDraft) {
  if (!draft.entityName.trim()) return "Escribe la empresa o entidad.";
  if (!draft.conceptName.trim()) {
    return draft.kind === "loan" ? "Escribe el tipo o destino del prestamo." : "Escribe el tipo de gasto.";
  }
  if (parseAmount(draft.amount) <= 0) return "El monto debe ser mayor a cero.";
  if (draft.registerCurrentCycleAsPaid === "yes" && !draft.currentCyclePaidAt) {
    return "Selecciona la fecha del pago ya realizado.";
  }

  if (draft.kind === "loan") {
    const totalInstallments = parseCount(draft.installmentsTotal);
    const paidInstallments = parseCount(draft.installmentsPaid);
    const currentInstallmentNumber = parseCount(draft.currentInstallmentNumber);
    const installmentPlan = sanitizeInstallmentPlanEntries(draft.installmentPlan);

    if (totalInstallments <= 0) return "Indica cuantas cuotas tiene el prestamo.";
    if (currentInstallmentNumber <= 0) return "Indica que numero de cuota vas a cargar.";
    if (currentInstallmentNumber > totalInstallments) return "La cuota actual no puede superar el total de cuotas.";
    if (paidInstallments > totalInstallments) return "Las cuotas pagadas no pueden superar el total.";
    if (draft.loanPlanMode === "schedule") {
      if (!draft.dueDate) return "Selecciona la fecha de la cuota actual para generar el cuotero.";
      if (installmentPlan.length !== totalInstallments) return "Genera el cuotero completo antes de guardar.";

      for (let index = 0; index < installmentPlan.length; index += 1) {
        const entry = installmentPlan[index];
        if (entry.installmentNumber !== index + 1) {
          return "El cuotero debe tener todas las cuotas en orden, del 1 hasta el total.";
        }

        if (!entry.dueDate) {
          return `Completa la fecha de la cuota ${entry.installmentNumber}.`;
        }

        if (parseAmount(entry.amount) <= 0) {
          return `Completa el monto de la cuota ${entry.installmentNumber}.`;
        }
      }

      return null;
    }

    if (paidInstallments < totalInstallments && !draft.dueDate) {
      return "Selecciona la fecha de la proxima cuota.";
    }

    return null;
  }

  if (!draft.dueDate) return "Selecciona una fecha de vencimiento.";
  return null;
}

export function shiftCycleDate(currentDate: string, recurrence: Recurrence, cyclesOffset: number) {
  const monthsOffset = recurrenceMonths(recurrence) * cyclesOffset;
  return formatDateKey(addMonthsKeepingAnchor(parseDateKey(currentDate), monthsOffset));
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

export function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recurrenceMonths(recurrence: Recurrence) {
  return RECURRENCE_OPTIONS.find((option) => option.value === recurrence)?.months ?? 1;
}

function addMonthsKeepingAnchor(input: Date, monthsToAdd: number) {
  const anchorDay = input.getDate();
  const firstTargetDay = new Date(input.getFullYear(), input.getMonth() + monthsToAdd, 1, 12, 0, 0, 0);
  const lastTargetDay = new Date(
    firstTargetDay.getFullYear(),
    firstTargetDay.getMonth() + 1,
    0,
    12,
    0,
    0,
    0
  ).getDate();

  return new Date(
    firstTargetDay.getFullYear(),
    firstTargetDay.getMonth(),
    Math.min(anchorDay, lastTargetDay),
    12,
    0,
    0,
    0
  );
}

export function getNextDueDate(currentDueDate: string, recurrence: Recurrence, paidAt: string) {
  const paidDate = parseDateKey(paidAt);
  let candidate = parseDateKey(currentDueDate);

  // Preserve the original billing day and keep advancing until the next due date is truly after the payment date.
  do {
    candidate = addMonthsKeepingAnchor(candidate, recurrenceMonths(recurrence));
  } while (candidate.getTime() <= paidDate.getTime());

  return formatDateKey(candidate);
}

export function getRemainingInstallments(item: FinanceItem) {
  if (!isLoan(item) || item.installmentsTotal === null) return null;
  return Math.max(item.installmentsTotal - item.installmentsPaid, 0);
}

export function getCurrentInstallmentNumber(item: FinanceItem) {
  if (!isLoan(item) || item.installmentsTotal === null) return null;
  if (item.installmentsTotal <= 0) return null;
  if (item.isCompleted) return item.installmentsTotal;

  return Math.min(item.installmentsPaid + 1, item.installmentsTotal);
}

export function hasScheduledLoanPlan(item: FinanceItem) {
  return isLoan(item) && item.loanPlanMode === "schedule" && Array.isArray(item.installmentPlan) && item.installmentPlan.length > 0;
}

export function getCurrentScheduledInstallment(item: FinanceItem) {
  if (!hasScheduledLoanPlan(item)) return null;
  return item.installmentPlan?.[item.installmentsPaid] ?? null;
}

export function getInstallmentsAfterCurrent(item: FinanceItem) {
  const currentInstallmentNumber = getCurrentInstallmentNumber(item);
  if (currentInstallmentNumber === null || item.installmentsTotal === null) return null;
  if (item.isCompleted) return 0;

  return Math.max(item.installmentsTotal - currentInstallmentNumber, 0);
}

export function registerPayment(state: FinanceState, itemId: string, paidAt = todayKey()): FinanceState {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || item.isCompleted) return state;

  const currentScheduledInstallment =
    isLoan(item) && item.loanPlanMode === "schedule" && item.installmentPlan?.length
      ? item.installmentPlan[item.installmentsPaid] ?? null
      : null;
  const currentDueDate = currentScheduledInstallment?.dueDate ?? item.dueDate ?? paidAt;
  const currentAmount = currentScheduledInstallment?.amount ?? item.amount;
  const nextInstallmentsPaid = isLoan(item) ? item.installmentsPaid + 1 : item.installmentsPaid;
  const nextScheduledInstallment =
    isLoan(item) && item.loanPlanMode === "schedule" && item.installmentPlan?.length
      ? item.installmentPlan[nextInstallmentsPaid] ?? null
      : null;
  const completesLoan =
    isLoan(item) && item.installmentsTotal !== null
      ? nextInstallmentsPaid >= item.installmentsTotal || (item.loanPlanMode === "schedule" && !nextScheduledInstallment)
      : false;
  const nextDueDate =
    item.loanPlanMode === "schedule"
      ? completesLoan
        ? null
        : nextScheduledInstallment?.dueDate ?? null
      : completesLoan
        ? null
        : getNextDueDate(currentDueDate, item.recurrence, paidAt);
  const installmentNumber = isLoan(item) ? nextInstallmentsPaid : null;

  const payment: PaymentHistoryEntry = {
    id: createId("payment"),
    itemId: item.id,
    itemName: item.name,
    entityName: item.entityName,
    conceptName: item.conceptName,
    kind: item.kind,
    amount: currentAmount,
    recurrence: item.recurrence,
    paidAt,
    coveredDueDate: currentDueDate,
    nextDueDate,
    installmentNumber,
    installmentsTotal: item.installmentsTotal
  };

  return {
    items: state.items
      .map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              amount: item.loanPlanMode === "schedule" ? nextScheduledInstallment?.amount ?? entry.amount : entry.amount,
              dueDate: nextDueDate,
              updatedAt: paidAt,
              lastPaidAt: paidAt,
              installmentsPaid: nextInstallmentsPaid,
              isCompleted: completesLoan
            }
          : entry
      )
      .sort(sortItems),
    history: [payment, ...state.history].sort((left, right) => right.paidAt.localeCompare(left.paidAt))
  };
}

function createHistoricalPaymentEntry(
  item: FinanceItem,
  coveredDueDate: string,
  nextDueDate: string | null,
  paidAt: string,
  installmentNumber: number | null,
  amount: number
): PaymentHistoryEntry {
  return {
    id: createId("payment"),
    itemId: item.id,
    itemName: item.name,
    entityName: item.entityName,
    conceptName: item.conceptName,
    kind: item.kind,
    amount,
    recurrence: item.recurrence,
    paidAt,
    coveredDueDate,
    nextDueDate,
    installmentNumber,
    installmentsTotal: item.installmentsTotal
  };
}

export function buildInitialHistoryEntries(item: FinanceItem, draft: FinanceDraft): PaymentHistoryEntry[] {
  const expenseHistoricalCount = item.kind === "loan" ? 0 : parseCount(draft.historicalPaymentsCount);
  const loanHistoricalCount = item.kind === "loan" ? Math.max(parseCount(draft.currentInstallmentNumber) - 1, 0) : 0;
  const historicalCount = item.kind === "loan" ? loanHistoricalCount : expenseHistoricalCount;

  if (historicalCount <= 0 || !draft.dueDate) return [];

  if (item.kind === "loan" && item.loanPlanMode === "schedule" && item.installmentPlan?.length) {
    return item.installmentPlan
      .filter((entry) => entry.installmentNumber <= historicalCount)
      .map((entry, index, entries) => {
        const nextPlanEntry = entries[index + 1] ?? item.installmentPlan?.[entry.installmentNumber] ?? null;

        return createHistoricalPaymentEntry(
          item,
          entry.dueDate,
          nextPlanEntry?.dueDate ?? null,
          entry.dueDate,
          entry.installmentNumber,
          entry.amount
        );
      });
  }

  return Array.from({ length: historicalCount }, (_, index) => {
    const cyclesBack = index + 1;
    const coveredDueDate = shiftCycleDate(draft.dueDate, item.recurrence, -cyclesBack);
    const nextDueDate = shiftCycleDate(coveredDueDate, item.recurrence, 1);
    const installmentNumber = item.kind === "loan" ? historicalCount - index : null;

    return createHistoricalPaymentEntry(
      item,
      coveredDueDate,
      nextDueDate,
      coveredDueDate,
      installmentNumber,
      item.amount
    );
  });
}

export function seedInitialHistory(state: FinanceState, item: FinanceItem, draft: FinanceDraft): FinanceState {
  const seededHistory = buildInitialHistoryEntries(item, draft);
  if (seededHistory.length === 0) return state;

  return {
    ...state,
    history: [...seededHistory, ...state.history].sort((left, right) => right.paidAt.localeCompare(left.paidAt))
  };
}

export function deleteItem(state: FinanceState, itemId: string): FinanceState {
  return {
    items: state.items.filter((entry) => entry.id !== itemId),
    history: state.history.filter((entry) => entry.itemId !== itemId)
  };
}

export function upsertItem(state: FinanceState, item: FinanceItem) {
  const exists = state.items.some((entry) => entry.id === item.id);

  return {
    ...state,
    items: (exists
      ? state.items.map((entry) => (entry.id === item.id ? item : entry))
      : [item, ...state.items]
    ).sort(sortItems)
  };
}

export function sortItems(left: FinanceItem, right: FinanceItem) {
  if (left.isCompleted !== right.isCompleted) {
    return left.isCompleted ? 1 : -1;
  }

  const leftDue = left.dueDate ?? "9999-12-31";
  const rightDue = right.dueDate ?? "9999-12-31";
  const dateCompare = leftDue.localeCompare(rightDue);
  if (dateCompare !== 0) return dateCompare;
  return left.name.localeCompare(right.name);
}

export function isDateInCurrentMonth(dateKey: string, baseDate = new Date()) {
  const date = parseDateKey(dateKey);
  return date.getFullYear() === baseDate.getFullYear() && date.getMonth() === baseDate.getMonth();
}

export function getCurrentMonthRange(baseDate = new Date()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 12, 0, 0, 0);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 12, 0, 0, 0);

  return {
    start: formatDateKey(start),
    end: formatDateKey(end)
  };
}

function getActiveItems(items: FinanceItem[]) {
  return items.filter((item) => !item.isCompleted);
}

export function getMonthlyCommitment(items: FinanceItem[]) {
  return getActiveItems(items).reduce((sum, item) => sum + item.amount / recurrenceMonths(item.recurrence), 0);
}

export function getPendingThisMonth(items: FinanceItem[], baseDate = new Date()) {
  const { end } = getCurrentMonthRange(baseDate);
  return getActiveItems(items)
    .filter((item) => item.dueDate !== null && item.dueDate <= end)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function getPaidThisMonth(history: PaymentHistoryEntry[], baseDate = new Date()) {
  return history
    .filter((payment) => isDateInCurrentMonth(payment.paidAt, baseDate))
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function getOverdueAmount(items: FinanceItem[], baseDate = new Date()) {
  const today = formatDateKey(baseDate);
  return getActiveItems(items)
    .filter((item) => item.dueDate !== null && item.dueDate < today)
    .reduce((sum, item) => sum + item.amount, 0);
}

function getSegmentMetrics(state: FinanceState, kind: EntryKind, baseDate = new Date()): SegmentMetrics {
  const items = state.items.filter((item) => item.kind === kind);
  const history = state.history.filter((entry) => entry.kind === kind);
  const activeItems = getActiveItems(items);

  return {
    paidAmount: getPaidThisMonth(history, baseDate),
    pendingAmount: getPendingThisMonth(activeItems, baseDate),
    monthlyBase: getMonthlyCommitment(activeItems),
    activeCount: activeItems.length,
    overdueCount: activeItems.filter((item) => item.dueDate !== null && item.dueDate < formatDateKey(baseDate)).length
  };
}

export function getDashboardMetrics(state: FinanceState, baseDate = new Date()): DashboardMetrics {
  const loanItems = state.items.filter((item) => item.kind === "loan");
  const activeLoanItems = getActiveItems(loanItems);
  const loanMetricsBase = getSegmentMetrics(state, "loan", baseDate);

  return {
    overview: {
      paidAmount: getPaidThisMonth(state.history, baseDate),
      pendingAmount: getPendingThisMonth(state.items, baseDate),
      monthlyBase: getMonthlyCommitment(state.items),
      activeCount: getActiveItems(state.items).length,
      overdueCount: state.items.filter((item) => !item.isCompleted && item.dueDate !== null && item.dueDate < formatDateKey(baseDate)).length
    },
    loans: {
      ...loanMetricsBase,
      completedCount: loanItems.filter((item) => item.isCompleted).length,
      paidInstallments: loanItems.reduce((sum, item) => sum + item.installmentsPaid, 0),
      totalInstallments: loanItems.reduce((sum, item) => sum + (item.installmentsTotal ?? 0), 0),
      remainingInstallments: activeLoanItems.reduce(
        (sum, item) => sum + (getInstallmentsAfterCurrent(item) ?? 0),
        0
      )
    },
    fixedExpenses: getSegmentMetrics(state, "fixed_expense", baseDate),
    variableExpenses: getSegmentMetrics(state, "variable_expense", baseDate)
  };
}

export function describeItemStatus(item: FinanceItem, baseDate = todayKey()) {
  if (item.isCompleted) {
    return {
      tone: "success" as const,
      label: "Completado"
    };
  }

  if (item.dueDate === null) {
    return {
      tone: "calm" as const,
      label: "Sin fecha"
    };
  }

  if (item.dueDate < baseDate) {
    return {
      tone: "critical" as const,
      label: "Vencido"
    };
  }

  if (item.dueDate === baseDate) {
    return {
      tone: "today" as const,
      label: "Vence hoy"
    };
  }

  const currentMonthEnd = getCurrentMonthRange(parseDateKey(baseDate)).end;
  if (item.dueDate <= currentMonthEnd) {
    return {
      tone: "soon" as const,
      label: "Este mes"
    };
  }

  return {
    tone: "calm" as const,
    label: "Programado"
  };
}

export function filterItems(items: FinanceItem[], search: string, kind: EntryKind | "all") {
  const normalizedSearch = search.trim().toLowerCase();

  return items.filter((item) => {
    const kindMatches = kind === "all" ? true : item.kind === kind;
    if (!kindMatches) return false;

    if (!normalizedSearch) return true;

    const searchable =
      `${item.name} ${item.entityName} ${item.conceptName} ${item.notes} ${getKindLabel(item.kind)} ${getRecurrenceLabel(item.recurrence)}`.toLowerCase();
    return searchable.includes(normalizedSearch);
  });
}

export function getNextActiveItem(items: FinanceItem[]) {
  return items.find((item) => !item.isCompleted && item.dueDate !== null) ?? null;
}

export function getCompletionRatio(metrics: LoanMetrics) {
  if (metrics.totalInstallments === 0) return 0;
  return Math.min(metrics.paidInstallments / metrics.totalInstallments, 1);
}

export function getOverdueCount(items: FinanceItem[], baseDate = new Date()) {
  return getActiveItems(items).filter((item) => item.dueDate !== null && item.dueDate < formatDateKey(baseDate)).length;
}

export function getOverdueAmountForState(state: FinanceState, baseDate = new Date()) {
  return getOverdueAmount(state.items, baseDate);
}
