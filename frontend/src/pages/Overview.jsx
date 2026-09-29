import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { query } from "../lib/api";
import {
  compact,
  money,
  number,
  percent,
  shortDate,
  delta,
  sum,
  humanize,
} from "../lib/format";
import {
  PageHeading,
  Section,
  Resource,
  Change,
  RiskBar,
  ExportLink,
  Empty,
  Tabs,
} from "../components/UI";
import Filters from "../components/Filters";
import DataTable from "../components/DataTable";
import { AnimatedNumber, JourneyLink } from "../components/Motion";
import RevenueBridge from "../components/RevenueBridge";
import { RevenueChart } from "../components/Charts";

function RegionalPerformance({ rows, selected, onSelect }) {
  const total = sum(rows, "revenue");
  if (!rows.length)
    return <Empty title="No regional activity for this selection" />;
  return (
    <div className="regional-list">
      {rows.map((row, index) => (
        <button type="button" className="region-row" key={row.region} aria-pressed={selected === row.region} onClick={() => onSelect(selected === row.region ? "" : row.region)}>
          <span className="region-rank">0{index + 1}</span>
          <div className="region-main">
            <div>
              <strong>{row.region}</strong>
              <b>{money(row.revenue)}</b>
            </div>
            <div className="contribution-track">
              <span
                style={{ width: `${total ? (row.revenue / total) * 100 : 0}%` }}
              />
            </div>
            <small>
              {number(row.orders)} orders
              <span>{percent(total ? row.revenue / total : null)} share</span>
            </small>
          </div>
        </button>
      ))}
    </div>
  );
}
export default function Overview({ filters, setFilters, health, revision }) {
  const [activeKpi, setActiveKpi] = useState("revenue");
  const bridge = useResource("revenue-bridge", revision);
  function focusKpi(key) { setActiveKpi(key); if (key === "revenue" || key === "orders") setMetric(key); }
  const [metric, setMetric] = useState("revenue");
  const params = query({
    start_date: filters?.start,
    end_date: filters?.end,
    region: filters?.region,
  });
  const metrics = useResource(filters ? `metrics?${params}` : null, revision);
  const analytics = useResource(
    filters ? `analytics?${params}` : null,
    revision,
  );
  const risks = useResource(
    `predictions?${query({ limit: 6, region: filters?.region })}`,
    revision,
  );
  const anomalies = useResource(
    `anomalies?${query({ limit: 3, region: filters?.region })}`,
    revision,
  );
  return (
    <>
      <PageHeading
        eyebrow="BUSINESS PULSE"
        title="Operational overview"
        description="Commercial performance and fulfillment signals, in one view."
        action={<ExportLink dataset="daily_operations">Export data</ExportLink>}
      />
      <Filters
        value={filters}
        onChange={setFilters}
        snapshot={health?.snapshot}
      />
      <Resource resource={metrics} label="Business metrics">
        {({ current: m, previous, revenue_change_pct }) => (
          <div className="metrics-ledger pulse-ledger" data-active={activeKpi}>
            <div className="primary-metric"><button className="metric-focus" aria-label="Focus revenue metric" aria-pressed={activeKpi === "revenue"} onFocus={() => focusKpi("revenue")} onMouseEnter={() => focusKpi("revenue")} onClick={() => focusKpi("revenue")}><span aria-hidden="true">↗</span></button>
              <span className="metric-label">
                Net booked revenue <span>INR</span>
              </span>
              <strong data-testid="revenue-value"><AnimatedNumber value={m.revenue} format={money} /></strong>
              <Change value={revenue_change_pct} />
              <span className="metric-context">
                Excludes cancelled orders; includes open bookings.
              </span>
            </div>
            <div className="ledger-metric"><button className="metric-focus" aria-label="Focus orders metric" aria-pressed={activeKpi === "orders"} onFocus={() => focusKpi("orders")} onMouseEnter={() => focusKpi("orders")} onClick={() => focusKpi("orders")}><span aria-hidden="true">↗</span></button>
              <span className="metric-label">Orders received</span>
              <strong><AnimatedNumber value={m.orders} format={number} /></strong>
              <Change value={delta(m.orders, previous.orders)} />
              <span className="metric-context">
                {number(m.active_customers)} active customers
              </span>
            </div>
            <div className="ledger-metric"><button className="metric-focus" aria-label="Focus margin metric" aria-pressed={activeKpi === "margin"} onFocus={() => focusKpi("margin")} onMouseEnter={() => focusKpi("margin")} onClick={() => focusKpi("margin")}><span aria-hidden="true">↗</span></button>
              <span className="metric-label">Gross margin</span>
              <strong><AnimatedNumber value={m.gross_margin} format={money} /></strong>
              <span className="metric-detail">
                {percent(m.revenue ? m.gross_margin / m.revenue : null)}{" "}
                <span>of booked revenue</span>
              </span>
              <span className="metric-context">Merchandise cost only</span>
            </div>
            <div className="ledger-metric delivery-metric"><button className="metric-focus" aria-label="Focus delivery metric" aria-pressed={activeKpi === "delivery"} onFocus={() => focusKpi("delivery")} onMouseEnter={() => focusKpi("delivery")} onClick={() => focusKpi("delivery")}><span aria-hidden="true">↗</span></button>
              <span className="metric-label">On-time delivery</span>
              <strong>
                <AnimatedNumber value={m.late_rate == null ? null : 1 - m.late_rate} format={percent} />
              </strong>
              <div className="delivery-track" aria-hidden="true">
                <i
                  style={{
                    width: `${m.late_rate == null ? 0 : (1 - m.late_rate) * 100}%`,
                  }}
                />
              </div>
              <span className="metric-context">
                {number(m.delivered_orders)} delivered · {number(m.open_orders)}{" "}
                still open
              </span>
            </div>
          </div>
        )}
      </Resource>
      <p className="pulse-context">{activeKpi === "margin" ? "Margin reflects merchandise cost only. Revenue and orders remain the daily trend below." : activeKpi === "delivery" ? "On-time delivery covers completed orders only. Review open-order risk in the investigation queue." : `Explore ${metric} through time, then select a region to isolate its contribution.`}</p>
      <div className="overview-analysis">
        <Section
          title="Revenue & order activity"
          description="Daily movement within the selected reporting period"
          action={
            <Tabs
              label="Trend metric"
              value={metric}
              onChange={setMetric}
              items={[
                { id: "revenue", label: "Revenue" },
                { id: "orders", label: "Orders" },
              ]}
            />
          }
        >
          <Resource resource={analytics} label="Daily activity">
            {(data) => <RevenueChart rows={data.trend} metric={metric} />}
          </Resource>
          <div className="chart-footnote">
            <span className="line-key" />
            {metric === "revenue"
              ? "Net booked revenue · INR"
              : "Orders received · count"}
            <span>Daily observations</span>
          </div>
        </Section>
        <Section
          title="Regional contribution"
          description="Where booked revenue comes from"
          className="regional-section"
        >
          <Resource resource={analytics} label="Regional performance">
            {(data) => <RegionalPerformance rows={data.regions} selected={filters?.region} onSelect={(region) => setFilters({ ...filters, region })} />}
          </Resource>
          <a className="inline-link section-bottom-link" href="#analytics">
            Explore business performance <ArrowUpRight size={14} />
          </a>
        </Section>
      </div>
      <Section title="What moved the business?" description="Monthly decomposition · independent of the filters above"><Resource resource={bridge} label="Monthly revenue bridge">{(data) => <RevenueBridge data={data} />}</Resource></Section>
      <div className="overview-lower">
        <Section
          title="Open orders to review"
          description="Model-ranked delay risk · latest snapshot, independent of date filter"
          action={
            <a className="inline-link" href="#operations">
              View queue <ArrowRight size={14} />
            </a>
          }
        >
          <Resource resource={risks} label="Delivery predictions">
            {(rows) => (
              <DataTable
                compact
                caption="Open orders ranked by predicted delivery risk"
                rows={rows}
                emptyTitle="No open orders match this region"
                columns={[
                  {
                    key: "order_id",
                    label: "Order",
                    render: (value) => (
                      <span className="identifier">#{value}</span>
                    ),
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
                ]}
              />
            )}
          </Resource>
          <p className="footnote">
            Predicted probabilities prioritize review; they are not observed
            delivery outcomes.
          </p>
        </Section>
        <Section
          title="Operational signals"
          description="Highest anomaly scores · monitoring period"
          className="signals-section"
        >
          <Resource resource={anomalies} label="Operational signals">
            {(rows) =>
              rows.length ? (
                <div className="signal-list">
                  {rows.map((row, index) => (
                    <div
                      className="signal-item"
                      key={`${row.day}-${row.region}`}
                    >
                      <span className="signal-number">0{index + 1}</span>
                      <div>
                        <div className="signal-meta">
                          {row.region}
                          <span>{shortDate(row.day)}</span>
                        </div>
                        <h3>Unusual {humanize(row.main_deviation)}</h3>
                        <p>
                          {Math.abs(row.deviation_z).toFixed(1)} standard
                          deviations {row.deviation_z >= 0 ? "above" : "below"}{" "}
                          the reference mean.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="No monitoring alerts match this region" />
              )
            }
          </Resource>
          <a className="inline-link section-bottom-link" href="#operations">
            Inspect the evidence <ArrowUpRight size={14} />
          </a>
        </Section>
      </div>
      <JourneyLink href="#operations" eyebrow="From pulse to priority">Investigate delivery risks and operational signals</JourneyLink>
      <div className="definition-strip">
        <strong>Reading this view</strong>
        <p>
          Revenue is booked merchandise value, not cash received. Delivery rates
          include completed orders only; recent periods may look better while
          slower orders remain open.
        </p>
      </div>
    </>
  );
}
