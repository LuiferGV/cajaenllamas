import { CompanyLogo } from "./CompanyLogo";
import { formatCurrency, formatDate, getDisplayEntity, getDisplayTitle, getKindLabel, getRecurrenceLabel } from "../lib/finance";
import type { PaymentHistoryEntry } from "../types";

interface HistoryPanelProps {
  history: PaymentHistoryEntry[];
}

export function HistoryPanel({ history }: HistoryPanelProps) {
  return (
    <section className="surface-card history-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Historico silencioso</p>
          <h2>Pagos recientes</h2>
        </div>
        <span className="status-pill status-pill--neutral">{history.length} movimientos</span>
      </div>

      {history.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <h3>El historial se llena solo</h3>
          <p>Cuando uses el boton de pago, cada movimiento quedara guardado aca sin pasos extra.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.slice(0, 8).map((entry) => {
            const displayTitle = getDisplayTitle(entry);
            const displayEntity = getDisplayEntity(entry);

            return (
              <article key={entry.id} className="history-item">
                <div className="history-item__identity">
                  <CompanyLogo entityName={displayEntity} kind={entry.kind} size="sm" />
                  <div>
                    <strong>{displayTitle}</strong>
                    {entry.conceptName.trim() ? <p className="history-item__entity">{displayEntity}</p> : null}
                    <p>
                      {getKindLabel(entry.kind)} - {getRecurrenceLabel(entry.recurrence)}
                      {entry.installmentNumber && entry.installmentsTotal
                        ? ` - Cuota ${entry.installmentNumber}/${entry.installmentsTotal}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div>
                  <strong>{formatCurrency(entry.amount)}</strong>
                  <p>
                    {formatDate(entry.paidAt)}
                    {entry.nextDueDate ? ` - Proximo ${formatDate(entry.nextDueDate)}` : " - Ciclo cerrado"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
