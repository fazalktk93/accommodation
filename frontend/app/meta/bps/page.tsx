// app/meta/bps/page.tsx
"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Bps = { id: number; code: string; description?: string | null };

export default function BpsPage() {
  const [items, setItems] = useState<Bps[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await API<Bps[]>("/meta/bps");
        if (mounted) setItems(data);
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load BPS");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <main style={{ padding:"2rem" }}>
      <h1>BPS Codes</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color:"crimson" }}>{error}</p>}
      {!loading && !error && (
        <table cellPadding={8} style={{ borderCollapse:"collapse", border:"1px solid #ddd" }}>
          <thead>
            <tr><th>ID</th><th>Code</th><th>Description</th></tr>
          </thead>
          <tbody>
            {items.map(x => (
              <tr key={x.id}>
                <td>{x.id}</td>
                <td>{x.code}</td>
                <td>{x.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
