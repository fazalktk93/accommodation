"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Gwl = {
  id: number;
  employee_id: number;
  colony_id: number | null;
  entitlement_date: string; // ISO date
  priority_points: number;
  status: "pending" | "allotted" | "withdrawn" | "skipped";
  employee?: { id: number; name: string; nic: string };
  colony?: { id: number; name: string };
};

export default function GwlPage() {
  const [status, setStatus] = useState<"GWL">();
  const [statusVal, setStatusVal] = useState<"pending"|"allotted"|"withdrawn"|"skipped">("pending");
  const [colonyId, setColonyId] = useState<number | "">( "");
  const [rows, setRows] = useState<Gwl[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams();
      if (statusVal) qs.set("status", statusVal);
      if (colonyId !== "") qs.set("colony_id", String(colonyId));
      const data = await API<Gwl[]>(`/gwl?${qs.toString()}`);
      setRows(data);
    } catch (e: any) {
      setErr(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusVal, colonyId]);

  async function skip(id: number) {
    if (!confirm("Mark this entry as skipped?")) return;
    try {
      await API(`/gwl/${id}/skip`, { method: "POST" });
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to skip");
    }
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>General Waiting List</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label>Status:
          <select value={statusVal} onChange={e => setStatusVal(e.target.value as any)} style={{ marginLeft: 8 }}>
            <option value="pending">pending</option>
            <option value="allotted">allotted</option>
            <option value="withdrawn">withdrawn</option>
            <option value="skipped">skipped</option>
          </select>
        </label>
        <label>Colony ID:
          <input
            value={colonyId}
            onChange={(e) => setColonyId(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="(optional)"
            style={{ width: 120, marginLeft: 8 }}
          />
        </label>
      </div>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!loading && !err && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", border: "1px solid #ddd", width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th><th>Employee</th><th>Colony</th><th>Entitlement Date</th><th>Priority</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.employee?.name ?? r.employee_id}</td>
                <td>{r.colony?.name ?? r.colony_id ?? "—"}</td>
                <td>{r.entitlement_date}</td>
                <td>{r.priority_points}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => skip(r.id)}>Skip</button>
                      {/* Allotment action can open a dialog to pick house_id and POST /gwl/{id}/allot?house_id= */}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
