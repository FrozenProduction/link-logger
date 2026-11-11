import { useCallback, useEffect, useState } from "react";
import { listLinks, deleteLink, getLimits } from "./services/api.js";
import CreateBar from "./components/CreateBar.jsx";
import LinkTable from "./components/LinkTable.jsx";
import DetailDrawer from "./components/DetailDrawer.jsx";

// Shown until /api/limits answers, and kept if it ever fails: the limit is a
// label, not a reason to leave the page empty.
const DEFAULT_LIMITS = { links_per_owner: 10, ttl_days: 30 };

export default function App() {
  const [links, setLinks] = useState([]);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      // A failure here must NOT look like "you have no links" — the previous
      // list stays on screen and the banner says what actually happened.
      const [nextLinks, nextLimits] = await Promise.all([
        listLinks(),
        getLimits().catch(() => null),
      ]);
      setLinks(nextLinks);
      if (nextLimits) setLimits(nextLimits);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id) => {
    try {
      await deleteLink(id);
      if (detailId === id) setDetailId(null); // the drawer must not outlive its link
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="app">
        <header className="masthead">
          <h1 className="brand">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <g transform="translate(16 16) rotate(45) translate(-16 -16)" fill="currentColor">
                <path fillRule="evenodd" d="M4 11h10v10H4Zm3 3h4v4H7Z" />
                <path fillRule="evenodd" d="M18 11h10v10H18Zm3 3h4v4h-4Z" />
              </g>
            </svg>
            Link Logger
          </h1>
          <div className="masthead__meta">
            <span className="count">
              {links.length}/{limits.links_per_owner} links
            </span>
            <span className={`status ${error ? "status--offline" : ""}`}>
              {error ? "api offline" : "api ok"}
            </span>
          </div>
        </header>

        <main>
          <CreateBar onCreated={load} />

          {error && (
            <div className="notice" role="alert">
              <span>{error}</span>
              <button type="button" className="btn-quiet" onClick={load}>
                Retry
              </button>
            </div>
          )}

          <LinkTable
            links={links}
            limits={limits}
            loading={loading}
            onDelete={handleDelete}
            onOpen={setDetailId}
            activeId={detailId}
          />
        </main>
      </div>

      <footer className="foot">
        <div className="foot__in">
          <span>Link Logger</span>
          <span>
            {limits.links_per_owner} links per browser · {limits.ttl_days}-day retention
          </span>
          <span>FastAPI · React · libSQL</span>
        </div>
      </footer>

      <DetailDrawer linkId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
