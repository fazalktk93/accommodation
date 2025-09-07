// frontend/src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  listHouses,
  listAllotments,
  createAllotment,
  updateAllotment,
  deleteAllotment,
} from '../api'

// ---- Helpers ----------------------------------------------------
function pad(n) { return String(n).padStart(2, '0') }
function toDateInput(d) {
  if (!d) return ''
  const x = new Date(d)
  if (isNaN(x.getTime())) return ''
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
function computeDOR(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 60)
  return toDateInput(d)
}
function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

/** Normalize house fields coming from API with different key names */
function getHouseFields(h = {}) {
  // Qtr number may be qtr_no, quarter_no, house_no, number, qtr
  const qtr =
    h.qtr_no ?? h.quarter_no ?? h.house_no ?? h.number ?? h.qtr ?? '-'

  // Street may be street, street_no, st_no, road
  const street =
    h.street ?? h.street_no ?? h.st_no ?? h.road ?? '-'

  // Sector may be sector, sector_code, sector_name, block
  const sector =
    h.sector ?? h.sector_code ?? h.sector_name ?? h.block ?? '-'

  return { qtr, street, sector }
}

export default function AllotmentsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [hasNext, setHasNext] = useState(false)

  const [houses, setHouses] = useState([])
  const safeHouses = useMemo(() => (Array.isArray(houses) ? houses : []), [houses])

  const emptyForm = {
    house_id: '',
    person_name: '',
    designation: '',
    directorate: '',
    cnic: '',
    pool: '',
    medium: '',
    bps: '',
    allotment_date: '',
    occupation_date: '',
    dob: '',
    dor: '',
    qtr_status: 'active',
    allottee_status: 'in_service',
    notes: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // Initial fetch
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [hs, al] = await Promise.all([listHouses(), listAllotments({ limit, offset: 0 })])
        if (!alive) return
        setHouses(hs || [])
        setRows(al || [])
        setHasNext((al || []).length === limit)
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [limit])

  async function search(nextPage = 1) {
    try {
      setLoading(true)
      setError('')
      const params = {
        q: q?.trim() || undefined,
        limit,
        offset: (nextPage - 1) * limit,
      }
      const res = await listAllotments(params)
      setRows(res || [])
      setPage(nextPage)
      setHasNext((res || []).length === limit)
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  function onChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    try {
      setSaving(true)
      setError('')

      const payload = {
        house_id: numOrNull(form.house_id),
        person_name: form.person_name || null,
        designation: form.designation || null,
        directorate: form.directorate || null,
        cnic: form.cnic || null,
        pool: form.pool || null,
        medium: form.medium || null,
        bps: numOrNull(form.bps),
        allotment_date: form.allotment_date || null,
        occupation_date: form.occupation_date || null,
        dob: form.dob || null,
        dor: form.dor || null,
        qtr_status: form.qtr_status || 'active',
        allottee_status: form.allottee_status || 'in_service',
        notes: form.notes || null,
      }

      if (editingId) {
        await updateAllotment(editingId, payload)
      } else {
        payload.force_end_previous = true
        await createAllotment(payload)
      }

      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      await search(page)
    } catch (e) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(row) {
    setEditingId(row.id)
    setForm({
      house_id: row.house_id ?? '',
      person_name: row.person_name ?? '',
      designation: row.designation ?? '',
      directorate: row.directorate ?? '',
      cnic: row.cnic ?? '',
      pool: row.pool ?? '',
      medium: row.medium ?? '',
      bps: row.bps ?? '',
      allotment_date: toDateInput(row.allotment_date) || '',
      occupation_date: toDateInput(row.occupation_date) || '',
      dob: toDateInput(row.dob) || '',
      dor: toDateInput(row.dor) || computeDOR(row.dob) || '',
      qtr_status: row.qtr_status || 'active',
      allottee_status: row.allottee_status || 'in_service',
      notes: row.notes || '',
    })
    setShowForm(true)
  }

  async function onDelete(row) {
    const name = row?.person_name ? ` "${row.person_name}"` : ''
    if (!confirm(`Delete allotment${name}? This cannot be undone.`)) return
    try {
      setLoading(true)
      setError('')
      await deleteAllotment(row.id)
      await search(page)
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Delete failed'
      setError(`Cannot delete: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  // --- UI ---------------------------------------------------------
  return (
    <div className="page">
      <h2>Allotments</h2>

      {error ? <div className="error" role="alert">{error}</div> : null}

      <div className="filters">
        <input
          placeholder="Search name / file no / qtr no…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(1) }}
          style={{ maxWidth: 360 }}
        />
        <button className="btn" onClick={() => search(1)} disabled={loading}>Search</button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={openAdd}>Add Allotment</button>
      </div>

      {/* Form */}
      {showForm ? (
        <form className="card" onSubmit={onSubmit}>
          <div className="grid2">
            <label>House
              <select value={form.house_id} onChange={e => onChange('house_id', e.target.value)}>
                <option value="">Select house</option>
                {safeHouses.map(h => {
                  const f = getHouseFields(h)
                  return (
                    <option key={h.id} value={h.id}>
                      {`${f.qtr} / ${f.street} / ${f.sector}`}
                    </option>
                  )
                })}
              </select>
            </label>

            <label>Allottee
              <input value={form.person_name} onChange={e => onChange('person_name', e.target.value)} />
            </label>

            <label>Designation
              <input value={form.designation} onChange={e => onChange('designation', e.target.value)} />
            </label>

            <label>Directorate
              <input value={form.directorate} onChange={e => onChange('directorate', e.target.value)} />
            </label>

            <label>CNIC
              <input value={form.cnic} onChange={e => onChange('cnic', e.target.value)} />
            </label>

            <label>Pool
              <select value={form.pool} onChange={e => onChange('pool', e.target.value)}>
                <option value="">Select pool</option>
                <option value="CDA">CDA</option>
                <option value="Estate Office">Estate Office</option>
              </select>
            </label>

            <label>Medium
              <input value={form.medium} onChange={e => onChange('medium', e.target.value)} />
            </label>

            <label>BPS
              <input value={form.bps} onChange={e => onChange('bps', e.target.value)} />
            </label>

            <label>Allotment Date
              <input type="date" value={form.allotment_date} onChange={e => onChange('allotment_date', e.target.value)} />
            </label>

            <label>Occupation Date
              <input type="date" value={form.occupation_date} onChange={e => onChange('occupation_date', e.target.value)} />
            </label>

            <label>DOB
              <input type="date" value={form.dob} onChange={e => onChange('dob', e.target.value)} />
            </label>

            <label>DOR
              <input type="date" value={form.dor} onChange={e => onChange('dor', e.target.value)} />
            </label>

            <label>Quarter Status
              <select value={form.qtr_status} onChange={e => onChange('qtr_status', e.target.value)}>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </label>

            <label>Allottee Status
              <select value={form.allottee_status} onChange={e => onChange('allottee_status', e.target.value)}>
                <option value="in_service">In Service</option>
                <option value="retired">Retired</option>
                <option value="deceased">Deceased</option>
              </select>
            </label>

            <label style={{ gridColumn: '1 / -1' }}>Notes
              <textarea value={form.notes} onChange={e => onChange('notes', e.target.value)} rows={3} />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" className="link-btn" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm) }}>
              Cancel
            </button>{' '}
            <button type="submit" disabled={saving}>
              {editingId ? (saving ? 'Saving…' : 'Save changes') : (saving ? 'Saving…' : 'Save')}
            </button>
          </div>
        </form>
      ) : null}

      {/* Table */}
      <div className="card" style={{ marginTop: 12, overflow: 'auto' }}>
        <table className="table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Allottee</th>
              {/* order changed: Qtr, Street, Sector */}
              <th style={{ textAlign: 'left' }}>Qtr</th>
              <th style={{ textAlign: 'left' }}>Street</th>
              <th style={{ textAlign: 'left' }}>Sector</th>
              <th>BPS</th>
              <th>Medium</th>
              <th>Allotment Date</th>
              <th>Occupation Date</th>
              <th>DOR</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map(r => {
              const h = r?.house || {}          // tolerate {house:{...}} or flat
              const { qtr, street, sector } = getHouseFields(h)
              return (
                <tr key={r.id}>
                  <td className="col-allottee" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                    <div><strong>{r.person_name || '-'}</strong></div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{r.designation || ''}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{r.cnic || ''}</div>
                  </td>

                  <td>{qtr}</td>
                  <td>{street}</td>
                  <td>{sector}</td>

                  <td style={{ textAlign: 'center' }}>{(r.bps === 0 || r.bps) ? r.bps : ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.medium || ''}
                    {r.medium === 'Transit' && <span className="chip chip-accent" style={{ marginLeft: 6 }}>Transit</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{toDateInput(r.allotment_date)}</td>
                  <td style={{ textAlign: 'center' }}>{toDateInput(r.occupation_date)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {toDateInput(r.dor || (r.dob ? computeDOR(r.dob) : ''))}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span title={'Quarter: ' + (r.qtr_status || '-') + ' | Allottee: ' + (r.allottee_status || '-')}>
                      {r.qtr_status || '-'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn" onClick={() => openEdit(r)} style={{ marginRight: 8 }}>Edit</button>
                    <button className="btn danger" onClick={() => onDelete(r)}>Delete</button>
                  </td>
                </tr>
              )
            })}
            {!loading && (!rows || rows.length === 0) ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 16, opacity: 0.8 }}>No records</td></tr>
            ) : null}
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 16 }}>Loading…</td></tr>
            ) : null}
          </tbody>
        </table>

        <div className="pager">
          <button className="btn" disabled={loading || page <= 1} onClick={() => search(page - 1)} aria-label="Previous page">« Prev</button>
          <span className="pager-info">{page}</span>
          <button className="btn" disabled={loading || !hasNext} onClick={() => search(page + 1)} aria-label="Next page">Next »</button>
        </div>
      </div>

      <style>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
        .page { padding: 12px; }

        .table { border-collapse: collapse; width: auto; table-layout: auto; }
        .table th, .table td { border-bottom: 1px solid #eee; padding: 8px; }
        .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
        .chip { display:inline-block; font-size:12px; padding:2px 6px; border-radius:999px; border:1px solid #cfe9dc; }
        .chip-accent { background:#e7f5ef; }
        .pager { display:flex; gap: 8px; align-items: center; justify-content: flex-end; padding: 8px; }
        .pager .btn { height: 32px; padding: 0 12px; }
        .pager-info { min-width: 80px; text-align: center; font-weight: 600; }
        .btn.danger { background: var(--danger); }
        .btn.danger:hover { filter: brightness(0.95); }
      `}</style>
    </div>
  )
}
