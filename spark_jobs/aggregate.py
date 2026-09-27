"""Real Spark SQL joins, aggregates and windows over curated relational CSVs.
Only the small regional/day result is collected to the driver for portable CSV output.
For large outputs use --parquet to write distributed partitions (Hadoop filesystem required).
"""
import argparse
import csv
import json
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault("SPARK_LOCAL_IP","127.0.0.1")
os.environ.setdefault("PYSPARK_PYTHON",sys.executable)
os.environ.setdefault("PYSPARK_DRIVER_PYTHON",sys.executable)
# Keep Java's Windows Unix-domain-socket path short and in a valid native directory.
if os.name=="nt":
    temp=ROOT/".local/spark-tmp";temp.mkdir(parents=True,exist_ok=True)
    os.environ["TEMP"]=str(temp);os.environ["TMP"]=str(temp)
    os.environ["JAVA_TOOL_OPTIONS"]=(os.environ.get("JAVA_TOOL_OPTIONS","")+f" -Djava.io.tmpdir={temp.as_posix()}").strip()


def run(scale=1,parquet=False):
    from pyspark.sql import SparkSession,functions as F,Window
    spark=(SparkSession.builder.master(os.getenv("SPARK_MASTER","local[2]"))
        .appName("Meridian regional operations").config("spark.ui.enabled","false")
        .config("spark.sql.shuffle.partitions","8")
        .config("spark.driver.bindAddress","127.0.0.1")
        .config("spark.sql.session.timeZone","UTC").getOrCreate())
    spark.sparkContext.setLogLevel("ERROR")
    try:
        source=ROOT/"data/curated"
        def read(name):return spark.read.option("header",True).option("inferSchema",True).csv((source/f"{name}.csv").as_posix())
        orders=read("orders");items=read("order_items");customers=read("customers")
        # Scale by independently shuffling duplicated line items; divisor reconciles original revenue.
        expanded=items.crossJoin(spark.range(scale).withColumnRenamed("id","replica")).repartition(8)
        joined=(expanded.join(orders,"order_id").join(F.broadcast(customers),"customer_id")
            .filter(F.col("status")!="cancelled")
            .withColumn("line_revenue",F.col("quantity")*F.col("unit_price")*(1-F.col("discount"))))
        daily=joined.groupBy(F.to_date("ordered_at").alias("day"),"region").agg(
            (F.sum("line_revenue")/F.lit(scale)).alias("revenue"),
            (F.sum("quantity")/F.lit(scale)).alias("units"),
            F.countDistinct("order_id").alias("orders"))
        window=Window.partitionBy("region").orderBy(F.col("day").cast("timestamp").cast("long")).rangeBetween(-6*86400,0)
        daily=daily.withColumn("revenue_7d",F.sum("revenue").over(window)).orderBy("day","region")
        out=ROOT/"data/exports";out.mkdir(parents=True,exist_ok=True)
        if parquet:daily.write.mode("overwrite").partitionBy("region").parquet((out/"spark_daily_parquet").as_posix())
        rows=daily.collect()  # at most 731 days x four regions in this demonstration
        with (out/"spark_daily_operations.csv").open("w",newline="") as handle:
            writer=csv.writer(handle);writer.writerow(daily.columns);writer.writerows([tuple(r) for r in rows])
        report={"engine":"Apache Spark","version":spark.version,"scale":scale,
            "input_item_rows":items.count(),"processed_item_rows":expanded.count(),"output_rows":len(rows),
            "revenue":sum(r.revenue for r in rows),"units":sum(r.units for r in rows),
            "strategy":"Spark CSV scans, cross join, broadcast dimension join, shuffle aggregation, temporal range window"}
        (out/"spark_report.json").write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))
        return report
    finally:spark.stop()


if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--scale",type=int,default=1);parser.add_argument("--parquet",action="store_true")
    args=parser.parse_args()
    if not 1<=args.scale<=100:parser.error("scale must be between 1 and 100")
    run(args.scale,args.parquet)
