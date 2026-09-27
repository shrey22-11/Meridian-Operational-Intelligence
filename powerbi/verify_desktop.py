"""Compare real Power BI DAX outputs with the previously reconciled API values.

--prepare writes a DAX query, not simulated results. Run that query through query_model.ps1
then run without --prepare. The Desktop model must already be imported successfully.
"""
import argparse
import json
from pathlib import Path
import math

HERE=Path(__file__).resolve().parent
OUT=HERE.parent/'reports/powerbi'
FIELDS={'orders':'Orders Received','revenue':'Booked Revenue','gross_margin':'Gross Margin','average_order_value':'Average Basket','late_rate':'Delay Rate','open_orders':'Open Orders','delivered_orders':'Delivered Orders','active_customers':'Active Customers','prior_period_revenue':'Prior Period Revenue','revenue_change_pct':'Revenue Change'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--prepare',action='store_true');args=parser.parse_args()
    expected=json.loads((OUT/'expected-values.json').read_text())
    if args.prepare:
        rows=[]
        for i,p in enumerate(expected['periods']):
            values=', '.join(f'"{k}",[{v}]'+('*100' if k=='revenue_change_pct' else '') for k,v in FIELDS.items())
            ds=lambda s:'DATE('+s.replace('-',',')+')'
            filters=f"DATESBETWEEN('Date'[Date],{ds(p['start'])},{ds(p['end'])})"
            if p['region']!='All':filters+=f",'Region'[region]=\"{p['region']}\""
            rows.append(f'CALCULATETABLE(ROW("Case",{i},{values}),{filters})')
        (HERE/'validation-periods.dax').write_text('EVALUATE\nUNION(\n'+',\n'.join(rows)+'\n)\nORDER BY [Case]',encoding='utf-8')
        print('Prepared 25 actual-engine DAX filter cases');return
    actual=json.loads((OUT/'desktop-periods.json').read_text(encoding='utf-8-sig'))
    assert len(actual)==len(expected['periods'])
    checks=0
    def eq(a,b,label):
        nonlocal checks
        if b is None:assert a is None,(label,a,b)
        else:assert a is not None and math.isclose(a,b,abs_tol=1e-6,rel_tol=1e-10),(label,a,b)
        checks+=1
    for row in actual:
        row={k.strip('[]'):v for k,v in row.items()}
        p=expected['periods'][row['Case']]
        for k in FIELDS:eq(row.get(k),p[k],f"{row['Case']}:{k}")
    model=json.loads((OUT/'desktop-models.json').read_text(encoding='utf-8-sig'))[0]
    model={k.strip('[]'):v for k,v in model.items()}
    for name,key in {'Open Scored Orders':'open_scored_orders','High Risk':'high_risk_open_orders','Threshold':'risk_threshold','ROC AUC':'risk_auc','Recall':'risk_recall','Forecast Units':'forecast_units','Test MAE':'forecast_mae','Baseline MAE':'baseline_mae','Anomalies':'monitoring_anomalies'}.items():eq(model[name],expected[key],name)
    eq(model['Customers'],5000,'Customer count')
    eq(model['Customer Revenue'],expected['periods'][0]['revenue'],'Customer revenue')
    eq(model['Item Revenue'],expected['periods'][0]['revenue'],'Item revenue')
    result={'dax_engine_checks_passed':checks,'filter_cases':len(actual),'status':'passed','note':'Actual Desktop DAX query outputs reconciled to PostgreSQL/API/source artifacts.'}
    (OUT/'desktop-validation.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
