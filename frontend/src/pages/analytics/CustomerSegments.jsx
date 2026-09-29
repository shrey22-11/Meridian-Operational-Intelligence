import { useState } from "react";
import { percent, sum, number, money, decimal } from "../../lib/format";
import { Section, Resource } from "../../components/UI";
import DataTable from "../../components/DataTable";

export default function CustomerSegments({ segments }) {
  const [selected, setSelected] = useState(null);
  return (
    <Section
      title="Customer segments"
      description="Recency, frequency and monetary value · all customers at the dataset snapshot"
    >
      <Resource resource={segments} label="Customer segments">
        {(rows) => (
          <>
            <div className="segment-composition">
              {rows.map((row, index) => (
                <button
                  aria-pressed={selected === row.segment} onClick={() => setSelected(row.segment)}
                  onFocus={() => setSelected(row.segment)}
                  key={row.segment}
                  style={{
                    flex: row.customers,
                    "--segment-share": `${(row.customers / sum(rows, "customers")) * 100}%`,
                  }}
                  title={`${row.segment}: ${number(row.customers)} customers`}
                >
                  <span className={`segment-swatch swatch-${index}`} />
                  <strong>
                    {percent(row.customers / sum(rows, "customers"))}
                  </strong>
                  <span>{row.segment}</span>
                </button>
              ))}
            </div>
            <DataTable
              caption="RFM customer segment comparison"
              rows={rows}
              rowKey="segment" selectedKey={selected}
              columns={[
                { key: "segment", label: "Segment" },
                {
                  key: "customers",
                  label: "Customers",
                  numeric: true,
                  render: number,
                },
                {
                  key: "revenue",
                  label: "Booked value",
                  numeric: true,
                  render: money,
                },
                {
                  key: "mean_recency",
                  label: "Days since order",
                  numeric: true,
                  render: decimal,
                },
                {
                  key: "mean_frequency",
                  label: "Orders / customer",
                  numeric: true,
                  render: decimal,
                },
                {
                  key: "late_rate",
                  label: "Delay rate",
                  numeric: true,
                  render: percent,
                },
              ]}
            />
            {selected && <p className="selection-summary">{selected} highlighted in the exact-value comparison.</p>}
            <p className="footnote">
              KMeans groups standardized log-transformed RFM behavior. Segment
              names are descriptive, ordered by monetary value. This is not a
              churn-risk model.
            </p>
          </>
        )}
      </Resource>
    </Section>
  );
}
