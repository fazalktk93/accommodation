"use client";
import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";

type Employee = { id: number; nic: string; name: string; bps_id?: number | null; department_id?: number | null };

export default function EmployeesPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // debounce 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const url = debounced ? `/employees?q=${encodeURIComponent(debounced)}` : "/employees";
        const data = await API<Employee[]>(url);
        if (active) setItems(data);
      } catch (e: any) {
        if (active) setErr(e.message || "Failed to fetch");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [debounced]);

  const count = useMemo(() => items.length, [items]);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Employees</h1>
      <div style={{ marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or NIC…"
          style={{ padding: 8, width: 320, maxWidth: "100%" }}
        />
      </div>
      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!loading && !err && (
        <>
          <p style={{ opacity: 0.7, marginTop: 0 }}>{count} result(s)</p>
          <table cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #ddd", width: "100%" }}>
            <thead>
              <tr><th>ID</th><th>NIC</th><th>Name</th><th>BPS</th><th>Department</th></tr>
            </thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id}>
                  <td>{e.id}</td>
                  <td>{e.nic}</td>
                  <td>{e.name}</td>
                  <td>{e.bps_id ?? "—"}</td>
                  <td>{e.department_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
