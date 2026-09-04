import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, AnyUrl, field_validator
import random
import string
import os

app = FastAPI(
    title="Link Logger API",
    description="URL shortener with analytics",
    version="1.0.0",
)

# CORS — allows the Vercel frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://link-logger-pink.vercel.app",
        "http://localhost:5173",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.environ.get("LINK_LOGGER_DB", "link_logger.db")


def get_base_url_from_env() -> str:
    """Get the publicly reachable base URL from environment, if set."""
    return os.environ.get("BASE_URL", "").rstrip("/")


# --- Database ---

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_url TEXT NOT NULL,
                short_code TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                clicks INTEGER DEFAULT 0
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                link_id INTEGER NOT NULL,
                clicked_at TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (link_id) REFERENCES links(id)
            )
        """)


# --- Pydantic Models ---

class LinkCreateRequest(BaseModel):
    original_url: AnyUrl
    custom_code: Optional[str] = None

    @field_validator("custom_code")
    @classmethod
    def validate_custom_code(cls, v):
        if v and (len(v) < 3 or len(v) > 20):
            raise ValueError("custom_code must be 3-20 characters")
        if v and not all(c.isalnum() or c in "-_" for c in v):
            raise ValueError("custom_code can only contain letters, numbers, - and _")
        return v


class LinkResponse(BaseModel):
    id: int
    original_url: str
    short_code: str
    short_url: str
    created_at: str
    clicks: int

    class Config:
        from_attributes = True


class LinkDetailResponse(LinkResponse):
    clicks_breakdown: Optional[dict] = None


# --- Helpers ---

def generate_short_code(length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


def build_short_url(base_url: str, short_code: str) -> str:
    """Build a public short URL from base_url + short_code."""
    return f"{base_url.rstrip('/')}/{short_code}"


# --- Routes ---

@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/api/links", response_model=LinkResponse, status_code=201)
def create_link(request: Request, payload: LinkCreateRequest):
    with get_db() as db:
        # Determine short code
        if payload.custom_code:
            short_code = payload.custom_code
            existing = db.execute(
                "SELECT id FROM links WHERE short_code = ?", (short_code,)
            ).fetchone()
            if existing:
                raise HTTPException(status_code=400, detail="Custom code already exists")
        else:
            short_code = generate_short_code(6)
            # Ensure uniqueness
            while db.execute(
                "SELECT id FROM links WHERE short_code = ?", (short_code,)
            ).fetchone():
                short_code = generate_short_code(6)

        created_at = datetime.now(timezone.utc).isoformat()
        db.execute(
            "INSERT INTO links (original_url, short_code, created_at, clicks) VALUES (?, ?, ?, 0)",
            (str(payload.original_url), short_code, created_at),
        )
        link_id = db.execute(
            "SELECT last_insert_rowid()"
        ).fetchone()[0]

        base_url = get_base_url_from_env() or str(request.url).rsplit("/api", 1)[0]
        return LinkResponse(
            id=link_id,
            original_url=str(payload.original_url),
            short_code=short_code,
            short_url=build_short_url(base_url, short_code),
            created_at=created_at,
            clicks=0,
        )


@app.get("/api/links", response_model=list[LinkResponse])
def list_links(request: Request):
    with get_db() as db:
        rows = db.execute(
            "SELECT id, original_url, short_code, created_at, clicks FROM links ORDER BY created_at DESC"
        ).fetchall()
        base_url = get_base_url_from_env() or str(request.url).rsplit("/api", 1)[0]
        return [
            LinkResponse(
                id=r["id"],
                original_url=r["original_url"],
                short_code=r["short_code"],
                short_url=build_short_url(base_url, r["short_code"]),
                created_at=r["created_at"],
                clicks=r["clicks"],
            )
            for r in rows
        ]


@app.get("/api/links/{link_id}", response_model=LinkDetailResponse)
def get_link(request: Request, link_id: int):
    with get_db() as db:
        link = db.execute(
            "SELECT id, original_url, short_code, created_at, clicks FROM links WHERE id = ?",
            (link_id,),
        ).fetchone()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")

        # Clicks per day
        clicks = db.execute(
            """
            SELECT DATE(clicked_at) as day, COUNT(*) as count
            FROM clicks
            WHERE link_id = ?
            GROUP BY day
            ORDER BY day
            """,
            (link_id,),
        ).fetchall()
        clicks_breakdown = {r["day"]: r["count"] for r in clicks}

        base_url = get_base_url_from_env() or str(request.url).rsplit("/api", 1)[0]
        return LinkDetailResponse(
            id=link["id"],
            original_url=link["original_url"],
            short_code=link["short_code"],
            short_url=build_short_url(base_url, link["short_code"]),
            created_at=link["created_at"],
            clicks=link["clicks"],
            clicks_breakdown=clicks_breakdown,
        )


@app.get("/{code}")
def redirect_to_original(code: str, request: Request):
    with get_db() as db:
        link = db.execute(
            "SELECT id, original_url FROM links WHERE short_code = ?", (code,)
        ).fetchone()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")

        # Record click
        db.execute(
            "INSERT INTO clicks (link_id, clicked_at, ip_address, user_agent) VALUES (?, ?, ?, ?)",
            (
                link["id"],
                datetime.now(timezone.utc).isoformat(),
                request.client.host if request.client else "unknown",
                request.headers.get("user-agent", "unknown"),
            ),
        )
        db.execute(
            "UPDATE links SET clicks = clicks + 1 WHERE id = ?", (link["id"],)
        )

        return RedirectResponse(url=link["original_url"], status_code=302)


@app.delete("/api/links/{link_id}", status_code=204)
def delete_link(link_id: int):
    with get_db() as db:
        link = db.execute(
            "SELECT id FROM links WHERE id = ?", (link_id,)
        ).fetchone()
        if not link:
            raise HTTPException(status_code=404, detail="Link not found")
        db.execute("DELETE FROM clicks WHERE link_id = ?", (link_id,))
        db.execute("DELETE FROM links WHERE id = ?", (link_id,))


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
