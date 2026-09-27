# Meridian — pre-GitHub handoff, 27 September 2026

The local report, screenshot gallery and documentation are complete for this handoff.
Native Windows restart/demo verification was performed against existing data and saved
models. No backend business logic, frontend application code, ML models, AI implementation
or generated business data was changed in this pass.

## Documentation and presentation

- Updated the root README, Power BI README, report guide, Power BI execution record,
  general execution record and interview guide to reflect the completed report/theme.
- Added the project structure, concise validation results, limitations, publication
  packaging notes, [demo walkthrough](demo-walkthrough.md) and [screenshot gallery](screenshots.md).
- Captured six distinct final Power BI pages after reopening the saved report. Clean
  copies live in `docs/assets/powerbi/`; raw originals in `reports/powerbi/final/`.
  [The manifest](assets/powerbi/manifest.json) records page context and SHA256 hashes.
- Added actual web overview, scenario and policy-answer images under `docs/assets/app/`.
  Documentation assets are outside the generated-report ignore rules.

## Restart and representative workflows

The existing app helper stopped the frontend/backend; the exact remaining backend child
was stopped where needed. The private PostgreSQL cluster and existing Ollama processes
were stopped. Ports **5173, 8000, 55432 and 11434 were all confirmed closed** before restart.
PostgreSQL, Ollama and the app were then restarted. Health reported the database connected,
models/index ready and the configured Ollama provider. Actual AI requests were tested
separately; the health endpoint alone does not establish provider readiness.

| Check | Final observed result | Local evidence |
|---|---|---|
| Lifecycle | Four ports stopped, services restarted; existing data reused | `reports/handoff/stopped-state.json`, `processes-before.json`, `processes-after.json` |
| Python suite | **35 passed**, 15 third-party warnings | `reports/handoff/pytest.txt` |
| Frontend | Production build succeeded; **3 unit tests passed** | `reports/handoff/frontend-build.txt`, `frontend-unit.txt` |
| Full browser regression | **8 passed** on final full run | `reports/handoff/browser-final.txt` |
| Export/source reconciliation | **569 checks**, 25 filter cases; **100 protected files unchanged** | `reports/handoff/source-reconciliation.txt`, `reports/powerbi/data-validation.json` |
| Saved Power BI | Closed/reopened in a new Desktop instance; **262 DAX checks**, 25 cases; 14 ready partitions, 49 measures without errors, 14 relationships | `reports/powerbi/desktop-validation.json`, `desktop-metadata.json`, query outputs |
| Theme and pages | Embedded theme mapping matched; palette persisted; all six populated pages inspected and captured; no warning banners | `reports/handoff/persisted-theme.json`, `reports/powerbi/pbix-validation.json`, screenshot manifest |
| Power BI interaction | Customer 3206 drillthrough repeated after reopen: 24 orders, ₹491.56K revenue, 20.8% delay, zero open orders | Final customer-detail screenshot |

Browser workflows exercised API-reconciled dashboard values, region/date filters, charts,
CSV download, analytics, RFM/statistics/lineage, forecasting, model scenario changes,
queue search/sort/pagination, order detail, anomaly filters, empty results, invalid dates,
provider/API error recovery, theme persistence, keyboard navigation and mobile navigation.

### Real AI results, including the failure

The first cold-start browser run had **7 passes and 1 failure**: the policy chat received a
provider error while Ollama logged CUDA initialization failure and its model process exited.
This was an actual failure, not a mocked failure or a passing cold-start result. The later
numerical request succeeded in obtaining evidence. The policy-only retry then passed, and
the complete browser suite passed **8/8**. No provider or application code was changed to
obtain that retry. Hardware/memory causation beyond the observed log is not asserted.

- The final policy answer used real `search_policies` retrieval and a valid `T1` citation;
  its guard status was `passed`.
- The final numerical request used real `get_business_metrics` for 1–31 December 2025.
  Revenue **₹34,406,088.16300005** matched the direct API (displayed as ₹34,406,088.16).
  The evidence guard **withheld the generated explanation**. This verifies tool access,
  reconciliation and safe display behavior, not a successful numerical prose answer.
- Initial and retry evidence: `reports/handoff/browser-regression.txt`,
  `initial-ai-failure-trace.zip`, `browser-ai-retry.txt`, `browser-final.txt`.
  Final response payloads: `reports/redesign/workflows/actual-ai-response.json` and
  `actual-numerical-ai-response.json`.

## Scope and remaining limitations

The final pass reused the previously trained/validated models, generated business records,
Spark outputs and EDA. It did not repeat bootstrap, training or Spark; their earlier actual
execution is recorded in [verification](verification.md). Docker execution, live OpenAI
requests and a second-machine installation remain unverified. No cloud or Power BI Service
deployment, embedded Power BI view or video demo is claimed. Synthetic outcomes are not
evidence of real-world model accuracy or business impact.

The saved PBIX is **7,075,412 bytes**, SHA256
`81fb29ff77dfc67bb42db705908a4ee80779bc094d3f4bb162b35ddba9170628`.
No Power BI theme, page, measure or relationship work remains on this machine. Moving the
source requires updating `ProjectRoot`, providing generated exports/artifacts and normal
Desktop source privacy classification. Privacy checks were not bypassed.

## Owner's next steps

1. Review the README/gallery and rehearse the demo, including the numerical evidence guard.
2. Decide how to share the optional populated PBIX: `powerbi/.gitignore` currently ignores
   `*.pbix`. Editable PBIP source is available; a fresh checkout must generate artifacts
   before refreshing it. Generated data, model artifacts and raw logs are also ignored.
3. Choose a repository license before publication; no project license has been selected.
   Review the files you intend to publish, keep `.env` and private runtimes excluded, and
   perform any Git/GitHub work yourself. No recorded demo video is included; it is optional.

**No Git commands, commits, pushes, repository publication, GitHub Actions or deployment
were performed during this handoff.** Local services remain available for the demo.
