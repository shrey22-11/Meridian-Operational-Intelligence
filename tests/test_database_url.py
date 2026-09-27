"""Regression for Vercel import failures caused by the default psycopg2 dialect."""
import os
import subprocess
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

from backend.app.config import Settings
from backend.app.db import psycopg_url


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_provider_url_uses_psycopg3_preserving_connection(scheme):
    original = make_url(scheme + "://user:p%40ss%3Aword@ep-demo-pooler.example:5432/neondb?sslmode=require&channel_binding=require")
    normalized = psycopg_url(original.render_as_string(hide_password=False))
    assert normalized == original.set(drivername="postgresql+psycopg")
    assert normalized.password == "p@ss:word"
    engine = create_engine(normalized)
    try:
        assert engine.dialect.driver == "psycopg"
        assert engine.dialect.dbapi.__name__ == "psycopg"
    finally:
        engine.dispose()


@pytest.mark.parametrize("value", [
    "DATABASE_URL=postgresql://user:private-password@host/db",
    "'postgresql://user:private-password@host/db'",
    "postgresql+psycopg2://user:private-password@host/db",
    "sqlite:///private-password",
])
def test_invalid_configuration_has_secret_free_error(value):
    with pytest.raises(ValueError) as error:
        psycopg_url(value)
    assert "private-password" not in str(error.value)
    assert "DATABASE_URL" in str(error.value)


def test_process_environment_overrides_dotenv(monkeypatch, tmp_path):
    dotenv = tmp_path / "example.env"
    dotenv.write_text("DATABASE_URL=postgresql+psycopg://local@localhost/local\n")
    monkeypatch.setenv("DATABASE_URL", "postgresql://preview@ep-demo-pooler.example/preview")
    assert Settings(_env_file=dotenv).database_url == os.environ["DATABASE_URL"]


@pytest.mark.parametrize("scheme", ["postgresql", "postgresql+psycopg"])
def test_fresh_import_and_openapi_without_database_connection(scheme):
    env = {**os.environ, "DATABASE_URL": scheme + "://test:test@127.0.0.1:1/unreachable", "AI_PROVIDER": "evidence"}
    # Port 1 deliberately has no database. /openapi.json must require imports only.
    code = """
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import engine
assert engine.dialect.driver == 'psycopg'
response = TestClient(app).get('/openapi.json')
assert response.status_code == 200
assert '/api/health' in response.json()['paths']
print('Fresh import and OpenAPI passed')
"""
    result = subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
