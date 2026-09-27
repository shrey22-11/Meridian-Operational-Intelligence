const numberFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});
export const number = (value) =>
  value == null ? "—" : numberFormat.format(value);
export const money = (value, decimals = 0) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: typeof decimals === "number" ? decimals : 0,
      }).format(value);
export const compact = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
export const percent = (value) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;
export const decimal = (value, digits = 1) =>
  value == null
    ? "—"
    : Number(value).toFixed(typeof digits === "number" ? digits : 1);
export const dateKey = (value) => String(value || "").slice(0, 10);
export function dateLabel(
  value,
  options = { day: "numeric", month: "short", year: "numeric" },
) {
  if (!value) return "—";
  const parsed = new Date(`${dateKey(value)}T12:00:00`);
  // Table renderers receive (value, row). A row's `day` is data, not an Intl option.
  const allowed = {
    day: ["numeric", "2-digit"],
    month: ["numeric", "2-digit", "short", "long", "narrow"],
    year: ["numeric", "2-digit"],
  };
  const selected = Object.fromEntries(
    Object.entries(allowed)
      .filter(([key, values]) => values.includes(options?.[key]))
      .map(([key]) => [key, options[key]]),
  );
  const validOptions = Object.keys(selected).length
    ? selected
    : { day: "numeric", month: "short", year: "numeric" };
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-GB", validOptions);
}
export const shortDate = (value) =>
  dateLabel(value, { day: "numeric", month: "short" });
export const humanize = (value) => String(value || "").replaceAll("_", " ");
export const modelName = (value) =>
  ({
    logistic: "Logistic regression",
    gradient_boosting: "Gradient boosting",
    ridge: "Ridge regression",
    seasonal_naive: "Seasonal baseline",
  })[value] || humanize(value);
export const sum = (rows, key) =>
  rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
export function delta(current, previous) {
  return previous == null || previous === 0 || current == null
    ? null
    : (current / previous - 1) * 100;
}
export function initialPeriod(snapshot) {
  const end = new Date(`${dateKey(snapshot)}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    region: "",
  };
}
