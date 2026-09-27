# Power BI execution record — 27 September 2026

## Delivered and verified

`powerbi/Meridian.pbix` is a real, populated Power BI Desktop file (about 7 MB), saved
and reopened successfully. It contains six pages, 78 native visuals, 14 imported tables,
14 single-direction relationships and 49 explicit DAX measures. Editable PBIP source,
the builder, DAX review copy, theme and verification utilities are also supplied.

The original project had exports, DAX examples and an assembly guide, without an actual
report. The report now implements executive performance, fulfillment risk, customer
economics, demand planning, data trust/monitoring, and customer drillthrough.

## Privacy/source diagnosis and fix

`Items (step Revenue)` combined a direct CSV read with a reference to Orders inside one
query partition. Customer/segment and product/supplier joins had the same structural issue.
Each CSV read is now isolated in a load-disabled staging query; joins reference staged
results. No privacy levels were ignored, disabled or bypassed. Source classification
remained user-controlled. No business data or business calculation was changed.

Applied the external source changes and pending query changes in Desktop. All 14 tables
loaded successfully. The relationship/incomplete-data/external-change/pending-query
warning banners were absent in the saved and reopened report.

Also fixed reserved-name DAX references from `Model[...]` to `'Model'[...]`, restored the
monthly revenue binding, suppressed future empty months in the observed-revenue chart,
and increased slicer spacing after interaction testing found overlapping KPI hit areas.

## Execution evidence

- **569 source checks**: CSV versus PostgreSQL/API/artifacts across 25 date/region cases,
  including source fields, daily aggregates, categories, saved probabilities, segments,
  forecasts, run IDs and source fingerprints.
- **262 actual Desktop DAX checks passed again after reopening the PBIX**, including 25
  date/region cases and risk, forecasting, segment and item/order reconciliation.
- All **49 measures** compiled without semantic errors. All **14 partitions** were ready.
- Actual imported row counts: Orders 64,935; Items 162,425; Customers 5,000; Products 120;
  Open Risk 410; Daily Operations 2,924; Anomalies 32; Forecast 14; Backtest 90; Date 745;
  Region 4; Model 1; Quality 7; Lineage 5.
- All six populated pages were visually inspected. Tested North-region filtering
  (booked revenue ₹273.95M), single-day filtering (1 January 2024, 83 received orders),
  clearing selections, and right-click customer drillthrough (24 orders / ₹491.56K).
  Overview filter hit areas were rechecked after spacing correction.
- 89 source schema documents passed Microsoft-schema validation; semantic field references,
  relationship endpoints and theme filename mapping passed source validation.
- 100 protected application/database/pipeline/ML/AI/business-data files remained unchanged
  by SHA256 comparison. No Git commands, deployment, data generation or model training.

## Final restart, theme and screenshots

After the user's theme import and save, the final `powerbi/Meridian.pbix` was closed and
reopened in a new Desktop instance on **27 September 2026**. The saved report's embedded
custom-theme resource and its reference agree. The Meridian green/blue palette persisted
on all six pages; no relationship, incomplete-data, external-change or query-change warning
banner appeared. All 14 partitions were ready and all 49 measures remained error-free.

The reopened engine passed **262 DAX checks across 25 filter cases again**. Source
reconciliation also passed **569 checks**, with **100 protected files unchanged**. Customer
3206 drillthrough was repeated after reopening: 24 received orders, ₹491.56K booked revenue,
20.8% delivered-order delay and no open orders. These are synthetic snapshot values.

Six fresh screenshots were captured from their actual pages, visually inspected, and
checked for distinct original and cropped-image SHA256 hashes. The earlier cached-image
capture problem is resolved; none of those duplicate captures is used in the final gallery.

- Publishable screenshots: `docs/assets/powerbi/01-executive-overview.png` through
  `06-customer-detail.png`; see [all six pages](screenshots.md).
- [Capture manifest](assets/powerbi/manifest.json): source, crop bounds, unique hashes and
  filter context. Page 06 shows customer 3206 reached by drillthrough; the slicer's `All`
  describes its local selection, not the inherited customer filter.
- Uncropped originals: `reports/powerbi/final/` (local generated evidence).
- Final PBIX size: **7,075,412 bytes**.
- Final PBIX SHA256: `81fb29ff77dfc67bb42db705908a4ee80779bc094d3f4bb162b35ddba9170628`.

Read-only evidence lives in `reports/powerbi/data-validation.json`, `desktop-validation.json`,
`desktop-periods.json`, `desktop-models.json`, `desktop-tables.json`, `desktop-metadata.json`
and `pbix-validation.json`. `reports/handoff/persisted-theme.json` records the saved theme
mapping. These generated logs are local and ignored; this execution record and gallery are
part of the documentation.

## Completion and portability

No manual theme import, DAX reconstruction, relationship repair or report-page assembly
remains for this saved local PBIX. The source/query privacy correction and the user's final
theme save were verified; privacy checks were not bypassed. This final handoff reopened the
saved imported model and reconciled it against current sources; it did not regenerate data,
retrain models or perform another unnecessary data refresh.

When moving the project, update Power Query's `ProjectRoot`, provide bootstrap-generated
exports/artifacts, then refresh. Classify sources normally if Desktop asks and leave
**Ignore Privacy Levels** unchecked. PBIP is editable source; the populated PBIX is a local
binary ignored by default. Publication or sharing that binary remains the owner's choice.

The report is an imported synthetic snapshot, not a live API connection. There is no Power BI
Service deployment or report embedding. The [final handoff](handoff.md) records application
restart tests and AI limitations separately.
