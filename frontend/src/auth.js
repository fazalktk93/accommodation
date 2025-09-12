// frontend/src/auth.js
// Export surface kept: getToken, setToken, isLoggedIn, logout, login, auth.fetch
// Added: named export authFetch to satisfy imports expecting it.

const AUTH_STORAGE_KEY = "auth_token";

let RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

// --- normalize base once (no trailing slash) ---
function normBase(b) {
  if (!b) return "/api";
  // ensure it starts with "/" or "http"
  if (!/^https?:\/\//i.test(b) && !b.startsWith("/")) b = "/" + b;
  // collapse duplicate "api" like "/api/api"
  b = b.replace(/\/{2,}/g, "/");
  b = b.replace(/\/api\/?api(\/|$)/, "/api$1");
  if (b.endsWith("/")) b = b.slice(0, -1);
  return b;
}
const API_BASE = normBase(RAW_BASE);

// ---------- token helpers ----------
export function getToken() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}
export function setToken(v) {
  try {
    if (v) localStorage.setItem(AUTH_STORAGE_KEY, v);
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}
export function isLoggedIn() {
  return !!getToken();
}
export function logout() {
  setToken(null);
  if (typeof window !== "undefined") window.location.href = "/login";
}

// ---------- URL join that avoids "/api/api" ----------
function joinUrl(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path || "";
  const baseNoSlash = base.endsWith("/") ? base.slice(0, -1) : base;
  const pathNoSlash = p.startsWith("/") ? p : "/" + p;

  // If base already ends with "/api" AND path begins with "/api/", drop one "api"
  if (baseNoSlash.endsWith("/api") && pathNoSlash.startsWith("/api/")) {
    return baseNoSlash + pathNoSlash.replace(/^\/api/, "");
  }
  return (baseNoSlash + pathNoSlash).replace(/\/{2,}/g, "/");
}

// ---------- internal fetch helper (always includes cookies) ----------
async function doFetch(url, options = {}) {
  const finalUrl = joinUrl(API_BASE, url);
  const res = await fetch(finalUrl, { credentials: "include", ...options });
  return res;
}

// Authorized fetch: attaches Bearer token if present and always sends cookies
export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const opts = { ...options, headers };
  return doFetch(path, opts);
}

// Login that works with JSON/form and multiple common endpoints
// Fixes 422/401 in mixed backends
export async function login(username, password) {
  const attempts = [
    { path: "/auth/login", type: "json" },
    { path: "/auth/login", type: "form" },
    { path: "/auth/jwt/login", type: "json" },
    { path: "/auth/jwt/login", type: "form" },
    { path: "/auth/token", type: "form" },
    { path: "/login", type: "form" },
  ];

  let lastErr = null;
  for (const a of attempts) {
    try {
      const headers = new Headers();
      let body;
      if (a.type === "form") {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
        body = new URLSearchParams({ username, password });
      } else {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify({ username, password });
      }

      const res = await doFetch(a.path, { method: "POST", headers, body });
      if (!res.ok) {
        lastErr = await res.text().catch(() => String(res.status));
        continue;
      }
      // Parse and capture token if present
      const dataText = await res.text();
      let data = null;
      try { data = dataText ? JSON.parse(dataText) : null; } catch { /* text */ }
      const accessToken =
        data?.access_token ||
        data?.token ||
        data?.data?.access_token ||
        null;
      if (accessToken) setToken(accessToken);
      // even if no token, cookie session may be set—still OK
      return { ok: true, data: data ?? {} };
    } catch (e) {
      lastErr = String(e);
    }
  }
  return { ok: false, error: lastErr || "Login failed" };
}

export const auth = {
  get token() {
    return getToken();
  },
  set token(v) {
    setToken(v);
  },
  isLoggedIn,
  logout,
  login,
  fetch: authFetch,
};
export default auth;
