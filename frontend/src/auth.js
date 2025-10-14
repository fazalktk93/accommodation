// src/auth.js
// Minimal and stable: always call relative /api/...; let the proxy handle the host.

const AUTH_STORAGE_KEY = "auth_token";

/* 1) Token utils */
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

/* 2) Build URLs — always under /api (same origin) */
function api(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `/api${p}`; // <-- single source of truth
}

/* 3) Fetch helpers */
async function doFetch(path, options = {}) {
  const url = /^https?:\/\//i.test(path) ? path : api(path);
  return fetch(url, { credentials: "include", ...options });
}
export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const tok = getToken();
  if (tok && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${tok}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return doFetch(path, { ...options, headers });
}

/* 4) Login that supports OAuth2 form, JSON, or cookie-based */
export async function login(username, password) {
  const attempts = [
    { method: "POST", path: "/auth/token", form: { grant_type: "password", username, password } }, // FastAPI OAuth2
    { method: "POST", path: "/auth/login", json: { username, password } },                          // JSON login
    { method: "POST", path: "/auth/cookie-login", json: { username, password } },                   // Cookie login
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      const headers = new Headers();
      let body;
      if (a.form) { headers.set("Content-Type","application/x-www-form-urlencoded"); body = new URLSearchParams(a.form); }
      else        { headers.set("Content-Type","application/json");                  body = JSON.stringify(a.json); }

      const res = await doFetch(a.path, { method: a.method, headers, body });
      const text = await res.text();
      if (!res.ok) { lastErr = text || `${res.status}`; continue; }

      let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
      const access = data?.access_token || data?.token || data?.data?.access_token || null;
      if (access) setToken(access);
      return { ok: true, data: data ?? {} };
    } catch (e) { lastErr = String(e); }
  }
  return { ok: false, error: lastErr || "Login failed" };
}

/* 5) Unified export */
export const auth = {
  get token() { return getToken(); },
  set token(v) { setToken(v); },
  isLoggedIn,
  logout,
  login,
  fetch: authFetch,
};
export default auth;
