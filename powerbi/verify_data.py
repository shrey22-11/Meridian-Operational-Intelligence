"""Read-only reconciliation of BI sources with PostgreSQL, API, and artifacts.

Never runs export_bi, ETL, training or writes to the business data folders.
"""
from pathlib import Path
import sys
import json
import hashlib
from datetime import datetime, timezone
from urllib.request import urlopen
from urllib.parse import urlencode
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.app.db import frame

OUT=ROOT/'reports/powerbi'
EXPORT=ROOT/'data/exports'
CHECKS=[]
def api(path,**params):
    return json.loads(urlopen('http://127.0.0.1:8000/api/'+path+('?' + urlencode(params) if params else ''),timeout=30).read())

def equal(label,actual,expected,atol=1e-6):
    if expected is None:
        assert actual is None or pd.isna(actual),(label,actual,expected)
    elif isinstance(expected,(int,float,np.number)):
        assert np.isclose(actual,expected,rtol=1e-10,atol=atol,equal_nan=True),(label,actual,expected)
    else:assert actual==expected,(label,actual,expected)
    CHECKS.append(label)

def read(n):return pd.read_csv(EXPORT/(n+'.csv'))

def metrics(f):
    b=f[f.status!='cancelled'];d=f[f.status=='delivered']
    return dict(orders=len(f),revenue=b.revenue.sum(),gross_margin=b.gross_margin.sum(),average_order_value=b.revenue.mean(),late_rate=d.late.mean(),open_orders=int(f.status.eq('open').sum()),delivered_orders=len(d),active_customers=f.customer_id.nunique())

