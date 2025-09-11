// frontend/src/pages/HousesPage.jsx
import React, { useEffect, useState } from "react";
import { listHouses, createHouse, updateHouse, deleteHouse } from "../api";
import { hasPerm } from "../authz";
import Modal from "../components/Modal";

export default function HousesPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    file_no: "",
    sector: "",
    type_code: "",
    status: "Vacant",
  });

  const canWrite = hasPerm("houses:create") || hasPerm("houses:update");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const data = await listHouses({ limit: 5000 });
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.message || "Failed to load houses");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ file_no: "", sector: "", type_code: "", status: "Vacant" });
    setModalOpen(true);
  }
  function openEdit(h) {
    setEditing(h);
    setForm({
      file_no: h.file_no || "",
      sector: h.sector || "",
      type_code: h.type_code || "",
      status: h.status || "Vacant",
    });
    setModalOpen(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      if (editing?.id) {
        await updateHouse(editing.id, form);
      } else {
        await createHouse(form);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert(e?.message || "Save failed");
    }
  }

  async function onDelete(h) {
    if (!confirm("Delete this house?")) return;
    try {
      await deleteHouse(h.id);
      await load();
    } catch (e) {
      alert(e?.message || "Delete failed");
    }
  }

  return (
    <div>
      <h1>Houses</h1>

      {err && <div className="card" style={{ borderLeft: "4px solid #e53935", color: "#b71c1c" }}>{err}</div>}

      <div style={{ marginBottom: 8 }}>
        {canWrite && <button className="btn primary" onClick={openNew}>+ New House</button>}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>File #</th>
              <th>Sector</th>
              <th>Type</th>
              <th>Status</th>
              {canWrite && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.id}>
                <td>{h.file_no}</td>
                <td>{h.sector}</td>
                <td>{h.type_code}</td>
                <td>{h.status}</td>
                {canWrite && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn" onClick={() => openEdit(h)}>Edit</button>
                      {hasPerm("houses:delete") && (
                        <button className="btn danger" onClick={() => onDelete(h)}>Delete</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!list.length && (
              <tr><td colSpan={canWrite ? 5 : 4} style={{ textAlign: "center", color: "#607d8b" }}>No records</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit House" : "New House"}>
        <form onSubmit={onSubmit} className="grid gap-2">
          <label>File #
            <input value={form.file_no} onChange={(e) => setForm({ ...form, file_no: e.target.value })} required />
          </label>
          <label>Sector
            <input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
          </label>
          <label>Type
            <input value={form.type_code} onChange={(e) => setForm({ ...form, type_code: e.target.value })} />
          </label>
          <label>Status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Vacant</option>
              <option>Occupied</option>
              <option>Under Maintenance</option>
            </select>
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
