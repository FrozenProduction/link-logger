<p align="center"><img src="docs/logo.png" width="88" alt="Link Logger mark"></p>

# Link Logger

A URL shortener with click analytics — a full-stack application built with React (Vite) and FastAPI.

**Live demo:** https://link-logger-pink.vercel.app/ · **CI:** ![CI](https://github.com/FrozenProduction/link-logger/actions/workflows/test.yml/badge.svg)

## Screenshots

| Dashboard | Analytics | API docs (Swagger) |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Analytics](docs/screenshots/analytics.png) | ![API docs](docs/screenshots/api-docs.png) |

## What it does

Create short, custom URLs from long links and track clicks with a simple analytics dashboard. The app stores link metadata and click counts in SQLite and provides a clean UI for management.

- Form to create short links (with optional custom code)
- Link list with original URL, short URL, click count, and creation date
- **Click the short code to copy it** (with a clipboard fallback for non-secure contexts)
- Per-row actions: analytics, open the short link, delete with an inline confirm
- Click-through analytics in a side panel, with per-day bars
- Honest states: loading skeleton, empty state, and an error banner that never reports a failed request as "no links"
- Any URL scheme except `http`/`https` is rejected, so a short link can never redirect to `javascript:` or `data:`
- Responsive down to 390px, keyboard-reachable, `prefers-reduced-motion` respected
- Self-hosted type: Reddit Sans + IBM Plex Mono (OFL, licences in `public/fonts/`)

## Tech Stack

| Layer      | Technology                              | Why                                                                 |
|------------|------------------------------------------|----------------------------------------------------------------------|
| Frontend   | React 18, Vite, vanilla CSS              | Light setup, no UI framework overhead, full control over the UI      |
| Backend    | Python 3.11+, FastAPI, SQLite, Pydantic  | FastAPI gives automatic OpenAPI docs; SQLite keeps deployment simple  |
| Deployment | Vercel (frontend), Render (backend)     | Free tiers, simple setup, enough for a portfolio project              |

## API

The backend exposes a REST API with Swagger docs at `/docs`:

| Method | Path           | Description               |
|--------|----------------|---------------------------|
| POST   | `/api/links`   | Create a short link       |
| GET    | `/api/links`   | List all links            |
| GET    | `/api/links/{id}` | Link details + analytics |
| GET    | `/{code}`      | Redirect to original URL  |
| DELETE | `/api/links/{id}` | Delete a link            |
| GET    | `/api/health`  | Health check              |

`POST /api/links` accepts only `http`/`https` destinations: any other scheme is rejected with `422`, so a short link can never redirect to `javascript:` or `data:`.

Interactive API docs are available at the [live API](https://link-logger-api.onrender.com/docs).

## Running Locally

Backend (Python 3.11+, no system packages needed beyond `uv`):

```bash
cd backend/fastapi
uv run --with fastapi==0.133.1 --with uvicorn==0.41.0 --with pydantic==2.13.4 \
  uvicorn main:app --port 8000
```

A `link_logger.db` SQLite file is created next to `main.py` on first run (gitignored, never commit it). API at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

Frontend:

```bash
cd frontend/react
npm install
npm run dev
```

Opens on `http://localhost:5173` against the local API. Production builds use `VITE_API_URL` for the deployed backend.

> Note: the Render deployment is ephemeral — links created on the live demo disappear on restart. Local data persists in your SQLite file.

## Design Choices

- **SQLite** — keeps the backend deployable as a single file; no external database needed. Fine for this scale.
- **Vanilla CSS, one stylesheet with design tokens** — no CSS framework and no inline styles. Every colour and face enters through a `:root` token, so the palette can be swapped in one place.
- **A drawn direction, not a default** — the palette ("olive on bone", one olive ink on a bone page, colour spent on the data) and the type pair came from a curated library rather than the usual blue-on-grey. Contrast is computed, not eyeballed: ink 8.69:1, muted 5.02:1, the button 8.69:1 on the bone page.
- **One mark, every size** — the chain is drawn on a 32-unit grid with 2-unit walls and 2-unit holes, so the same artwork survives 16 px instead of needing a second, simplified favicon. Verified: at 16 px it still rasterises as two separate links with two enclosed holes.
- **Vite** — fast dev server, simple build output. Lighter than Create React App for a single-page app.
- **FastAPI** — automatic OpenAPI schema generation means the API docs write themselves from the code. Less boilerplate.
- **CORS configured** — the backend explicitly allows the Vercel frontend origin, so the split deployment (frontend on Vercel, backend on Render) works without issues.

## Author

FrozenProduction — full-stack developer (React + Java/Spring Boot) building portfolio projects in Python and JavaScript.

## License

MIT
