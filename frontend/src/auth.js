// frontend/src/auth.js
// Keeps your export surface: getToken, setToken, isLoggedIn, logout, login, auth.fetch

const AUTH_STORAGE_KEY = "auth_token";

let API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

// ---------- token helpers ----------
export function getToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}
export function setToken(v) {
  if (v) localStorage.setItem(AUTH_STORAGE_KEY, v);
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}
export function isLoggedIn() {
  return !!getToken();
}
export function logout() {
  setToken(null);
  if (typeof window !== "undefined") window.location.href = "/login";
}

// ---------- internal fetch helper (always includes cookies) ----------
async function doFetch(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  return res;
}

// Login that works with both JSON and form-encoded backends
// (fixes 422 regardless of backend expectation)
export async function login(username, password) {
  const attempts = [
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    },
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const res = await doFetch(API_BASE + "/auth/login", {
        method: "POST",
        headers: attempt.headers,
        body: attempt.body,
      });
      if (!res.ok) {
        lastErr = await res.text().catch(() => String(res.status));
        continue;
      }
      // Accept either {access_token,...} or any JSON
      const data = await res.json().catch(() => ({}));
      if (data && data.access_token) setToken(data.access_token);
      else if (!getToken()) {
        // If backend uses only cookie session, still consider login successful
        // but keep token null. Your API calls will carry the cookie via credentials: 'include'.
      }
      return { ok: true, data };
    } catch (e) {
      lastErr = String(e);
    }
  }
  return { ok: false, error: lastErr || "Login failed" };
}

// Authorized fetch: attaches Bearer token if present and always sends cookies
async function authFetch(path, options = {}) {
  const url =
    path.startsWith("http") ? path : API_BASE + (path.startsWith("/") ? path : "/" + path);
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return doFetch(url, { ...options, headers });
}

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

// also export a NAMED helper for files importing { authFetch }
export { authFetch };
