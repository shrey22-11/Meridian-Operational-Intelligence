"""Fail-closed database diagnostics: never serialize raw exception text or SQL.

Driver messages may include credentials, SQL parameters or arbitrary server text.
Only recognized constant excerpts are emitted; unknown messages remain private.
"""
import re


def database_diagnostic(exc):
    original = getattr(exc, "orig", None)
    text = str(original or "").lower()
    state = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
    state = state if isinstance(state, str) and re.fullmatch(r"[0-9A-Z]{5}", state) else None
    stage = getattr(exc, "meridian_db_stage", "unknown")
    if stage not in {"connect", "begin", "read_only", "query"}:
        stage = "unknown"
    category = "unknown"
    message = "Unrecognized driver message withheld to protect credentials."
    if "unsupported startup parameter" in text:
        category = "startup_parameter"
        message = "unsupported startup parameter"
        if re.search(r"unsupported startup parameter(?: in options)?:\s*[\"']?statement_timeout\b", text):
            message = "unsupported startup parameter: statement_timeout"
        elif re.search(r"unsupported startup parameter:\s*[\"']?options\b", text):
            message = "unsupported startup parameter: options"
    else:
        # All output strings are constants. No matched user/server values are logged.
        patterns = [
            ("password authentication failed", "authentication", "password authentication failed"),
            ("no password supplied", "authentication", "no password supplied"),
            ("authentication failed", "authentication", "authentication failed"),
            ("certificate verify failed", "ssl", "certificate verify failed"),
            ("ssl connection is required", "ssl", "SSL connection is required"),
            ("server does not support ssl", "ssl", "server does not support SSL"),
            ("channel binding", "ssl", "channel binding error"),
            ("could not translate host name", "dns", "could not translate host name"),
            ("name or service not known", "dns", "name or service not known"),
            ("connection refused", "network", "connection refused"),
            ("timeout expired", "connection_timeout", "connection timeout expired"),
            ("connection timed out", "connection_timeout", "connection timed out"),
            ("too many connections", "connection_limit", "too many connections"),
            ("remaining connection slots", "connection_limit", "remaining connection slots are reserved"),
            ("endpoint is disabled", "endpoint_unavailable", "endpoint is disabled"),
            ("compute time quota", "endpoint_unavailable", "compute time quota exceeded"),
            ("statement timeout", "query_timeout", "statement timeout"),
            ("server closed the connection unexpectedly", "connection_lost", "server closed the connection unexpectedly"),
            ("ssl connection has been closed unexpectedly", "connection_lost", "SSL connection has been closed unexpectedly"),
            ("no pg_hba.conf entry", "access_policy", "no pg_hba.conf entry"),
        ]
        for needle, kind, safe_message in patterns:
            if needle in text:
                category, message = kind, safe_message
                break
        else:
            states = {
                "28P01": ("authentication", "invalid password"),
                "28000": ("authentication", "invalid authorization specification"),
                "3D000": ("database", "database does not exist"),
                "3F000": ("schema", "invalid schema name"),
                "42P01": ("missing_relation", "relation does not exist"),
                "42703": ("missing_column", "column does not exist"),
                "42501": ("permission", "insufficient privilege"),
                "42601": ("query_syntax", "syntax error"),
                "25006": ("read_only_transaction", "operation not allowed in read-only transaction"),
                "25P02": ("transaction", "transaction is aborted"),
                "26000": ("prepared_statement", "invalid prepared statement name"),
                "42P05": ("prepared_statement", "duplicate prepared statement"),
                "53300": ("connection_limit", "too many connections"),
                "57P03": ("endpoint_unavailable", "database cannot accept connections now"),
                "08006": ("connection_lost", "connection failure"),
                "08P01": ("protocol", "protocol violation"),
            }
            category, message = states.get(state, (category, message))
    return {"stage": stage, "sqlstate": state, "category": category, "driver_message": message}
