import { useState } from "react";
import { createLink } from "../services/api.js";
import { styles } from "./styles.js";

export default function LinkForm({ onCreated }) {
  const [originalUrl, setOriginalUrl] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await createLink(originalUrl, customCode);
      setSuccess(`Link created! Short URL: ${data.short_url}`);
      setOriginalUrl("");
      setCustomCode("");
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
}
