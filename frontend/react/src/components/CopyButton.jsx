import { useState, useRef, useEffect } from "react";

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        d="M5.5 5.5V3.2c0-.7.5-1.2 1.2-1.2h6.1c.7 0 1.2.5 1.2 1.2v6.1c0 .7-.5 1.2-1.2 1.2h-2.3"
      />
      <rect x="2" y="5.5" width="8.5" height="8.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M2.5 8.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

/**
 * Copies `value` and confirms visibly for 1.6s.
 * navigator.clipboard needs a secure context, so file:// and plain http fall
 * back to a hidden textarea + execCommand instead of failing silently.
 *
 * `compact` renders an icon-only button for use beside a link, where the row's
 * primary action is opening the short URL.
 */
export default function CopyButton({ value, label = "Copy", className = "btn-quiet", ariaLabel, compact = false }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        ta.remove();
      }
    }
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  };

  if (compact) {
    return (
      <button
        type="button"
        className={`copy-icon ${done ? "copy-icon--done" : ""}`}
        onClick={copy}
        aria-label={ariaLabel || label}
        title={done ? "Copied" : ariaLabel || label}
        aria-live="polite"
      >
        {done ? <CheckIcon /> : <CopyIcon />}
      </button>
    );
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite" aria-label={ariaLabel}>
      {done ? "Copied" : label}
    </button>
  );
}
