import { percent, sum, number, money, decimal } from "../../lib/format";
import { Section, Resource } from "../../components/UI";
import DataTable from "../../components/DataTable";

export default function CustomerSegments({ segments }) {
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
                <div
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
                </div>
              ))}
            </div>
            <DataTable
              caption="RFM customer segment comparison"
              rows={rows}
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
