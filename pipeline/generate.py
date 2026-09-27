"""Reproducible fictional Indian omnichannel retailer; no real customer data."""
from pathlib import Path
import numpy as np
import pandas as pd
from backend.app.config import ROOT


def generate(n_orders=65000, seed=42, destination=None):
    if n_orders < 3000:
        raise ValueError("Use at least 3000 orders for a meaningful timeline.")
    rng = np.random.default_rng(seed)
    out = Path(destination or ROOT / "data/raw")
    out.mkdir(parents=True, exist_ok=True)
    suppliers = pd.DataFrame({"supplier_id": range(1, 13),
        "supplier_name": [f"Supply Partner {i:02}" for i in range(1, 13)],
        "lead_time_days": rng.integers(2, 10, 12)})
    customers = pd.DataFrame({"customer_id": range(1, 5001),
        "region": rng.choice(["North", "South", "East", "West"], 5000, p=[.3,.28,.18,.24]),
        "channel": rng.choice(["Retail", "Business"], 5000, p=[.8,.2]),
        "joined_at": pd.Timestamp("2023-01-01") + pd.to_timedelta(rng.integers(0, 365, 5000), unit="D")})
    categories = np.array(["Electronics", "Home", "Office", "Fitness", "Personal care"])
    costs = rng.uniform(150, 3500, 120).round(2)
    products = pd.DataFrame({"product_id": range(1, 121), "supplier_id": rng.integers(1, 13, 120),
        "product_name": [f"{categories[i % 5]} {i + 1:03}" for i in range(120)],
        "category": [categories[i % 5] for i in range(120)], "unit_cost": costs,
        "list_price": (costs * rng.uniform(1.25, 1.8, 120)).round(2)})
    dates = pd.date_range("2024-01-01", "2025-12-31")
    weights = 1 + .18*np.sin(np.arange(len(dates))*2*np.pi/365) + .22*(dates.dayofweek>=5)
    weights = np.asarray(weights) * np.where(dates.month.isin([10,11]), 1.35, 1)
    ordered = pd.DatetimeIndex(np.sort(rng.choice(dates, n_orders, p=weights/weights.sum())))
    customer_ids = rng.integers(1, 5001, n_orders)
    regions = customers.set_index("customer_id").loc[customer_ids, "region"].to_numpy()
    # December North acquisition slowdown, represented in order mix.
    mask = (ordered >= "2025-12-01") & (regions == "North") & (rng.random(n_orders)<.45)
    customer_ids[mask] = rng.choice(customers.loc[customers.region == "South", "customer_id"], mask.sum())
    load = np.clip(rng.normal(.72, .19, n_orders) + .18*ordered.month.isin([10,11]), .15, 1.4)
    distance = np.clip(rng.lognormal(5.8, .65, n_orders), 10, 2400).round(1)
    expedited = rng.random(n_orders) < .2
    promised = np.where(expedited, 3, 6)
    orders = pd.DataFrame({"order_id": range(1,n_orders+1), "customer_id": customer_ids,
        "ordered_at": ordered, "promised_days": promised, "warehouse_load": load,
        "distance_km": distance, "expedited": expedited})
    counts = rng.integers(1, 5, n_orders)
    order_ids = np.repeat(orders.order_id.to_numpy(), counts)
    product_ids = rng.integers(1,121,len(order_ids))
    prices = products.set_index("product_id").loc[product_ids,"list_price"].to_numpy()
    qty = rng.choice([1,2,3,4,8,20], len(order_ids), p=[.50,.25,.12,.08,.045,.005])
    discount = rng.choice([0,.05,.1,.15,.25],len(order_ids),p=[.4,.2,.2,.15,.05])
    items = pd.DataFrame({"order_item_id": range(1,len(order_ids)+1), "order_id": order_ids,
        "product_id": product_ids, "quantity": qty, "unit_price": prices, "discount": discount})
    leads = products.merge(suppliers,on="supplier_id").set_index("product_id").lead_time_days
    avg_lead = pd.Series(leads.loc[product_ids].to_numpy()).groupby(order_ids).mean().to_numpy()
    units = items.groupby("order_id").quantity.sum().to_numpy()
    noise = rng.normal(0, 1.3, n_orders)
    duration = np.clip(np.rint(1.1 + distance/430 + 3.5*load**2 + .18*avg_lead
                              + .025*units - 1.6*expedited + noise), 1, 40).astype(int)
    cancelled = rng.random(n_orders)<.025
    complete = ordered + pd.to_timedelta(duration,unit="D") <= pd.Timestamp("2025-12-31")
    orders["status"] = np.where(cancelled, "cancelled", np.where(complete,"delivered","open"))
    orders["actual_days"] = np.where((orders.status=="delivered"),duration,np.nan)
    # Deliberate upstream defects. Keep original raw files for a reproducible audit.
    orders.loc[rng.choice(n_orders,130,False),"warehouse_load"] = np.nan
    orders.loc[rng.choice(n_orders,40,False),"distance_km"] = -12
    orders["ordered_at"] = orders.ordered_at.dt.strftime("%Y-%m-%d")
    orders.loc[rng.choice(n_orders,20,False),"ordered_at"] = "bad-date"
    orders["status"] = orders.status.str.upper() + " "
    orders = pd.concat([orders,orders.sample(100,random_state=seed)],ignore_index=True)
    customers["region"] = " " + customers.region.str.lower() + " "
    items.loc[rng.choice(len(items),60,False),"quantity"] = -1
    for name, df in {"suppliers":suppliers,"customers":customers,"products":products,
                     "orders":orders,"order_items":items}.items():
        df.to_csv(out/f"{name}.csv",index=False)
    return {"orders":n_orders,"items":len(items),"seed":seed,"source":"synthetic"}
