"""Deterministic Groq transport tests: no key or external inference required."""
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from ai import groq_provider as groq, service
from ai.tools import execute
from backend.app.config import settings
from backend.app.main import app
from tests.test_models import SCENARIO


def completion(answer=None, calls=None):
    return httpx.Response(200, json={"choices": [{"finish_reason": "tool_calls" if calls else "stop",
        "message": {"role": "assistant", "content": answer, **({"tool_calls": calls} if calls else {})}}]})


def call(name="get_business_metrics", args=None, identifier="call_test"):
    return {"id": identifier, "type": "function", "function": {"name": name,
        "arguments": json.dumps(args if args is not None else {"start_date": None, "end_date": None, "region": None})}}


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", SecretStr("test-placeholder-not-a-real-key"))
    requests = []

    def install(responses):
        def handle(request):
            assert str(request.url) == groq.ENDPOINT
            requests.append(json.loads(request.content))
            item = responses.pop(0)
            if isinstance(item, Exception):
                raise item
            return item(requests[-1]) if callable(item) else item
        monkeypatch.setattr(groq, "_make_client", lambda: httpx.Client(transport=httpx.MockTransport(handle)))
        return requests
    return install


@pytest.mark.integration
@pytest.mark.parametrize("name,args,question", [
    ("get_business_metrics", {"start_date": "2025-12-01", "end_date": "2025-12-31", "region": None}, "December revenue"),
    ("get_open_order_risks", {"limit": 2, "region": None}, "Saved delivery risk"),
    ("search_policies", {"query": "late delivery fulfillment escalation policy"}, "Delivery policy"),
    ("search_policies", {"query": "Scenario results hypothetical causal intervention fitted model"}, "Explain Scenario Lab evidence"),
])
def test_real_tools_through_api(setup, name, args, question):
    expected = execute(name, args)
    assert expected

    def answer(payload):
        evidence = json.loads(payload["messages"][-1]["content"])
        assert evidence["result"] == expected
        if name == "get_business_metrics":
            text = expected["current_revenue_formatted"] + " [T1]"
        elif name == "get_open_order_risks":
            text = f"Saved prediction: {expected[0]['risk_probability']} [T1]"
        else:
            text = expected[0]["text"] + " [T1] " + expected[0]["id"]
        return completion(text)

    requests = setup([completion(calls=[call(name, args)]), answer])
    with TestClient(app) as client:
        response = client.post("/api/ai/chat", json={"message": question})
        assert response.status_code == 200
        result = response.json()
        assert result["mode"] == "groq" and result["guard"]["status"] == "passed"
        assert result["evidence"][0]["result"] == expected
        assert client.get("/api/health").json()["ai_model"] == settings.groq_model
        if "Scenario" in question:
            scenario = client.post("/api/predictions/scenario", json=SCENARIO)
            assert scenario.status_code == 200 and 0 <= scenario.json()["probability"] <= 1
            assert result["evidence"][0]["tool"] == "search_policies"
    assert len(requests) == 2
    assert requests[0]["tool_choice"] == "required"
    assert requests[0]["parallel_tool_calls"] is False


@pytest.fixture
def data_stub(monkeypatch):
    monkeypatch.setattr(groq, "execute", lambda name, args: {"revenue": 12345.12})
    monkeypatch.setattr(groq, "evidence_mode", lambda question: {
        "mode": "evidence", "answer": "Data only", "evidence": [{"id": "T1", "result": {"revenue": 12345.12}}],
        "guard": {"status": "not_applicable"}})


@pytest.mark.parametrize("text", ["Revenue 999999 [T1]", "Revenue 12345.12", "Revenue 12345.12 [T999]"])
def test_invalid_explanations_are_withheld(setup, data_stub, text):
    requests = setup([completion(calls=[call()]), completion(text), completion(text)])
    result = service.chat("Revenue please")
    assert result["guard"]["status"] == "withheld"
    assert result["guard"]["correction_attempted"] is True
    assert text != result["answer"] and result["evidence"]
    assert len(requests) == 3 and requests[-1]["tool_choice"] == "none"


def test_single_correction_can_pass(setup, data_stub):
    requests = setup([completion(calls=[call()]), completion("Revenue 999999 [T1]"), completion("Revenue 12345.12 [T1]")])
    result = service.chat("Revenue please")
    assert result["guard"]["status"] == "passed" and result["guard"]["correction_attempted"]
    assert len(requests) == 3


