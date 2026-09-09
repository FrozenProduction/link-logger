import { useState, useEffect } from "react";
import { listLinks, deleteLink } from "./services/api.js";
import LinkForm from "./components/LinkForm.jsx";
import LinkList from "./components/LinkList.jsx";
import LinkDetail from "./components/LinkDetail.jsx";
import { styles } from "./components/styles.js";

function App() {
  const [links, setLinks] = useState([]);
  const [showDetail, setShowDetail] = useState(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      setLinks(await listLinks());
    } catch (err) {
      console.error("Error loading links:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this link?")) return;
    try {
      await deleteLink(id);
      fetchLinks();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Link Logger</h1>
        <p style={styles.subtitle}>URL shortener with analytics</p>
      </header>

      <main style={styles.main}>
        <LinkForm onCreated={fetchLinks} />

        <LinkList
          links={links}
          onDelete={handleDelete}
          onShowDetail={setShowDetail}
        />

        {/* Link detail */}
        {showDetail && (
          <section style={styles.card}>
            <h2>Analytics — Link #{showDetail}</h2>
            <LinkDetail linkId={showDetail} onClose={() => setShowDetail(null)} />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
