// frontend/src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  listHouses,
  listAllotments,
  createAllotment,
  updateAllotment,
  deleteAllotment,
} from '../api'

// ---------- small helpers ----------
const pad = (n) => String(n).padStart(2, '0')
const toDateInput = (d) => {
  if (!d) return ''
  const x = new Date(d)
  if (isNaN(x.getTime())) return ''
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
const computeDOR = (dob) => {
  if (!dob) return ''
  const d = new Date(dob)
  if (isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 60)
  return toDateInput(d)
}
const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return isFinite(n) ? n : null
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

  // Build lookup maps so we can resolve qtr/street/sector quickly
  const { byId, byFile } = useMemo(() => {
    const idMap = new Map()
    const fileMap = new Map()
    ;(Array.isArray(houses) ? houses : []).forEach((h) => {
      if (h?.id != null) idMap.set(String(h.id), h)
      if (h?.file_no) fileMap.set(String(h.file_no).toLowerCase(), h)
    })
    return { byId: idMap, byFile: fileMap }
  }, [houses])

  // Initial fetch
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        // Load a big chunk of houses so we can resolve most rows locally
        const [hs, al] = await Promise.all([
          listHouses({ limit: 10000, offset: 0 }),
          listAllotments({ limit, offset: 0 }), // first page of allotments
        ])
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
      const res = await listAllotments({
        q: q?.trim() || undefined,
        limit,
        offset: (nextPage - 1) * limit,
      })
      setRows(res || [])
      setPage(nextPage)
      setHasNext((res || []).length === limit)
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // form state
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

  function onChange(field, value) {
    if (field === 'dob') {
      setForm((f) => ({ ...f, dob: value, dor: value ? computeDOR(value) : '' }))
    } else {
      setForm((f) => ({ ...f, [field]: value }))
    }
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

  // Resolve house fields for a row (uses maps; falls back to computed fields from the API)
  function resolveHouseFields(row) {
    const byIdHit = byId.get(String(row.house_id))
    if (byIdHit) {
      return {
        qtr: byIdHit.qtr_no ?? byIdHit.number ?? '-',
        street: byIdHit.street ?? '-',
        sector: byIdHit.sector ?? '-',
      }
    }
    const byFileHit = row.house_file_no ? byFile.get(String(row.house_file_no).toLowerCase()) : null
    if (byFileHit) {
      return {
        qtr: byFileHit.qtr_no ?? byFileHit.number ?? '-',
        street: byFileHit.street ?? '-',
        sector: byFileHit.sector ?? '-',
      }
    }
    // Last fallback: at least show qtr if backend provided it
    return {
      qtr: row.house_qtr_no ?? '-',
      street: '-',
      sector: '-',
    }
  }

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
        <button className="btn" onClick={openAdd}>{showForm ? 'Close' : 'Add Allotment'}</button>
      </div>

      {/* form */}
      {showForm ? (
        <form className="card" onSubmit={onSubmit}>
          <div className="grid2">
            <label>House
              <select value={form.house_id} onChange={(e) => onChange('house_id', e.target.value)}>
                <option value="">Select house</option>
                {(Array.isArray(houses) ? houses : []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {/* Qtr / Street / Sector for readability */}
                    {(h.qtr_no ?? h.number ?? '-') + ' / ' + (h.street ?? '-') + ' / ' + (h.sector ?? '-')}
                  </option>
                ))}
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
              <input value={form.pool} onChange={e => onChange('pool', e.target.value)} />
            </label>

            <label>Medium
              <input value={form.medium} onChange={e => onChange('medium', e.target.value)} />
            </label>

            <label>BPS
              <input value={form.bps} onChange={e => onChange('bps', e.target.value)} inputMode="numeric" />
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
              <textarea rows={3} value={form.notes} onChange={e => onChange('notes', e.target.value)} />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" className="link-btn" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm) }}>
              Cancel
            </button>{' '}
            <button type="submit" disabled={saving}>{editingId ? (saving ? 'Saving…' : 'Save changes') : (saving ? 'Saving…' : 'Save')}</button>
          </div>
        </form>
      ) : null}

      {/* table */}
      <div className="card" style={{ marginTop: 12, overflow: 'auto' }}>
        <table className="table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Allottee</th>
              {/* Order: Qtr → Street → Sector */}
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
            {(Array.isArray(rows) ? rows : []).map((r) => {
              const { qtr, street, sector } = resolveHouseFields(r)
              return (
                <tr key={r.id}>
                  <td className="col-allottee" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                    <div><strong>{r.person_name || '-'}</strong></div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.designation || ''}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.cnic || ''}</div>
                  </td>

                  <td>{qtr ?? '-'}</td>
                  <td>{street ?? '-'}</td>
                  <td>{sector ?? '-'}</td>

                  <td style={{ textAlign: 'center' }}>{(r.bps === 0 || r.bps) ? r.bps : ''}</td>
                  <td style={{ textAlign: 'center' }}>{r.medium || ''}</td>
                  <td style={{ textAlign: 'center' }}>{toDateInput(r.allotment_date)}</td>
                  <td style={{ textAlign: 'center' }}>{toDateInput(r.occupation_date)}</td>
                  <td style={{ textAlign: 'center' }}>{toDateInput(r.dor || (r.dob ? computeDOR(r.dob) : ''))}</td>
                  <td style={{ textAlign: 'center' }}>{r.qtr_status || '-'}</td>
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
        .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
        .pager { display:flex; gap: 8px; align-items: center; justify-content: flex-end; padding: 8px; }
        .pager-info { min-width: 80px; text-align: center; font-weight: 600; }
        .btn.danger { background: var(--danger); }
        .btn.danger:hover { filter: brightness(0.95); }
      `}</style>
    </div>
  )
}
