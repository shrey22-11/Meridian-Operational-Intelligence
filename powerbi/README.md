# Meridian Power BI

An editable six-page Power BI report using Meridian's existing synthetic retail data.
The report is local: no Power BI account, publishing, gateway, or PostgreSQL credentials are required.

Open the populated local `Meridian.pbix` in Power BI Desktop, or use `Meridian.pbip` for editable source. The final PBIX was reopened on 27 September 2026 with all 14 tables populated and the Meridian theme intact. Its 262 DAX checks passed again. The project contains the report, semantic model,
49 explicit DAX measures, 14 single-direction relationships, and the Meridian theme.
The model uses Import mode over the existing CSV/JSON artifacts, with typed Power Query
transformations. `ProjectRoot` is the only machine-specific parameter.

## Files

| File | Purpose |
|---|---|
| `Meridian.pbix` | Populated report, reopened with the persisted theme and validated data; local binary ignored by default |
| `Meridian.pbip` | Editable project entry point |
| `Meridian.Report/` | PBIR page, visual, theme and drillthrough definitions |
| `Meridian.SemanticModel/model.bim` | Tables, typed Power Query, DAX and relationships |
| `measures.dax` | Reviewable copy of implemented measures |
| `build_report.py` | Reproduce the authored project; overwrites authored source definitions |
| `verify_data.py` | Read-only CSV ↔ PostgreSQL ↔ API reconciliation and preservation checks |
| `validate_report.py` | Official Microsoft JSON-schema and field-reference validation |
| `query_model.ps1` | Read-only DAX execution against an already-open local Desktop model |
| `validation*.dax` | Executable checks for commercial totals and ML/snapshot measures |

Do not run `build_report.py` while the project is open, or after making Desktop layout
changes you want to retain. The generator is for reproducibility, not routine refresh.

## Open and refresh

1. Open `Meridian.pbip` using a recent Power BI Desktop (the workspace has August 2026).
2. If the folder moved, choose **Transform data → Edit parameters → ProjectRoot** and
   select the project root, e.g. `C:/Shrey_Pandey/Vibecode/AI_Operational_Intelligence`.
3. Choose **Home → Refresh**. If asked for source privacy, classify the local files as
   **Private**; leave **Ignore Privacy Levels** unchecked. This is a user-controlled setting.
4. Inspect the six report tabs. All cards and charts query the imported semantic model.
5. Save As **Power BI file (*.pbix)** to keep a portable, populated local report.

For later business-data refreshes, run the existing Meridian exporter after the existing
pipeline/artifact process, then refresh Power BI. Power BI neither generates records nor
trains models. A `.pbix` includes the imported synthetic records; `.pbip` source alone
requires the existing local CSV/JSON files for refresh.

For a fresh checkout, follow the root README's bootstrap first. Generated data and the
PBIX binary are ignored by default; PBIP source does not embed imported records.
No theme repair or manual visual/measure assembly remains for the verified local PBIX.
The [final screenshot gallery](../docs/screenshots.md) shows all six distinct pages.

## Verification commands (from project root)

```powershell
.\.venv\Scripts\python.exe -m pip install -r powerbi/requirements.txt
.\.venv\Scripts\python.exe powerbi/validate_report.py
.\.venv\Scripts\python.exe powerbi/verify_data.py
```

The schema validator downloads Microsoft's public schemas on its first run. API/PostgreSQL
must be running for data reconciliation. No SQL writes or application/model changes occur.
`reports/powerbi/` holds execution evidence, including expected values and filtering cases.

See [the report guide](../docs/power-bi.md) for grain, filter behavior and metric definitions,
and [verification](../docs/power-bi-verification.md) for the actual Desktop completion status.
