# Link Logger — Frontend (React + Vite)

Create short links, see the ten slots you have, watch clicks, and inspect per-day analytics.

**Live app:** https://link-logger-pink.vercel.app/

## Tech

- **React 18** — hooks only (`useState`, `useEffect`, `useCallback`). No class components.
- **Vite 6** — dev server and build. `server.proxy` forwards `/api` to the local backend.
- **One stylesheet with tokens** — `src/styles.css`; no CSS framework, no inline styles.
  Every colour enters through a `:root` token so the palette can be swapped in one place.
- **Fetch API** — a small wrapper in `src/services/api.js` (base URL, owner header, JSON
  errors as readable messages). No Axios.

## Structure

```
src/
|-- App.jsx                 # loads links + limits, owns the drawer state
|-- components/
|   |-- CreateBar.jsx       # create form, copy chip, eviction notice
|   |-- LinkTable.jsx       # rows, expiry line, per-row actions, inline delete confirm
|   |-- DetailDrawer.jsx    # analytics panel (focus trap, inert when closed)
|   `-- CopyButton.jsx      # clipboard with a non-secure-context fallback
|-- services/api.js         # owner token + endpoints
|-- utils/format.js         # relative dates, day labels, "expires in N days"
`-- styles.css              # tokens + layout
```

## The owner token

There are no accounts. On first use the app generates a UUID, stores it in `localStorage`
under `linklogger.owner`, and sends it as `X-Owner-Token` on every request. That token is
what makes the list "yours": another browser has a different one and sees its own links.

Clearing site data starts a fresh, empty set of slots. The old links still resolve until
their 30-day expiry, they are simply no longer listed anywhere.

## Development

```bash
cd frontend/react
npm install
npm run dev
```

Dev server on `http://localhost:5173`, proxying `/api` to `http://localhost:8000`.

## Environment Variables

| Variable       | Default | Description                                                        |
|----------------|---------|--------------------------------------------------------------------|
| `VITE_API_URL` | empty   | API origin. Empty means same-origin `/api`, which is right behind one domain; set it when Vercel serves the UI and Render serves the API |

Vite bakes the value in at build time — changing it needs a new build, not a restart.

## Build

```bash
npm run build
```

Outputs `dist/`, ready for static hosting.

## Features

- Create short links with an optional custom code; the URL is normalised (`example.com` →
  `https://example.com`) and refused when it looks like a typo
- Ten slots per browser, shown as `3/10 links` in the masthead; the oldest link is retired
  when an eleventh is created and the form says which code went
- Expiry under each date ("expires in 29 days"), and a `410` page on the API for links that
  have passed it
- Analytics drawer with total clicks and a per-day breakdown
- Delete with an inline confirm
- Loading skeleton, empty state and an error banner that never disguises a failed request
  as "no links"
- Responsive down to 390px; keyboard reachable; `prefers-reduced-motion` respected

## API calls

Defined in [`backend/fastapi/README.md`](../../../backend/fastapi/README.md):

- `POST /api/links` — create (needs `X-Owner-Token`)
- `GET /api/links` — list this browser's links (needs `X-Owner-Token`)
- `GET /api/limits` — slots and retention shown in the UI
- `GET /api/links/{id}` — details and analytics (needs `X-Owner-Token`)
- `DELETE /api/links/{id}` — delete (needs `X-Owner-Token`)
