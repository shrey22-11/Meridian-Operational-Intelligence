import numpy as np
import pandas as pd
import pytest
from ml.features import FEATURES,demand_features,temporal_split
from ml.service import predict_order,risk_artifact,model_report
from backend.app.db import frame

SCENARIO={"warehouse_load":.9,"distance_km":700,"promised_days":6,"supplier_lead_days":5,
          "units":6,"revenue":12000,"region":"North","channel":"Retail","expedited":False}


def test_demand_lags_never_see_current_target():
    index=pd.date_range("2025-01-01",periods=50)
    series=pd.Series(np.arange(50,dtype=float),index=index)
    before=demand_features(series)
    series.iloc[-1]=999999
    after=demand_features(series)
    assert before.iloc[-1].drop("units").equals(after.iloc[-1].drop("units"))


def test_no_outcome_in_features():
    assert not set(FEATURES)&{"late","actual_days","status","delivered_at"}


@pytest.mark.integration
def test_temporal_split_and_label_availability():
    df=frame("SELECT * FROM order_facts WHERE status='delivered'")
    train,val,test=temporal_split(df)
    assert pd.to_datetime(train.ordered_at).max()<pd.to_datetime(val.ordered_at).min()
    assert pd.to_datetime(val.ordered_at).max()<pd.to_datetime(test.ordered_at).min()
    assert (pd.to_datetime(train.ordered_at)+pd.to_timedelta(train.actual_days,unit="D")).max()<pd.Timestamp("2025-04-01")
    assert set(train.order_id).isdisjoint(test.order_id)


@pytest.mark.integration
def test_saved_model_inference_and_sensitivity():
    risk_artifact.cache_clear()
    result=predict_order(SCENARIO)
    direct=risk_artifact()["model"].predict_proba(pd.DataFrame([SCENARIO])[FEATURES])[0,1]
    assert result["probability"]==pytest.approx(direct)
    assert 0<=result["probability"]<=1 and len(result["drivers"])==4
    lower=predict_order({**SCENARIO,"warehouse_load":.3})
    assert result["probability"]>lower["probability"]
    assert model_report()["risk"]["test"]["roc_auc"]>.7
