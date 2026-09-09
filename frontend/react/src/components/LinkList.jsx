import { formatDate } from "../utils/format.js";
import { styles } from "./styles.js";

export default function LinkList({ links, onDelete, onShowDetail }) {
  return (
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
                  {formatDate(link.created_at)}
                </span>
              </div>
              <div style={styles.actions}>
                <button
                  onClick={() => onShowDetail(link.id)}
                  style={styles.detailButton}
                >
                  View analytics
                </button>
                <button
                  onClick={() => onDelete(link.id)}
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
  );
}
