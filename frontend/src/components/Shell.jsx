import { useEffect, useRef } from "react";
import {
  LayoutGrid,
  ListFilter,
  ChartNoAxesCombined,
  SlidersHorizontal,
  FlaskConical,
  PanelLeftClose,
  Menu,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  NotebookPen,
  ArrowUpRight,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { dateLabel } from "../lib/format";

export const pages = [
  { id: "overview", label: "Overview", icon: LayoutGrid, group: "WORKSPACE" },
  { id: "operations", label: "Operations", icon: ListFilter },
  { id: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  {
    id: "models",
    label: "Models",
    icon: FlaskConical,
    group: "DECISION TOOLS",
  },
  { id: "scenario", label: "Scenario Lab", icon: SlidersHorizontal },
  { id: "analyst", label: "AI Analyst", icon: NotebookPen },
];
function Brand() {
  return (
    <a href="#overview" className="brand" aria-label="Meridian overview">
      <svg viewBox="0 0 30 30" aria-hidden="true">
        <path d="M5 24V6L15 17 25 6v18M15 3v24" />
        <path d="M1 15h5m18 0h5" />
      </svg>
      <span>
        MERIDIAN<small>Operational intelligence</small>
      </span>
    </a>
  );
}
function Navigation({ page, onNavigate }) {
  return (
    <nav aria-label="Main navigation">
      {pages.map(({ id, label, icon: Icon, group }) => (
        <div key={id}>
          {group && <div className="nav-group">{group}</div>}
          <a
            href={`#${id}`}
            className={`nav-link ${page === id ? "active" : ""}`}
            aria-current={page === id ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon size={17} strokeWidth={1.6} />
            <span>{label}</span>
            {page === id && <i />}
          </a>
        </div>
      ))}
    </nav>
  );
}
export default function Shell({ page, health, onRefresh, children }) {
  const { theme, setTheme, resolved } = useTheme();
  const dialog = useRef(null);
  const menuButton = useRef(null);
  const ThemeIcon =
    theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  const active = pages.find((item) => item.id === page);
  function closeMenu() {
    dialog.current?.close();
    menuButton.current?.focus();
  }
  useEffect(() => {
    document.title = `${active.label} · Meridian`;
    window.scrollTo(0, 0);
  }, [page, active.label]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to main content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-name">
          <span className="workspace-monogram">R</span>
          <div>
            Retail operations<small>Portfolio workspace</small>
          </div>
        </div>
        <Navigation page={page} />
        <div className="sidebar-bottom">
          <span
            className={`connection-dot ${health.data ? "connected" : ""}`}
          />
          <div>
            {health.data
              ? "Data connected"
              : health.loading
                ? "Connecting to data"
                : "Service unavailable"}
            <small>
              {health.data
                ? "Synthetic business data"
                : "Check backend connection"}
            </small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuButton}
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => dialog.current.showModal()}
            >
              <Menu size={19} />
            </button>
            <span>Retail operations</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{active.label}</strong>
          </div>
          <div className="header-actions">
            <span className="snapshot-label">
              Snapshot <b>{dateLabel(health.data?.snapshot)}</b>
            </span>
            <button
              className="icon-button"
              aria-label="Refresh data"
              title="Refresh data"
              onClick={onRefresh}
            >
              <RefreshCw size={16} />
            </button>
            <label className="theme-control">
              <ThemeIcon size={15} />
              <span className="sr-only">Theme</span>
              <select
                aria-label="Theme"
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="page-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            MERIDIAN <i /> AI-Driven Operational Intelligence
          </span>
          <span>
            {health.data
              ? `Synthetic data · ${dateLabel(health.data.snapshot)}`
              : "Operational intelligence workspace"}
          </span>
        </footer>
      </div>
      <dialog
        ref={dialog}
        className="navigation-drawer"
        onClick={(event) => {
          if (event.target === dialog.current) closeMenu();
        }}
        onCancel={() => menuButton.current?.focus()}
      >
        <div className="drawer-heading">
          <Brand />
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={closeMenu}
          >
            <PanelLeftClose size={19} />
          </button>
        </div>
        <Navigation page={page} onNavigate={closeMenu} />
        <p className="muted">
          AI-Driven Operational Intelligence
          <br />
          Synthetic-data portfolio workspace
        </p>
      </dialog>
    </div>
  );
}
