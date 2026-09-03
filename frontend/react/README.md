# Link Logger — Frontend (React + Vite)

The React frontend for Link Logger. Create short links, view them, see click analytics, and delete links.

**Live app:** https://link-logger-pink.vercel.app/

## Tech

- **React 18** — hooks-based components (`useState`, `useEffect`). No class components.
- **Vite 5** — build tool and dev server. Handles the build and dev proxy to the backend.
- **Vanilla CSS (inline styles)** — no CSS framework. Each component owns its styles as JavaScript objects. This keeps the CSS local to the component and avoids a separate stylesheet layer for a project this size.
- **Fetch API** — all HTTP calls go directly to the FastAPI backend. No Axios, no wrapper library.

## Development

```bash
cd frontend/react
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies `/api` requests to the local backend at `http://localhost:8000`.

## Environment Variables

| Variable      | Default (dev)        | Description                              |
|---------------|----------------------|------------------------------------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL. In production, set to the deployed API URL. |

At build time, Vite replaces `import.meta.env.VITE_API_URL` with the actual value. If the variable is not set, the build falls back to the Render backend URL so the app still works.

## Build

```bash
npm run build
```

Outputs to `dist/` — ready for static hosting on Vercel, Netlify, or similar.

## Features

- Form to create short links with an optional custom code
- List of all links showing original URL, short URL, click count, and creation date
- Click-through analytics with a per-day breakdown
- Delete a link with a confirmation step
- Responsive layout using the system font stack — no external font loading

## API calls

The frontend calls these backend endpoints (defined in [`backend/fastapi/README.md`](../../../backend/fastapi/README.md)):

- `POST /api/links` — create a short link
- `GET /api/links` — list all links
- `GET /api/links/{id}` — link details and analytics
- `DELETE /api/links/{id}` — delete a link
- `GET /api/health` — health check
