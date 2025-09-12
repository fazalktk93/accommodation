// src/pages/HousesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminOnly from "../components/AdminOnly";
import Modal from "../components/Modal";
import {
  listHouses,
  createHouse,
  updateHouse,
  deleteHouse,
} from "../api";

const DEFAULT_LIMIT = 500;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const emptyHouse = {
  name: "",
  address: "",
  sector: "",
  type_code: "",
  status: "",
  qtr: "",
  file_no: "",
};

export default function HousesPage() {
  const navigate = useNavigate();
  const query = useQuery();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // pagination
  const [offset, setOffset] = useState(Number(query.get("offset") || 0));
  const [limit, setLimit] = useState(Number(query.get("limit") || DEFAULT_LIMIT));

  // search
  const [qtr, setQtr] = useState(query.get("qtr") || query.get("quarter") || "");
  const [fileNo, setFileNo] = useState(query.get("file_no") || query.get("fileNo") || "");
  const [cnic, setCnic] = useState(query.get("cnic") || "");
  const [allottee, setAllottee] = useState(query.get("allottee") || query.get("allottee_name") || "");

  // modals
  const [editing, setEditing] = useState(null); // object | null
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyHouse);

  // load
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        offset,
        limit,
        qtr: qtr || undefined,
        quarter: qtr || undefined,
        file_no: fileNo || undefined,
        fileNo: fileNo || undefined,
        cnic: cnic || undefined,
        allottee_name: allottee || undefined,
        allottee: allottee || undefined,
      };
      const data = await listHouses(params);
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
  }, [offset, limit]);

  const pushParamsToUrl = () => {
    const sp = new URLSearchParams();
    sp.set("offset", String(offset));
    sp.set("limit", String(limit));
    if (qtr) sp.set("qtr", qtr);
    if (fileNo) sp.set("file_no", fileNo);
    if (cnic) sp.set("cnic", cnic);
    if (allottee) sp.set("allottee", allottee);
    navigate({ search: `?${sp.toString()}` }, { replace: true });
  };

  const onSearch = async (e) => {
    e?.preventDefault();
    pushParamsToUrl();
    await fetchData();
  };

  const onClear = async () => {
    setQtr("");
    setFileNo("");
    setCnic("");
    setAllottee("");
    setOffset(0);
    navigate({ search: `?offset=0&limit=${limit}` }, { replace: true });
    await fetchData();
  };

  const openAllotmentsForHouse = (houseId) => {
    navigate(`/allotments?house_id=${encodeURIComponent(houseId)}&limit=1000`);
  };

  // ----- CRUD (admin) -----
  const openAddModal = () => {
    setForm(emptyHouse);
    setAdding(true);
  };

  const openEditModal = (house) => {
    setEditing(house);
    setForm({
      name: house.name ?? "",
      address: house.address ?? "",
      sector: house.sector ?? "",
      type_code: house.type_code ?? "",
      status: house.status ?? "",
      qtr: house.qtr ?? house.quarter ?? "",
      file_no: house.file_no ?? "",
    });
  };

  const closeModals = () => {
    setAdding(false);
    setEditing(null);
    setForm(emptyHouse);
  };

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submitAdd = async (e) => {
    e.preventDefault();
    try {
      await createHouse(form);
      closeModals();
      await fetchData();
    } catch (err) {
      alert(`Create failed: ${err}`);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      await updateHouse(editing.id, form);
      closeModals();
      await fetchData();
    } catch (err) {
      alert(`Update failed: ${err}`);
    }
  };

  const onDelete = async (house) => {
    if (!window.confirm(`Delete house "${house.name || house.id}"?`)) return;
    try {
      await deleteHouse(house.id);
      await fetchData();
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, flex: 1 }}>Houses</h2>
        <AdminOnly>
          <button onClick={openAddModal}>+ Add House</button>
        </AdminOnly>
      </div>

      {/* Search */}
      <form onSubmit={onSearch} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", margin: "12px 0" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>Qtr</label>
          <input value={qtr} onChange={(e) => setQtr(e.target.value)} placeholder="e.g. A-12" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>File No</label>
          <input value={fileNo} onChange={(e) => setFileNo(e.target.value)} placeholder="e.g. FN-1234" />
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
        <label>Offset:</label>
        <input type="number" min={0} value={offset} onChange={(e) => setOffset(Number(e.target.value || 0))} />
        <button onClick={fetchData} disabled={loading}>Refresh</button>
      </div>

      {error && <div style={{ color: "crimson", marginBottom: 8 }}>{error}</div>}

      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="6" cellSpacing="0" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>File No</th>
              <th>Qtr</th>
              <th>Name</th>
              <th>Address</th>
              <th>Sector</th>
              <th>Type</th>
              <th>Status</th>
              <AdminOnly><th>Actions</th></AdminOnly>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id}>
                <td>{h.id}</td>
                <td>
                  <button
                    onClick={() => openAllotmentsForHouse(h.id)}
                    style={{ background: "none", border: "none", color: "#0b65c2", cursor: "pointer", textDecoration: "underline" }}
                    title="View allotment history"
                  >
                    {h.file_no ?? "-"}
                  </button>
                </td>
                <td>{h.qtr ?? h.quarter ?? "-"}</td>
                <td>{h.name ?? "-"}</td>
                <td>{h.address ?? "-"}</td>
                <td>{h.sector ?? "-"}</td>
                <td>{h.type_code ?? "-"}</td>
                <td>{h.status ?? "-"}</td>
                <AdminOnly>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => openEditModal(h)}>Edit</button>{" "}
                    <button onClick={() => onDelete(h)} style={{ color: "crimson" }}>Delete</button>
                  </td>
                </AdminOnly>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center" }}>No houses</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      <Modal open={adding} onClose={closeModals} title="Add House">
        <form onSubmit={submitAdd} style={{ display: "grid", gap: 10 }}>
          <Field label="Name" value={form.name} onChange={handleChange("name")} />
          <Field label="Address" value={form.address} onChange={handleChange("address")} />
          <Field label="Sector" value={form.sector} onChange={handleChange("sector")} />
          <Field label="Type Code" value={form.type_code} onChange={handleChange("type_code")} />
          <Field label="Status" value={form.status} onChange={handleChange("status")} />
          <Field label="Qtr" value={form.qtr} onChange={handleChange("qtr")} />
          <Field label="File No" value={form.file_no} onChange={handleChange("file_no")} />
          <Actions onCancel={closeModals} submitText="Create" />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={closeModals} title={editing ? `Edit House #${editing.id}` : "Edit"}>
        <form onSubmit={submitEdit} style={{ display: "grid", gap: 10 }}>
          <Field label="Name" value={form.name} onChange={handleChange("name")} />
          <Field label="Address" value={form.address} onChange={handleChange("address")} />
          <Field label="Sector" value={form.sector} onChange={handleChange("sector")} />
          <Field label="Type Code" value={form.type_code} onChange={handleChange("type_code")} />
          <Field label="Status" value={form.status} onChange={handleChange("status")} />
          <Field label="Qtr" value={form.qtr} onChange={handleChange("qtr")} />
          <Field label="File No" value={form.file_no} onChange={handleChange("file_no")} />
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
