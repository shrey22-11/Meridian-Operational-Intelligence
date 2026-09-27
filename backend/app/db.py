from contextlib import contextmanager
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError
from .config import settings


def psycopg_url(value: str):
    """Use our installed psycopg 3 driver for provider-style PostgreSQL URLs.

    SQLAlchemy 2.0 otherwise defaults a bare postgresql:// URL to psycopg2.
    Change only the driver; preserve credentials, pooler host and SSL parameters.
    """
    try:
        url = make_url(value)
    except (ArgumentError, ValueError, TypeError):
        raise ValueError("DATABASE_URL must be a valid PostgreSQL connection URL.") from None
    if url.drivername in ("postgres", "postgresql"):
        return url.set(drivername="postgresql+psycopg")
    if url.drivername != "postgresql+psycopg":
        raise ValueError("DATABASE_URL must use postgresql+psycopg:// (psycopg 3).")
    return url


engine = create_engine(psycopg_url(settings.database_url), pool_pre_ping=True, pool_size=5,
                       connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"})


@contextmanager
def read_connection():
    stage = "connect"
    try:
        with engine.connect() as conn:
            stage = "begin"
            with conn.begin():
                stage = "read_only"
                conn.execute(text("SET TRANSACTION READ ONLY"))
                stage = "query"
                yield conn
    except SQLAlchemyError as exc:
        exc.meridian_db_stage = stage
        raise


def frame(sql: str, params=None) -> pd.DataFrame:
    with read_connection() as conn:
        return pd.read_sql(text(sql), conn, params=params or {})


def records(sql: str, params=None):
    df = frame(sql, params)
    # JSON encoder through pandas handles numpy, dates, Decimal and NaN consistently.
    import json
    return json.loads(df.to_json(orient="records", date_format="iso"))
