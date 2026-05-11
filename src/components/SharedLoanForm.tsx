import type { FormEvent, ReactNode } from "react";
import { formatCurrency, parseAmount } from "../lib/finance";
import type { SharedLoanDraft, SharedSplitDraftMode } from "../types";

interface SharedLoanFormProps {
  values: SharedLoanDraft;
  mode: "create" | "edit";
  error: string | null;
  isSubmitting: boolean;
  currentUserEmail: string | null;
  onChange: (field: keyof SharedLoanDraft, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  headerAction?: ReactNode;
  titleId?: string;
}

const SPLIT_OPTIONS: Array<{
  value: SharedSplitDraftMode;
  title: string;
  helper: string;
}> = [
  {
    value: "current_paid_equal",
    title: "Tu pagaste, dividido a partes iguales",
    helper: "La otra persona te devuelve la mitad."
  },
  {
    value: "current_paid_full",
    title: "Se te debe la cantidad total",
    helper: "Pagaste por completo y la otra persona te debe todo."
  },
  {
    value: "counterparty_paid_equal",
    title: "La otra persona pago, dividido a partes iguales",
    helper: "Tu le devuelves la mitad."
  },
  {
    value: "counterparty_paid_full",
    title: "A la otra persona se le debe la cantidad total",
    helper: "La otra persona pago por completo y tu le debes todo."
  }
];

export function SharedLoanForm({
  values,
  mode,
  error,
  isSubmitting,
  currentUserEmail,
  onChange,
  onSubmit,
  onReset,
  headerAction,
  titleId
}: SharedLoanFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const totalAmount = parseAmount(values.totalAmount);
  const settlementAmount =
    values.splitMode === "current_paid_full" || values.splitMode === "counterparty_paid_full"
      ? totalAmount
      : Math.round(totalAmount / 2);
  const roleLabel =
    values.splitMode === "current_paid_equal" || values.splitMode === "current_paid_full" ? "Te deben" : "Tu debes";
  const counterpartyLabel = values.counterpartyEmail.trim() || "el otro usuario";

  return (
    <form className="composer-card composer-card--loan" onSubmit={handleSubmit} noValidate>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gasto compartido</p>
          <h2 id={titleId}>{mode === "create" ? "Nuevo gasto entre usuarios" : "Editar gasto compartido"}</h2>
        </div>
        <div className="composer-card__header-actions">
          <span className="status-pill status-pill--kind status-pill--kind-loan">Ambos pueden editar</span>
          {headerAction}
        </div>
      </div>

      <div className="form-helper form-helper--loan">
        Registra quien pago, como se dividio el gasto y la app calcula automaticamente cuanto queda entre ambos.
      </div>

      <div className="field-grid">
        <label className="field field--full field--loan">
          <span>Tu usuario</span>
          <input type="email" value={currentUserEmail ?? ""} readOnly />
        </label>

        <label className="field field--full field--loan">
          <span>Email del otro usuario</span>
          <input
            type="email"
            value={values.counterpartyEmail}
            onChange={(event) => onChange("counterpartyEmail", event.target.value)}
            placeholder="Email del usuario"
            disabled={isSubmitting}
          />
        </label>

        <label className="field field--full field--loan">
          <span>Nombre o motivo del gasto</span>
          <input
            type="text"
            value={values.title}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="Super, alquiler temporal, cena, farmacia, viaje"
            disabled={isSubmitting}
          />
        </label>

        <label className="field field--full field--loan">
          <span>Monto total del gasto</span>
          <input
            type="text"
            inputMode="numeric"
            value={values.totalAmount}
            onChange={(event) => onChange("totalAmount", event.target.value)}
            placeholder="500000"
            disabled={isSubmitting}
          />
        </label>

        <div className="field field--full">
          <span className="field__label">Como se dividio este gasto</span>
          <div className="loan-mode-picker" role="group" aria-label="Como se dividio el gasto">
            {SPLIT_OPTIONS.map((option) => {
              const isActive = values.splitMode === option.value;
              const resolvedTitle =
                option.value === "counterparty_paid_equal"
                  ? `${counterpartyLabel} pago, dividido a partes iguales`
                  : option.value === "counterparty_paid_full"
                    ? `A ${counterpartyLabel} se le debe la cantidad total`
                    : option.title;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`loan-mode-option ${isActive ? "is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => onChange("splitMode", option.value)}
                >
                  <span className="loan-mode-option__label">{resolvedTitle}</span>
                  <span className="loan-mode-option__hint">{option.helper}</span>
                </button>
              );
            })}
          </div>
        </div>

        {totalAmount > 0 ? (
          <div className="field field--full">
            <div className="loan-preview">
              <strong>
                {roleLabel} {formatCurrency(settlementAmount)}
              </strong>
              <span>
                El gasto fue de {formatCurrency(totalAmount)} y queda ajustado automaticamente para {counterpartyLabel}.
              </span>
            </div>
          </div>
        ) : null}

        <label className="field field--full field--loan">
          <span>Notas</span>
          <textarea
            rows={4}
            value={values.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            placeholder="Ej.: compra del finde, gasto de farmacia, acordado por WhatsApp, detalle util."
            disabled={isSubmitting}
          />
        </label>
      </div>

      {error ? <div className="alert-banner alert-banner--danger">{error}</div> : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : mode === "create" ? "Guardar gasto compartido" : "Guardar cambios"}
        </button>
        <button type="button" className="ghost-button" onClick={onReset} disabled={isSubmitting}>
          {mode === "create" ? "Cancelar" : "Cerrar"}
        </button>
      </div>
    </form>
  );
}
