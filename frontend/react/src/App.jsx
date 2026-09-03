import { useState, useEffect } from "react";

function App() {
  const [links, setLinks] = useState([]);
  const [originalUrl, setOriginalUrl] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDetail, setShowDetail] = useState(null);

  const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/links`);
      const data = await res.json();
      setLinks(data);
    } catch (err) {
      console.error("Error loading links:", err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_url: originalUrl,
          custom_code: customCode || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create link");
      }

      const data = await res.json();
      setSuccess(`Link created! Short URL: ${data.short_url}`);
      setOriginalUrl("");
      setCustomCode("");
      fetchLinks();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this link?")) return;
    try {
      await fetch(`${API_BASE}/api/links/${id}`, { method: "DELETE" });
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
        {/* Create link form */}
        <section style={styles.card}>
          <h2>Create short link</h2>
          <form onSubmit={handleCreate} style={styles.form}>
            <input
              type="url"
              placeholder="https://example.com/very-long-article"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              required
              style={styles.input}
            />
            <input
              type="text"
              placeholder="Custom code (optional)"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              style={styles.input}
            />
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Creating..." : "Create link"}
            </button>
          </form>

          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </section>

        {/* Links list */}
        <section style={styles.card}>
          <h2>My links ({links.length})</h2>

          {links.length === 0 ? (
            <p style={styles.empty}>No links created yet.</p>
          ) : (
            <ul style={styles.list}>
              {links.map((link) => (
                <li key={link.id} style={styles.listItem}>
                  <div style={styles.linkInfo}>
                    <span style={styles.shortUrl}>{link.short_url}</span>
                    <span style={styles.originalUrl}>{link.original_url}</span>
                    <span style={styles.meta}>
                      Clicks: {link.clicks} · Created:{" "}
                      {new Date(link.created_at).toLocaleDateString("en-US")}
                    </span>
                  </div>
                  <div style={styles.actions}>
                    <button
                      onClick={() => setShowDetail(link.id)}
                      style={styles.detailButton}
                    >
                      View analytics
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      style={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Link detail */}
        {showDetail && (
          <section style={styles.card}>
            <h2>Analytics — Link #{showDetail}</h2>
            <ApiDetail linkId={showDetail} onClose={() => setShowDetail(null)} />
          </section>
        )}
      </main>
    </div>
  );
}

function ApiDetail({ linkId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const apiUrl = import.meta.env?.VITE_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/api/links/${linkId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [linkId]);

  if (!data) return <p>Loading...</p>;

  return (
    <div style={styles.detailContainer}>
      <button onClick={onClose} style={styles.closeButton}>
        ×
      </button>
      <div style={styles.detailContent}>
        <p>
          <strong>Original URL:</strong> {data.original_url}
        </p>
        <p>
          <strong>Short URL:</strong> {data.short_url}
        </p>
        <p>
          <strong>Total clicks:</strong> {data.clicks}
        </p>
        <p>
          <strong>Created:</strong> {new Date(data.created_at).toLocaleString("en-US")}
        </p>

        {data.clicks_breakdown && Object.keys(data.clicks_breakdown).length > 0 && (
          <div style={styles.stats}>
            <h3>Clicks per day</h3>
            <div style={styles.statsGrid}>
              {Object.entries(data.clicks_breakdown).map(([day, count]) => (
                <div key={day} style={styles.statItem}>
                  <span style={styles.statDay}>{day}</span>
                  <span style={styles.statCount}>{count} clicks</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Simple inline styles */
const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#f5f5f5",
    minHeight: "100vh",
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
  },
  subtitle: {
    color: "#666",
    margin: "8px 0 0",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  input: {
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "16px",
    width: "100%",
    boxSizing: "border-box",
  },
  button: {
    padding: "12px 24px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
  },
  error: {
    color: "#dc2626",
    margin: "8px 0 0",
    fontSize: "14px",
  },
  success: {
    color: "#16a34a",
    margin: "8px 0 0",
    fontSize: "14px",
    fontWeight: "500",
  },
  list: {
    listStyle: "none",
    padding: "0",
    margin: "0",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
  },
  linkInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  shortUrl: {
    fontWeight: "600",
    color: "#2563eb",
    wordBreak: "break-all",
  },
  originalUrl: {
    color: "#4b5563",
    fontSize: "14px",
    wordBreak: "break-all",
  },
  meta: {
    color: "#6b7280",
    fontSize: "13px",
    marginTop: "4px",
  },
  actions: {
    display: "flex",
    gap: "8px",
    marginLeft: "12px",
  },
  detailButton: {
    padding: "6px 12px",
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
  },
  deleteButton: {
    padding: "6px 12px",
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
  },
  empty: {
    color: "#6b7280",
    textAlign: "center",
    padding: "20px",
  },
  detailContainer: {
    position: "relative",
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    marginTop: "24px",
  },
  closeButton: {
    position: "absolute",
    top: "12px",
    right: "12px",
    fontSize: "24px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#6b7280",
    lineHeight: "1",
  },
  detailContent: {
    marginTop: "8px",
  },
  stats: {
    marginTop: "20px",
    paddingTop: "20px",
    borderTop: "1px solid #e5e7eb",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "12px",
    marginTop: "12px",
  },
  statItem: {
    backgroundColor: "#f9fafb",
    padding: "12px",
    borderRadius: "8px",
    textAlign: "center",
  },
  statDay: {
    display: "block",
    color: "#6b7280",
    fontSize: "13px",
    marginBottom: "4px",
  },
  statCount: {
    display: "block",
    fontWeight: "600",
    color: "#111827",
    fontSize: "18px",
  },
};

export default App;
