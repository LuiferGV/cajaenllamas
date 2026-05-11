import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import brandLogo from "../cajaenllamas.png";
import { AuthScreen } from "./components/AuthScreen";
import { CompanyLogo } from "./components/CompanyLogo";
import { ExpenseRow } from "./components/ExpenseRow";
import { FinanceForm } from "./components/FinanceForm";
import { HistoryPanel } from "./components/HistoryPanel";
import { MetricCard } from "./components/MetricCard";
import { useFinanceData } from "./hooks/useFinanceData";
import { useSharedLoansData } from "./hooks/useSharedLoansData";
import { useFirebaseSession, type AuthMode } from "./hooks/useFirebaseSession";
import { SharedLoanForm } from "./components/SharedLoanForm";
import { SharedLoanRow } from "./components/SharedLoanRow";
import {
  buildItemFromDraft,
  createEmptyDraft,
  deleteItem,
  draftFromItem,
  filterItems,
  formatCurrency,
  formatDate,
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
  isSharedLoanEditable,
  registerSharedLoanExtraPayment,
  registerSharedLoanInstallment,
  validateSharedLoanDraft
} from "./lib/sharedLoans";
import type { EntryKind, FinanceDraft, FinanceItem, FinanceState, SharedLoan, SharedLoanDraft } from "./types";

