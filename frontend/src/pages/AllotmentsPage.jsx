// frontend/src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listAllotments, createAllotment, updateAllotment, deleteAllotment } from "../api";
import { hasPerm } from "../authz";
import Modal from "../components/Modal";

const POOL_OPTIONS = ["CDA", "Estate Office"]; // required constraint

function isRetention(dor) {
  if (!dor) return false;
  const d = new Date(dor);
  const today = new Date();
  d.setHours(0,0,0,0); today.setHours(0,0,0,0);
  // Past or today -> retention
  return d <= today;
}

export default function AllotmentsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    file_no: "",
    house_id: "",
    person_name: "",
    designation: "",
    cnic: "",
    pool: "CDA",
    medium: "",
    dor: "",
    status: "Active",
  });

  const canWrite = hasPerm("allotments:create") || hasPerm("allotments:update");

  const derivedList = useMemo(() => {
    // Show retention automatically even if DB not updated
    return (list || []).map((a) => ({
      ...a,
      status: isRetention(a?.dor) ? "Retention" : a?.status || "Active",
    }));
  }, [list]);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const data = await listAllotments({ limit: 5000 });
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Failed to load allotments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({
      file_no: "",
      house_id: "",
      person_name: "",
      designation: "",
      cnic: "",
      pool: "CDA",
      medium: "",
      dor: "",
      status: "Active",
    });
    setModalOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      file_no: a.file_no || "",
      house_id: a.house_id || "",
      person_name: a.person_name || "",
      designation: a.designation || "",
      cnic: a.cnic || "",
      pool: POOL_OPTIONS.includes(a.pool) ? a.pool : "CDA",
      medium: a.medium || "",
      dor: (a.dor || "").slice(0, 10),
      status: isRetention(a.dor) ? "Retention" : (a.status || "Active"),
    });
    setModalOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      pool: POOL_OPTIONS.includes(form.pool) ? form.pool : "CDA",
      status: isRetention(form.dor) ? "Retention" : (form.status || "Active"),
    };

    try {
      if (editing?.id) {
        await updateAllotment(editing.id, payload);
      } else {
        await createAllotment(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e?.message || "Save failed");
    }
  }

  async function onDelete(a) {
    if (!confirm("Delete this allotment?")) return;
    try {
      await deleteAllotment(a.id);
      await load();
    } catch (e) {
      alert(e?.message || "Delete failed");
    }
  }

  return (
    <div>
      <h1>Allotments</h1>

      {err && <div className="card" style={{ borderLeft: "4px solid #e53935", color: "#b71c1c" }}>{err}</div>}

      <div style={{ marginBottom: 8 }}>
        {canWrite && (
          <button className="btn primary" onClick={openNew}>+ New Allotment</button>
        )}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>File #</th>
              <th>House</th>
              <th>Person</th>
              <th>Designation</th>
              <th>CNIC</th>
              <th>Pool</th>
              <th>Medium</th>
              <th>DOR</th>
              <th>Status</th>
              {canWrite && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {derivedList.map((a) => (
              <tr key={a.id}>
                <td>{a.file_no}</td>
                <td>{a.house_id}</td>
                <td>{a.person_name}</td>
                <td>{a.designation}</td>
                <td>{a.cnic}</td>
                <td>{POOL_OPTIONS.includes(a.pool) ? a.pool : "CDA"}</td>
                <td>{a.medium || "-"}</td>
                <td>{a.dor ? String(a.dor).slice(0,10) : "-"}</td>
                <td><Badge value={isRetention(a.dor) ? "Retention" : (a.status || "Active")} /></td>
                {canWrite && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn" onClick={() => openEdit(a)}>Edit</button>
                      {hasPerm("allotments:delete") && (
                        <button className="btn danger" onClick={() => onDelete(a)}>Delete</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!derivedList.length && (
              <tr><td colSpan={canWrite ? 10 : 9} style={{ textAlign: "center", color: "#607d8b" }}>No records</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Allotment" : "New Allotment"}>
        <form onSubmit={onSubmit} className="grid gap-2">
          <label>File #
            <input value={form.file_no} onChange={(e) => setForm({ ...form, file_no: e.target.value })} required />
          </label>

          <label>House ID
            <input value={form.house_id} onChange={(e) => setForm({ ...form, house_id: e.target.value })} required />
          </label>

          <label>Person Name
            <input value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} required />
          </label>

          <label>Designation
            <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </label>

          <label>CNIC
            <input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
          </label>

          <label>Pool (CDA / Estate Office)
            <select
              value={form.pool}
              onChange={(e) => setForm({ ...form, pool: e.target.value })}
              required
            >
              {POOL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label>Medium
            <input value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })} />
          </label>

          <label>DOR
            <input type="date" value={form.dor} onChange={(e) => setForm({ ...form, dor: e.target.value })} />
            <small style={{ color: "#607d8b" }}>
              {isRetention(form.dor) ? "This will be saved as Retention." : "Will be Active unless DOR is past."}
            </small>
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn primary" type="submit">{editing ? "Save" : "Create"}</button>
            <button className="btn" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Badge({ value }) {
  const v = String(value || "").toLowerCase();
  const color =
    v === "retention" ? "#8e24aa" :
    v === "active" ? "#1565c0" :
    v === "cancelled" ? "#b71c1c" :
    "#455a64";
  return (
    <span style={{ color: "#fff", background: color, padding: "2px 8px", borderRadius: 12, fontSize: 12 }}>
      {value}
    </span>
  );
}
