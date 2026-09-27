import pytest
from ai.tools import execute,schemas
from ai.retrieval import retrieve
from ai.analyst import numeric_guard,chat
from backend.app.config import settings


def test_tools_reject_unknown_and_unbounded_input():
    with pytest.raises(ValueError):execute("execute_sql",{"sql":"DROP TABLE orders"})
    with pytest.raises(ValueError):execute("get_anomalies",{"limit":10000})
    with pytest.raises(ValueError):execute("get_business_metrics",{"region":"North'; DELETE FROM orders; --"})
    with pytest.raises(ValueError):execute("get_forecast",{"sql":"SELECT secret"})


def test_numerical_guard_blocks_fabricated_metrics():
    evidence=[{"result":{"revenue":12345.12,"risk":.25}}]
    assert numeric_guard("Revenue is 12,345.12 and risk 25% [T1]",evidence)==[]
    assert numeric_guard("Revenue is 99,000 [T1]",evidence)==["99,000"]


def test_schemas_are_strict():
    for tool in schemas():
        p=tool["function"]["parameters"]
        assert p["additionalProperties"] is False
        assert set(p["required"])==set(p["properties"])


def test_partial_month_arguments_cannot_silently_default():
    with pytest.raises(ValueError):
        execute("get_business_metrics",{"end_date":"2025-12-31"})


@pytest.mark.integration
def test_retrieval_returns_real_cited_policy_and_abstains():
    result=retrieve("Booked revenue excludes cancelled orders and differs from cash receipts")
    assert result and any(r["source"]=="metric_definitions.md" for r in result)
    assert all(r["id"] and r["score"]>.12 for r in result)
    assert retrieve("zxqwvnnnqqzzz")==[]


@pytest.mark.integration
def test_evidence_mode_honest_and_database_backed(monkeypatch):
    monkeypatch.setattr(settings,"ai_provider","evidence")
    result=chat("Show revenue changes last month")
    assert result["mode"]=="evidence"
    assert "No language model" in result["answer"]
    assert result["evidence"][0]["result"]["regions"]
