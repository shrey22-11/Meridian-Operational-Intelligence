"""Build Meridian's editable PBIP using existing exports only. No data generation.

Run from any directory with the project Python. Desktop Refresh imports local files.
"""
from pathlib import Path
import json
import uuid
import argparse

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASE = 'https://developer.microsoft.com/json-schemas/fabric/item/'
OUT = HERE
TABLES = []
RELATIONSHIPS = []
MEASURES = []
SOURCE_QUERIES = {}

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')

def schema(part, version='1.0.0'):
    return BASE + 'report/definition/' + part + '/' + version + '/schema.json'

def table(name, columns, expression, hidden=False):
    cols=[]
    for col, typ in columns.items():
        c={'name':col,'dataType':typ,'sourceColumn':col,'summarizeBy':'none'}
        if typ=='dateTime': c['formatString']='dd MMM yyyy'
        if typ=='double': c['formatString']='#,0.00'
        if typ=='int64': c['formatString']='#,0'
        cols.append(c)
    t={'name':name,'columns':cols,'partitions':[{'name':name,'mode':'import','source':{'type':'m','expression':expression}}]}
    if hidden:t['isHidden']=True
    TABLES.append(t)
    return t

def csv_expr(file, columns):
    mtypes={'int64':'Int64.Type','double':'type number','string':'type text','boolean':'type logical','dateTime':'type date'}
    types=', '.join('{"'+c+'", '+mtypes[t]+'}' for c,t in columns.items())
    name = 'Source' + ''.join(word.title() for word in file.split('_'))
    SOURCE_QUERIES[name] = f'ReadCsv("{file}", {{{types}}})'
    return name

def csv(name,file,columns):
    return table(name,columns,csv_expr(file,columns))

def relation(fact, fk, dim, pk):
    RELATIONSHIPS.append({'name':str(uuid.uuid5(uuid.NAMESPACE_URL,f'{fact}.{fk}-{dim}.{pk}')),'fromTable':fact,'fromColumn':fk,'toTable':dim,'toColumn':pk,'fromCardinality':'many','toCardinality':'one','crossFilteringBehavior':'oneDirection','isActive':True})

def measure(name, expression, fmt='#,0', folder='Operations', description=''):
    # Model is a reserved DAX identifier in current Desktop versions.
    expression = expression.replace('Model[', "'Model'[")
    m={'name':name,'expression':expression,'formatString':fmt,'displayFolder':folder,'description':description or name}
    MEASURES.append(m)

