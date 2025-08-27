// app/admin/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/lib/api";

type Me = { id: number; email: string; role: "admin" | "operator" | "user" };

export default function AdminLanding() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawErr, setRawErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "";
      if (!token) { router.replace("/login"); return; }

      try {
        const res = await fetch(`/api/users/me`, {
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          setRawErr(`status=${res.status} ${res.statusText} body=${body}`);
          if (res.status === 401) router.replace("/login");
          else setError("Failed to load current user.");
          return;
        }
        setMe(await res.json());
        setError(null); setRawErr(null);
      } catch (e: any) {
        setError("Network error."); setRawErr(String(e?.message ?? e));
      }
    })();
  }, [router]);

  function onLogout() {
    localStorage.removeItem("token");
    router.replace("/login");
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Admin</h1>
      <div style={{ marginBottom: "1rem" }}>
        {me && <>Signed in as <b>{me.email}</b> ({me.role}) <button onClick={onLogout}>Logout</button></>}
        {!me && !error && <span>Loading account…</span>}
        {error && <div style={{ color:"crimson" }}>{error}{rawErr && <pre style={{ background:"#f6f6f6", padding:8, borderRadius:6, marginTop:8 }}>{rawErr}</pre>}</div>}
      </div>
      <ul>
        <li><a href="/admin/users/new">Register User</a></li>
        <li><a href="/employees">Employees</a></li>
        <li><a href="/houses">Houses</a></li>
        <li><a href="/meta/bps">BPS</a></li>
        <li><a href="/meta/colonies">Colonies</a></li>
        <li><a href="/meta/departments">Departments</a></li>
      </ul>
    </main>
  );
}
