import pandas as pd
from pipeline.clean import clean_orders,clean_tables


def sample():
    return pd.DataFrame([{"order_id":1,"customer_id":1,"ordered_at":"2025-01-01","status":" DELIVERED ",
        "warehouse_load":None,"distance_km":"200","promised_days":6,"actual_days":7,"expedited":False}])


def test_normalization_missing_and_duplicate_audit():
    raw=pd.concat([sample(),sample()],ignore_index=True)
    cleaned,rejected,report=clean_orders(raw)
    assert len(cleaned)==1 and rejected.empty
    assert cleaned.iloc[0].status=="delivered"
    assert cleaned.iloc[0].warehouse_load==.75
    assert report["duplicate_orders_removed"]==1
    assert report["load_defaulted_to_075"]==1


def test_invalid_dates_and_outcomes_quarantined_without_mutating_input():
    raw=sample();raw.loc[0,"ordered_at"]="nonsense"
    cleaned,rejected,_=clean_orders(raw)
    assert cleaned.empty and len(rejected)==1
    assert raw.loc[0,"ordered_at"]=="nonsense"
    raw=sample();raw.loc[0,"status"]="open"
    assert clean_orders(raw)[0].empty


def test_large_valid_distance_preserved():
    raw=sample();raw.loc[0,"distance_km"]=2400
    assert len(clean_orders(raw)[0])==1


def test_orders_without_valid_lines_have_explicit_quarantine_reason():
    tables={"orders":sample(),"customers":pd.DataFrame([{"customer_id":1,"region":" north ","joined_at":"2023-01-01"}]),
        "products":pd.DataFrame([{"product_id":1}]),
        "order_items":pd.DataFrame([{"order_item_id":1,"order_id":1,"product_id":1,"quantity":-1,"unit_price":100,"discount":0}])}
    cleaned,quarantine,report=clean_tables(tables)
    assert cleaned["orders"].empty
    assert quarantine["orders"].iloc[0].reason=="No valid line items remain"
    assert report["orders_without_valid_items_quarantined"]==1
