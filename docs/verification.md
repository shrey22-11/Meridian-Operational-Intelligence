# Execution record — 26–27 September 2026

This records actual execution on the Windows development machine, not expected behavior.

**Final restart handoff — 27 September 2026:** [the handoff record](handoff.md) documents a complete local service stop/start, 35 passing Python tests, 3 frontend unit tests, a successful build, 8 passing final browser tests, 569 source checks and 262 reopened Power BI engine checks. All six final themed pages were captured. The first cold-start Ollama request failed during CUDA initialization; retry and the full rerun succeeded. The numerical guard withheld prose while preserving reconciled evidence. No data regeneration or model training was performed during this final pass.

**Frontend update — 27 September 2026:** the existing backend was preserved and its 35 tests passed again. The redesigned frontend has 3 passing unit tests, 8 passing browser tests and 88 visual captures across 11 views, two themes and four viewports. Real Ollama policy retrieval, independently reconciled numerical evidence, scenario inference and an isolated evidence-only API were verified. The numerical explanation can still be withheld by the existing guard; actual data remains visible. See [frontend design and verification](frontend-redesign.md) for the current UI record. The table below retains the original project-build history.

| Component | Result and evidence |
|---|---|
| PostgreSQL | Private PostgreSQL 17 cluster initialized on loopback port 55432. Real schema, constraints, indexes and analytical views loaded successfully. Existing system cluster untouched. |
| Data pipeline | Clean end-to-end bootstrap completed. 64,935 curated orders and 162,425 line items. 100 duplicates removed, 130 workload values defaulted, 60 invalid orders plus 5 orders without valid lines quarantined, 210 items quarantined. |
| SQL | Real API queries and independent order-line revenue reconciliation passed. Monthly volume + basket bridge reconciles to revenue change. Read-only transactions reject writes. |
| EDA/statistics | Four-panel PNG and statistical JSON produced, including Wilson intervals and 1,000 daily block bootstrap resamples. |
| Classification | Training, validation selection, test evaluation, Joblib save/reload, open-order scoring and scenario inference succeeded. Selected Logistic Regression; held-out ROC AUC 0.8696, recall 0.7971, precision 0.5493, average precision 0.7313. |
| Forecast | Selected gradient boosting. One-day test MAE 56.38 units vs seasonal baseline 78.81; RMSE 69.88. Actual 14-day recursive output created. |
| Other ML | Isolation Forest daily regional monitoring scores and KMeans RFM segments generated from data. |
| PySpark | Real Apache Spark 3.5.5 / Java 17 job processed 1,624,250 replicated item records. All 2,924 region/day groups reconciled with PostgreSQL for revenue, units and order counts. Spark-normalized revenue INR 901,651,538.1655 and units 338,781. |
| API | Running locally. Read endpoints, scenario requests, exports, invalid input, missing provider behavior and database error handling tested. |
| Frontend | Production build passed. Browser tests used actual local API calls in Microsoft Edge. Filters changed revenue; scenario changes changed predictions; AI evidence appeared; mobile viewport had no horizontal overflow. Screenshots inspected. |
| Local GenAI | Existing Ollama `qwen2.5:7b` executed real tool calls for December revenue, policy retrieval and open-order risk. Final live evaluation passed all three cases, taking about 18–26 seconds per question on this machine. |
| AI safeguards | Earlier live output misstated revenue; numerical guard withheld it. Date requirements and citation validation were strengthened. Final December request explicitly used December 1–31 and answered INR 34,406,088.16 from the database. |
| RAG | 15 policy chunks indexed into 14-dimensional local LSA vectors. Retrieval tests and real LLM policy answers passed. This is TF-IDF/SVD retrieval, not neural embeddings. |
| Python tests | 35 tests passed after clean rebuild. Third-party deprecation warnings remain; no failed tests. |
| Browser tests | Two end-to-end tests cover dashboard, filters, analytics, scenarios, responsive layout and actual AI requests/evidence. |
| Power BI | Completed 27 September: populated six-page PBIX saved and reopened with its Meridian theme; 14 ready tables, 49 error-free measures, 14 relationships and 262 actual-engine checks. All six final page screenshots are available. See [Power BI execution record](power-bi-verification.md). |
| Docker | Compose configuration validation passed. Container images/services were not executed because Docker Desktop's daemon was not running. Native Windows execution is verified. |
| OpenAI | Real Responses API integration implemented, but not live-tested because no API key was supplied. Local Ollama was tested instead. |
| Dependency audit | Frontend dependency audit returned zero known vulnerabilities after compatible Vite update. `requirements-verified.txt` records the installed Python environment including optional Spark. This is not a comprehensive security audit. |
| Git/cloud | No Git commands, commits, pushes, repository publishing, GitHub Actions, or cloud deployments performed. Local generated credentials live in ignored `.env`; examples contain placeholders only. |

## Fixes discovered during execution

- Windows `pg_ctl` server children inherited captured pipe handles. The helper now uses a file for startup output and checks loopback readiness before starting a cluster.
- Scikit-learn worker creation needed normal Windows process permissions in this agent environment. Training and tests were rerun successfully with approved access.
- Retrieval builder shadowed its cache function with a chunk counter; fixed and the complete bootstrap rerun.
- Spark required Java 17 rather than system Java 25. A verified official Temurin runtime was downloaded into `.local`, with no system Java change. A short native temporary directory resolved Java's local socket path problem. Portable aggregate export succeeded without downloading winutils binaries.
- Frontend screenshots initially captured charts during animation. Chart animations are disabled for stable reporting and browser verification.

## Artifacts to inspect

- `data/curated/quality_report.json`, `quarantine_orders.csv`, `quarantine_order_items.csv`
- `artifacts/model_report.json`, `forecast_backtest.csv`, `forecast.csv`
- `reports/statistics.json`, `operations_eda.png`
- `reports/ai_live_evaluation.json` with actual tool arguments/results and generated answers
- `data/exports/spark_report.json` with `postgres_reconciliation: passed`
- `reports/dashboard.png`, `models.png`, `ai-analyst.png`, `mobile.png`

Synthetic-data metrics are useful for verifying the system, not proof of real-world predictive performance or business impact. Numerical/citation matching is a guard, not a formal guarantee against every incorrect interpretation. The app is intended for loopback development, not unauthenticated public hosting.


## Power BI update - 27 September 2026

The [Power BI execution record](power-bi-verification.md) records the completed report. All 14 tables loaded with privacy checks retained. The final saved PBIX reopened with the Meridian theme intact and passed 262 actual-engine checks again. Six unique, visually inspected captures are available in [the gallery](screenshots.md); there is no remaining theme-import or report-assembly step on this machine.
