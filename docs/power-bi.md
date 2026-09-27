# Meridian Operations — Power BI report

The report is now implemented as an editable [Power BI project](../powerbi/Meridian.pbip),
not a collection of assembly instructions. See [execution status](power-bi-verification.md)
for Desktop validation of the populated PBIX. The final report reopened with its Meridian
theme intact on 27 September 2026. All six pages are in the [screenshot gallery](screenshots.md).

## Report pages

| Page | Business question | Main visuals and controls |
|---|---|---|
| 01 Executive overview | How are commercial performance and delivery reliability changing? | Booked revenue, margin, received orders, on-time rate, margin rate; monthly trend, regional and category contribution; date/region/channel slicers |
| 02 Fulfillment investigation | Which open orders deserve attention? | Open and high-risk counts, artifact threshold and held-out AUC/recall; sorted order queue, historical product/supplier delay; date/region slicers |
| 03 Customer economics | Which customer groups contribute value and need attention? | Snapshot RFM counts/value/recency/frequency/customer delay; segment comparisons and customer table; region/segment/channel slicers; customer drillthrough |
| 04 Demand planning | What demand should operations plan for? | Portfolio units forecast, selected model, one-day MAE versus baseline, daily historical units, 14-day bounds and held-out backtest |
| 05 Data trust & monitoring | What can be trusted, and what needs investigation? | Actual cleaning counts, source fingerprints, snapshot, monitoring-only anomaly table |
| 06 Customer detail | What is the selected customer's order history? | Customer ID slicer/drillthrough; booked revenue, received orders, basket, delay and open orders; revenue history and order-level outcomes |

Native Power BI visuals only. Segoe UI, a restrained green/blue palette, an off-white canvas,
consistent section placement, INR formats, explicit labels, titles and alt text. Chart clicks
cross-filter related visuals; tabs provide navigation. Tables sort and scroll natively.
The authoring canvas is 1440 × 900 and uses Fit to page.

## Sources and transformations

All source records remain in their existing locations. No new business records are invented.

| Model table | Source / transformation | Grain |
|---|---|---|
| Orders | `data/exports/order_facts.csv` | One order; 64,935 rows in verified snapshot |
| Items | `order_items.csv`, joined to a narrow Orders projection; computed line net value | One order item; 162,425 rows |
| Customers | `customers.csv` left-joined to `segments.csv` | One customer; 5,000 rows; current RFM labels |
| Products | `products.csv` joined to `suppliers.csv` | One product; 120 rows |
| Open Risk | `scored_orders.csv`, status=open | One open order; model probability, no retraining |
| Daily Operations | `daily_operations.csv` | One day/region |
| Anomalies | `anomalies.csv`, is_anomaly=true and period=monitoring | Flagged day/region only |
| Forecast | `forecast.csv` | One future portfolio day |
| Backtest | `forecast_backtest.csv` | One held-out observed day |
| Date | Continuous date list from earliest order through latest forecast | One date; marked time dimension |
| Region | Distinct Customers.region | One region |
| Model | Actual `artifacts/model_report.json` fields | One artifact metadata record |
| Quality | Actual numeric `data/curated/quality_report.json` audit fields | One audit category |
| Lineage | Actual raw SHA256 fingerprints from quality report | One source table |

CSV parsing explicitly sets UTF-8, comma delimiters, quoted fields, empty-string nulls,
date/boolean/integer/decimal types, and `en-US` source parsing independent of Windows locale.
Each CSV is isolated in a load-disabled staging query. Joins reference those queries rather
than combining direct file access and query references in one privacy partition. Privacy
checks remain enabled.
Floating-point amounts retain source precision; formatting rounds display to two decimals.
The report's root-folder parameter contains no database password or API key.

## Relationships

All 14 active relationships are **one-to-many, single direction from dimension to fact**:

- Date[Date] → Orders[ordered_at], Items[ordered_at], Open Risk[ordered_at],
  Daily Operations[day], Anomalies[day], Forecast[day], Backtest[day].
- Region[region] → Customers[region], Daily Operations[region], Anomalies[region].
- Customers[customer_id] → Orders[customer_id], Items[customer_id], Open Risk[customer_id].
- Products[product_id] → Items[product_id].

There is no fact-to-fact relationship, bidirectional relationship, or many-to-many join.
Customer region filters flow through Customers to both Orders and Items, so category totals
reconcile without duplicating order revenue. Product selections affect item measures only;
they must not be presented as filtering order-level executive KPIs. Daily aggregate delay
rates are never averaged to calculate the executive delay rate.

## Implemented measures

