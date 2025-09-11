// frontend/src/auth.js

const AUTH_STORAGE_KEY = "auth_token";

/**
 * API base logic:
 * - In DEV (vite), always use relative '/api' so the vite proxy forwards to backend.
 * - In PROD, allow VITE_API_BASE_URL or window.API_BASE_URL to override.
 */
let API_BASE = "/api"; // safe for dev (proxy)

try {
  // Vite injects these flags at build time
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

  if (!isDev) {
    // Production defaults: keep your old behavior / allow overrides
    const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`;
    API_BASE = defaultApiBase;

    if (import.meta?.env?.VITE_API_BASE_URL) {
      API_BASE = import.meta.env.VITE_API_BASE_URL;
    }
    if (typeof window !== "undefined" && window.API_BASE_URL) {
      API_BASE = window.API_BASE_URL;
    }
  }
} catch {
  // Fallback if anything above fails
  API_BASE = "/api";
}

/* ===== Named exports expected elsewhere (e.g., api.js) ===== */

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

/** JSON login: POST /api/auth/token */
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ username, password }),
    credentials: "same-origin",
  });

  if (!res.ok) {
    let msg = "Login failed";
    try {
      const data = await res.json();
      msg = data?.detail || data?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const token = data?.access_token || data?.token || null;
  if (!token) throw new Error("Invalid response from server");
  setToken(token);
  return data;
}

/** Build full API URL */
export function api(path) {
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

/** Fetch wrapper with Authorization header */
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

/* Optional convenience object */
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
  api,
};

export default auth;
