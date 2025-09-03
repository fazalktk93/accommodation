// frontend/src/auth.js
const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export function getToken() {
  return localStorage.getItem("auth_token");
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem("auth_token");
  // Send to login
  window.location.href = "/login";
}

export async function login(username, password) {
  // If your backend auth is mounted at /api, this hits /api/auth/token
  // If it's mounted at root (/auth/token), either:
  //  1) add `app.include_router(auth.router, prefix="/api")` on backend (recommended), or
  //  2) change the path below to `${API_BASE.replace(/\/api$/,'')}/auth/token`
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Login failed");
  }
  const data = await res.json();
  if (!data?.access_token) throw new Error("No token returned by server");
  localStorage.setItem("auth_token", data.access_token);
}
