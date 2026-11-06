import { useCallback, useEffect, useState } from "react";
import { listLinks, deleteLink } from "./services/api.js";
import CreateBar from "./components/CreateBar.jsx";
import LinkTable from "./components/LinkTable.jsx";
import DetailDrawer from "./components/DetailDrawer.jsx";

export default function App() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      // A failure here must NOT look like "you have no links" — the previous
      // list stays on screen and the banner says what actually happened.
      setLinks(await listLinks());
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
          <h1>Link Logger</h1>
          <div className="masthead__meta">
            <span className="count">
              {links.length} {links.length === 1 ? "link" : "links"}
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
          <span>FastAPI · React · SQLite</span>
        </div>
      </footer>

      <DetailDrawer linkId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
