// frontend/src/auth.js

const AUTH_STORAGE_KEY = "auth_token";

// Default API base (backend on :8000 with /api prefix)
const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`;
let API_BASE = defaultApiBase;

// Vite env override
if (import.meta?.env?.VITE_API_BASE_URL) {
  API_BASE = import.meta.env.VITE_API_BASE_URL;
}
// Runtime override (if you define window.API_BASE_URL before this loads)
if (typeof window !== "undefined" && window.API_BASE_URL) {
  API_BASE = window.API_BASE_URL;
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    let msg = "Login failed";
    try {
      const data = await res.json();
      msg = data?.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  if (!data?.access_token) throw new Error("Invalid response from server");
  setToken(data.access_token);
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
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) logout();
  return res;
}

/* Optional convenience object */
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
