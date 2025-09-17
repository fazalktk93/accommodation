// src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AdminOnly from "../components/AdminOnly";
import Modal from "../components/Modal";
import { api, createAllotment, updateAllotment, deleteAllotment } from "../api";

const API_MAX_LIMIT = 1000;           // match backend cap
const PAGE_SIZE = 50;                 // UI page size

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
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCFullYear(dt.getUTCFullYear() + years);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch { return ""; }
}

const MEDIUM_OPTIONS = [
  { value: "", label: "-" },
  { value: "general", label: "General" },
  { value: "m/o", label: "M/O" },
  { value: "h/o", label: "H/O" },
];

function Field({ label, value, onChange, type = "text", required, readOnly }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        readOnly={readOnly}
        style={input}
      />
    </label>
  );
}
function TextArea({ label, value, onChange, rows = 3 }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
      <textarea value={value ?? ""} onChange={onChange} rows={rows} style={{ ...input, minHeight: 80 }} />
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

const fmt = (x) => (x ? String(x) : "-");
const date = (x) => (x ? String(x).substring(0, 10) : "-");

/* ---------- Robust getters for house fields ----------
   Your API may return house info either nested (r.house.sector)
   or flattened (r.sector). These getters try multiple paths. */
const pick = (...vals) => {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};
const getQtrNo = (r) =>
  pick(
    r.qtr_no,
    r.quarter_no,
    r.qtrNo,
    r.house?.qtr_no,
    r.house?.quarter_no,
    r.house?.qtrNo,
    r.house_details?.qtr_no,
    r.house_info?.qtr_no,
    r.house_data?.qtr_no
  );
const getStreet = (r) =>
  pick(
    r.street,
    r.street_no,
    r.streetName,
    r.house?.street,
    r.house?.street_no,
    r.house?.streetName,
    r.house_details?.street,
    r.house_info?.street,
    r.house_data?.street
  );
const getSector = (r) =>
  pick(
    r.sector,
    r.sector_code,
    r.sectorCode,
    r.house?.sector,
    r.house?.sector_code,
    r.house?.sectorCode,
    r.house_details?.sector,
    r.house_info?.sector,
    r.house_data?.sector
  );

/* A small helper if you still want a single function */
const houseField = (r, which) => {
  if (which === "qtr_no") return getQtrNo(r) || "-";
  if (which === "street") return getStreet(r) || "-";
  if (which === "sector") return getSector(r) || "-";
  return "-";
};

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

  const search = async () => {
    setLoading(true);
    try {
      const res = await api.request("GET", "/houses/", { params: { q } });
      const list = await res.json().catch(() => []);
      setOpts(Array.isArray(list) ? list : (list?.items || list?.results || list?.data || []));
    } catch {
      setOpts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input placeholder="Find house (file/sector/street/qtr/type)" value={q} onChange={(e) => setQ(e.target.value)} style={input} />
        <button onClick={search} style={btn} disabled={loading}>{loading ? "..." : "Search"}</button>
      </div>
      {value && chosen && (
        <div style={{ fontSize: 13, color: "#555" }}>
          Selected: <strong>{fmt(chosen.file_no)}</strong> — {fmt(getQtrNo(chosen))} / {fmt(getStreet(chosen))} / {fmt(getSector(chosen))} ({fmt(chosen.type_code)})
        </div>
      )}
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#555" }}>Choose House</span>
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={input}>
          <option value="">-</option>
          {opts.map((h) => (
            <option key={h.id} value={h.id}>
              {fmt(h.file_no)} — {fmt(getQtrNo(h))} / {fmt(getStreet(h))} / {fmt(getSector(h))} ({fmt(h.type_code)})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Row3({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>{children}</div>;
}
function Actions({ onCancel, submitText }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
      <button type="button" onClick={onCancel} style={btn}>Cancel</button>
      <button type="submit" style={btnPrimary}>{submitText}</button>
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
        q: q || undefined,
        person_name: q || undefined,
        designation: q || undefined,
        directorate: q || undefined,
        cnic: q || undefined,
        house_q: q || undefined,
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
      dor: (row.dor || (row.dob ? addYears(row.dob, 60) : ""))?.substring(0, 10),
      qtr_status: row.qtr_status ?? "active",
      notes: row.notes ?? "",
    });
  };
  const closeModals = () => {
    setAdding(false);
    setEditing(null);
  };

  const onChange = (key) => (e) => {
    const v = e?.target?.type === "checkbox" ? e.target.checked : e?.target?.value ?? e;
    setForm((f) => ({ ...f, [key]: v }));
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!form.house_id) {
      alert("Please select a house for this allotment.");
      return;
    }
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
  const doDelete = async (row) => {
    if (!window.confirm("Delete this allotment?")) return;
    try {
      await deleteAllotment(row.id);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;

  const pill = (bg = "#eee", color = "#111") => ({
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: bg,
    color,
    textTransform: "capitalize",
  });

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(0); load(); }}
          style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}
        >
          <input
            placeholder="Search by Name, CNIC, Designation, Directorate, House..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={input}
          />
          <button type="submit" style={btn}>Search</button>
          <button
            type="button"
            onClick={() => { setQ(""); setPage(0); }}
            style={btn}
          >
            Clear
          </button>
        </form>
        <AdminOnly>
          <button onClick={openAdd} style={btnPrimary}>+ Add Allotment</button>
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
      `}</style>

      <div style={{ overflowX: "auto" }}>
        <table style={table} className="rows-separated">
          <thead>
            <tr>
              <th style={th}>Allottee</th>
              {/* Your requested order: Qtr → Street → Sector */}
              <th style={th}>Qtr No</th>
              <th style={th}>Street</th>
              <th style={th}>Sector</th>
              <th style={th}>BPS</th>
              <th style={th}>Medium</th>
              <th style={th}>Allotment</th>
              <th style={th}>Occupation</th>
              <th style={th}>DOR</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 16, textAlign: "center", color: "#666" }}>No records</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 600 }}>{fmt(r.person_name || r.allottee_name)}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{fmt(r.designation)}</div>
                  <div style={{ fontSize: 12, color: "#777" }}>{fmt(r.cnic)}</div>
                </td>

                {/* Use robust getters so values don't show as "-" when present in any shape */}
                <td style={td}>{fmt(houseField(r, "qtr_no"))}</td>
                <td style={td}>{fmt(houseField(r, "street"))}</td>
                <td style={td}>{fmt(houseField(r, "sector"))}</td>

                <td style={td}>{fmt(r.bps)}</td>
                <td style={td}>{fmt(r.medium)}</td>
                <td style={td}>{date(r.allotment_date)}</td>
                <td style={td}>{date(r.occupation_date)}</td>
                <td style={td}>{date(r.dor || (r.dob ? addYears(r.dob, 60) : ""))}</td>
                <td style={td}>
                  <span style={pill(r.qtr_status === "active" ? "rgba(18,185,129,0.12)" : "rgba(107,114,128,0.15)")}>
                    {fmt(r.qtr_status)}
                  </span>
                </td>

                {/* Always render Actions cell; gate buttons inside */}
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
            {rows.length ? `Showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}` : ""}
          </span>
          <button onClick={() => canPrev && setPage((p) => p - 1)} disabled={!canPrev} style={btn}>← Prev</button>
          <button onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext} style={btn}>
            Next →
          </button>
        </div>
      </div>

      {/* Add */}
      <Modal open={adding} onClose={closeModals} title="Add Allotment">
        <form onSubmit={submitAdd} style={{ display: "grid", gap: 10 }}>
          <Row3>
            <HousePicker
              value={form.house_id}
              onChange={(v) => setForm((f) => ({ ...f, house_id: v }))}
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
            <Field type="date" label="DOB" value={form.dob} onChange={onChange("dob")} />
            <Field type="date" label="DOR (auto 60y)" value={form.dor} onChange={() => {}} readOnly />
            <Field type="date" label="Vacation Date" value={form.vacation_date} onChange={onChange("vacation_date")} />
          </Row3>
          <TextArea label="Notes" value={form.notes} onChange={onChange("notes")} />
          <Actions onCancel={closeModals} submitText="Create" />
        </form>
      </Modal>

      {/* Edit */}
      <AdminOnly>
        <Modal open={!!editing} onClose={closeModals} title="Edit Allotment">
          <form onSubmit={submitEdit} style={{ display: "grid", gap: 10 }}>
            <Row3>
              <HousePicker
                value={form.house_id}
                onChange={(v) => setForm((f) => ({ ...f, house_id: v }))}
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
              <Field type="date" label="DOB" value={form.dob} onChange={onChange("dob")} />
              <Field type="date" label="DOR (auto 60y)" value={form.dor} onChange={() => {}} readOnly />
              <Field type="date" label="Vacation Date" value={form.vacation_date} onChange={onChange("vacation_date")} />
            </Row3>
            <TextArea label="Notes" value={form.notes} onChange={onChange("notes")} />
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

const table = { width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" };
const th = { textAlign: "left", padding: "10px 12px", background: "#fafafa", borderBottom: "none", position: "sticky", top: 0, zIndex: 1, color: "#111" };
const td = { padding: "10px 12px", verticalAlign: "top", color: "#111" };
