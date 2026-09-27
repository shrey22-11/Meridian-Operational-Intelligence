import pytest
from sqlalchemy import event, text
from backend.app import db


def test_connection_does_not_send_statement_timeout_startup_option():
    captured = {}
    class Captured(Exception):
        pass
    def inspect_connect(dialect, record, args, kwargs):
        captured.update(kwargs)
        raise Captured()
    db.engine.dispose()
    event.listen(db.engine, 'do_connect', inspect_connect)
    try:
        with pytest.raises(Captured):
            db.engine.connect()
    finally:
        event.remove(db.engine, 'do_connect', inspect_connect)
    assert captured['connect_timeout'] == 5
    assert 'options' not in captured
    assert 'statement_timeout' not in captured


@pytest.mark.integration
@pytest.mark.parametrize('rollback', [False, True])
def test_read_transaction_timeout_is_enforced_without_session_leak(rollback):
    with db.engine.connect() as connection:
        baseline = connection.scalar(text('SHOW statement_timeout'))
    class Rollback(Exception):
        pass
    try:
        with db.read_connection() as connection:
            assert connection.scalar(text('SHOW statement_timeout')) == '15s'
            assert connection.scalar(text('SHOW transaction_read_only')) == 'on'
            assert connection.scalar(text('SELECT 1')) == 1
            if rollback:
                raise Rollback()
    except Rollback:
        pass
    with db.engine.connect() as connection:
        assert connection.scalar(text('SHOW statement_timeout')) == baseline
