// src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AdminOnly from "../components/AdminOnly";
import Modal from "../components/Modal";
import {
  listAllotments,
  createAllotment,
  updateAllotment,
  deleteAllotment,
} from "../api";

const DEFAULT_LIMIT = 1000;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const emptyAllotment = {
  house_id: "",
  allottee_name: "",
  cnic: "",
  from_date: "",
  to_date: "",
  status: "",
  remarks: "",
  file_no: "",   // optional: for searching/display convenience
  qtr: "",       // optional
};

export default function AllotmentsPage() {
  const query = useQuery();
  const houseId = query.get("house_id") || query.get("houseId") || query.get("hid");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // pager
  const [skip, setSkip] = useState(Number(query.get("skip") || 0));
  const [limit, setLimit] = useState(Number(query.get("limit") || DEFAULT_LIMIT));

  // search fields
  const [qtr, setQtr] = useState(query.get("qtr") || query.get("quarter") || "");
  const [fileNo, setFileNo] = useState(query.get("file_no") || query.get("fileNo") || "");
  const [cnic, setCnic] = useState(query.get("cnic") || "");
  const [allottee, setAllottee] = useState(query.get("allottee") || query.get("allottee_name") || "");

  // modals
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAllotment);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        skip,
        limit,
        house_id: houseId || undefined,
        qtr: qtr || undefined,
        quarter: qtr || undefined,
        file_no: fileNo || undefined,
        fileNo: fileNo || undefined,
        cnic: cnic || undefined,
        allottee_name: allottee || undefined,
        allottee: allottee || undefined,
      };
      const data = await listAllotments(params);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, limit, houseId]);

  // search
  const onSearch = async (e) => {
    e?.preventDefault();
    await fetchData();
  };

  const onClear = async () => {
    setQtr("");
    setFileNo("");
    setCnic("");
    setAllottee("");
    setSkip(0);
    await fetchData();
  };

  // ----- CRUD (admin) -----
  const openAddModal = () => {
    setForm({
      ...emptyAllotment,
      house_id: houseId || "",
    });
    setAdding(true);
  };

  const openEditModal = (row) => {
    setEditing(row);
    setForm({
      house_id: row.house_id ?? houseId ?? "",
      allottee_name: row.allottee_name ?? "",
      cnic: row.cnic ?? "",
      from_date: (row.from_date || "").substring(0, 10),
      to_date: (row.to_date || "").substring(0, 10),
      status: row.status ?? "",
      remarks: row.remarks ?? "",
      file_no: row.file_no ?? "",
      qtr: row.qtr ?? row.quarter ?? "",
    });
  };

  const closeModals = () => {
    setAdding(false);
    setEditing(null);
    setForm(emptyAllotment);
  };

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submitAdd = async (e) => {
    e.preventDefault();
    try {
      // only send fields your backend model accepts:
      const payload = {
        house_id: form.house_id ? Number(form.house_id) : undefined,
        allottee_name: form.allottee_name || undefined,
        cnic: form.cnic || undefined,
        from_date: form.from_date || undefined,
        to_date: form.to_date || undefined,
        status: form.status || undefined,
        remarks: form.remarks || undefined,
      };
      await createAllotment(payload);
      closeModals();
      await fetchData();
    } catch (err) {
      alert(`Create failed: ${err}`);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        allottee_name: form.allottee_name || undefined,
        cnic: form.cnic || undefined,
        from_date: form.from_date || undefined,
        to_date: form.to_date || undefined,
        status: form.status || undefined,
        remarks: form.remarks || undefined,
      };
      await updateAllotment(editing.id, payload);
      closeModals();
      await fetchData();
    } catch (err) {
      alert(`Update failed: ${err}`);
    }
  };

  const onDelete = async (row) => {
    if (!window.confirm(`Delete allotment #${row.id}?`)) return;
    try {
      await deleteAllotment(row.id);
      await fetchData();
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, flex: 1 }}>
          Allotments {houseId ? <small style={{ fontWeight: "normal" }}>(House #{houseId})</small> : null}
        </h2>
        <AdminOnly>
          <button onClick={openAddModal}>+ Add Allotment</button>
        </AdminOnly>
      </div>

      {/* Search */}
      <form onSubmit={onSearch} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", margin: "12px 0" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>Qtr</label>
          <input value={qtr} onChange={(e) => setQtr(e.target.value)} placeholder="A-12" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>File No</label>
          <input value={fileNo} onChange={(e) => setFileNo(e.target.value)} placeholder="FN-1234" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>CNIC</label>
          <input value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="35202-XXXXXXX-X" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>Allottee Name</label>
          <input value={allottee} onChange={(e) => setAllottee(e.target.value)} placeholder="Ali Khan" />
        </div>
        <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
          <button type="submit">Search</button>
          <button type="button" onClick={onClear}>Clear</button>
        </div>
      </form>

      {/* Pager */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <label>Limit:</label>
        <input type="number" min={1} value={limit} onChange={(e) => setLimit(Number(e.target.value || DEFAULT_LIMIT))} />
        <label>Skip:</label>
        <input type="number" min={0} value={skip} onChange={(e) => setSkip(Number(e.target.value || 0))} />
        <button onClick={fetchData} disabled={loading}>Refresh</button>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 8 }}>{error}</div>}

      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="6" cellSpacing="0" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>House</th>
              <th>Allottee</th>
              <th>CNIC</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
              <th>Remarks</th>
              <AdminOnly><th>Actions</th></AdminOnly>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.house_id ?? "-"}</td>
                <td>{r.allottee_name ?? "-"}</td>
                <td>{r.cnic ?? "-"}</td>
                <td>{(r.from_date || "").substring(0, 10) || "-"}</td>
                <td>{(r.to_date || "").substring(0, 10) || "-"}</td>
                <td>{r.status ?? "-"}</td>
                <td>{r.remarks ?? "-"}</td>
                <AdminOnly>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => openEditModal(r)}>Edit</button>{" "}
                    <button onClick={() => onDelete(r)} style={{ color: "crimson" }}>Delete</button>
                  </td>
                </AdminOnly>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center" }}>No allotments</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      <Modal open={adding} onClose={closeModals} title="Add Allotment">
        <form onSubmit={submitAdd} style={{ display: "grid", gap: 10 }}>
          <Field label="House ID" value={form.house_id} onChange={handleChange("house_id")} type="number" required />
          <Field label="Allottee Name" value={form.allottee_name} onChange={handleChange("allottee_name")} required />
          <Field label="CNIC" value={form.cnic} onChange={handleChange("cnic")} />
          <Field label="From Date" value={form.from_date} onChange={handleChange("from_date")} type="date" />
          <Field label="To Date" value={form.to_date} onChange={handleChange("to_date")} type="date" />
          <Field label="Status" value={form.status} onChange={handleChange("status")} />
          <Field label="Remarks" value={form.remarks} onChange={handleChange("remarks")} />
          <Actions onCancel={closeModals} submitText="Create" />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={closeModals} title={editing ? `Edit Allotment #${editing.id}` : "Edit Allotment"}>
        <form onSubmit={submitEdit} style={{ display: "grid", gap: 10 }}>
          <Field label="Allottee Name" value={form.allottee_name} onChange={handleChange("allottee_name")} required />
          <Field label="CNIC" value={form.cnic} onChange={handleChange("cnic")} />
          <Field label="From Date" value={form.from_date} onChange={handleChange("from_date")} type="date" />
          <Field label="To Date" value={form.to_date} onChange={handleChange("to_date")} type="date" />
          <Field label="Status" value={form.status} onChange={handleChange("status")} />
          <Field label="Remarks" value={form.remarks} onChange={handleChange("remarks")} />
          <Actions onCancel={closeModals} submitText="Save" />
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      <input type={type} value={value || ""} onChange={onChange} required={required} />
    </label>
  );
}

function Actions({ onCancel, submitText }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit">{submitText}</button>
    </div>
  );
}
