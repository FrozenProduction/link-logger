// Human date for timestamps: relative under 7 days ("3 days ago"),
// European absolute after that ("5 Sep 2026"). Never seconds.
export function formatDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs >= 0) {
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-11-06" -> "6 Nov". The API groups clicks by DATE(), which is raw ISO. */
export function formatDay(value) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Retention, in the same voice as formatDate: "expires in 23 days" — never a
 *  bare timestamp, because the question a user has is "how long do I have". */
export function formatExpiry(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const remaining = d.getTime() - Date.now();
  if (remaining <= 0) return "expired";
  const days = Math.floor(remaining / 86400000);
  if (days >= 1) return `expires in ${days} day${days === 1 ? "" : "s"}`;
  return "expires today";
}
