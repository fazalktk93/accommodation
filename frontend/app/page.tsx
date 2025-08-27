// app/page.tsx
// Next.js App Router – Home dashboard aligned to your FastAPI backend

export const dynamic = "force-dynamic"; // always fetch fresh counts

type Stat = { label: string; value: number | null; href?: string; note?: string };

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(/\/$/, "");

async function safeFetchCount(path: string): Promise<number | null> {
  try {
    const r = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    // list endpoints should be arrays; fall back to object length if needed
    if (Array.isArray(data)) return data.length;
    if (data && typeof data === "object") {
      // healthz returns {status:"ok"} -> treat as 1
      if ("status" in data) return 1;
      return Object.keys(data).length;
    }
    return null;
  } catch {
    return null;
  }
}

async function getDashboardStats(): Promise<{
  health: "ok" | "down";
  stats: Stat[];
}> {
  const [healthCount, houses, employees, colonies, departments, bps] =
    await Promise.all([
      safeFetchCount("/healthz"),
      safeFetchCount("/houses"),
      safeFetchCount("/employees"),
      safeFetchCount("/meta/colonies"),
      safeFetchCount("/meta/departments"),
      safeFetchCount("/meta/bps"),
    ]);

  const stats: Stat[] = [
    { label: "Houses", value: houses, href: "/houses" },
    { label: "Employees", value: employees, href: "/employees" },
    { label: "Colonies", value: colonies, href: "/meta/colonies" },
    { label: "Departments", value: departments, href: "/meta/departments" },
    { label: "BPS Codes", value: bps, href: "/meta/bps" },
  ];

  return { health: healthCount ? "ok" : "down", stats };
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

function LinkList({
  items,
}: {
  items: { label: string; href?: string; external?: boolean }[];
}) {
  return (
    <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.8 }}>
      {items.map((it) => (
        <li key={it.label}>
          {it.href ? (
            <a
              href={it.href}
              {...(it.external ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {it.label}
            </a>
          ) : (
            it.label
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function Home() {
  const { health, stats } = await getDashboardStats();

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
          <h1 style={{ margin: 0, fontSize: 28 }}>
            House Allotment Management System
          </h1>
          <p style={{ margin: "0.25rem 0 0", opacity: 0.8 }}>
            Backend: <code>{API_BASE}</code>{" "}
            <span
              style={{
                marginLeft: 8,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                background: health === "ok" ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)",
                border:
                  health === "ok"
                    ? "1px solid rgba(22,163,74,.25)"
                    : "1px solid rgba(185,28,28,.25)",
              }}
            >
              {health === "ok" ? "API healthy" : "API unreachable"}
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
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {s.value ?? "—"}
            </div>
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
          <LinkList
            items={[
              { label: "Log in", href: "/login" },
              { label: "Register user (admin)", href: "/admin/users/new" },
              { label: "Create employee", href: "/employees/new" },
              { label: "Add house", href: "/houses/new" },
              { label: "Create application", href: "/applications/new" },
              { label: "Allot a house", href: "/allotments/assign" },
            ]}
          />
        </Card>

        <Card title="Browse Metadata">
          <LinkList
            items={[
              { label: "BPS Codes", href: "/meta/bps" },
              { label: "Colonies", href: "/meta/colonies" },
              { label: "Departments", href: "/meta/departments" },
              { label: "API docs (Swagger)", href: `${API_BASE}/docs`, external: true },
            ]}
          />
        </Card>
      </section>

      <footer style={{ marginTop: "2rem", opacity: 0.6, fontSize: 13 }}>
        <p style={{ margin: 0 }}>
          Tip: set <code>NEXT_PUBLIC_API_BASE</code> in your frontend env if your
          backend isn’t on <code>http://localhost:8000</code>.
        </p>
      </footer>
    </main>
  );
}
