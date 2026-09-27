import BusinessPerformance from "./analytics/BusinessPerformance";
import CustomerSegments from "./analytics/CustomerSegments";
import OperatingConditions from "./analytics/OperatingConditions";
import DataQuality from "./analytics/DataQuality";
import { useState } from "react";
import { useResource } from "../hooks/useResource";
import { query } from "../lib/api";

import { PageHeading, Tabs, ExportLink } from "../components/UI";

export default function Analytics({ filters, setFilters, health, revision }) {
  const [view, setView] = useState("performance");
  const analytics = useResource(
    filters
      ? `analytics?${query({ start_date: filters.start, end_date: filters.end, region: filters.region })}`
      : null,
    revision,
  );
  const bridge = useResource("revenue-bridge", revision);
  const segments = useResource("segments", revision);
  const statistics = useResource("statistics", revision);
  const quality = useResource("quality", revision);
  return (
    <>
      <PageHeading
        eyebrow="BUSINESS ANALYSIS"
        title="Understand the movement"
        description="Separate commercial changes from customer behavior and operating conditions."
        action={
          <ExportLink
            dataset={view === "customers" ? "segments" : "order_facts"}
          />
        }
      />
      <Tabs
        label="Analytics views"
        value={view}
        onChange={setView}
        items={[
          { id: "performance", label: "Business performance" },
          { id: "customers", label: "Customer segments" },
          { id: "statistics", label: "Operating conditions" },
          { id: "quality", label: "Data quality" },
        ]}
      />
      {view === "performance" && (
        <BusinessPerformance
          filters={filters}
          setFilters={setFilters}
          health={health}
          analytics={analytics}
          bridge={bridge}
        />
      )}
      {view === "customers" && <CustomerSegments segments={segments} />}
      {view === "statistics" && <OperatingConditions statistics={statistics} />}
      {view === "quality" && <DataQuality quality={quality} />}
    </>
  );
}