@pytest.mark.parametrize("failure,reason", [
    (httpx.ConnectError("secret upstream configuration"), "network_error"),
    (httpx.ReadTimeout("secret upstream configuration"), "network_error"),
    (httpx.Response(429, headers={"Retry-After": "999999"}, text="private provider body"), "rate_limited"),
    (httpx.Response(401, text="private provider body"), "provider_error"),
    (httpx.Response(503, text="private provider body"), "provider_error"),
    (httpx.Response(200, json={"choices": []}), "invalid_response"),
])
def test_failure_is_bounded_sanitized_evidence_fallback(setup, data_stub, monkeypatch, failure, reason):
    def forbidden(*args, **kwargs):
        pytest.fail("Legacy/paid provider fallback is forbidden")
    monkeypatch.setattr(service.analyst, "chat", forbidden)
    requests = setup([failure])
    with TestClient(app) as client:
        response = client.post("/api/ai/chat", json={"message": "Revenue please"})
    assert response.status_code == 200
    result = response.json()
    assert result["mode"] == "evidence" and result["evidence"]
    assert result["provider_status"]["reason"] == reason
    assert "secret" not in response.text and "private provider" not in response.text
    assert "test-placeholder-not-a-real-key" not in response.text
    assert len(requests) == 1


@pytest.mark.integration
@pytest.mark.parametrize("name,args", [
    ("execute_sql", {"sql": "SELECT 1"}),
    ("get_anomalies", {"limit": 10000}),
    ("get_forecast", {"sql": "SELECT secret"}),
    ("get_business_metrics", {"end_date": "2025-12-31"}),
])
def test_invalid_tool_arguments_use_real_validation(setup, name, args):
    requests = setup([completion(calls=[call(name, args)])])
    result = service.chat("Explain delivery risk")
    assert result["mode"] == "evidence" and result["provider_status"]["reason"] == "invalid_tool_call"
    assert result["evidence"] and len(requests) == 1


def test_missing_key_makes_no_provider_request(setup, data_stub, monkeypatch):
    requests = setup([])
    monkeypatch.setattr(settings, "groq_api_key", SecretStr(""))
    assert service.chat("Revenue please")["provider_status"]["reason"] == "missing_key"
    assert not requests


def test_no_tool_evidence_falls_back(setup, data_stub):
    requests = setup([completion("Trust me [T1]"), completion("Trust me [T1]")])
    result = service.chat("Revenue please")
    assert result["mode"] == "evidence" and result["provider_status"]["reason"] == "missing_evidence"
    assert len(requests) == 2


def test_rate_limit_after_tool_keeps_evidence_available(setup, data_stub):
    requests = setup([completion(calls=[call()]), httpx.Response(429)])
    result = service.chat("Revenue please")
    assert result["mode"] == "evidence" and result["evidence"]
    assert result["provider_status"]["reason"] == "rate_limited" and len(requests) == 2


def test_request_and_tool_budgets(setup, data_stub):
    requests = setup([completion(calls=[call(identifier=str(i))]) for i in range(4)] +
                     [completion("No citation"), completion("No citation")])
    assert service.chat("Revenue please")["guard"]["status"] == "withheld"
    assert len(requests) == groq.MAX_REQUESTS
    requests = setup([completion(calls=[call(identifier=str(i)) for i in range(9)])])
    assert service.chat("Revenue please")["provider_status"]["reason"] == "tool_budget"
    assert len(requests) == 7  # same fixture records both independent runs


def test_turn_budget_stops_before_request(setup, data_stub, monkeypatch):
    requests = setup([])
    monkeypatch.setattr(groq, "TURN_BUDGET", 0)
    assert service.chat("Revenue please")["provider_status"]["reason"] == "request_budget"
    assert not requests


@pytest.mark.parametrize("provider", ["evidence", "ollama", "openai"])
def test_legacy_providers_dispatch_unchanged(monkeypatch, provider):
    monkeypatch.setattr(settings, "ai_provider", provider)
    history = [{"role": "user", "content": "previous question"}]
    def legacy(question, supplied_history):
        assert question == "original question" and supplied_history is history
        return {"original": provider}
    monkeypatch.setattr(service.analyst, "chat", legacy)
    assert service.chat("original question", history) == {"original": provider}
