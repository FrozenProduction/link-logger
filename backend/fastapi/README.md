# Link Logger — Backend API (FastAPI)

The API behind Link Logger. Handles short link creation, storage, redirects, click
analytics, and the retention rules that keep the demo bounded.

**Live API:** https://link-logger-api.onrender.com/
**API docs:** https://link-logger-api.onrender.com/docs

## Endpoints

`POST` and both `/api/links` reads require an `X-Owner-Token` header: 8–64 characters of
`A-Z a-z 0-9 _ -`. The frontend generates one per browser and sends it on every call.

| Method | Path              | Owner header | Description                                                   |
|--------|-------------------|--------------|---------------------------------------------------------------|
| POST   | `/api/links`      | required     | Create a short link (optional custom code). Returns `evicted_code` when the cap forced one out |
| GET    | `/api/links`      | required     | This owner's live links, newest first                         |
| GET    | `/api/links/{id}` | required     | Link details + clicks per day                                 |
| DELETE | `/api/links/{id}` | required     | Delete a link; `404` when it is not this owner's              |
| GET    | `/api/limits`     | —            | `{"links_per_owner": 10, "ttl_days": 30}`                     |
| GET    | `/{code}`         | —            | `302` to the destination, `410 Gone` once expired             |
| GET    | `/api/health`     | —            | `{"status", "store", "links"}`; `503` when the store is down  |

## Storage

Two backends, one interface in `db.py`:

- **SQLite file** — default for local development and CI (`LINK_LOGGER_DB`).
- **Turso (libSQL) over HTTPS** — used when `TURSO_DATABASE_URL` is set. This exists
  because Render's free tier has an ephemeral filesystem: a SQLite file there disappears on
  every deploy or restart. The SQL is identical on both, so tests run without credentials.

The Turso path speaks the HTTP pipeline API directly (`/v2/pipeline`) instead of pulling in
an SDK — one POST per statement, typed values decoded into plain Python. `test_store_wire.py`
locks the request/response shape.

## Retention rules

- **Ten live links per owner.** Creating an eleventh deletes the oldest and returns its
  code in `evicted_code` so the UI can say which one went.
- **Thirty days per link.** Expired links are filtered out of every read, answer `410` on
  the short URL, and are physically deleted the next time that owner creates a link — no
  cron job, which a free tier would not run anyway.
- Expired links do not count against the cap.
- Both numbers come from the environment and are published through `/api/limits`.

## Environment Variables

| Variable                | Default              | Description                                                    |
|-------------------------|----------------------|----------------------------------------------------------------|
| `TURSO_DATABASE_URL`    | unset                | `libsql://…` or `https://…`; when unset, a local SQLite file is used |
| `TURSO_AUTH_TOKEN`      | unset                | Required with `TURSO_DATABASE_URL`; startup fails without it    |
| `LINK_LOGGER_DB`        | `link_logger.db`     | SQLite path when Turso is not configured                       |
| `BASE_URL`              | derived from request | Public base URL used to build short links (set in production)  |
| `MAX_LINKS_PER_OWNER`   | `10`                 | Live links kept per browser                                    |
| `LINK_TTL_DAYS`         | `30`                 | Days before a link expires                                     |
| `FRONTEND_URL`          | the Vercel app       | Where the `410` page links back to                             |

`BASE_URL` matters in production: without it, short URLs are built from the incoming request,
which is fine behind one hostname and wrong behind a proxy that rewrites the host.

## Design Notes

- **Ownership without accounts** — the owner token scopes lists and deletes. It is not a
  credential and is not treated as one: it cannot reach another browser's links unless it
  knows that browser's random token.
- **Click analytics** — each link stores a `clicks` counter plus one row per visit in a
  `clicks` table, aggregated per day on read. Enough to show how tracking works, not a
  product analytics system.
- **Privacy** — visitor IPs are stored only as one-way SHA-256 hashes, not raw addresses.
  Note that behind Render's proxy `request.client.host` is the proxy, so the hash is stable
  rather than per-visitor; nothing user-facing depends on it.
- **Custom codes** — optional; otherwise a cryptographically random 6-character code is
  generated (`secrets`). The UNIQUE constraint is the real gate: a lost race returns a clean
  `400`, and a network error is never reported as a duplicate code.
- **Redirect** — `GET /{code}` returns `302` and records the click in the same request.
  Expired codes return a small HTML page with `410`, which is the honest status for
  "existed, deliberately removed".
- **Time** — timestamps are fixed-width UTC ISO-8601, so SQL string comparison is exact and
  no database function or locale is involved.

## Tests

```bash
pip install -r requirements-dev.txt   # runtime pins + pytest + httpx
pytest -q                             # retention, ownership, expiry, Turso wire format
bash ../../test_backend.sh            # end-to-end against a running server
```

`test_retention.py` runs against a throwaway SQLite file; `test_store_wire.py` stubs the HTTP
transport so the Turso client is exercised without a database.