def build_model(root):
    order_cols={'order_id':'int64','customer_id':'int64','ordered_at':'dateTime','promised_days':'int64','actual_days':'double','warehouse_load':'double','distance_km':'double','expedited':'boolean','status':'string','region':'string','channel':'string','revenue':'double','gross_margin':'double','units':'int64','line_count':'int64','supplier_lead_days':'double','late':'double'}
    csv('Orders','order_facts',order_cols)
    customer_cols={'customer_id':'int64','region':'string','channel':'string','joined_at':'dateTime'}
    segment_cols={'customer_id':'int64','last_order':'dateTime','frequency':'int64','monetary':'double','late_rate':'double','recency':'int64','cluster':'int64','segment':'string'}
    table('Customers',customer_cols|{k:v for k,v in segment_cols.items() if k!='customer_id'},f'''let
    C = {csv_expr('customers',customer_cols)},
    S = {csv_expr('segments',segment_cols)},
    Joined = Table.NestedJoin(C,{{"customer_id"}},S,{{"customer_id"}},"RFM",JoinKind.LeftOuter),
    Expanded = Table.ExpandTableColumn(Joined,"RFM",{{"last_order","frequency","monetary","late_rate","recency","cluster","segment"}})
in Expanded''')
    product_cols={'product_id':'int64','supplier_id':'int64','product_name':'string','category':'string','unit_cost':'double','list_price':'double'}
    supplier_cols={'supplier_id':'int64','supplier_name':'string','lead_time_days':'int64'}
    table('Products',product_cols|{'supplier_name':'string','lead_time_days':'int64'},f'''let
    P = {csv_expr('products',product_cols)},
    S = {csv_expr('suppliers',supplier_cols)},
    J = Table.NestedJoin(P,{{"supplier_id"}},S,{{"supplier_id"}},"Supplier",JoinKind.LeftOuter)
in Table.ExpandTableColumn(J,"Supplier",{{"supplier_name","lead_time_days"}})''')
    item_cols={'order_item_id':'int64','order_id':'int64','product_id':'int64','quantity':'int64','unit_price':'double','discount':'double'}
    table('Items',item_cols|{'customer_id':'int64','ordered_at':'dateTime','status':'string','late':'double','line_revenue':'double'},f'''let
    I = {csv_expr('order_items',item_cols)},
    O = Table.SelectColumns(Orders,{{"order_id","customer_id","ordered_at","status","late"}}),
    J = Table.NestedJoin(I,{{"order_id"}},O,{{"order_id"}},"Order",JoinKind.Inner),
    E = Table.ExpandTableColumn(J,"Order",{{"customer_id","ordered_at","status","late"}}),
    Revenue = Table.AddColumn(E,"line_revenue",each [quantity]*[unit_price]*(1-[discount]),type number)
in Revenue''')
    risk_cols=order_cols|{'risk_probability':'double','risk_level':'string'}
    table('Open Risk',risk_cols,f'''let S = {csv_expr('scored_orders',risk_cols)} in Table.SelectRows(S,each [status]="open")''')
    daily_cols={'day':'dateTime','region':'string','orders':'int64','revenue':'double','gross_margin':'double','units':'int64','late_rate':'double','warehouse_load':'double'}
    csv('Daily Operations','daily_operations',daily_cols)
    anomaly_cols=daily_cols|{'anomaly_score':'double','is_anomaly':'boolean','main_deviation':'string','deviation_z':'double','period':'string'}
    table('Anomalies',anomaly_cols,f'''let S = {csv_expr('anomalies',anomaly_cols)} in Table.SelectRows(S,each [period]="monitoring" and [is_anomaly]=true)''')
    csv('Forecast','forecast',{'day':'dateTime','units':'double','lower':'double','upper':'double'})
    csv('Backtest','forecast_backtest',{'day':'dateTime','actual':'double','prediction':'double','seasonal_baseline':'double'})
    table('Date',{'Date':'dateTime','Month':'string','Year':'int64'},'''let
    Start = List.Min(Orders[ordered_at]),
    End = List.Max(Forecast[day]),
    Dates = Table.FromList(List.Dates(Start,Duration.Days(End-Start)+1,#duration(1,0,0,0)),Splitter.SplitByNothing(),{"Date"}),
    Typed = Table.TransformColumnTypes(Dates,{{"Date",type date}}),
    Month = Table.AddColumn(Typed,"Month",each Date.ToText([Date],"yyyy-MM"),type text),
    Year = Table.AddColumn(Month,"Year",each Date.Year([Date]),Int64.Type)
in Year''')
    TABLES[-1]['dataCategory']='Time'
    TABLES[-1]['columns'][0]['isKey']=True
    table('Region',{'region':'string'},'Table.Distinct(Table.SelectColumns(Customers,{"region"}))')
    table('Model',{'risk_model':'string','threshold':'double','risk_auc':'double','risk_precision':'double','risk_recall':'double','forecast_model':'string','forecast_mae':'double','baseline_mae':'double','run_id':'string','created_at':'string'},'''let
    J = Json.Document(File.Contents(ProjectRoot & "/artifacts/model_report.json")),
    T = Table.FromRecords({[risk_model=J[risk][selected], threshold=J[risk][threshold], risk_auc=J[risk][test][roc_auc], risk_precision=J[risk][test][precision], risk_recall=J[risk][test][recall], forecast_model=J[forecast][selected], forecast_mae=J[forecast][test][mae], baseline_mae=J[forecast][seasonal_baseline_test][mae], run_id=J[pipeline_run_id], created_at=J[created_at]]})
in T''')
    table('Quality',{'Check':'string','Rows':'int64'},'''let
    J = Json.Document(File.Contents(ProjectRoot & "/data/curated/quality_report.json")),
    Counts = Record.SelectFields(J,{"duplicate_orders_removed","load_defaulted_to_075","invalid_orders_quarantined","orders_without_valid_items_quarantined","items_quarantined","loaded_orders","loaded_items"}),
    T = Record.ToTable(Counts),
    N = Table.RenameColumns(T,{{"Name","Check"},{"Value","Rows"}})
in Table.TransformColumnTypes(N,{{"Rows",Int64.Type}})''')
    table('Lineage',{'Dataset':'string','SHA256':'string'},'''let J=Json.Document(File.Contents(ProjectRoot & "/data/curated/quality_report.json")) in Table.RenameColumns(Record.ToTable(J[raw_sha256]),{{"Name","Dataset"},{"Value","SHA256"}})''')
    for f,c in [('Orders','ordered_at'),('Items','ordered_at'),('Open Risk','ordered_at'),('Daily Operations','day'),('Anomalies','day'),('Forecast','day'),('Backtest','day')]:relation(f,c,'Date','Date')
    for f in ['Orders','Items','Open Risk']:relation(f,'customer_id','Customers','customer_id')
    for f in ['Customers','Daily Operations','Anomalies']:relation(f,'region','Region','region')
    relation('Items','product_id','Products','product_id')
    money='"â‚¹" #,0.00;("â‚¹" #,0.00);"â‚¹" 0.00'
    for n,e,f in [
        ('Booked Revenue','COALESCE(CALCULATE(SUM(Orders[revenue]), KEEPFILTERS(Orders[status] <> "cancelled")),0)',money),
        ('Gross Margin','COALESCE(CALCULATE(SUM(Orders[gross_margin]), KEEPFILTERS(Orders[status] <> "cancelled")),0)',money),
        ('Margin Rate','DIVIDE([Gross Margin],[Booked Revenue])','0.0%'),
        ('Orders Received','COALESCE(COUNTROWS(Orders),0)','#,0'),
        ('Booked Orders','CALCULATE(COUNTROWS(Orders),KEEPFILTERS(Orders[status] <> "cancelled"))','#,0'),
        ('Average Basket','DIVIDE([Booked Revenue],[Booked Orders])',money),
        ('Delivered Orders','COALESCE(CALCULATE(COUNTROWS(Orders),KEEPFILTERS(Orders[status] = "delivered")),0)','#,0'),
        ('Late Deliveries','COALESCE(CALCULATE(COUNTROWS(Orders),KEEPFILTERS(Orders[status] = "delivered"),Orders[late] = 1),0)','#,0'),
        ('Delay Rate','DIVIDE([Late Deliveries],[Delivered Orders])','0.0%'),
        ('On Time Rate','IF([Delivered Orders]>0,1-[Delay Rate])','0.0%'),
        ('Open Orders','COALESCE(CALCULATE(COUNTROWS(Orders),KEEPFILTERS(Orders[status] = "open")),0)','#,0'),
        ('Active Customers','COALESCE(DISTINCTCOUNT(Orders[customer_id]),0)','#,0'),
        ('Booked Units','CALCULATE(SUM(Orders[units]),KEEPFILTERS(Orders[status] <> "cancelled"))','#,0'),
        ('Warehouse Load','AVERAGE(Orders[warehouse_load])','0.0%'),
        ('Prior Period Revenue','VAR FirstDay=MIN(\'Date\'[Date]) VAR LastDay=MAX(\'Date\'[Date]) VAR Span=DATEDIFF(FirstDay,LastDay,DAY)+1 RETURN CALCULATE([Booked Revenue],REMOVEFILTERS(\'Date\'),DATESBETWEEN(\'Date\'[Date],FirstDay-Span,FirstDay-1))',money),
        ('Revenue Change','IF([Prior Period Revenue]<>0,DIVIDE([Booked Revenue]-[Prior Period Revenue],[Prior Period Revenue]))','+0.0%;-0.0%;0.0%'),
        ('Prior Month Revenue','CALCULATE([Booked Revenue],DATEADD(\'Date\'[Date],-1,MONTH))',money),
        ('Revenue MoM','DIVIDE([Booked Revenue]-[Prior Month Revenue],[Prior Month Revenue])','+0.0%;-0.0%;0.0%'),
    ]:measure(n,e,f,'Commercial')
    for n,e,f in [
        ('Item Booked Revenue','CALCULATE(SUM(Items[line_revenue]),KEEPFILTERS(Items[status]<>"cancelled"))',money),
        ('Product Delivered Orders','CALCULATE(DISTINCTCOUNT(Items[order_id]),Items[status]="delivered")','#,0'),
        ('Product Historical Delay','IF([Product Delivered Orders]>=20,CALCULATE(AVERAGE(Items[late]),Items[status]="delivered"))','0.0%'),
        ('Open Scored Orders','COALESCE(COUNTROWS(\'Open Risk\'),0)','#,0'),
        ('High Risk Open Orders','VAR Cutoff=MAX(Model[threshold]) RETURN COALESCE(COUNTROWS(FILTER(\'Open Risk\',\'Open Risk\'[risk_probability]>=Cutoff)),0)','#,0'),
        ('Risk Probability','MAX(\'Open Risk\'[risk_probability])','0.0%'),
        ('Risk Threshold','MAX(Model[threshold])','0.0%'),
        ('Risk ROC AUC','MAX(Model[risk_auc])','0.000'),
        ('Risk Recall','MAX(Model[risk_recall])','0.0%'),
    ]:measure(n,e,f,'Fulfillment')
    for n,e,f in [
        ('Segment Customers','COUNT(Customers[frequency])','#,0'),
        ('Segment Lifetime Revenue','SUM(Customers[monetary])',money),
        ('Mean Recency Days','AVERAGE(Customers[recency])','0.0'),
        ('Mean Frequency','AVERAGE(Customers[frequency])','0.0'),
        ('Mean Customer Delay','AVERAGE(Customers[late_rate])','0.0%'),
    ]:measure(n,e,f,'Customer snapshot')
    for n,e in [('Forecast Units','SUM(Forecast[units])'),('Lower Heuristic','SUM(Forecast[lower])'),('Upper Heuristic','SUM(Forecast[upper])'),('One Day Test MAE','MAX(Model[forecast_mae])'),('Seasonal Baseline MAE','MAX(Model[baseline_mae])'),('Backtest Actual','SUM(Backtest[actual])'),('Backtest Prediction','SUM(Backtest[prediction])'),('Backtest Baseline','SUM(Backtest[seasonal_baseline])')]:measure(n,e,'#,0.0','Planning')
    measure('Monitoring Anomalies','COALESCE(COUNTROWS(Anomalies),0)')
    measure('Anomaly Score','MAX(Anomalies[anomaly_score])','0.000')
    measure('Audit Rows','SUM(Quality[Rows])')
    measure('Snapshot','MAX(Orders[ordered_at])','dd MMM yyyy','Provenance')
    measure('Pipeline Run','SELECTEDVALUE(Model[run_id])','','Provenance')
    measure('Forecast Model','SELECTEDVALUE(Model[forecast_model])','','Planning')
    measure('Daily Load','AVERAGE(\'Daily Operations\'[warehouse_load])','0.0%','Fulfillment')
    measure('Daily Delay','AVERAGE(\'Daily Operations\'[late_rate])','0.0%','Fulfillment')
    measure('Observed Revenue','IF(COUNTROWS(Orders)>0,[Booked Revenue])',money,'Commercial','Booked revenue shown only where orders exist; prevents future calendar dates appearing as zero actuals.')
    TABLES[0]['measures']=MEASURES
    model={'name':'Meridian','compatibilityLevel':1606,'model':{'culture':'en-US','defaultPowerBIDataSourceVersion':'powerBI_V3','sourceQueryCulture':'en-US','expressions':[{'name':'ProjectRoot','kind':'m','expression':json.dumps(root.as_posix())+' meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]'}],'tables':TABLES,'relationships':RELATIONSHIPS,'annotations':[{'name':'__PBI_TimeIntelligenceEnabled','value':'0'}]}}
    model['model']['expressions'].append({'name':'ReadCsv','kind':'m','expression':'''(file as text, types as list) as table => let
    Source = Csv.Document(File.Contents(ProjectRoot & "/data/exports/" & file & ".csv"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    Nulls = Table.ReplaceValue(Headers,"",null,Replacer.ReplaceValue,Table.ColumnNames(Headers)),
    Typed = Table.TransformColumnTypes(Nulls,types,"en-US")
in Typed'''})
    # Each private file is read in its own load-disabled staging query. All joins
    # then reference staged query results, never read files in the join partition.
    # These expressions do not add tables to the fourteen-table semantic model.
    for name, expression in SOURCE_QUERIES.items():
        model['model']['expressions'].append({'name':name,'kind':'m','expression':expression})
    save(OUT/'Meridian.SemanticModel/model.bim',model)
    save(OUT/'Meridian.SemanticModel/definition.pbism',{'$schema':BASE+'semanticModel/definitionProperties/1.0.0/schema.json','version':'1.0','settings':{'qnaEnabled':False}})
    (OUT/'measures.dax').write_text('\n\n'.join(f'// {m["displayFolder"]}\n{m["name"]} =\n{m["expression"]}' for m in MEASURES),encoding='utf-8')

