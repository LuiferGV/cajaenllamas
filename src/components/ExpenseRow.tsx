import { useEffect, useState } from "react";
import { CompanyLogo } from "./CompanyLogo";
import {
  describeItemStatus,
  formatCurrency,
  formatDate,
  getCurrentInstallmentNumber,
  hasScheduledLoanPlan,
  getDisplayEntity,
  getDisplayTitle,
  getInstallmentsAfterCurrent,
  getKindLabel,
  getKindTheme,
  getRecurrenceLabel,
  getRemainingInstallments,
  isLoan,
  parseAmount
} from "../lib/finance";
import type { FinanceItem, PaymentHistoryEntry } from "../types";

interface ExpenseRowProps {
  item: FinanceItem;
  lastPayment: PaymentHistoryEntry | null;
  confirmingDelete: boolean;
  onPay: () => void;
  onEdit: () => void;
  onSaveAmount: (nextAmount: string) => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function ExpenseRow({
  item,
  lastPayment,
  confirmingDelete,
  onPay,
  onEdit,
  onSaveAmount,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete
}: ExpenseRowProps) {
  const status = describeItemStatus(item);
  const displayTitle = getDisplayTitle(item);
  const displayEntity = getDisplayEntity(item);
  const showEntityLabel = item.conceptName.trim().length > 0 && displayEntity !== displayTitle;
  const remainingInstallments = getRemainingInstallments(item);
  const installmentsAfterCurrent = getInstallmentsAfterCurrent(item);
  const currentInstallmentNumber = getCurrentInstallmentNumber(item);
  const showPayButton = !item.isCompleted;
  const kindTheme = getKindTheme(item.kind);
  const hasLoanSchedule = hasScheduledLoanPlan(item);
  const canEditCycleAmount = (item.kind === "variable_expense" || item.kind === "recurring_expense") && !item.isCompleted;
  const [amountDraft, setAmountDraft] = useState(String(item.amount));
  const canSaveAmount = parseAmount(amountDraft) > 0 && parseAmount(amountDraft) !== item.amount;

  useEffect(() => {
    setAmountDraft(String(item.amount));
  }, [item.amount]);

  return (
    <article className={`entry-card entry-card--${kindTheme}`}>
      <div className="entry-card__main">
        <div className="entry-card__heading">
          <div className="entry-card__identity">
            <CompanyLogo entityName={displayEntity} kind={item.kind} />
            <div className="entry-card__identity-copy">
              <div className="entry-card__chips">
                <span className={`status-pill status-pill--${status.tone}`}>{status.label}</span>
                <span className={`tag-chip tag-chip--${kindTheme}`}>{getKindLabel(item.kind)}</span>
                <span className="tag-chip">{getRecurrenceLabel(item.recurrence)}</span>
                {hasLoanSchedule ? <span className="tag-chip">Cuotero</span> : null}
                {isLoan(item) && item.installmentsTotal !== null && currentInstallmentNumber !== null ? (
                  <span className="tag-chip">
                    {item.isCompleted
                      ? `${item.installmentsTotal}/${item.installmentsTotal} cuotas`
                      : `Cuota ${currentInstallmentNumber}/${item.installmentsTotal}`}
                  </span>
                ) : null}
              </div>
              {showEntityLabel ? <p className="entry-card__entity">{displayEntity}</p> : null}
              <h3>{displayTitle}</h3>
              <p>
                {item.notes ||
                  (item.kind === "variable_expense"
                    ? "Puedes editar el monto cuando llegue la nueva factura."
                    : "Todo listo para gestionar en un clic.")}
              </p>
            </div>
          </div>

          <div className="entry-card__amounts">
            <strong>{formatCurrency(item.amount)}</strong>
            <span>
              {item.kind === "recurring_expense"
                ? "Sin vencimiento fijo"
                : item.dueDate
                  ? `Vence ${formatDate(item.dueDate)}`
                  : "Sin cuotas pendientes"}
            </span>
          </div>
        </div>

        {isLoan(item) && item.installmentsTotal !== null ? (
          <div className="loan-progress">
            <div className="loan-progress__bar">
              <span
                className="loan-progress__fill"
                style={{ width: `${Math.min((item.installmentsPaid / item.installmentsTotal) * 100, 100)}%` }}
              />
            </div>
            <div className="loan-progress__meta">
              <span>{item.installmentsPaid} cuota(s) pagadas</span>
              <span>{installmentsAfterCurrent ?? 0} cuota(s) despues de esta</span>
            </div>
          </div>
        ) : null}

        <div className="entry-card__meta">
          <span>
            Ultimo pago: {lastPayment ? `${formatDate(lastPayment.paidAt)} - ${formatCurrency(lastPayment.amount)}` : "Aun no registrado"}
          </span>
          <span>
            {isLoan(item)
              ? item.isCompleted
                ? "Prestamo completado"
                : hasLoanSchedule
                  ? `Cuotero activo. Pendientes: ${remainingInstallments ?? 0} con esta incluida. Despues quedan ${installmentsAfterCurrent ?? 0}.`
                  : `Pendientes: ${remainingInstallments ?? 0} con esta incluida. Despues quedan ${installmentsAfterCurrent ?? 0}.`
              : item.kind === "variable_expense"
                ? "Monto editable al cambiar la factura"
                : item.kind === "recurring_expense"
                  ? "Categoria recurrente editable para seguir combustible, gimnasio, farmacia o super por separado"
                : "Gasto recurrente sin fecha de cierre"}
          </span>
        </div>

        {canEditCycleAmount ? (
          <div className="inline-editor">
            <label className="inline-editor__field">
              <span>{item.kind === "recurring_expense" ? "Monto de esta categoria" : "Monto del ciclo actual"}</span>
              <input type="text" inputMode="numeric" value={amountDraft} onChange={(event) => setAmountDraft(event.target.value)} />
            </label>
            <button
              type="button"
              className="outline-button"
              disabled={!canSaveAmount}
              onClick={() => onSaveAmount(amountDraft)}
            >
              Guardar monto
            </button>
          </div>
        ) : null}
      </div>

      <div className="entry-card__actions">
        {showPayButton ? (
          <button type="button" className="primary-button" onClick={onPay}>
            {isLoan(item) ? "Registrar cuota" : "Marcar como pagado"}
          </button>
        ) : null}

        <button type="button" className="outline-button" onClick={onEdit}>
          Editar
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
    </article>
  );
}
