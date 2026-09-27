import { useEffect, useRef, useState } from "react";
import { Search, X, ArrowUpRight } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { query } from "../lib/api";
import {
  money,
  percent,
  dateLabel,
  decimal,
  humanize,
  number,
} from "../lib/format";
import {
  PageHeading,
  Section,
  Resource,
  RiskBar,
  Tabs,
  ExportLink,
} from "../components/UI";
import { RegionFilter } from "../components/Filters";
import DataTable from "../components/DataTable";

export default function Operations({ revision }) {
  const [view, setView] = useState("risk");
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const detailPanel = useRef(null);
  useEffect(() => {
    if (!selected) return;
    detailPanel.current?.focus({ preventScroll: true });
    if (window.innerWidth <= 1100)
      detailPanel.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
  }, [selected]);
  const risks = useResource(
    `predictions?${query({ limit: 100, region })}`,
    revision,
  );
  const anomalies = useResource(
    `anomalies?${query({ limit: 100, region })}`,
    revision,
  );
  const products = useResource("products", revision);
  function changeView(next) {
    setView(next);
    setSearch("");
    setSelected(null);
  }
  const riskRows = (risks.data || []).filter(
    (row) =>
      String(row.order_id).includes(search.trim()) ||
      row.region.toLowerCase().includes(search.toLowerCase()),
  );
  const productRows = (products.data || []).filter((row) =>
    `${row.product_name} ${row.supplier_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="INVESTIGATION QUEUE"
        title="Operations"
        description="Review predicted delivery risks and unusual operational behavior."
        action={
          <ExportLink
            dataset={
              view === "risk"
                ? "scored_orders"
                : view === "anomalies"
                  ? "anomalies"
                  : "order_facts"
            }
          />
        }
      />
      <Tabs
        value={view}
        onChange={changeView}
        label="Operations views"
        items={[
          { id: "risk", label: "Delivery predictions" },
          { id: "anomalies", label: "Anomalies" },
          { id: "products", label: "Product watchlist" },
        ]}
      />
      <div className="queue-toolbar">
        {view !== "products" && (
          <RegionFilter
            value={region}
            onChange={(value) => {
              setRegion(value);
              setSelected(null);
            }}
          />
        )}
        {view !== "anomalies" && (
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label={
                view === "risk" ? "Find an order" : "Find a product or supplier"
              }
              placeholder={
                view === "risk" ? "Order ID or region" : "Product or supplier"
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        )}
        <span className="metadata">
          {view === "risk"
            ? "Top 100 open orders · latest snapshot"
            : view === "anomalies"
              ? "Top 100 monitoring alerts · Jul–Dec 2025"
              : "Last 30 snapshot days · all regions"}
        </span>
      </div>
      {view === "risk" && (
        <div className={`queue-layout ${selected ? "with-detail" : ""}`}>
          <Section
            title="Delivery risk"
            description="Saved classifier output · sorted by predicted delay probability"
          >
            <Resource resource={risks} label="Delivery predictions">
              {() => (
                <DataTable
                  pageSize={20}
                  caption="Delivery predictions"
                  rows={riskRows}
                  rowKey="order_id"
                  selectedKey={selected?.order_id}
                  onRowSelect={setSelected}
                  initialSort={{ key: "risk_probability", direction: "desc" }}
                  emptyTitle="No open orders match these filters"
                  emptyDescription="Try another order ID or choose all regions. This queue contains the highest-scoring open orders, up to 100 per region selection."
                  columns={[
                    {
                      key: "order_id",
                      label: "Order",
                      render: (value) => `#${value}`,
                    },
                    {
                      key: "ordered_at",
                      label: "Placed",
                      render: (value) =>
                        dateLabel(value, { day: "numeric", month: "short" }),
                    },
                    { key: "region", label: "Region" },
                    {
                      key: "revenue",
                      label: "Booked value",
                      numeric: true,
                      render: money,
                    },
                    {
                      key: "risk_probability",
                      label: "Delay probability",
                      numeric: true,
                      render: (value, row) => (
                        <RiskBar probability={value} label={row.risk_level} />
                      ),
                    },
                    {
                      key: "risk_level",
                      label: "Model flag",
                      render: (value) => (
                        <span
                          className={`status-text ${value === "Investigate" ? "attention" : ""}`}
                        >
                          <i />
                          {value}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </Resource>
            <p className="footnote">
              Select an order to inspect its known inputs. A prediction is an
              estimated probability, not a confirmed late delivery.
            </p>
          </Section>
          {selected && (
            <aside
              className="order-detail"
              ref={detailPanel}
              tabIndex={-1}
              aria-label="Selected order details"
            >
              <div className="detail-heading">
                <span className="eyebrow">ORDER REVIEW</span>
                <button
                  className="icon-button"
                  aria-label="Close order details"
                  onClick={() => {
                    document
                      .querySelector(
                        `[aria-label="Inspect order ${selected.order_id}"]`,
                      )
                      ?.focus();
                    setSelected(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <h2>#{selected.order_id}</h2>
              <p className="muted">
                {selected.region} · {dateLabel(selected.ordered_at)}
              </p>
              <div className="detail-score">
                <span>Predicted delay probability</span>
                <strong>{percent(selected.risk_probability)}</strong>
                <span className="attention">{selected.risk_level}</span>
              </div>
              <h3>Observed order inputs</h3>
              <dl className="definition-list">
                <div>
                  <dt>Warehouse load</dt>
                  <dd>{decimal(selected.warehouse_load, 2)}</dd>
                </div>
                <div>
                  <dt>Units ordered</dt>
                  <dd>{number(selected.units)}</dd>
                </div>
                <div>
                  <dt>Booked value</dt>
                  <dd>{money(selected.revenue)}</dd>
                </div>
                <div>
                  <dt>Customer ID</dt>
                  <dd>{selected.customer_id}</dd>
                </div>
              </dl>
              <p className="footnote">
                These are recorded inputs, not individual causal explanations.
                Review the model's validation evidence before acting.
              </p>
              <a className="inline-link" href="#models">
                View model evaluation <ArrowUpRight size={14} />
              </a>
            </aside>
          )}
        </div>
      )}
      {view === "anomalies" && (
        <Section
          title="Unusual regional activity"
          description="Isolation Forest monitoring output · fitted on history through June 2025"
        >
          <Resource resource={anomalies} label="Anomalies">
            {(rows) => (
              <DataTable
                pageSize={20}
                caption="Regional anomaly monitoring"
                rows={rows}
                initialSort={{ key: "anomaly_score", direction: "desc" }}
                emptyTitle="No monitoring alerts match this region"
                emptyDescription="This means no matching alerts appear in the returned monitoring queue; it is not a guarantee that every operation is normal."
                columns={[
                  { key: "day", label: "Date", render: dateLabel },
                  { key: "region", label: "Region" },
                  {
                    key: "main_deviation",
                    label: "Main deviation",
                    render: humanize,
                  },
                  {
                    key: "deviation_z",
                    label: "Departure",
                    numeric: true,
                    render: (value) =>
                      `${value > 0 ? "+" : ""}${decimal(value)}σ`,
                  },
                  {
                    key: "anomaly_score",
                    label: "Anomaly score",
                    numeric: true,
                    render: (value) => decimal(value, 3),
                  },
                  {
                    key: "orders",
                    label: "Orders",
                    numeric: true,
                    render: number,
                  },
                  {
                    key: "revenue",
                    label: "Booked revenue",
                    numeric: true,
                    render: money,
                  },
                ]}
              />
            )}
          </Resource>
          <div className="definition-strip">
            <strong>Interpretation</strong>
            <p>
              A positive score crosses the detector's alert threshold.
              Promotions, seasonality or valid large orders can be unusual. The
              main deviation is a descriptive clue, not the cause of an
              incident.
            </p>
          </div>
        </Section>
      )}
      {view === "products" && (
        <Section
          title="Product watchlist"
          description="Observed delivery performance · at least 20 delivered orders per product"
        >
          <Resource resource={products} label="Product performance">
            {() => (
              <DataTable
                pageSize={20}
                caption="Product delivery watchlist"
                rows={productRows}
                emptyTitle="No products match this search"
                emptyDescription="Try a different product name or supplier."
                columns={[
                  { key: "product_name", label: "Product" },
                  { key: "category", label: "Category" },
                  { key: "supplier_name", label: "Supplier" },
                  {
                    key: "orders",
                    label: "Delivered orders",
                    numeric: true,
                    render: number,
                  },
                  {
                    key: "late_rate",
                    label: "Delay rate",
                    numeric: true,
                    render: percent,
                  },
                  {
                    key: "assessment",
                    label: "Assessment",
                    render: (value) => <span className="muted">{value}</span>,
                  },
                ]}
              />
            )}
          </Resource>
          <p className="footnote">
            Historical product delay rates are observed outcomes, separate from
            the predicted probabilities in the open-order queue.
          </p>
        </Section>
      )}
    </>
  );
}
