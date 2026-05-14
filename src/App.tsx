import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import brandLogo from "../cajaenllamas.png";
import { AuthScreen } from "./components/AuthScreen";
import { CompanyLogo } from "./components/CompanyLogo";
import { DiscountCard } from "./components/DiscountCard";
import { DiscountForm } from "./components/DiscountForm";
import { ExpenseRow } from "./components/ExpenseRow";
import { FinanceForm } from "./components/FinanceForm";
import { HistoryPanel } from "./components/HistoryPanel";
import { MetricCard } from "./components/MetricCard";
import { useDiscountsData } from "./hooks/useDiscountsData";
import { useFinanceData } from "./hooks/useFinanceData";
import { useSharedLoansData } from "./hooks/useSharedLoansData";
import { useFirebaseSession, type AuthMode } from "./hooks/useFirebaseSession";
import { SharedLoanForm } from "./components/SharedLoanForm";
import { SharedLoanRow } from "./components/SharedLoanRow";
import {
  buildDiscountFromDraft,
  createEmptyDiscountDraft,
  DISCOUNT_CATEGORY_OPTIONS,
  getDiscountCategoryLabel,
  getDiscountCategoryTheme,
  getDiscountDraftFromItem,
  isDiscountExpiringSoon,
  validateDiscountDraft
} from "./lib/discounts";
import {
  buildItemFromDraft,
  createEmptyDraft,
  deleteItem,
  draftFromItem,
  filterItems,
  formatCurrency,
  formatDate,
  formatDateTime,
  generateInstallmentPlanDraft,
  getDashboardCategorySummaries,
  getCompletionRatio,
  getCurrentInstallmentNumber,
  getDashboardMetrics,
  getDisplayEntity,
  getDisplayTitle,
  getKindLabel,
  getKindTheme,
  getInstallmentsAfterCurrent,
  getLoanPrincipalAmount,
  getLoanPrincipalRemaining,
  getNextActiveItem,
  getRemainingInstallments,
  getRecurrenceLabel,
  isLoan,
  parseAmount,
  registerPayment,
  registerLoanExtraPayment,
  seedInitialHistory,
  todayKey,
  upsertItem,
  validateDraft
} from "./lib/finance";
import {
  buildSharedLoanFromDraft,
  createEmptySharedLoanDraft,
  getSharedLoanCounterpartyEmail,
  getSharedLoanDraftFromItem,
  getSharedLoanRoleLabel,
  getSharedLoanSettlementAmount,
  isSharedLoanEditable,
  registerSharedLoanPartialPayment,
  toggleSharedLoanCompleted,
  updateSharedLoanFromDraft,
  validateSharedLoanDraft
} from "./lib/sharedLoans";
import type { DiscountDraft, DiscountItem, EntryKind, FinanceDraft, FinanceItem, FinanceState, SharedLoan, SharedLoanDraft } from "./types";

type FormMode = "create" | "edit";
type SharedFormMode = "create" | "edit";
type DiscountFormMode = "create" | "edit";
type AppView = "overview" | "dashboard" | "history" | "shared" | "discounts";

const FILTER_OPTIONS: Array<{ value: EntryKind | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "loan", label: "Prestamos" },
  { value: "variable_expense", label: "Gastos variables" },
  { value: "fixed_expense", label: "Gastos fijos" },
  { value: "recurring_expense", label: "Gastos recurrentes" }
];

