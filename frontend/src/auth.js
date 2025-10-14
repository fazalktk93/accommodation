// src/auth.js
// Final version for setups where the backend is exposed under **/api** (same origin or proxy).
// This file prefixes every request with /api and never hardcodes a host/port.

// Public API:
//   getToken, setToken, isLoggedIn, logout, login, authFetch
//   default export `auth` with { token getter/setter, isLoggedIn, logout, login, fetch }

const AUTH_STORAGE_KEY = "auth_token";

/* -------------------------------------------------------------------------- */
/* 1) API base                                                                */
/* -------------------------------------------------------------------------- */
// If you ever set VITE_API_BASE_URL, you can use either "/api" (relative) or a full URL like "https://example.com/api".
// For your case you said "I have only /api", so the default below already works.
const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "/api";

// Normalize to either "/api" (relative) or "https://host/api" (absolute), with no trailing slash.
function normalizeBase(b) {
  if (!b) return "/api";
  if (/^https?:\/\//i.test(b)) {
    const u = new URL(b);
    u.pathname = u.pathname.replace(/\/+$/g, "");
    return u.toString().replace(/\/+$/g, "");
  }
  // relative path
  let p = b;
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/+$/g, "");
}
const API_BASE = normalizeBase(RAW_BASE); // e.g. "/api"

/* -------------------------------------------------------------------------- */
/* 2) Token helpers                                                            */
/* -------------------------------------------------------------------------- */
export function getToken() {
  try { return localStorage.getItem(AUTH_STORAGE_KEY); } catch { return null; }
}
export function setToken(v) {
  try {
    v ? localStorage.setItem(AUTH_STORAGE_KEY, v)
      : localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
}
export function isLoggedIn() { return !!getToken(); }
export function logout() {
  setToken(null);
  if (typeof window !== "undefined") window.location.href = "/login";
}

/* -------------------------------------------------------------------------- */
/* 3) URL builder — ALWAYS resolves to /api/...                                */
/* -------------------------------------------------------------------------- */
function makeUrl(path) {
  // already absolute => use as-is
  if (/^https?:\/\//i.test(path)) return path;

  // ensure leading slash
  const p = path.startsWith("/") ? path : `/${path}`;

  // API_BASE may be absolute or relative. Join safely.
  if (/^https?:\/\//i.test(API_BASE)) {
    return new URL(p, API_BASE).toString();
  }
  // relative base like "/api"
  return `${API_BASE}${p}`;
}

/* -------------------------------------------------------------------------- */
/* 4) Fetch helpers                                                            */
/* -------------------------------------------------------------------------- */
async function doFetch(url, options = {}) {
  const finalUrl = makeUrl(url);
  return fetch(finalUrl, { credentials: "include", ...options });
}

export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const tok = getToken();
  if (tok && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${tok}`);
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return doFetch(path, { ...options, headers });
}

/* -------------------------------------------------------------------------- */
/* 5) Login — supports OAuth2 form, JSON, and cookie flows (all under /api)    */
/* -------------------------------------------------------------------------- */
export async function login(username, password) {
  // Your backend exposes /api/auth/token, /api/auth/login, /api/auth/cookie-login
  const attempts = [
    // FastAPI OAuth2PasswordRequestForm (prevents 422)
    { method: "POST", path: "/auth/token", form: { grant_type: "password", username, password } },
    // JSON login (if supported)
    { method: "POST", path: "/auth/login", json: { username, password } },
    // Cookie-based login (if present)
    { method: "POST", path: "/auth/cookie-login", json: { username, password } },
  ];

  let lastErr = null;

  for (const a of attempts) {
    try {
      const headers = new Headers();
      let body;

      if (a.form) {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
        body = new URLSearchParams(a.form);
      } else if (a.json) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(a.json);
      }

      const res = await doFetch(a.path, { method: a.method, headers, body });
      const text = await res.text();

      if (!res.ok) {
        lastErr = text || `${res.status}`;
        continue;
      }

      // Parse optional token payload
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      const accessToken =
        data?.access_token ||
        data?.token ||
        data?.data?.access_token ||
        null;

      if (accessToken) setToken(accessToken);
      return { ok: true, data: data ?? {} };
    } catch (e) {
      lastErr = String(e);
    }
  }

  return { ok: false, error: lastErr || "Login failed" };
}

/* -------------------------------------------------------------------------- */
/* 6) Unified export                                                           */
/* -------------------------------------------------------------------------- */
export const auth = {
  get token() { return getToken(); },
  set token(v) { setToken(v); },
  isLoggedIn,
  logout,
  login,
  fetch: authFetch,
};

export default auth;
