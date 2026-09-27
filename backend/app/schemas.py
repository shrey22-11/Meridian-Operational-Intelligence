from typing import Literal
from pydantic import BaseModel,Field,ConfigDict


class OrderScenario(BaseModel):
    model_config=ConfigDict(extra="forbid")
    warehouse_load:float=Field(ge=.15,le=1.4)
    distance_km:float=Field(ge=10,le=2400)
    promised_days:int=Field(ge=1,le=14)
    supplier_lead_days:float=Field(ge=1,le=30)
    units:int=Field(ge=1,le=400)
    revenue:float=Field(gt=0,le=10000000)
    region:Literal["North","South","East","West"]
    channel:Literal["Retail","Business"]
    expedited:bool


class HistoryMessage(BaseModel):
    role:Literal["user","assistant"]
    content:str=Field(min_length=1,max_length=6000)


class ChatRequest(BaseModel):
    message:str=Field(min_length=3,max_length=2000)
    history:list[HistoryMessage]=Field(default_factory=list,max_length=8)
