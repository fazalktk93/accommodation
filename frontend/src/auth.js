// frontend/src/auth.js

const AUTH_STORAGE_KEY = "auth_token";

let API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

/* ---------- token helpers ---------- */
export function getToken() { return localStorage.getItem(AUTH_STORAGE_KEY); }
export function setToken(v) { v ? localStorage.setItem(AUTH_STORAGE_KEY, v) : localStorage.removeItem(AUTH_STORAGE_KEY); }
export function isLoggedIn() { return !!getToken(); }
export function logout() { setToken(null); if (typeof window !== "undefined") window.location.href = "/login"; }

/* ---------- internals ---------- */
function pickToken(data) {
  return (
    data?.access_token ||
    data?.token ||
    data?.access ||
    data?.data?.access_token ||
    null
  );
}

async function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
}

function makeSearchParams(fields) {
  const sp = new URLSearchParams();
  Object.entries(fields).forEach(([k, v]) => sp.append(k, v == null ? "" : String(v)));
  return sp;
}
async function postForm(url, fields) {
  const sp = makeSearchParams(fields);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: sp.toString(),
    credentials: "same-origin",
  });
}

/* ---------- login ---------- */
export async function login(username, password) {
  // Try typical endpoints.
  const endpoints = [
    `${API_BASE}/auth/token`,
    `${API_BASE}/auth/login`,
    `${API_BASE}/login/access-token`,
    `${API_BASE}/auth/jwt/login`,
  ];

  // Two body variants: bare form and OAuth2 form
  const bodies = [
    { kind: "form", fields: { username, password } },
    { kind: "form", fields: { username, password, grant_type: "password", scope: "" } },
    { kind: "json", fields: { username, password } },
  ];

  let last = "Login failed";
  for (const url of endpoints) {
    for (const b of bodies) {
      try {
        const res =
          b.kind === "form" ? await postForm(url, b.fields) : await postJson(url, b.fields);

        if (!res.ok) {
          try {
            const j = await res.json();
            last = j?.detail || j?.message || `${res.status} ${res.statusText}`;
          } catch {
            last = `${res.status} ${res.statusText}`;
          }
          // If the server definitively says "unauthorized", don't keep hammering.
          if (res.status === 401) throw new Error(last);
          continue;
        }

        const data = await res.json();
        const token = pickToken(data);
        if (!token) { last = "Invalid token response"; continue; }
        setToken(token);
        return data;
      } catch (e) {
        last = e?.message || String(e);
      }
    }
  }
  throw new Error(last);
}

/* ---------- generic helpers ---------- */
export function api(path) { return path.startsWith("http") ? path : `${API_BASE}${path}`; }

export async function authFetch(pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : api(pathOrUrl);
  const token = getToken();
  const baseHeaders = new Headers(options.headers || {});
  baseHeaders.set("Accept", baseHeaders.get("Accept") || "application/json");

  if (!token) {
    return fetch(url, { ...options, headers: baseHeaders, credentials: "same-origin" });
  }

  // Try Bearer → Token → JWT. If any returns 401, we’ll logout below.
  const schemes = ["Bearer", "Token", "JWT"];
  for (let i = 0; i < schemes.length; i++) {
    const h = new Headers(baseHeaders);
    h.set("Authorization", `${schemes[i]} ${token}`);
    const res = await fetch(url, { ...options, headers: h, credentials: "same-origin" });
    if (res.status !== 401 || i === schemes.length - 1) {
      if (res.status === 401) logout();
      return res;
    }
  }
}

export const auth = {
  get token() { return getToken(); },
  set token(v) { setToken(v); },
  isLoggedIn, logout, login, fetch: authFetch, api
};
export default auth;
