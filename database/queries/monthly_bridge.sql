WITH monthly AS (
 SELECT date_trunc('month', ordered_at)::date AS month,region,
 COUNT(*) AS orders,SUM(revenue) AS revenue,AVG(revenue) AS average_order_value
 FROM order_facts WHERE status <> 'cancelled' GROUP BY 1,2
), compared AS (
 SELECT *,LAG(revenue) OVER (PARTITION BY region ORDER BY month) AS previous_revenue,
 LAG(orders) OVER (PARTITION BY region ORDER BY month) AS previous_orders,
 LAG(average_order_value) OVER (PARTITION BY region ORDER BY month) AS previous_aov
 FROM monthly
)
SELECT *,revenue-previous_revenue AS revenue_change,
 (orders-previous_orders)*previous_aov AS volume_effect,
 orders*(average_order_value-previous_aov) AS basket_effect
FROM compared ORDER BY month DESC,region;
