import { percent, decimal, money, number, humanize } from "../../lib/format";
import { Section, Resource } from "../../components/UI";
import DataTable from "../../components/DataTable";

export default function OperatingConditions({ statistics }) {
  return (
    <Resource resource={statistics} label="Operating statistics">
      {(data) => (
        <>
          <div className="analysis-columns">
            <Section
              title="Does warehouse load relate to delays?"
              description="Exploratory association across the synthetic dataset"
            >
              <div className="comparison-pair">
                <div>
                  <span>High workload</span>
                  <strong>
                    {percent(data.load_delay_association.high_load_rate)}
                  </strong>
                  <small>Observed delay rate</small>
                </div>
                <div>
                  <span>Lower workload</span>
                  <strong>
                    {percent(data.load_delay_association.normal_load_rate)}
                  </strong>
                  <small>Observed delay rate</small>
                </div>
              </div>
              <div className="stat-callout">
                <strong>
                  {decimal(data.load_delay_association.difference * 100)}{" "}
                  percentage points
                </strong>
                <p>
                  Observed difference. Daily block bootstrap 95% interval:{" "}
                  {data.load_delay_association.daily_block_bootstrap_95_interval
                    .map((v) => decimal(v * 100))
                    .join("–")}{" "}
                  points.
                </p>
              </div>
              <p className="footnote">
                Association does not establish a causal effect. Daily blocks
                account for some within-day dependence.
              </p>
            </Section>
            <Section
              title="How reliable are regional comparisons?"
              description="Delivered orders · full history"
            >
              <DataTable
                caption="Regional delay confidence intervals"
                rows={data.regions}
                columns={[
                  { key: "region", label: "Region" },
                  {
                    key: "orders",
                    label: "Delivered",
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
                    key: "wilson_95_interval",
                    label: "95% interval",
                    numeric: true,
                    sortable: false,
                    render: (value) =>
                      `${percent(value[0])}–${percent(value[1])}`,
                  },
                ]}
              />
              <p className="footnote">
                Wilson intervals assume independent orders. Shared daily shocks
                can make them optimistic.
              </p>
            </Section>
          </div>
          <Section
            title="Order-value distribution"
            description="Full order history · valid high-value observations retained"
          >
            <dl className="stat-ledger">
              {[
                ["Median", data.revenue_distribution["50%"]],
                ["Mean", data.revenue_distribution.mean],
                ["95th percentile", data.revenue_distribution["95%"]],
                ["Interquartile range", data.revenue_iqr],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{money(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="footnote">
              {number(data.high_value_orders_retained)} orders above the upper
              IQR fence were retained. High value alone does not imply invalid
              data.
            </p>
            <details className="disclosure">
              <summary>Inspect statistical relationships</summary>
              <DataTable
                caption="Correlations with actual delivery duration"
                rows={Object.entries(data.correlations.actual_days)
                  .filter(([key]) => key !== "actual_days")
                  .map(([feature, correlation]) => ({
                    feature,
                    correlation,
                  }))}
                columns={[
                  { key: "feature", label: "Variable", render: humanize },
                  {
                    key: "correlation",
                    label: "Pearson correlation",
                    numeric: true,
                    render: (value) => decimal(value, 3),
                  },
                ]}
              />
              <p className="footnote">
                Warehouse load / delivery duration covariance:{" "}
                {decimal(data.load_duration_covariance, 3)}. Correlation and
                covariance are descriptive.
              </p>
            </details>
          </Section>
        </>
      )}
    </Resource>
  );
}
