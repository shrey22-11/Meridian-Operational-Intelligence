from datetime import date
import json
import logging
from pathlib import Path
from typing import Literal
import httpx
from fastapi import FastAPI,Query,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse,FileResponse
from sqlalchemy.exc import SQLAlchemyError
from backend.app.config import ROOT,settings
from backend.app.db import records
from backend.app.schemas import OrderScenario,ChatRequest
from analytics import service
from ml.service import predict_order,model_report,artifact_records
from ai.service import chat

logger=logging.getLogger("meridian")
app=FastAPI(title="Meridian Operational Intelligence",version="1.0.0",
    description="Local synthetic retail operations: SQL evidence, ML and a grounded AI analyst.")
app.add_middleware(CORSMiddleware,allow_origins=settings.allowed_origins.split(","),
                   allow_methods=["GET","POST"],allow_headers=["Content-Type"])


@app.exception_handler(SQLAlchemyError)
async def database_error(request:Request,exc:SQLAlchemyError):
    logger.error("Database operation failed: %s",type(exc).__name__)
    return JSONResponse(status_code=503,content={"detail":"Database unavailable or uninitialized. Start PostgreSQL and run the data pipeline."})


@app.exception_handler(FileNotFoundError)
async def artifact_error(request:Request,exc:FileNotFoundError):
    return JSONResponse(status_code=503,content={"detail":"Required model/report is missing. Run python -m scripts.bootstrap."})


@app.exception_handler(ValueError)
async def input_error(request:Request,exc:ValueError):
    return JSONResponse(status_code=400,content={"detail":str(exc)[:300]})


@app.exception_handler(Exception)
async def unexpected_error(request:Request,exc:Exception):
    logger.exception("Request failed")
    return JSONResponse(status_code=500,content={"detail":"An internal error occurred. See the local server log for details."})


@app.get("/api/health")
def health():
    records("SELECT 1 AS ready")
    return {"status":"ok","database":"connected","models_ready":(ROOT/"artifacts/model_report.json").exists(),
        "knowledge_ready":(ROOT/"artifacts/knowledge.joblib").exists(),"ai_provider":settings.ai_provider,
        "ai_model":settings.ollama_model if settings.ai_provider=="ollama" else settings.openai_model if settings.ai_provider=="openai" else settings.groq_model if settings.ai_provider=="groq" else None,
        "source":"synthetic","snapshot":"2025-12-31"}


@app.get("/api/metrics")
def metrics(start_date:date|None=None,end_date:date|None=None,region:Literal["North","South","East","West"]|None=None):
    return service.metrics(start_date,end_date,region)


@app.get("/api/analytics")
def analytics(start_date:date|None=None,end_date:date|None=None,region:Literal["North","South","East","West"]|None=None):
    return service.analytics(start_date,end_date,region)


@app.get("/api/revenue-bridge")
def bridge():return service.revenue_bridge()


@app.get("/api/products")
def products(start_date:date|None=None,end_date:date|None=None):return service.product_watchlist(start_date,end_date)


@app.get("/api/predictions")
def predictions(limit:int=Query(25,ge=1,le=100),region:Literal["North","South","East","West"]|None=None):return service.risks(limit,region)


@app.post("/api/predictions/scenario")
def scenario(request:OrderScenario):return predict_order(request.model_dump())


@app.get("/api/models")
def models():return model_report()


@app.get("/api/forecast")
def forecast():return service.json_records(artifact_records("forecast"))


@app.get("/api/anomalies")
def anomalies(limit:int=Query(25,ge=1,le=100),region:Literal["North","South","East","West"]|None=None):return service.anomalies(limit,region)


@app.get("/api/segments")
def segments():return service.segments()


@app.get("/api/statistics")
def statistics():return json.loads((ROOT/"reports/statistics.json").read_text())


@app.get("/api/quality")
def quality():
    return records("SELECT completed_at,report FROM pipeline_runs ORDER BY completed_at DESC LIMIT 1")


@app.get("/api/exports/{dataset}")
def download(dataset:Literal["daily_operations","order_facts","forecast","segments","anomalies","scored_orders"]):
    path=ROOT/f"data/exports/{dataset}.csv"
    if not path.exists():raise FileNotFoundError()
    return FileResponse(path,media_type="text/csv",filename=path.name)


@app.post("/api/ai/chat")
def ai_chat(request:ChatRequest):
    try:
        return chat(request.message,[x.model_dump() for x in request.history])
    except (httpx.HTTPError,RuntimeError) as exc:
        logger.warning("AI provider failed: %s",type(exc).__name__)
        return JSONResponse(status_code=503,content={"detail":"AI provider unavailable or tool budget exceeded. Check Ollama/model or API configuration; the dashboard remains available."})
    except Exception as exc:
        # Keep upstream SDK error details/credentials out of API responses.
        if exc.__class__.__module__.startswith("openai"):
            return JSONResponse(status_code=503,content={"detail":"OpenAI request failed. Check the configured model, key and account quota."})
        raise
