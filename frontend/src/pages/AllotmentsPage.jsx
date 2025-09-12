// src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AdminOnly from "../components/AdminOnly";
import Modal from "../components/Modal";
import { api, createAllotment, updateAllotment, deleteAllotment } from "../api";

const PAGE_SIZE = 50;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const empty = {
  house_id: "",
  allottee_name: "",
  cnic: "",
  from_date: "",
  to_date: "",
  status: "",
  remarks: "",
};

export default function AllotmentsPage() {
  const query = useQuery();
  const houseId = query.get("house_id") || query.get("houseId") || query.get("hid");

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
    if (houseId) sp.set("house_id", houseId);
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
        house_id: houseId || undefined,
        // single search fan-out
        q: q || undefined,
        qtr: q || undefined,
        quarter: q || undefined,
        file_no: q || undefined,
        fileNo: q || undefined,
        cnic: q || undefined,
        allottee_name: q || undefined,
        allottee: q || undefined,
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
  }, [page, q, houseId]);

  // CRUD
  const openAdd = () => {
    setForm({ ...empty, house_id: houseId || "" });
    setAdding(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      house_id: row.house_id ?? "",
      allottee_name: row.allottee_name ?? "",
      cnic: row.cnic ?? "",
      from_date: (row.from_date || "").substring(0, 10),
      to_date: (row.to_date || "").substring(0, 10),
      status: row.status ?? "",
      remarks: row.remarks ?? "",
    });
  };
  const closeModals = () => {
    setAdding(false);
    setEditing(null);
    setForm(empty);
  };
  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submitAdd = async (e) => {
    e.preventDefault();
    try {
      await createAllotment({
        house_id: form.house_id ? Number(form.house_id) : undefined,
        allottee_name: form.allottee_name || undefined,
        cnic: form.cnic || undefined,
        from_date: form.from_date || undefined,
        to_date: form.to_date || undefined,
        status: form.status || undefined,
        remarks: form.remarks || undefined,
      });
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
      await updateAllotment(editing.id, {
        allottee_name: form.allottee_name || undefined,
        cnic: form.cnic || undefined,
        from_date: form.from_date || undefined,
        to_date: form.to_date || undefined,
        status: form.status || undefined,
        remarks: form.remarks || undefined,
      });
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

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, flex: 1 }}>
          Allotments {houseId ? <small style={{ fontWeight: "normal" }}>(House #{houseId})</small> : null}
        </h2>
        <AdminOnly>
          <button onClick={openAdd} style={btnPrimary}>+ Add Allotment</button>
        </AdminOnly>
      </div>

      {/* single search bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(0); load(); }}
        style={{ display: "flex", gap: 8, marginBottom: 12 }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search file no / CNIC / allottee / qtr"
          style={input}
        />
        <button type="submit" style={btn}>Search</button>
        <button type="button" onClick={() => { setQ(""); setPage(0); }} style={btnGhost}>Clear</button>
      </form>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10 }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>House</th>
              <th style={th}>Allottee</th>
              <th style={th}>CNIC</th>
              <th style={th}>From</th>
              <th style={th}>To</th>
              <th style={th}>Status</th>
              <th style={th}>Remarks</th>
              <AdminOnly><th style={th}>Actions</th></AdminOnly>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 16, textAlign: "center", color: "#666" }}>No records</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} style={tr}>
                <td style={td}>{r.id}</td>
                <td style={td}>{r.house_id ?? "-"}</td>
                <td style={td}>{r.allottee_name ?? "-"}</td>
                <td style={td}>{r.cnic ?? "-"}</td>
                <td style={td}>{(r.from_date || "").substring(0, 10) || "-"}</td>
                <td style={td}>{(r.to_date || "").substring(0, 10) || "-"}</td>
                <td style={td}>{r.status ?? "-"}</td>
                <td style={td}>{r.remarks ?? "-"}</td>
                <AdminOnly>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(r)} style={btnSm}>Edit</button>{" "}
                    <button onClick={() => onDelete(r)} style={btnDangerSm}>Delete</button>
                  </td>
                </AdminOnly>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={9} style={{ padding: 16 }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pager */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ color: "#222" }}>
          Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
          {Number.isFinite(total) ? <> &nbsp;•&nbsp; Total <strong>{total}</strong></> : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => canPrev && setPage((p) => p - 1)} disabled={!canPrev} style={btn}>← Prev</button>
          <button onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext} style={btn}>Next →</button>
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={adding} onClose={closeModals} title="Add Allotment">
        <form onSubmit={submitAdd} style={{ display: "grid", gap: 10 }}>
          <Field label="House ID" value={form.house_id} onChange={onChange("house_id")} required />
          <Field label="Allottee Name" value={form.allottee_name} onChange={onChange("allottee_name")} required />
          <Field label="CNIC" value={form.cnic} onChange={onChange("cnic")} />
          <Row2>
            <Field type="date" label="From Date" value={form.from_date} onChange={onChange("from_date")} />
            <Field type="date" label="To Date" value={form.to_date} onChange={onChange("to_date")} />
          </Row2>
          <Field label="Status" value={form.status} onChange={onChange("status")} />
          <Field label="Remarks" value={form.remarks} onChange={onChange("remarks")} />
          <Actions onCancel={closeModals} submitText="Create" />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={closeModals} title={editing ? `Edit Allotment #${editing.id}` : "Edit Allotment"}>
        <form onSubmit={submitEdit} style={{ display: "grid", gap: 10 }}>
          <Field label="Allottee Name" value={form.allottee_name} onChange={onChange("allottee_name")} required />
          <Field label="CNIC" value={form.cnic} onChange={onChange("cnic")} />
          <Row2>
            <Field type="date" label="From Date" value={form.from_date} onChange={onChange("from_date")} />
            <Field type="date" label="To Date" value={form.to_date} onChange={onChange("to_date")} />
          </Row2>
          <Field label="Status" value={form.status} onChange={onChange("status")} />
          <Field label="Remarks" value={form.remarks} onChange={onChange("remarks")} />
          <Actions onCancel={closeModals} submitText="Save" />
        </form>
      </Modal>
    </div>
  );
}

