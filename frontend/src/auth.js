// frontend/src/auth.js

const AUTH_STORAGE_KEY = "auth_token";

/**
 * API base:
 * - DEV: always use relative '/api' so Vite proxy forwards to backend.
 * - PROD: allow VITE_API_BASE_URL or window.API_BASE_URL overrides.
 */
let API_BASE = "/api"; // safe default for dev
try {
  const isDev =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.DEV;

  if (!isDev) {
    let base = `${window.location.protocol}//${window.location.hostname}:8000/api`;
    if (import.meta?.env?.VITE_API_BASE_URL) base = import.meta.env.VITE_API_BASE_URL;
    if (typeof window !== "undefined" && window.API_BASE_URL) base = window.API_BASE_URL;
    API_BASE = base;
  }
} catch {
  API_BASE = "/api";
}

/* ================== token helpers ================== */
export function getToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

export function setToken(value) {
  if (value) localStorage.setItem(AUTH_STORAGE_KEY, value);
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  setToken(null);
  if (typeof window !== "undefined") {
    window.location.href = "/login"; // SPA route
  }
}

/* ================== internals ================== */
async function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
}

async function postForm(url, fields) {
  const sp = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => sp.append(k, v == null ? "" : String(v)));
  // harmless defaults for OAuth2-style backends
  if (!sp.has("grant_type")) sp.set("grant_type", "password");
  if (!sp.has("scope")) sp.set("scope", "");
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: sp.toString(),
    credentials: "same-origin",
  });
}

function pickToken(data) {
  return (
    data?.access_token ||
    data?.token ||
    data?.access ||
    data?.data?.access_token ||
    null
  );
}

/* ================== login ================== */
/**
 * Your backend exposes BOTH:
 *   - POST /auth/token  (JSON {username,password})
 *   - POST /auth/login  (x-www-form-urlencoded)
 * Try them in a sensible order.
 */
export async function login(username, password) {
  const attempts = [
    { url: `${API_BASE}/auth/token`, kind: "json" },
    { url: `${API_BASE}/auth/login`, kind: "form" },
  ];

  let lastErr = "Login failed";
  for (const a of attempts) {
    try {
      const res = a.kind === "json"
        ? await postJson(a.url, { username, password })
        : await postForm(a.url, { username, password });

      if (!res.ok) {
        try {
          const j = await res.json();
          lastErr = j?.detail || j?.message || `${res.status} ${res.statusText}`;
        } catch {
          lastErr = `${res.status} ${res.statusText}`;
        }
        // if it was 401, credentials were rejected; no point trying next
        if (res.status === 401) break;
        continue;
      }

      const data = await res.json();
      const token = pickToken(data);
      if (!token) {
        lastErr = "Invalid token response";
        continue;
      }
      setToken(token);
      return data;
    } catch (e) {
      lastErr = e?.message || String(e);
      // try next attempt
    }
  }
  throw new Error(lastErr);
}

/* ================== general API helpers ================== */
export function api(path) {
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

export async function authFetch(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : api(pathOrUrl);
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", headers.get("Accept") || "application/json");
  const res = await fetch(url, { ...options, headers, credentials: "same-origin" });
  if (res.status === 401) logout();
  return res;
}

/* convenience object */
export const auth = {
  get token() { return getToken(); },
  set token(v) { setToken(v); },
  isLoggedIn,
  logout,
  login,
  fetch: authFetch,
  api,
};

export default auth;
