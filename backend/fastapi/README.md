# Link Logger — Backend API (FastAPI)

The API behind Link Logger. Handles short link creation, storage, redirects, and click analytics.

**Live API:** https://link-logger-api.onrender.com/  
**API docs:** https://link-logger-api.onrender.com/docs

## Endpoints

| Method | Path              | Description                         |
|--------|-------------------|-------------------------------------|
| POST   | `/api/links`      | Create a short link (supports custom codes) |
| GET    | `/api/links`      | List all links                      |
| GET    | `/api/links/{id}` | Link details + click breakdown by day |
| GET    | `/{code}`         | Redirect to original URL (increments click count) |
| DELETE | `/api/links/{id}` | Delete a link                       |
| GET    | `/api/health`     | Health check — returns `{"status": "ok"}` |

## Tech

- **FastAPI** — framework with automatic OpenAPI schema generation. Routes and Pydantic models produce the Swagger docs directly.
- **SQLite** — file-based database, no external setup. The database file is the state; deployment is a single copy.
- **Pydantic** — request and response validation, plus the data shapes you see in the API docs.
- **Uvicorn** — ASGI server that runs the app.

## Environment Variables

| Variable       | Default            | Description                                                      |
|----------------|--------------------|------------------------------------------------------------------|
| `LINK_LOGGER_DB` | `link_logger.db`   | Path to SQLite database file                                     |
| `BASE_URL`     | derived from request | Public base URL for short links (set in production)              |

`BASE_URL` matters in production: if it is not set, the generated short URLs use the domain of the incoming request. On Render, set it so the links are stable and correct.

## Design Notes

- **Click analytics** — each link stores a `clicks` counter plus one row per visit in a `clicks` table, aggregated per day on read. It is not a full analytics system, but it is enough to show how the tracking works.
- **Privacy** — visitor IPs are stored only as one-way SHA-256 hashes, not raw addresses. Counts stay accurate without keeping identifiable data next to click history.
- **Custom codes** — when creating a link, you can optionally provide a custom short code. If none is given, a cryptographically random 6-character code is generated (`secrets` module). The UNIQUE constraint is enforced at insert time, so a lost race returns a clean 400, not a 500.
- **Redirect** — `GET /{code}` returns a `302 Found` to the original URL and increments the click count in the same request.
