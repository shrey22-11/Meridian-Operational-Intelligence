import { CalendarDays, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { initialPeriod } from "../lib/format";

export const regions = ["North", "South", "East", "West"];
export function RegionFilter({ value, onChange }) {
  return (
    <label className="filter-field">
      <span>Region</span>
      <select
        aria-label="Region"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All regions</option>
        {regions.map((region) => (
          <option key={region}>{region}</option>
        ))}
      </select>
    </label>
  );
}
export default function Filters({ value, onChange, snapshot, action }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);
  if (!value) return null;
  function apply(event) {
    event.preventDefault();
    if (!draft.start || !draft.end || draft.start > draft.end) {
      setError("Choose a start date on or before the end date.");
      return;
    }
    setError("");
    onChange(draft);
  }
  const changed = JSON.stringify(value) !== JSON.stringify(draft);
  return (
    <div className="filter-area">
      <form className="filterbar" onSubmit={apply}>
        <div className="date-fields">
          <CalendarDays size={15} />
          <label>
            <span className="sr-only">Start date</span>
            <input
              type="date"
              aria-label="Start date"
              required
              value={draft.start}
              onChange={(event) =>
                setDraft({ ...draft, start: event.target.value })
              }
            />
          </label>
          <span className="date-divider">—</span>
          <label>
            <span className="sr-only">End date</span>
            <input
              type="date"
              aria-label="End date"
              required
              value={draft.end}
              onChange={(event) =>
                setDraft({ ...draft, end: event.target.value })
              }
            />
          </label>
        </div>
        <RegionFilter
          value={draft.region}
          onChange={(region) => {
            const next = { ...draft, region };
            setDraft(next);
            if (!changed) onChange(next);
          }}
        />
        <button className="button" disabled={!changed} type="submit">
          Apply dates
        </button>
        <button
          className="icon-button reset-filter"
          type="button"
          aria-label="Reset filters"
          title="Reset to last 30 dataset days"
          disabled={!snapshot}
          onClick={() => onChange(initialPeriod(snapshot))}
        >
          <RotateCcw size={14} />
        </button>
        <div className="filter-action">{action}</div>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
