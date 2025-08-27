// app/login/page.tsx
"use client";
import { useState } from "react";

function getApiBase() {
  // Derive API base from current host so it works when accessed via server IP
  const derived =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : "http://localhost:8000";
  return (process.env.NEXT_PUBLIC_API_BASE ?? derived).replace(/\/$/, "");
}

export default function LoginPage() {
  const API_BASE = getApiBase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
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
      setMsg("Logged in ✔ You can now visit /admin or /employees");
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
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>
      <p style={{ marginTop: ".75rem" }}>{msg}</p>
      <p style={{ opacity: 0.7, fontSize: 12 }}>
        API base: <code>{getApiBase()}</code>
      </p>
    </main>
  );
}
