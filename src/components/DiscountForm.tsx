import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { CompanyLogo } from "./CompanyLogo";
import { getCompanyBrand } from "../lib/companyBrand";
import {
  buildDiscountFromDraft,
  DISCOUNT_CATEGORY_OPTIONS,
  getDiscountCategoryHint,
  getDiscountCategoryLabel,
  getDiscountHeroCopy
} from "../lib/discounts";
import type { DiscountDraft } from "../types";

interface DiscountFormProps {
  values: DiscountDraft;
  mode: "create" | "edit";
  error: string | null;
  isSubmitting: boolean;
  currentUserEmail: string | null;
  onChange: (field: keyof DiscountDraft, value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  headerAction?: ReactNode;
  titleId?: string;
}

export function DiscountForm({
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
}: DiscountFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleFieldChange =
    (field: keyof DiscountDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(field, event.target.value);
    };

  const providerBrand = values.providerName.trim()
    ? getCompanyBrand(`${values.providerName} ${values.commerceName}`.trim())
    : null;
  const previewDiscount = buildDiscountFromDraft(
    values,
    {
      userId: "preview",
      userEmail: currentUserEmail ?? "preview@cajaenllamas.app"
    },
    null
  );

  return (
    <form className="composer-card composer-card--recurring" onSubmit={handleSubmit} noValidate>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Descuentos compartidos</p>
          <h2 id={titleId}>{mode === "create" ? "Nuevo beneficio" : "Editar beneficio"}</h2>
        </div>
        <div className="composer-card__header-actions">
          <span className="status-pill status-pill--kind status-pill--kind-recurring">Visible para todos</span>
          {headerAction}
        </div>
      </div>

      <div className="form-helper form-helper--recurring">
        Carga beneficios de tarjetas, bancos y promos temporales para que cualquier usuario del sistema pueda verlos.
      </div>

      <div className="field-grid">
        <label className="field field--recurring">
          <span>Banco, tarjeta o emisor</span>
          <input
            type="text"
            value={values.providerName}
            onChange={handleFieldChange("providerName")}
            placeholder="Ej.: Atlas, Ueno, Itaú, Continental"
            disabled={isSubmitting}
          />
        </label>

        <label className="field field--recurring">
          <span>Comercio o marca</span>
          <input
            type="text"
            value={values.commerceName}
            onChange={handleFieldChange("commerceName")}
            placeholder="Ej.: Biggie, Shell, Punto Farma"
            disabled={isSubmitting}
          />
        </label>

        {providerBrand ? (
          <div className="field field--full">
            <div className="logo-preview logo-preview--recurring">
              <CompanyLogo
                entityName={values.providerName || values.commerceName}
                kind="recurring_expense"
                size="sm"
                searchText={`${values.providerName} ${values.commerceName}`}
              />
              <div className="logo-preview__copy">
                <strong>{providerBrand.isFallback ? "Logo generico asignado" : `Marca detectada: ${providerBrand.label}`}</strong>
                <span>
                  {providerBrand.isFallback
                    ? "Todavia no hay una marca cargada para este beneficio."
                    : "La tarjeta va a usar automaticamente este logo en la vista de descuentos."}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="field field--full">
          <span className="field__label">Categoria</span>
          <div className="discount-category-picker" role="group" aria-label="Categoria del descuento">
            {DISCOUNT_CATEGORY_OPTIONS.map((option) => {
              const isActive = values.category === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`discount-category-option discount-category-option--${option.value} ${isActive ? "is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => onChange("category", option.value)}
                >
                  <span className="discount-category-option__label">{option.label}</span>
                  <span className="discount-category-option__hint">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="field field--recurring">
          <span>Descuento (%)</span>
          <input
            type="text"
            inputMode="numeric"
            value={values.discountPercent}
            onChange={handleFieldChange("discountPercent")}
            placeholder="30"
            disabled={isSubmitting}
          />
        </label>

        <label className="field field--recurring">
          <span>Cuando aplica</span>
          <input
            type="text"
            value={values.conditions}
            onChange={handleFieldChange("conditions")}
            placeholder="Ej.: los martes, pagando con credito, tope Gs.150.000"
            disabled={isSubmitting}
          />
        </label>

        <label className="field field--recurring">
          <span>Valido hasta</span>
          <input type="date" value={values.validUntil} onChange={handleFieldChange("validUntil")} disabled={isSubmitting} />
        </label>

        {(values.providerName || values.commerceName || values.discountPercent) ? (
          <div className="field field--full">
            <div className={`discount-form-preview discount-form-preview--${values.category}`}>
              <p className="eyebrow">{getDiscountCategoryLabel(values.category)}</p>
              <strong>{getDiscountHeroCopy(previewDiscount)}</strong>
              <span>{getDiscountCategoryHint(values.category)}</span>
            </div>
          </div>
        ) : null}

        <label className="field field--full field--recurring">
          <span>Notas</span>
          <textarea
            rows={4}
            value={values.notes}
            onChange={handleFieldChange("notes")}
            placeholder="Ej.: tope por cuenta, valido solo en cajas, no aplica a delivery, detalle util."
            disabled={isSubmitting}
          />
        </label>
      </div>

      {error ? <div className="alert-banner alert-banner--danger">{error}</div> : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : mode === "create" ? "Guardar descuento" : "Guardar cambios"}
        </button>
        <button type="button" className="ghost-button" onClick={onReset} disabled={isSubmitting}>
          {mode === "create" ? "Cancelar" : "Cerrar"}
        </button>
      </div>
    </form>
  );
}