def literal(value):
    s=('true' if value else 'false') if isinstance(value,bool) else (str(value)+'D' if isinstance(value,(int,float)) else "'"+value.replace("'","''")+"'")
    return {'expr':{'Literal':{'Value':s}}}

def color(value):return {'solid':{'color':literal(value)}}
def props(**kw):return [{'properties':kw}]
def field(table,column,measure=False):return {('Measure' if measure else 'Column'):{'Expression':{'SourceRef':{'Entity':table}},'Property':column}}
def col(t,c):return (t,c,False)
def ms(n):return ('Orders',n,True)
def projection(spec):
    t,c,m=spec
    return {'field':field(t,c,m),'queryRef':t+'.'+c,'nativeQueryRef':c}

PAGES=[]
def page(name,title,subtitle,footer):
    p={'$schema':schema('page','2.0.0'),'name':name,'displayName':title,'displayOption':'FitToPage','width':1440,'height':900,'objects':{'background':props(color=color('#FBFCF9'),transparency=literal(0))}}
    PAGES.append((p,[]))
    text_box('MERIDIAN   /   OPERATIONS INTELLIGENCE',36,10,1300,44,12,'#35644C')
    text_box(title,36,48,1320,64,26)
    text_box(subtitle,36,108,1350,44,12,'#526058')
    text_box(footer+'  â€¢  Synthetic retail data  â€¢  Snapshot 31 Dec 2025  â€¢  INR',36,854,1368,44,10,'#526058')
    return p

