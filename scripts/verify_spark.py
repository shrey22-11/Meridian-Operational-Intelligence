import json
import numpy as np
import pandas as pd
from backend.app.config import ROOT
from backend.app.db import frame


def verify():
    spark=pd.read_csv(ROOT/"data/exports/spark_daily_operations.csv")
    sql=frame("""SELECT ordered_at AS day,region,COUNT(*) AS orders,SUM(revenue) AS revenue,SUM(units) AS units
        FROM order_facts WHERE status<>'cancelled' GROUP BY ordered_at,region""")
    spark["day"]=pd.to_datetime(spark.day);sql["day"]=pd.to_datetime(sql.day)
    merged=sql.merge(spark,on=["day","region"],suffixes=("_sql","_spark"),validate="one_to_one",how="outer")
    for column in ["revenue","units","orders"]:
        if not np.allclose(merged[f"{column}_sql"],merged[f"{column}_spark"],rtol=1e-9,atol=.01):
            raise AssertionError(f"Spark / PostgreSQL mismatch: {column}")
    print(f"Spark reconciles with PostgreSQL for all {len(merged)} day/region groups.")
    report=json.loads((ROOT/"data/exports/spark_report.json").read_text());report["postgres_reconciliation"]="passed"
    (ROOT/"data/exports/spark_report.json").write_text(json.dumps(report,indent=2))


if __name__=="__main__":verify()