type FormMode = "create" | "edit";
type AppView = "overview" | "dashboard" | "history" | "shared";

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
  const { sharedLoans, sharedLoansState, sharedLoansError, saveSharedLoan } = useSharedLoansData(
    sessionState === "authenticated",
    userEmail
  );
  const [draft, setDraft] = useState<FinanceDraft>(() => createEmptyDraft());
  const [sharedLoanDraft, setSharedLoanDraft] = useState<SharedLoanDraft>(() => createEmptySharedLoanDraft());
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [activeView, setActiveView] = useState<AppView>("overview");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<EntryKind | "all">("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [sharedLoanFormError, setSharedLoanFormError] = useState<string | null>(null);
  const [isSubmittingSharedLoan, setIsSubmittingSharedLoan] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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
    if (!isComposerOpen && !isSharedComposerOpen) return undefined;

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
          setSharedLoanFormError(null);
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isComposerOpen, isSharedComposerOpen]);

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
  const normalizedUserEmail = userEmail?.trim().toLowerCase() ?? "";
  const sharedLoansAsLender = sharedLoans.filter((loan) => loan.lenderEmail === normalizedUserEmail);
  const sharedLoansAsBorrower = sharedLoans.filter((loan) => loan.borrowerEmail === normalizedUserEmail);
  const activeSharedLoans = sharedLoans.filter((loan) => !loan.isCompleted);
  const sharedLoansCreatedByMe = activeSharedLoans.filter((loan) => isSharedLoanEditable(loan, userEmail));
  const sharedLoansIDebt = activeSharedLoans.filter((loan) => !isSharedLoanEditable(loan, userEmail));
  const sharedPrincipalLent = sharedLoansAsLender.reduce((sum, loan) => sum + loan.principalRemaining, 0);
  const sharedPrincipalBorrowed = sharedLoansAsBorrower.reduce((sum, loan) => sum + loan.principalRemaining, 0);
  const sharedPayments = sharedLoans
    .flatMap((loan) => loan.history)
    .sort((left, right) => right.paidAt.localeCompare(left.paidAt))
    .slice(0, 8);

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

  const resetForm = () => {
    setDraft(createEmptyDraft());
    setFormMode("create");
    setEditingId(null);
    setFormError(null);
    setPendingDeleteId(null);
  };

  const resetSharedLoanForm = () => {
    setSharedLoanDraft(createEmptySharedLoanDraft());
    setSharedLoanFormError(null);
    setIsSubmittingSharedLoan(false);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    resetForm();
  };

  const closeSharedComposer = () => {
    setIsSharedComposerOpen(false);
    resetSharedLoanForm();
  };

  const openCreateComposer = () => {
    resetForm();
    setIsComposerOpen(true);
  };

  const openSharedComposer = () => {
    resetSharedLoanForm();
    setIsSharedComposerOpen(true);
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
      setSharedLoanFormError("No se pudo identificar tu usuario para crear este prestamo compartido.");
      return;
    }

    setSharedLoanFormError(null);
    setIsSubmittingSharedLoan(true);

    void (async () => {
      try {
        const sharedLoan = buildSharedLoanFromDraft(sharedLoanDraft, {
          lenderUid: userId,
          lenderEmail: userEmail,
          borrowerEmail: sharedLoanDraft.borrowerEmail.trim()
        });

        const saved = await saveSharedLoan(sharedLoan);
        if (!saved) {
          setSharedLoanFormError("No se pudo guardar el prestamo compartido. Revisa el email del otro usuario y tu conexion con Firebase.");
          return;
        }

        setActiveView("shared");
        closeSharedComposer();
      } catch (error) {
        console.error("No se pudo crear el prestamo compartido", error);
        setSharedLoanFormError("No se pudo validar o guardar el prestamo compartido. Prueba otra vez.");
      } finally {
        setIsSubmittingSharedLoan(false);
      }
    })();
  };

  const handleSharedLoanPay = (loanId: string) => {
    const loan = sharedLoans.find((entry) => entry.id === loanId);
    if (!loan || !userId || !userEmail) return;
    if (!isSharedLoanEditable(loan, userEmail)) return;

    const nextLoan = registerSharedLoanInstallment(loan, userId, userEmail);
    void saveSharedLoan(nextLoan);
  };

  const handleSharedLoanExtraPayment = (loanId: string, nextAmount: string) => {
    const loan = sharedLoans.find((entry) => entry.id === loanId);
    const parsedAmount = parseAmount(nextAmount);
    if (!loan || !userId || !userEmail || parsedAmount <= 0) return;
    if (!isSharedLoanEditable(loan, userEmail)) return;

    const nextLoan = registerSharedLoanExtraPayment(loan, parsedAmount, userId, userEmail);
    void saveSharedLoan(nextLoan);
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
          </nav>

          <div className="topbar__actions">
            {userEmail ? <span className="status-pill status-pill--neutral topbar__user-pill">{userEmail}</span> : null}
            <button type="button" className="outline-button" onClick={() => void logout()}>
              Cerrar sesion
            </button>
            <button
              type="button"
              className="primary-button primary-button--icon"
              onClick={activeView === "shared" ? openSharedComposer : openCreateComposer}
              aria-label={activeView === "shared" ? "Nuevo prestamo compartido" : "Nuevo registro"}
              title={activeView === "shared" ? "Nuevo prestamo compartido" : "Nuevo registro"}
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
      ) : activeView === "shared" ? (
        <section className="shared-stage">
          <section className="metrics-grid">
            <MetricCard
              label="Me deben"
              value={formatCurrency(sharedPrincipalLent)}
              detail={`${sharedLoansCreatedByMe.length} prestamo(s) compartido(s) donde eres acreedor`}
              tone="cobalt"
            />
            <MetricCard
              label="Debo"
              value={formatCurrency(sharedPrincipalBorrowed)}
              detail={`${sharedLoansIDebt.length} prestamo(s) compartido(s) donde eres deudor`}
              tone="coral"
            />
            <MetricCard
              label="Movimientos compartidos"
              value={String(sharedPayments.length)}
              detail={sharedLoansState === "loading" ? "Cargando prestamos compartidos..." : "Pagos y refuerzos recientes entre usuarios"}
              tone="mint"
            />
          </section>

          <section className="shared-stage__grid">
            <article className="surface-card shared-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Me deben</p>
                  <h2>Prestamos que tu controlas</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-loan">
                  {sharedLoansCreatedByMe.length} activos
                </span>
              </div>

              <p className="shared-card__copy">
                Aqui tu eres el acreedor. Solo tu puedes registrar cuotas o refuerzos y la otra persona lo ve en solo lectura.
              </p>

              {sharedLoansCreatedByMe.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>Aun no tienes prestamos compartidos como acreedor</h3>
                  <p>Usa el boton + desde esta pestaña para crear uno nuevo con otro usuario del sistema.</p>
                </div>
              ) : (
                <div className="shared-loan-list">
                  {sharedLoansCreatedByMe.map((loan) => (
                    <SharedLoanRow
                      key={loan.id}
                      loan={loan}
                      currentUserEmail={userEmail}
                      onPay={() => handleSharedLoanPay(loan.id)}
                      onAddExtraPayment={(nextAmount) => handleSharedLoanExtraPayment(loan.id, nextAmount)}
                    />
                  ))}
                </div>
              )}
            </article>

            <article className="surface-card shared-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Debo</p>
                  <h2>Prestamos que ves en modo lectura</h2>
                </div>
                <span className="status-pill status-pill--section status-pill--section-variable">
                  {sharedLoansIDebt.length} activos
                </span>
              </div>

              <p className="shared-card__copy">
                Estos prestamos fueron creados por el acreedor. Tu puedes ver el saldo y el avance, pero no registrar pagos.
              </p>

              {sharedLoansIDebt.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>No tienes deudas compartidas visibles ahora mismo</h3>
                  <p>Cuando otro usuario te cargue un prestamo, te aparecera aqui automaticamente.</p>
                </div>
              ) : (
                <div className="shared-loan-list">
                  {sharedLoansIDebt.map((loan) => (
                    <SharedLoanRow
                      key={loan.id}
                      loan={loan}
                      currentUserEmail={userEmail}
                      onPay={() => handleSharedLoanPay(loan.id)}
                      onAddExtraPayment={(nextAmount) => handleSharedLoanExtraPayment(loan.id, nextAmount)}
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
                  <h2>Pagos y refuerzos recientes</h2>
                </div>
                <span className="status-pill status-pill--neutral">{sharedPayments.length} movimiento(s)</span>
              </div>

              {sharedLoansError ? <div className="alert-banner alert-banner--danger">{sharedLoansError}</div> : null}

              {sharedPayments.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <h3>No hay movimientos compartidos todavia</h3>
                  <p>Cuando registres la primera cuota o un refuerzo, aparecera aqui.</p>
                </div>
              ) : (
                <div className="history-list">
                  {sharedPayments.map((payment) => (
                    <article key={payment.id} className="history-item">
                      <div className="history-item__identity">
                        <CompanyLogo
                          entityName={payment.lenderEmail === normalizedUserEmail ? payment.borrowerEmail : payment.lenderEmail}
                          kind="loan"
                          size="sm"
                        />
                        <div>
                          <strong>{payment.title}</strong>
                          <p className="history-item__entity">
                            {payment.lenderEmail === normalizedUserEmail ? "Me deben" : "Debo"} · {payment.recordedByEmail}
                          </p>
                          <p>
                            {payment.paymentType === "loan_extra_payment"
                              ? "Refuerzo aplicado"
                              : payment.installmentNumber && payment.installmentsTotal
                                ? `Cuota ${payment.installmentNumber}/${payment.installmentsTotal}`
                                : "Movimiento compartido"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <strong>{formatCurrency(payment.amount)}</strong>
                        <p>
                          {formatDate(payment.paidAt)}
                          {payment.paymentType === "loan_extra_payment"
                            ? " · No mueve la cuota"
                            : payment.nextDueDate
                              ? ` · Proximo ${formatDate(payment.nextDueDate)}`
                              : " · Prestamo cerrado"}
                        </p>
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

      {isSharedComposerOpen ? (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="shared-loan-modal-title">
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <SharedLoanForm
              values={sharedLoanDraft}
              mode="create"
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
