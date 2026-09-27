from datetime import date,timedelta
import json
import pandas as pd
from backend.app.config import ROOT
from backend.app.db import records,frame
from ml.service import artifact_records


def bounds():
    return records("SELECT MIN(ordered_at) AS start_date, MAX(ordered_at) AS end_date FROM orders")[0]


def period(start_date=None,end_date=None,region=None):
    latest=frame("SELECT MAX(ordered_at) AS day FROM orders").iloc[0,0]
    if latest is None:
        raise ValueError("No data. Run the data pipeline first.")
    end=date.fromisoformat(str(end_date or latest)[:10])
    start=date.fromisoformat(str(start_date)[:10]) if start_date else end-timedelta(days=29)
    if start>end:
        raise ValueError("Start date must be on or before end date.")
    if (end-start).days>1096:
        raise ValueError("Choose a period of at most three years.")
    if region and region not in ["North","South","East","West"]:
        raise ValueError("Unknown region.")
    return {"start_date":start,"end_date":end,"region":region}


WHERE="ordered_at BETWEEN :start_date AND :end_date AND (CAST(:region AS text) IS NULL OR region=:region)"


def metrics(start_date=None,end_date=None,region=None):
    p=period(start_date,end_date,region)
    sql=f"""SELECT COUNT(*) AS orders,COALESCE(SUM(revenue) FILTER (WHERE status<>'cancelled'),0) AS revenue,
       COALESCE(SUM(gross_margin) FILTER (WHERE status<>'cancelled'),0) AS gross_margin,
       AVG(revenue) FILTER (WHERE status<>'cancelled') AS average_order_value,
       AVG(late) AS late_rate,COUNT(*) FILTER (WHERE status='open') AS open_orders,
       COUNT(*) FILTER (WHERE status='delivered') AS delivered_orders,
       COUNT(DISTINCT customer_id) AS active_customers FROM order_facts WHERE {WHERE}"""
    current=records(sql,p)[0]
    span=(p["end_date"]-p["start_date"]).days+1
    previous={**p,"start_date":p["start_date"]-timedelta(days=span),"end_date":p["start_date"]-timedelta(days=1)}
    prev=records(sql,previous)[0]
    return {"current":current,"previous":prev,"period":{k:str(v) if v is not None else None for k,v in p.items()},
        "revenue_change_pct":(current["revenue"]/prev["revenue"]-1)*100 if prev["revenue"] else None,
        "currency":"INR","current_revenue_formatted":f"INR {current['revenue']:,.2f}",
        "source":"PostgreSQL · synthetic dataset",
        "definitions":"Revenue is net booked merchandise value excluding cancelled orders; not cash received. Delay rate includes delivered orders only."}


def analytics(start_date=None,end_date=None,region=None):
    p=period(start_date,end_date,region)
    trend=records(f"""SELECT ordered_at AS day,COUNT(*) AS orders,
        SUM(revenue) FILTER (WHERE status<>'cancelled') AS revenue,
        AVG(late) AS late_rate,SUM(units) FILTER (WHERE status<>'cancelled') AS units
        FROM order_facts WHERE {WHERE} GROUP BY ordered_at ORDER BY ordered_at""",p)
    regions=records(f"""SELECT region,COUNT(*) AS orders,
        SUM(revenue) FILTER (WHERE status<>'cancelled') AS revenue,AVG(late) AS late_rate,
        AVG(warehouse_load) AS warehouse_load FROM order_facts WHERE {WHERE} GROUP BY region ORDER BY revenue DESC""",p)
    categories=records("""SELECT p.category,SUM(i.quantity*i.unit_price*(1-i.discount)) AS revenue,
        SUM(i.quantity) AS units FROM order_items i JOIN orders o USING(order_id)
        JOIN products p USING(product_id) JOIN customers c USING(customer_id)
        WHERE o.ordered_at BETWEEN :start_date AND :end_date AND o.status<>'cancelled'
        AND (CAST(:region AS text) IS NULL OR c.region=:region) GROUP BY p.category ORDER BY revenue DESC""",p)
    return {"trend":trend,"regions":regions,"categories":categories}


def revenue_bridge():
    # Last complete calendar month relative to the data snapshot, not today's clock.
    data=records((ROOT/"database/queries/monthly_bridge.sql").read_text())
    latest=frame("SELECT MAX(ordered_at) AS day FROM orders").iloc[0,0]
    stamp=pd.Timestamp(latest)
    complete=stamp.to_period("M") if stamp.is_month_end else stamp.to_period("M")-1
    key=str(complete)
    rows=[x for x in data if str(x["month"]).startswith(key)]
    return {"month":key,"regions":rows,"method":"Exact arithmetic decomposition: volume effect + basket effect = revenue change. Associations do not establish causes."}


def product_watchlist(start_date=None,end_date=None):
    return records((ROOT/"database/queries/product_watchlist.sql").read_text(),period(start_date,end_date))


def json_records(df):
    return json.loads(df.to_json(orient="records",date_format="iso"))


def anomalies(limit=25,region=None):
    df=artifact_records("anomalies")
    df=df.loc[df.is_anomaly & df.period.eq("monitoring")]
    if region:
        df=df.loc[df.region.eq(region)]
    return json_records(df.sort_values("anomaly_score",ascending=False).head(limit))


def risks(limit=25,region=None):
    df=artifact_records("scored_orders")
    df=df.loc[df.status.eq("open")]
    if region:
        df=df.loc[df.region.eq(region)]
    cols=["order_id","customer_id","ordered_at","region","revenue","units","warehouse_load","risk_probability","risk_level"]
    return json_records(df.sort_values("risk_probability",ascending=False)[cols].head(limit))


def segments():
    df=artifact_records("segments")
    grouped=df.groupby("segment").agg(customers=("customer_id","count"),revenue=("monetary","sum"),
        mean_recency=("recency","mean"),mean_frequency=("frequency","mean"),late_rate=("late_rate","mean")).reset_index()
    return json_records(grouped)


def customer_detail(customer_id):
    result=records("""SELECT customer_id,region,channel,COUNT(*) AS orders,
        SUM(revenue) FILTER (WHERE status<>'cancelled') AS revenue,AVG(late) AS late_rate
        FROM order_facts WHERE customer_id=:id GROUP BY 1,2,3""",{"id":customer_id})
    if not result:
        return {"found":False}
    rfm=artifact_records("segments")
    match=rfm.loc[rfm.customer_id.eq(customer_id)]
    return {**result[0],"segment":None if match.empty else match.iloc[0].segment}
