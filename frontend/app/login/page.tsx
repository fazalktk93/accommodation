"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) { setErr("Invalid email or password"); return; }
    const data = await res.json();
    localStorage.setItem("token", data.access_token);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {err && <div className="text-red-600">{err}</div>}
        <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn w-full">Login</button>
      </form>
    </div>
  );
}