The authoritative DAX is in `powerbi/Meridian.SemanticModel/model.bim` and its review copy
`powerbi/measures.dax`. Measures have display folders and explicit currency/percent formats.

- **Observed Revenue:** the monthly chart uses booked revenue only where order rows exist,
  so the future calendar is not plotted as observed zero revenue.
- **Booked Revenue / Gross Margin:** sums for non-cancelled orders, matching PostgreSQL.
- **Orders Received:** all orders, including cancellations. **Booked Orders:** non-cancelled.
- **Average Basket:** booked revenue / booked orders. This matches the API's mean booked
  order revenue; it is not divided by all received orders.
- **Delay Rate:** late delivered orders / delivered orders. Open/cancelled labels are absent,
  not zero-delay observations. **On Time Rate:** 1 − delay, blank when no deliveries exist.
- **Prior Period Revenue / Revenue Change:** immediately preceding equal-length inclusive
  period, as used by `/api/metrics`. For December 1–31, comparison is October 31–November 30.
  This is deliberately distinct from **Prior Month Revenue / Revenue MoM**, also implemented.
  No previous revenue means a blank comparison rather than infinity or a fabricated zero.
- **Item Booked Revenue:** quantity × price × (1 − discount), excluding cancellations, matching
  the SQL category aggregation. It is never added to order-level revenue.
- **Product Historical Delay:** average delivered item-row delay, shown only with at least
  20 distinct delivered orders. This preserves the existing product-watchlist SQL definition;
  repeated product lines carry repeated weight, unlike the executive order-weighted KPI.
- **High Risk Open Orders:** compares each actual saved open-order probability with the
  threshold imported from model_report; the threshold is not copied into the DAX.
- **Segment Lifetime Revenue / Mean Recency / Mean Frequency / Mean Customer Delay:** match
  `/api/segments`. Customer delay here is customer-weighted. These are current snapshot
  attributes and are deliberately not date-filtered.
- **Forecast Units / Lower / Upper:** sums of the actual saved forecast; continuous forecast
  values are displayed with one decimal. Bounds are heuristic, not validated multi-day coverage.
- **One Day Test MAE / Seasonal Baseline MAE / Risk ROC AUC / Risk Recall:** actual saved
  evaluation values, unaffected by business-date filters. They are not current live accuracy.

## Validation and demonstration

Run `powerbi/verify_data.py` with PostgreSQL and the existing API running. It compares all
exported order, item and dimension fields, all daily aggregate groups, five periods across
five region scopes, category totals, probabilities, segment summaries, forecast values,
source/artifact byte hashes and run IDs. It also checks protected source/data hashes.

After Desktop refresh, use the supplied `validation.dax` and `validation-models.dax` in DAX
query view, or `query_model.ps1` against the current local Desktop port. Compare actual engine
results with `reports/powerbi/expected-values.json`; source arithmetic alone is not DAX proof.

Useful checkpoints for the current snapshot (display values rounded only):

| Check | Expected |
|---|---:|
| All-history booked revenue | ₹901,651,538.17 |
| All-history received orders | 64,935 |
| December booked revenue | ₹34,406,088.16 |
| December gross margin | ₹9,992,412.69 |
| December received orders | 2,518 |
| December delivered-order delay | 25.0245% |
| December equal-length prior revenue | ₹43,880,688.03 |
| December equal-length revenue change | −21.5917% |
| Open scored / high-risk orders | 410 / 162 |
| Monitoring anomalies | 32 |
| 14-day forecast units | 6,384.4610 |
| One-day test / baseline MAE | 56.3801 / 78.8111 units |

Interview walkthrough: explain booked vs cash revenue → filter December and North → show
the category/order grain reconciliation → inspect the high-risk queue → drill through one
customer → contrast one-day test performance with the recursive outlook → show source lineage.
These are synthetic observations; do not claim realized savings, adoption, or causal impact.

## Refresh and portability

Open the populated `powerbi/Meridian.pbix`, or `powerbi/Meridian.pbip`. When the folder changes,
edit Power Query's **ProjectRoot** parameter to the project root. Refresh reads existing
exports/artifacts; it never runs the data generator or retrains models. Keep model artifacts,
quality report and exports on the same pipeline run. Use the existing exporter only when
intentionally updating BI extracts after a pipeline run.

No cloud connection, credentials embedded in report source, custom visual marketplace
dependency, deployment, or Git operation is involved.

Format references: [Microsoft PBIR documentation](https://learn.microsoft.com/en-us/power-bi/developer/embedded/projects-enhanced-report-format),
[semantic model project format](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset),
[Microsoft report schemas](https://github.com/microsoft/json-schemas/tree/main/fabric/item/report).
