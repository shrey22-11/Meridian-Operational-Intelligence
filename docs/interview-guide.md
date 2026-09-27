# Explain the implementation, not a technology list

| Question | Concrete evidence in this project |
|---|---|
| Why this domain? | Fulfillment connects commercial metrics, operational constraints, supervised outcomes and management action in the same relational data. |
| Why Pandas? | CSV validation, quarantine, modest in-memory feature matrices and reproducible reports. SQL handles joins/aggregates; Spark demonstrates a larger scan/shuffle workflow. |
| Why PostgreSQL? | Transactional reload, PK/FK/check constraints, filtered aggregates, date arithmetic and analytical windows. SQLite is not used as a hidden substitute. |
| Why the CTE/window query? | Monthly revenue is first aggregated then compared using LAG; volume and basket effects reconcile the actual regional revenue change. |
| Why indexes? | Date filters, customer histories, and fact-to-item/product joins use ordered_at/customer_id/order_id/product_id access paths. Tiny dimension tables do not need decorative indexes. Inspect plans before adding more. |
| Why logistic regression? | It beat gradient boosting on validation average precision in the observed run. Simpler is a benefit only after measuring the business task. |
| Where is leakage prevented? | Explicit placement-time feature list, chronological split, label-availability boundaries, train-only preprocessing, shifted forecast lags, validation-only threshold/selection. |
| What statistical claim is justified? | Descriptive delay rates and a daily-block-bootstrap association. No claim that reducing workload causally lowers risk by the simulator's predicted amount. |
| Why Spark? | `spark_jobs/aggregate.py` expands to 1.6M lines, joins dimensions, shuffles by region/day and computes temporal range windows. The bounded aggregate is reconciled with PostgreSQL. For this dataset Pandas/SQL would be simpler; Spark is a scaling demonstration. |
| How does the AI work? | Ollama or Responses API chooses allowlisted tools; validated args enter read-only, parameterized queries; outputs return with T IDs; policies are chunked and retrieved via persisted LSA vectors. |
| Does it eliminate hallucination? | No. Exact tool evidence, citations and numerical matching reduce invented metrics; qualitative conclusions still require scrutiny. Unsupported numerical prose is withheld. |
| Why this RAG design? | Policies define revenue, operational response and model limitations. A tiny local LSA index is reproducible and offline; it has weaker semantic generalization than a neural embedding system. |
| How would you handle 10x traffic? | Cache repeated read-only aggregates, precompute larger materialized views, paginate per-customer requests, load artifacts once, pool DB connections, cap inference/tool budgets, profile before separating services. |
| What would you deploy later? | React static assets, one FastAPI service, managed PostgreSQL, object storage for versioned artifacts and a scheduled offline pipeline. No Kubernetes or Kafka needed. |

Suggested demonstration: filter the dashboard → reconcile December revenue in SQL → show cleaning quarantine → explain the time split and metrics → run a warehouse-load scenario → show Spark reconciliation → ask AI for December revenue and open the tool result → ask for policy guidance and open the cited chunk. Explain limitations before claiming business impact.

Resume wording should say **synthetic retail data**, **local Ollama tool calling**, **LSA vector retrieval**, and **a six-page Power BI report with 49 measures, 14 relationships and 262 DAX reconciliation checks**. The populated PBIX was saved and reopened with its Meridian theme intact; all six final pages are captured in the [screenshot gallery](screenshots.md). Report measured evaluation numbers from model_report; do not invent revenue savings or adoption metrics. The [final demo](demo-walkthrough.md) includes the AI guard behavior and [handoff record](handoff.md) documents the observed cold-start retry.
