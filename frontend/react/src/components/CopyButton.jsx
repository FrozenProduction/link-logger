import { useState, useRef, useEffect } from "react";

/**
 * Copies `value` and confirms visibly for 1.6s.
 * navigator.clipboard needs a secure context, so file:// and plain http fall
 * back to a hidden textarea + execCommand instead of failing silently.
 */
export default function CopyButton({ value, label = "Copy", className = "btn-quiet", ariaLabel }) {
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

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite" aria-label={ariaLabel}>
      {done ? "Copied" : label}
    </button>
  );
}