def visual(vtype,title,x,y,w,h,roles=None,sort=None,objects=None):
    visuals=PAGES[-1][1];name=f'v{len(visuals):02d}'
    v={'$schema':schema('visualContainer','2.0.0'),'name':name,'position':{'x':x,'y':y,'z':len(visuals),'width':w,'height':h,'tabOrder':len(visuals)},'visual':{'visualType':vtype,'drillFilterOtherVisuals':True,'visualContainerObjects':{'title':props(show=literal(bool(title)),text=literal(title),fontColor=color('#252E29'),fontSize=literal(13),fontFamily=literal('Segoe UI')),'background':props(show=literal(True),color=color('#FFFFFF'),transparency=literal(0)),'border':props(show=literal(False)),'visualHeader':props(show=literal(True)),'general':props(altText=literal(title or 'Meridian report context'))}}}
    if roles:
        q={'queryState':{role:{'projections':[projection(s) for s in specs]} for role,specs in roles.items()}}
        if sort:q['sortDefinition']={'sort':[{'field':field(*sort[0]),'direction':sort[1]}],'isDefaultSort':True}
        v['visual']['query']=q
    if objects:v['visual']['objects']=objects
    visuals.append(v)
    return v

def text_box(text,x,y,w,h,size=12,ink='#252E29'):
    return visual('textbox','',x,y,w,h,objects={'general':props(paragraphs=[{'textRuns':[{'value':text,'textStyle':{'fontFamily':'Segoe UI','fontSize':f'{size}pt','color':ink}}]}])})

