// src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AdminOnly from "../components/AdminOnly";
import Modal from "../components/Modal";
import { api, createAllotment, updateAllotment, deleteAllotment } from "../api";

const API_MAX_LIMIT = 1000;           // match backend cap
const PAGE_SIZE = 50;                 // UI page size
const BASE = "/api/allotments/";      // trailing slash avoids 307

/**
 * Fetch one page of allotments.
 * @param {number} page - 1-based page number
 * @param {{ q?: string }} opts - optional filters (e.g. free-text search)
 */
export async function fetchAllotments(page = 1, opts = {}) {
  const safeLimit = Math.min(Math.max(PAGE_SIZE, 1), API_MAX_LIMIT);
  const skip = (page - 1) * safeLimit;

  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(safeLimit),
  });
  if (opts.q) params.set("q", opts.q);

  const url = `${BASE}?${params.toString()}`;
  const r = await fetch(url, { credentials: "include" });

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${r.statusText} – ${detail}`);
  }

  const items = await r.json();
  const total = Number(r.headers.get("X-Total-Count") || items.length);
  return { items, total, pageSize: safeLimit, page };
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const empty = {
  house_id: "",
  person_name: "",
  designation: "",
  directorate: "",
  cnic: "",
  bps: "",
  medium: "",
  allotment_date: "",
  occupation_date: "",
  vacation_date: "",
  dob: "",
  dor: "",
  qtr_status: "active",
  notes: "",
};

function addYears(dateStr, years) {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).substring(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  try {
    return new Date(y + years, m - 1, d).toISOString().substring(0, 10);
  } catch {
    // clamp leap days
    const last = new Date(y + years, m, 0).getDate();
    return `${y + years}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }
}

const MEDIUM_OPTIONS = [
  { value: "family transfer", label: "family transfer" },
  { value: "mutual", label: "mutual" },
  { value: "transit", label: "transit" },
  { value: "departmental", label: "departmental" },
  { value: "fresh", label: "fresh" },
];

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <select value={value || ""} onChange={onChange} style={input}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}


const fmt = (x) => (x ? String(x) : "-");
const date = (x) => (x ? String(x).substring(0, 10) : "-");

function HousePicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState([]);
  const [chosen, setChosen] = useState(null); // {id, file_no, qtr_no, sector, street}

  // load current selection (when editing)
  useEffect(() => {
    let done = false;
    async function loadCurrent() {
      if (!value) return;
      try {
        const res = await api.request("GET", `/houses/${value}`);
        if (!res.ok) return;
        const h = await res.json();
        if (!done) setChosen(h);
      } catch {}
    }
    loadCurrent();
    return () => { done = true; };
  }, [value]);

  // search debounced
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) { setOpts([]); return; }
      setLoading(true);
      try {
        const res = await api.request("GET", "/houses/", {
          params: { q, limit: 10 },
        });
        const body = await res.json().catch(() => []);
        const items = Array.isArray(body)
          ? body
          : body?.items || body?.results || body?.data || [];
        setOpts(items);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (h) => {
    setChosen(h);
    setOpts([]);
    setQ("");
    onChange?.(h.id);
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>House (search by file / qtr / street / sector)</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to search…"
        style={input}
      />
      {loading && <div style={{ fontSize: 12, color: "#666" }}>Searching…</div>}
      {opts.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, maxHeight: 240, overflowY: "auto" }}>
          {opts.map((h) => (
            <button
              key={h.id}
              onClick={() => pick(h)}
              style={{
                display: "block",
                textAlign: "left",
                width: "100%",
                padding: "8px 10px",
                border: 0,
                background: "#fff",
                borderBottom: "1px solid #f3f4f6",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {h.file_no || `#${h.id}`} &nbsp;•&nbsp; {h.qtr_no || "-"}
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {h.sector || "-"} &nbsp; {h.street || "-"} &nbsp; {h.type_code || ""}
              </div>
            </button>
          ))}
        </div>
      )}
      {chosen && (
        <div style={{ fontSize: 12, color: "#333" }}>
          Selected: <strong>{chosen.file_no || `#${chosen.id}`}</strong> — Qtr {chosen.qtr_no || "-"} •{" "}
          {chosen.sector || "-"} / {chosen.street || "-"}
        </div>
      )}
    </div>
  );
}


