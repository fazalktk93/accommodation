export const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
