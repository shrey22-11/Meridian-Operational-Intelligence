import argparse
import hashlib
import json
from uuid import uuid4
import pandas as pd
from sqlalchemy import text
from backend.app.config import ROOT
from backend.app.db import engine
from pipeline.generate import generate
from pipeline.clean import clean_tables

TABLES = ["suppliers","customers","products","orders","order_items"]


def run(regenerate=False, n_orders=65000):
    raw = ROOT / "data/raw"
    if regenerate or not (raw/"orders.csv").exists():
        generate(n_orders=n_orders)
    tables = {t:pd.read_csv(raw/f"{t}.csv") for t in TABLES}
    cleaned, quarantine, report = clean_tables(tables)
    report["source"] = "Synthetic data; seed 42; INR; snapshot 2025-12-31"
    report["raw_sha256"] = {t:hashlib.sha256((raw/f"{t}.csv").read_bytes()).hexdigest() for t in TABLES}
    report["run_id"] = uuid4().hex
    curated = ROOT / "data/curated"
    curated.mkdir(parents=True,exist_ok=True)
    for name, df in quarantine.items():
        df.to_csv(curated/f"quarantine_{name}.csv",index=False)
    with engine.begin() as conn:
        # Execute DDL with driver so psycopg does not prepare multiple statements.
        conn.exec_driver_sql((ROOT/"database/schema.sql").read_text())
        conn.execute(text("TRUNCATE order_items,orders,products,customers,suppliers"))
        for table in TABLES:
            cleaned[table].to_sql(table,conn,if_exists="append",index=False,chunksize=3000)
        conn.execute(text("INSERT INTO pipeline_runs(run_id,report) VALUES (:id,CAST(:report AS jsonb))"),
                     {"id":report["run_id"],"report":json.dumps(report)})
    for table, df in cleaned.items():
        df.to_csv(curated/f"{table}.csv",index=False)
    (curated/"quality_report.json").write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    return report


if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--regenerate",action="store_true")
    p.add_argument("--orders",type=int,default=65000)
    a=p.parse_args()
    run(a.regenerate,a.orders)
