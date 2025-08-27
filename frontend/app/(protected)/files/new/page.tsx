"use client";
import { useState } from "react";

export default function NewFilePage() {
  const [fileNo, setFileNo] = useState("");
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [houseId, setHouseId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setLoading(true);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          file_no: fileNo.trim(),
          employee_id: Number(employeeId),
          house_id: houseId === "" ? null : Number(houseId),
          notes: notes || null,
        }),
      });
      const text = await res.text().catch(()=> "");
      if (!res.ok) { setMsg(`Error: ${res.status} ${res.statusText} ${text}`); return; }
      setMsg("File created ✔");
      setFileNo(""); setEmployeeId(""); setHouseId(""); setNotes("");
    } catch (e: any) {
      setMsg(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding:"2rem", maxWidth: 560 }}>
      <h1>New Accommodation File</h1>
      <form onSubmit={onSubmit} style={{ display:"grid", gap: 12 }}>
        <label>File No
          <input value={fileNo} onChange={e=>setFileNo(e.target.value)} required />
        </label>
        <label>Employee ID
          <input value={employeeId} onChange={e=>setEmployeeId(e.target.value === "" ? "" : Number(e.target.value))} required />
        </label>
        <label>House ID (optional)
          <input value={houseId} onChange={e=>setHouseId(e.target.value === "" ? "" : Number(e.target.value))} />
        </label>
        <label>Notes
          <textarea value={notes} onChange={e=>setNotes(e.target.value)}
