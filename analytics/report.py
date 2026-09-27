import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats
from backend.app.config import ROOT
from backend.app.db import frame


def wilson(successes,n,z=1.96):
    if not n:
        return [None,None]
    p=successes/n
    center=(p+z*z/(2*n))/(1+z*z/n)
    half=z*np.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n)
    return [float(center-half),float(center+half)]


def build_report():
    out=ROOT/"reports";out.mkdir(exist_ok=True)
    df=frame("SELECT * FROM order_facts ORDER BY ordered_at")
    delivered=df.loc[df.status.eq("delivered")].copy()
    by_region=[]
    for region,g in delivered.groupby("region"):
        by_region.append({"region":region,"orders":len(g),"late_rate":float(g.late.mean()),
                          "wilson_95_interval":wilson(g.late.sum(),len(g))})
    high=delivered.loc[delivered.warehouse_load>=.9,"late"]
    normal=delivered.loc[delivered.warehouse_load<.9,"late"]
    # Daily block bootstrap accommodates some within-day dependence.
    daily=delivered.assign(high_load=delivered.warehouse_load>=.9).groupby(["ordered_at","high_load"]).late.agg(["sum","count"])
    days=daily.index.get_level_values(0).unique();rng=np.random.default_rng(42);diff=[]
    for _ in range(1000):
        sample=daily.loc[rng.choice(days,len(days),replace=True)].groupby(level=1).sum()
        diff.append(sample.loc[True,"sum"]/sample.loc[True,"count"]-sample.loc[False,"sum"]/sample.loc[False,"count"])
    q1,q3=df.revenue.quantile([.25,.75])
    corr=delivered[["warehouse_load","distance_km","supplier_lead_days","units","actual_days"]].corr()
    report={"source":"Synthetic; descriptive findings only, not evidence about a real business",
        "orders":len(df),"revenue_distribution":df.revenue.describe(percentiles=[.5,.9,.95,.99]).to_dict(),
        "revenue_variance":float(df.revenue.var()),"revenue_iqr":float(q3-q1),
        "high_value_orders_retained":int((df.revenue>q3+1.5*(q3-q1)).sum()),
        "regions":by_region,"load_delay_association":{"high_load_rate":float(high.mean()),
        "normal_load_rate":float(normal.mean()),"difference":float(high.mean()-normal.mean()),
        "daily_block_bootstrap_95_interval":np.quantile(diff,[.025,.975]).tolist(),
        "method":"1000 resamples of calendar-day blocks; exploratory association, not randomized causal evidence."},
        "correlations":corr.to_dict(),
        "load_duration_covariance":float(delivered[["warehouse_load","actual_days"]].cov().iloc[0,1])}
    (out/"statistics.json").write_text(json.dumps(report,indent=2))
    plt.style.use("seaborn-v0_8-whitegrid")
    fig,axes=plt.subplots(2,2,figsize=(13,8))
    df.set_index(pd.to_datetime(df.ordered_at)).loc[df.status.ne("cancelled").values,"revenue"].resample("MS").sum().div(1e6).plot(ax=axes[0,0],color="#16796f",marker="o",title="Booked revenue by month (INR millions)")
    np.log1p(df.revenue).plot.hist(bins=45,ax=axes[0,1],color="#6e86af",title="Order value distribution (log1p INR)")
    axes[1,0].bar([x["region"] for x in by_region],[x["late_rate"] for x in by_region],color="#d9974b")
    axes[1,0].set_title("Delivered-order delay rate by region")
    im=axes[1,1].imshow(corr,vmin=-1,vmax=1,cmap="BrBG")
    axes[1,1].set_xticks(range(len(corr)),corr.columns,rotation=30,ha="right",fontsize=8)
    axes[1,1].set_yticks(range(len(corr)),corr.columns,fontsize=8)
    axes[1,1].set_title("Associations with delivery duration")
    fig.colorbar(im,ax=axes[1,1]);fig.tight_layout();fig.savefig(out/"operations_eda.png",dpi=160);plt.close(fig)
    print("EDA and statistical report saved to reports/.")
    return report


if __name__=="__main__":
    build_report()
