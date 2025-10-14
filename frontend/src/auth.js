// src/auth.js
// Keeps your export surface: getToken, setToken, isLoggedIn, logout, login, auth.fetch
// Also exports named `authFetch` so imports like { authFetch } work.

const AUTH_STORAGE_KEY = "auth_token";

let RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

if (RAW_BASE === "/api" && typeof location !== "undefined" && location.port === "5173") {
  RAW_BASE = `${location.protocol}//${location.hostname}:8000/api`;
}

// --- normalize "/api" once (no trailing slash, no double /api) ---
function normBase(b) {
  if (!b) return "/api";
  if (!/^https?:\/\//i.test(b) && !b.startsWith("/")) b = "/" + b;
  b = b.replace(/\/{2,}/g, "/");                // collapse //
  b = b.replace(/\/api\/?api(\/|$)/, "/api$1"); // drop duplicate api
  if (b.endsWith("/")) b = b.slice(0, -1);
  return b;
}
const API_BASE = normBase(RAW_BASE);

/* ---------- token helpers ---------- */
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

// join base + path without producing "/api/api"
function joinUrl(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const baseNo = base.endsWith("/") ? base.slice(0, -1) : base;
  let rel = path.startsWith("/") ? path : `/${path}`;
  if (baseNo.endsWith("/api") && rel.startsWith("/api/")) rel = rel.replace(/^\/api/, "");
  return (baseNo + rel).replace(/\/{2,}/g, "/");
}

// low-level fetch that always sends cookies
async function doFetch(url, options = {}) {
  const finalUrl = joinUrl(API_BASE, url);
  return fetch(finalUrl, { credentials: "include", ...options });
}

// Authorized fetch: attach Bearer if present (cookie still goes either way)
export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const tok = getToken();
  if (tok && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${tok}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return doFetch(path, { ...options, headers });
}

// ---- Login that matches THIS backend: tries JSON + form + cookie session ----
export async function login(username, password) {
  const attempts = [
    // JSON login (keep if your backend supports it)
    { method: "POST", path: "/auth/login", json: { username, password } },

    // OAuth2PasswordRequestForm requires grant_type=password (prevents 422)
    { method: "POST", path: "/auth/token", form: { grant_type: "password", username, password } },

    // Cookie login (optional; keep if present)
    { method: "POST", path: "/auth/cookie-login", json: { username, password } },
  ];

  let lastErr = null;
  for (const a of attempts) {
    try {
      const h = new Headers();
      let body;
      if (a.type === "form") {
        h.set("Content-Type", "application/x-www-form-urlencoded");
        body = new URLSearchParams({ username, password });
      } else {
        h.set("Content-Type", "application/json");
        body = JSON.stringify({ username, password });
      }

      const res = await doFetch(a.path, { method: "POST", headers: h, body });
      const text = await res.text();
      if (!res.ok) { lastErr = text || `${res.status}`; continue; }

      let data = null; try { data = text ? JSON.parse(text) : null; } catch {}

      const accessToken =
        data?.access_token ||
        data?.token ||
        data?.data?.access_token ||
        null;

      if (accessToken) setToken(accessToken);
      // Even if there is no token, cookie session may be set (via /auth/cookie-login).
      return { ok: true, data: data ?? {} };
    } catch (e) {
      lastErr = String(e);
    }
  }
  return { ok: false, error: lastErr || "Login failed" };
}

export const auth = {
  get token() { return getToken(); },
  set token(v) { setToken(v); },
  isLoggedIn,
  logout,
  login,
  fetch: authFetch,
};

export default auth;
