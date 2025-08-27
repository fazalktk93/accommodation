// app/(protected)/files/new/page.tsx
"use client";
import React, { useState } from "react";

export default function NewFilePage() {
  const [fileNo, setFileNo] = useState("");
  const [employeeId, setEmployeeId] = useState("");   // keep as string, cast on submit
  const [houseId, setHouseId] = useState("");         // optional
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const payload = {
        file_no: fileNo.trim(),
        employee_id: Number(employeeId),
        house_id: houseId.trim() === "" ? null : Number(houseId),
        notes: notes.trim() === "" ? null : notes.trim(),
      };

      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        setMsg(`Error: ${res.status} ${res.statusText} ${text}`);
        return;
      }

      setMsg("File created ✔");
      setFileNo("");
      setEmployeeId("");
      setHouseId("");
      setNotes("");
    } catch (err: any) {
      setMsg(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 560 }}>
      <h1>New Accommodation File</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          File No
          <input value={fileNo} onChange={(e) => setFileNo(e.target.value)} required />
        </label>

        <label>
          Employee ID
          <input
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            inputMode="numeric"
            required
          />
        </label>

        <label>
          House ID (optional)
          <input
            value={houseId}
            onChange={(e) => setHouseId(e.target.value)}
            inputMode="numeric"
            placeholder="leave blank if none"
          />
        </label>

        <label>
          Notes
          <textarea
            value={notes}
            onChange={
