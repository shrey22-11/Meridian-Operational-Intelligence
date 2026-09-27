# Anomaly investigation procedure

Isolation Forest identifies unusual daily regional combinations of order volume, revenue, units, delivery delay rate, and warehouse load. Its reference distribution uses historical days through June 2025. Later dates are monitoring observations. A positive anomaly score means the observation crosses the detector threshold.

Unusual observations are not necessarily errors or fraud. Promotions, holidays, large legitimate business orders, and changes in channel mix may explain anomalies. First check the data-quality report, then order composition and regional trends. Main deviation is the largest standardized feature departure from reference history; it is a descriptive clue rather than a causal explanation.

Record an investigation outcome and feed confirmed incidents into a future labeled evaluation set. The current synthetic dataset does not contain trustworthy anomaly labels. Do not describe unsupervised alerts as precision-validated incidents.
