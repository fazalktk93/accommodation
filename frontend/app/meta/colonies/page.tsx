// app/meta/colonies/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Colony = { id: number; name: string };

export default function ColoniesPage() {
  const [items, setItems] = useState<Colony[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await API<Colony[]>("/meta/colonies");
        if (mounted) setItems(data);
      } catch (e:any) {
        if (mounted) setError(e.message || "Failed to load colonies");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <main style={{ padding:"2rem" }}>
      <h1>Colonies</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color:"crimson" }}>{error}</p>}
      {!loading && !error && (
        <table cellPadding={8} style={{ borderCollapse:"collapse", border:"1px solid #ddd" }}>
          <thead>
            <tr><th>ID</th><th>Name</th></tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
