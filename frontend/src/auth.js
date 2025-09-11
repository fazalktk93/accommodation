// frontend/src/auth.js

const AUTH_STORAGE_KEY = "auth_token";

/**
 * API base logic:
 * - In DEV (vite), always use relative '/api' so the vite proxy forwards to backend.
 * - In PROD, allow VITE_API_BASE_URL or window.API_BASE_URL to override.
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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  return res;
}

async function postForm(url, fields) {
  const sp = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => sp.append(k, v == null ? "" : String(v)));
  // add OAuth2 defaults; harmless if backend ignores
  if (!sp.has("grant_type")) sp.set("grant_type", "password");
  if (!sp.has("scope")) sp.set("scope", "");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: sp.toString(),
    credentials: "same-origin",
  });
  return res;
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
 * Tries the common FastAPI token endpoints:
 * 1) POST form  → /auth/token
 * 2) POST form  → /login/access-token
 * 3) POST form  → /auth/jwt/login
 * 4) (fallback) POST json → /auth/token
 */
export async function login(username, password) {
  const attempts = [
    { url: `${API_BASE}/auth/token`,      kind: "form" },
    { url: `${API_BASE}/login/access-token`, kind: "form" },
    { url: `${API_BASE}/auth/jwt/login`,  kind: "form" },
    { url: `${API_BASE}/auth/token`,      kind: "json" },
  ];

  let lastErr = "Login failed";
  for (const a of attempts) {
    try {
      const res =
        a.kind === "form"
          ? await postForm(a.url, { username, password })
          : await postJson(a.url, { username, password });

      if (!res.ok) {
        // keep the most useful error message but continue trying others
        try {
          const j = await res.json();
          lastErr = j?.detail || j?.message || `${res.status} ${res.statusText}`;
        } catch {
          lastErr = `${res.status} ${res.statusText}`;
        }
        // try next endpoint on 404/405/422/415; stop early on explicit 401
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

  throw new Error(lastErr || "Login failed");
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
