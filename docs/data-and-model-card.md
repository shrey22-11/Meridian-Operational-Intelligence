# Data and model card

## Provenance and limitations

All input records are generated locally by `pipeline/generate.py`, seed 42. The fictional retailer has 5,000 customers, 120 products, 12 suppliers, 65,000 raw distinct orders and approximately 162,600 order lines over 2024–2025. Regions are North/South/East/West India; amounts are INR. No external dataset license is needed; there is no personal data. This is a **simulation**, not evidence about actual retail performance. Model performance partly reflects assumptions built into the generator.

Generative assumptions: seasonal and weekend demand, an October/November peak, lognormal travel distance, varying supplier lead times, warehouse congestion, service promises, random cancellations, and a December North customer-mix shift. Delivery duration depends on order-time features plus noise. The generator does not secretly supply its latent outcome to the model. Recent undelivered orders remain open.

## Cleaning and audit

Retain raw CSVs and SHA-256 fingerprints. First duplicate order ID wins. Normalize region/status whitespace and casing; parse dates and numeric types. Missing workload uses a domain fallback of 0.75, rather than an imputation estimate learned from future records. The risk pipeline additionally contains training-only median imputation. Invalid order dates/distance/outcomes are quarantined, invalid items and children of rejected orders are quarantined, and orders with no valid remaining lines are quarantined. Partial item rejection changes the booked total: report counts and inspect quarantine before interpreting results. Large valid orders are retained. Numeric constraints and foreign keys validate the loaded tables.

## Delivery risk

Objective: prioritize open orders likely to exceed their service promise. Features: warehouse load, distance, promise, supplier lead time averaged across lines, units, booked order value, region, channel, expedited service. Assumption: these are known at order placement; real ingestion must preserve the historical snapshot (no backfilled final workload or edited promise).

Compare Logistic Regression and histogram gradient boosting by validation average precision. Train: before April 2025 with labels observed before April. Validation: April–June with labels observed before July. Held-out test: July–September, with outcomes known by December. Date boundary maturity removes unavailable labels; it also causes minor survivor bias near boundaries. A future rolling-origin study with a fixed 60-day label-maturity gap would be stricter. Fit preprocessing on train only. Select threshold on validation with missed-delay cost = 3 × false-alert cost. This cost ratio is illustrative. Freeze the evaluated model for serving; never refit on the held-out test and reuse its scores as fresh test performance.

Metrics: ROC AUC, average precision, precision, recall, F1, Brier score, confusion matrix and target prevalence. They measure discrimination and error, not expected ROI. Check calibration and drift with real data before operational use. Global explanation is permutation importance on validation. Local explanation changes one numeric input to its training median; it is neither SHAP nor a causal effect.

## Demand forecasting

Predict total non-cancelled booked units per day, not inventory consumption or lost demand. Features include lag 7/14, trailing means calculated after shift(1), weekday, month and day-of-year. Chronological train/90-day validation/90-day test. Compare Ridge, histogram gradient boosting and seasonal-naive lag 7. Validation MAE selects the winner; report test MAE/RMSE/R² and baseline scores.

Test predictions are rolling one-day ahead with observed historical lags. The 14-day outlook is recursive and uses a refit of the selected family on all observed history; it should not be interpreted as having the one-day test error at every horizon. Bands are validation absolute-residual quantiles widened by square-root horizon, with no verified multi-step coverage. A future extension should backtest every forecast horizon and account for holidays explicitly.

## Anomaly detection and segments

Isolation Forest fits daily regional orders/revenue/units/delay rate/load through June 2025; later days are monitoring. Contamination 2.5% controls the alert budget in reference data. No ground-truth anomaly accuracy is reported. Seasonal changes and incomplete outcomes can create valid alerts; main-deviation z-scores describe unusual features.

KMeans on standardized log1p recency/frequency/monetary features produces four descriptive groups. Labels are ordered by mean monetary value, not claimed natural customer identities. Snapshot RFM is suitable for current descriptive segmentation, not a validated churn model. No sensitive personal features are used.

## Reproducibility and operational controls

Use pinned environments and seed 42. `artifacts/model_report.json` stores versions, metrics and split definitions; pipeline_runs stores successful ingestion manifests. All writes happen in an ingestion transaction. Bootstrap is an offline maintenance operation: stop the API before refreshing data/models, then restart to invalidate cached model and retrieval objects. Do not train while serving from these local files. For production use versioned artifact directories and atomic promotion.

Only load the project-generated Joblib artifacts; pickle formats can execute code if replaced by untrusted files. The public API is for localhost development and intentionally has no user account/authentication system. Bind to loopback. Add authentication, authorization, rate limiting, auditing and deployment hardening before exposing it externally.