export default function AllotmentsPage() {
  const query = useQuery();
  const [page, setPage] = useState(Number(query.get("page") || 0));
  const [q, setQ] = useState(query.get("q") || "");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // modals
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const pushUrl = (p = page, queryText = q) => {
    const sp = new URLSearchParams();
    if (p) sp.set("page", String(p));
    if (queryText) sp.set("q", queryText);
    window.history.replaceState(null, "", `?${sp.toString()}`);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const skip = page * PAGE_SIZE;
      const params = {
        skip,
        limit: PAGE_SIZE,
        // single-box search that fans out to supported filters
        q: q || undefined,
        file_no: q || undefined,
        qtr_no: q || undefined,
        person_name: q || undefined,
        cnic: q || undefined,
      };
      const res = await api.request("GET", "/allotments/", { params });
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
      setRows(items);
      setTotal(Number.isFinite(totalFromHeader) ? totalFromHeader : items.length);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    pushUrl(page, q);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q]);

  // CRUD
  const openAdd = () => {
    setForm(empty);
    setAdding(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      house_id: row.house_id ?? "",
      person_name: row.person_name ?? row.allottee_name ?? "",
      designation: row.designation ?? "",
      directorate: row.directorate ?? row.department ?? "",
      cnic: row.cnic ?? "",
      bps: row.bps ?? "",
      medium: row.medium ?? "",
      allotment_date: (row.allotment_date || "").substring(0, 10),
      occupation_date: (row.occupation_date || "").substring(0, 10),
      vacation_date: (row.vacation_date || "").substring(0, 10),
      dob: (row.dob || "").substring(0, 10),
      dor: (row.dor || "").substring(0, 10),
      qtr_status: row.qtr_status || "active",
      notes: row.notes ?? "",
    });
  };
  const closeModals = () => {
    setAdding(false);
    setEditing(null);
    setForm(empty);
  };
  const onChange = (k) => (e) =>
    setForm((f) => {
      const v = e?.target?.value ?? e;
      const next = { ...f, [k]: v };
      if (k === "dob") next.dor = v ? addYears(v, 60) : "";
      if (k === "bps") next.bps = v === "" ? "" : String(Number(v) || "");
      return next;
    });

  const submitAdd = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        house_id: form.house_id ? Number(form.house_id) : undefined,
        bps: form.bps ? Number(form.bps) : undefined,
        dor: form.dor || (form.dob ? addYears(form.dob, 60) : undefined),
      };
      await createAllotment(payload);
      closeModals();
      setPage(0);
      await load();
    } catch (err) {
      alert(`Create failed: ${err}`);
    }
  };
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!form.house_id) {
      alert("Please select a house for this allotment.");
      return;
    }
    try {
      const payload = {
        ...form,
        bps: form.bps ? Number(form.bps) : undefined,
        dor: form.dor || (form.dob ? addYears(form.dob, 60) : undefined),
      };
      await updateAllotment(editing.id, payload);
      closeModals();
      await load();
    } catch (err) {
      alert(`Update failed: ${err}`);
    }
  };
  const onDelete = async (row) => {
    if (!window.confirm(`Delete allotment #${row.id}?`)) return;
    try {
      await deleteAllotment(row.id);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  // pagination
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  // helper to read house data whether flattened or nested
  const houseField = (r, k) => r[k] ?? r.house?.[k] ?? "-";

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, flex: 1 }}>Allotments</h2>
        <AdminOnly>
          <button onClick={openAdd} style={btnPrimary}>Add Allotment</button>
        </AdminOnly>
      </div>

      {/* search */}
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(0); load(); }}
        style={{ display: "flex", gap: 8, marginBottom: 12 }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, CNIC, file no, etc."
          style={input}
        />
        <button type="submit" style={btn}>Search</button>
      </form>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10 }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Allottee</th>
              <th style={th}>Sector</th>
              <th style={th}>Street</th>
              <th style={th}>Qtr</th>
              <th style={th}>BPS</th>
              <th style={th}>Medium</th>
              <th style={th}>Allotment Date</th>
              <th style={th}>Occupation Date</th>
              <AdminOnly><th style={th}>DOR</th></AdminOnly>
              <th style={th}>Status</th>
              <AdminOnly><th style={th}>Actions</th></AdminOnly>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 16, textAlign: "center", color: "#666" }}>No records</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} style={tr}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 600 }}>{fmt(r.person_name || r.allottee_name)}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {fmt(r.designation)}{r.designation ? "" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#777" }}>{fmt(r.cnic)}</div>
                </td>
                <td style={td}>{fmt(houseField(r, "sector"))}</td>
                <td style={td}>{fmt(houseField(r, "street"))}</td>
                <td style={td}>{fmt(houseField(r, "qtr_no"))}</td>
                <td style={td}>{fmt(r.bps)}</td>
                <td style={td}>{fmt(r.medium)}</td>
                <td style={td}>{date(r.allotment_date)}</td>
                <td style={td}>{date(r.occupation_date)}</td>
                <AdminOnly>
                  <td style={td}>{date(r.dor || (r.dob ? addYears(r.dob, 60) : ""))}</td>
                </AdminOnly>
                <td style={td}>
                  <span style={pill(r.qtr_status === "active" ? "#12b981" : "#999")}>
                    {fmt(r.qtr_status)}
                  </span>
                </td>
                <AdminOnly>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(r)} style={btnSm}>Edit</button>{" "}
                    <button onClick={() => onDelete(r)} style={btnDangerSm}>Delete</button>
                  </td>
                </AdminOnly>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={11} style={{ padding: 16 }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pager */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ color: "#222" }}>
          Page <strong>{page + 1}</strong> of <strong>{Math.max(1, Math.ceil(total / PAGE_SIZE))}</strong>
          {Number.isFinite(total) ? <> &nbsp;•&nbsp; Total <strong>{total}</strong></> : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => page > 0 && setPage((p) => p - 1)} disabled={page <= 0} style={btn}>← Prev</button>
          <button onClick={() => (page + 1) * PAGE_SIZE < total && setPage((p) => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total} style={btn}>
            Next →
          </button>
        </div>
      </div>

      {/* Add Modal (admins only) */}
      <AdminOnly>
        <Modal open={adding} onClose={closeModals} title="Add Allotment">
          <form onSubmit={submitAdd} style={{ display: "grid", gap: 10 }}>
            <Row3>
              <HousePicker
                value={form.house_id}
                onChange={(hid) => setForm((f) => ({ ...f, house_id: hid }))}
              />
              <Field label="Allottee Name" value={form.person_name} onChange={onChange("person_name")} required />
              <Field label="CNIC" value={form.cnic} onChange={onChange("cnic")} />
            </Row3>

            <Row3>
              <Field label="Designation" value={form.designation} onChange={onChange("designation")} />
              <Field label="Directorate" value={form.directorate} onChange={onChange("directorate")} />
              <Field label="BPS" value={form.bps} onChange={onChange("bps")} />
            </Row3>
            <Row3>
              <Select
                label="Medium"
                value={form.medium}
                onChange={onChange("medium")}
                options={MEDIUM_OPTIONS}
              />
              <Field type="date" label="Allotment Date" value={form.allotment_date} onChange={onChange("allotment_date")} />
              <Field type="date" label="Occupation Date" value={form.occupation_date} onChange={onChange("occupation_date")} />
            </Row3>
            <Row3>
              {/* DOB/DOR kept in admin form only */}
              <Field type="date" label="DOB" value={form.dob} onChange={onChange("dob")} />
              <Field type="date" label="DOR (auto 60y)" value={form.dor} onChange={() => {}} readOnly />
              <Field type="date" label="Vacation Date" value={form.vacation_date} onChange={onChange("vacation_date")} />
            </Row3>
            <Field label="Notes" value={form.notes} onChange={onChange("notes")} />
            <Actions onCancel={closeModals} submitText="Create" />
          </form>
        </Modal>
      </AdminOnly>

      {/* Edit Modal (admins only) */}
      <AdminOnly>
        <Modal open={!!editing} onClose={closeModals} title={editing ? `Edit #${editing.id}` : "Edit"}>
          <form onSubmit={submitEdit} style={{ display: "grid", gap: 10 }}>
            <Row3>
              <Field label="Allottee Name" value={form.person_name} onChange={onChange("person_name")} required />
              <Field label="CNIC" value={form.cnic} onChange={onChange("cnic")} />
              <Field label="BPS" value={form.bps} onChange={onChange("bps")} />
            </Row3>
            <Row3>
              <Field label="Designation" value={form.designation} onChange={onChange("designation")} />
              <Field label="Directorate" value={form.directorate} onChange={onChange("directorate")} />
              <Field label="Medium" value={form.medium} onChange={onChange("medium")} />
            </Row3>
            <Row3>
              <Field type="date" label="Allotment Date" value={form.allotment_date} onChange={onChange("allotment_date")} />
              <Field type="date" label="Occupation Date" value={form.occupation_date} onChange={onChange("occupation_date")} />
              <Field type="date" label="Vacation Date" value={form.vacation_date} onChange={onChange("vacation_date")} />
            </Row3>
            <Row3>
              <Field type="date" label="DOB" value={form.dob} onChange={onChange("dob")} />
              <Field type="date" label="DOR (auto 60y)" value={form.dor} onChange={() => {}} readOnly />
              <div />
            </Row3>
            <Field label="Notes" value={form.notes} onChange={onChange("notes")} />
            <Actions onCancel={closeModals} submitText="Save" />
          </form>
        </Modal>
      </AdminOnly>
    </div>
  );
}

