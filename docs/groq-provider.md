# Optional Groq Free provider

Groq is a separate backend adapter in `ai/groq_provider.py`, selected by `ai/service.py`. The original `ai/analyst.py` implementation for evidence, Ollama and OpenAI is unchanged. The default provider remains evidence; installing this adapter does not switch an existing local configuration.

Use a Groq Free account without a payment method. Nothing in Meridian enables billing, a trial, an account upgrade or a paid provider fallback. The backend calls only `https://api.groq.com/openai/v1/chat/completions`, using Groq-hosted `openai/gpt-oss-20b`. That model name does not mean requests go to OpenAI. The existing optional OpenAI provider remains a separately selected capability and is never selected by Groq error handling.

## Local use

Keep `GROQ_API_KEY=...` in the ignored `.local/deployment/groq.env` file. Do not put credentials in frontend environment variables or use a `VITE_` prefix. Application settings can also read `GROQ_API_KEY` from the backend process environment or ignored root `.env`; the private `groq.env` file is not automatically loaded by the application.

For a separate local backend session, with PostgreSQL and the existing artifacts already available:

```powershell
$env:AI_PROVIDER = "groq"
.\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; load_dotenv('.local/deployment/groq.env'); import uvicorn; uvicorn.run('backend.app.main:app', host='127.0.0.1', port=8001)"
```

This uses port 8001 to avoid replacing an existing local backend. Its interactive API is at `http://127.0.0.1:8001/docs`. To use the existing frontend with Groq, stop its backend and run the same command with port 8000 instead. The frontend never receives the key. After stopping this optional session, clear the shell override with `Remove-Item Env:AI_PROVIDER`; the usual startup workflow again uses the existing `.env` provider. No data/model regeneration is needed.

`GROQ_MODEL` defaults to `openai/gpt-oss-20b`; reasoning effort is low and internal reasoning is not requested in responses. The tests cover this model, not arbitrary model substitutions. Treat quota headers/account limits as authoritative; free-tier availability can change.

## Tools, evidence and fallback

- Uses the unmodified Pydantic allowlist in `ai/tools.py` and its existing read-only SQL, saved predictions and policy retrieval. No arbitrary SQL or new tools were added.
- Uses the original numerical guard and the same requirement for at least one valid `[Tn]` citation, no unknown cited tool IDs, and real evidence. Policy instructions explicitly require both tool and document citations. One correction attempt is allowed; failed checks withhold the explanation while retaining evidence.
- Network failures, HTTP 429, other provider errors, missing credentials, malformed/truncated responses, invalid tool arguments, missing evidence or exhausted budgets expose the existing evidence-only mode. HTTP 429 triggers **zero retries**, regardless of `Retry-After`, avoiding retry storms. No raw provider error text, key or authorization header is returned.
- Limits: four tool rounds, at most eight tool executions, a final answer request and one correction; at most six HTTP requests. Each request uses a maximum 20-second HTTPX timeout; a 150-second elapsed budget is checked before requests/tool executions. This is not a hard process-kill deadline: HTTPX timeouts apply to network phases and an in-flight database operation has its own existing timeout.
- Fallback responses use `mode=evidence`, actual evidence cards, an explicit data-only answer, and `provider_status` with a fixed reason code. Existing evidence mode has limited keyword routing; inspect tool names/date ranges rather than assuming it answers arbitrary questions. If PostgreSQL or required artifacts are unavailable too, the existing API error handling applies; fallback cannot manufacture missing data.
- Scenario Lab still calculates hypothetical predictions through `/api/predictions/scenario`. The analyst can retrieve saved risks and scenario interpretation policies, but cannot execute a hypothetical scenario through its tool registry. It must not substitute a saved order score for a hypothetical result.
- No provider automatically changes business data, models or shipments. Data remains synthetic. External Groq use sends conversation text and selected synthetic evidence to Groq.

## Validation and limits

Run the full suite, which includes the original 35 tests and the new adapter tests:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pytest tests/test_ai.py tests/test_groq.py -q
```

Automated tests use simulated Groq HTTP responses with real SQL/artifact/policy tools for representative integration cases; they require no inference key or quota. They cover revenue, saved risk, policy retrieval, Scenario Lab interpretation and its existing inference endpoint, invalid tool arguments, fabricated numbers, missing/unknown citations, correction and withholding, network/timeouts, simulated 429, provider errors, request/tool budgets, missing keys and preservation of legacy dispatch.

Live testing is separate and opt-in. Results and limitations are recorded in the local ignored `reports/free-cloud/` directory. The compatibility test demonstrated successful metrics/risk/policy answers but also missing citations. Integration testing observed safe truncation fallback, withheld prose and a real rate limit. These are expected safe outcomes, not guaranteed natural-language availability. Numeric matching/citation presence cannot establish causal or qualitative correctness, and do not constitute comprehensive prompt-injection protection.

No Vercel deployment, public API or Neon connection is implied by these tests. No background worker, model download or training is performed on startup.

Provider references: [local tool calling](https://console.groq.com/docs/tool-use/local-tool-calling), [rate limits](https://console.groq.com/docs/rate-limits).
