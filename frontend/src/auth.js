// src/auth.js
// Clean, minimal, and correct auth helper for FastAPI + Vite dev setup.
// It exports: getToken, setToken, isLoggedIn, logout, login, authFetch, and default auth.

const AUTH_STORAGE_KEY = "auth_token";

/* -------------------------------------------------------------------------- */
/*  1. Base URL detection — works both in dev (Vite 5173) and production      */
/* -------------------------------------------------------------------------- */
let RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

// --- In dev (Vite :5173) point to FastAPI backend on :8000 ---
if (typeof location !== "undefined" && location.port === "5173") {
  if (!RAW_BASE || RAW_BASE === "/api") {
    // 👇 if your backend routes look like /api/auth/login, keep /api here
    RAW_BASE = `${location.protocol}//${location.hostname}:8000/api`;
    // 👉 if your backend routes are just /auth/login (no /api prefix),
    // then change the above line to:
    // RAW_BASE = `${location.protocol}//${location.hostname}:8000`;
  }
}

/* -------------------------------------------------------------------------- */
/*  2. Normalize base — keeps scheme safe, trims trailing slashes             */
/* -------------------------------------------------------------------------- */
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
/*  3. Token helpers                                                          */
/* -------------------------------------------------------------------------- */
export function getToken() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}
export function setToken(v) {
  try {
    v
      ? localStorage.setItem(AUTH_STORAGE_KEY, v)
      : localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
}
export function isLoggedIn() {
  return !!getToken();
}
export function logout() {
  setToken(null);
  if (typeof window !== "undefined") window.location.href = "/login";
}

/* -------------------------------------------------------------------------- */
/*  4. URL join helper (never breaks http://)                                 */
/* -------------------------------------------------------------------------- */
function makeUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(API_BASE)) {
    return new URL(p, API_BASE).toString();
  }
  return `${API_BASE}${p}`;
}

/* -------------------------------------------------------------------------- */
/*  5. Low-level fetch helpers                                                */
/* -------------------------------------------------------------------------- */
async function doFetch(url, options = {}) {
  const finalUrl = makeUrl(url);
  return fetch(finalUrl, { credentials: "include", ...options });
}

export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const tok = getToken();
  if (tok && !headers.has("Authorization"))
    headers.set("Authorization", `Bearer ${tok}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return doFetch(path, { ...options, headers });
}

/* -------------------------------------------------------------------------- */
/*  6. Login that works with both token + cookie backends                     */
/* -------------------------------------------------------------------------- */
export async function login(username, password) {
  const attempts = [
    // Most FastAPI apps
    { method: "POST", path: "/auth/token", form: { grant_type: "password", username, password } },
    // Alternative JSON login
    { method: "POST", path: "/auth/login", json: { username, password } },
    // Cookie-based
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

      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {}

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
/*  7. Export unified auth object                                             */
/* -------------------------------------------------------------------------- */
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
