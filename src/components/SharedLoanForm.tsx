import type { FormEvent, ReactNode } from "react";
import { parseAmount } from "../lib/finance";
import type { SharedLoanDraft } from "../types";

interface SharedLoanFormProps {
  values: SharedLoanDraft;
  mode: "create";
  error: string | null;
  currentUserEmail: string | null;
  onChange: (field: keyof SharedLoanDraft, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  headerAction?: ReactNode;
  titleId?: string;
}

export function SharedLoanForm({
  values,
  error,
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

  const installmentsTotal = parseAmount(values.installmentsTotal);
  const principalAmount = parseAmount(values.principalAmount);
  const installmentAmount = parseAmount(values.amount);
  const estimatedAfterCurrent =
    principalAmount > 0 && installmentAmount > 0 ? Math.max(principalAmount - installmentAmount, 0) : 0;

  return (
    <form className="composer-card composer-card--loan" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gasto compartido</p>
          <h2 id={titleId}>Nuevo prestamo entre usuarios</h2>
        </div>
        <div className="composer-card__header-actions">
          <span className="status-pill status-pill--kind status-pill--kind-loan">Solo edita el acreedor</span>
          {headerAction}
        </div>
      </div>

      <div className="form-helper form-helper--loan">
        Solo tu, como acreedor, podras registrar cuotas o refuerzos. La otra persona vera este prestamo en modo lectura.
      </div>

      <div className="field-grid">
        <label className="field field--full field--loan">
          <span>Tu cuenta acreedora</span>
          <input type="email" value={currentUserEmail ?? ""} readOnly />
        </label>

        <label className="field field--full field--loan">
          <span>Email de quien te debe</span>
          <input
            type="email"
            value={values.borrowerEmail}
            onChange={(event) => onChange("borrowerEmail", event.target.value)}
            placeholder="patohab@gmail.com"
          />
        </label>

        <label className="field field--full field--loan">
          <span>Nombre o motivo del prestamo</span>
          <input
            type="text"
            value={values.title}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="Prestamo efectivo, viaje, moto, adelanto"
          />
        </label>

        <label className="field field--loan">
          <span>Monto total prestado</span>
          <input
            type="text"
            inputMode="numeric"
            value={values.principalAmount}
            onChange={(event) => onChange("principalAmount", event.target.value)}
            placeholder="5000000"
          />
        </label>

        <label className="field field--loan">
          <span>Monto de cada cuota</span>
          <input
            type="text"
            inputMode="numeric"
            value={values.amount}
            onChange={(event) => onChange("amount", event.target.value)}
            placeholder="1000000"
          />
        </label>

        <label className="field field--loan">
          <span>Cuotas pactadas</span>
          <input
            type="text"
            inputMode="numeric"
            value={values.installmentsTotal}
            onChange={(event) => onChange("installmentsTotal", event.target.value)}
            placeholder="5"
          />
        </label>

        <label className="field field--loan">
          <span>Primera cuota vence</span>
          <input type="date" value={values.dueDate} onChange={(event) => onChange("dueDate", event.target.value)} />
        </label>

        {principalAmount > 0 && installmentAmount > 0 ? (
          <div className="field field--full">
            <div className="loan-preview">
              <strong>{installmentsTotal > 0 ? `${installmentsTotal} cuota(s) previstas` : "Prestamo compartido"}</strong>
              <span>Despues de cobrar la primera cuota quedarian {estimatedAfterCurrent.toLocaleString("es-PY")} Gs. de saldo.</span>
            </div>
          </div>
        ) : null}

        <label className="field field--full field--loan">
          <span>Notas</span>
          <textarea
            rows={4}
            value={values.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            placeholder="Ej.: solo yo registro pagos, acuerdo verbal, observaciones o recordatorios."
          />
        </label>
      </div>

      {error ? <div className="alert-banner alert-banner--danger">{error}</div> : null}

      <div className="form-actions">
        <button type="submit" className="primary-button">
          Guardar prestamo compartido
        </button>
        <button type="button" className="ghost-button" onClick={onReset}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
