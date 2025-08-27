// app/admin/users/new/page.tsx
"use client";
import { useState } from "react";
import { authHeaders } from "@/lib/api";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(/\/$/, "");

export default function NewUserPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "operator" | "user">("user");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type":"application/json", ...authHeaders() },
      body: JSON.stringify({ email, password, role }),
    });
    if (!res.ok) {
      const text = await res.text().catch(()=>"");
      setMsg(`Error: ${res.status} ${res.statusText} ${text}`);
      return;
    }
    setMsg("User created ✔");
    setEmail(""); setPassword(""); setRole("user");
  }

  return (
    <main style={{ padding:"2rem", maxWidth: 420 }}>
      <h1>Register User</h1>
      <form onSubmit={onSubmit} style={{ display:"grid", gap:".6rem" }}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <label>Role:
          <select value={role} onChange={e=>setRole(e.target.value as any)} style={{ marginLeft: 8 }}>
            <option value="user">user</option>
            <option value="operator">operator</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button type="submit">Create</button>
      </form>
      {msg && <p style={{ marginTop: ".75rem" }}>{msg}</p>}
      <p style={{ opacity:.7, fontSize:13 }}>
        Requires an admin token in <code>localStorage.token</code> (log in as admin first).
      </p>
    </main>
  );
}
