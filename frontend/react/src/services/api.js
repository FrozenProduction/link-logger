const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Request failed with status ${res.status}`);
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

export const deleteLink = (id) =>
  request(`/api/links/${id}`, { method: "DELETE" });

export const getLinkDetail = (id) => request(`/api/links/${id}`);
