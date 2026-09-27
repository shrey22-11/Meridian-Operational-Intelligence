import pandas as pd


def clean_orders(raw):
    df = raw.copy()
    duplicate_count = int(df.duplicated("order_id").sum())
    df = df.drop_duplicates("order_id", keep="first")
    df["ordered_at"] = pd.to_datetime(df.ordered_at, errors="coerce")
    df["status"] = df.status.astype(str).str.strip().str.lower()
    for col in ["warehouse_load","distance_km","promised_days","actual_days"]:
        df[col] = pd.to_numeric(df[col],errors="coerce")
    missing = int(df.warehouse_load.isna().sum())
    # Explicit business fallback, not a statistic learned from future observations.
    df["warehouse_load"] = df.warehouse_load.fillna(.75)
    valid = (df.ordered_at.notna() & df.distance_km.between(1,5000)
             & df.warehouse_load.between(0,2) & df.promised_days.between(1,14)
             & df.status.isin(["delivered","open","cancelled"])
             & ((df.status.eq("delivered") & df.actual_days.between(1,60))
                | (~df.status.eq("delivered") & df.actual_days.isna())))
    rejected = df.loc[~valid].copy()
    rejected["reason"] = "Invalid date, distance, load, promise, status or outcome"
    return df.loc[valid].copy(), rejected, {"duplicate_orders_removed":duplicate_count,
        "load_defaulted_to_075":missing,"invalid_orders_quarantined":len(rejected)}


def clean_tables(tables):
    orders, rejected, report = clean_orders(tables["orders"])
    customers = tables["customers"].drop_duplicates("customer_id").copy()
    customers["region"] = customers.region.str.strip().str.title()
    customers["joined_at"] = pd.to_datetime(customers.joined_at)
    items = tables["order_items"].drop_duplicates("order_item_id").copy()
    valid = (items.quantity.between(1,100) & items.unit_price.gt(0)
             & items.discount.between(0,.6) & items.order_id.isin(orders.order_id)
             & items.product_id.isin(tables["products"].product_id))
    rejected_items = items.loc[~valid].copy()
    rejected_items["reason"] = "Invalid item value or quarantined parent order"
    items = items.loc[valid].copy()
    has_items = orders.order_id.isin(items.order_id)
    empty_orders = orders.loc[~has_items].copy()
    empty_orders["reason"] = "No valid line items remain"
    rejected = pd.concat([rejected,empty_orders],ignore_index=True)
    orders = orders.loc[has_items].copy()
    report["orders_without_valid_items_quarantined"] = len(empty_orders)
    report.update({"items_quarantined":len(rejected_items), "loaded_orders":len(orders),
                   "loaded_items":len(items)})
    return {**tables,"customers":customers,"orders":orders,"order_items":items}, {
        "orders":rejected,"order_items":rejected_items}, report