def card(name,x,w=260,y=280):
    visual('card',name,x,y,w,86 if y==280 else 108,{'Values':[ms(name)]},objects={'labels':props(color=color('#252E29'),fontSize=literal(27),labelDisplayUnits=literal(0)),'categoryLabels':props(show=literal(False))})

def slicer(t,c,x,w=230,y=170):
    visual('slicer','',x,y-12,w,110,{'Values':[col(t,c)]},objects={'data':props(mode=literal('Dropdown')),'selection':props(singleSelect=literal(False))})

def chart(typ,title,cat,meas,x,y,w,h):
    if y==366: y,h=386,h-20
    return visual(typ,title,x,y,w,h,{'Category':[cat],'Y':[ms(m) for m in meas]},(cat,'Ascending'),{'categoryAxis':props(fontSize=literal(11)),'valueAxis':props(fontSize=literal(11)),'legend':props(show=literal(len(meas)>1))})

def grid(title,fields,x,y,w,h,sort=None):
    if y==366: y,h=386,h-20
    return visual('tableEx',title,x,y,w,h,{'Values':fields},sort,{'grid':props(gridVertical=literal(False),rowPadding=literal(6)),'columnHeaders':props(fontSize=literal(11),fontColor=color('#526058'),backColor=color('#F4F6F1')),'values':props(fontSize=literal(11)),'total':props(totals=literal(False))})

