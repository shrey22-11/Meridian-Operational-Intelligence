# Meridian — five-minute local demo

Use the [root README](../README.md) for first-time setup. On an already initialized
workspace, start the private PostgreSQL cluster, start Ollama with `qwen2.5:7b` installed,
and run `scripts/start.ps1`. Open `http://localhost:5173` and local `powerbi/Meridian.pbix`.
The data snapshot is **31 December 2025**, not today's live operations. Do not run bootstrap
or regenerate data just to give the demo.

1. **Overview:** explain net booked revenue versus cash receipts. Change the region to
   North, observe the KPIs/charts change, then reset it. Explain that the web default covers
   the last 30 dataset days, while the Power BI default covers all history.
2. **Operations and analytics:** inspect the ranked open-order queue and an order's details.
   Show an anomaly as an investigation candidate. Open customer segments and data quality
   to connect analysis with the underlying cleaning audit and pipeline lineage.
3. **Models and Scenario Lab:** show held-out metrics and the forecasting baseline. Change
   warehouse load in a scenario and compare the predicted probability. Explain chronological
   splits, placement-time inputs and why a model sensitivity is not causal evidence.
4. **AI Analyst:** ask “How is booked revenue different from cash receipts?” Expand the
   `search_policies` evidence and its source citation. Then ask “What was booked revenue
   from 2025-12-01 to 2025-12-31? Cite the exact value.” Inspect the tool's actual period and
   revenue, **₹34,406,088.16**. If the guard withholds the explanation, show that real evidence
   remains visible rather than describing the request as a successful prose answer.
5. **Power BI:** visit all six tabs. Executive overview shows all-history revenue
   **₹901.65M** and **64,935** received orders (the card rounds to 65K). Fulfillment has
   **410** scored open orders and **162** above the saved threshold. Customer economics
   supports right-clicking customer **3206 → Drill through → 06 Customer detail**, showing
   **24 orders / ₹491.56K**. Finish with the demand backtest and source fingerprints.

The first real AI request after the final service restart hit an Ollama CUDA initialization
failure. It subsequently recovered; a retry and all eight browser tests passed. Allow the
model time to initialize and use Meridian's retry path if that provider failure recurs.
Do not claim guaranteed latency, flawless cold starts or unrestricted natural-language SQL.

This demo demonstrates an integrated implementation on synthetic records. It does not
establish real-world savings, production adoption, forecast coverage or causal business impact.
