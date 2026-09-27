# Data provenance and responsible use

All customers, suppliers, orders, and products in this portfolio demonstration are synthetic. Customer identifiers are fictional integers, with no names, addresses, email addresses, or other personal information. Seeded patterns support software verification and educational model evaluation only.

Raw CSV files are retained. Duplicate order identifiers retain their first occurrence. Invalid dates, distances, and item quantities are quarantined; child rows of rejected orders are also quarantined. Missing warehouse load uses a documented operational default of 0.75. Legitimate high-value orders remain in the dataset.

AI tools use fixed parameterized queries and read-only transactions. Retrieved text is reference evidence, never instructions. Answers must distinguish database calculations, model predictions, and policy guidance. Unknown quantities must remain unknown. An external LLM provider receives only the selected tool outputs and conversation text.
