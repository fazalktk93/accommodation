// src/pages/HousesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminOnly from "../components/AdminOnly";
import Modal from "../components/Modal";
import { api, createHouse, updateHouse, deleteHouse } from "../api";

// Fixed pagination: 50 per page
const API_MAX_LIMIT = 1000;            // backend cap (used for fallback search)
const PAGE_SIZE = 50;                  // UI page size

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const emptyHouse = {
  file_no: "",
  qtr_no: "",
  street: "",
  sector: "",
  type_code: "",
  pool: "",
  status: "vacant",
  status_manual: false,
};

/** 🔗 Allotment history URL helper — adjust if your route differs */
function buildAllotmentHistoryUrl(row) {
  return `/allotments?house_id=${encodeURIComponent(row.id)}`;
}

/* ---------- tiny helpers ---------- */
const fmt = (x) => (x !== undefined && x !== null && String(x).trim() !== "" ? String(x) : "-");
const toStr = (x) => (x === null || x === undefined ? "" : String(x));

/** Match a house row against a user query (tokenized, forgiving) */
function matchesHouse(h, rawQ) {
  const q = String(rawQ || "").trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/g);

  // build haystack once
  const hay = [
    h.file_no,
    h.sector,
    h.street,
    h.qtr_no,
    h.type_code,
    h.pool,
    h.status,
    h.allottee_name,
    h.allottee,
  ]
    .map(toStr)
    .join(" ")
    .toLowerCase();

  // special parse for inputs like "G-6/1-12" (sector/street-qtr)
  const m = q.match(/^([a-z]-\d+)\s*\/\s*([a-z0-9-]+)(?:\s*[-/]\s*([a-z0-9-]+))?$/i);
  if (m) {
    const [, sector, street, qtrMaybe] = m;
    const wantSector = (sector || "").toLowerCase();
    const wantStreet = (street || "").toLowerCase();
    const wantQtr = (qtrMaybe || "").toLowerCase();
    const okSector = toStr(h.sector).toLowerCase().includes(wantSector);
    const okStreet = toStr(h.street).toLowerCase().includes(wantStreet);
    const okQtr = !wantQtr || toStr(h.qtr_no).toLowerCase().includes(wantQtr);
    if (okSector && okStreet && okQtr) return true;
  }

  // all tokens must appear somewhere
  return tokens.every((t) => hay.includes(t));
}

