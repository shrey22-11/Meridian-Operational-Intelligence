from functools import lru_cache
import json
import joblib
import numpy as np
import pandas as pd
from backend.app.config import ROOT
from ml.features import FEATURES,NUMERIC


@lru_cache(maxsize=1)
def risk_artifact():
    path=ROOT/"artifacts/risk.joblib"
    if not path.exists():
        raise FileNotFoundError("Models are not ready. Run python -m ml.train.")
    return joblib.load(path)


def predict_order(values):
    artifact=risk_artifact()
    model=artifact["model"]
    row=pd.DataFrame([values])[FEATURES]
    probability=float(model.predict_proba(row)[0,1])
    reference=artifact["reference"]
    explanations=[]
    for feature in NUMERIC:
        modified=row.copy()
        median=float(reference[feature].median())
        modified[feature]=median
        changed=float(model.predict_proba(modified)[0,1])
        explanations.append({"feature":feature,"value":float(row[feature].iloc[0]),
            "reference_median":median,"probability_difference":probability-changed})
    return {"probability":probability,"threshold":artifact["threshold"],
        "risk_level":"Investigate" if probability>=artifact["threshold"] else "Routine",
        "drivers":sorted(explanations,key=lambda x:-abs(x["probability_difference"]))[:4],
        "explanation_method":"Change one numeric input to its training median. Associations, not causal effects."}


def model_report():
    return json.loads((ROOT/"artifacts/model_report.json").read_text())


def artifact_records(name):
    allowed={"forecast","anomalies","segments","scored_orders","forecast_backtest"}
    if name not in allowed:
        raise ValueError("Unknown model output")
    return pd.read_csv(ROOT/f"artifacts/{name}.csv")
