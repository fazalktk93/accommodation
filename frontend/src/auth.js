// src/auth.js
// Clean, final auth helper for this app (FastAPI backend uses API prefix "/api").
// Exports: getToken, setToken, isLoggedIn, logout, login, authFetch, default auth.

const AUTH_STORAGE_KEY = "auth_token";

/* -------------------------------------------------------------------------- */
/* 1) Resolve base ORIGIN for the backend (no path here)                       */
/* -------------------------------------------------------------------------- */
let ORIGIN =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_ORIGIN) ||
  (typeof window !== "undefined" && window.API_ORIGIN) ||
  "";

// In Vite dev (:5173), default to FastAPI on :8000 (origin only, no path)
if (!ORIGIN && typeof location !== "undefined" && location.port === "5173") {
  ORIGIN = `${location.protocol}//${location.hostname}:8000`;
}

// Final origin normalization (keep scheme, strip trailing slash)
function normOrigin(v) {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) {
    const u = new URL(v);
    u.pathname = ""; // origin only
    return u.origin;
  }
  return v; // otherwise leave empty (we'll use relative URLs)
}
const API_ORIGIN = normOrigin(ORIGIN);

// The backend API prefix (your FastAPI uses "/api" — do NOT change unless you change backend)
const API_PREFIX = "/api";

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
/* 3) URL builder — ALWAYS ensures "/api/..." path                             */
/* -------------------------------------------------------------------------- */
function ensureApiPath(path) {
  // absolute URLs pass through
  if (/^https?:\/\//i.test(path)) return path;

  // ensure it starts with "/"
  let p = path.startsWith("/") ? path : `/${path}`;

  // prepend /api if missing
  if (!p.startsWith(`${API_PREFIX}/`) && p !== API_PREFIX) {
    p = `${API_PREFIX}${p}`;
  }
  return p;
}

function makeUrl(path) {
  const p = ensureApiPath(path);

  // absolute origin (dev/prod with explicit origin)
  if (API_ORIGIN) {
    return new URL(p, API_ORIGIN).toString();
  }

  // no origin provided → relative to current host (useful behind reverse proxy)
  return p;
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
/* 5) Login (works with OAuth2 form, JSON, or cookie sessions)                 */
/* -------------------------------------------------------------------------- */
export async function login(username, password) {
  const attempts = [
    // Most FastAPI OAuth2 apps
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

      if (!res.ok) {
        lastErr = text || `${res.status}`;
        continue;
      }

      // capture tokens if present
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
