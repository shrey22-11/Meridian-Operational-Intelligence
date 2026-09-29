import { useScenario } from "../hooks/useScenario";
import { AnimatedNumber, ProbabilityDial, JourneyLink } from "../components/Motion";
import { ArrowRight, RotateCcw } from "lucide-react";
import { post } from "../lib/api";
import { money, percent, decimal, humanize } from "../lib/format";
import { PageHeading, ErrorState, Empty } from "../components/UI";
import { regions } from "../components/Filters";

const example = {
  warehouse_load: 0.9,
  distance_km: 700,
  promised_days: 6,
  supplier_lead_days: 5,
  units: 6,
  revenue: 12000,
  region: "North",
  channel: "Retail",
  expedited: false,
};
const fields = [
  {
    name: "warehouse_load",
    label: "Warehouse load",
    min: 0.15,
    max: 1.4,
    step: 0.05,
    unit: "ratio",
    help: "1.00 represents nominal capacity.",
  },
  {
    name: "distance_km",
    label: "Shipping distance",
    min: 10,
    max: 2400,
    step: 1,
    unit: "km",
  },
  {
    name: "promised_days",
    label: "Delivery promise",
    min: 1,
    max: 14,
    step: 1,
    unit: "days",
  },
  {
    name: "supplier_lead_days",
    label: "Supplier lead time",
    min: 1,
    max: 30,
    step: 0.1,
    unit: "days",
  },
  {
    name: "units",
    label: "Units ordered",
    min: 1,
    max: 400,
    step: 1,
    unit: "units",
  },
  {
    name: "revenue",
    label: "Booked order value",
    min: 1,
    max: 10000000,
    step: 0.01,
    unit: "INR",
  },
];
export default function ScenarioLab() {
  const { form, update: setForm, result, baseline, busy, error, dirty, valid, run, reset, setDragging } = useScenario(example, fields);
  const change =
    result && baseline ? (result.probability - baseline.probability) * 100 : 0;
  const changedFields =
    result && baseline
      ? Object.keys(result.inputs).filter(
          (key) => result.inputs[key] !== baseline.inputs[key],
        )
      : [];
  return (
    <>
      <PageHeading
        eyebrow="DECISION WORKSPACE"
        title="Scenario Lab"
        description="Change the operating conditions. Compare the model's response."
      />
      <div className="workflow-steps">
        <span>
          <b>01</b> Configure inputs
        </span>
        <ArrowRight size={14} />
        <span>
          <b>02</b> Run saved model
        </span>
        <ArrowRight size={14} />
        <span>
          <b>03</b> Compare with baseline
        </span>
      </div>
      <div className="scenario-workspace">
        <section className="scenario-inputs">
          <div className="section-heading">
            <div>
              <h2>Order conditions</h2>
              <p>Illustrative inputs; values are not a selected real order.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Reset scenario"
              disabled={busy}
              title="Reset inputs and baseline"
              onClick={reset}
            >
              <RotateCcw size={16} />
            </button>
          </div>
          <form onSubmit={run}>
            <fieldset>
              <legend className="sr-only">Scenario inputs</legend>
              <div className="scenario-fields">
                {fields.map((field) => (
                  <label key={field.name} className="scenario-control">
                    <span>{field.label}</span>
                    <div className="unit-input">
                      <input
                        aria-label={field.label}
                        required
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={form[field.name]}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            [field.name]:
                              event.target.value === ""
                                ? ""
                                : Number(event.target.value),
                          })
                        }
                      />
                      <span>{field.unit}</span>
                    </div>
                    <input type="range" aria-label={`${field.label} slider`}
                      min={field.name === "revenue" ? 0 : field.min}
                      max={field.name === "revenue" ? 1 : field.max}
                      step={field.name === "revenue" ? 0.001 : field.step}
                      value={field.name === "revenue" ? Math.log10(Math.max(1, form[field.name])) / 7 : form[field.name]}
                      onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); setDragging(true); }}
                      onPointerUp={() => setDragging(false)}
                      onPointerCancel={() => setDragging(false)}
                      onBlur={() => setDragging(false)}
                      aria-valuetext={`${form[field.name]} ${field.unit}`}
                      onChange={(event) => setForm({ ...form, [field.name]: field.name === "revenue" ? Math.round(10 ** (Number(event.target.value) * 7)) : Number(event.target.value) })}
                    />
                    <span className="slider-extents"><small>{field.min} {field.unit}</small><small>{field.max.toLocaleString("en-IN")} {field.unit}</small></span>
                    {field.help && <small>{field.help}</small>}
                  </label>
                ))}
                <label>
                  <span>Region</span>
                  <select
                    value={form.region}
                    onChange={(event) =>
                      setForm({ ...form, region: event.target.value })
                    }
                  >
                    {regions.map((region) => (
                      <option key={region}>{region}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Customer channel</span>
                  <select
                    value={form.channel}
                    onChange={(event) =>
                      setForm({ ...form, channel: event.target.value })
                    }
                  >
                    <option>Retail</option>
                    <option>Business</option>
                  </select>
                </label>
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.expedited}
                  onChange={(event) =>
                    setForm({ ...form, expedited: event.target.checked })
                  }
                />
                <span>
                  Expedited shipping
                  <small>
                    Independent of the service promise entered above.
                  </small>
                </span>
              </label>
            </fieldset>
            <div className="scenario-submit">
              <button className="button primary" disabled={busy || !valid}>
                {busy ? "Running model…" : "Run prediction"}
                <ArrowRight size={15} />
              </button>
              <span>
                {baseline
                  ? "Auto-updates after editing · first run stays baseline."
                  : "The first run becomes your baseline."}
              </span>
            </div>
          </form>
        </section>
        <section className="scenario-output" aria-live="polite">
          <div className="section-heading">
            <div>
              <h2>Scenario result</h2>
              <p>
                {result
                  ? "Saved classifier output · last completed run"
                  : "A model-backed comparison appears after your first run."}
              </p>
            </div>
            {dirty && <span className="attention">Inputs changed</span>}
          </div>
          {error && (
            <ErrorState
              title="Unable to evaluate this scenario"
              error={error}
              retry={() => run()}
            />
          )}
          {busy && (
            <div className="activity-line" role="status">
              <span className="activity-dot" />
              Calculating prediction and local sensitivity…
            </div>
          )}
          {!result ? (
            <div className="scenario-empty">
              <h3>No scenario evaluated yet</h3>
              <p>
                Run the initial conditions to establish a baseline, then change
                an input and run again to compare.
              </p>
              <div>
                <span>Model output</span>
                <span>Baseline change</span>
                <span>Local sensitivity</span>
              </div>
            </div>
          ) : (
            <>
              {dirty && (
                <p className="notice-line">
                  Previous inputs shown. The saved model updates after you pause editing; you can also run it manually.
                </p>
              )}
              <ProbabilityDial probability={result.probability} baseline={baseline.probability} label={result.risk_level} />
              <div className="prediction-comparison">
                <div>
                  <span>Predicted delay probability</span>
                  <strong data-testid="scenario-probability">
                    <AnimatedNumber value={result.probability} format={percent} />
                  </strong>
                  <span
                    className={
                      result.risk_level === "Investigate"
                        ? "attention"
                        : "positive"
                    }
                  >
                    {result.risk_level}
                  </span>
                </div>
                <div className="baseline-comparison">
                  <span>Baseline</span>
                  <b>{percent(baseline.probability)}</b>
                  <span
                    className={
                      change > 0 ? "negative" : change < 0 ? "positive" : ""
                    }
                  >
                    {change > 0 ? "+" : ""}
                    {decimal(change)} pp change
                  </span>
                </div>
              </div>
              <div className="probability-comparison" aria-hidden="true">
                <div>
                  <span>Baseline</span>
                  <i style={{ width: `${baseline.probability * 100}%` }} />
                </div>
                <div>
                  <span>Scenario</span>
                  <i style={{ width: `${result.probability * 100}%` }} />
                </div>
              </div>
              <div className="scenario-interpretation">
                <strong>
                  {change < 0
                    ? "Lower predicted delay risk"
                    : change > 0
                      ? "Higher predicted delay risk"
                      : changedFields.length
                        ? "No change in predicted risk"
                        : "Baseline established"}
                </strong>
                <p>
                  {changedFields.length
                    ? `${changedFields.length} input${changedFields.length > 1 ? "s" : ""} changed from the baseline. The difference is a model association, not a guaranteed operational improvement.`
                    : "Change an input and run the model again. Comparisons will use this first completed run."}
                </p>
              </div>
              <div className="sensitivity">
                <h3>Local sensitivity</h3>
                <p className="metadata">
                  Each recorded input compared with its training median, holding
                  others fixed.
                </p>
                {(result.drivers || []).map((driver) => (
                  <div key={driver.feature} className="sensitivity-row"><span className="sensitivity-marker" aria-hidden="true" style={{width:`${Math.min(100, Math.abs(driver.probability_difference) * 100)}%`}} />
                    <span>{humanize(driver.feature)}</span>
                    <b
                      className={
                        driver.probability_difference > 0
                          ? "negative"
                          : "positive"
                      }
                    >
                      {driver.probability_difference > 0 ? "+" : ""}
                      {decimal(driver.probability_difference * 100)} pp
                    </b>
                  </div>
                ))}
              </div>
              <details className="disclosure">
                <summary>Inspect baseline and submitted inputs</summary>
                <dl className="input-comparison">
                  {Object.keys(result.inputs).map((key) => (
                    <div key={key}>
                      <dt>{humanize(key)}</dt>
                      <dd>
                        {String(baseline.inputs[key])}
                        <ArrowRight size={12} />
                        <strong>{String(result.inputs[key])}</strong>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          )}
        </section>
      </div>
      <JourneyLink href="#analyst" eyebrow="Continue the investigation">Ask the analyst for operational context</JourneyLink>
      <div className="definition-strip">
        <strong>Model simulation, not causal analysis</strong>
        <p>
          Changing an input shows the fitted model's response. It does not
          establish that changing warehouse staffing, delivery promises or
          shipping service would produce the same business outcome.
        </p>
      </div>
    </>
  );
}
