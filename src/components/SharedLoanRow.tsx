import { CompanyLogo } from "./CompanyLogo";
import { formatCurrency, formatDateTime } from "../lib/finance";
import {
  getSharedLoanCounterpartyEmail,
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
  const settlementAmount = getSharedLoanSettlementAmount(loan);

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
              <p className="shared-loan-row__summary">{summary}</p>
            </div>
          </div>

          <div className="entry-card__amounts">
            <strong>{formatCurrency(settlementAmount)}</strong>
            <span>Gasto total {formatCurrency(loan.totalAmount)}</span>
          </div>
        </div>

        <div className="shared-loan-row__stats">
          <div>
            <span>Ajuste entre ustedes</span>
            <strong>{formatCurrency(settlementAmount)}</strong>
          </div>
          <div>
            <span>Quien pago</span>
            <strong>{payerLabel}</strong>
          </div>
          <div>
            <span>Division</span>
            <strong>{splitLabel}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>{loan.isCompleted ? "Saldado" : "Pendiente entre ustedes"}</strong>
          </div>
        </div>

        <div className="entry-card__meta">
          <span>{loan.notes || "Sin notas adicionales para este gasto compartido."}</span>
          <span className="shared-loan-row__log">
            Modificado por {loan.lastEditedByEmail || "usuario"} el {formatDateTime(loan.lastEditedAt)}
          </span>
        </div>

        <div className="entry-card__actions entry-card__actions--shared">
          <button type="button" className="outline-button" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="primary-button" onClick={onToggleSettled}>
            {loan.isCompleted ? "Reabrir" : "Marcar saldado"}
          </button>
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
    </article>
  );
}
