import { useEffect, useRef, useState } from "react";
import { getLinkDetail } from "../services/api.js";
import { formatDate, formatDay, formatExpiry } from "../utils/format.js";
import CopyButton from "./CopyButton.jsx";

export default function DetailDrawer({ linkId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const closeRef = useRef(null);
  const drawerRef = useRef(null);
  const restoreRef = useRef(null);
  const open = linkId != null;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    getLinkDetail(linkId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.status === 404 ? "This link no longer exists." : e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [linkId, open]);

  // A closed drawer must be unreachable: it still renders (for the slide
  // transition), so without `inert` its buttons stay in the tab order and in
  // the accessibility tree — an aria-hidden-with-focusable-children violation.
  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open;
  }, [open]);

  // Escape closes; Tab is trapped inside; focus starts on the close button.
  // aria-modal="true" promises all three, so the trap is not optional.
  useEffect(() => {
    if (!open) return;
    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = drawerRef.current;
      if (!panel) return;
      const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const outside = !panel.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    restoreRef.current = document.activeElement; // where focus goes back to on close
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  const days = data?.clicks_breakdown ? Object.entries(data.clicks_breakdown) : [];
  const max = days.reduce((m, [, n]) => Math.max(m, n), 0);

  return (
    <>
      <div
        className={`scrim ${open ? "scrim--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className={`drawer ${open ? "drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Link analytics"
      >
        <div className="drawer__top">
          <h2>{data ? `/${data.short_code}` : "Analytics"}</h2>
          <button ref={closeRef} type="button" className="drawer__close" onClick={onClose} aria-label="Close analytics">
            ×
          </button>
        </div>

        {loading && <p className="drawer__k">Loading…</p>}
        {error && <p className="drawer__k">{error}</p>}

        {data && (
          <>
            <p className="drawer__k">Total clicks</p>
            <p className="big">{data.clicks}</p>

            <p className="drawer__k">Short link</p>
            <p className="drawer__v">
              <CopyButton value={data.short_url} className="btn-quiet" label={data.short_url} />
            </p>

            <p className="drawer__k">Destination</p>
            <p className="drawer__v">
              <a className="dest" href={data.original_url} target="_blank" rel="noopener noreferrer">
                {data.original_url}
              </a>
            </p>

            <p className="drawer__k">Created</p>
            <p className="drawer__v">{formatDate(data.created_at)}</p>

            <p className="drawer__k">Retention</p>
            <p className="drawer__v">{formatExpiry(data.expires_at)}</p>

            <p className="drawer__k">Clicks per day</p>
            {days.length === 0 ? (
              <p className="drawer__v">No clicks recorded yet.</p>
            ) : (
              <div className="days">
                {days.map(([day, count]) => (
                  <div className="day" key={day}>
                    <span className="day__d">{formatDay(day)}</span>
                    <span className="day__track">
                      <span
                        className="day__bar"
                        style={{ width: `${max ? Math.max(6, (count / max) * 100) : 0}%`, display: "block" }}
                      />
                    </span>
                    <span className="day__n">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
