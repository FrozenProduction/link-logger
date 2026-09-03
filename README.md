# Link Logger

A URL shortener with click analytics — a full-stack application built with React (Vite) and FastAPI.

**Live demo:** https://link-logger-pink.vercel.app/

## What it does

Create short, custom URLs from long links and track clicks with a simple analytics dashboard. The app stores link metadata and click counts in SQLite and provides a clean UI for management.

- Form to create short links (with optional custom code)
- Link list with original URL, short URL, click count, and creation date
- Click-through analytics with per-day breakdown
- Delete functionality with confirmation
- Clean, responsive design with system font stack

## Tech Stack

| Layer      | Technology                              | Why                                                                 |
|------------|------------------------------------------|----------------------------------------------------------------------|
| Frontend   | React 18, Vite, vanilla CSS              | Light setup, no UI framework overhead, full control over the UI      |
| Backend    | Python 3.13, FastAPI, SQLite, Pydantic  | FastAPI gives automatic OpenAPI docs; SQLite keeps deployment simple  |
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

Interactive API docs are available at the [live API](https://link-logger-api.onrender.com/docs).

## Design Choices

- **SQLite** — keeps the backend deployable as a single file; no external database needed. Fine for this scale.
- **Vanilla CSS (inline styles)** — no CSS framework. I wanted full control over the look and zero dependency on a utility library for a project this small.
- **Vite** — fast dev server, simple build output. Lighter than Create React App for a single-page app.
- **FastAPI** — automatic OpenAPI schema generation means the API docs write themselves from the code. Less boilerplate.
- **CORS configured** — the backend explicitly allows the Vercel frontend origin, so the split deployment (frontend on Vercel, backend on Render) works without issues.

## Author

FrozenProduction — full-stack developer (React + Java/Spring Boot) building portfolio projects in Python and JavaScript.

## License

MIT
