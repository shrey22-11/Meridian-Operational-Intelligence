import { money, sum, number, percent } from "../../lib/format";
import { Section, Resource } from "../../components/UI";
import DataTable from "../../components/DataTable";
import Filters from "../../components/Filters";
import { CategoryChart } from "../../components/Charts";

export default function BusinessPerformance({
  filters,
  setFilters,
  health,
  analytics,
  bridge,
}) {
  return (
    <>
      <Filters
        value={filters}
        onChange={setFilters}
        snapshot={health?.snapshot}
      />
      <div className="analysis-columns">
        <Section
          title="Which categories contribute?"
          description="Net booked revenue · selected reporting period"
        >
          <Resource resource={analytics} label="Category performance">
            {(data) => <CategoryChart rows={data.categories} />}
          </Resource>
        </Section>
        <Section
          title="Which regions perform differently?"
          description="Selected reporting period · delivered-order delay rates"
        >
          <Resource resource={analytics} label="Regional comparisons">
            {(data) => (
              <DataTable
                caption="Regional performance comparison"
                rows={data.regions}
                emptyTitle="No regions have activity for this selection"
                columns={[
                  { key: "region", label: "Region" },
                  {
                    key: "revenue",
                    label: "Revenue",
                    numeric: true,
                    render: money,
                  },
                  {
                    key: "orders",
                    label: "Orders",
                    numeric: true,
                    render: number,
                  },
                  {
                    key: "late_rate",
                    label: "Delay rate",
                    numeric: true,
                    render: percent,
                  },
                ]}
              />
            )}
          </Resource>
        </Section>
      </div>
      <Section
        title="What explains the monthly revenue movement?"
        description="Complete calendar months · all regions, independent of reporting filters"
      >
        <Resource resource={bridge} label="Monthly revenue bridge">
          {(data) => (
            <>
              <div className="bridge-summary">
                <div>
                  <span className="metric-label">
                    {data.month} vs previous month
                  </span>
                  <strong>{money(sum(data.regions, "revenue_change"))}</strong>
                </div>
                <div>
                  <span className="metric-label">Order volume effect</span>
                  <b>{money(sum(data.regions, "volume_effect"))}</b>
                </div>
                <span className="bridge-plus">+</span>
                <div>
                  <span className="metric-label">Average basket effect</span>
                  <b>{money(sum(data.regions, "basket_effect"))}</b>
                </div>
              </div>
              <DataTable
                caption="Monthly regional revenue decomposition"
                rows={data.regions}
                columns={[
                  { key: "region", label: "Region" },
                  {
                    key: "previous_revenue",
                    label: "Previous revenue",
                    numeric: true,
                    render: money,
                  },
                  {
                    key: "revenue",
                    label: "Current revenue",
                    numeric: true,
                    render: money,
                  },
                  {
                    key: "volume_effect",
                    label: "Volume effect",
                    numeric: true,
                    render: money,
                  },
                  {
                    key: "basket_effect",
                    label: "Basket effect",
                    numeric: true,
                    render: money,
                  },
                  {
                    key: "revenue_change",
                    label: "Net change",
                    numeric: true,
                    render: (value) => (
                      <strong className={value < 0 ? "negative" : "positive"}>
                        {money(value)}
                      </strong>
                    ),
                  },
                ]}
              />
              <p className="footnote">
                Volume effect + basket effect reconciles to the revenue change.
                This arithmetic explains the movement, not its business cause.
              </p>
            </>
          )}
        </Resource>
      </Section>
    </>
  );
}
