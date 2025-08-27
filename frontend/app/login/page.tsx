// app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      // Proxy via Next.js → FastAPI
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setMsg(`Login failed: ${res.status} ${res.statusText} ${text}`);
        return;
      }
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      setMsg("Logged in ✔ Redirecting…");
      router.push("/admin");
    } catch (err: any) {
      setMsg(`Network error: ${err?.message ?? "Failed to reach API"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Login</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Login"}</button>
      </form>
      <p style={{ marginTop: ".75rem" }}>{msg}</p>
      <p style={{ opacity: 0.7, fontSize: 12 }}>
        Calls go to <code>/api/*</code> and are proxied to FastAPI.
      </p>
    </main>
  );
}
