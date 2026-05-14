import { useEffect, useState } from "react";
import { CompanyLogo } from "./CompanyLogo";
import { formatCurrency, formatDateTime } from "../lib/finance";
import {
  getSharedLoanCounterpartyEmail,
  getSharedLoanOriginalSettlementAmount,
  getSharedLoanPaidAmount,
  getSharedLoanPayerLabel,
  getSharedLoanRoleLabel,
  getSharedLoanSettlementAmount,
  getSharedLoanSplitLabel,
  getSharedLoanSummary
} from "../lib/sharedLoans";
import type { SharedLoan } from "../types";

interface SharedLoanRowProps {
  loan: SharedLoan;
  currentUserEmail: string | null;
  confirmingDelete: boolean;
  onEdit: () => void;
  onRegisterPartialPayment: (nextAmount: string) => void;
  onToggleSettled: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function SharedLoanRow({
  loan,
  currentUserEmail,
  confirmingDelete,
  onEdit,
  onRegisterPartialPayment,
  onToggleSettled,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete
}: SharedLoanRowProps) {
  const counterpartEmail = getSharedLoanCounterpartyEmail(loan, currentUserEmail);
  const roleLabel = getSharedLoanRoleLabel(loan, currentUserEmail);
  const splitLabel = getSharedLoanSplitLabel(loan);
  const summary = getSharedLoanSummary(loan, currentUserEmail);
  const payerLabel = getSharedLoanPayerLabel(loan, currentUserEmail);
  const originalSettlementAmount = getSharedLoanOriginalSettlementAmount(loan);
  const paidAmount = getSharedLoanPaidAmount(loan);
  const remainingAmount = getSharedLoanSettlementAmount(loan);
  const [showPartialPaymentEditor, setShowPartialPaymentEditor] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [partialPaymentDraft, setPartialPaymentDraft] = useState("");
  const canSavePartialPayment = partialPaymentDraft.replace(/[^\d]/g, "").length > 0;

  useEffect(() => {
    setShowPartialPaymentEditor(false);
    setShowInfo(false);
    setPartialPaymentDraft("");
  }, [loan.id, loan.lastEditedAt]);

  return (
    <article className="entry-card entry-card--loan shared-loan-row">
      <div className="entry-card__main">
        <div className="entry-card__heading">
          <div className="entry-card__identity">
            <CompanyLogo entityName={counterpartEmail} kind="loan" searchText={`${counterpartEmail} ${loan.title}`} />
            <div className="entry-card__identity-copy">
              <div className="entry-card__chips">
                <span className={`status-pill ${roleLabel === "Me deben" ? "status-pill--today" : "status-pill--section-variable"}`}>
                  {roleLabel}
                </span>
                <span className="tag-chip tag-chip--loan">{splitLabel}</span>
                <span className={`status-pill ${loan.isCompleted ? "status-pill--success" : "status-pill--neutral"}`}>
                  {loan.isCompleted ? "Saldado" : "Abierto"}
                </span>
              </div>
              <p className="entry-card__entity">{counterpartEmail}</p>
              <h3>{loan.title}</h3>
            </div>
          </div>

          <div className="entry-card__amounts">
            <button
              type="button"
              className={`shared-info-toggle ${showInfo ? "is-active" : ""}`}
              aria-label={showInfo ? "Ocultar detalles" : "Mostrar detalles"}
              onClick={() => setShowInfo((current) => !current)}
            >
              !
            </button>
            <strong>{formatCurrency(remainingAmount)}</strong>
            <span>Saldo pendiente actual</span>
          </div>
        </div>

        <div className="shared-loan-row__stats">
          <div>
            <span>Ajuste original</span>
            <strong>{formatCurrency(originalSettlementAmount)}</strong>
          </div>
          <div>
            <span>Abonado</span>
            <strong>{formatCurrency(paidAmount)}</strong>
          </div>
          <div>
            <span>Restante</span>
            <strong>{formatCurrency(remainingAmount)}</strong>
          </div>
          <div>
            <span>Quien pago</span>
            <strong>{payerLabel}</strong>
          </div>
        </div>

        {showInfo ? (
          <div className="shared-loan-row__details">
            <p>{summary}</p>
            {loan.notes ? <p>{loan.notes}</p> : null}
            <p className="shared-loan-row__log">
              Modificado por {loan.lastEditedByEmail || "usuario"} el {formatDateTime(loan.lastEditedAt)}
            </p>
          </div>
        ) : null}

        <div className="shared-payment-box">
          <div className="entry-card__actions entry-card__actions--shared">
            <button
              type="button"
              className="outline-button"
              onClick={() => {
                setShowPartialPaymentEditor((current) => !current);
                if (showPartialPaymentEditor) {
                  setPartialPaymentDraft("");
                }
              }}
            >
              {showPartialPaymentEditor ? "Cancelar" : "Pago parcial"}
            </button>
            <button type="button" className="primary-button" onClick={onToggleSettled}>
              Saldar todo
            </button>
            <button
              type="button"
              className="ghost-button shared-icon-button"
              onClick={onEdit}
              aria-label="Editar gasto compartido"
              title="Editar gasto compartido"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M4 20l4.4-.9L18.8 8.7a1.7 1.7 0 000-2.4l-1.1-1.1a1.7 1.7 0 00-2.4 0L4.9 15.6 4 20z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {showPartialPaymentEditor ? (
            <div className="inline-editor inline-editor--shared-payment">
              <label className="inline-editor__field">
                <span>Monto del abono parcial</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={partialPaymentDraft}
                  onChange={(event) => setPartialPaymentDraft(event.target.value)}
                  placeholder="250000"
                />
              </label>
              <button
                type="button"
                className="outline-button"
                disabled={!canSavePartialPayment}
                onClick={() => {
                  onRegisterPartialPayment(partialPaymentDraft);
                  setPartialPaymentDraft("");
                  setShowPartialPaymentEditor(false);
                }}
              >
                Guardar pago
              </button>
            </div>
          ) : null}

          <div className="entry-card__actions entry-card__actions--shared">
            {confirmingDelete ? (
              <>
                <button type="button" className="danger-button" onClick={onConfirmDelete}>
                  Confirmar borrar
                </button>
                <button type="button" className="ghost-button" onClick={onCancelDelete}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" className="ghost-button ghost-button--danger" onClick={onAskDelete}>
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
