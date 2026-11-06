// Relative by default: the app is served by the same origin as the API in
// production, and vite proxies /api in dev. A hardcoded absolute default made
// every deployment that did not set VITE_API_URL call someone's localhost.
const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");

// FastAPI returns `detail` as a string for HTTPException, but as an ARRAY of
// error objects for 422 validation failures. `new Error(array)` stringifies to
// "[object Object]", which is what the old UI showed the user. Flatten it.
function messageFrom(detail, status) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (typeof d === "string" ? d : d?.msg))
      .filter(Boolean)
      .map((m) => m.replace(/^Value error,\s*/i, "").replace(/^Input should be a valid URL.*/i, "That is not a valid URL"));
    if (msgs.length) return msgs.join(". ");
  }
  return `Request failed (${status})`;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the API. Is the server running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(messageFrom(body?.detail, res.status));
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const listLinks = () => request("/api/links");

export const createLink = (original_url, custom_code) =>
  request("/api/links", {
    method: "POST",
    body: JSON.stringify({ original_url, custom_code: custom_code || null }),
  });

export const deleteLink = (id) => request(`/api/links/${id}`, { method: "DELETE" });

export const getLinkDetail = (id) => request(`/api/links/${id}`);
