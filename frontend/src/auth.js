// frontend/src/auth.js

const AUTH_STORAGE_KEY = "auth_token";

// Default API base (backend runs on :8000 with /api prefix)
const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`;

let API_BASE = defaultApiBase;

// Vite allows overrides via env
if (import.meta.env?.VITE_API_BASE_URL) {
  API_BASE = import.meta.env.VITE_API_BASE_URL;
}
// Or override in browser console: window.API_BASE_URL = "http://server:8000/api";
if (typeof window !== "undefined" && window.API_BASE_URL) {
  API_BASE = window.API_BASE_URL;
}

export const auth = {
  get token() {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  },
  set token(value) {
    if (value) localStorage.setItem(AUTH_STORAGE_KEY, value);
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  },
  isLoggedIn() {
    return !!auth.token;
  },
  logout() {
    auth.token = null;
    if (typeof window !== "undefined") {
      window.location.href = "/login.html";
    }
  },

  /** JSON login: POST /api/auth/token */
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      let msg = "Login failed";
      try {
        const data = await res.json();
        if (data?.detail) msg = data.detail;
      } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    if (!data?.access_token) throw new Error("Invalid response from server");
    auth.token = data.access_token;
    return data;
  },

  /** Fetch wrapper with Authorization header */
  async fetch(path, options = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const headers = new Headers(options.headers || {});
    if (auth.token) headers.set("Authorization", `Bearer ${auth.token}`);
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) auth.logout();
    return res;
  },
};
