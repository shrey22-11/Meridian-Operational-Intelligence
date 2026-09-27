from datetime import date
from typing import Literal
from pydantic import BaseModel,Field,ConfigDict
from analytics import service
from ai.retrieval import retrieve
from ml.service import artifact_records,model_report


class StrictInput(BaseModel):
    model_config=ConfigDict(extra="forbid")


class Empty(StrictInput):
    pass


class MetricsInput(StrictInput):
    start_date: date|None=Field(description="Required field. Use first calendar day for a requested month, e.g. 2025-12-01. Null only when no period is requested.")
    end_date: date|None=Field(description="Required field. Use last calendar day for a requested month, e.g. 2025-12-31. Null only when no period is requested.")
    region: Literal["North","South","East","West"]|None=None


class LimitInput(StrictInput):
    limit:int=Field(default=10,ge=1,le=25)
    region:Literal["North","South","East","West"]|None=None


class PolicyInput(StrictInput):
    query:str=Field(min_length=3,max_length=400)


class CustomerInput(StrictInput):
    customer_id:int=Field(gt=0)


REGISTRY={
    "get_business_metrics":("Calculate exact revenue, order counts and delay rates. ALWAYS provide start_date and end_date. For December 2025 use 2025-12-01 to 2025-12-31. Both null means last 30 days.",MetricsInput,service.metrics),
    "get_revenue_bridge":("Explain revenue movement in the last complete dataset month by regional volume and basket effects.",Empty,service.revenue_bridge),
    "get_anomalies":("Get anomalous daily regional operations after the reference period.",LimitInput,service.anomalies),
    "get_open_order_risks":("Get open orders ranked by predicted delivery delay probability. Not customer churn.",LimitInput,service.risks),
    "get_segments":("Get current customer RFM segment summaries.",Empty,service.segments),
    "get_customer_details":("Get actual order history summary for a fictional customer identifier.",CustomerInput,service.customer_detail),
    "get_forecast":("Get the next 14 days of demand predictions, not historical actuals.",Empty,lambda:service.json_records(artifact_records("forecast"))),
    "get_product_watchlist":("Get products with elevated observed delay rates in the last 30 dataset days; not model-based anomalies.",Empty,service.product_watchlist),
    "search_policies":("Retrieve cited business definitions, operating procedures and model limitations.",PolicyInput,retrieve),
}


def schemas():
    result=[]
    for name,(description,model,_) in REGISTRY.items():
        schema=model.model_json_schema()
        # Strict tools require every property present; optional values are nullable.
        schema["required"]=list(schema.get("properties",{}))
        for prop in schema.get("properties",{}).values():
            prop.pop("default",None)
        result.append({"type":"function","function":{"name":name,"description":description,"parameters":schema}})
    return result


def execute(name,arguments):
    if name not in REGISTRY:
        raise ValueError("Tool is not allowed.")
    _,model,fn=REGISTRY[name]
    params=model.model_validate(arguments).model_dump()
    return fn(**params)
