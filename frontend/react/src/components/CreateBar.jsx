import { useState } from "react";
import { createLink } from "../services/api.js";
import CopyButton from "./CopyButton.jsx";

const CODE_RE = /^[A-Za-z0-9_-]{3,20}$/;

/** Adds https:// when someone types "example.com" — never rewrites a real scheme. */
function normaliseUrl(raw) {
  const v = raw.trim();
  if (!v) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  if (/\s/.test(v)) return v;
  return `https://${v}`;
}

export default function CreateBar({ onCreated }) {
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const codeIsBad = code.length > 0 && !CODE_RE.test(code);

  const submit = async (e) => {
    e.preventDefault();
    if (codeIsBad) return;
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const link = await createLink(normaliseUrl(url), code.trim() || null);
      setCreated(link);
      setUrl("");
      setCode("");
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="create" onSubmit={submit} noValidate>
      <div className="create__field">
        <label className="create__label" htmlFor="url">
          Destination URL
        </label>
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck="false"
          placeholder="example.com/a-long-article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          aria-invalid={error ? "true" : "false"}
        />
      </div>

      <div className="create__field">
        <label className="create__label" htmlFor="code">
          Custom code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          placeholder="optional"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={codeIsBad ? "true" : "false"}
          aria-describedby={codeIsBad ? "code-hint" : undefined}
        />
      </div>

      <button className="btn" type="submit" disabled={busy || codeIsBad || !url.trim()}>
        {busy ? "Creating…" : "Shorten"}
      </button>

      {codeIsBad && (
        <p className="notice" id="code-hint">
          3–20 characters, letters, numbers, hyphen or underscore.
        </p>
      )}
      {error && <p className="notice">{error}</p>}
      {created && (
        <p className="notice notice--ok">
          <span>
            Created <code className="code">{created.short_url}</code>
          </span>
          <CopyButton value={created.short_url} className="btn-quiet" label="Copy link" />
        </p>
      )}
    </form>
  );
}
