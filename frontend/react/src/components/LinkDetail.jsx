import { useState, useEffect } from "react";
import { getLinkDetail } from "../services/api.js";
import { formatDate } from "../utils/format.js";
import { styles } from "./styles.js";

export default function LinkDetail({ linkId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    getLinkDetail(linkId).then(setData).catch(console.error);
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
          <strong>Created:</strong> {formatDate(data.created_at)}
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
