CREATE TABLE IF NOT EXISTS suppliers (
 supplier_id INTEGER PRIMARY KEY,
 supplier_name TEXT NOT NULL,
 lead_time_days INTEGER NOT NULL CHECK (lead_time_days BETWEEN 1 AND 30)
);
CREATE TABLE IF NOT EXISTS customers (
 customer_id INTEGER PRIMARY KEY,
 region TEXT NOT NULL CHECK (region IN ('North','South','East','West')),
 channel TEXT NOT NULL CHECK (channel IN ('Retail','Business')),
 joined_at DATE NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
 product_id INTEGER PRIMARY KEY,
 supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
 product_name TEXT NOT NULL,
 category TEXT NOT NULL,
 unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost > 0),
 list_price NUMERIC(12,2) NOT NULL CHECK (list_price >= unit_cost)
);
CREATE TABLE IF NOT EXISTS orders (
 order_id INTEGER PRIMARY KEY,
 customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
 ordered_at DATE NOT NULL,
 promised_days INTEGER NOT NULL CHECK (promised_days BETWEEN 1 AND 14),
 actual_days INTEGER CHECK (actual_days BETWEEN 1 AND 60),
 warehouse_load DOUBLE PRECISION NOT NULL CHECK (warehouse_load BETWEEN 0 AND 2),
 distance_km DOUBLE PRECISION NOT NULL CHECK (distance_km BETWEEN 1 AND 5000),
 expedited BOOLEAN NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('delivered','open','cancelled')),
 CHECK ((status = 'delivered' AND actual_days IS NOT NULL) OR (status <> 'delivered' AND actual_days IS NULL))
);
CREATE TABLE IF NOT EXISTS order_items (
 order_item_id INTEGER PRIMARY KEY,
 order_id INTEGER NOT NULL REFERENCES orders(order_id),
 product_id INTEGER NOT NULL REFERENCES products(product_id),
 quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
 unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price > 0),
 discount DOUBLE PRECISION NOT NULL CHECK (discount BETWEEN 0 AND 0.6)
);
CREATE INDEX IF NOT EXISTS ix_orders_date ON orders(ordered_at);
CREATE INDEX IF NOT EXISTS ix_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS ix_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS ix_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS ix_products_supplier ON products(supplier_id);
CREATE OR REPLACE VIEW order_facts AS
SELECT o.*, c.region, c.channel,
 SUM(i.quantity * i.unit_price * (1-i.discount))::double precision AS revenue,
 SUM(i.quantity * (i.unit_price * (1-i.discount)-p.unit_cost))::double precision AS gross_margin,
 SUM(i.quantity)::integer AS units,
 COUNT(*)::integer AS line_count,
 AVG(s.lead_time_days)::double precision AS supplier_lead_days,
 CASE WHEN o.status='delivered' THEN (o.actual_days>o.promised_days)::integer ELSE NULL END AS late
FROM orders o JOIN customers c USING(customer_id)
JOIN order_items i USING(order_id) JOIN products p USING(product_id)
JOIN suppliers s USING(supplier_id)
GROUP BY o.order_id,c.region,c.channel;
CREATE OR REPLACE VIEW daily_operations AS
SELECT ordered_at AS day, region, COUNT(*) AS orders,
 SUM(revenue) FILTER (WHERE status <> 'cancelled') AS revenue,
 SUM(gross_margin) FILTER (WHERE status <> 'cancelled') AS gross_margin,
 SUM(units) FILTER (WHERE status <> 'cancelled') AS units,
 AVG(late)::double precision AS late_rate,
 AVG(warehouse_load)::double precision AS warehouse_load
FROM order_facts GROUP BY ordered_at,region;
CREATE TABLE IF NOT EXISTS pipeline_runs (
 run_id TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 report JSONB NOT NULL
);
