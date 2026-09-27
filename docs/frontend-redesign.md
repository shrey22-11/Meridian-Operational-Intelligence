# Meridian frontend — design and verification

Redesigned locally on 27 September 2026. The existing FastAPI contracts, PostgreSQL data, pipeline, models, controlled tools and retrieval implementation are preserved. This work changes the presentation and frontend organization. It does not introduce generated business data, replacement predictions or canned analyst answers.

## Design decisions

Meridian uses an editorial layout: a primary revenue figure, smaller operational measures, quiet section rules, analytical tables and purpose-specific workspaces. Containers separate tasks only where useful. The identity uses a custom line mark, one system UI font family, tabular numerals and a restrained green accent; blue denotes analytical context and terracotta/amber indicate review signals.

The public references informed principles rather than copied components:

- [Linear](https://linear.app/): restrained hierarchy, typography and consistent interaction details.
- [Vercel's dashboard navigation article](https://vercel.com/changelog/dashboard-navigation-redesign-rollout): a compact shell and clear navigation. Its authenticated dashboard was not available for inspection.
- [Stripe's business insights guide](https://stripe.com/guides/how-to-surface-business-insights-with-stripe): business measures, reporting context and comparisons. Its authenticated dashboard was not available for inspection.
- [Retool's analytics template](https://retool.com/templates/analytics-dashboard): practical filtering and operational exploration. Public material was reviewed; no private workspace was accessed.

These are design interpretations. No reference branding, assets, exact layouts, fonts or color combinations were copied.

## Workspaces and preserved capabilities

| Workspace | Experience | Existing data source |
|---|---|---|
| Overview | Revenue-led metric hierarchy; daily revenue/order toggle; regional contribution; open-order review and monitoring signals | `/api/metrics`, `/api/analytics`, `/api/predictions`, `/api/anomalies` |
| Operations | Delivery predictions, anomaly monitoring and product watchlist; region/search controls, sorting, pagination and order-input inspection | `/api/predictions`, `/api/anomalies`, `/api/products` |
| Analytics | Business performance, calendar-month revenue bridge, RFM segments, operating statistics and cleaning lineage | `/api/analytics`, `/api/revenue-bridge`, `/api/segments`, `/api/statistics`, `/api/quality` |
| Models | Candidate selection, validation and test results, threshold, confusion matrix, feature importance, forecast baseline and limitations | `/api/models`, `/api/forecast` |
| Scenario Lab | First real inference becomes the session baseline; subsequent runs show probability, percentage-point change, input differences and local sensitivity | `POST /api/predictions/scenario` |
| AI Analyst | Question notebook, session analysis history, clickable citations and a persistent evidence panel | `POST /api/ai/chat` and existing registered tools |

The original four workspace functions remain accessible; operations review and the scenario form now have dedicated destinations. Hash links support refresh, direct navigation and browser history without a routing dependency. The original app used local component state and had no server-side page routes to migrate.

Dates and scopes are explicit. Overview defaults to the last 30 **dataset** days. Open-order predictions use the latest saved snapshot. The revenue bridge compares complete calendar months independently of reporting filters. Product watchlist data is scoped to the existing API's last 30 days and all regions. Exports download complete prepared datasets; screen filters do not change export contents.

## Theme and accessibility

- Light, Dark and System are available in the header.
- `meridian.theme` in local storage retains the preference. System mode listens for operating-system changes; first visits use the system preference.
- A small initialization script applies the saved theme before React renders. Storage failures fall back to a working session preference.
- Separate light and dark token values cover all surfaces, text, borders, charts, tooltips, forms and semantic states. Dark mode is a designed low-glare palette, not an inversion filter.
- The UI uses native controls, semantic tables, sortable column headers with `aria-sort`, explicit labels, visible keyboard focus, a skip link and reduced-motion support.
- Mobile navigation uses a native modal dialog with Escape dismissal and focus restoration. Order inspection brings the detail panel into view on narrow screens.
- Wide tables scroll inside their container. Compact two-column audit tables wrap labels so their numerical values remain visible on phones.
- A targeted text-contrast audit checks opaque surfaces against 4.5:1 for ordinary text and 3:1 for large text. It is not a complete accessibility certification or a substitute for assistive-technology testing.

## AI evidence and truthful states

The frontend formats actual registered-tool responses by their meaning: business metrics, revenue movements, predictions, anomalies, forecasts, customer segments, customer history, product performance and policy excerpts. Retrieved documents retain file/chunk references and retrieval scores. Model results remain distinguished from observed outcomes. JSON is available only under **Inspect complete tool response**.

The current API returns a completed answer and tool evidence together. The UI therefore shows a real pending request and explicitly says individual tool progress is not streamed. It does not invent tool names, completion steps, typing output or progress percentages.

Backend guard states remain visible. A withheld explanation never becomes an invented frontend answer; actual tool results are still inspectable. Policy retrieval succeeded in the live Ollama test. A numerical test independently reconciled December revenue evidence to `/api/metrics`; its generated interpretation was withheld by the existing backend guard. This is expected safeguard behavior, not a frontend replacement response.

Evidence-only mode was checked against the **existing** FastAPI app started temporarily on port 8001 with `AI_PROVIDER=evidence`. It returned actual PostgreSQL metrics and retrieved policy excerpts. The normal backend, `.env` and primary Ollama configuration were not changed. That temporary process was stopped after the check.

## Frontend structure

```text
frontend/src/
  App.jsx                         # shell integration and hash navigation
  components/
    Shell.jsx                     # desktop/mobile navigation and theme control
    UI.jsx                        # sections, states and common controls
    Charts.jsx                    # theme-aware Recharts configurations
    DataTable.jsx                 # sorting, selection and optional pagination
    Filters.jsx                   # explicit reporting-period controls
    EvidencePanel.jsx             # meaningful rendering of actual tool results
    WorkspaceBoundary.jsx         # recoverable display failure
  hooks/
    useResource.js                # abortable, independently retryable API reads
    useAnalyst.js                 # session history and actual analyst requests
    useTheme.jsx                  # persisted/system theme preference
  lib/
    api.js                        # API client and useful request failures
    format.js                     # shared number/date/business formatting
    format.test.js                # formatting regression coverage
  pages/
    Overview.jsx, Operations.jsx, Analytics.jsx, Models.jsx
    ScenarioLab.jsx, Analyst.jsx
    analytics/                    # four focused analytical views
  styles/
    tokens.css, shell.css, components.css, pages.css
    analyst.css, responsive.css
```

Pages load on demand. The production main entry is approximately 212 kB (67 kB gzip); the chart module is approximately 398 kB (109 kB gzip) and is separate. No remote fonts, heavy effects or new runtime/dev dependencies were added. Existing React, Vite, Recharts and Lucide are retained. Prettier was used as a temporary formatting tool, not installed as an application dependency.

## Run and verify on Windows

Keep PostgreSQL, the initialized backend and (for the live-model tests) Ollama running using the existing README instructions. If the app is already running, use its existing window at `http://localhost:5173`.

```powershell
# From the project root; run this frontend command only if 5173 is free.
cd frontend
npm.cmd run dev
```

Verification from `frontend`:

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run qa:visual
npm.cmd run qa:evidence
```

`test:e2e` uses installed Microsoft Edge and the running local application with Ollama configured. It preserves and expands the original two browser flows. `qa:evidence` uses the existing project virtual environment and needs port 8001 free; `MERIDIAN_QA_PORT` and `MERIDIAN_PYTHON` can override these QA settings. It cleans up its temporary API process.

From the project root, the unchanged backend suite is:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## Verified results

| Check | Result |
|---|---|
| Production build | Passed; no oversized-chunk warning |
| Frontend unit tests | 3 passed |
| Browser regression tests | 8 passed, including real API, CSV download, scenario inference, policy retrieval and numerical evidence |
| Existing Python tests | 35 passed; dependency deprecation warnings remain |
| Visual review | 88 complete captures: 11 views × 2 themes × 4 viewports |
| Viewports | 1440×900, 1280×800, 390×844, plus 768×1024 |
| Layout/runtime checks | No page-level horizontal overflow, uncaught runtime errors or unexpected alert states in the completed visual audit |
| Text-contrast check | No flagged text contrast in the completed 88-view audit |
| Theme/keyboard | System changes, persisted overrides, skip link, mobile dialog and focus return verified |
| Data integrity | 16 previously captured Python source hashes under backend/analytics/ML/AI match exactly |
| Evidence-only mode | Real API response, structured metrics and policy retrieval verified |
| Git/cloud | No Git commands or deployment actions performed |

The browser suite intentionally aborts selected requests to verify recoverable failures. Successful business workflows use live services rather than mock metrics or fabricated AI answers.

Review artifacts are generated under `reports/redesign/` (already ignored by the project):

- `before/`: original page captures and public reference captures.
- `after/`: full-page screenshots for every view, plus 16 labeled review sheets.
- `after/review.json`: per-view layout, runtime and text-contrast results.
- `workflows/`: successful scenarios, selected orders, filters, error states, actual AI responses and evidence-only captures.
- `backend-integrity.json`: unchanged-source check.

The visual review led to real fixes: paginated operational queues, visible chart grid lines, stronger muted text, correct date formatting for anomaly rows, clearer model names, useful mobile audit tables, proportional segment bars on phones, focused order inspection and a readable primary-button hover state.

## Remaining boundaries

- Session analyses and scenario baselines are kept in memory; a full browser reload clears them. Theme preference persists.
- The backend does not stream tool progress. The frontend reports this honestly.
- Local LLM quality varies. Existing checks can withhold an explanation while preserving the exact underlying evidence. OpenAI was not live-tested in this frontend pass.
- CSV exports use the existing complete datasets, not the screen's date/region filters. Operational search and pagination cover the returned queue, up to 100 records per selection.
- Very wide analytical tables intentionally scroll on phones. Safari/Firefox and physical-device screen readers were not tested; browser verification used Chromium-based Microsoft Edge.
- The data remains synthetic. The redesign makes no new real-world performance or causal claims.
