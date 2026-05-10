interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  tone: "cobalt" | "mint" | "coral";
}

export function MetricCard({ label, value, detail, tone }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      <span className="metric-card__detail">{detail}</span>
    </article>
  );
}
