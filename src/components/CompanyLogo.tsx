import { getCompanyBrand } from "../lib/companyBrand";
import { getKindTheme } from "../lib/finance";
import type { EntryKind } from "../types";

interface CompanyLogoProps {
  entityName: string;
  kind: EntryKind;
  size?: "sm" | "md";
}

export function CompanyLogo({ entityName, kind, size = "md" }: CompanyLogoProps) {
  const brand = getCompanyBrand(entityName);
  const kindTheme = getKindTheme(kind);

  if (brand.src) {
    return (
      <div className={`company-logo company-logo--${size}`} title={brand.label}>
        <div className="company-logo__tile">
          <img className="company-logo__image" src={brand.src} alt={`Logo de ${brand.label}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={`company-logo company-logo--${size} company-logo--fallback company-logo--fallback-${kindTheme}`} title="Logo generico">
      <div className="company-logo__tile">
        <span className="company-logo__initials">{brand.initials}</span>
      </div>
    </div>
  );
}
