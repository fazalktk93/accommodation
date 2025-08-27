// app/(protected)/employees/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Employee = { id: number; nic: string; name: string };

export default function EmployeesPage() {
  const [items, setItems] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await API<Employee[]>("/employees");
        if (mounted) setItems(data);
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load employees");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Employees</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #ddd" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>NIC</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.nic}</td>
                <td>{e.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
