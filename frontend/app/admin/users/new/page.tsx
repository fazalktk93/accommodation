// app/admin/users/new/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/lib/api";

export default function NewUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "operator" | "user">("user");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email, password, role }),
      });
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        setMsg(`Error: ${res.status} ${res.statusText} ${text}`);
        return;
      }
      setMsg("User created ✔");
      setEmail(""); setPassword(""); setRole("user");
      setTimeout(() => router.push("/admin"), 800);
    } catch (e: any) {
      setMsg(`Network error: ${e?.message ?? "Failed to reach API"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 420 }}>
      <h1>Register User</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: ".6rem" }}>
        <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <label>Role:&nbsp;
          <select value={role} onChange={(e)=>setRole(e.target.value as any)}>
            <option value="user">user</option>
            <option value="operator">operator</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>{loading ? "Creating…" : "Create"}</button>
      </form>
      {msg && <p style={{ marginTop: ".75rem" }}>{msg}</p>}
      <p style={{ opacity:.7, fontSize:13 }}>
        Requires an admin token in <code>localStorage.token</code> (log in as admin first).
      </p>
    </main>
  );
}