export default function App() {
  const { sessionState, userEmail, userId, authError, isSubmitting, login, register, logout } = useFirebaseSession();
  const { financeState, persistState } = useFinanceData(sessionState === "authenticated", userId);
  const { discounts, discountsState, discountsError, saveDiscount, deleteDiscount } = useDiscountsData(sessionState === "authenticated");
  const { sharedLoans, sharedLoansState, sharedLoansError, saveSharedLoan, deleteSharedLoan } = useSharedLoansData(
    sessionState === "authenticated",
    userEmail
  );
  const [draft, setDraft] = useState<FinanceDraft>(() => createEmptyDraft());
  const [discountDraft, setDiscountDraft] = useState<DiscountDraft>(() => createEmptyDiscountDraft());
  const [sharedLoanDraft, setSharedLoanDraft] = useState<SharedLoanDraft>(() => createEmptySharedLoanDraft());
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [discountFormMode, setDiscountFormMode] = useState<DiscountFormMode>("create");
  const [sharedFormMode, setSharedFormMode] = useState<SharedFormMode>("create");
  const [activeView, setActiveView] = useState<AppView>("overview");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [editingSharedLoanId, setEditingSharedLoanId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<EntryKind | "all">("all");
  const [discountFormError, setDiscountFormError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sharedLoanFormError, setSharedLoanFormError] = useState<string | null>(null);
  const [isSubmittingDiscount, setIsSubmittingDiscount] = useState(false);
  const [isSubmittingSharedLoan, setIsSubmittingSharedLoan] = useState(false);
  const [isSettlingAllShared, setIsSettlingAllShared] = useState(false);
  const [sharedCounterpartyFilter, setSharedCounterpartyFilter] = useState<string>("all");
  const [pendingDiscountDeleteId, setPendingDiscountDeleteId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingSharedDeleteId, setPendingSharedDeleteId] = useState<string | null>(null);
  const [isDiscountComposerOpen, setIsDiscountComposerOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSharedComposerOpen, setIsSharedComposerOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [manualAuthError, setManualAuthError] = useState<string | null>(null);
  const listRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (sessionState === "authenticated") {
      setManualAuthError(null);
      setLoginPassword("");
      setConfirmPassword("");
      setAuthMode("login");
    }
  }, [sessionState]);

  useEffect(() => {
    if (!isComposerOpen && !isSharedComposerOpen && !isDiscountComposerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isComposerOpen) {
          setIsComposerOpen(false);
          setDraft(createEmptyDraft());
          setFormMode("create");
          setEditingId(null);
          setFormError(null);
          setPendingDeleteId(null);
        }

        if (isSharedComposerOpen) {
          setIsSharedComposerOpen(false);
          setSharedLoanDraft(createEmptySharedLoanDraft());
          setSharedFormMode("create");
          setEditingSharedLoanId(null);
          setSharedLoanFormError(null);
          setIsSubmittingSharedLoan(false);
          setPendingSharedDeleteId(null);
        }

        if (isDiscountComposerOpen) {
          setIsDiscountComposerOpen(false);
          setDiscountDraft(createEmptyDiscountDraft());
          setDiscountFormMode("create");
          setEditingDiscountId(null);
          setDiscountFormError(null);
          setIsSubmittingDiscount(false);
          setPendingDiscountDeleteId(null);
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isComposerOpen, isDiscountComposerOpen, isSharedComposerOpen]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const filteredItems = filterItems(financeState.items, deferredSearchTerm, kindFilter);
  const metrics = getDashboardMetrics(financeState);
  const overdueCount = metrics.overview.overdueCount;
  const nextDueItem = getNextActiveItem(financeState.items);
  const activeLoanItems = financeState.items.filter((item) => item.kind === "loan" && !item.isCompleted);
  const activeVariableItems = financeState.items.filter((item) => item.kind === "variable_expense" && !item.isCompleted);
  const activeFixedItems = financeState.items.filter((item) => item.kind === "fixed_expense" && !item.isCompleted);
  const activeRecurringItems = financeState.items.filter((item) => item.kind === "recurring_expense" && !item.isCompleted);
  const categorySummaries = getDashboardCategorySummaries(financeState);
  const visibleCategorySummaries = categorySummaries.filter((summary) => summary.activeCount > 0);
  const loanCompletionRatio = getCompletionRatio(metrics.loans);
  const authScreenError = manualAuthError ?? authError;
  const activeSharedLoans = sharedLoans.filter((loan) => !loan.isCompleted);
  const visibleSharedLoans =
    sharedCounterpartyFilter === "all"
      ? sharedLoans
      : sharedLoans.filter((loan) => getSharedLoanCounterpartyEmail(loan, userEmail) === sharedCounterpartyFilter);
  const sharedCounterpartySummaries = Array.from(
    sharedLoans.reduce((map, loan) => {
      const counterpartEmail = getSharedLoanCounterpartyEmail(loan, userEmail);
      const roleLabel = getSharedLoanRoleLabel(loan, userEmail);
      const settlementAmount = getSharedLoanSettlementAmount(loan);
      const current = map.get(counterpartEmail) ?? {
        email: counterpartEmail,
        activeCount: 0,
        completedCount: 0,
        theyOweMe: 0,
        iOwe: 0
      };

      if (loan.isCompleted) {
        current.completedCount += 1;
      } else {
        current.activeCount += 1;
        if (roleLabel === "Me deben") {
          current.theyOweMe += settlementAmount;
        } else {
          current.iOwe += settlementAmount;
        }
      }

      map.set(counterpartEmail, current);
      return map;
    }, new Map<string, { email: string; activeCount: number; completedCount: number; theyOweMe: number; iOwe: number }>())
  )
    .map(([, value]) => value)
    .sort((left, right) => {
      const amountDiff = right.theyOweMe + right.iOwe - (left.theyOweMe + left.iOwe);
      if (amountDiff !== 0) return amountDiff;
      if (right.activeCount !== left.activeCount) return right.activeCount - left.activeCount;
      if (right.completedCount !== left.completedCount) return right.completedCount - left.completedCount;
      return left.email.localeCompare(right.email);
    });
  const sharedAllLentTotal = sharedCounterpartySummaries.reduce((sum, summary) => sum + summary.theyOweMe, 0);
  const sharedAllBorrowedTotal = sharedCounterpartySummaries.reduce((sum, summary) => sum + summary.iOwe, 0);
  const selectedCounterpartySummary =
    sharedCounterpartyFilter === "all"
      ? null
      : sharedCounterpartySummaries.find((summary) => summary.email === sharedCounterpartyFilter) ?? null;
  const filteredSharedLoans = visibleSharedLoans.filter((loan) => !loan.isCompleted);
  const completedSharedLoans = visibleSharedLoans.filter((loan) => loan.isCompleted);
  const sharedLoansCreatedByMe = filteredSharedLoans.filter((loan) => getSharedLoanRoleLabel(loan, userEmail) === "Me deben");
  const sharedLoansIDebt = filteredSharedLoans.filter((loan) => getSharedLoanRoleLabel(loan, userEmail) === "Debo");
  const sharedPrincipalLent = sharedLoansCreatedByMe.reduce((sum, loan) => sum + getSharedLoanSettlementAmount(loan), 0);
  const sharedPrincipalBorrowed = sharedLoansIDebt.reduce((sum, loan) => sum + getSharedLoanSettlementAmount(loan), 0);
  const sharedNetBalance = sharedPrincipalLent - sharedPrincipalBorrowed;
  const selectedCounterpartyLabel = sharedCounterpartyFilter === "all" ? "general" : sharedCounterpartyFilter;
  const sharedNetBalanceAmount = Math.abs(sharedNetBalance);
  const sharedNetBalanceLabel =
    sharedNetBalance === 0 ? "Sin diferencia" : sharedNetBalance > 0 ? "Te deben en total" : "Debes en total";
  const sharedBalanceTitle =
    sharedCounterpartyFilter === "all" ? "Resumen por usuario" : `Cuenta con ${selectedCounterpartyLabel}`;
  const sharedBalanceIntro =
    sharedCounterpartyFilter === "all"
      ? "Todas tus cuentas compartidas abiertas, separadas por usuario."
      : `Resumen puntual de tu cuenta compartida con ${selectedCounterpartyLabel}.`;
  const describeSharedCounterpartyBalance = (summary: { email: string; theyOweMe: number; iOwe: number }) => {
    if (summary.theyOweMe > 0 && summary.iOwe > 0) {
      if (summary.theyOweMe === summary.iOwe) {
        return `${summary.email} te debe ${formatCurrency(summary.theyOweMe)} y tu le debes ${formatCurrency(summary.iOwe)}. En total quedan a mano.`;
      }

      if (summary.theyOweMe > summary.iOwe) {
        return `${summary.email} te debe ${formatCurrency(summary.theyOweMe)} y tu le debes ${formatCurrency(summary.iOwe)}. En total ${summary.email} te debe ${formatCurrency(summary.theyOweMe - summary.iOwe)}.`;
      }

      return `${summary.email} te debe ${formatCurrency(summary.theyOweMe)} y tu le debes ${formatCurrency(summary.iOwe)}. En total le debes ${formatCurrency(summary.iOwe - summary.theyOweMe)} a ${summary.email}.`;
    }

    if (summary.theyOweMe > 0) {
      return `${summary.email} te debe ${formatCurrency(summary.theyOweMe)}.`;
    }

    if (summary.iOwe > 0) {
      return `Tu le debes ${formatCurrency(summary.iOwe)} a ${summary.email}.`;
    }

    return `No hay saldo pendiente con ${summary.email}.`;
  };
  const sharedBalanceSummaryLines =
    sharedCounterpartyFilter === "all"
      ? sharedCounterpartySummaries.map(describeSharedCounterpartyBalance)
      : selectedCounterpartySummary
        ? [describeSharedCounterpartyBalance(selectedCounterpartySummary)]
        : [];
  const sharedPayments = visibleSharedLoans
    .flatMap((loan) =>
      loan.history.map((entry) => ({
        ...entry,
        loanTitle: loan.title,
        counterpartEmail: getSharedLoanCounterpartyEmail(loan, userEmail),
        roleLabel: getSharedLoanRoleLabel(loan, userEmail)
      }))
    )
    .sort((left, right) => right.changedAt.localeCompare(left.changedAt))
    .slice(0, 10);
  const expiringSoonDiscounts = discounts.filter((discount) => isDiscountExpiringSoon(discount));
  const featuredDiscount =
    discounts.length > 0
      ? [...discounts].sort((left, right) => {
          if (right.discountPercent !== left.discountPercent) {
            return right.discountPercent - left.discountPercent;
          }

          return left.validUntil.localeCompare(right.validUntil);
        })[0]
      : null;
  const discountCategorySections = DISCOUNT_CATEGORY_OPTIONS.map((option) => ({
    ...option,
    items: discounts.filter((discount) => discount.category === option.value),
    expiringSoonCount: discounts.filter(
      (discount) => discount.category === option.value && isDiscountExpiringSoon(discount)
    ).length
  })).filter((section) => section.items.length > 0);

  useEffect(() => {
    if (sharedCounterpartyFilter === "all") return;
    const hasMatch = sharedCounterpartySummaries.some((summary) => summary.email === sharedCounterpartyFilter);
    if (!hasMatch) {
      setSharedCounterpartyFilter("all");
    }
  }, [sharedCounterpartyFilter, sharedCounterpartySummaries]);

  const handleDraftChange = (field: keyof FinanceDraft, value: string) => {
    setDraft((current) => {
      if (field === "kind") {
        const nextKind = value as EntryKind;
        return {
          ...current,
          kind: nextKind,
          recurrence: nextKind === "loan" ? "monthly" : current.recurrence,
          installmentsTotal: nextKind === "loan" ? current.installmentsTotal : "",
          installmentsPaid: nextKind === "loan" ? current.installmentsPaid : "0",
          currentInstallmentNumber: "1",
          loanPlanMode: "fixed",
          installmentPlan: [],
          principalAmount: nextKind === "loan" ? current.principalAmount : "",
          historicalPaymentsCount: nextKind === "loan" || nextKind === "recurring_expense" ? "0" : current.historicalPaymentsCount,
          registerCurrentCycleAsPaid: "no",
          currentCyclePaidAt: todayKey()
        };
      }

      return {
        ...current,
        [field]: value
      };
    });

    setFormError(null);
  };

  const handleLoanPlanModeChange = (nextMode: FinanceDraft["loanPlanMode"]) => {
    setDraft((current) => ({
      ...current,
      loanPlanMode: nextMode,
      installmentPlan: nextMode === "schedule" ? current.installmentPlan : []
    }));
    setFormError(null);
  };

  const handleGenerateInstallmentPlan = () => {
    setDraft((current) => {
      const totalInstallments = Number(current.installmentsTotal.replace(/[^\d]/g, ""));
      const currentInstallmentNumber = Number(current.currentInstallmentNumber.replace(/[^\d]/g, ""));

      return {
        ...current,
        installmentPlan: generateInstallmentPlanDraft(
          totalInstallments,
          currentInstallmentNumber,
          current.dueDate,
          current.amount,
          current.installmentPlan
        )
      };
    });
    setFormError(null);
  };

  const handleInstallmentPlanChange = (
    installmentNumber: number,
    field: "dueDate" | "amount",
    value: string
  ) => {
    setDraft((current) => ({
      ...current,
      installmentPlan: current.installmentPlan.map((entry) =>
        entry.installmentNumber === installmentNumber
          ? {
              ...entry,
              [field]: value
            }
          : entry
      )
    }));
    setFormError(null);
  };

  const handleSharedLoanDraftChange = (field: keyof SharedLoanDraft, value: string) => {
    setSharedLoanDraft((current) => ({
      ...current,
      [field]: value
    }));
    setSharedLoanFormError(null);
  };

  const handleDiscountDraftChange = (field: keyof DiscountDraft, value: string) => {
    setDiscountDraft((current) => ({
      ...current,
      [field]: value
    }));
    setDiscountFormError(null);
  };

  const resetForm = () => {
    setDraft(createEmptyDraft());
    setFormMode("create");
    setEditingId(null);
    setFormError(null);
    setPendingDeleteId(null);
  };

  const resetSharedLoanForm = () => {
    setSharedLoanDraft(createEmptySharedLoanDraft());
    setSharedFormMode("create");
    setEditingSharedLoanId(null);
    setSharedLoanFormError(null);
    setIsSubmittingSharedLoan(false);
    setPendingSharedDeleteId(null);
  };

  const resetDiscountForm = () => {
    setDiscountDraft(createEmptyDiscountDraft());
    setDiscountFormMode("create");
    setEditingDiscountId(null);
    setDiscountFormError(null);
    setIsSubmittingDiscount(false);
    setPendingDiscountDeleteId(null);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    resetForm();
  };

  const closeSharedComposer = () => {
    setIsSharedComposerOpen(false);
    resetSharedLoanForm();
  };

  const closeDiscountComposer = () => {
    setIsDiscountComposerOpen(false);
    resetDiscountForm();
  };

  const openCreateComposer = () => {
    resetForm();
    setIsComposerOpen(true);
  };

  const openSharedComposer = () => {
    resetSharedLoanForm();
    setIsSharedComposerOpen(true);
  };

  const openDiscountComposer = () => {
    resetDiscountForm();
    setIsDiscountComposerOpen(true);
  };

  const openSharedEditor = (loan: SharedLoan) => {
    startTransition(() => {
      setSharedLoanDraft(getSharedLoanDraftFromItem(loan, userEmail));
      setSharedFormMode("edit");
      setEditingSharedLoanId(loan.id);
      setPendingSharedDeleteId(null);
      setSharedLoanFormError(null);
      setIsSharedComposerOpen(true);
    });
  };

  const openDiscountEditor = (discount: DiscountItem) => {
    startTransition(() => {
      setDiscountDraft(getDiscountDraftFromItem(discount));
      setDiscountFormMode("edit");
      setEditingDiscountId(discount.id);
      setPendingDiscountDeleteId(null);
      setDiscountFormError(null);
      setIsDiscountComposerOpen(true);
    });
  };

  const handleFormReset = () => {
    if (formMode === "edit") {
      closeComposer();
      return;
    }

    resetForm();
  };

  const applyFinanceMutation = async (
    updater: (currentState: FinanceState) => FinanceState,
    successMessage: string,
    errorMessage = "No se pudo guardar en Firebase"
  ) => {
    const previousState = financeState;
    const nextState = updater(previousState);

    try {
      await persistState(nextState, previousState);
      return true;
    } catch (error) {
      console.error("No se pudo guardar el cambio en Firebase", error);
      return false;
    }
  };

  const handleSubmit = () => {
    const validationError = validateDraft(draft);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const previousItem = editingId ? financeState.items.find((item) => item.id === editingId) ?? undefined : undefined;
    const item = buildItemFromDraft(draft, editingId ?? undefined, previousItem, {
      mode: formMode
    });

    void (async () => {
      const saved = await applyFinanceMutation(
        (current) => {
          let nextState = upsertItem(current, item);

          if (formMode === "create" && draft.kind !== "recurring_expense") {
            nextState = seedInitialHistory(nextState, item, draft);

            if (draft.registerCurrentCycleAsPaid === "yes") {
              nextState = registerPayment(nextState, item.id, draft.currentCyclePaidAt);
            }
          }

          return nextState;
        },
        formMode === "create" ? "Registro guardado en Firebase" : "Cambios sincronizados en Firebase"
      );

      if (!saved) {
        setFormError("No se pudo guardar el registro. Revisa tu sesion o la conexion con Firebase.");
        return;
      }

      setActiveView("overview");
      closeComposer();

      if (typeof window !== "undefined" && window.innerWidth <= 1080) {
        listRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    })();
  };

  const handlePay = (itemId: string) => {
    const item = financeState.items.find((entry) => entry.id === itemId);

    void applyFinanceMutation(
      (current) => registerPayment(current, itemId),
      item && isLoan(item) && item.installmentsTotal !== null && item.installmentsPaid + 1 >= item.installmentsTotal
        ? "Cuota registrada y prestamo completado"
        : item && isLoan(item)
          ? "Cuota registrada y sincronizada"
          : "Pago registrado y sincronizado"
    );
  };

  const handleExtraPayment = (itemId: string, nextAmount: string) => {
    const parsedAmount = parseAmount(nextAmount);
    if (parsedAmount <= 0) return;

    void applyFinanceMutation(
      (current) => registerLoanExtraPayment(current, itemId, parsedAmount),
      "Refuerzo aplicado al saldo del prestamo"
    );
  };

  const handleSharedLoanSubmit = () => {
    const validationError = validateSharedLoanDraft(sharedLoanDraft, userEmail);
    if (validationError) {
      setSharedLoanFormError(validationError);
      return;
    }

    if (!userId || !userEmail) {
      setSharedLoanFormError("No se pudo identificar tu usuario para crear este gasto compartido.");
      return;
    }

    setSharedLoanFormError(null);
    setIsSubmittingSharedLoan(true);

    void (async () => {
      try {
        const actor = {
          userId,
          userEmail
        };
        const existingLoan = editingSharedLoanId ? sharedLoans.find((entry) => entry.id === editingSharedLoanId) ?? null : null;
        const sharedLoan =
          sharedFormMode === "edit" && existingLoan
            ? updateSharedLoanFromDraft(existingLoan, sharedLoanDraft, actor)
            : buildSharedLoanFromDraft(sharedLoanDraft, actor);

        const saved = await saveSharedLoan(sharedLoan);
        if (!saved) {
          setSharedLoanFormError("No se pudo guardar el gasto compartido. Revisa el email del otro usuario y tu conexion con Firebase.");
          return;
        }

        setActiveView("shared");
        closeSharedComposer();
      } catch (error) {
        console.error("No se pudo guardar el gasto compartido", error);
        setSharedLoanFormError("No se pudo validar o guardar el gasto compartido. Prueba otra vez.");
      } finally {
        setIsSubmittingSharedLoan(false);
      }
    })();
  };

  const handleDiscountSubmit = () => {
    const validationError = validateDiscountDraft(discountDraft);
    if (validationError) {
      setDiscountFormError(validationError);
      return;
    }

    if (!userId || !userEmail) {
      setDiscountFormError("No se pudo identificar tu usuario para cargar este descuento.");
      return;
    }

    setDiscountFormError(null);
    setIsSubmittingDiscount(true);

    void (async () => {
      try {
        const existingDiscount = editingDiscountId ? discounts.find((entry) => entry.id === editingDiscountId) ?? null : null;
        const discount = buildDiscountFromDraft(
          discountDraft,
          {
            userId,
            userEmail
          },
          existingDiscount
        );

        const saved = await saveDiscount(discount);
        if (!saved) {
          setDiscountFormError("No se pudo guardar el descuento global. Revisa tu conexion con Firebase.");
          return;
        }

        setActiveView("discounts");
        closeDiscountComposer();
      } catch (error) {
        console.error("No se pudo guardar el descuento", error);
        setDiscountFormError("No se pudo validar o guardar el descuento. Prueba otra vez.");
      } finally {
        setIsSubmittingDiscount(false);
      }
    })();
  };

  const handleSharedLoanToggleSettled = (loanId: string) => {
    const loan = sharedLoans.find((entry) => entry.id === loanId);
    if (!loan || !userId || !userEmail) return;
    if (!isSharedLoanEditable(loan, userEmail)) return;

    const nextLoan = toggleSharedLoanCompleted(loan, { userId, userEmail });
    void saveSharedLoan(nextLoan);
  };

  const handleSharedLoanPartialPayment = (loanId: string, nextAmount: string) => {
    const loan = sharedLoans.find((entry) => entry.id === loanId);
    const parsedAmount = parseAmount(nextAmount);
    if (!loan || !userId || !userEmail || parsedAmount <= 0) return;
    if (!isSharedLoanEditable(loan, userEmail)) return;

    const nextLoan = registerSharedLoanPartialPayment(loan, parsedAmount, { userId, userEmail });
    void saveSharedLoan(nextLoan);
  };

  const handleSharedLoanDelete = (loanId: string) => {
    const loan = sharedLoans.find((entry) => entry.id === loanId);
    if (!loan || !userEmail) return;
    if (!isSharedLoanEditable(loan, userEmail)) return;

    void (async () => {
      const deleted = await deleteSharedLoan(loan);
      if (!deleted) {
        setSharedLoanFormError("No se pudo eliminar el gasto compartido. Prueba otra vez.");
        return;
      }

      setPendingSharedDeleteId(null);
    })();
  };

  const handleDiscountDelete = (discountId: string) => {
    void (async () => {
      const deleted = await deleteDiscount(discountId);
      if (!deleted) {
        setDiscountFormError("No se pudo eliminar el descuento. Prueba otra vez.");
        return;
      }

      setPendingDiscountDeleteId(null);

      if (editingDiscountId === discountId) {
        closeDiscountComposer();
      }
    })();
  };

  const handleSettleAllSharedLoans = () => {
    if (!userId || !userEmail || filteredSharedLoans.length === 0) return;

    setIsSettlingAllShared(true);

    void (async () => {
      try {
        for (const loan of filteredSharedLoans) {
          if (loan.isCompleted) continue;
          const nextLoan = toggleSharedLoanCompleted(loan, { userId, userEmail });
          await saveSharedLoan(nextLoan);
        }
      } finally {
        setIsSettlingAllShared(false);
      }
    })();
  };

  const handleEdit = (item: FinanceItem) => {
    startTransition(() => {
      setDraft(draftFromItem(item));
      setFormMode("edit");
      setEditingId(item.id);
      setPendingDeleteId(null);
      setFormError(null);
      setIsComposerOpen(true);
    });
  };

  const handleDelete = (itemId: string) => {
    void applyFinanceMutation((current) => deleteItem(current, itemId), "Registro eliminado de Firebase");
    setPendingDeleteId(null);

    if (editingId === itemId) {
      closeComposer();
    }
  };

  const handleSaveVariableAmount = (itemId: string, nextAmount: string) => {
    const parsedAmount = parseAmount(nextAmount);
    if (parsedAmount <= 0) return;

    void applyFinanceMutation(
      (current) => {
        const item = current.items.find((entry) => entry.id === itemId);
        if (!item || (item.kind !== "variable_expense" && item.kind !== "recurring_expense")) return current;

        return upsertItem(current, {
          ...item,
          amount: parsedAmount,
          updatedAt: todayKey()
        });
      },
      "Monto del ciclo actualizado en Firebase"
    );
  };

  const handleAuthModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    setManualAuthError(null);
    setLoginPassword("");
    setConfirmPassword("");
  };

  const handleLoginSubmit = () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setManualAuthError("Completa el email y la contrasena para ingresar.");
      return;
    }

    if (authMode === "register") {
      if (!confirmPassword.trim()) {
        setManualAuthError("Confirma la contrasena para crear la cuenta.");
        return;
      }

      if (loginPassword.length < 6) {
        setManualAuthError("La contrasena debe tener al menos 6 caracteres.");
        return;
      }

      if (loginPassword !== confirmPassword) {
        setManualAuthError("Las contrasenas no coinciden.");
        return;
      }
    }

    setManualAuthError(null);
    void (authMode === "register" ? register(loginEmail.trim(), loginPassword) : login(loginEmail.trim(), loginPassword));
  };

  const paidCountThisMonth = financeState.history.filter((entry) => {
    const currentMonth = todayKey().slice(0, 7);
    return entry.paidAt.startsWith(currentMonth);
  }).length;
  const recurringLoadedCount = activeRecurringItems.length;

  if (sessionState !== "authenticated") {
    return (
      <AuthScreen
        mode={authMode}
        email={loginEmail}
        password={loginPassword}
        confirmPassword={confirmPassword}
        sessionState={sessionState}
        authError={authScreenError}
        isSubmitting={isSubmitting}
        onModeChange={handleAuthModeChange}
        onEmailChange={setLoginEmail}
        onPasswordChange={setLoginPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleLoginSubmit}
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="page-backdrop" />

      <div className="page-shell__session">
        {userEmail ? <span className="status-pill status-pill--neutral topbar__user-pill">{userEmail}</span> : null}
        <button type="button" className="outline-button" onClick={() => void logout()}>
          Cerrar sesion
        </button>
      </div>

      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo-wrap">
            <img className="topbar__logo" src={brandLogo} alt="Caja en Llamas" />
          </div>

          <div className="topbar__copy">
            <p className="eyebrow">Panel principal</p>
            <p className="topbar__headline">Sistema de Gestion Financiera</p>
            <p className="topbar__subtitle">
              Un tablero mas claro para controlar cuotas, gastos fijos y movimientos variables sin mezclar todo en una sola vista.
            </p>
          </div>
        </div>

        <div className="topbar__toolbar">
          <nav className="topbar__nav" aria-label="Secciones principales">
            <button
              type="button"
              className={`topbar__nav-button ${activeView === "overview" ? "is-active" : ""}`}
              onClick={() => setActiveView("overview")}
            >
              Panel principal
            </button>
            <button
              type="button"
              className={`topbar__nav-button ${activeView === "dashboard" ? "is-active" : ""}`}
              onClick={() => setActiveView("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`topbar__nav-button ${activeView === "history" ? "is-active" : ""}`}
              onClick={() => setActiveView("history")}
            >
              Pagos recientes
            </button>
            <button
              type="button"
              className={`topbar__nav-button ${activeView === "shared" ? "is-active" : ""}`}
              onClick={() => setActiveView("shared")}
            >
              Gasto compartido
            </button>
            <button
              type="button"
              className={`topbar__nav-button ${activeView === "discounts" ? "is-active" : ""}`}
              onClick={() => setActiveView("discounts")}
            >
              Descuentos
            </button>
          </nav>

          <div className="topbar__toolbar-action">
            <button
              type="button"
              className="primary-button primary-button--icon"
              onClick={
                activeView === "shared" ? openSharedComposer : activeView === "discounts" ? openDiscountComposer : openCreateComposer
              }
              aria-label={
                activeView === "shared"
                  ? "Nuevo gasto compartido"
                  : activeView === "discounts"
                    ? "Nuevo descuento"
                    : "Nuevo registro"
              }
              title={
                activeView === "shared"
                  ? "Nuevo gasto compartido"
                  : activeView === "discounts"
                    ? "Nuevo descuento"
                    : "Nuevo registro"
              }
            >
              +
            </button>
          </div>
        </div>
      </header>

      {activeView === "overview" ? (
        <>
          <section className="metrics-grid">
            <MetricCard
              label="Pagado este mes"
              value={formatCurrency(metrics.overview.paidAmount)}
              detail={`${paidCountThisMonth + recurringLoadedCount} movimiento(s) registrados o cargados en el ciclo actual`}
              tone="mint"
            />
            <MetricCard
              label="Pendiente del mes"
              value={formatCurrency(metrics.overview.pendingAmount)}
              detail={`${overdueCount} vencido(s) o por vencer antes de cerrar el mes`}
              tone="coral"
            />
            <MetricCard
              label="Carga mensual base"
              value={formatCurrency(metrics.overview.monthlyBase)}
              detail="Compromisos activos equivalentes del mes"
              tone="cobalt"
            />
          </section>

          <section className="category-grid">
            <article className="surface-card category-card category-card--loan">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Prestamos</p>
                  <h2>Cuotas y avance</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-loan">{metrics.loans.activeCount} activos</span>
              </div>
              <div className="category-card__stats">
                <div>
                  <span>Pagado este mes</span>
                  <strong>{formatCurrency(metrics.loans.paidAmount)}</strong>
                </div>
                <div>
                  <span>Pendiente del mes</span>
                  <strong>{formatCurrency(metrics.loans.pendingAmount)}</strong>
                </div>
                <div>
                  <span>Despues de la actual</span>
                  <strong>{metrics.loans.remainingInstallments}</strong>
                </div>
              </div>
              <div className="loan-progress loan-progress--card">
                <div className="loan-progress__bar">
                  <span className="loan-progress__fill" style={{ width: `${loanCompletionRatio * 100}%` }} />
                </div>
                <div className="loan-progress__meta">
                  <span>
                    {metrics.loans.paidInstallments}/{metrics.loans.totalInstallments || 0} cuotas pagadas
                  </span>
                  <span>{metrics.loans.completedCount} prestamo(s) completados</span>
                </div>
              </div>
              <p className="category-card__note">
                Saldo restante total de prestamos: {formatCurrency(metrics.loans.principalRemainingTotal)}
              </p>
            </article>

            <article className="surface-card category-card category-card--variable">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Gastos variables</p>
                  <h2>Facturas editables</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-variable">
                  {metrics.variableExpenses.activeCount} activos
                </span>
              </div>
              <div className="category-card__stats">
                <div>
                  <span>Pagado este mes</span>
                  <strong>{formatCurrency(metrics.variableExpenses.paidAmount)}</strong>
                </div>
                <div>
                  <span>Pendiente del mes</span>
                  <strong>{formatCurrency(metrics.variableExpenses.pendingAmount)}</strong>
                </div>
                <div>
                  <span>Base actual</span>
                  <strong>{formatCurrency(metrics.variableExpenses.monthlyBase)}</strong>
                </div>
              </div>
              <p className="category-card__note">
                Pensado para agua, luz o cualquier gasto cuyo monto cambia. Editas el valor del ciclo y luego pagas.
              </p>
            </article>

            <article className="surface-card category-card category-card--fixed">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Gastos fijos</p>
                  <h2>Compromisos infinitos</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-fixed">{metrics.fixedExpenses.activeCount} activos</span>
              </div>
              <div className="category-card__stats">
                <div>
                  <span>Pagado este mes</span>
                  <strong>{formatCurrency(metrics.fixedExpenses.paidAmount)}</strong>
                </div>
                <div>
                  <span>Pendiente del mes</span>
                  <strong>{formatCurrency(metrics.fixedExpenses.pendingAmount)}</strong>
                </div>
                <div>
                  <span>Base mensual</span>
                  <strong>{formatCurrency(metrics.fixedExpenses.monthlyBase)}</strong>
                </div>
              </div>
              <p className="category-card__note">
                Ideal para ninera, alquiler, internet, colegio o cualquier pago que no tiene fecha de cierre.
              </p>
            </article>

            <article className="surface-card category-card category-card--recurring">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Gastos recurrentes</p>
                  <h2>Bolsas mensuales</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-recurring">
                  {metrics.recurringExpenses.activeCount} activos
                </span>
              </div>
              <div className="category-card__stats">
                <div>
                  <span>Pagado este mes</span>
                  <strong>{formatCurrency(metrics.recurringExpenses.paidAmount)}</strong>
                </div>
                <div>
                  <span>Sin pendiente</span>
                  <strong>{formatCurrency(metrics.recurringExpenses.pendingAmount)}</strong>
                </div>
                <div>
                  <span>Base mensual</span>
                  <strong>{formatCurrency(metrics.recurringExpenses.monthlyBase)}</strong>
                </div>
              </div>
              <p className="category-card__note">
                Pensado para combustible, gimnasio, bebe, farmacia o cualquier categoria que reaparece en tus ciclos.
              </p>
            </article>
          </section>

          <section className="summary-stage">
            <article className="surface-card hero-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Resumen general</p>
                  <h2>Resumen consolidado</h2>
                </div>
                <span className="status-pill status-pill--neutral">{metrics.overview.activeCount} registros activos</span>
              </div>

              <section className="summary-loans">
                <div className="summary-loans__header">
                  <div>
                    <p className="eyebrow">Prestamos activos</p>
                    <h3>Detalle por prestamo</h3>
                  </div>
                  <span className="status-pill status-pill--section status-pill--section-loan">{activeLoanItems.length} en seguimiento</span>
                </div>

                {activeLoanItems.length === 0 ? (
                  <div className="empty-state empty-state--compact">
                    <h3>No hay prestamos activos</h3>
                    <p>Cuando cargues uno, aqui veras cada cuota por separado en vez de un total mezclado.</p>
                  </div>
                ) : (
                  <div className="summary-loans__list">
                    {activeLoanItems.map((item) => {
                      const displayTitle = getDisplayTitle(item);
                      const displayEntity = getDisplayEntity(item);
                      const currentInstallmentNumber = getCurrentInstallmentNumber(item);
                      const remainingInstallments = getRemainingInstallments(item) ?? 0;
                      const installmentsAfterCurrent = getInstallmentsAfterCurrent(item) ?? 0;
                      const principalAmount = getLoanPrincipalAmount(item);
                      const principalRemaining = getLoanPrincipalRemaining(item);

                      return (
                        <article key={item.id} className="summary-loan-card">
                          <div className="summary-loan-card__identity">
                              <CompanyLogo
                                entityName={displayEntity}
                                kind={item.kind}
                                size="sm"
                                searchText={`${displayEntity} ${displayTitle}`}
                              />
                            <div className="summary-loan-card__copy">
                              <strong>{displayTitle}</strong>
                              <p>{displayEntity}</p>
                            </div>
                          </div>

                          <div className="summary-loan-card__stats">
                            <div>
                              <span>Cuota actual</span>
                              <strong>{formatCurrency(item.amount)}</strong>
                            </div>
                            <div>
                              <span>Prestamo total</span>
                              <strong>{formatCurrency(principalAmount ?? 0)}</strong>
                            </div>
                            <div>
                              <span>Saldo restante</span>
                              <strong>{formatCurrency(principalRemaining ?? 0)}</strong>
                            </div>
                            <div>
                              <span>Cuota nro.</span>
                              <strong>
                                {currentInstallmentNumber && item.installmentsTotal
                                  ? `${currentInstallmentNumber}/${item.installmentsTotal}`
                                  : "Sin dato"}
                              </strong>
                            </div>
                            <div>
                              <span>Cuotas pendientes</span>
                              <strong>{remainingInstallments} con esta</strong>
                            </div>
                          </div>

                          <p className="summary-loan-card__due">
                            {item.dueDate ? `Vence ${formatDate(item.dueDate)} · Luego de esta quedan ${installmentsAfterCurrent} cuota(s).` : "Sin vencimiento pendiente"}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="summary-expenses summary-expenses--variable">
                <div className="summary-expenses__header">
                  <div>
                    <p className="eyebrow">Gastos variables</p>
                    <h3>Detalle por factura</h3>
                  </div>
                  <span className="status-pill status-pill--section status-pill--section-variable">
                    {activeVariableItems.length} activos
                  </span>
                </div>

                {activeVariableItems.length === 0 ? (
                  <div className="empty-state empty-state--compact">
                    <h3>No hay gastos variables activos</h3>
                    <p>Cuando cargues servicios como agua o luz, aqui veras cada uno por separado.</p>
                  </div>
                ) : (
                  <div className="summary-expenses__list">
                    {activeVariableItems.map((item) => {
                      const displayTitle = getDisplayTitle(item);
                      const displayEntity = getDisplayEntity(item);

                      return (
                        <article key={item.id} className="summary-expense-card summary-expense-card--variable">
                          <div className="summary-expense-card__identity">
                              <CompanyLogo
                                entityName={displayEntity}
                                kind={item.kind}
                                size="sm"
                                searchText={`${displayEntity} ${displayTitle}`}
                              />
                            <div className="summary-expense-card__copy">
                              <strong>{displayTitle}</strong>
                              <p>{displayEntity}</p>
                            </div>
                          </div>

                          <div className="summary-expense-card__stats">
                            <div>
                              <span>Monto actual</span>
                              <strong>{formatCurrency(item.amount)}</strong>
                            </div>
                            <div>
                              <span>Recurrencia</span>
                              <strong>{getRecurrenceLabel(item.recurrence)}</strong>
                            </div>
                            <div>
                              <span>Vence</span>
                              <strong>{item.dueDate ? formatDate(item.dueDate) : "Sin fecha"}</strong>
                            </div>
                          </div>

                          <p className="summary-expense-card__note">
                            Puedes cambiar el monto del siguiente ciclo cuando llegue la nueva factura.
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="summary-expenses summary-expenses--fixed">
                <div className="summary-expenses__header">
                  <div>
                    <p className="eyebrow">Gastos fijos</p>
                    <h3>Detalle por compromiso</h3>
                  </div>
                  <span className="status-pill status-pill--section status-pill--section-fixed">{activeFixedItems.length} activos</span>
                </div>

                {activeFixedItems.length === 0 ? (
                  <div className="empty-state empty-state--compact">
                    <h3>No hay gastos fijos activos</h3>
                    <p>Cuando cargues internet, ninera o domestica, aqui veras cada uno por separado.</p>
                  </div>
                ) : (
                  <div className="summary-expenses__list">
                    {activeFixedItems.map((item) => {
                      const displayTitle = getDisplayTitle(item);
                      const displayEntity = getDisplayEntity(item);

                      return (
                        <article key={item.id} className="summary-expense-card summary-expense-card--fixed">
                          <div className="summary-expense-card__identity">
                              <CompanyLogo
                                entityName={displayEntity}
                                kind={item.kind}
                                size="sm"
                                searchText={`${displayEntity} ${displayTitle}`}
                              />
                            <div className="summary-expense-card__copy">
                              <strong>{displayTitle}</strong>
                              <p>{displayEntity}</p>
                            </div>
                          </div>

                          <div className="summary-expense-card__stats">
                            <div>
                              <span>Monto base</span>
                              <strong>{formatCurrency(item.amount)}</strong>
                            </div>
                            <div>
                              <span>Recurrencia</span>
                              <strong>{getRecurrenceLabel(item.recurrence)}</strong>
                            </div>
                            <div>
                              <span>Vence</span>
                              <strong>{item.dueDate ? formatDate(item.dueDate) : "Sin fecha"}</strong>
                            </div>
                          </div>

                          <p className="summary-expense-card__note">
                            Compromiso estable que sigue activo mes a mes hasta que lo cierres o lo borres.
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="summary-expenses summary-expenses--recurring">
                <div className="summary-expenses__header">
                  <div>
                    <p className="eyebrow">Gastos recurrentes</p>
                    <h3>Detalle por categoria</h3>
                  </div>
                  <span className="status-pill status-pill--section status-pill--section-recurring">
                    {activeRecurringItems.length} activos
                  </span>
                </div>

                {activeRecurringItems.length === 0 ? (
                  <div className="empty-state empty-state--compact">
                    <h3>No hay gastos recurrentes activos</h3>
                    <p>Cuando cargues combustible, gimnasio, farmacia o super, aqui veras cada categoria por separado.</p>
                  </div>
                ) : (
                  <div className="summary-expenses__list">
                    {activeRecurringItems.map((item) => {
                      const displayTitle = getDisplayTitle(item);
                      const displayEntity = getDisplayEntity(item);

                      return (
                        <article key={item.id} className="summary-expense-card summary-expense-card--recurring">
                          <div className="summary-expense-card__identity">
                              <CompanyLogo
                                entityName={displayEntity}
                                kind={item.kind}
                                size="sm"
                                searchText={`${displayEntity} ${displayTitle}`}
                              />
                            <div className="summary-expense-card__copy">
                              <strong>{displayTitle}</strong>
                              <p>{displayEntity}</p>
                            </div>
                          </div>

                          <div className="summary-expense-card__stats">
                            <div>
                              <span>Monto base</span>
                              <strong>{formatCurrency(item.amount)}</strong>
                            </div>
                            <div>
                              <span>Recurrencia</span>
                              <strong>{getRecurrenceLabel(item.recurrence)}</strong>
                            </div>
                            <div>
                              <span>Seguimiento</span>
                              <strong>Sin vencimiento fijo</strong>
                            </div>
                          </div>

                          <p className="summary-expense-card__note">
                            Categoria flexible para gastos que reaparecen y quieres controlar como una bolsa mensual propia.
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="summary-focus">
                <div className="summary-focus__copy">
                  <p className="eyebrow">Proximo foco</p>
                  <h3>{nextDueItem ? getDisplayTitle(nextDueItem) : "Sin registros"}</h3>
                </div>
                <p className="summary-focus__detail">
                  {nextDueItem?.dueDate
                    ? `${getDisplayEntity(nextDueItem)} - vence ${formatDate(nextDueItem.dueDate)}`
                    : "Crea tu primer compromiso para empezar a organizar el mes."}
                </p>
              </section>
            </article>
          </section>

          <section ref={listRef} className="records-stage">
            <div className="surface-card list-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CRUD directo</p>
                  <h2>Prestamos y gastos</h2>
                </div>
                <span className="status-pill status-pill--neutral">Pago, edicion y borrado sin submenus</span>
              </div>

              <div className="toolbar">
                <label className="toolbar__search">
                  <span>Buscar</span>
                  <input
                    type="search"
                    placeholder="Filtra por empresa, tipo o recurrencia"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>

                <div className="filter-group">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`filter-pill ${
                        option.value === "all"
                          ? "filter-pill--all"
                          : `filter-pill--${getKindTheme(option.value)}`
                      } ${kindFilter === option.value ? "is-active" : ""}`}
                      onClick={() => setKindFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="empty-state">
                  <h3>No hay registros para mostrar</h3>
                  <p>
                    Puedes cargar un prestamo por cuotas, un gasto fijo, un gasto variable o una categoria recurrente como combustible o farmacia.
                  </p>
                </div>
              ) : (
                <div className="entry-list">
                  {filteredItems.map((item) => {
                    const lastPayment = financeState.history.find((entry) => entry.itemId === item.id) ?? null;

                    return (
                      <ExpenseRow
                        key={item.id}
                        item={item}
                        lastPayment={lastPayment}
                        confirmingDelete={pendingDeleteId === item.id}
                        onPay={() => handlePay(item.id)}
                        onAddExtraPayment={(nextAmount) => handleExtraPayment(item.id, nextAmount)}
                        onEdit={() => handleEdit(item)}
                        onSaveAmount={(nextAmount) => handleSaveVariableAmount(item.id, nextAmount)}
                        onAskDelete={() => setPendingDeleteId(item.id)}
                        onConfirmDelete={() => handleDelete(item.id)}
                        onCancelDelete={() => setPendingDeleteId(null)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      ) : activeView === "dashboard" ? (
        <section className="dashboard-stage">
          <article className="surface-card dashboard-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Dashboard</p>
                <h2>Resumen por categoria</h2>
              </div>
              <span className="status-pill status-pill--neutral">{visibleCategorySummaries.length} categoria(s) activas</span>
            </div>

            {visibleCategorySummaries.length === 0 ? (
              <div className="empty-state">
                <h3>Aun no hay categorias para resumir</h3>
                <p>Cuando empieces a cargar prestamos o gastos, aqui tendras el panorama por categoria y por tipo.</p>
              </div>
            ) : (
              <div className="dashboard-category-grid">
                {visibleCategorySummaries.map((summary) => {
                  const kindTheme = getKindTheme(summary.kind);
                  const entityPreview = summary.entities.slice(0, 3).join(" · ");
                  const titlePreview = summary.itemTitles.slice(0, 3).join(" · ");

                  return (
                    <article key={summary.key} className={`dashboard-category-card dashboard-category-card--${kindTheme}`}>
                      <div className="dashboard-category-card__header">
                        <div>
                          <p className="eyebrow">{getKindLabel(summary.kind)}</p>
                          <h3>{summary.label}</h3>
                        </div>
                        <span className={`status-pill status-pill--section status-pill--section-${kindTheme}`}>
                          {summary.activeCount} activos
                        </span>
                      </div>

                      <div className="dashboard-category-card__stats">
                        <div>
                          <span>Base mensual</span>
                          <strong>{formatCurrency(summary.monthlyBase)}</strong>
                        </div>
                        <div>
                          <span>Pagado este mes</span>
                          <strong>{formatCurrency(summary.paidAmount)}</strong>
                        </div>
                        <div>
                          <span>{summary.kind === "recurring_expense" ? "Sin pendiente" : "Pendiente"}</span>
                          <strong>{formatCurrency(summary.pendingAmount)}</strong>
                        </div>
                      </div>

                      <div className="dashboard-category-card__meta">
                        <p>{entityPreview || titlePreview || "Sin entidades cargadas aun"}</p>
                        <p>
                          {summary.kind === "recurring_expense"
                            ? "Sin vencimiento fijo: se mueve segun lo que vayas consumiendo este mes."
                            : summary.nextDueDate
                              ? `Proximo vencimiento: ${formatDate(summary.nextDueDate)}`
                              : "Sin vencimientos pendientes"}
                        </p>
                      </div>

                      {summary.kind === "loan" ? (
                        <p className="dashboard-category-card__note">Agrupa todos los prestamos para ver la carga total de cuotas en un solo lugar.</p>
                      ) : (
                        <p className="dashboard-category-card__note">
                          {titlePreview || "Categoria lista para seguir mes a mes sin mezclarla con el resto."}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      ) : activeView === "discounts" ? (
        <section className="discount-stage">
          {discountsError ? <div className="alert-banner alert-banner--danger">{discountsError}</div> : null}

          <section className="metrics-grid">
            <MetricCard
              label="Beneficios activos"
              value={String(discounts.length)}
              detail={
                discountsState === "loading"
                  ? "Cargando descuentos compartidos..."
                  : `${discountCategorySections.length} categoria(s) con beneficios visibles`
              }
              tone="mint"
            />
            <MetricCard
              label="Mayor ahorro"
              value={featuredDiscount ? `${featuredDiscount.discountPercent}%` : "0%"}
              detail={
                featuredDiscount
                  ? `${featuredDiscount.commerceName} con ${featuredDiscount.providerName}`
                  : "Carga tu primer beneficio para destacarlo aqui"
              }
              tone="cobalt"
            />
            <MetricCard
              label="Vencen pronto"
              value={String(expiringSoonDiscounts.length)}
              detail={
                expiringSoonDiscounts.length > 0
                  ? "Promos que vencen en los proximos 7 dias"
                  : "Sin beneficios por vencer en el corto plazo"
              }
              tone="coral"
            />
          </section>

          {discounts.length === 0 ? (
            <article className="surface-card discount-empty-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Descuentos globales</p>
                  <h2>Beneficios de tarjetas y bancos</h2>
                </div>
                <span className="status-pill status-pill--neutral">0 beneficios</span>
              </div>
              <div className="empty-state">
                <h3>{discountsState === "loading" ? "Cargando descuentos..." : "Aun no hay descuentos cargados"}</h3>
                <p>
                  {discountsState === "loading"
                    ? "En unos segundos veras aqui las promos activas compartidas por todos los usuarios."
                    : "Usa el boton + para cargar promos como supermercados, combustible, farmacia u otras ventajas temporales que todos los usuarios del sistema puedan consultar."}
                </p>
              </div>
            </article>
          ) : (
            <section className="discount-category-grid">
              {discountCategorySections.map((section) => {
                const sectionTheme = getDiscountCategoryTheme(section.value);

                return (
                  <article key={section.value} className={`surface-card discount-section-card discount-section-card--${sectionTheme}`}>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Descuentos</p>
                        <h2>{getDiscountCategoryLabel(section.value)}</h2>
                        <p className="discount-section-card__subtitle">{section.hint}</p>
                      </div>
                      <div className="discount-section-card__pills">
                        {section.expiringSoonCount > 0 ? (
                          <span className="status-pill status-pill--section status-pill--section-variable">
                            {section.expiringSoonCount} vence(n) pronto
                          </span>
                        ) : null}
                        <span className={`status-pill status-pill--section status-pill--section-${sectionTheme}`}>
                          {section.items.length} activo(s)
                        </span>
                      </div>
                    </div>

                    <div className="discount-card-grid">
                      {section.items.map((discount) => (
                        <DiscountCard
                          key={discount.id}
                          discount={discount}
                          confirmingDelete={pendingDiscountDeleteId === discount.id}
                          onEdit={() => openDiscountEditor(discount)}
                          onAskDelete={() => setPendingDiscountDeleteId(discount.id)}
                          onConfirmDelete={() => handleDiscountDelete(discount.id)}
                          onCancelDelete={() => setPendingDiscountDeleteId(null)}
                        />
                      ))}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </section>
      ) : activeView === "shared" ? (
        <section className="shared-stage">
          <section className="metrics-grid">
            <MetricCard
              label="Me deben"
              value={formatCurrency(sharedPrincipalLent)}
              detail={`${sharedLoansCreatedByMe.length} gasto(s) abierto(s) donde te deben devolver`}
              tone="cobalt"
            />
            <MetricCard
              label="Debo"
              value={formatCurrency(sharedPrincipalBorrowed)}
              detail={`${sharedLoansIDebt.length} gasto(s) abierto(s) donde tu debes ajustar`}
              tone="coral"
            />
            <MetricCard
              label="Actividad compartida"
              value={String(sharedPayments.length)}
              detail={sharedLoansState === "loading" ? "Cargando gastos compartidos..." : "Cambios recientes entre ambos usuarios"}
              tone="mint"
            />
          </section>

          {sharedLoansError ? <div className="alert-banner alert-banner--danger">{sharedLoansError}</div> : null}

          <article className="surface-card shared-card shared-partners-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Usuarios vinculados</p>
                <h2>Filtra por persona</h2>
              </div>
              <span className="status-pill status-pill--neutral">
                {sharedCounterpartyFilter === "all" ? "Mostrando todo" : sharedCounterpartyFilter}
              </span>
            </div>

            {sharedCounterpartySummaries.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <h3>Aun no tienes usuarios en compartidos</h3>
                <p>Crea tu primer gasto compartido para empezar.</p>
              </div>
            ) : (
              <div className="shared-partner-grid">
                <button
                  type="button"
                  className={`shared-partner-card ${sharedCounterpartyFilter === "all" ? "is-active" : ""}`}
                  onClick={() => setSharedCounterpartyFilter("all")}
                >
                  <div className="shared-partner-card__header">
                    <strong>Mostrar todo</strong>
                    <span className="status-pill status-pill--neutral">
                      {activeSharedLoans.length} activa(s) · {sharedLoans.length - activeSharedLoans.length} cerrada(s)
                    </span>
                  </div>
                  <div className="shared-partner-card__stats">
                    <span>Me deben {formatCurrency(sharedAllLentTotal)}</span>
                    <span>Debo {formatCurrency(sharedAllBorrowedTotal)}</span>
                  </div>
                </button>

                {sharedCounterpartySummaries.map((summary) => (
                  <button
                    key={summary.email}
                    type="button"
                    className={`shared-partner-card ${sharedCounterpartyFilter === summary.email ? "is-active" : ""}`}
                    onClick={() => setSharedCounterpartyFilter(summary.email)}
                  >
                    <div className="shared-partner-card__header">
                      <div className="shared-partner-card__identity">
                        <CompanyLogo entityName={summary.email} kind="loan" size="sm" searchText={summary.email} />
                        <strong>{summary.email}</strong>
                      </div>
                      <span className="status-pill status-pill--neutral">
                        {summary.activeCount} activa(s) · {summary.completedCount} cerrada(s)
                      </span>
                    </div>
                    <div className="shared-partner-card__stats">
                      <span>Me deben {formatCurrency(summary.theyOweMe)}</span>
                      <span>Debo {formatCurrency(summary.iOwe)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="surface-card shared-card shared-balance-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Resumen de cuentas</p>
                <h2>{sharedBalanceTitle}</h2>
              </div>
              <button
                type="button"
                className="outline-button"
                onClick={handleSettleAllSharedLoans}
                disabled={filteredSharedLoans.length === 0 || isSettlingAllShared}
              >
                {isSettlingAllShared ? "Saldando..." : "Saldar todas las cuentas"}
              </button>
            </div>

            <p className="shared-balance-card__copy">{sharedBalanceIntro}</p>

            {sharedBalanceSummaryLines.length > 0 ? (
              <div className="shared-balance-list">
                {sharedBalanceSummaryLines.map((line) => (
                  <p key={line} className="shared-balance-list__item">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="shared-balance-grid">
              <div className="shared-balance-stat">
                <span>Me deben</span>
                <strong>{formatCurrency(sharedPrincipalLent)}</strong>
              </div>
              <div className="shared-balance-stat">
                <span>Debo</span>
                <strong>{formatCurrency(sharedPrincipalBorrowed)}</strong>
              </div>
              <div className="shared-balance-stat">
                <span>Resultado</span>
                <strong>{formatCurrency(sharedNetBalanceAmount)}</strong>
                <p>{sharedNetBalanceLabel}</p>
              </div>
            </div>
          </article>

          <section className="shared-stage__grid">
            <article className="surface-card shared-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Me deben</p>
                  <h2>Gastos donde tu pagaste</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-loan">
                  {sharedLoansCreatedByMe.length} activos
                </span>
              </div>

              {sharedLoansCreatedByMe.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>Aun no tienes gastos compartidos a favor</h3>
                  <p>
                    {sharedCounterpartyFilter === "all"
                      ? "Usa el boton + para cargar una compra compartida."
                      : "Sin gastos a favor con este usuario."}
                  </p>
                </div>
              ) : (
                <div className="shared-loan-list">
                  {sharedLoansCreatedByMe.map((loan) => (
                    <SharedLoanRow
                      key={loan.id}
                      loan={loan}
                      currentUserEmail={userEmail}
                      confirmingDelete={pendingSharedDeleteId === loan.id}
                      onEdit={() => openSharedEditor(loan)}
                      onRegisterPartialPayment={(nextAmount) => handleSharedLoanPartialPayment(loan.id, nextAmount)}
                      onToggleSettled={() => handleSharedLoanToggleSettled(loan.id)}
                      onAskDelete={() => setPendingSharedDeleteId(loan.id)}
                      onConfirmDelete={() => handleSharedLoanDelete(loan.id)}
                      onCancelDelete={() => setPendingSharedDeleteId(null)}
                    />
                  ))}
                </div>
              )}
            </article>

            <article className="surface-card shared-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Debo</p>
                  <h2>Gastos donde pago la otra persona</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-variable">
                  {sharedLoansIDebt.length} activos
                </span>
              </div>

              {sharedLoansIDebt.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>No tienes gastos compartidos pendientes ahora mismo</h3>
                  <p>
                    {sharedCounterpartyFilter === "all"
                      ? "Apareceran aqui cuando haya movimientos compartidos."
                      : "Sin deuda pendiente con este usuario."}
                  </p>
                </div>
              ) : (
                <div className="shared-loan-list">
                  {sharedLoansIDebt.map((loan) => (
                    <SharedLoanRow
                      key={loan.id}
                      loan={loan}
                      currentUserEmail={userEmail}
                      confirmingDelete={pendingSharedDeleteId === loan.id}
                      onEdit={() => openSharedEditor(loan)}
                      onRegisterPartialPayment={(nextAmount) => handleSharedLoanPartialPayment(loan.id, nextAmount)}
                      onToggleSettled={() => handleSharedLoanToggleSettled(loan.id)}
                      onAskDelete={() => setPendingSharedDeleteId(loan.id)}
                      onConfirmDelete={() => handleSharedLoanDelete(loan.id)}
                      onCancelDelete={() => setPendingSharedDeleteId(null)}
                    />
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="shared-history-stage">
            <article className="surface-card shared-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Historial de deudas</p>
                  <h2>Cuentas saldadas</h2>
                </div>
                <span className="status-pill status-pill--neutral">{completedSharedLoans.length} cerrada(s)</span>
              </div>

              {completedSharedLoans.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>Aun no tienes cuentas saldadas</h3>
                  <p>
                    {sharedCounterpartyFilter === "all"
                      ? "Cuando cierres una deuda compartida, quedara registrada aqui con fecha y usuario."
                      : "Todavia no hay cuentas cerradas con este usuario."}
                  </p>
                </div>
              ) : (
                <div className="shared-loan-list">
                  {completedSharedLoans.map((loan) => (
                    <SharedLoanRow
                      key={loan.id}
                      loan={loan}
                      currentUserEmail={userEmail}
                      confirmingDelete={false}
                      showActions={false}
                      onEdit={() => undefined}
                      onRegisterPartialPayment={() => undefined}
                      onToggleSettled={() => undefined}
                      onAskDelete={() => undefined}
                      onConfirmDelete={() => undefined}
                      onCancelDelete={() => undefined}
                    />
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="shared-history-stage">
            <article className="surface-card shared-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Historico compartido</p>
                  <h2>Ultimas modificaciones</h2>
                </div>
                <span className="status-pill status-pill--neutral">{sharedPayments.length} movimiento(s)</span>
              </div>

              {sharedPayments.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>No hay movimientos compartidos todavia</h3>
                  <p>Cuando alguien cree, edite, salde o reabra un gasto compartido, lo veras aqui.</p>
                </div>
              ) : (
                <div className="history-list">
                  {sharedPayments.map((payment) => (
                    <article key={payment.id} className="history-item">
                      <div className="history-item__identity">
                        <CompanyLogo
                          entityName={payment.counterpartEmail}
                          kind="loan"
                          size="sm"
                          searchText={`${payment.counterpartEmail} ${payment.loanTitle}`}
                        />
                        <div>
                          <strong>{payment.loanTitle}</strong>
                          <p className="history-item__entity">
                            {payment.roleLabel} · {payment.changedByEmail}
                          </p>
                          <p>{payment.summary}</p>
                        </div>
                      </div>
                      <div>
                        <strong>
                          {payment.action === "partial_payment"
                            ? "Abono"
                            : payment.action === "settled"
                              ? "Saldado"
                              : payment.action === "reopened"
                                ? "Reabierto"
                                : "Actualizado"}
                        </strong>
                        <p>{formatDateTime(payment.changedAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </section>
        </section>
      ) : (
        <section className="history-stage">
          <HistoryPanel history={financeState.history} />
        </section>
      )}

      {isComposerOpen ? (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="composer-modal-title">
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <FinanceForm
              values={draft}
              mode={formMode}
              error={formError}
              onChange={handleDraftChange}
              onSubmit={handleSubmit}
              onReset={handleFormReset}
              onLoanPlanModeChange={handleLoanPlanModeChange}
              onGenerateInstallmentPlan={handleGenerateInstallmentPlan}
              onInstallmentPlanChange={handleInstallmentPlanChange}
              headerAction={
                <button type="button" className="outline-button modal-close-button" onClick={closeComposer}>
                  Cerrar
                </button>
              }
              titleId="composer-modal-title"
            />
          </div>
          <button type="button" className="modal-backdrop-dismiss" aria-label="Cerrar modal" onClick={closeComposer} />
        </div>
      ) : null}

      {isDiscountComposerOpen ? (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="discount-modal-title">
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <DiscountForm
              values={discountDraft}
              mode={discountFormMode}
              error={discountFormError}
              isSubmitting={isSubmittingDiscount}
              currentUserEmail={userEmail}
              onChange={handleDiscountDraftChange}
              onSubmit={handleDiscountSubmit}
              onReset={closeDiscountComposer}
              headerAction={
                <button type="button" className="outline-button modal-close-button" onClick={closeDiscountComposer}>
                  Cerrar
                </button>
              }
              titleId="discount-modal-title"
            />
          </div>
          <button
            type="button"
            className="modal-backdrop-dismiss"
            aria-label="Cerrar modal"
            onClick={closeDiscountComposer}
          />
        </div>
      ) : null}

      {isSharedComposerOpen ? (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="shared-loan-modal-title">
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <SharedLoanForm
              values={sharedLoanDraft}
              mode={sharedFormMode}
              error={sharedLoanFormError}
              isSubmitting={isSubmittingSharedLoan}
              currentUserEmail={userEmail}
              onChange={handleSharedLoanDraftChange}
              onSubmit={handleSharedLoanSubmit}
              onReset={closeSharedComposer}
              headerAction={
                <button type="button" className="outline-button modal-close-button" onClick={closeSharedComposer}>
                  Cerrar
                </button>
              }
              titleId="shared-loan-modal-title"
            />
          </div>
          <button
            type="button"
            className="modal-backdrop-dismiss"
            aria-label="Cerrar modal"
            onClick={closeSharedComposer}
          />
        </div>
      ) : null}
    </div>
  );
}
