"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Occ = {
  id: number;
  house_id: number;
  employee_id: number;
  start_date: string; // ISO date
  end_date: string | null;
  reason: string | null;
};

export default function HouseHistory({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [rows, setRows] = useState<Occ[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const data = await API<Occ[]>(`/houses/${id}/history`);
        if (active) setRows(data);
      } catch (e: any) {
        if (active) setErr(e.message || "Failed to fetch");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>House #{id} – Occupancy History</h1>
      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!loading && !err && (
        <table cellPadding={8} style={{ borderCollapse:"collapse", border:"1px solid #ddd" }}>
          <thead>
            <tr><th>Period</th><th>Employee</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.start_date} — {r.end_date ?? "present"}</td>
                <td>{r.employee_id}</td>
                <td>{r.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
