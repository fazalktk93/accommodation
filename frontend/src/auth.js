// src/auth.js
// Robust auth helper for FastAPI (backend has API prefix "/api").
// Exports: getToken, setToken, isLoggedIn, logout, login, authFetch, default auth.

const AUTH_STORAGE_KEY = "auth_token";

/* -------------------------------------------------------------------------- */
/* 1) Resolve API base                                                         */
/* -------------------------------------------------------------------------- */
let RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api"; // default to API prefix

// In Vite dev (:5173) with no explicit base, point to backend on :8000 **with /api**
if (typeof location !== "undefined" && location.port === "5173") {
  if (!RAW_BASE || RAW_BASE === "/api") {
    RAW_BASE = `${location.protocol}//${location.hostname}:8000/api`;
  }
}

// Normalize base (preserve scheme, trim trailing slash)
function normBase(b) {
  if (!b) return "/api";
  if (/^https?:\/\//i.test(b)) {
    const u = new URL(b);
    u.pathname = u.pathname.replace(/\/+$/g, "");
    return u.toString().replace(/\/+$/g, "");
  }
  if (!b.startsWith("/")) b = "/" + b;
  return b.replace(/\/+$/g, "");
}
const API_BASE = normBase(RAW_BASE);

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
/* 3) URL builder (never breaks http://)                                       */
/* -------------------------------------------------------------------------- */
function makeUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;                // already absolute
  const p = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(API_BASE)) return new URL(p, API_BASE).toString(); // join on absolute base
  return `${API_BASE}${p}`;                                   // base is "/api"
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
/* 5) Login (works with OAuth2 form, JSON, or cookie sessions)                 */
/* -------------------------------------------------------------------------- */
export async function login(username, password) {
  const attempts = [
    // OAuth2PasswordRequestForm (prevents 422)
    { method: "POST", path: "/auth/token", form: { grant_type: "password", username, password } },
    // JSON login (if backend supports it)
    { method: "POST", path: "/auth/login", json: { username, password } },
    // Cookie-based login (optional)
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
      if (!res.ok) { lastErr = text || `${res.status}`; continue; }

      let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
      const accessToken =
        data?.access_token || data?.token || data?.data?.access_token || null;
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
