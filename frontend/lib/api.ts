// lib/api.ts
// Uses NEXT_PUBLIC_API_BASE if set; otherwise derives http(s)://<current-host>:8000 in the browser.

const derivedBase =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? derivedBase).replace(/\/$/, "");

export function authHeaders(token?: string) {
  const t =
    token ?? (typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

export async function API<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), ...authHeaders() },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}
