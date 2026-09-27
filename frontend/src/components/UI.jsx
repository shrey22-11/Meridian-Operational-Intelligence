import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  RotateCw,
  CircleAlert,
} from "lucide-react";

export function Section({
  title,
  description,
  action,
  children,
  className = "",
  id,
}) {
  return (
    <section className={`section ${className}`} id={id}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({ title = "No matching records", children }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
export function ErrorState({
  title = "Unable to load this analysis",
  error,
  retry,
}) {
  return (
    <div className="error-state" role="alert">
      <CircleAlert size={18} />
      <div>
        <strong>{title}</strong>
        <p>
          {error?.message || "The analytics service did not return a response."}
        </p>
      </div>
      {retry && (
        <button className="button quiet" onClick={retry}>
          <RotateCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
export function Skeleton({ rows = 4, label = "Loading analysis" }) {
  return (
    <div className="skeleton-group" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="skeleton skeleton-title" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          className="skeleton"
          key={i}
          style={{ width: `${100 - (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}
export function Resource({ resource, children, label }) {
  if (resource.loading) return <Skeleton label={label} />;
  if (resource.error)
    return (
      <ErrorState
        title={label ? `Unable to load ${label.toLowerCase()}` : undefined}
        error={resource.error}
        retry={resource.retry}
      />
    );
  if (resource.data == null)
    return <Empty title="This analysis is not available yet" />;
  return children(resource.data);
}
export function Change({
  value,
  suffix = "vs previous period",
  goodWhenUp = true,
}) {
  if (value == null)
    return <span className="metadata">No previous-period comparison</span>;
  const up = value >= 0;
  return (
    <span className={`change ${up === goodWhenUp ? "positive" : "negative"}`}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      <b>{Math.abs(value).toFixed(1)}%</b>
      <span>{suffix}</span>
    </span>
  );
}
export function ExportLink({ dataset, children = "Export CSV" }) {
  return (
    <a
      className="button quiet"
      href={`/api/exports/${dataset}`}
      title="Download the complete dataset; screen filters are not applied to exports."
      download
    >
      <Download size={14} />
      {children}
    </a>
  );
}
export function Tabs({ value, onChange, items, label }) {
  return (
    <div className="section-tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          aria-pressed={value === item.id}
          className={value === item.id ? "selected" : ""}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count != null && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function RiskBar({ probability, label }) {
  return (
    <div className="risk-cell">
      <span className={label === "Routine" ? "information" : "risk-text"}>
        {probability == null ? "—" : `${(probability * 100).toFixed(1)}%`}
      </span>
      <div className="risk-track" aria-hidden="true">
        <i
          style={{ width: `${Math.max(0, Math.min(100, probability * 100))}%` }}
        />
      </div>
    </div>
  );
}
