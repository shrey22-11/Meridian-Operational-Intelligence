import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from analytics import service
from analytics.report import wilson
from backend.app.db import read_connection,records


def test_wilson_small_samples():
    lo,hi=wilson(0,10)
    assert abs(lo)<1e-12 and .2<hi<.4
    assert wilson(0,0)==[None,None]


@pytest.mark.integration
def test_revenue_bridge_reconciles():
    bridge=service.revenue_bridge()
    assert bridge["month"]=="2025-12"
    for row in bridge["regions"]:
        assert row["revenue_change"]==pytest.approx(row["volume_effect"]+row["basket_effect"],abs=.01)


@pytest.mark.integration
def test_metrics_match_independent_line_item_query():
    value=service.metrics("2025-12-01","2025-12-31","North")["current"]["revenue"]
    reference=records("""SELECT SUM(i.quantity*i.unit_price*(1-i.discount)) AS revenue
        FROM order_items i JOIN orders o USING(order_id) JOIN customers c USING(customer_id)
        WHERE ordered_at BETWEEN '2025-12-01' AND '2025-12-31' AND region='North' AND status<>'cancelled'""")[0]["revenue"]
    assert value==pytest.approx(reference,abs=.01)


@pytest.mark.integration
def test_empty_range_and_invalid_dates():
    assert service.metrics("2030-01-01","2030-01-30")["current"]["orders"]==0
    with pytest.raises(ValueError):service.metrics("2025-12-31","2025-01-01")


@pytest.mark.integration
def test_readonly_connection_blocks_writes():
    with pytest.raises(DBAPIError):
        with read_connection() as conn:conn.execute(text("CREATE TEMP TABLE forbidden_write(id int)"))
