import json
import shutil
from backend.app.config import ROOT
from backend.app.db import frame


def export():
    destination=ROOT/"data/exports";destination.mkdir(parents=True,exist_ok=True)
    # Fixed allowlist, no user-generated SQL identifiers.
    for table in ["customers","products","suppliers","orders","order_items","order_facts","daily_operations"]:
        frame(f"SELECT * FROM {table}").to_csv(destination/f"{table}.csv",index=False)
    for name in ["forecast","forecast_backtest","segments","anomalies","scored_orders"]:
        shutil.copy2(ROOT/f"artifacts/{name}.csv",destination/f"{name}.csv")
    report=json.loads((ROOT/"data/curated/quality_report.json").read_text())
    (destination/"manifest.json").write_text(json.dumps({"pipeline_run_id":report["run_id"],"currency":"INR","source":"synthetic","snapshot":"2025-12-31"},indent=2))
    print("Power BI datasets exported to data/exports/.")


if __name__=="__main__":
    export()