export default function HousesPage() {
  const navigate = useNavigate();
  const query = useQuery();

  // URL-driven state so refresh/share preserves context
  const [page, setPage] = useState(Number(query.get("page") || 0)); // zero-based
  const [q, setQ] = useState(query.get("q") || "");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fallback search cache (when server-side search fails to filter)
  const [fallbackAll, setFallbackAll] = useState([]);  // full set fetched for client-side filter
  const [usingFallback, setUsingFallback] = useState(false);

  // modals
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyHouse);

  // sync URL
  const pushUrl = (p = page, queryText = q) => {
    const sp = new URLSearchParams();
    if (p) sp.set("page", String(p));
    if (queryText) sp.set("q", queryText);
    navigate({ search: sp.toString() ? `?${sp.toString()}` : "" }, { replace: true });
  };

  /** Load current page.
   * Strategy:
   *  1) Try server-side filtering (same params you had before) — preserves existing logic.
   *  2) If q is non-empty and server returns 0 results, do a client-side fallback:
   *     fetch up to API_MAX_LIMIT houses and filter with matchesHouse(), then paginate.
   */
  const load = async () => {
    setLoading(true);
    setError("");
    setUsingFallback(false);

    try {
      const skip = page * PAGE_SIZE;

      // ---- 1) server-side search (unchanged) ----
      const params = {
        skip,
        limit: PAGE_SIZE,
        q: q || undefined,
        file_no: q || undefined,
        sector: q || undefined,
        street: q || undefined,
        qtr_no: q || undefined,
        type_code: q || undefined,
        allottee_name: q || undefined,
        allottee: q || undefined,
      };
      const res = await api.request("GET", "/houses/", { params });
      const body = await res.json().catch(() => []);
      const items = Array.isArray(body)
        ? body
        : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.results)
        ? body.results
        : Array.isArray(body?.data)
        ? body.data
        : [];
      const totalFromHeader = parseInt(res.headers.get("X-Total-Count") || "", 10);
      const serverTotal = Number.isFinite(totalFromHeader) ? totalFromHeader : items.length;

      // If there is a query and server gave back 0 results, try fallback client filter
      if (q && items.length === 0) {
        // ---- 2) client-side fallback ----
        const res2 = await api.request("GET", "/houses/", {
          params: { skip: 0, limit: API_MAX_LIMIT },
        });
        const body2 = await res2.json().catch(() => []);
        const all = Array.isArray(body2)
          ? body2
          : Array.isArray(body2?.items)
          ? body2.items
          : Array.isArray(body2?.results)
          ? body2.results
          : Array.isArray(body2?.data)
          ? body2.data
          : [];

        const filtered = all.filter((h) => matchesHouse(h, q));
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageRows = filtered.slice(start, end);

        setRows(pageRows);
        setTotal(filtered.length);
        setFallbackAll(filtered);
        setUsingFallback(true);
      } else {
        // normal server-mode
        setRows(items);
        setTotal(serverTotal);
        setFallbackAll([]);
        setUsingFallback(false);
      }
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(String(e));
      setUsingFallback(false);
    } finally {
      setLoading(false);
    }
  };

  // When q or page changes, reload. If we’re already in fallback mode and q didn’t change,
  // re-slice the cached filtered array instead of refetching.
  const qRef = React.useRef(q);
  useEffect(() => {
    pushUrl(page, q);

    if (usingFallback && qRef.current === q) {
      // just re-slice the cached filtered set
      const start = page * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      setRows(fallbackAll.slice(start, end));
      setTotal(fallbackAll.length);
      return;
    }

    qRef.current = q;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q]);

  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;

  const onChange = (key) => (e) => {
    const v = e?.target?.type === "checkbox" ? e.target.checked : e?.target?.value ?? e;
    setForm((f) => ({ ...f, [key]: v }));
  };
  const openAdd = () => {
    setForm(emptyHouse);
    setAdding(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      file_no: row.file_no || "",
      qtr_no: row.qtr_no || "",
      street: row.street || "",
      sector: row.sector || "",
      type_code: row.type_code || "",
      pool: row.pool || "",
      status: row.status || "vacant",
      status_manual: !!row.status_manual,
    });
  };
  const closeModals = () => {
    setAdding(false);
    setEditing(null);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    try {
      await createHouse(form);
      closeModals();
      setPage(0);
      await load();
    } catch (err) {
      alert(`Create failed: ${err}`);
    }
  };
  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      await updateHouse(editing.id, form);
      closeModals();
      await load();
    } catch (err) {
      alert(`Update failed: ${err}`);
    }
  };
  const doDelete = async (row) => {
    if (!window.confirm("Delete this house?")) return;
    try {
      await deleteHouse(row.id);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  /** File No click -> Allotment history (supports new-tab with Ctrl/Meta/Shift) */
  const openHistory = (e, row) => {
    const url = buildAllotmentHistoryUrl(row);
    if (e?.metaKey || e?.ctrlKey || e?.shiftKey) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      navigate(url);
    }
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(0); load(); }}
          style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}
        >
          <input
            placeholder="Search by File No, Sector, Street, Qtr No, Type, Allottee..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            style={input}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); setPage(0); load(); }
            }}
          />
          <button type="submit" style={btn}>Search</button>
          <button
            type="button"
            onClick={() => { setQ(""); setPage(0); }}
            style={btnGhost}
          >
            Clear
          </button>
        </form>
        <AdminOnly>
          <button onClick={openAdd} style={btnPrimary}>+ Add House</button>
        </AdminOnly>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <style>{`
        /* Row card look without lines */
        table.rows-separated { border-collapse: separate; border-spacing: 0 10px; }
        table.rows-separated thead th { border-bottom: none; }
        table.rows-separated tbody td { background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
        table.rows-separated tbody tr td:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
        table.rows-separated tbody tr td:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }
        table.rows-separated tbody tr:hover td { background: rgba(34,197,94,0.06); }
        .linkish { background: transparent; border: 0; padding: 0; cursor: pointer; text-decoration: underline; color: #0b65c2; }
        .linkish:hover { opacity: 0.85; }
      `}</style>

      <div style={{ overflowX: "auto" }}>
        <table style={table} className="rows-separated">
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>File No</th>
              <th style={th}>Qtr No</th>
              <th style={th}>Street</th>
              <th style={th}>Sector</th>
              <th style={th}>Type</th>
              <th style={th}>Pool</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 16, textAlign: "center", color: "#666" }}>
                {q ? "No records match your search." : "No records"}
                {usingFallback ? " (client filtered)" : ""}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>{fmt(r.id)}</td>
                <td style={td}>
                  <button
                    className="linkish"
                    title="Open allotment history"
                    onClick={(e) => openHistory(e, r)}
                  >
                    {fmt(r.file_no)}
                  </button>
                </td>
                <td style={td}>{fmt(r.qtr_no)}</td>
                <td style={td}>{fmt(r.street)}</td>
                <td style={td}>{fmt(r.sector)}</td>
                <td style={td}>{fmt(r.type_code)}</td>
                <td style={td}>{fmt(r.pool)}</td>
                <td style={td}>
                  <span
                    style={pill(
                      r.status === "vacant" ? "rgba(34,197,94,0.12)" :
                      r.status === "occupied" ? "rgba(59,130,246,0.12)" :
                      "rgba(107,114,128,0.15)",
                      "#111"
                    )}
                  >
                    {fmt(r.status)}
                  </span>
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <AdminOnly>
                    <button style={btnSm} onClick={() => openEdit(r)}>Edit</button>{" "}
                    <button style={btnDangerSm} onClick={() => doDelete(r)}>Delete</button>
                  </AdminOnly>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", padding: 8 }}>
          <span style={{ color: "#666" }}>
            {rows.length ? `Showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}${usingFallback ? " (client filtered)" : ""}` : ""}
          </span>
          <button onClick={() => canPrev && setPage((p) => p - 1)} disabled={!canPrev} style={btn}>← Prev</button>
          <button onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext} style={btn}>
            Next →
          </button>
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={adding} onClose={closeModals} title="Add House">
        <form onSubmit={submitAdd} style={{ display: "grid", gap: 10 }}>
          <Row3>
            <Field label="File No" value={form.file_no} onChange={onChange("file_no")} required placeholder="e.g., 1234" />
            <Field label="Qtr No" value={form.qtr_no} onChange={onChange("qtr_no")} placeholder="e.g., 12" />
            <Field label="Street" value={form.street} onChange={onChange("street")} placeholder="e.g., 5" />
          </Row3>
          <Row3>
            <Field label="Sector" value={form.sector} onChange={onChange("sector")} placeholder="e.g., G-6/1" />
            <Select
              label="Type"
              value={form.type_code}
              onChange={onChange("type_code")}
              options={[
                { value: "", label: "-" },
                { value: "A", label: "A" }, { value: "B", label: "B" },
                { value: "C", label: "C" }, { value: "D", label: "D" },
                { value: "E", label: "E" }, { value: "F", label: "F" },
                { value: "G", label: "G" }, { value: "H", label: "H" },
                { value: "SITE", label: "SITE" },
              ]}
            />
            <Select
              label="Pool"
              value={form.pool}
              onChange={onChange("pool")}
              options={[
                { value: "", label: "-" },
                { value: "CDA", label: "CDA" },
                { value: "ESTATE OFFICE", label: "ESTATE OFFICE" },
              ]}
            />
          </Row3>
          <Row3>
            <Checkbox label="Status manual override" checked={form.status_manual} onChange={onChange("status_manual")} />
            <Select
              label="Status"
              value={form.status}
              onChange={onChange("status")}
              options={[
                { value: "vacant", label: "Vacant" },
                { value: "occupied", label: "Occupied" },
                { value: "reserved", label: "Reserved" },
              ]}
            />
            <div /> {/* spacer */}
          </Row3>
          <Actions onCancel={closeModals} submitText="Create" />
        </form>
      </Modal>

      {/* Edit Modal */}
      <AdminOnly>
        <Modal open={!!editing} onClose={closeModals} title="Edit House">
          <form onSubmit={submitEdit} style={{ display: "grid", gap: 10 }}>
            <Row3>
              <Field label="File No" value={form.file_no} onChange={onChange("file_no")} required />
              <Field label="Qtr No" value={form.qtr_no} onChange={onChange("qtr_no")} />
              <Field label="Street" value={form.street} onChange={onChange("street")} />
            </Row3>
            <Row3>
              <Field label="Sector" value={form.sector} onChange={onChange("sector")} />
              <Select
                label="Type"
                value={form.type_code}
                onChange={onChange("type_code")}
                options={[
                  { value: "", label: "-" },
                  { value: "A", label: "A" }, { value: "B", label: "B" },
                  { value: "C", label: "C" }, { value: "D", label: "D" },
                  { value: "E", label: "E" }, { value: "F", label: "F" },
                  { value: "G", label: "G" }, { value: "H", label: "H" },
                  { value: "SITE", label: "SITE" },
                ]}
              />
              <Select
                label="Pool"
                value={form.pool}
                onChange={onChange("pool")}
                options={[
                  { value: "", label: "-" },
                  { value: "general", label: "General" },
                  { value: "m/o", label: "M/O" },
                  { value: "h/o", label: "H/O" },
                ]}
              />
            </Row3>
            <Row3>
              <Checkbox label="Status manual override" checked={form.status_manual} onChange={onChange("status_manual")} />
              <Select
                label="Status"
                value={form.status}
                onChange={onChange("status")}
                options={[
                  { value: "vacant", label: "Vacant" },
                  { value: "occupied", label: "Occupied" },
                  { value: "reserved", label: "Reserved" },
                ]}
              />
              <div />
            </Row3>
            <Actions onCancel={closeModals} submitText="Save" />
          </form>
        </Modal>
      </AdminOnly>
    </div>
  );
}

