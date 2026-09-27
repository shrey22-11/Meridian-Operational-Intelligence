import logging
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from backend.app import db
from backend.app.db_diagnostics import database_diagnostic
from backend.app.main import app


class DriverError(Exception):
    def __init__(self, message, state=None):
        super().__init__(message)
        self.sqlstate = state


@pytest.mark.parametrize("message,state,category", [
    ('connection failed: FATAL: unsupported startup parameter in options: statement_timeout', '08P01', 'startup_parameter'),
    ('password authentication failed for user "private-user"', '28P01', 'authentication'),
    ('SSL error: certificate verify failed', None, 'ssl'),
    ('could not translate host name "private-host"', None, 'dns'),
    ('connection failed: timeout expired', None, 'connection_timeout'),
    ('database "private-db" does not exist', '3D000', 'database'),
    ('relation "private-table" does not exist', '42P01', 'missing_relation'),
    ('syntax error at or near "private-query"', '42601', 'query_syntax'),
    ('operation forbidden', '25006', 'read_only_transaction'),
    ('private arbitrary unrecognized secret', None, 'unknown'),
])
def test_safe_classification(message, state, category):
    error = OperationalError('private SQL', {'password': 'private-param'}, DriverError(message, state))
    info = database_diagnostic(error)
    assert info['category'] == category and info['sqlstate'] == state
    assert 'private' not in str(info)


def test_api_logs_diagnosis_without_any_exception_payload(monkeypatch, caplog):
    secret = 'not-a-real-secret-for-test'
    error = OperationalError('SELECT '+secret, {'key': secret}, DriverError(
        'unsupported startup parameter in options: statement_timeout\n'
        'postgresql://user:'+secret+'@private-host/db?apikey='+secret+' password='+secret, '08P01'))
    error.meridian_db_stage = 'connect'
    def fail(*args, **kwargs):
        raise error
    monkeypatch.setattr('backend.app.main.records', fail)
    with caplog.at_level(logging.ERROR, logger='meridian'):
        response = TestClient(app).get('/api/health')
    assert response.status_code == 503
    assert 'statement_timeout' in caplog.text and '08P01' in caplog.text and 'connect' in caplog.text
    for forbidden in [secret, 'postgresql://', 'private-host', 'SELECT', 'apikey']:
        assert forbidden not in caplog.text and forbidden not in response.text
    assert all(record.exc_info is None for record in caplog.records)
    assert 'statement_timeout' not in response.text


@pytest.mark.parametrize('failure_stage', ['connect', 'begin', 'read_only', 'query'])
def test_connection_failure_stage_is_preserved(monkeypatch, failure_stage):
    error = OperationalError('', {}, DriverError('test error'))
    class Connection:
        @contextmanager
        def begin(self):
            if failure_stage == 'begin': raise error
            yield
        def execute(self, statement):
            if failure_stage == 'read_only': raise error
    class Engine:
        @contextmanager
        def connect(self):
            if failure_stage == 'connect': raise error
            yield Connection()
    monkeypatch.setattr(db, 'engine', Engine())
    with pytest.raises(OperationalError) as caught:
        with db.read_connection():
            if failure_stage == 'query': raise error
    assert caught.value is error
    assert database_diagnostic(error)['stage'] == failure_stage


def test_untrusted_diagnostic_attributes_cannot_leak_secrets():
    error = OperationalError('', {}, DriverError('private token', 'secret-not-sqlstate'))
    error.meridian_db_stage = 'private-token'
    assert database_diagnostic(error)['sqlstate'] is None
    assert database_diagnostic(error)['stage'] == 'unknown'
