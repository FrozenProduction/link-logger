"""Wire-format checks for the Turso backend.

The HTTP API cannot be exercised without a database, so the request body and
the response decoding are checked against a canned exchange here. This is what
makes a deploy-time failure a small config problem instead of a rewrite.

Run: pytest -q backend/fastapi/test_store_wire.py
"""

import io
import json

import pytest

from db import StoreError, TursoStore, _pipeline_url


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def install_fake(monkeypatch, payload: dict, captured: list):
    def fake_urlopen(request, timeout=None):
        captured.append(request)
        return FakeResponse(json.dumps(payload).encode())

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)


def test_libsql_url_becomes_the_https_pipeline():
    assert _pipeline_url("libsql://link-logger-frozen.turso.io") == (
        "https://link-logger-frozen.turso.io/v2/pipeline"
    )
    assert _pipeline_url("https://db.example.com/") == "https://db.example.com/v2/pipeline"
    assert _pipeline_url("https://db.example.com/v2/pipeline") == "https://db.example.com/v2/pipeline"


def test_statement_is_encoded_and_rows_are_decoded(monkeypatch):
    payload = {
        "results": [
            {
                "type": "ok",
                "response": {
                    "type": "execute",
                    "result": {
                        "cols": [{"name": "id", "decltype": "INTEGER"}, {"name": "short_code", "decltype": "TEXT"}],
                        "rows": [[{"type": "integer", "value": "7"}, {"type": "text", "value": "abc123"}]],
                        "affected_row_count": 1,
                    },
                },
            }
        ]
    }
    captured = []
    install_fake(monkeypatch, payload, captured)

    rows, affected = TursoStore("libsql://db.turso.io", "secret-token").execute(
        "SELECT id, short_code FROM links WHERE id = ? AND created_at > ?", (7, "2026-11-10T00:00:00.000000+00:00")
    )

    assert rows == [{"id": 7, "short_code": "abc123"}]
    assert affected == 1

    sent = captured[0]
    assert sent.full_url == "https://db.turso.io/v2/pipeline"
    assert sent.get_header("Authorization") == "Bearer secret-token"
    body = json.loads(sent.data)
    assert body["requests"][0]["stmt"]["sql"].startswith("SELECT id, short_code")
    assert body["requests"][0]["stmt"]["args"] == [
        {"type": "integer", "value": "7"},
        {"type": "text", "value": "2026-11-10T00:00:00.000000+00:00"},
    ]


def test_sql_error_becomes_store_error(monkeypatch):
    payload = {"results": [{"type": "error", "error": {"message": "SQLITE_CONSTRAINT: UNIQUE constraint failed"}}]}
    install_fake(monkeypatch, payload, [])
    with pytest.raises(StoreError) as caught:
        TursoStore("libsql://db.turso.io", "t").execute("INSERT INTO links VALUES (?)", ("x",))
    assert "UNIQUE constraint failed" in str(caught.value)


def test_auth_failure_is_not_reported_as_a_bad_request(monkeypatch):
    import urllib.error

    def fake_urlopen(request, timeout=None):
        raise urllib.error.HTTPError(request.full_url, 401, "Unauthorized", {}, io.BytesIO(b'{"error":"bad token"}'))

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    with pytest.raises(StoreError) as caught:
        TursoStore("libsql://db.turso.io", "wrong").execute("SELECT 1")
    assert "401" in str(caught.value)


def test_malformed_response_is_never_success(monkeypatch):
    # A truncated or proxy-mangled body used to decode as "no rows", so a
    # DELETE could answer 204 without deleting anything.
    for payload in ({}, {"results": []}, {"results": [{"type": "ok"}]}, {"results": [{"type": "ok", "response": {}}]}):
        install_fake(monkeypatch, payload, [])
        with pytest.raises(StoreError):
            TursoStore("libsql://db.turso.io", "t").execute("DELETE FROM links WHERE id = ?", (1,))


def test_blob_uses_the_base64_field(monkeypatch):
    payload = {
        "results": [
            {
                "type": "ok",
                "response": {
                    "type": "execute",
                    "result": {
                        "cols": [{"name": "b", "decltype": "BLOB"}],
                        "rows": [[{"type": "blob", "base64": "YWJj"}]],
                        "affected_row_count": 1,
                    },
                },
            }
        ]
    }
    captured = []
    install_fake(monkeypatch, payload, captured)

    rows, _ = TursoStore("libsql://db.turso.io", "t").execute("SELECT ? AS b", (b"xyz",))

    assert rows == [{"b": b"abc"}]
    args = json.loads(captured[0].data)["requests"][0]["stmt"]["args"]
    assert args == [{"type": "blob", "base64": "eHl6"}]