def main():
    OUT.mkdir(exist_ok=True)
    facts=read('order_facts');items=read('order_items');customers=read('customers');products=read('products')
    for name,pk in [('order_facts','order_id'),('customers','customer_id'),('products','product_id'),('suppliers','supplier_id'),('order_items','order_item_id')]:
        local=read(name).sort_values(pk).reset_index(drop=True)
        db=frame(f'SELECT * FROM {name} ORDER BY {pk}')
        equal(name+' row count',len(local),len(db))
        for c in local.columns:
            if pd.api.types.is_numeric_dtype(local[c]):
                assert np.allclose(local[c].to_numpy(float),pd.to_numeric(db[c]).to_numpy(float),rtol=1e-10,atol=1e-6,equal_nan=True),name+'.'+c
            else:assert local[c].fillna('').astype(str).tolist()==db[c].fillna('').astype(str).tolist(),name+'.'+c
            CHECKS.append(name+'.'+c+' PostgreSQL equality')
    assert set(facts.customer_id)<=set(customers.customer_id)
    assert set(items.order_id)<=set(facts.order_id)
    assert set(items.product_id)<=set(products.product_id)
    period_cases=[('2024-01-01','2025-12-31'),('2025-12-01','2025-12-31'),('2025-12-02','2025-12-31'),('2025-11-01','2025-11-30'),('2026-01-01','2026-01-14')]
    results=[]
    joined=items.merge(facts[['order_id','ordered_at','region','status','late']],on='order_id',validate='many_to_one').merge(products,on='product_id',validate='many_to_one')
    joined['line_revenue']=joined.quantity*joined.unit_price*(1-joined.discount)
    for start,end in period_cases:
        for region in [None,'North','South','East','West']:
            p={'start_date':start,'end_date':end}|({'region':region} if region else {})
            selected=facts[facts.ordered_at.between(start,end)]
            if region:selected=selected[selected.region==region]
            response=api('metrics',**p)
            for k,v in metrics(selected).items():equal(f'{start}:{end}:{region}:{k}',v,response['current'][k])
            span=(pd.Timestamp(end)-pd.Timestamp(start)).days+1
            ps=(pd.Timestamp(start)-pd.Timedelta(days=span)).strftime('%Y-%m-%d');pe=(pd.Timestamp(start)-pd.Timedelta(days=1)).strftime('%Y-%m-%d')
            prev=facts[facts.ordered_at.between(ps,pe)]
            if region:prev=prev[prev.region==region]
            prior=metrics(prev)['revenue'];current=metrics(selected)['revenue']
            equal(f'{start}:{region}:prior period',prior,response['previous']['revenue'])
            equal(f'{start}:{region}:revenue change',100*(current/prior-1) if prior else None,response['revenue_change_pct'])
            a=api('analytics',**p)
            j=joined[joined.ordered_at.between(start,end)&joined.status.ne('cancelled')]
            if region:j=j[j.region==region]
            for cat in a['categories']:equal(f'{start}:{region}:category:{cat["category"]}',j[j.category==cat['category']].line_revenue.sum(),cat['revenue'])
            results.append({'start':start,'end':end,'region':region or 'All',**response['current'],'prior_period_revenue':prior,'revenue_change_pct':response['revenue_change_pct']})
    daily=read('daily_operations')
    dbdaily=frame('SELECT * FROM daily_operations ORDER BY day,region')
    local=daily.sort_values(['day','region']).reset_index(drop=True)
    for c in ['orders','revenue','gross_margin','units','late_rate','warehouse_load']:
        assert np.allclose(local[c],dbdaily[c],rtol=1e-10,atol=1e-6,equal_nan=True);CHECKS.append('daily_operations all groups '+c)
    r=read('scored_orders');openr=r[r.status=='open'].sort_values('risk_probability',ascending=False)
    for row in api('predictions',limit=100):
        found=openr[openr.order_id==row['order_id']].iloc[0]
        equal('risk probability '+str(row['order_id']),found.risk_probability,row['risk_probability'])
    segments=read('segments')
    equal('segment IDs unique',segments.customer_id.nunique(),len(segments))
    for row in api('segments'):
        g=segments[segments.segment==row['segment']]
        for key,value in {'customers':len(g),'revenue':g.monetary.sum(),'mean_recency':g.recency.mean(),'mean_frequency':g.frequency.mean(),'late_rate':g.late_rate.mean()}.items():equal('segment '+row['segment']+' '+key,value,row[key])
    forecast=read('forecast')
    for i,row in enumerate(api('forecast')):
        for key in ['units','lower','upper']:equal('forecast '+str(i)+' '+key,forecast.iloc[i][key],row[key])
    assert (forecast.lower<=forecast.units).all() and (forecast.units<=forecast.upper).all()
    for name in ['forecast','forecast_backtest','scored_orders','anomalies','segments']:
        equal(name+' artifact byte equality',hashlib.sha256((EXPORT/(name+'.csv')).read_bytes()).hexdigest(),hashlib.sha256((ROOT/'artifacts'/(name+'.csv')).read_bytes()).hexdigest())
    model=json.loads((ROOT/'artifacts/model_report.json').read_text());quality=json.loads((ROOT/'data/curated/quality_report.json').read_text());manifest=json.loads((EXPORT/'manifest.json').read_text())
    equal('model API',model,api('models'))
    equal('quality API',quality,api('quality')[0]['report'])
    equal('model run matches export',model['pipeline_run_id'],manifest['pipeline_run_id'])
    equal('quality run matches export',quality['run_id'],manifest['pipeline_run_id'])
    expected={'periods':results,'open_scored_orders':len(openr),'high_risk_open_orders':int((openr.risk_probability>=model['risk']['threshold']).sum()),'forecast_units':float(forecast.units.sum()),'monitoring_anomalies':int((read('anomalies').is_anomaly&read('anomalies').period.eq('monitoring')).sum()),'risk_threshold':model['risk']['threshold'],'risk_auc':model['risk']['test']['roc_auc'],'risk_recall':model['risk']['test']['recall'],'forecast_mae':model['forecast']['test']['mae'],'baseline_mae':model['forecast']['seasonal_baseline_test']['mae']}
    (OUT/'expected-values.json').write_text(json.dumps(expected,indent=2))
    pd.DataFrame(results).to_csv(OUT/'reconciliation.csv',index=False)
    baseline=OUT/'protected-before.json'
    before=json.loads(baseline.read_text()) if baseline.exists() else {}
    changed=[p for p,h in before.items() if not (ROOT/p).exists() or hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
    assert not changed,changed
    report={'verified_at':datetime.now(timezone.utc).isoformat(),'checks_passed':len(CHECKS),'filter_cases':len(results),'checks':CHECKS,'protected_files_unchanged':len(before) if before else 'No baseline supplied on this machine','source_run':manifest['pipeline_run_id'],'power_bi_engine':'Not asserted by this script; see Desktop verification.'}
    (OUT/'data-validation.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='checks'},indent=2))

if __name__=='__main__':main()
