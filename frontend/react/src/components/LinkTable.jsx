import { useState } from "react";
import { formatDate } from "../utils/format.js";
import CopyButton from "./CopyButton.jsx";

function Skeleton() {
  return (
    <div aria-hidden="true">
      {[86, 72, 94].map((w, i) => (
        <div className="skel" key={i}>
          <div className="skel__bar" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function LinkTable({ links, loading, onDelete, onOpen, activeId }) {
  const [confirmId, setConfirmId] = useState(null);

  if (loading) return <Skeleton />;

  if (links.length === 0)
    return (
      <div className="empty">
        <h2>No links yet</h2>
        <p>Paste a long URL above and it comes back short, with a click count that updates every time someone follows it.</p>
      </div>
    );

  return (
    <>
      <div className="table__head" role="row">
        <span>Short link</span>
        <span>Destination</span>
        <span>Clicks</span>
        <span>Created</span>
        <span />
      </div>

      <ul className="table__body">
        {links.map((link) => {
          const confirming = confirmId === link.id;
          return (
            <li className="row" key={link.id}>
              <CopyButton value={link.short_url} className="code" label={`/${link.short_code}`} />

              <a
                className="dest"
                href={link.original_url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.original_url}
              >
                {link.original_url.replace(/^https?:\/\//, "")}
              </a>

              <span className="clicks">{link.clicks}</span>
              <span className="when">{formatDate(link.created_at)}</span>

              <div className="actions">
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => onOpen(link.id)}
                  aria-expanded={activeId === link.id}
                >
                  {link.clicks > 0 ? "Analytics" : "Details"}
                </button>
                <a className="btn-quiet" href={link.short_url} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
                {confirming ? (
                  <>
                    <button
                      type="button"
                      className="btn-quiet btn-quiet--danger"
                      onClick={() => {
                        setConfirmId(null);
                        onDelete(link.id);
                      }}
                    >
                      Confirm
                    </button>
                    <button type="button" className="btn-quiet" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn-quiet btn-quiet--danger" onClick={() => setConfirmId(link.id)}>
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
