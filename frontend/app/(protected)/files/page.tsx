"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type FileRow = {
  id: number;
  file_no: string;
  employee_id: number;
  house_id: number | null;
  opened_at: string;
  closed_at: string | null;
};

export default function FilesPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const url = q.trim() ? `/files?file_no=${encodeURIComponent(q.trim())}` : `/files`;
      const data = await API<FileRow[]>(url);
      setRows(data);
    } catch (e: any) {
      setErr(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Accommodation Files</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search file_no…" style={{ padding: 8, width: 260 }} />
        <button onClick={load}>Search</button>
        <a href="/files/new" style={{ marginLeft: "auto" }}>+ New File</a>
      </div>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color:"crimson" }}>{err}</p>}
      {!loading && !err && (
        <table cellPadding={8} style={{ borderCollapse:"collapse", border:"1px solid #ddd", width:"100%" }}>
          <thead><tr><th>ID</th><th>File No</th><th>Employee</th><th>House</th><th>Opened</th><th>Closed</th></tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.file_no}</td><td>{r.employee_id}</td><td>{r.house_id ?? "—"}</td>
                <td>{r.opened_at}</td><td>{r.closed_at ?? "—"}</td>
              </tr>
            ))
