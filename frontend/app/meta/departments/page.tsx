// app/meta/departments/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Department = { id: number; name: string };

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await API<Department[]>("/meta/departments");
        if (mounted) setItems(data);
      } catch (e:any) {
        if (mounted) setError(e.message || "Failed to load departments");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <main style={{ padding:"2rem" }}>
      <h1>Departments</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color:"crimson" }}>{error}</p>}
      {!loading && !error && (
        <table cellPadding={8} style={{ borderCollapse:"collapse", border:"1px solid #ddd" }}>
          <thead>
            <tr><th>ID</th><th>Name</th></tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
