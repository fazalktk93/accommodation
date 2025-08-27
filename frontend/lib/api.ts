// lib/api.ts
// Uses the Next.js proxy (/api/*) for all browser calls.
// If you later set NEXT_PUBLIC_API_BASE, this helper will still prefer the proxy
// because the proxy removes CORS headaches and localhost/host mismatches.

export function authHeaders(token?: string) {
  const t =
    token ?? (typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function API<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  // Always call through Next.js proxy (relative URL)
  const url = `/api${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
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
