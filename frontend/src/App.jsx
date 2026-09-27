import { lazy, Suspense, useEffect, useState } from "react";
import Shell, { pages } from "./components/Shell";
import WorkspaceBoundary from "./components/WorkspaceBoundary";
import { Skeleton, ErrorState } from "./components/UI";
import { useResource } from "./hooks/useResource";
import useAnalyst from "./hooks/useAnalyst";
import { initialPeriod } from "./lib/format";
const Overview = lazy(() => import("./pages/Overview"));
const Operations = lazy(() => import("./pages/Operations"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Models = lazy(() => import("./pages/Models"));
const ScenarioLab = lazy(() => import("./pages/ScenarioLab"));
const Analyst = lazy(() => import("./pages/Analyst"));
function readPage() {
  const id = location.hash.slice(1);
  return pages.some((page) => page.id === id) ? id : "overview";
}
export default function App() {
  const [page, setPage] = useState(readPage);
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState(null);
  const health = useResource("health", revision);
  const analyst = useAnalyst();
  useEffect(() => {
    const update = () => setPage(readPage());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (health.data?.snapshot)
      setFilters((current) => current || initialPeriod(health.data.snapshot));
  }, [health.data?.snapshot]);
  const shared = { revision, health: health.data, filters, setFilters };
  return (
    <Shell
      page={page}
      health={health}
      onRefresh={() => setRevision((value) => value + 1)}
    >
      {health.error && (
        <ErrorState
          title="The local data service is unavailable"
          error={health.error}
          retry={health.retry}
        />
      )}
      <WorkspaceBoundary
        key={`${page}-${revision}`}
        onRetry={() => setRevision((value) => value + 1)}
      >
        <Suspense fallback={<Skeleton rows={8} label="Loading workspace" />}>
          {page === "overview" && <Overview {...shared} />}
          {page === "operations" && <Operations {...shared} />}
          {page === "analytics" && <Analytics {...shared} />}
          {page === "models" && <Models {...shared} />}
          {page === "scenario" && <ScenarioLab />}
          {page === "analyst" && (
            <Analyst health={health.data} analyst={analyst} />
          )}
        </Suspense>
      </WorkspaceBoundary>
    </Shell>
  );
}