/* --- UI bits --- */
const input = { flex: 1, padding: "10px 12px", border: "1px solid #d9d9d9", borderRadius: 8, background: "#fff", color: "#111" };
const btn = { padding: "10px 14px", borderRadius: 8, border: "1px solid #d9d9d9", background: "#fff", cursor: "pointer", color: "#111" };
const btnPrimary = { padding: "10px 14px", borderRadius: 8, border: "1px solid #0b65c2", background: "#0b65c2", color: "#fff", cursor: "pointer" };
const btnSm = { ...btn, padding: "6px 10px", fontSize: 13 };
const btnDangerSm = { ...btnSm, borderColor: "#d33", color: "#d33" };

const pill = (bg) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 12, background: bg, color: "#fff", fontSize: 12 });

const table = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th = { textAlign: "left", padding: "10px 12px", background: "#fafafa", borderBottom: "1px solid #eee", position: "sticky", top: 0, zIndex: 1, color: "#111" };
const tr = { borderBottom: "1px solid #f1f1f1" };
const td = { padding: "10px 12px", verticalAlign: "top", color: "#111" };
const errorBox = {
  background: "#fdecea",
  color: "#a12622",
  border: "1px solid #f5c6c3",   // ← fixed
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
};

function Field({ label, value, onChange, type = "text", required = false, readOnly = false }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <input type={type} value={value || ""} onChange={onChange} required={required} readOnly={readOnly} style={input} />
    </label>
  );
}
function Row3({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>{children}</div>; }
function Actions({ onCancel, submitText }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
      <button type="button" onClick={onCancel} style={btn}>Cancel</button>
      <button type="submit" style={btnPrimary}>{submitText}</button>
    </div>
  );
}
