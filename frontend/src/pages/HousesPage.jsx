// src/pages/HousesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminOnly from "../components/AdminOnly";
import Modal from "../components/Modal";
import { api, createHouse, updateHouse, deleteHouse } from "../api";

const PAGE_SIZE = 50; // fixed; backend caps handled in api layer

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
  status: "vacant",
  status_manual: false,
};

export default function HousesPage() {
  const navigate = useNavigate();
  const query = useQuery();

  // page & query are URL-driven so refresh/share keeps state
  const [page, setPage] = useState(Number(query.get("page") || 0)); // zero-based
  const [q, setQ] = useState(query.get("q") || "");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  // load data (use low-level api.request to read X-Total-Count)
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const offset = page * PAGE_SIZE;
      const params = {
        offset,
        limit: PAGE_SIZE,
        // fan-out single query so backend matches supported fields
        q: q || undefined,
        qtr: q || undefined,
        qtr_no: q || undefined,
        quarter: q || undefined,
        file_no: q || undefined,
        fileNo: q || undefined,
        cnic: q || undefined,
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

  // navigation to history
  const openHistoryFor = (row) => {
    const dest = row.file_no
      ? `/history/file/${encodeURIComponent(row.file_no)}`
      : `/history/house/${row.id}`;
    navigate(dest);
  };

  // ---------- CRUD (admin) ----------
  const openAdd = () => {
    setForm(emptyHouse);
    setAdding(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      file_no: row.file_no ?? "",
      qtr_no: row.qtr_no ?? "",
      street: row.street ?? "",
      sector: row.sector ?? "",
      type_code: row.type_code ?? "",
      status: row.status ?? "vacant",
      status_manual: !!row.status_manual,
    });
  };
  const closeModals = () => {
    setAdding(false);
    setEditing(null);
    setForm(emptyHouse);
  };
  const onChange = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  const submitAdd = async (e) => {
    e.preventDefault();
    try {
      await createHouse(form);
      closeModals();
      // reload first page so the new row is visible (or stay on same page if you prefer)
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
  const onDelete = async (row) => {
    if (!window.confirm(`Delete house ${row.file_no || `#${row.id}`}?`)) return;
    try {
      await deleteHouse(row.id);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  // pagination helpers
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, flex: 1 }}>Houses</h2>
        <AdminOnly>
          <button onClick={openAdd} style={btnPrimary}>+ Add House</button>
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
          placeholder="Search qtr/file no/CNIC/allottee name"
          style={input}
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

      {error && (
        <div style={errorBox}>{error}</div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10 }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>File No</th>
              <th style={th}>Qtr No</th>
              <th style={th}>Street</th>
              <th style={th}>Sector</th>
              <th style={th}>Type</th>
              <th style={th}>Status</th>
              <AdminOnly><th style={th}>Actions</th></AdminOnly>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#666" }}>No records</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} style={tr}>
                <td style={td}>{r.id}</td>
                <td style={td}>
                  <button
                    onClick={() => openHistoryFor(r)}
                    title="Open allotment history"
                    style={linkBtn}
                  >
                    {r.file_no ?? "-"}
                  </button>
                </td>
                <td style={td}>{r.qtr_no ?? "-"}</td>
                <td style={td}>{r.street ?? "-"}</td>
                <td style={td}>{r.sector ?? "-"}</td>
                <td style={td}>{r.type_code ?? "-"}</td>
                <td style={td}>{r.status ?? "-"}</td>
                <AdminOnly>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(r)} style={btnSm}>Edit</button>{" "}
                    <button onClick={() => onDelete(r)} style={btnDangerSm}>Delete</button>
                  </td>
                </AdminOnly>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={8} style={{ padding: 16 }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* bottom pager */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ color: "#555" }}>
          Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
          {Number.isFinite(total) ? <> &nbsp;•&nbsp; Total <strong>{total}</strong></> : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => canPrev && setPage((p) => p - 1)} disabled={!canPrev} style={btn}>
            ← Prev
          </button>
          <button onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext} style={btn}>
            Next →
          </button>
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={adding} onClose={closeModals} title="Add House">
        <form onSubmit={submitAdd} style={{ display: "grid", gap: 10 }}>
          <Field label="File No" value={form.file_no} onChange={onChange("file_no")} required />
          <Field label="Qtr No" value={form.qtr_no} onChange={onChange("qtr_no")} />
          <Field label="Street" value={form.street} onChange={onChange("street")} />
          <Field label="Sector" value={form.sector} onChange={onChange("sector")} />
          <Field label="Type Code" value={form.type_code} onChange={onChange("type_code")} />
          <Row>
            <Select
              label="Status"
              value={form.status}
              onChange={onChange("status")}
              options={[
                { value: "vacant", label: "vacant" },
                { value: "occupied", label: "occupied" },
                { value: "maintenance", label: "maintenance" },
              ]}
            />
            <Checkbox label="Manual status" checked={!!form.status_manual} onChange={onChange("status_manual")} />
          </Row>
          <Actions onCancel={closeModals} submitText="Create" />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={closeModals} title={editing ? `Edit House #${editing.id}` : "Edit"}>
        <form onSubmit={submitEdit} style={{ display: "grid", gap: 10 }}>
          <Field label="File No" value={form.file_no} onChange={onChange("file_no")} required />
          <Field label="Qtr No" value={form.qtr_no} onChange={onChange("qtr_no")} />
          <Field label="Street" value={form.street} onChange={onChange("street")} />
          <Field label="Sector" value={form.sector} onChange={onChange("sector")} />
          <Field label="Type Code" value={form.type_code} onChange={onChange("type_code")} />
          <Row>
            <Select
              label="Status"
              value={form.status}
              onChange={onChange("status")}
              options={[
                { value: "vacant", label: "vacant" },
                { value: "occupied", label: "occupied" },
                { value: "maintenance", label: "maintenance" },
              ]}
            />
            <Checkbox label="Manual status" checked={!!form.status_manual} onChange={onChange("status_manual")} />
          </Row>
          <Actions onCancel={closeModals} submitText="Save" />
        </form>
      </Modal>
    </div>
  );
}

/* ---------- tiny UI primitives (modern look, no external lib) ---------- */
const input = {
  flex: 1,
  padding: "10px 12px",
  border: "1px solid #d9d9d9",
  borderRadius: 8,
  outline: "none",
};

const btn = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #d9d9d9",
  background: "#fff",
  cursor: "pointer",
};

const btnGhost = { ...btn, background: "#f7f7f7" };

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

const linkBtn = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#0b65c2",
  textDecoration: "underline",
  cursor: "pointer",
};

const table = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const th = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#fafafa",
  borderBottom: "1px solid #eee",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const tr = {
  borderBottom: "1px solid #f1f1f1",
};

const td = {
  padding: "10px 12px",
  verticalAlign: "top",
};

const errorBox = {
  background: "#fdecea",
  color: "#a12622",
  border: "1px solid #f5c6c3",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
};

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <input type={type} value={value || ""} onChange={onChange} required={required} style={input} />
    </label>
  );
}

function Row({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <select value={value || ""} onChange={onChange} style={{ ...input, padding: "10px" }}>
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
