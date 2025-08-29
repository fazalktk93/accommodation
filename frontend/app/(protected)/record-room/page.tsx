"use client";
const API =
  process.env.NEXT_PUBLIC_API ??
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://192.168.0.105:8000");


import React, { useEffect, useMemo, useState } from "react";

/* --------------------------- Types --------------------------- */
type FileLite = {
  accommodation_file_id: number | null;
  house_id: number;
  file_number: string;
  house_no?: string | null;
  sector?: string | null;
};

type Movement = {
  id: number;
  file_number: string | null;
  movement: "issue" | "receive";
  moved_at: string;
  to_whom?: string | null;
  remarks?: string | null;
};

type Page<T> = {
  page: number;
  per_page: number;
  total: number;
  items: T[];
};

/* -------------------------- Config --------------------------- */
function apiBase() {
  if (process.env.NEXT_PUBLIC_API) return process.env.NEXT_PUBLIC_API;
  if (typeof window !== "undefined") {
    // fallback: auto-use the current host with port 8000
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://192.168.0.105:8000"; // last-resort fallback
}

function getToken(): string | null {
  const keys = [
    "token","access_token","jwt","authToken",
    "accessToken","Authorization","bearer","auth"
  ];
  for (const k of keys) {
    const v = typeof window !== "undefined" ? (localStorage.getItem(k) || sessionStorage.getItem(k)) : null;
    if (!v) continue;
    try {
      const parsed = JSON.parse(v);
      if (typeof parsed === "string") return parsed;
      const firstStr = Object.values(parsed).find((x) => typeof x === "string") as string | undefined;
      if (firstStr) return firstStr;
    } catch {
      return v;
    }
  }
  return null;
}

async function fetchJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",   // send cookies too (if your login uses them)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/* -------------------------- Page ----------------------------- */
export default function RecordRoom() {
  const [mode, setMode] = useState<"browse" | "issue" | "receive">("browse");

  // Issue state
  const [fileQuery, setFileQuery] = useState("");
  const [files, setFiles] = useState<FileLite[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | "">("");
  const selectedFile = useMemo(
    () => files.find((f) => f.id === (typeof selectedFileId === "number" ? selectedFileId : -1)),
    [files, selectedFileId]
  );
  const [issuedTo, setIssuedTo] = useState("");
  const [issueRemarks, setIssueRemarks] = useState("");

  // Movements
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [openMovements, setOpenMovements] = useState<Page<Movement> | null>(null);

  // Receive
  const [receiveMovementId, setReceiveMovementId] = useState<number | "">("");
  const [receiveRemarks, setReceiveRemarks] = useState("");

  // Errors
  const [error, setError] = useState<string | null>(null);

  /* -------------------- Load files (Issue) -------------------- */
  useEffect(() => {
    if (mode !== "issue") return;
    const ctrl = new AbortController();
    setError(null);
    fetchJSON<FileLite[]>(
      `${API}/recordroom/files?q=${encodeURIComponent(fileQuery)}`,
      { signal: ctrl.signal }
    )
      .then((arr) => setFiles(Array.isArray(arr) ? arr : []))
      .catch((e) => {
        console.error("/recordroom/files error:", e);
        setFiles([]);
        setError("Could not load files. Are you logged in?");
      });
    return () => ctrl.abort();
  }, [mode, fileQuery]);

  /* --------------- Load open movements (Browse/Receive) --------------- */
  function refreshOpenMovements(newPage = page) {
    setError(null);
    fetchJSON<Page<Movement>>(
      `${API}/recordroom/movements?status=open&page=${newPage}&per_page=${perPage}`
    )
      .then((d) => setOpenMovements(d))
      .catch((e) => {
        console.error("/recordroom/movements error:", e);
        setOpenMovements({ page: newPage, per_page: perPage, total: 0, items: [] });
        setError("Could not load open movements. Are you logged in?");
      });
  }

  useEffect(() => {
    refreshOpenMovements(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, mode]);

  /* ------------------------- Actions ------------------------- */
  async function handleIssue() {
    if (selectedFileId === "" || !issuedTo.trim()) {
      alert("Select a file and enter ‘Issued To’.");
      return;
    }
    const file = files.find((f) => f.id === selectedFileId);
    if (!file) return;

    try {
      await fetchJSON(`${API}/recordroom/issue`, {
        method: "POST",
        body: JSON.stringify({
          house_id: file.house_id,                 // backend creates AF if missing
          to_whom: issuedTo.trim(),
          remarks: issueRemarks.trim() || null,
        }),
      });
      setIssuedTo("");
      setIssueRemarks("");
      setSelectedFileId("");
      setFileQuery("");
      setMode("browse");
      setPage(1);
      refreshOpenMovements(1);
    } catch (e: any) {
      console.error("issue error:", e);
      alert(e.message || "Issue failed");
    }
  }

  async function handleReceiveById(movementId: number, remarks?: string) {
    try {
      await fetchJSON(`${API}/recordroom/receive`, {
        method: "POST",
        body: JSON.stringify({
          movement_id: movementId,
          remarks: remarks?.trim() || null,
        }),
      });
      const totalAfter = (openMovements?.total ?? 1) - 1;
      const maxPage = Math.max(1, Math.ceil(totalAfter / perPage));
      const nextPage = Math.min(page, maxPage);
      setPage(nextPage);
      refreshOpenMovements(nextPage);
    } catch (e: any) {
      console.error("receive error:", e);
      alert(e.message || "Receive failed");
    }
  }

  async function handleReceiveSubmit() {
    if (receiveMovementId === "") {
      alert("Choose an open movement to receive.");
      return;
    }
    await handleReceiveById(receiveMovementId as number, receiveRemarks);
    setReceiveMovementId("");
    setReceiveRemarks("");
    setMode("browse");
  }

  /* --------------------------- UI ---------------------------- */
  function FileLabel({ f }: { f: FileLite }) {
    return (
      <>
        {f.file_number} — House {f.house_no ?? "-"}, Sector {f.sector ?? "-"}
      </>
    );
  }

  const totalPages =
    openMovements?.total ? Math.max(1, Math.ceil(openMovements.total / (openMovements.per_page || perPage))) : 1;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 8 }}>Record Room</h2>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #f99", padding: 8, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* CRUD selector */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <label>Choose action:</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
          <option value="browse">Browse (Open files)</option>
          <option value="issue">Issue file</option>
          <option value="receive">Receive / Keep in Record</option>
        </select>
      </div>

      {/* ISSUE */}
      {mode === "issue" && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <h4 style={{ marginTop: 0 }}>Issue File</h4>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label style={{ fontWeight: 600 }}>Search File Number</label>
              <input
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
                placeholder="Type part of the file number…"
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600 }}>Select File</label>
              <select
                style={{ width: "100%", padding: 8, marginTop: 4 }}
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Select —</option>
                {(files ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.file_number} — House {f.house_no ?? "-"}, Sector {f.sector ?? "-"}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                {selectedFile ? (
                  <>Selected: <FileLabel f={selectedFile} /></>
                ) : (
                  "Select a file to see House & Sector"
                )}
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 600 }}>Issued To</label>
              <input
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
                placeholder="Person / Section"
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600 }}>Remarks</label>
              <textarea
                value={issueRemarks}
                onChange={(e) => setIssueRemarks(e.target.value)}
                placeholder="Optional"
                rows={3}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </div>

            <div>
              <button onClick={handleIssue} style={{ padding: "8px 12px" }}>
                Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE */}
      {mode === "receive" && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <h4 style={{ marginTop: 0 }}>Receive / Keep in Record</h4>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label style={{ fontWeight: 600 }}>Open Movement</label>
              <select
                style={{ width: "100%", padding: 8, marginTop: 4 }}
                value={receiveMovementId}
                onChange={(e) => setReceiveMovementId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Select —</option>
                {(openMovements?.items ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {(m.file_number ?? "-")} — issued to {m.to_whom ?? "-"} at{" "}
                    {new Date(m.moved_at).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontWeight: 600 }}>Remarks</label>
              <textarea
                value={receiveRemarks}
                onChange={(e) => setReceiveRemarks(e.target.value)}
                placeholder="Optional"
                rows={3}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
              />
            </div>

            <div>
              <button onClick={handleReceiveSubmit} style={{ padding: "8px 12px" }}>
                Receive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BROWSE (Open Movements) */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h4 style={{ marginTop: 0 }}>Currently Issued (Open Movements)</h4>

        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th align="left">File Number</th>
                <th align="left">Issued To</th>
                <th align="left">Remarks</th>
                <th align="left">Issued At</th>
                <th align="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {(openMovements?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5}>No open movements.</td>
                </tr>
              ) : (
                openMovements!.items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.file_number ?? "-"}</td>
                    <td>{m.to_whom ?? "-"}</td>
                    <td>{m.remarks ?? "-"}</td>
                    <td>{new Date(m.moved_at).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => {
                          const r = prompt("Optional remarks for receiving this file:", "");
                          handleReceiveById(m.id, r ?? undefined);
                        }}
                      >
                        Keep in Record
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button disabled={(openMovements?.page ?? 1) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </button>
          <div>
            Page {openMovements?.page ?? 1} / {totalPages}
          </div>
          <button
            disabled={!openMovements || openMovements.page * openMovements.per_page >= openMovements.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
          <div style={{ marginLeft: "auto", opacity: 0.7 }}>
            Total open: {openMovements?.total ?? 0}
          </div>
        </div>
      </div>
    </div>
  );
}
