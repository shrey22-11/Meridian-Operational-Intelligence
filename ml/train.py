import json
import platform
from datetime import datetime,timezone
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression,Ridge
from sklearn.ensemble import HistGradientBoostingClassifier,HistGradientBoostingRegressor,IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.inspection import permutation_importance
from sklearn.metrics import (roc_auc_score,average_precision_score,precision_score,recall_score,
    f1_score,confusion_matrix,brier_score_loss,mean_absolute_error,root_mean_squared_error,r2_score)
from backend.app.config import ROOT
from backend.app.db import frame
from ml.features import FEATURES,preprocessing,temporal_split,demand_features

ARTIFACTS=ROOT/"artifacts"


def classification_metrics(y,p,threshold):
    pred=p>=threshold
    return {"roc_auc":roc_auc_score(y,p),"average_precision":average_precision_score(y,p),
        "precision":precision_score(y,pred,zero_division=0),"recall":recall_score(y,pred),
        "f1":f1_score(y,pred),"brier":brier_score_loss(y,p),
        "confusion_matrix":confusion_matrix(y,pred).tolist(),"prevalence":float(np.mean(y))}


def regression_metrics(y,p):
    return {"mae":mean_absolute_error(y,p),"rmse":root_mean_squared_error(y,p),"r2":r2_score(y,p)}


