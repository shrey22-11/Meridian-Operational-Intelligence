import { number, humanize } from "../../lib/format";
import { Section, Resource } from "../../components/UI";
import DataTable from "../../components/DataTable";

export default function DataQuality({ quality }) {
  return (
    <Section
      title="Data quality & lineage"
      description="Latest successful pipeline run · validation and cleaning decisions"
    >
      <Resource resource={quality} label="Data quality audit">
        {(rows) => {
          const report = rows[0]?.report;
          return report ? (
            <>
              <div className="quality-totals">
                <div>
                  <span>Curated orders</span>
                  <strong>{number(report.loaded_orders)}</strong>
                </div>
                <div>
                  <span>Curated order items</span>
                  <strong>{number(report.loaded_items)}</strong>
                </div>
                <p>
                  Raw files remain available. Invalid records are quarantined
                  with reasons rather than silently discarded.
                </p>
              </div>
              <DataTable
                caption="Cleaning audit"
                rows={Object.entries(report)
                  .filter(
                    ([key, value]) =>
                      typeof value === "number" && !key.startsWith("loaded_"),
                  )
                  .map(([decision, count]) => ({ decision, count }))}
                columns={[
                  {
                    key: "decision",
                    label: "Cleaning decision",
                    render: (value) => humanize(value).replace("075", "0.75"),
                  },
                  {
                    key: "count",
                    label: "Affected records",
                    numeric: true,
                    render: number,
                  },
                ]}
              />
              <details className="disclosure">
                <summary>Source fingerprint and run details</summary>
                <p className="metadata">
                  Run ID: <code>{report.run_id}</code>
                </p>
                <p>{report.source}</p>
                <dl className="fingerprints">
                  {Object.entries(report.raw_sha256 || {}).map(
                    ([name, hash]) => (
                      <div key={name}>
                        <dt>{name}</dt>
                        <dd>
                          <code>{hash}</code>
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </details>
            </>
          ) : (
            <p>No successful pipeline run has been recorded.</p>
          );
        }}
      </Resource>
    </Section>
  );
}
