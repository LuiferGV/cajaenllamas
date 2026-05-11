import { useEffect, useState } from "react";
import { CompanyLogo } from "./CompanyLogo";
import { formatCurrency, formatDate } from "../lib/finance";
import {
  getSharedLoanCounterpartyEmail,
  getSharedLoanCurrentInstallmentNumber,
  getSharedLoanInstallmentsAfterCurrent,
  getSharedLoanRoleLabel,
  isSharedLoanEditable
} from "../lib/sharedLoans";
import type { SharedLoan } from "../types";

interface SharedLoanRowProps {
  loan: SharedLoan;
  currentUserId: string | null;
  onPay: () => void;
  onAddExtraPayment: (nextAmount: string) => void;
}

export function SharedLoanRow({ loan, currentUserId, onPay, onAddExtraPayment }: SharedLoanRowProps) {
  const isEditable = isSharedLoanEditable(loan, currentUserId);
  const counterpartEmail = getSharedLoanCounterpartyEmail(loan, currentUserId);
  const currentInstallment = getSharedLoanCurrentInstallmentNumber(loan);
  const installmentsAfterCurrent = getSharedLoanInstallmentsAfterCurrent(loan);
  const [showExtraPayment, setShowExtraPayment] = useState(false);
  const [extraPaymentDraft, setExtraPaymentDraft] = useState("");
  const canSaveExtraPayment = extraPaymentDraft.replace(/[^\d]/g, "").length > 0;

  useEffect(() => {
    setShowExtraPayment(false);
    setExtraPaymentDraft("");
  }, [loan.id]);

  return (
    <article className="entry-card entry-card--loan shared-loan-row">
      <div className="entry-card__main">
        <div className="entry-card__heading">
          <div className="entry-card__identity">
            <CompanyLogo entityName={counterpartEmail} kind="loan" />
            <div className="entry-card__identity-copy">
              <div className="entry-card__chips">
                <span className={`status-pill ${loan.isCompleted ? "status-pill--success" : "status-pill--today"}`}>
                  {loan.isCompleted ? "Completado" : getSharedLoanRoleLabel(loan, currentUserId)}
                </span>
                <span className="tag-chip tag-chip--loan">Prestamo compartido</span>
                <span className="tag-chip">
                  Cuota {currentInstallment}/{loan.installmentsTotal}
                </span>
              </div>
              <p className="entry-card__entity">{counterpartEmail}</p>
              <h3>{loan.title}</h3>
              <p>
                {isEditable
                  ? "Tu eres el acreedor de esta deuda. Solo tu puedes registrar cuotas o refuerzos."
                  : `Solo ${loan.lenderEmail} puede registrar pagos en este prestamo.`}
              </p>
            </div>
          </div>

          <div className="entry-card__amounts">
            <strong>{formatCurrency(loan.amount)}</strong>
            <span>{loan.dueDate ? `Vence ${formatDate(loan.dueDate)}` : "Prestamo cerrado"}</span>
          </div>
        </div>

        <div className="shared-loan-row__stats">
          <div>
            <span>Prestamo total</span>
            <strong>{formatCurrency(loan.principalAmount)}</strong>
          </div>
          <div>
            <span>Saldo restante</span>
            <strong>{formatCurrency(loan.principalRemaining)}</strong>
          </div>
          <div>
            <span>Cuotas pagadas</span>
            <strong>
              {loan.installmentsPaid}/{loan.installmentsTotal}
            </strong>
          </div>
          <div>
            <span>Luego de esta</span>
            <strong>{installmentsAfterCurrent}</strong>
          </div>
        </div>

        <div className="entry-card__meta">
          <span>Ultimo movimiento: {loan.lastPaidAt ? formatDate(loan.lastPaidAt) : "Aun sin pagos"}</span>
          <span>{loan.notes || "Sin notas adicionales para este prestamo compartido."}</span>
        </div>

        {isEditable && !loan.isCompleted ? (
          <div className="loan-extra-payment">
            <div className="loan-extra-payment__summary">
              <span>La cuota mensual sigue activa hasta que marques el pago normal.</span>
              <span>Un refuerzo descuenta saldo sin mover la cuota actual.</span>
            </div>

            <div className="entry-card__actions entry-card__actions--shared">
              <button type="button" className="primary-button" onClick={onPay}>
                Registrar cuota
              </button>
              <button
                type="button"
                className="outline-button loan-extra-payment__toggle"
                onClick={() => {
                  setShowExtraPayment((current) => !current);
                  if (showExtraPayment) {
                    setExtraPaymentDraft("");
                  }
                }}
              >
                {showExtraPayment ? "Cancelar refuerzo" : "Agregar refuerzo"}
              </button>
            </div>

            {showExtraPayment ? (
              <div className="inline-editor inline-editor--loan-extra">
                <label className="inline-editor__field">
                  <span>Monto del refuerzo</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={extraPaymentDraft}
                    onChange={(event) => setExtraPaymentDraft(event.target.value)}
                    placeholder="250000"
                  />
                </label>
                <button
                  type="button"
                  className="outline-button"
                  disabled={!canSaveExtraPayment}
                  onClick={() => {
                    onAddExtraPayment(extraPaymentDraft);
                    setExtraPaymentDraft("");
                    setShowExtraPayment(false);
                  }}
                >
                  Guardar refuerzo
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
