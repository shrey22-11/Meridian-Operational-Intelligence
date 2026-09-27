FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements-spark.txt .
RUN pip install --no-cache-dir -r requirements-spark.txt
COPY spark_jobs spark_jobs
CMD ["python","spark_jobs/aggregate.py","--scale","10","--parquet"]
