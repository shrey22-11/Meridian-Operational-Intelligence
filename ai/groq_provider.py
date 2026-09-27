"""Groq-only transport with bounded tool use and a local evidence fallback.

No SDK/provider auto-routing, paid fallback, network retries or startup work.
The original analyst/providers and tool registry remain unchanged.
"""
import json
import re
import time

import httpx

from ai.analyst import SYSTEM, evidence_mode, numeric_guard
from ai.tools import execute, schemas
from backend.app.config import settings

ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
MAX_REQUESTS = 6  # four tool rounds, final answer, one correction
MAX_TOOLS = 8
REQUEST_TIMEOUT = 20.0
TURN_BUDGET = 150.0
INSTRUCTIONS = SYSTEM + """
Every final answer must cite tool evidence using square brackets, e.g. [T1].
Policy document chunk IDs are additional citations, never replacements for [T1].
Scenario Lab runs hypothetical predictions separately. These tools can retrieve saved
risks and scenario interpretation policies; they cannot calculate a new scenario.
Do not present saved order scores as results for hypothetical inputs.
"""


class ProviderUnavailable(Exception):
    """Only a fixed public reason code may cross the provider boundary."""


def _make_client():
    return httpx.Client(timeout=REQUEST_TIMEOUT, trust_env=False, follow_redirects=False)


def _check(answer, evidence):
    unsupported = numeric_guard(answer, evidence)
    cited = set(re.findall(r"\[(T\d+)\]", answer))
    unknown = cited - {entry["id"] for entry in evidence}
    return unsupported, unknown, bool(evidence and answer and not unsupported and cited and not unknown)


def _fallback(question, reason):
    result = evidence_mode(question)
    result["answer"] = (
        "Groq analysis is unavailable; showing data-only evidence from Meridian's synthetic dataset. "
        "No generated explanation is being shown. Review the tool names and date ranges below; "
        "evidence mode uses limited question routing."
    )
    result["provider_status"] = {"requested": "groq", "fallback": "evidence", "reason": reason}
    return result


def chat(question, history=None):
    if not settings.groq_api_key.get_secret_value():
        return _fallback(question, "missing_key")
    try:
        with _make_client() as client:
            return _run(question, history, client)
    except ProviderUnavailable as exc:
        return _fallback(question, str(exc))
    except httpx.HTTPError:
        # Never include provider response bodies, request headers or exception text.
        return _fallback(question, "network_error")


def _run(question, history, client):
    messages = [{"role": "system", "content": INSTRUCTIONS}, *(history or [])[-8:],
                {"role": "user", "content": question}]
    evidence = []
    started = time.monotonic()
    requests = 0

    def request(choice):
        nonlocal requests
        remaining = TURN_BUDGET - (time.monotonic() - started)
        if remaining <= 0 or requests >= MAX_REQUESTS:
            raise ProviderUnavailable("request_budget")
        requests += 1
        response = client.post(
            ENDPOINT,
            headers={"Authorization": "Bearer " + settings.groq_api_key.get_secret_value()},
            json={"model": settings.groq_model, "messages": messages, "tools": schemas(),
                  "tool_choice": choice, "parallel_tool_calls": False,
                  "temperature": 0, "max_completion_tokens": 1200,
                  "reasoning_effort": "low", "include_reasoning": False},
            timeout=min(REQUEST_TIMEOUT, remaining),
        )
        if response.status_code == 429:
            # No retry loop or sleep: expose evidence immediately, regardless of Retry-After.
            raise ProviderUnavailable("rate_limited")
        if response.status_code != 200:
            raise ProviderUnavailable("provider_error")
        try:
            item = response.json()["choices"][0]
            message = item["message"]
            if item.get("finish_reason") == "length":
                raise ProviderUnavailable("truncated_response")
            if message.get("role") != "assistant":
                raise ValueError()
            if message.get("content") is not None and not isinstance(message["content"], str):
                raise ValueError()
            calls = message.get("tool_calls") or []
            if not isinstance(calls, list) or (choice == "none" and calls):
                raise ValueError()
            return {k: v for k, v in message.items() if k in ("role", "content", "tool_calls")}
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            raise ProviderUnavailable("invalid_response") from None

    answer = ""
    for round_number in range(5):
        message = request("required" if round_number == 0 else "none" if round_number == 4 else "auto")
        messages.append(message)
        calls = message.get("tool_calls") or []
        answer = message.get("content") or ""
        if not calls:
            if not evidence and round_number == 0:
                messages.append({"role": "system", "content": "Call an allowed tool before answering; you have no evidence."})
                continue
            break
        if len(evidence) + len(calls) > MAX_TOOLS:
            raise ProviderUnavailable("tool_budget")
        for call in calls:
            if time.monotonic() - started >= TURN_BUDGET:
                raise ProviderUnavailable("request_budget")
            try:
                if call.get("type") != "function" or not isinstance(call["id"], str) or not call["id"]:
                    raise ValueError()
                name = call["function"]["name"]
                args = json.loads(call["function"]["arguments"])
                if not isinstance(name, str) or not isinstance(args, dict):
                    raise ValueError()
                result = execute(name, args)
            except (ValueError, TypeError, KeyError, AttributeError):
                # Invalid arguments are not evidence; never validate claims against error text.
                raise ProviderUnavailable("invalid_tool_call") from None
            entry = {"id": f"T{len(evidence)+1}", "tool": name, "arguments": args, "result": result}
            evidence.append(entry)
            messages.append({"role": "tool", "tool_call_id": call["id"],
                             "content": json.dumps(entry, default=str)})

    if not evidence:
        raise ProviderUnavailable("missing_evidence")
    unsupported, unknown, verified = _check(answer, evidence)
    repaired = False
    if evidence and not verified:
        messages.append({"role": "system", "content":
            "Your answer failed validation. Correct it using only the attached tool results. "
            "Copy formatted revenue exactly. Include the actual date range. "
            f"Unsupported numbers: {unsupported}. Invalid citations: {sorted(unknown)}. "
            f"Available citations: {[e['id'] for e in evidence]}. "
            "Do not invent excerpt-level T IDs. Cite tool IDs in square brackets as well as policy chunk IDs. "
            "Evidence: " + json.dumps(evidence, default=str)})
        answer = request("none").get("content") or ""
        unsupported, unknown, verified = _check(answer, evidence)
        repaired = True
    if not verified:
        answer = ("The generated explanation did not pass the evidence checks. Review the actual tool results below; "
                  "no unverified numerical answer is being shown. Try a more specific question.")
    return {"mode": "groq", "model": settings.groq_model, "answer": answer, "evidence": evidence,
            "guard": {"status": "passed" if verified else "withheld",
                      "unsupported_numbers": unsupported, "invalid_citations": sorted(unknown),
                      "correction_attempted": repaired,
                      "limitation": "Numeric matching and citation presence do not prove causal or qualitative claims."}}
