import { CompanyLogo } from "./CompanyLogo";
import { formatDateTime } from "../lib/finance";
import {
  getDiscountCategoryLabel,
  getDiscountCategoryTheme,
  getDiscountExpiryLabel,
  isDiscountExpiringSoon
} from "../lib/discounts";
import type { DiscountItem } from "../types";

interface DiscountCardProps {
  discount: DiscountItem;
  confirmingDelete: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function DiscountCard({
  discount,
  confirmingDelete,
  onEdit,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete
}: DiscountCardProps) {
  const theme = getDiscountCategoryTheme(discount.category);
  const expiringSoon = isDiscountExpiringSoon(discount);

  return (
    <article className={`discount-card discount-card--${theme}`}>
      <div className="discount-card__top">
        <div className="discount-card__brand">
          <CompanyLogo
            entityName={discount.providerName}
            kind="recurring_expense"
            size="sm"
            searchText={`${discount.providerName} ${discount.commerceName}`}
          />
          <div>
            <div className="entry-card__chips">
              <span className={`status-pill status-pill--section status-pill--section-${theme}`}>
                {getDiscountCategoryLabel(discount.category)}
              </span>
              <span className={`status-pill ${expiringSoon ? "status-pill--section-variable" : "status-pill--neutral"}`}>
                {getDiscountExpiryLabel(discount)}
              </span>
            </div>
            <p className="discount-card__provider">{discount.providerName}</p>
            <h3>{discount.commerceName}</h3>
          </div>
        </div>

        <div className="discount-card__actions">
          <div className="discount-card__percent">
            <strong>{discount.discountPercent}%</strong>
            <span>off</span>
          </div>
          <button
            type="button"
            className="ghost-button shared-icon-button"
            onClick={onEdit}
            aria-label="Editar descuento"
            title="Editar descuento"
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
          <button
            type="button"
            className="ghost-button shared-icon-button shared-icon-button--danger"
            onClick={onAskDelete}
            aria-label="Eliminar descuento"
            title="Eliminar descuento"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M7 7l10 10M17 7L7 17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="discount-card__meta">
        <p>{discount.conditions || "Disponible sin condicion adicional cargada."}</p>
        {discount.notes ? <p>{discount.notes}</p> : null}
      </div>

      <div className="discount-card__footer">
        <span>Creado por {discount.createdByEmail || "usuario"}</span>
        <span>Actualizado {formatDateTime(discount.updatedAt)}</span>
      </div>

      {confirmingDelete ? (
        <div className="entry-card__actions discount-card__confirm">
          <button type="button" className="danger-button" onClick={onConfirmDelete}>
            Confirmar borrar
          </button>
          <button type="button" className="ghost-button" onClick={onCancelDelete}>
            Cancelar
          </button>
        </div>
      ) : null}
    </article>
  );
}
