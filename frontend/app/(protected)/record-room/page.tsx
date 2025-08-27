"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Movement = {
  id: number;
  file_id: number;
  issued_to: string;
  issued_at: string;
  returned_at: string | null;
  remarks: string | null;
};

export default function RecordRoomPage() {
  const [open, setOpen] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // issue form
  const [fileId, setFileId] = useState<number | "">("");
  const [issuedTo, setIssuedTo] = useState("");
  const [remarks, setRemarks] = useState("");

  // return form
  const [retId, setRetId] = useState<number | "">("");
  const [retRemarks, setRetRemarks] = useState("");

  async function loadOpen() {
    setLoading(true); setErr(null);
    try {
      const data = await API<Movement[]>("/recordroom/open");
      setOpen(data);
    } catch (e: any) {
      setErr(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadOpen(); /* eslint-disable-next-line */ }, []);

  async function onIssue(e: React.FormEvent) {
    e.preventDefault();
    try {
      await API("/recordroom/issue", {
        method: "POST",
        body: JSON.stringify({ file_id: Number(fileId), issued_to: issuedTo, remarks: remarks || null }),
      });
      setFileId(""); setIssuedTo(""); setRemarks("");
      await loadOpen();
    } catch (e: any) {
      alert(e.message || "Issue failed");
    }
  }

  async function onReturn(e: React.FormEvent) {
    e.preventDefault();
    try {
      await API(`/recordroom/return/${retId}`, {
        method: "POST",
        body: JSON.stringify({ remarks: retRemarks || null }),
      });
      setRetId(""); setRetRemarks("");
      await loadOpen();
    } catch (e: any) {
      alert(e.message || "Return failed");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 900 }}>
      <h1>Record Room</h1>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid
