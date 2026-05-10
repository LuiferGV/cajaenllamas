import { CompanyLogo } from "./CompanyLogo";
import { getCompanyBrand } from "../lib/companyBrand";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { getKindTheme, KIND_OPTIONS, parseCount, RECURRENCE_OPTIONS } from "../lib/finance";
import type { FinanceDraft } from "../types";

const KIND_COPY: Record<
  FinanceDraft["kind"],
  {
    title: string;
    hint: string;
  }
> = {
  loan: {
    title: "Prestamo",
    hint: "Cuotas con principio y fin"
  },
  fixed_expense: {
    title: "Gasto fijo",
    hint: "Mismo compromiso todos los ciclos"
  },
  variable_expense: {
    title: "Gasto variable",
    hint: "Monto editable segun la factura"
  },
  recurring_expense: {
    title: "Gasto recurrente",
    hint: "Categoria flexible que vuelve seguido"
  }
};

const LOAN_PLAN_OPTIONS = [
  {
    value: "fixed",
    label: "Cuota fija",
    hint: "Un mismo monto todos los meses"
  },
  {
    value: "schedule",
    label: "Agregar cuotero",
    hint: "Cargas cada mes con su propio monto"
  }
] as const;

interface FinanceFormProps {
  values: FinanceDraft;
  mode: "create" | "edit";
  error: string | null;
  onChange: (field: keyof FinanceDraft, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onLoanPlanModeChange: (mode: FinanceDraft["loanPlanMode"]) => void;
  onGenerateInstallmentPlan: () => void;
  onInstallmentPlanChange: (installmentNumber: number, field: "dueDate" | "amount", value: string) => void;
  headerAction?: ReactNode;
  titleId?: string;
}

export function FinanceForm({
  values,
  mode,
  error,
  onChange,
  onSubmit,
  onReset,
  onLoanPlanModeChange,
  onGenerateInstallmentPlan,
  onInstallmentPlanChange,
  headerAction,
  titleId
}: FinanceFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleFieldChange =
    (field: keyof FinanceDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      onChange(field, event.target.value);
    };

  const isLoan = values.kind === "loan";
  const isVariableExpense = values.kind === "variable_expense";
  const isRecurringExpense = values.kind === "recurring_expense";
  const isScheduledLoan = isLoan && values.loanPlanMode === "schedule";
  const kindTheme = getKindTheme(values.kind);
  const companyBrand = values.entityName.trim() ? getCompanyBrand(values.entityName) : null;
  const totalInstallments = parseCount(values.installmentsTotal);
  const currentInstallmentNumber = parseCount(values.currentInstallmentNumber);
  const installmentPreviewNumber =
    mode === "create"
      ? currentInstallmentNumber
      : Math.min(parseCount(values.installmentsPaid) + 1, totalInstallments || parseCount(values.installmentsPaid) + 1);
  const installmentsAfterCurrent =
    isLoan && totalInstallments > 0 && installmentPreviewNumber > 0
      ? Math.max(totalInstallments - Math.min(installmentPreviewNumber, totalInstallments), 0)
      : 0;
  const loanAlreadyCompleted =
    isLoan &&
    totalInstallments > 0 &&
    mode === "edit" &&
    parseCount(values.installmentsPaid) >= totalInstallments;
  const dueDateLabel = isLoan
    ? mode === "create"
      ? "Vencimiento de la cuota actual"
      : loanAlreadyCompleted
        ? "Fecha de la ultima cuota"
        : "Proxima cuota vence"
    : "Proximo vencimiento";
  const entityPlaceholder = isLoan
    ? "Ej.: Itau, Continental, Coomecipar"
    : isVariableExpense
      ? "Ej.: Essap, Ande"
      : isRecurringExpense
        ? "Ej.: Petrobras, Smart Fit, Punto Farma, Particular"
        : "Ej.: Personal, Tigo, Particular";
  const conceptLabel = isLoan ? "Tipo o destino del prestamo" : isRecurringExpense ? "Categoria o gasto recurrente" : "Tipo de gasto";
  const conceptPlaceholder = isLoan
    ? "Ej.: Auto, Electrodomesticos, Refaccion, Libre inversion"
    : isVariableExpense
      ? "Ej.: Agua, Luz"
      : isRecurringExpense
        ? "Ej.: Combustible, Gimnasio, Bebe, Farmacia, Super"
        : "Ej.: Internet, Domestica, Ninera";
  const hasInstallmentPlan = values.installmentPlan.length > 0;

  return (
    <form className={`composer-card composer-card--${kindTheme}`} onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Carga rapida</p>
          <h2 id={titleId}>{mode === "create" ? "Nuevo compromiso" : "Editar registro"}</h2>
        </div>
        <div className="composer-card__header-actions">
          <span className={`status-pill status-pill--kind status-pill--kind-${kindTheme}`}>{KIND_COPY[values.kind].title}</span>
          {headerAction}
        </div>
      </div>

      <div className={`form-helper form-helper--${kindTheme}`}>
        {isLoan
          ? isScheduledLoan
            ? "Prestamo con cuotero: defines el monto total, cargas todas las cuotas con sus montos reales y luego puedes sumar refuerzos sin adelantar la cuota."
            : "Prestamo por cuotas: defines el monto total del prestamo, el valor de la cuota y luego el sistema sigue cada vencimiento hasta cerrarlo."
          : isVariableExpense
            ? "Gasto variable: ideal para servicios como agua o luz, donde el monto cambia y lo ajustas en cada ciclo."
            : isRecurringExpense
              ? "Gasto recurrente: pensado para combustible, gimnasio, bebe, farmacia o categorias que reaparecen y quieres medir por separado."
            : "Gasto fijo: pensado para internet, domestica, ninera u otros compromisos que se repiten mes a mes."}
      </div>

      {isLoan ? (
        <div className="loan-mode-picker" role="group" aria-label="Modalidad del prestamo">
          {LOAN_PLAN_OPTIONS.map((option) => {
            const isActive = values.loanPlanMode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={`loan-mode-option ${isActive ? "is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => onLoanPlanModeChange(option.value)}
              >
                <span className="loan-mode-option__label">{option.label}</span>
                <span className="loan-mode-option__hint">{option.hint}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="kind-selector" role="radiogroup" aria-label="Tipo de registro">
        {KIND_OPTIONS.map((option) => {
          const optionTheme = getKindTheme(option.value);
          const isActive = values.kind === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`kind-option kind-option--${optionTheme} ${isActive ? "is-active" : ""}`}
              aria-pressed={isActive}
              onClick={() => onChange("kind", option.value)}
            >
              <span className="kind-option__label">{KIND_COPY[option.value].title}</span>
              <span className="kind-option__hint">{KIND_COPY[option.value].hint}</span>
            </button>
          );
        })}
      </div>

      <div className="field-grid">
        <label className={`field field--full field--${kindTheme}`}>
          <span>Empresa o entidad</span>
          <input
            type="text"
            value={values.entityName}
            onChange={handleFieldChange("entityName")}
            placeholder={entityPlaceholder}
          />
        </label>

        {companyBrand ? (
          <div className="field field--full">
            <div className={`logo-preview logo-preview--${kindTheme}`}>
              <CompanyLogo entityName={values.entityName} kind={values.kind} size="sm" />
              <div className="logo-preview__copy">
                <strong>{companyBrand.isFallback ? "Logo generico asignado" : `Logo detectado: ${companyBrand.label}`}</strong>
                <span>
                  {companyBrand.isFallback
                    ? "Todavia no hay una marca cargada para esta entidad. Cuando agregues su archivo a LOGOS, se va a tomar automaticamente."
                    : "Se va a usar esta marca cada vez que el nombre de la entidad incluya esa palabra clave."}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <label className={`field field--full field--${kindTheme}`}>
          <span>{conceptLabel}</span>
          <input type="text" value={values.conceptName} onChange={handleFieldChange("conceptName")} placeholder={conceptPlaceholder} />
        </label>

        <label className={`field field--${kindTheme}`}>
          <span>
            {isLoan
              ? isScheduledLoan
                ? "Monto base para precargar"
                : "Monto por cuota"
              : isVariableExpense
                ? "Monto actual del ciclo"
                : isRecurringExpense
                  ? "Monto de la categoria"
                : "Monto recurrente"}
          </span>
          <input type="text" inputMode="numeric" value={values.amount} onChange={handleFieldChange("amount")} placeholder="650000" />
        </label>

        {isLoan ? (
          <label className="field field--loan">
            <span>Monto total del prestamo</span>
            <input
              type="text"
              inputMode="numeric"
              value={values.principalAmount}
              onChange={handleFieldChange("principalAmount")}
              placeholder="125000000"
            />
          </label>
        ) : null}

        {!isRecurringExpense ? (
          <label className={`field field--${kindTheme}`}>
            <span>{dueDateLabel}</span>
            <input type="date" value={values.dueDate} onChange={handleFieldChange("dueDate")} />
          </label>
        ) : null}

        {isLoan ? (
          <>
            <label className="field field--loan">
              <span>Cuotas totales</span>
              <input
                type="text"
                inputMode="numeric"
                value={values.installmentsTotal}
                onChange={handleFieldChange("installmentsTotal")}
                placeholder="12"
              />
            </label>

            {mode === "create" ? (
              <label className="field field--loan">
                <span>Numero de cuota que vas a cargar ahora</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={values.currentInstallmentNumber}
                  onChange={handleFieldChange("currentInstallmentNumber")}
                  placeholder="25"
                />
              </label>
            ) : null}

            {mode === "edit" ? (
              <label className="field field--loan">
                <span>Cuotas ya pagadas</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={values.installmentsPaid}
                  onChange={handleFieldChange("installmentsPaid")}
                  placeholder="0"
                />
              </label>
            ) : null}

            {totalInstallments > 0 && installmentPreviewNumber > 0 ? (
              <div className="field field--full">
                <div className="loan-preview">
                  <strong>
                    {loanAlreadyCompleted
                      ? `Prestamo cerrado en ${totalInstallments}/${totalInstallments}`
                      : `Cuota ${Math.min(installmentPreviewNumber, totalInstallments)}/${totalInstallments}`}
                  </strong>
                  <span>
                    {loanAlreadyCompleted
                      ? "Ya no quedan cuotas por delante."
                      : `${installmentsAfterCurrent} cuota(s) quedaran despues de esta.`}
                  </span>
                </div>
              </div>
            ) : null}

            {isScheduledLoan ? (
              <div className="field field--full">
                <section className="installment-plan">
                  <div className="installment-plan__header">
                    <div>
                      <p className="eyebrow">Cuotero</p>
                      <h3>{hasInstallmentPlan ? "Cuotas precargadas" : "Genera tu cuotero"}</h3>
                    </div>
                    <button type="button" className="outline-button" onClick={onGenerateInstallmentPlan}>
                      {hasInstallmentPlan ? "Actualizar cuotero" : "Generar cuotero"}
                    </button>
                  </div>

                  <p className="installment-plan__copy">
                    {hasInstallmentPlan
                      ? "Puedes ajustar fecha y monto de cada cuota. Cuando registres un pago, la app tomara la siguiente fila automaticamente."
                      : "Primero define total de cuotas, numero de cuota actual y fecha actual. Luego genera el cuotero para completar todos los meses."}
                  </p>

                  {hasInstallmentPlan ? (
                    <div className="installment-plan__list">
                      {values.installmentPlan.map((entry) => {
                        const rowState =
                          entry.installmentNumber < currentInstallmentNumber
                            ? "is-previous"
                            : entry.installmentNumber === currentInstallmentNumber
                              ? "is-current"
                              : "";

                        return (
                          <div key={entry.installmentNumber} className={`installment-plan__row ${rowState}`}>
                            <div className="installment-plan__index">
                              <strong>Cuota {entry.installmentNumber}</strong>
                              <span>
                                {entry.installmentNumber < currentInstallmentNumber
                                  ? "Historial"
                                  : entry.installmentNumber === currentInstallmentNumber
                                    ? "Actual"
                                    : "Pendiente"}
                              </span>
                            </div>

                            <label className="field field--loan installment-plan__field">
                              <span>Vence</span>
                              <input
                                type="date"
                                value={entry.dueDate}
                                onChange={(event) => onInstallmentPlanChange(entry.installmentNumber, "dueDate", event.target.value)}
                              />
                            </label>

                            <label className="field field--loan installment-plan__field">
                              <span>Monto</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={entry.amount}
                                onChange={(event) => onInstallmentPlanChange(entry.installmentNumber, "amount", event.target.value)}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </>
        ) : (
          <div className={`field field--full field--${kindTheme}`}>
            <span>Recurrencia</span>
            <div className="recurrence-picker" role="group" aria-label="Recurrencia">
              {RECURRENCE_OPTIONS.map((option) => {
                const isActive = values.recurrence === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`recurrence-chip recurrence-chip--${kindTheme} ${isActive ? "is-active" : ""}`}
                    aria-pressed={isActive}
                    onClick={() => onChange("recurrence", option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className={`field field--full field--${kindTheme}`}>
          <span>Notas</span>
          <textarea
            rows={4}
            value={values.notes}
            onChange={handleFieldChange("notes")}
            placeholder={
              isVariableExpense
                ? "Ej.: cambia cada mes segun consumo."
                : isRecurringExpense
                  ? "Ej.: presupuesto mensual, detalle del gasto o referencia util."
                : isLoan
                  ? "Ej.: banco, numero de operacion o detalle del prestamo."
                  : "Opcional: alias, cuenta asociada o detalle util."
            }
          />
        </label>
      </div>

      {mode === "create" && !isRecurringExpense ? (
        <section className={`history-seed history-seed--${kindTheme}`}>
          <div className="history-seed__header">
            <div>
              <p className="eyebrow">Carga historica</p>
              <h3>Registros ya pagados antes de hoy</h3>
            </div>
            <span className={`status-pill status-pill--kind status-pill--kind-${kindTheme}`}>Opcional</span>
          </div>

          <p className="history-seed__copy">
            {isLoan
              ? isScheduledLoan
                ? "Si vas por la cuota 25 de 60, el cuotero puede cubrir todas las cuotas y la app deja las 24 anteriores en el historial para seguir desde la actual."
                : "Si cargas, por ejemplo, la cuota 25 de 60, la app crea automaticamente el historial de las 24 cuotas anteriores y te deja seguir desde ahi."
              : "Si este gasto ya tenia ciclos pagados antes de empezar a usar la app, puedes importarlos como historial inicial con un solo guardado."}
          </p>

          <div className="field-grid field-grid--history">
            {isLoan ? (
              <div className="seed-note seed-note--loan">
                Se registraran automaticamente {Math.max(currentInstallmentNumber - 1, 0)} cuota(s) anteriores en el historial.
              </div>
            ) : (
              <label className={`field field--${kindTheme}`}>
                <span>Ciclos pagados antes de esta carga</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={values.historicalPaymentsCount}
                  onChange={handleFieldChange("historicalPaymentsCount")}
                  placeholder="0"
                />
              </label>
            )}

            <div className={`field field--${kindTheme}`}>
              <span>El ciclo actual ya fue pagado</span>
              <div className="binary-picker" role="group" aria-label="Pago actual ya realizado">
                <button
                  type="button"
                  className={`binary-chip binary-chip--${kindTheme} ${values.registerCurrentCycleAsPaid === "no" ? "is-active" : ""}`}
                  aria-pressed={values.registerCurrentCycleAsPaid === "no"}
                  onClick={() => onChange("registerCurrentCycleAsPaid", "no")}
                >
                  No
                </button>
                <button
                  type="button"
                  className={`binary-chip binary-chip--${kindTheme} ${values.registerCurrentCycleAsPaid === "yes" ? "is-active" : ""}`}
                  aria-pressed={values.registerCurrentCycleAsPaid === "yes"}
                  onClick={() => onChange("registerCurrentCycleAsPaid", "yes")}
                >
                  Si
                </button>
              </div>
            </div>

            {values.registerCurrentCycleAsPaid === "yes" ? (
              <label className={`field field--${kindTheme}`}>
                <span>Fecha del pago ya realizado</span>
                <input type="date" value={values.currentCyclePaidAt} onChange={handleFieldChange("currentCyclePaidAt")} />
              </label>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        <button type="submit" className="primary-button">
          {mode === "create" ? "Guardar registro" : "Guardar cambios"}
        </button>
        <button type="button" className="outline-button" onClick={onReset}>
          {mode === "create" ? "Limpiar" : "Cancelar edicion"}
        </button>
      </div>
    </form>
  );
}
