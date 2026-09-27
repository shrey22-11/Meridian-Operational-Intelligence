import { FileText, Database } from "lucide-react";
import {
  money,
  number,
  percent,
  dateLabel,
  humanize,
  decimal,
} from "../lib/format";
import { Empty } from "./UI";
import DataTable from "./DataTable";

export const toolLabels = {
  get_business_metrics: "Business metrics",
  get_revenue_bridge: "Revenue movement",
  get_anomalies: "Operational anomalies",
  get_open_order_risks: "Delivery predictions",
  get_segments: "Customer segments",
  get_customer_details: "Customer history",
  get_forecast: "Demand forecast",
  get_product_watchlist: "Product performance",
  search_policies: "Operating guidance",
};
function EvidenceBody({ entry }) {
  const result = entry.result;
  if (!result) return <Empty title="The tool returned no evidence" />;
  if (result.error)
    return (
      <div className="evidence-error">
        <strong>Tool request was not completed</strong>
        <p>{result.error}</p>
      </div>
    );
  if (entry.tool === "search_policies")
    return result.length ? (
      <div className="policy-excerpts">
        {result.map((item) => (
          <article key={item.id}>
            <div className="document-source">
              <FileText size={14} />
              <span>{humanize(item.source.replace(".md", ""))}</span>
            </div>
            <p>{item.text}</p>
            <small>
              Source: {item.id} · Retrieval similarity {decimal(item.score, 2)}
            </small>
          </article>
        ))}
      </div>
    ) : (
      <Empty title="No matching policy excerpts">
        The knowledge base did not return a relevant passage.
      </Empty>
    );
  if (entry.tool === "get_business_metrics")
    return (
      <>
        <div className="evidence-primary">
          <span>Net booked revenue</span>
          <strong>{money(result.current.revenue, 2)}</strong>
          <small>
            {dateLabel(result.period.start_date)} –{" "}
            {dateLabel(result.period.end_date)}
          </small>
        </div>
        <dl className="definition-list">
          <div>
            <dt>Region</dt>
            <dd>{result.period.region || "All regions"}</dd>
          </div>
          <div>
            <dt>Orders</dt>
            <dd>{number(result.current.orders)}</dd>
          </div>
          <div>
            <dt>Gross margin</dt>
            <dd>{money(result.current.gross_margin)}</dd>
          </div>
          <div>
            <dt>Delivered-order delay rate</dt>
            <dd>{percent(result.current.late_rate)}</dd>
          </div>
          <div>
            <dt>Open orders</dt>
            <dd>{number(result.current.open_orders)}</dd>
          </div>
        </dl>
        <p className="footnote">{result.definitions}</p>
      </>
    );
  if (entry.tool === "get_revenue_bridge")
    return (
      <>
        <p className="scope-note">
          {result.month} vs the previous complete month · all regions
        </p>
        <DataTable
          compact
          caption="Revenue movement evidence"
          rows={result.regions}
          columns={[
            { key: "region", label: "Region" },
            { key: "revenue", label: "Revenue", numeric: true, render: money },
            {
              key: "revenue_change",
              label: "Change",
              numeric: true,
              render: money,
            },
          ]}
        />
        <p className="footnote">
          Volume and basket effects are available in the detailed tool response.
          Arithmetic decomposition does not establish causes.
        </p>
      </>
    );
  if (entry.tool === "get_open_order_risks")
    return (
      <DataTable
        compact
        caption="Delivery prediction evidence"
        rows={result}
        emptyTitle="No open orders matched this request"
        columns={[
          { key: "order_id", label: "Order", render: (value) => `#${value}` },
          { key: "region", label: "Region" },
          {
            key: "risk_probability",
            label: "Delay risk",
            numeric: true,
            render: percent,
          },
        ]}
      />
    );
  if (entry.tool === "get_anomalies")
    return (
      <DataTable
        compact
        caption="Anomaly evidence"
        rows={result}
        emptyTitle="No matching monitoring alerts"
        columns={[
          {
            key: "day",
            label: "Date",
            render: (value) =>
              dateLabel(value, { day: "numeric", month: "short" }),
          },
          { key: "region", label: "Region" },
          { key: "main_deviation", label: "Deviation", render: humanize },
          { key: "deviation_z", label: "σ", numeric: true, render: decimal },
        ]}
      />
    );
  if (entry.tool === "get_forecast")
    return (
      <>
        <p className="scope-note">
          Predicted units · heuristic planning bounds
        </p>
        <DataTable
          compact
          caption="Forecast evidence"
          rows={result}
          columns={[
            {
              key: "day",
              label: "Date",
              render: (value) =>
                dateLabel(value, { day: "numeric", month: "short" }),
            },
            { key: "units", label: "Forecast", numeric: true, render: number },
            { key: "lower", label: "Lower", numeric: true, render: number },
            { key: "upper", label: "Upper", numeric: true, render: number },
          ]}
        />
      </>
    );
  if (entry.tool === "get_segments")
    return (
      <DataTable
        compact
        caption="Customer segment evidence"
        rows={result}
        columns={[
          { key: "segment", label: "Segment" },
          {
            key: "customers",
            label: "Customers",
            numeric: true,
            render: number,
          },
          { key: "revenue", label: "Revenue", numeric: true, render: money },
        ]}
      />
    );
  if (entry.tool === "get_product_watchlist")
    return (
      <DataTable
        compact
        caption="Product performance evidence"
        rows={result}
        columns={[
          { key: "product_name", label: "Product" },
          { key: "orders", label: "Orders", numeric: true, render: number },
          {
            key: "late_rate",
            label: "Delay rate",
            numeric: true,
            render: percent,
          },
        ]}
      />
    );
  if (entry.tool === "get_customer_details")
    return result.found === false ? (
      <Empty title="No matching customer history" />
    ) : (
      <>
        <div className="evidence-primary">
          <span>Customer #{result.customer_id}</span>
          <strong>{money(result.revenue)}</strong>
          <small>Booked order history</small>
        </div>
        <dl className="definition-list">
          {[
            ["Region", result.region],
            ["Channel", result.channel],
            ["Orders", number(result.orders)],
            ["Segment", result.segment || "Unavailable"],
            ["Delay rate", percent(result.late_rate)],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </>
    );
  return (
    <Empty title="Evidence is available for detailed inspection">
      Open the complete tool response below.
    </Empty>
  );
}
export default function EvidencePanel({
  entries = [],
  selected,
  onSelect,
  status,
}) {
  const current = entries.find((entry) => entry.id === selected) || entries[0];
  return (
    <aside
      className="evidence-panel"
      aria-label="Analysis evidence"
      id="analysis-evidence"
      tabIndex={-1}
    >
      <div className="evidence-heading">
        <div>
          <span className="eyebrow">SOURCE RECORD</span>
          <h2>Evidence</h2>
        </div>
        <span>
          {entries.length
            ? `${entries.length} source${entries.length === 1 ? "" : "s"}`
            : "Awaiting results"}
        </span>
      </div>
      {!entries.length ? (
        <div className="evidence-empty">
          <div className="evidence-empty-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <strong>
            {status === "running"
              ? "Evidence arrives with the response"
              : "The source behind the answer"}
          </strong>
          <p>
            {status === "running"
              ? "The current API returns completed analysis and tool results together. Individual tool progress is not streamed."
              : "Database calculations, model outputs and retrieved policies will appear here after an analysis."}
          </p>
          <dl>
            <div>
              <dt>01</dt>
              <dd>Calculated business metrics</dd>
            </div>
            <div>
              <dt>02</dt>
              <dd>Saved model predictions</dd>
            </div>
            <div>
              <dt>03</dt>
              <dd>Cited operating policies</dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
          <div
            className="evidence-source-list"
            role="group"
            aria-label="Evidence sources"
          >
            {entries.map((entry) => (
              <button
                key={entry.id}
                className={current?.id === entry.id ? "selected" : ""}
                onClick={() => onSelect(entry.id)}
                aria-pressed={current?.id === entry.id}
              >
                <span className="citation-id">{entry.id}</span>
                <span>{toolLabels[entry.tool] || humanize(entry.tool)}</span>
                {entry.tool === "search_policies" ? (
                  <FileText size={14} />
                ) : (
                  <Database size={14} />
                )}
              </button>
            ))}
          </div>
          {current && (
            <div className="evidence-content">
              <div className="evidence-type">
                {current.tool === "search_policies"
                  ? "RETRIEVED DOCUMENTS"
                  : ["get_open_order_risks", "get_forecast"].includes(
                        current.tool,
                      )
                    ? "MODEL OUTPUT"
                    : "STRUCTURED DATA"}
              </div>
              <EvidenceBody entry={current} />
              <details className="disclosure raw-evidence">
                <summary>Inspect complete tool response</summary>
                <h3>Arguments</h3>
                <pre>{JSON.stringify(current.arguments, null, 2)}</pre>
                <h3>Result</h3>
                <pre>{JSON.stringify(current.result, null, 2)}</pre>
              </details>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
