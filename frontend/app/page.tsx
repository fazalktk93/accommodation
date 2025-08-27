// app/page.tsx
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getApiBaseServer() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0]; // strip :3000
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  const base = (envBase && envBase.trim()) || `${proto}://${hostname}:8000`;
  return base.replace(/\/$/, "");
}

type Stat = { label: string; value: number | null; href?: string };

async function safeFetchCount(base: string, path: string): Promise<number | null> {
  try {
    const r = await fetch(`${base}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    if (Array.isArray(data)) return data.length;
    if (data && typeof data === "object") {
      if ("status" in data) return 1;
      return Object.keys(data).length;
    }
    return null;
  } catch {
    return null;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 8,
        padding: "1rem",
        background: "rgba(255,255,255,0.6)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: 18 }}>{title}</h3>
      {children}
    </div>
  );
}

export default async function Home() {
  const API_BASE = getApiBaseServer();

  const [healthCount, houses, employees, colonies, departments, bps] = await Promise.all([
    safeFetchCount(API_BASE, "/healthz"),
    safeFetchCount(API_BASE, "/houses"),
    safeFetchCount(API_BASE, "/employees"),
    safeFetchCount(API_BASE, "/meta/colonies"),
    safeFetchCount(API_BASE, "/meta/departments"),
    safeFetchCount(API_BASE, "/meta/bps"),
  ]);

  const stats: Stat[] = [
    { label: "Houses", value: houses, href: "/houses" },
    { label: "Employees", value: employees, href: "/employees" },
    { label: "Colonies", value: colonies, href: "/meta/colonies" },
    { label: "Departments", value: departments, href: "/meta/departments" },
    { label: "BPS Codes", value: bps, href: "/meta/bps" },
  ];

  return (
    <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>House Allotment Management System</h1>
          <p style={{ margin: "0.25rem 0 0", opacity: 0.8 }}>
            Backend: <code>{API_BASE}</code>{" "}
            <span
              style={{
                marginLeft: 8,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                background: healthCount ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)",
                border: healthCount
                  ? "1px solid rgba(22,163,74,.25)"
                  : "1px solid rgba(185,28,28,.25)",
              }}
            >
              {healthCount ? "API healthy" : "API unreachable"}
            </span>
          </p>
        </div>

        <nav style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <a
            href="/login"
            style={{
              textDecoration: "none",
              padding: ".6rem .9rem",
              borderRadius: 6,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          >
            Login
          </a>
          <a
            href="/admin"
            style={{
              textDecoration: "none",
              padding: ".6rem .9rem",
              borderRadius: 6,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          >
            Admin
          </a>
        </nav>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {stats.map((s) => (
          <Card key={s.label} title={s.label}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value ?? "—"}</div>
            <div style={{ marginTop: ".25rem", opacity: 0.75 }}>
              {s.value === null ? "Unavailable" : "Total"}
            </div>
            {s.href && (
              <div style={{ marginTop: ".75rem" }}>
                <a href={s.href}>Open {s.label.toLowerCase()} →</a>
              </div>
            )}
          </Card>
        ))}

        <Card title="Quick Actions">
          <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.8 }}>
            <li><a href="/login">Log in</a></li>
            <li><a href="/admin/users/new">Register user (admin)</a></li>
            <li><a href="/employees/new">Create employee</a></li>
            <li><a href="/houses/new">Add house</a></li>
            <li><a href="/applications/new">Create application</a></li>
            <li><a href="/allotments/assign">Allot a house</a></li>
          </ul>
        </Card>

        <Card title="Browse Metadata">
          <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.8 }}>
            <li><a href="/meta/bps">BPS Codes</a></li>
            <li><a href="/meta/colonies">Colonies</a></li>
            <li><a href="/meta/departments">Departments</a></li>
            <li><a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">API docs (Swagger)</a></li>
          </ul>
        </Card>
      </section>
    </main>
  );
}
