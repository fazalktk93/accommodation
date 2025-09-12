// src/auth.js
// Keeps your export surface: getToken, setToken, isLoggedIn, logout, login, auth.fetch
// Also exports named `authFetch`.

const AUTH_STORAGE_KEY = "auth_token";

let RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

function normBase(b) {
  if (!b) return "/api";
  if (!/^https?:\/\//i.test(b) && !b.startsWith("/")) b = "/" + b;
  b = b.replace(/\/{2,}/g, "/");
  b = b.replace(/\/api\/?api(\/|$)/, "/api$1");
  if (b.endsWith("/")) b = b.slice(0, -1);
  return b;
}
const API_BASE = normBase(RAW_BASE);

// ---------- token helpers ----------
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

// ---------- URL join (avoid /api/api) ----------
function joinUrl(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const baseNo = base.endsWith("/") ? base.slice(0, -1) : base;
  let rel = path.startsWith("/") ? path : `/${path}`;
  if (baseNo.endsWith("/api") && rel.startsWith("/api/")) rel = rel.replace(/^\/api/, "");
  return (baseNo + rel).replace(/\/{2,}/g, "/");
}

async function doFetch(url, options = {}) {
  const finalUrl = joinUrl(API_BASE, url);
  return fetch(finalUrl, { credentials: "include", ...options });
}

// ---------- authorized fetch ----------
export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const tok = getToken();
  if (tok && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${tok}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return doFetch(path, { ...options, headers });
}

// ---------- LOGIN (tries many backends, including OAuth2 password flow) ----------
export async function login(username, password) {
  const attempts = [
    // FastAPI Users JWT (form)
    { path: "/auth/jwt/login", type: "form" },

    // Cookie session (form)
    { path: "/auth/login", type: "form" },
    { path: "/auth/cookie-login", type: "form" },

    // OAuth2 password flow (FORM with grant_type)
    { path: "/auth/token", type: "oauth2" },
    { path: "/token",      type: "oauth2" },

    // Token as JSON (some custom impls)
    { path: "/auth/token", type: "json" },

    // Generic fallback
    { path: "/login",      type: "form" },
  ];

  let lastErr = null;

  for (const a of attempts) {
    try {
      const h = new Headers();
      let body;

      if (a.type === "form") {
        h.set("Content-Type", "application/x-www-form-urlencoded");
        body = new URLSearchParams({ username, password });
      } else if (a.type === "oauth2") {
        h.set("Content-Type", "application/x-www-form-urlencoded");
        // OAuth2 Password spec
        body = new URLSearchParams({
          grant_type: "password",
          username,
          password,
          scope: "",
        });
      } else {
        h.set("Content-Type", "application/json");
        body = JSON.stringify({ username, password });
      }

      const res = await doFetch(a.path, { method: "POST", headers: h, body });
      const text = await res.text();
      if (!res.ok) { lastErr = text || `${res.status}`; continue; }

      // Parse token if any
      let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
      const accessToken =
        data?.access_token ||
        data?.token ||
        data?.data?.access_token ||
        null;
      if (accessToken) setToken(accessToken);

      // Even without token, a cookie may be set (cookie session)
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
