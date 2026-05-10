import { CompanyLogo } from "./CompanyLogo";
import { getCompanyBrand } from "../lib/companyBrand";
import type { ChangeEvent, FormEvent } from "react";
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
  }
};

interface FinanceFormProps {
  values: FinanceDraft;
  mode: "create" | "edit";
  error: string | null;
  onChange: (field: keyof FinanceDraft, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function FinanceForm({ values, mode, error, onChange, onSubmit, onReset }: FinanceFormProps) {
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
      : "Ej.: Personal, Tigo, Particular";
  const conceptLabel = isLoan ? "Tipo o destino del prestamo" : "Tipo de gasto";
  const conceptPlaceholder = isLoan
    ? "Ej.: Auto, Electrodomesticos, Refaccion, Libre inversion"
    : isVariableExpense
      ? "Ej.: Agua, Luz"
      : "Ej.: Internet, Domestica, Ninera";

  return (
    <form className={`composer-card composer-card--${kindTheme}`} onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Carga rapida</p>
          <h2>{mode === "create" ? "Nuevo compromiso" : "Editar registro"}</h2>
        </div>
        <span className={`status-pill status-pill--kind status-pill--kind-${kindTheme}`}>{KIND_COPY[values.kind].title}</span>
      </div>

      <div className={`form-helper form-helper--${kindTheme}`}>
        {isLoan
          ? "Prestamo por cuotas: primero defines la entidad, luego para que fue el prestamo, y el sistema sigue las cuotas hasta cerrarlo."
          : isVariableExpense
            ? "Gasto variable: ideal para servicios como agua o luz, donde el monto cambia y lo ajustas en cada ciclo."
            : "Gasto fijo: pensado para internet, domestica, ninera u otros compromisos que se repiten mes a mes."}
      </div>

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
          <span>{isLoan ? "Monto por cuota" : isVariableExpense ? "Monto actual del ciclo" : "Monto recurrente"}</span>
          <input type="text" inputMode="numeric" value={values.amount} onChange={handleFieldChange("amount")} placeholder="650000" />
        </label>

        <label className={`field field--${kindTheme}`}>
          <span>{dueDateLabel}</span>
          <input type="date" value={values.dueDate} onChange={handleFieldChange("dueDate")} />
        </label>

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
                : isLoan
                  ? "Ej.: banco, numero de operacion o detalle del prestamo."
                  : "Opcional: alias, cuenta asociada o detalle util."
            }
          />
        </label>
      </div>

      {mode === "create" ? (
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
              ? "Si cargas, por ejemplo, la cuota 25 de 60, la app crea automaticamente el historial de las 24 cuotas anteriores y te deja seguir desde ahi."
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
