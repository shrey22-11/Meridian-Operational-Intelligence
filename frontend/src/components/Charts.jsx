import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import {
  compact,
  money,
  number,
  shortDate,
  decimal,
  humanize,
} from "../lib/format";
import { Empty } from "./UI";

export function Plot({ children, label, height = 260 }) {
  return (
    <div className="plot" style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
export function ChartTooltip({
  active,
  payload,
  label,
  formatter = number,
  date = false,
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{date ? shortDate(label) : label}</strong>
      {payload.map((entry, i) => (
        <div key={`${entry.dataKey}-${i}`}>
          <span>
            <i style={{ background: entry.color }} />
            {entry.name}
          </span>
          <b>{formatter(entry.value)}</b>
        </div>
      ))}
    </div>
  );
}

const axis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: "var(--text-muted)", fontSize: 11 },
  tickMargin: 10,
};

export function RevenueChart({ rows, metric = "revenue" }) {
  if (!rows.length)
    return (
      <Empty title="No order activity for this period">
        Try widening the reporting dates or choosing another region.
      </Empty>
    );
  return (
    <Plot
      label={`Daily ${metric === "revenue" ? "booked revenue in INR" : "order counts"} over the selected reporting period`}
      height={266}
    >
      <LineChart
        accessibilityLayer
        data={rows}
        margin={{ top: 15, right: 15, bottom: 0, left: 0 }}
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--chart-grid)"
          strokeDasharray="2 5"
        />
        <XAxis
          {...axis}
          dataKey="day"
          tickFormatter={shortDate}
          minTickGap={35}
        />
        <YAxis
          {...axis}
          tickFormatter={compact}
          width={56}
          domain={[0, "auto"]}
        />
        <Tooltip
          content={
            <ChartTooltip
              formatter={metric === "revenue" ? money : number}
              date
            />
          }
          cursor={{ stroke: "var(--chart-guide)", strokeDasharray: "3 3" }}
        />
        <Line
          isAnimationActive={false}
          type="linear"
          dataKey={metric}
          name={metric === "revenue" ? "Net booked revenue" : "Orders received"}
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--surface)", strokeWidth: 2 }}
        />
      </LineChart>
    </Plot>
  );
}
export function ForecastChart({ rows }) {
  if (!rows.length) return <Empty title="The forecast is not available" />;
  return (
    <>
      <div className="chart-legend">
        <span>
          <i className="legend-line" />
          Predicted units
        </span>
        <span>
          <i className="legend-line dashed" />
          Planning range
        </span>
      </div>
      <Plot label="Fourteen-day predicted demand with heuristic lower and upper planning bounds">
        <LineChart
          accessibilityLayer
          data={rows}
          margin={{ top: 12, right: 15, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="2 5"
          />
          <XAxis
            {...axis}
            dataKey="day"
            tickFormatter={shortDate}
            minTickGap={35}
          />
          <YAxis
            {...axis}
            tickFormatter={compact}
            width={48}
            domain={[0, "auto"]}
          />
          <Tooltip content={<ChartTooltip date />} />
          <Line
            isAnimationActive={false}
            dataKey="upper"
            name="Upper range"
            stroke="var(--chart-secondary)"
            strokeDasharray="4 4"
            dot={false}
          />
          <Line
            isAnimationActive={false}
            dataKey="units"
            name="Predicted units"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            isAnimationActive={false}
            dataKey="lower"
            name="Lower range"
            stroke="var(--chart-secondary)"
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </Plot>
    </>
  );
}
export function CategoryChart({ rows }) {
  if (!rows.length) return <Empty title="No booked sales in this selection" />;
  return (
    <Plot label="Booked revenue by product category" height={260}>
      <BarChart
        accessibilityLayer
        data={rows}
        layout="vertical"
        margin={{ top: 0, left: 10, right: 15 }}
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--chart-grid)"
          strokeDasharray="2 5"
        />
        <XAxis {...axis} type="number" tickFormatter={compact} />
        <YAxis {...axis} type="category" dataKey="category" width={94} />
        <Tooltip
          cursor={{ fill: "var(--hover)" }}
          content={<ChartTooltip formatter={money} />}
        />
        <Bar
          isAnimationActive={false}
          dataKey="revenue"
          name="Booked revenue"
          fill="var(--chart-blue)"
          barSize={22}
          radius={[0, 2, 2, 0]}
        />
      </BarChart>
    </Plot>
  );
}
export function ImportanceChart({ rows }) {
  return (
    <Plot
      label="Validation permutation importance: change in average precision"
      height={286}
    >
      <BarChart
        accessibilityLayer
        data={rows.slice(0, 7)}
        layout="vertical"
        margin={{ left: 8, right: 15 }}
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--chart-grid)"
          strokeDasharray="2 5"
        />
        <XAxis {...axis} type="number" tickFormatter={(v) => decimal(v, 2)} />
        <YAxis
          {...axis}
          type="category"
          dataKey="feature"
          tickFormatter={humanize}
          width={130}
        />
        <Tooltip
          content={<ChartTooltip formatter={(v) => decimal(v, 4)} />}
          cursor={{ fill: "var(--hover)" }}
        />
        <ReferenceLine x={0} stroke="var(--line)" />
        <Bar
          isAnimationActive={false}
          dataKey="importance"
          name="Importance"
          fill="var(--chart-blue)"
          barSize={16}
        />
      </BarChart>
    </Plot>
  );
}
