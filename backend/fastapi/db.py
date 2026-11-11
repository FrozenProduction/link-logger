"""Storage for Link Logger.

Two backends behind one interface: a local SQLite file for development and CI,
and Turso (libSQL) over HTTPS for the deployment. Render's free tier has an
ephemeral filesystem, so a SQLite file there is erased on every deploy or
restart; the hosted app therefore talks to Turso, where the rows outlive the
service.

Both speak SQLite SQL, so the only differences are connection setup and how a
statement's rows come back. Parameters are positional ``?`` everywhere.
"""

from __future__ import annotations

import base64
import json
import os
import sqlite3
import urllib.error
import urllib.request


class StoreError(RuntimeError):
    """A storage failure that is not the caller's fault (network, auth, SQL)."""


class SqliteStore:
    """A SQLite file. One connection per statement — cheap at this scale and
    it keeps no module-level handle open across requests."""

    name = "sqlite"

    def __init__(self, path: str):
        self.path = path

    def execute(self, sql: str, params: tuple = ()) -> tuple[list[dict], int]:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()] if cur.description else []
            conn.commit()
            return rows, cur.rowcount
        finally:
            conn.close()


class TursoStore:
    """Turso over its HTTP pipeline API. No SDK: one POST per statement.

    Docs shape: {"requests": [{"type": "execute", "stmt": {...}}]} answered by
    {"results": [{"type": "ok", "response": {"result": {"cols", "rows"}}}]}.
    Values arrive typed ({"type": "integer", "value": "1"}) and are decoded
    here into plain Python, so callers never see the wire format.
    """

    name = "turso"

    def __init__(self, url: str, token: str):
        self.endpoint = _pipeline_url(url)
        self.token = token

    def execute(self, sql: str, params: tuple = ()) -> tuple[list[dict], int]:
        body = {
            "requests": [
                {
                    "type": "execute",
                    "stmt": {
                        "sql": sql,
                        "args": [_encode_value(p) for p in params],
                        "want_rows": True,
                    },
                }
            ]
        }
        request = urllib.request.Request(
            self.endpoint,
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            raise StoreError(f"turso http {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise StoreError(f"turso unreachable: {exc.reason}") from exc

        result = (payload.get("results") or [{}])[0]
        if result.get("type") == "error":
            raise StoreError(f"turso: {result.get('error', {}).get('message', 'unknown error')}")

        executed = (result.get("response") or {}).get("result") or {}
        columns = [column["name"] for column in executed.get("cols") or []]
        rows = [
            {name: _decode_value(value) for name, value in zip(columns, row)}
            for row in executed.get("rows") or []
        ]
        return rows, int(executed.get("affected_row_count") or 0)


def _pipeline_url(raw: str) -> str:
    """Turn the URL Turso prints (libsql://host) into its HTTPS pipeline URL."""
    base = raw.strip().rstrip("/")
    if base.startswith("libsql://"):
        base = "https://" + base[len("libsql://") :]
    if base.endswith("/v2/pipeline"):
        return base
    return base + "/v2/pipeline"


def _encode_value(value):
    if value is None:
        return {"type": "null"}
    if isinstance(value, bool):
        return {"type": "integer", "value": str(int(value))}
    if isinstance(value, int):
        return {"type": "integer", "value": str(value)}
    if isinstance(value, float):
        return {"type": "float", "value": value}
    if isinstance(value, bytes):
        return {"type": "blob", "value": base64.b64encode(value).decode("ascii")}
    return {"type": "text", "value": str(value)}


def _decode_value(value):
    kind = value.get("type")
    if kind == "null":
        return None
    if kind == "integer":
        return int(value["value"])
    if kind == "float":
        return float(value["value"])
    if kind == "blob":
        return base64.b64decode(value["value"])
    return value.get("value")


SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_url TEXT NOT NULL,
        short_code TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        clicks INTEGER DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS clicks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        link_id INTEGER NOT NULL,
        clicked_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (link_id) REFERENCES links(id)
    )
    """,
)


def build_store() -> SqliteStore | TursoStore:
    url = os.environ.get("TURSO_DATABASE_URL", "").strip()
    if not url:
        return SqliteStore(os.environ.get("LINK_LOGGER_DB", "link_logger.db"))
    token = os.environ.get("TURSO_AUTH_TOKEN", "").strip()
    if not token:
        raise StoreError("TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing")
    return TursoStore(url, token)


def init_db(store: SqliteStore | TursoStore) -> None:
    for statement in SCHEMA:
        store.execute(statement)

    columns = {row["name"] for row in store.execute("PRAGMA table_info(links)")[0]}
    # Databases created before ownership and expiry existed get the columns
    # added in place instead of being dropped.
    if "owner_token" not in columns:
        store.execute("ALTER TABLE links ADD COLUMN owner_token TEXT NOT NULL DEFAULT ''")
    if "expires_at" not in columns:
        store.execute("ALTER TABLE links ADD COLUMN expires_at TEXT NOT NULL DEFAULT ''")

    # Rows from before those columns existed belong to nobody and can never be
    # listed or deleted through the API. Remove them once, with their clicks.
    legacy_links, _ = store.execute(
        "SELECT id FROM links WHERE owner_token = '' OR expires_at = ''"
    )
    if legacy_links:
        ids = [row["id"] for row in legacy_links]
        marks = ",".join("?" * len(ids))
        store.execute(f"DELETE FROM clicks WHERE link_id IN ({marks})", tuple(ids))
        store.execute(f"DELETE FROM links WHERE id IN ({marks})", tuple(ids))

    store.execute(
        "CREATE INDEX IF NOT EXISTS idx_links_owner ON links (owner_token, created_at DESC)"
    )


store = build_store()
