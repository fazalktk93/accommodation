// app/houses/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type House = {
  id: number;
  colony_id: number;
  house_no: string;
  house_type?: string | null;
  status: string;
};

export default function HousesPage() {
  const [items, setItems] = useState<House[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await API<House[]>("/houses");
        if (mounted) setItems(data);
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load houses");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Houses</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !error && (
        <table cellPadding={8} style={{ borderCollapse:"collapse", border:"1px solid #ddd" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Colony ID</th>
              <th>House No</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(h => (
              <tr key={h.id}>
                <td>{h.id}</td>
                <td>{h.colony_id}</td>
                <td>{h.house_no}</td>
                <td>{h.house_type ?? "—"}</td>
                <td>{h.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
