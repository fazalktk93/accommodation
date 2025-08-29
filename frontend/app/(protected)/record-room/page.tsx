"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api"; // your existing helper that adds auth headers

type Movement = {
  id: number;
  file_number: string;
  movement: "issue" | "receive";
  moved_at: string;
  to_whom: string | null;
  remarks: string | null;
};

export default function RecordRoomPage() {
  const [open, setOpen] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Issue form
  const [fileNo, setFileNo] = useState("");
  const [toWhom, setToWhom] = useState("");
  const [issueRemarks, setIssueRemarks] = useState("");

  // Receive form
  const [retFileNo, setRetFileNo] = useState("");
  const [retToWhom, setRetToWhom] = useState("");
  const [retRemarks, setRetRemarks] = useState("");

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = await API<Movement[]>("/recordroom/movements");
      // “Open” = latest movement for a file is ISSUE. We’ll filter client-side.
      const latestByFile = new Map<string, Movement>();
      for (const m of data) {
        const prev = latestByFile.get(m.file_number);
        if (!prev || new Date(m.moved_at) > new Date(prev.moved_at)) {
          latestByFile.set(m.file_number, m);
        }
      }
      const openList = [...latestByFile.values()].filter(m => m.movement === "issue");
      setOpen(openList);
    } catch (e: any) {
      setErr(e.message || "Failed to load movements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onIssue(e: React.FormEvent) {
    e.preventDefault();
    try {
      await API("/recordroom/issue", {
        method: "POST",
        body: JSON.stringify({
          file_number: fileNo.trim(),
          to_whom: toWhom.trim() || null,
          remarks: issueRemarks.trim() || null
        })
      });
      setFileNo(""); setToWhom(""); setIssueRemarks("");
      refresh();
    } catch (e: any) {
      alert(e.message || "Issue failed");
    }
  }

  async function onReceive(e: React.FormEvent) {
    e.preventDefault();
    try {
      await API("/recordroom/receive", {
        method: "POST",
        body: JSON.stringify({
          file_number: retFileNo.trim(),
          to_whom: retToWhom.trim() || null,
          remarks: retRemarks.trim() || null
        })
      });
      setRetFileNo(""); setRetToWhom(""); setRetRemarks("");
      refresh();
    } catch (e: any) {
      alert(e.message || "Receive failed");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 900 }}>
      <h1>Record Room</h1>

      {err && <p style={{ color: "crimson", marginTop: 8 }}>{err}</p>}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 16
        }}
      >
        <form onSubmit={onIssue} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
          <h2 style={{ fontWeight: 600, marginBottom: 12 }}>Issue File</h2>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span>File Number</span>
            <input
              required
              value={fileNo}
              onChange={(e) => setFileNo(e.target.value)}
              placeholder="e.g. A-1234"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span>Issued To</span>
            <input
              value={toWhom}
              onChange={(e) => setToWhom(e.target.value)}
              placeholder="Person/section"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span>Remarks</span>
            <textarea
              value={issueRemarks}
              onChange={(e) => setIssueRemarks(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
            {loading ? "Working..." : "Issue"}
          </button>
        </form>

        <form onSubmit={onReceive} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
          <h2 style={{ fontWeight: 600, marginBottom: 12 }}>Receive/Return File</h2>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span>File Number</span>
            <input
              required
              value={retFileNo}
              onChange={(e) => setRetFileNo(e.target.value)}
              placeholder="e.g. A-1234"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span>Received From / Location</span>
            <input
              value={retToWhom}
              onChange={(e) => setRetToWhom(e.target.value)}
              placeholder="Person/section"
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span>Remarks</span>
            <textarea
              value={retRemarks}
              onChange={(e) => setRetRemarks(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
            {loading ? "Working..." : "Receive"}
          </button>
        </form>
      </section>

      <h2 style={{ marginTop: 24, fontWeight: 600 }}>Currently Issued (Open Movements)</h2>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul style={{ marginTop: 8 }}>
          {open.length === 0 && <li>No open movements.</li>}
          {open.map((m) => (
            <li key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <div style={{ fontWeight: 600 }}>{m.file_number}</div>
              <div>Issued to: {m.to_whom || "—"}</div>
              <div>When: {new Date(m.moved_at).toLocaleString()}</div>
              {m.remarks && <div>Remarks: {m.remarks}</div>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
