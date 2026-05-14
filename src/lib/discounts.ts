import { formatDate, parseAmount, todayKey } from "./finance";
import type { DiscountCategory, DiscountDraft, DiscountItem } from "../types";

export const DISCOUNT_CATEGORY_OPTIONS: Array<{
  value: DiscountCategory;
  label: string;
  hint: string;
}> = [
  { value: "supermarket", label: "Supermercado", hint: "Biggie, supermercado, compras del hogar" },
  { value: "fuel", label: "Combustible", hint: "Nafta, diesel, estaciones de servicio" },
  { value: "pharmacy", label: "Farmacia", hint: "Medicamentos, perfumeria, salud" },
  { value: "shopping", label: "Compras", hint: "Ropa, tecnologia, retail" },
  { value: "services", label: "Servicios", hint: "Streaming, hogar, suscripciones" },
  { value: "dining", label: "Gastronomia", hint: "Restaurantes, cafe, delivery" },
  { value: "travel", label: "Viajes", hint: "Pasajes, hoteles, turismo" },
  { value: "other", label: "Otros", hint: "Cualquier beneficio que no encaje arriba" }
] as const;

function buildDiscountId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `discount-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategory(value: unknown): DiscountCategory {
  const normalized = normalizeText(value);
  return DISCOUNT_CATEGORY_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as DiscountCategory)
    : "other";
}

function parseDateAtMidday(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function createEmptyDiscountDraft(): DiscountDraft {
  return {
    providerName: "",
    commerceName: "",
    category: "supermarket",
    discountPercent: "",
    conditions: "",
    validUntil: todayKey(),
    notes: ""
  };
}

export function normalizeDiscount(rawValue: Partial<DiscountItem> & { id?: string }): DiscountItem {
  const createdAt = normalizeText(rawValue.createdAt) || new Date().toISOString();
  const updatedAt = normalizeText(rawValue.updatedAt) || createdAt;

  return {
    id: normalizeText(rawValue.id) || buildDiscountId(),
    providerName: normalizeText(rawValue.providerName) || "Beneficio",
    commerceName: normalizeText(rawValue.commerceName) || "Descuento",
    category: normalizeCategory(rawValue.category),
    discountPercent: Math.max(parseAmount(String(rawValue.discountPercent ?? 0)), 0),
    conditions: normalizeText(rawValue.conditions),
    validUntil: normalizeText(rawValue.validUntil) || todayKey(),
    notes: normalizeText(rawValue.notes),
    createdAt,
    updatedAt,
    createdByUid: normalizeText(rawValue.createdByUid),
    createdByEmail: normalizeText(rawValue.createdByEmail),
    updatedByUid: normalizeText(rawValue.updatedByUid),
    updatedByEmail: normalizeText(rawValue.updatedByEmail)
  };
}

export function buildDiscountFromDraft(
  draft: DiscountDraft,
  actor: { userId: string; userEmail: string },
  existingDiscount?: DiscountItem | null
) {
  const now = new Date().toISOString();
  const normalizedExisting = existingDiscount ? normalizeDiscount(existingDiscount) : null;

  return normalizeDiscount({
    id: normalizedExisting?.id ?? buildDiscountId(),
    providerName: draft.providerName,
    commerceName: draft.commerceName,
    category: draft.category,
    discountPercent: parseAmount(draft.discountPercent),
    conditions: draft.conditions,
    validUntil: draft.validUntil,
    notes: draft.notes,
    createdAt: normalizedExisting?.createdAt ?? now,
    updatedAt: now,
    createdByUid: normalizedExisting?.createdByUid || actor.userId,
    createdByEmail: normalizedExisting?.createdByEmail || actor.userEmail,
    updatedByUid: actor.userId,
    updatedByEmail: actor.userEmail
  });
}

export function getDiscountDraftFromItem(discount: DiscountItem): DiscountDraft {
  const normalized = normalizeDiscount(discount);

  return {
    providerName: normalized.providerName,
    commerceName: normalized.commerceName,
    category: normalized.category,
    discountPercent: normalized.discountPercent > 0 ? String(normalized.discountPercent) : "",
    conditions: normalized.conditions,
    validUntil: normalized.validUntil,
    notes: normalized.notes
  };
}

export function validateDiscountDraft(draft: DiscountDraft) {
  if (!normalizeText(draft.providerName)) {
    return "Escribe el banco, tarjeta o emisor del beneficio.";
  }

  if (!normalizeText(draft.commerceName)) {
    return "Escribe el comercio o marca donde aplica.";
  }

  const discountPercent = parseAmount(draft.discountPercent);
  if (discountPercent <= 0 || discountPercent > 100) {
    return "El descuento debe ser un porcentaje entre 1 y 100.";
  }

  if (!normalizeText(draft.validUntil)) {
    return "Indica hasta que fecha estara vigente este descuento.";
  }

  if (draft.validUntil < todayKey()) {
    return "La fecha de vencimiento no puede estar en el pasado.";
  }

  return null;
}

export function sortDiscounts(left: DiscountItem, right: DiscountItem) {
  if (left.validUntil !== right.validUntil) {
    return left.validUntil.localeCompare(right.validUntil);
  }

  if (right.discountPercent !== left.discountPercent) {
    return right.discountPercent - left.discountPercent;
  }

  return left.commerceName.localeCompare(right.commerceName);
}

export function isDiscountExpired(discount: DiscountItem, currentDay = todayKey()) {
  return discount.validUntil < currentDay;
}

export function getDiscountCategoryLabel(category: DiscountCategory) {
  return DISCOUNT_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "Otros";
}

export function getDiscountCategoryHint(category: DiscountCategory) {
  return DISCOUNT_CATEGORY_OPTIONS.find((option) => option.value === category)?.hint ?? "";
}

export function getDiscountCategoryTheme(category: DiscountCategory) {
  return category;
}

export function getDiscountDaysLeft(discount: DiscountItem, currentDay = todayKey()) {
  const currentDate = parseDateAtMidday(currentDay);
  const expiryDate = parseDateAtMidday(discount.validUntil);
  return Math.max(Math.round((expiryDate.getTime() - currentDate.getTime()) / 86_400_000), 0);
}

export function isDiscountExpiringSoon(discount: DiscountItem, currentDay = todayKey(), days = 7) {
  return getDiscountDaysLeft(discount, currentDay) <= days;
}

export function getDiscountExpiryLabel(discount: DiscountItem, currentDay = todayKey()) {
  const daysLeft = getDiscountDaysLeft(discount, currentDay);
  if (daysLeft === 0) return "Vence hoy";
  if (daysLeft === 1) return "Vence manana";
  if (daysLeft <= 7) return `Vence en ${daysLeft} dias`;
  return `Hasta ${formatDate(discount.validUntil)}`;
}

export function getDiscountHeroCopy(discount: DiscountItem) {
  const conditions = normalizeText(discount.conditions);
  if (conditions) {
    return `${discount.discountPercent}% con ${discount.providerName} en ${discount.commerceName} ${conditions.toLowerCase()}.`;
  }

  return `${discount.discountPercent}% con ${discount.providerName} en ${discount.commerceName}.`;
}
