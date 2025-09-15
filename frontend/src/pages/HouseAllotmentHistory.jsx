// frontend/src/pages/HouseAllotmentHistory.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import auth from "../auth"; // ===== use the same auth wrapper (sends cookies & Authorization)

const SHOW_STATUS_COLS = false;

// ---- helpers ----
const asList = (d) =>
  Array.isArray(d)
    ? d
    : Array.isArray(d?.items)
    ? d.items
    : Array.isArray(d?.results)
    ? d.results
    : Array.isArray(d?.data)
    ? d.data
    : [];

const fmt = (d) => (d ? String(d) : "-");

// Ensure we always hit the backend via Vite proxy at /api/* (and avoid /api/api)
function toApiPath(p) {
  if (!p) return "/api/";
  if (/^https?:\/\//i.test(p)) return p; // absolute URL, leave as-is
  let rel = p.startsWith("/") ? p : `/${p}`;
  if (rel.startsWith("/api/")) return rel; // already correct
  return `/api${rel}`; // prepend /api
}

// ALWAYS go through auth.fetch to include cookies/token.
async function getJson(path, opts = {}) {
  const { params, ...rest } = opts || {};
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";

  const urlObj = new URL(toApiPath(path), origin);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v == null || v === "") return;
      if (Array.isArray(v)) v.forEach((vv) => urlObj.searchParams.append(k, vv));
      else urlObj.searchParams.set(k, v);
    });
  }

  const res = await auth.fetch(urlObj.toString(), {
    ...rest,
    headers: { Accept: "application/json", ...(rest.headers || {}) },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status} ${res.statusText}`);

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}


function Badge({ children }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 12,
        background: "#eee",
        fontSize: 12,
        border: "1px solid #ddd",
        verticalAlign: "middle",
      }}
    >
      {children}
    </span>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 8,
          width: "min(720px,96vw)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

const emptyAllotment = {
  person_name: "",
  designation: "",
  directorate: "",
  cnic: "",
  pool: "",
  medium: "",
  bps: "",
  allotment_date: "",
  occupation_date: "",
  vacation_date: "",
  dob: "",
  dor: "",
  retention_until: "",
  retention_last: "",
  qtr_status: "active",
  allottee_status: "in_service",
  notes: "",
};

export default function HouseAllotmentHistory() {
  // supports /history/file/:fileNo and /history/house/:houseId and /history/:id
  const { fileNo, houseId, id } = useParams();
  const resolvedHouseId = houseId ?? id;

  const [house, setHouse] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addData, setAddData] = useState(emptyAllotment);
  const [forceEndPrev, setForceEndPrev] = useState(true);

  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState(emptyAllotment);
  const [forceEndOnEdit, setForceEndOnEdit] = useState(false);

  const api = useMemo(
    () => ({
      getHouse: (hid) => getJson(`/houses/${hid}`),
      // backend supports searching by file_no via list endpoint
      getHouseByFile: async (fno) => {
        const res = await getJson(`/houses/`, { params: { file_no: fno, limit: 1 } });
        const items = asList(res);
        return items[0] || null;
      },
      listAllotmentsByHouseId: (hid) =>
        getJson(`/allotments/`, { params: { house_id: hid, skip: 0, limit: 10000 } }).then(asList),
      patchHouseStatus: (hid, status) =>
        getJson(`/houses/${hid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, status_manual: true }),
        }),
      createAllotment: (payload, forceEnd) => {
        const qs = forceEnd ? "?force_end_previous=true" : "";
        return getJson(`/allotments/${qs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            forceEnd ? { ...payload, force_end_previous: true } : payload
          ),
        });
      },
      updateAllotment: (aid, payload, forceEnd) => {
        const qs = forceEnd ? "?force_end_previous=true" : "";
        return getJson(`/allotments/${aid}${qs}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            forceEnd ? { ...payload, force_end_previous: true } : payload
          ),
        });
      },
      endAllotment: (aid) => getJson(`/allotments/${aid}/end`, { method: "POST" }),
    }),
    []
  );

  async function load() {
    try {
      setLoading(true);
      setErr("");

      if (fileNo) {
        const h = await api.getHouseByFile(fileNo);
        setHouse(h);
        // nested endpoint returns full history (no CORS, cookies included)
        const list = await api.listAllotmentsByHouseId(h.id);
        setRows(list);
        return;
      }

      // fallback: by house id
      const h = await api.getHouse(resolvedHouseId);
      setHouse(h);
     const list = await api.listAllotmentsByHouseId(h.id);
     setRows(list);
    } catch (e) {
      setErr(e.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileNo, resolvedHouseId]);

  async function submitAdd() {
    try {
      await api.createAllotment({ ...addData, house_id: house.id }, true);
      setShowAdd(false);
      setAddData(emptyAllotment);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function submitEdit() {
    try {
      await api.updateAllotment(editRow.id, { ...editData }, forceEndOnEdit);
      setEditRow(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function endAllotmentQuick(aid) {
    if (!window.confirm("Mark this allotment as ended?")) return;
    try {
      await api.endAllotment(aid);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function updateHouseStatus(newStatus) {
    try {
      const updated = await api.patchHouseStatus(house.id, newStatus);
      setHouse(updated);
    } catch (e) {
      alert(e.message);
    }
  }

  const COLS = SHOW_STATUS_COLS ? 12 : 11;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>House — Allotment History</h1>

      {err && (
        <div
          style={{
            background: "#fde2e1",
            border: "1px solid #f5b5b2",
            padding: 10,
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      {house && (
        <section
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 6,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div>
              <div>
                <strong>File No:</strong> {fmt(house.file_no)}
              </div>
              <div>
                <strong>Quarter:</strong> {fmt(house.qtr_no)}
              </div>
              <div>
                <strong>Street:</strong> {fmt(house.street)} &nbsp; <strong>Sector:</strong>{" "}
                {fmt(house.sector)}
              </div>
              <div>
                <strong>Type:</strong> {fmt(house.type_code)} &nbsp; <strong>Status:</strong>{" "}
                <Badge>{fmt(house.status)}</Badge>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Previous Allotments</h2>
          <button
            onClick={() => {
              setAddData(emptyAllotment);
              setForceEndPrev(true);
              setShowAdd(true);
            }}
          >
            Add Allotment
          </button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eee" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Allottee</th>
                <th style={{ textAlign: "left", padding: 8 }}>Designation</th>
                <th style={{ textAlign: "left", padding: 8 }}>Directorate</th>
                <th style={{ textAlign: "left", padding: 8 }}>CNIC</th>
                <th style={{ textAlign: "left", padding: 8 }}>Allotment</th>
                <th style={{ textAlign: "left", padding: 8 }}>Occupation</th>
                <th style={{ textAlign: "left", padding: 8 }}>Vacation</th>
                <th style={{ textAlign: "left", padding: 8 }}>Period (days)</th>
                <th style={{ textAlign: "left", padding: 8 }}>Pool</th>
                <th style={{ textAlign: "left", padding: 8 }}>Medium</th>
                {SHOW_STATUS_COLS && <th style={{ textAlign: "left", padding: 8 }}>Status</th>}
                <th style={{ textAlign: "left", padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLS} style={{ padding: 12, color: "#777" }}>
                    No allotment history yet for this house.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                  <td style={{ padding: 8 }}>{fmt(r.person_name)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.designation)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.directorate)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.cnic)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.allotment_date)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.occupation_date)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.vacation_date)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.period_of_stay)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.pool)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.medium)}</td>
                  {SHOW_STATUS_COLS && (
                    <td style={{ padding: 8 }}>
                      <Badge>{fmt(r.allottee_status)}</Badge>
                    </td>
                  )}
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => {
                        setEditRow(r);
                        setEditData({
                          person_name: r.person_name || "",
                          designation: r.designation || "",
                          directorate: r.directorate || "",
                          cnic: r.cnic || "",
                          pool: r.pool || "",
                          medium: r.medium || "",
                          bps: r.bps ?? "",
                          allotment_date: r.allotment_date || "",
                          occupation_date: r.occupation_date || "",
                          vacation_date: r.vacation_date || "",
                          dob: r.dob || "",
                          dor: r.dor || "",
                          retention_until: r.retention_until || "",
                          retention_last: r.retention_last || "",
                          qtr_status: r.qtr_status || "active",
                          allottee_status: r.allottee_status || "in_service",
                          notes: r.notes || "",
                        });
                        setForceEndOnEdit(false);
                      }}
                      style={{ marginRight: 8 }}
                    >
                      Edit
                    </button>
                    <button onClick={() => endAllotmentQuick(r.id)}>End</button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={COLS} style={{ padding: 12 }}>
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd && (
        <Modal title="Add Allotment" onClose={() => setShowAdd(false)}>
          <FormAllotment
            data={addData}
            onChange={setAddData}
            forceEnd={forceEndPrev}
            onToggleForce={setForceEndPrev}
            submitLabel="Create"
            onSubmit={submitAdd}
          />
        </Modal>
      )}

      {editRow && (
        <Modal title={`Edit Allotment #${editRow.id}`} onClose={() => setEditRow(null)}>
          <FormAllotment
            data={editData}
            onChange={setEditData}
            forceEnd={forceEndOnEdit}
            onToggleForce={setForceEndOnEdit}
            submitLabel="Save"
            onSubmit={submitEdit}
          />
        </Modal>
      )}
    </div>
  );
}

function FormAllotment({ data, onChange, onSubmit, submitLabel, forceEnd, onToggleForce }) {
  const bind = (name) => ({
    name,
    value: data[name] ?? "",
    onChange: (e) => onChange((prev) => ({ ...prev, [name]: e.target.value })),
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input placeholder="Allottee name" {...bind("person_name")} />
        <input placeholder="Designation" {...bind("designation")} />
        <input placeholder="Directorate" {...bind("directorate")} />
        <input placeholder="CNIC" {...bind("cnic")} />
        <input placeholder="Pool" {...bind("pool")} />
        <input placeholder="Medium" {...bind("medium")} />
        <input placeholder="BPS" {...bind("bps")} />
        <input placeholder="Allotment Date (YYYY-MM-DD or DD/MM/YYYY)" {...bind("allotment_date")} />
        <input placeholder="Occupation Date" {...bind("occupation_date")} />
        <input placeholder="Vacation Date" {...bind("vacation_date")} />
        <input placeholder="DOB" {...bind("dob")} />
        <input placeholder="DOR" {...bind("dor")} />
        <input placeholder="Retention Until" {...bind("retention_until")} />
        <input placeholder="Retention Last" {...bind("retention_last")} />
        <select {...bind("allottee_status")}>
          <option value="in_service">in service</option>
          <option value="retired">retired</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select {...bind("qtr_status")}>
          <option value="active">active</option>
          <option value="ended">ended</option>
        </select>
      </div>

      <textarea placeholder="Notes" {...bind("notes")} rows={3} style={{ width: "100%", marginTop: 8 }} />

      <label style={{ display: "block", marginTop: 8 }}>
        <input type="checkbox" checked={!!forceEnd} onChange={(e) => onToggleForce(e.target.checked)} />{" "}
        End any existing active allotment automatically
      </label>

      <div style={{ marginTop: 12 }}>
        <button onClick={onSubmit}>{submitLabel}</button>
      </div>
    </div>
  );
}
