import type { EntryKind } from "../types";

interface LogoCatalogEntry {
  key: string;
  label: string;
  src: string;
  aliases: string[][];
}

export interface CompanyBrand {
  key: string;
  label: string;
  src: string | null;
  initials: string;
  isFallback: boolean;
}

const logoModules = import.meta.glob("../../LOGOS/*.{png,jpg,jpeg,webp,svg}", {
  eager: true,
  import: "default"
}) as Record<string, string>;

const LOGO_ALIASES: Record<string, string[]> = {
  ande: ["ande", "administracion nacional de electricidad"],
  asismed: ["asismed"],
  atlas: ["atlas", "banco atlas"],
  basa: ["basa", "banco basa"],
  continental: ["continental", "banco continental", "contiental", "banco contiental"],
  coomecipar: ["coomecipar", "cooperativa coomecipar"],
  essap: ["essap"],
  farmacia: ["farmacia", "punto farma", "puntofarma", "farmam"],
  itau: ["itau", "itaú", "banco itau", "financiera itau"],
  personal: ["personal", "personal flow", "flow"],
  petrobras: ["petrobras"],
  shell: ["shell", "combus", "combustible", "nafta"],
  sps: ["sps"],
  tigo: ["tigo", "tigo hogar"],
  ueno: ["ueno", "ueno bank"]
};

const CATALOG = Object.entries(logoModules)
  .map(([path, src]) => {
    const fileName = path.split("/").pop() ?? "";
    const rawKey = fileName.replace(/\.[^.]+$/, "");
    const key = normalizeCompanyText(rawKey).replace(/\s+/g, " ");
    const aliases = Array.from(
      new Set([key, ...(LOGO_ALIASES[key] ?? []).map((alias) => normalizeCompanyText(alias))])
    )
      .filter(Boolean)
      .sort((left, right) => right.length - left.length)
      .map((alias) => alias.split(" "));

    return {
      key,
      label: rawKey,
      src,
      aliases
    } satisfies LogoCatalogEntry;
  })
  .sort((left, right) => right.aliases[0].length - left.aliases[0].length);

function normalizeCompanyText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeCompanyName(value: string) {
  const normalized = normalizeCompanyText(value);
  return normalized ? normalized.split(" ") : [];
}

function matchesAlias(words: string[], aliasWords: string[]) {
  if (words.length === 0 || aliasWords.length === 0 || aliasWords.length > words.length) return false;

  for (let index = 0; index <= words.length - aliasWords.length; index += 1) {
    let matches = true;

    for (let offset = 0; offset < aliasWords.length; offset += 1) {
      if (words[index + offset] !== aliasWords[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) return true;
  }

  return false;
}

function buildInitials(name: string) {
  const tokens = tokenizeCompanyName(name).filter((word) => !["de", "del", "la", "el", "los", "las", "y"].includes(word));
  const source = tokens.length > 0 ? tokens : tokenizeCompanyName(name);
  const initials = source.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");

  return initials || "LG";
}

function formatLabel(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function getCompanyBrand(name: string): CompanyBrand {
  const normalizedWords = tokenizeCompanyName(name);
  const match = CATALOG.find((entry) => entry.aliases.some((aliasWords) => matchesAlias(normalizedWords, aliasWords)));

  if (match) {
    return {
      key: match.key,
      label: formatLabel(match.label),
      src: match.src,
      initials: buildInitials(match.label),
      isFallback: false
    };
  }

  return {
    key: "generic",
    label: "Logo generico",
    src: null,
    initials: buildInitials(name),
    isFallback: true
  };
}

export function getCompanyBrandTheme(kind: EntryKind) {
  if (kind === "loan") return "loan" as const;
  if (kind === "fixed_expense") return "fixed" as const;
  if (kind === "recurring_expense") return "recurring" as const;
  return "variable" as const;
}
