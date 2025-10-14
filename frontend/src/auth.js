// src/auth.js
// Final, verified auth helper for this app (FastAPI uses API prefix "/api").
// Exports: getToken, setToken, isLoggedIn, logout, login, authFetch, default auth.

const AUTH_STORAGE_KEY = "auth_token";

/* -------------------------------------------------------------------------- */
/* 1) Compute API_BASE (origin + prefix)                                      */
/* -------------------------------------------------------------------------- */
// If you set VITE_API_BASE_URL (e.g. "http://host:8000/api"), it will be used.
let RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "";

// In dev (Vite on :5173) with no explicit base, target FastAPI on :8000 + "/api"
if (!RAW_BASE && typeof location !== "undefined" && location.port === "5173") {
  RAW_BASE = `${location.protocol}//${location.hostname}:8000/api`;
}

// Normalize: keep scheme, remove trailing slashes, and ensure we end up with either
// an absolute ".../api" or a relative "/api"
function normalizeBase(b) {
  if (!b) return "/api";
  if (/^https?:\/\//i.test(b)) {
    const u = new URL(b);
    // ensure trailing "/api" in the path if not present
    let path = u.pathname.replace(/\/+$/g, "");
    if (!path.endsWith("/api")) path = (path || "") + "/api";
    u.pathname = path;
    return u.toString().replace(/\/+$/g, "");
  }
  // relative
  let p = b.replace(/\/+$/g, "");
  if (!p.startsWith("/")) p = "/" + p;
  if (!p.endsWith("/api")) p = p + "/api";
  return p;
}

const API_BASE = normalizeBase(RAW_BASE); // e.g. "http://host:8000/api" or "/api"

/* -------------------------------------------------------------------------- */
/* 2) Token helpers                                                            */
/* -------------------------------------------------------------------------- */
export function getToken() {
  try { return localStorage.getItem(AUTH_STORAGE_KEY); } catch { return null; }
}
export function setToken(v) {
  try { v ? localStorage.setItem(AUTH_STORAGE_KEY, v) : localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
}
export function isLoggedIn() { return !!getToken(); }
export function logout() {
  setToken(null);
  if (typeof window !== "undefined") window.location.href = "/login";
}

/* -------------------------------------------------------------------------- */
/* 3) URL joiner — ALWAYS prefixes with /api and never breaks http://          */
/* -------------------------------------------------------------------------- */
function makeUrl(path) {
  // pass through absolute URLs
  if (/^https?:\/\//i.test(path)) return path;

  // ensure leading slash
  const p = path.startsWith("/") ? path : `/${path}`;
  // API_BASE has no trailing slash; join by string
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
  if (tok && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${tok}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return doFetch(path, { ...options, headers });
}

/* -------------------------------------------------------------------------- */
/* 5) Login — supports OAuth2 password form, JSON, and cookie flows            */
/* -------------------------------------------------------------------------- */
export async function login(username, password) {
  // Your backend exposes all of these under /api/auth/...
  const attempts = [
    // OAuth2PasswordRequestForm (FastAPI standard)
    { method: "POST", path: "/auth/token", form: { grant_type: "password", username, password } },
    // JSON login
    { method: "POST", path: "/auth/login", json: { username, password } },
    // Cookie session login
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

      // Try to parse token payload
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