/* --- UI bits --- */

const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px",
};
const th = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#fafafa",
  borderBottom: "none",
  position: "sticky",
  top: 0,
  zIndex: 1,
  color: "#111",
};
const td = { padding: "10px 12px", verticalAlign: "top", color: "#111" };
const input = {
  flex: 1,
  padding: "10px 12px",
  border: "1px solid #d9d9d9",
  borderRadius: 8,
  outline: "none",
  color: "#111",
  background: "#fff",
};
const btn = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d9d9d9",
  background: "#ffffff",
  cursor: "pointer",
  color: "#111",
};
const btnGhost = { ...btn, background: "#f3f4f6" };
const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #0b65c2",
  background: "#0b65c2",
  color: "#fff",
  cursor: "pointer",
};
const btnSm = { ...btn, padding: "6px 10px", fontSize: 13 };
const btnDangerSm = { ...btnSm, borderColor: "#d33", color: "#d33" };

/** ✅ Added: pill style helper that was missing (this was crashing the page) */
const pill = (bg, color = "#111") => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: bg,
  color,
  fontSize: 12,
  lineHeight: "18px",
});

function Field({ label, value, onChange, type = "text", required, readOnly, placeholder }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        readOnly={readOnly}
        placeholder={placeholder}
        style={input}
      />
    </label>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <select value={value ?? ""} onChange={onChange} style={input}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <input type="checkbox" checked={!!checked} onChange={onChange} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  );
}
function Actions({ onCancel, submitText }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
      <button type="button" onClick={onCancel} style={btn}>Cancel</button>
      <button type="submit" style={btnPrimary}>{submitText}</button>
    </div>
  );
}
function Row3({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      {children}
    </div>
  );
}
const errorBox = { padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#991b1b", border: "1px solid rgba(239,68,68,0.25)" };