/* --- tiny UI primitives --- */
const input = { flex: 1, padding: "10px 12px", border: "1px solid #d9d9d9", borderRadius: 8, background: "#fff", color: "#111" };
const btn = { padding: "10px 14px", borderRadius: 8, border: "1px solid #d9d9d9", background: "#fff", cursor: "pointer", color: "#111" };
const btnGhost = { ...btn, background: "#f3f4f6" };
const btnPrimary = { padding: "10px 14px", borderRadius: 8, border: "1px solid #0b65c2", background: "#0b65c2", color: "#fff", cursor: "pointer" };
const btnSm = { ...btn, padding: "6px 10px", fontSize: 13 };
const btnDangerSm = { ...btnSm, borderColor: "#d33", color: "#d33" };

const table = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const th = { textAlign: "left", padding: "10px 12px", background: "#fafafa", borderBottom: "1px solid #eee", position: "sticky", top: 0, zIndex: 1, color: "#111" };
const tr = { borderBottom: "1px solid #f1f1f1" };
const td = { padding: "10px 12px", verticalAlign: "top", color: "#111" };
const errorBox = { background: "#fdecea", color: "#a12622", border: "1px solid #f5c6c3", padding: 12, borderRadius: 8, marginBottom: 12 };

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <input type={type} value={value || ""} onChange={onChange} required={required} style={input} />
    </label>
  );
}
function Row2({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>; }
function Actions({ onCancel, submitText }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
      <button type="button" onClick={onCancel} style={btn}>Cancel</button>
      <button type="submit" style={btnPrimary}>{submitText}</button>
    </div>
  );
}