def build_pages():
    page('overview','01  Executive overview','Commercial performance and delivery reliability. Select a period and region; click a chart to investigate.','Revenue excludes cancellations; delivery rates use delivered orders only.')
    slicer('Date','Date',36,350);slicer('Region','region',410);slicer('Customers','channel',665)
    for i,n in enumerate(['Booked Revenue','Gross Margin','Orders Received','On Time Rate','Margin Rate']):card(n,36+i*276,260)
    chart('lineChart','Booked revenue by month',col('Date','Month'),['Observed Revenue'],36,366,840,232)
    chart('clusteredBarChart','Revenue by region',col('Region','region'),['Booked Revenue'],900,366,504,232)
    chart('clusteredBarChart','Category contribution Â· item grain',col('Products','category'),['Item Booked Revenue'],36,620,680,220)
    grid('Period detail Â· equal-length prior period comparison',[ms(n) for n in ['Average Basket','Delay Rate','Open Orders','Active Customers','Prior Period Revenue']],740,620,664,220)
    page('fulfillment','02  Fulfillment investigation','Prioritize open orders using frozen model scores; compare with observed product delivery outcomes.','Risk is a prediction, not an observed delay. Product delay requires â‰¥20 delivered orders.')
    slicer('Date','Date',36,350);slicer('Region','region',410)
    for i,n in enumerate(['Open Scored Orders','High Risk Open Orders','Risk Threshold','Risk ROC AUC','Risk Recall']):card(n,36+i*276,260)
    grid('Open-order action queue Â· highest probability first',[col('Open Risk',n) for n in ['order_id','customer_id','ordered_at','region','risk_level']]+[ms('Risk Probability')],36,366,860,274,(ms('Risk Probability'),'Descending'))
    grid('Historical product delay Â· selected period',[col('Products','product_name'),col('Products','supplier_name'),ms('Product Delivered Orders'),ms('Product Historical Delay')],920,366,484,474,(ms('Product Historical Delay'),'Descending'))
    visual('scatterChart','Warehouse load vs observed delay Â· one point per day / region',36,662,860,178,{'Category':[col('Daily Operations','day')],'Series':[col('Daily Operations','region')],'X':[ms('Daily Load')],'Y':[ms('Daily Delay')]},objects={'categoryAxis':props(fontSize=literal(10)),'valueAxis':props(fontSize=literal(10)),'legend':props(show=literal(True))})
    page('customers','03  Customer economics','Current RFM assignments describe the snapshot. Lifetime segment metrics do not change with a historical date selection.','Mean customer delay is customer-weighted; executive delay is order-weighted.')
    slicer('Region','region',36);slicer('Customers','segment',292,300);slicer('Customers','channel',618)
    for i,n in enumerate(['Segment Customers','Segment Lifetime Revenue','Mean Recency Days','Mean Frequency','Mean Customer Delay']):card(n,36+i*276,260)
    chart('clusteredBarChart','Customer value by current segment',col('Customers','segment'),['Segment Lifetime Revenue'],36,366,660,232)
    chart('clusteredBarChart','Recency by current segment Â· days',col('Customers','segment'),['Mean Recency Days'],720,366,684,232)
    grid('Customer detail Â· right-click a customer ID to drill through',[col('Customers',n) for n in ['customer_id','region','channel','segment']]+[ms(n) for n in ['Segment Lifetime Revenue','Mean Recency Days','Mean Frequency']],36,620,1368,220,(ms('Segment Lifetime Revenue'),'Descending'))
    page('planning','04  Demand planning','Portfolio outlook Â· all regions. One-day test error and recursive 14-day outlook have different error profiles.','Range bounds are heuristic validation-error bands, not a calibrated confidence interval.')
    for i,n in enumerate(['Forecast Units','One Day Test MAE','Seasonal Baseline MAE']):card(n,36+i*348,324,y=170)
    card('Forecast Model',1080,324,y=170)
    chart('lineChart','Observed portfolio demand Â· daily units',col('Date','Date'),['Booked Units'],36,310,660,238)
    chart('lineChart','14-day outlook and heuristic bounds',col('Forecast','day'),['Forecast Units','Lower Heuristic','Upper Heuristic'],720,310,684,238)
    chart('lineChart','Held-out one-day forecasts vs actual and seasonal baseline',col('Backtest','day'),['Backtest Actual','Backtest Prediction','Backtest Baseline'],36,572,1368,268)
    page('trust','05  Data trust & monitoring','Cleaning audit, model lineage, and monitoring-period anomaly candidates. No source records are changed by this report.','Anomaly scores identify investigation candidates; they are not confirmed failures.')
    card('Monitoring Anomalies',36,290,y=170);card('Snapshot',350,290,y=170)
    card('Pipeline Run',674,730,y=170)
    grid('Cleaning decisions Â· row counts are not additive',[col('Quality','Check'),ms('Audit Rows')],36,310,490,262)
    grid('Source fingerprints',[col('Lineage','Dataset'),col('Lineage','SHA256')],550,310,854,262)
    grid('Monitoring anomalies Â· Julyâ€“December 2025',[col('Anomalies',n) for n in ['day','region','main_deviation','deviation_z','orders','revenue','late_rate']]+[ms('Anomaly Score')],36,596,1368,244,(ms('Anomaly Score'),'Descending'))
    p=page('customer_detail','06  Customer detail','Drill through from Customer economics, or choose a customer ID below. Use the page tabs to return.','Revenue includes all booked history for the selected customer; cancelled orders are excluded.')
    p['type']='Drillthrough';p['pageBinding']={'name':'customer_drill','type':'Drillthrough','parameters':[{'name':'customer_id','boundFilter':'customer_filter','fieldExpr':field('Customers','customer_id')}],'acceptsFilterContext':'Default'}
    p['filterConfig']={'filters':[{'name':'customer_filter','field':field('Customers','customer_id'),'type':'Categorical'}]}
    slicer('Customers','customer_id',36,300)
    for i,n in enumerate(['Booked Revenue','Orders Received','Average Basket','Delay Rate','Open Orders']):card(n,36+i*276,260)
    chart('lineChart','Booked revenue history',col('Date','Month'),['Booked Revenue'],36,366,1368,220)
    grid('Orders and observed outcomes',[col('Orders',n) for n in ['order_id','ordered_at','status','revenue','units','promised_days','actual_days']],36,610,1368,230,(col('Orders','ordered_at'),'Descending'))
    for p,vs in PAGES:
        dest=OUT/'Meridian.Report/definition/pages'/p['name']
        save(dest/'page.json',p)
        for v in vs:save(dest/'visuals'/v['name']/'visual.json',v)
    save(OUT/'Meridian.Report/definition/pages/pages.json',{'$schema':schema('pagesMetadata'),'pageOrder':[p['name'] for p,_ in PAGES],'activePageName':'overview'})

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=ROOT);args=parser.parse_args()
    build_model(args.root.resolve());build_pages()
    save(OUT/'Meridian.pbip',{'version':'1.0','artifacts':[{'report':{'path':'Meridian.Report'}}],'settings':{'enableAutoRecovery':True}})
    save(OUT/'Meridian.Report/definition.pbir',{'$schema':BASE+'report/definitionProperties/2.0.0/schema.json','version':'4.0','datasetReference':{'byPath':{'path':'../Meridian.SemanticModel'}}})
    save(OUT/'Meridian.Report/definition/version.json',{'$schema':schema('versionMetadata'),'version':'2.0.0'})
    theme={'name':'Meridian.json','dataColors':['#35644C','#688DAA','#9E4335','#825910','#8E9A78','#776C98'],'background':'#FBFCF9','foreground':'#252E29','tableAccent':'#35644C','textClasses':{'title':{'fontFace':'Segoe UI','fontSize':13,'color':'#252E29'},'label':{'fontFace':'Segoe UI','fontSize':11,'color':'#526058'},'callout':{'fontFace':'Segoe UI','fontSize':28,'color':'#252E29'},'header':{'fontFace':'Segoe UI','fontSize':12,'color':'#252E29'}}}
    save(OUT/'Meridian.Report/StaticResources/RegisteredResources/Meridian.json',theme)
    save(ROOT/'docs/power-bi-theme.json',theme)
    save(OUT/'Meridian.Report/definition/report.json',{'$schema':schema('report'),'layoutOptimization':'None','themeCollection':{'customTheme':{'name':'Meridian.json','reportVersionAtImport':'5.55','type':'RegisteredResources'}},'resourcePackages':[{'name':'RegisteredResources','type':'RegisteredResources','items':[{'name':'Meridian.json','path':'Meridian.json','type':'CustomTheme'}]}]})
    print(f'Built {len(TABLES)} tables, {len(RELATIONSHIPS)} relationships, {len(MEASURES)} measures, {len(PAGES)} pages / {sum(len(v) for _,v in PAGES)} visuals.')

if __name__=='__main__':main()

