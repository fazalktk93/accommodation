// lib/api.ts
const ABSOLUTE_API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE
  ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "")
  : null;

// If ABSOLUTE_API_ORIGIN is null, we call relative "/api" and let next.config.js proxy it.
const API_PREFIX = ABSOLUTE_API_ORIGIN ? "" : "/api";
const API_BASE_FOR_DISPLAY =
  ABSOLUTE_API_ORIGIN ?? "(via Next.js proxy @ /api → backend)";

export function authHeaders(token?: string) {
  const t =
    token ?? (typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

export async function API<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const target = `${ABSOLUTE_API_ORIGIN ?? ""}${API_PREFIX}${path}`;
  const res = await fetch(target, {
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

// Export a helper just for showing what base we're using in UI
export function apiBaseLabel() {
  return API_BASE_FOR_DISPLAY;
}
