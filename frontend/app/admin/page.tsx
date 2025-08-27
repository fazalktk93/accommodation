// app/admin/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";

type Me = { id: number; email: string; role: "admin" | "operator" | "user" };

export default function AdminLanding() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await API<Me>("/users/me");
        setMe(data);
      } catch (e: any) {
        setError("Failed to load current user. Try logging in again.");
      }
    })();
  }, []);

  function onLogout() {
    localStorage.removeItem("token");
    router.replace("/login");
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 900 }}>
      <h1>Admin</h1>

      <div style={{ margin: "0.5rem 0 1rem", opacity: 0.8 }}>
        {me && (
          <>
            Signed in as <b>{me.email}</b> ({me.role}){" "}
            <button onClick={onLogout} style={{ marginLeft: 8 }}>
              Logout
            </button>
          </>
        )}
        {!me && !error && <span>Loading account…</span>}
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <Card title="Users">
          <ul>
            <li><a href="/admin/users/new">Register User</a></li>
          </ul>
        </Card>

        <Card title="Employees">
          <ul>
            <li><a href="/employees">Browse employees</a></li>
            <li><a href="/employees/new">Create employee</a></li>
          </ul>
        </Card>

        <Card title="Houses">
          <ul>
            <li><a href="/houses">Browse houses</a></li>
            <li><a href="/houses/new">Add house</a></li>
          </ul>
        </Card>

        <Card title="Metadata">
          <ul>
            <li><a href="/meta/bps">BPS Codes</a></li>
            <li><a href="/meta/colonies">Colonies</a></li>
            <li><a href="/meta/departments">Departments</a></li>
          </ul>
        </Card>

        <Card title="Applications & Allotments">
          <ul>
            <li><a href="/applications">Applications</a></li>
            <li><a href="/allotments">Allotments</a></li>
            <li><a href="/allotments/assign">Assign house</a></li>
          </ul>
        </Card>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e3e3e3", borderRadius: 8, padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  );
}