def train():
    ARTIFACTS.mkdir(exist_ok=True)
    facts=frame("SELECT * FROM order_facts ORDER BY ordered_at,order_id")
    delivered=facts.loc[facts.status.eq("delivered")].copy()
    train_df,val,test=temporal_split(delivered)
    candidates={"logistic":LogisticRegression(max_iter=500),
                "gradient_boosting":HistGradientBoostingClassifier(max_iter=120,max_leaf_nodes=15,l2_regularization=5,random_state=42)}
    fitted={}
    scores={}
    for name,estimator in candidates.items():
        pipe=Pipeline([("preprocess",preprocessing()),("model",estimator)])
        pipe.fit(train_df[FEATURES],train_df.late.astype(int))
        fitted[name]=pipe
        scores[name]=average_precision_score(val.late,pipe.predict_proba(val[FEATURES])[:,1])
    selected=max(scores,key=scores.get)
    model=fitted[selected]
    vp=model.predict_proba(val[FEATURES])[:,1]
    thresholds=np.arange(.15,.86,.05)
    # False negative costs three times a false alert. Choose on validation only.
    threshold=float(min(thresholds,key=lambda t:3*np.sum((vp<t)&(val.late==1))+np.sum((vp>=t)&(val.late==0))))
    tp=model.predict_proba(test[FEATURES])[:,1]
    importance=permutation_importance(model,val[FEATURES].sample(min(len(val),2500),random_state=42),
        val.loc[val[FEATURES].sample(min(len(val),2500),random_state=42).index,"late"],
        scoring="average_precision",n_repeats=3,random_state=42)
    model_report={"selected":selected,"selection_metric":"validation average precision",
        "validation_candidates":scores,"threshold":threshold,
        "threshold_cost_assumption":"Missed delay costs 3x a false alert; not a measured business cost.",
        "test":classification_metrics(test.late,tp,threshold),
        "split_sizes":{"train":len(train_df),"validation":len(val),"test":len(test)},
        "split_periods":{"train":"2024-01-01 to 2025-03-31; matured before April",
                         "validation":"2025-04-01 to 2025-06-30; matured before July",
                         "test":"2025-07-01 to 2025-09-30"},
        "feature_importance":sorted([{"feature":f,"importance":float(v)} for f,v in zip(FEATURES,importance.importances_mean)],key=lambda x:-x["importance"])}
    # Frozen audited model used for inference. Test data never refitted into this artifact.
    joblib.dump({"model":model,"threshold":threshold,"reference":train_df[FEATURES].copy(),
                 "report":model_report},ARTIFACTS/"risk.joblib")
    facts["risk_probability"]=model.predict_proba(facts[FEATURES])[:,1]
    facts["risk_level"]=np.where(facts.risk_probability>=threshold,"Investigate","Routine")
    facts.to_csv(ARTIFACTS/"scored_orders.csv",index=False)

    daily=frame("SELECT day,SUM(units) AS units FROM daily_operations GROUP BY day ORDER BY day")
    series=daily.set_index(pd.to_datetime(daily.day)).units.astype(float).asfreq("D",fill_value=0)
    features=demand_features(series)
    xcols=[c for c in features if c!="units"]
    tr=features.iloc[:-180]; va=features.iloc[-180:-90]; te=features.iloc[-90:]
    forecast_candidates={"ridge":Pipeline([("scale",StandardScaler()),("model",Ridge(alpha=10))]),
        "gradient_boosting":HistGradientBoostingRegressor(max_iter=100,max_leaf_nodes=10,l2_regularization=10,random_state=42)}
    fscores={}
    for name,m in forecast_candidates.items():
        m.fit(tr[xcols],tr.units)
        fscores[name]=mean_absolute_error(va.units,m.predict(va[xcols]))
    # Seasonal baseline is a genuine candidate, not just a decorative comparison.
    fscores["seasonal_naive"]=mean_absolute_error(va.units,va.lag7)
    choice=min(fscores,key=fscores.get)
    fm=forecast_candidates.get(choice)
    predictions=te.lag7.to_numpy() if fm is None else fm.predict(te[xcols])
    residuals=np.abs(va.units-(va.lag7 if fm is None else fm.predict(va[xcols])))
    width=float(np.quantile(residuals,.9))
    forecast_report={"selected":choice,"validation_mae":fscores,
        "test":regression_metrics(te.units,predictions),
        "seasonal_baseline_test":regression_metrics(te.units,te.lag7),
        "evaluation":"Rolling one-day-ahead predictions with observed past lags. 14-day outlook is recursive and has a different error profile.",
        "band":"Validation absolute-error 90th percentile; heuristic, not guaranteed 14-day coverage."}
    production=None if fm is None else clone(fm).fit(features[xcols],features.units)
    history=series.copy(); future=[]
    for step in range(14):
        day=history.index[-1]+pd.Timedelta(days=1)
        extended=pd.concat([history,pd.Series([0.0],index=[day])])
        row=demand_features(extended).iloc[[-1]][xcols]
        prediction=float(row.lag7.iloc[0] if production is None else production.predict(row)[0])
        prediction=max(0,prediction)
        future.append({"day":day.strftime("%Y-%m-%d"),"units":prediction,
                       "lower":max(0,prediction-width*np.sqrt(step+1)),"upper":prediction+width*np.sqrt(step+1)})
        history.loc[day]=prediction
    joblib.dump({"model":production,"features":xcols,"history":series,"report":forecast_report},ARTIFACTS/"forecast.joblib")
    pd.DataFrame(future).to_csv(ARTIFACTS/"forecast.csv",index=False)
    pd.DataFrame({"day":te.index,"actual":te.units,"prediction":predictions,"seasonal_baseline":te.lag7}).to_csv(ARTIFACTS/"forecast_backtest.csv",index=False)

    agg=frame("SELECT * FROM daily_operations ORDER BY day,region")
    acols=["orders","revenue","units","late_rate","warehouse_load"]
    cutoff=pd.Timestamp("2025-07-01")
    baseline=agg.loc[pd.to_datetime(agg.day)<cutoff,acols].fillna(0)
    detector=Pipeline([("scale",StandardScaler()),("model",IsolationForest(contamination=.025,random_state=42,n_estimators=150))]).fit(baseline)
    agg["anomaly_score"]=-detector.decision_function(agg[acols].fillna(0))
    agg["is_anomaly"]=detector.predict(agg[acols].fillna(0))==-1
    z=(agg[acols].fillna(0)-baseline.mean())/baseline.std().replace(0,1)
    agg["main_deviation"]=z.abs().idxmax(axis=1)
    agg["deviation_z"]=[float(z.iloc[i][f]) for i,f in enumerate(agg.main_deviation)]
    agg["period"]=np.where(pd.to_datetime(agg.day)<cutoff,"reference","monitoring")
    agg.to_csv(ARTIFACTS/"anomalies.csv",index=False)
    joblib.dump(detector,ARTIFACTS/"anomaly.joblib")

    rfm=frame("""SELECT customer_id,MAX(ordered_at) AS last_order,COUNT(*) AS frequency,
        SUM(revenue) AS monetary,AVG(late) AS late_rate FROM order_facts
        WHERE status<>'cancelled' GROUP BY customer_id""")
    rfm["recency"]=(pd.to_datetime(facts.ordered_at).max()-pd.to_datetime(rfm.last_order)).dt.days
    rcols=["recency","frequency","monetary"]
    segmenter=Pipeline([("scale",StandardScaler()),("model",KMeans(n_clusters=4,n_init=20,random_state=42))])
    rfm["cluster"]=segmenter.fit_predict(np.log1p(rfm[rcols]))
    rank=rfm.groupby("cluster").monetary.mean().sort_values().index.tolist()
    labels=dict(zip(rank,["Occasional","Developing","Established","High value"]))
    rfm["segment"]=rfm.cluster.map(labels)
    rfm.to_csv(ARTIFACTS/"segments.csv",index=False)
    joblib.dump({"model":segmenter,"labels":labels},ARTIFACTS/"segments.joblib")
    lineage=json.loads((ROOT/"data/curated/quality_report.json").read_text())
    report={"created_at":datetime.now(timezone.utc).isoformat(),"source":"synthetic",
        "pipeline_run_id":lineage["run_id"],"raw_sha256":lineage["raw_sha256"],
        "python":platform.python_version(),"sklearn":sklearn.__version__,
        "risk":model_report,"forecast":forecast_report,
        "anomaly":{"method":"Isolation Forest","reference_end":"2025-06-30","contamination":.025,
                   "warning":"Investigation candidates, not verified failures. No labeled anomaly ground truth."},
        "segmentation":{"method":"KMeans on log1p RFM, standardized","clusters":4,"as_of":"2025-12-31"}}
    (ARTIFACTS/"model_report.json").write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    return report


if __name__=="__main__":
    train()
