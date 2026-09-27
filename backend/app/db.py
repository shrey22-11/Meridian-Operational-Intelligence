from contextlib import contextmanager
import pandas as pd
from sqlalchemy import create_engine, text
from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=5,
                       connect_args={"connect_timeout": 5, "options": "-c statement_timeout=15000"})


@contextmanager
def read_connection():
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SET TRANSACTION READ ONLY"))
            yield conn


def frame(sql: str, params=None) -> pd.DataFrame:
    with read_connection() as conn:
        return pd.read_sql(text(sql), conn, params=params or {})


def records(sql: str, params=None):
    df = frame(sql, params)
    # JSON encoder through pandas handles numpy, dates, Decimal and NaN consistently.
    import json
    return json.loads(df.to_json(orient="records", date_format="iso"))
