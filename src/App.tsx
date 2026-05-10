import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import brandLogo from "../cajaenllamas.png";
import { AuthScreen } from "./components/AuthScreen";
import { CompanyLogo } from "./components/CompanyLogo";
import { ExpenseRow } from "./components/ExpenseRow";
import { FinanceForm } from "./components/FinanceForm";
import { HistoryPanel } from "./components/HistoryPanel";
import { MetricCard } from "./components/MetricCard";
import { useFinanceData } from "./hooks/useFinanceData";
import { useFirebaseSession, type AuthMode } from "./hooks/useFirebaseSession";
import {
  buildItemFromDraft,
  createEmptyDraft,
  deleteItem,
  draftFromItem,
  filterItems,
  formatCurrency,
  formatDate,
  getCompletionRatio,
  getCurrentInstallmentNumber,
  getDashboardMetrics,
  getDisplayEntity,
  getDisplayTitle,
  getKindTheme,
  getInstallmentsAfterCurrent,
  getNextActiveItem,
  getRemainingInstallments,
  getRecurrenceLabel,
  isLoan,
  parseAmount,
  registerPayment,
  seedInitialHistory,
  todayKey,
  upsertItem,
  validateDraft
} from "./lib/finance";
import type { EntryKind, FinanceDraft, FinanceItem, FinanceState } from "./types";

type FormMode = "create" | "edit";
type AppView = "dashboard" | "history";

const FILTER_OPTIONS: Array<{ value: EntryKind | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "loan", label: "Prestamos" },
  { value: "variable_expense", label: "Gastos variables" },
  { value: "fixed_expense", label: "Gastos fijos" }
];

export default function App() {
  const { sessionState, userEmail, userId, authError, isSubmitting, login, register, logout } = useFirebaseSession();
  const { financeState, persistState } = useFinanceData(sessionState === "authenticated", userId);
  const [draft, setDraft] = useState<FinanceDraft>(() => createEmptyDraft());
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [kindFilter, setKindFilter] = useState<EntryKind | "all">("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [loginEmail, setLoginEmail] = useState("luifer.gv@gmail.com");
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
    if (!isComposerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsComposerOpen(false);
        setDraft(createEmptyDraft());
        setFormMode("create");
        setEditingId(null);
        setFormError(null);
        setPendingDeleteId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isComposerOpen]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const filteredItems = filterItems(financeState.items, deferredSearchTerm, kindFilter);
  const metrics = getDashboardMetrics(financeState);
  const overdueCount = metrics.overview.overdueCount;
  const nextDueItem = getNextActiveItem(financeState.items);
  const activeLoanItems = financeState.items.filter((item) => item.kind === "loan" && !item.isCompleted);
  const activeVariableItems = financeState.items.filter((item) => item.kind === "variable_expense" && !item.isCompleted);
  const activeFixedItems = financeState.items.filter((item) => item.kind === "fixed_expense" && !item.isCompleted);
  const loanCompletionRatio = getCompletionRatio(metrics.loans);
  const authScreenError = manualAuthError ?? authError;

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
          historicalPaymentsCount: nextKind === "loan" ? "0" : current.historicalPaymentsCount,
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

  const resetForm = () => {
    setDraft(createEmptyDraft());
    setFormMode("create");
    setEditingId(null);
    setFormError(null);
    setPendingDeleteId(null);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    resetForm();
  };

  const openCreateComposer = () => {
    resetForm();
    setIsComposerOpen(true);
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

          if (formMode === "create") {
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

      setActiveView("dashboard");
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
        if (!item || item.kind !== "variable_expense") return current;

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
              className={`topbar__nav-button ${activeView === "dashboard" ? "is-active" : ""}`}
              onClick={() => setActiveView("dashboard")}
            >
              Panel principal
            </button>
            <button
              type="button"
              className={`topbar__nav-button ${activeView === "history" ? "is-active" : ""}`}
              onClick={() => setActiveView("history")}
            >
              Pagos recientes
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
              onClick={openCreateComposer}
              aria-label="Nuevo registro"
              title="Nuevo registro"
            >
              +
            </button>
          </div>
        </div>
      </header>

      {activeView === "dashboard" ? (
        <>
          <section className="metrics-grid">
            <MetricCard
              label="Pagado este mes"
              value={formatCurrency(metrics.overview.paidAmount)}
              detail={`${paidCountThisMonth} pago(s) registrados en el ciclo actual`}
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
          </section>

          <section className="summary-stage">
            <article className="surface-card hero-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Dashboard</p>
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

                      return (
                        <article key={item.id} className="summary-loan-card">
                          <div className="summary-loan-card__identity">
                            <CompanyLogo entityName={displayEntity} kind={item.kind} size="sm" />
                            <div className="summary-loan-card__copy">
                              <strong>{displayTitle}</strong>
                              <p>{displayEntity}</p>
                            </div>
                          </div>

                          <div className="summary-loan-card__stats">
                            <div>
                              <span>Monto</span>
                              <strong>{formatCurrency(item.amount)}</strong>
                            </div>
                            <div>
                              <span>Cuota actual</span>
                              <strong>
                                {currentInstallmentNumber && item.installmentsTotal
                                  ? `${currentInstallmentNumber}/${item.installmentsTotal}`
                                  : "Sin dato"}
                              </strong>
                            </div>
                            <div>
                              <span>Pendientes</span>
                              <strong>{remainingInstallments} con esta</strong>
                            </div>
                            <div>
                              <span>Luego de esta</span>
                              <strong>{installmentsAfterCurrent}</strong>
                            </div>
                          </div>

                          <p className="summary-loan-card__due">
                            {item.dueDate ? `Vence ${formatDate(item.dueDate)}` : "Sin vencimiento pendiente"}
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
                            <CompanyLogo entityName={displayEntity} kind={item.kind} size="sm" />
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
                            <CompanyLogo entityName={displayEntity} kind={item.kind} size="sm" />
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
                    Puedes cargar un prestamo por cuotas, un gasto fijo sin fin o un gasto variable cuyo monto cambie cada mes.
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
    </div>
  );
}
