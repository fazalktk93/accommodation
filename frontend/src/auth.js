// frontend/src/auth.js

const AUTH_STORAGE_KEY = "auth_token";

/** API base:
 *  DEV: use '/api' so Vite proxy forwards to backend.
 *  PROD: allow VITE_API_BASE_URL or window.API_BASE_URL.
 */
let API_BASE = "/api";
try {
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  if (!isDev) {
    let base = `${window.location.protocol}//${window.location.hostname}:8000/api`;
    if (import.meta?.env?.VITE_API_BASE_URL) base = import.meta.env.VITE_API_BASE_URL;
    if (typeof window !== "undefined" && window.API_BASE_URL) base = window.API_BASE_URL;
    API_BASE = base;
  }
} catch { API_BASE = "/api"; }

/* ---------------- token helpers ---------------- */
export function getToken() { return localStorage.getItem(AUTH_STORAGE_KEY); }
export function setToken(v) { v ? localStorage.setItem(AUTH_STORAGE_KEY, v) : localStorage.removeItem(AUTH_STORAGE_KEY); }
export function isLoggedIn() { return !!getToken(); }
export function logout() {
  setToken(null);
  if (typeof window !== "undefined") window.location.href = "/login";
}

/* ---------------- internals ---------------- */
function pickToken(data) {
  return data?.access_token || data?.token || data?.access || data?.data?.access_token || null;
}
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
  if (!sp.has("grant_type")) sp.set("grant_type", "password");
  if (!sp.has("scope")) sp.set("scope", "");
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: sp.toString(),
    credentials: "same-origin",
  });
}

/* ---------------- login ---------------- */
export async function login(username, password) {
  const attempts = [
    { url: `${API_BASE}/auth/token`, kind: "form" },
    { url: `${API_BASE}/auth/login`, kind: "form" },
    { url: `${API_BASE}/login/access-token`, kind: "form" },
    { url: `${API_BASE}/auth/jwt/login`, kind: "form" },
    { url: `${API_BASE}/auth/token`, kind: "json" },
  ];
  let last = "Login failed";
  for (const a of attempts) {
    try {
      const res = a.kind === "form"
        ? await postForm(a.url, { username, password })
        : await postJson(a.url, { username, password });

      if (!res.ok) {
        try { const j = await res.json(); last = j?.detail || j?.message || `${res.status} ${res.statusText}`; }
        catch { last = `${res.status} ${res.statusText}`; }
        if (res.status === 401) break; // wrong creds -> stop
        continue;
      }

      const data = await res.json();
      const token = pickToken(data);
      if (!token) { last = "Invalid token response"; continue; }
      setToken(token);
      return data;
    } catch (e) { last = e?.message || String(e); }
  }
  throw new Error(last);
}

/* ---------------- generic helpers ---------------- */
export function api(path) { return path.startsWith("http") ? path : `${API_BASE}${path}`; }

/**
 * authFetch: attaches token and tries multiple auth schemes on 401.
 * IMPORTANT: it does NOT auto-logout. Callers decide what to do on 401.
 */
export async function authFetch(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : api(pathOrUrl);
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set("Accept", headers.get("Accept") || "application/json");

  const schemes = token ? ["Bearer", "Token", "JWT"] : [null];

  for (let i = 0; i < schemes.length; i++) {
    const h = new Headers(headers);
    if (schemes[i]) h.set("Authorization", `${schemes[i]} ${token}`);
    const res = await fetch(url, { ...options, headers: h, credentials: "same-origin" });
    if (res.status !== 401 || i === schemes.length - 1) return res; // return on success or last attempt
    // else try next scheme
  }
  // should not reach here
  return fetch(url, { ...options, headers, credentials: "same-origin" });
}

export const auth = { get token() { return getToken(); }, set token(v) { setToken(v); }, isLoggedIn, logout, login, fetch: authFetch, api };
export default auth;
