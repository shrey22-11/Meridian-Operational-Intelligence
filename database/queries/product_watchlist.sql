WITH product_performance AS (
 SELECT p.product_id,p.product_name,p.category,s.supplier_name,
 COUNT(DISTINCT o.order_id) AS orders,
 SUM(i.quantity*i.unit_price*(1-i.discount)) AS revenue,
 AVG((o.actual_days>o.promised_days)::int)::double precision AS late_rate
 FROM order_items i JOIN orders o USING(order_id)
 JOIN products p USING(product_id) JOIN suppliers s USING(supplier_id)
 WHERE o.status='delivered' AND o.ordered_at >= :start_date AND o.ordered_at <= :end_date
 GROUP BY 1,2,3,4 HAVING COUNT(DISTINCT o.order_id)>=20
)
SELECT *,DENSE_RANK() OVER (ORDER BY late_rate DESC) AS risk_rank,
 CASE WHEN late_rate>(SELECT AVG(late_rate) FROM product_performance)
 THEN 'Above portfolio average' ELSE 'Within portfolio average' END AS assessment
FROM product_performance ORDER BY late_rate DESC LIMIT 20;
