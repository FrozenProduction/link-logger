"""Retention and ownership contract for the API.

Runs against a throwaway SQLite file (no Turso credentials needed), so it works
in CI exactly as it does locally. Each test uses its own owner token, which is
what keeps them independent on a shared database.

Run: pytest -q backend/fastapi/test_retention.py
"""

import os
import pathlib
import sqlite3
import tempfile

TMP_DB = pathlib.Path(tempfile.mkdtemp(prefix="linklogger-test-")) / "test.db"
os.environ["LINK_LOGGER_DB"] = str(TMP_DB)
os.environ["MAX_LINKS_PER_OWNER"] = "10"
os.environ["LINK_TTL_DAYS"] = "30"
os.environ.pop("TURSO_DATABASE_URL", None)
os.environ.pop("TURSO_AUTH_TOKEN", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


def headers(token: str) -> dict:
    return {"X-Owner-Token": token}


def create(client, token: str, url: str = "https://example.com/x", code: str | None = None):
    response = client.post(
        "/api/links", json={"original_url": url, "custom_code": code}, headers=headers(token)
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def client():
    with TestClient(main.app) as test_client:
        yield test_client


def test_health_reports_local_store(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["store"] == "sqlite"


def test_limits_are_published_to_the_ui(client):
    body = client.get("/api/limits").json()
    assert body == {"links_per_owner": 10, "ttl_days": 30}


def test_create_requires_an_owner_token(client):
    response = client.post("/api/links", json={"original_url": "https://example.com"})
    assert response.status_code == 400
    assert "X-Owner-Token" in response.json()["detail"]


def test_short_link_redirects_and_counts_the_click(client):
    link = create(client, "token-redirect-01", code="redir01")
    assert link["clicks"] == 0
    assert link["expires_at"] > link["created_at"]

    hop = client.get("/redir01", follow_redirects=False)
    assert hop.status_code == 302
    assert hop.headers["location"] == "https://example.com/x"

    detail = client.get(f"/api/links/{link['id']}", headers=headers("token-redirect-01")).json()
    assert detail["clicks"] == 1
    assert sum(detail["clicks_breakdown"].values()) == 1


def test_eleventh_link_evicts_the_oldest(client):
    token = "token-evict-0001"
    codes = [create(client, token, code=f"ev{i:02d}")["short_code"] for i in range(10)]
    assert len(client.get("/api/links", headers=headers(token)).json()) == 10

    eleventh = create(client, token, code="ev10")

    assert eleventh["evicted_code"] == codes[0], "oldest link should be the one named as evicted"
    listed = client.get("/api/links", headers=headers(token)).json()
    assert len(listed) == 10
    assert codes[0] not in [item["short_code"] for item in listed]
    assert client.get(f"/{codes[0]}", follow_redirects=False).status_code == 404
    assert client.get("/ev10", follow_redirects=False).status_code == 302


def test_one_browser_cannot_see_or_delete_anothers_links(client):
    mine = create(client, "token-owner-0001", code="mine01")

    assert client.get("/api/links", headers=headers("token-owner-0002")).json() == []
    assert client.get(f"/api/links/{mine['id']}", headers=headers("token-owner-0002")).status_code == 404
    assert client.delete(f"/api/links/{mine['id']}", headers=headers("token-owner-0002")).status_code == 404
    assert len(client.get("/api/links", headers=headers("token-owner-0001")).json()) == 1


def test_expired_link_returns_410_and_leaves_the_list(client):
    token = "token-expiry-0001"
    link = create(client, token, code="old001")
    assert len(client.get("/api/links", headers=headers(token)).json()) == 1

    with sqlite3.connect(os.environ["LINK_LOGGER_DB"]) as db:
        db.execute(
            "UPDATE links SET expires_at = ? WHERE short_code = ?",
            ("2000-01-01T00:00:00.000000+00:00", link["short_code"]),
        )

    gone = client.get("/old001", follow_redirects=False)
    assert gone.status_code == 410
    assert "expired" in gone.text.lower()
    assert "link-logger-pink.vercel.app" in gone.text, "the page must link back to the app"
    assert client.get("/api/links", headers=headers(token)).json() == []


def test_expired_links_do_not_occupy_a_slot(client):
    token = "token-expiry-0002"
    for index in range(10):
        create(client, token, code=f"slot{index}")
    with sqlite3.connect(os.environ["LINK_LOGGER_DB"]) as db:
        db.execute(
            "UPDATE links SET expires_at = ? WHERE short_code = 'slot0'",
            ("2000-01-01T00:00:00.000000+00:00",),
        )

    fresh = create(client, token, code="fresh1")
    assert fresh["evicted_code"] is None, "the expired link should free the slot, not force an eviction"
    assert len(client.get("/api/links", headers=headers(token)).json()) == 10


def test_duplicate_custom_code_is_a_clean_400(client):
    create(client, "token-dup-000001", code="dup001")
    response = client.post(
        "/api/links",
        json={"original_url": "https://example.com/other", "custom_code": "dup001"},
        headers=headers("token-dup-000002"),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Custom code already exists"


def test_non_http_destination_is_rejected(client):
    response = client.post(
        "/api/links",
        json={"original_url": "javascript:alert(1)"},
        headers=headers("token-scheme-0001"),
    )
    assert response.status_code == 422


def test_reserved_custom_codes_are_rejected(client):
    # /docs, /redoc and /openapi.json are registered before /{code}: a link
    # with one of those codes could be created but never followed.
    for code in ("docs", "redoc", "openapi.json", "DOCS"):
        response = client.post(
            "/api/links",
            json={"original_url": "https://example.com/reserved", "custom_code": code},
            headers=headers("token-reserved-01"),
        )
        assert response.status_code == 422, (code, response.text)


def test_out_of_range_ids_are_rejected_not_500(client):
    headers_ = headers("token-bigid-0001")
    for path in ("/api/links/9223372036854775808", "/api/links/-9223372036854775809", "/api/links/0"):
        assert client.get(path, headers=headers_).status_code == 422, path
    assert client.delete("/api/links/9223372036854775808", headers=headers_).status_code == 422


def test_full_table_refuses_instead_of_evicting_someone_else(client, monkeypatch):
    # The demo has a hard row budget. When it is reached, a new create must be
    # refused — deleting the globally oldest link would throw away a stranger's.
    before = client.get("/api/health").json()["links"]
    assert before > 0, "earlier tests should have left rows behind"
    monkeypatch.setattr(main, "MAX_TOTAL_LINKS", before)

    response = client.post(
        "/api/links",
        json={"original_url": "https://example.com/cap", "custom_code": "cap001"},
        headers=headers("token-cap-00001"),
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "This demo is at capacity. Try again later."
    assert client.get("/api/health").json()["links"] == before, "nothing may be deleted"


def test_expired_rows_do_not_block_capacity(client, monkeypatch):
    token = "token-cap-00002"
    create(client, token, code="cap002")
    with sqlite3.connect(os.environ["LINK_LOGGER_DB"]) as db:
        db.execute(
            "UPDATE links SET expires_at = ? WHERE short_code = 'cap002'",
            ("2000-01-01T00:00:00.000000+00:00",),
        )

    total = client.get("/api/health").json()["links"]
    monkeypatch.setattr(main, "MAX_TOTAL_LINKS", total)

    fresh = create(client, token, code="cap003")
    assert fresh["short_code"] == "cap003", "the expired row should have freed the budget"
