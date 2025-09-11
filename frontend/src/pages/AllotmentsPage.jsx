// frontend/src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  listHouses,
  listAllotments,
  createAllotment,
  updateAllotment,
  deleteAllotment,
} from '../api'
import { hasPerm } from '../authz'
import Modal from '../components/Modal'

// ---------- small helpers ----------
const pad = (n) => String(n).padStart(2, '0')
const toDateInput = (d) => {
  if (!d) return ''
  const x = new Date(d)
  if (isNaN(x.getTime())) return ''
  const y = x.getFullYear()
  const m = pad(x.getMonth()+1)
  const dd = pad(x.getDate())
  return `${y}-${m}-${dd}`
}
const fromDateInput = (s) => {
  if (!s) return null
  const t = Date.parse(s)
  return isFinite(t) ? new Date(t).toISOString().slice(0,10) : null
}

const ALLOWED_POOLS = ['CDA', 'Estate Office']

export default function AllotmentsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [hasNext, setHasNext] = useState(false)

  const [houses, setHouses] = useState([])
  const houseById = useMemo(() => {
    const m = new Map()
    houses.forEach(h => m.set(h.id, h))
    return m
  }, [houses])

  // modal state
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // row object or null
  const [form, setForm] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [housesRes, allotRes] = await Promise.all([
          listHouses({ limit: 5000 }),
          listAllotments({ limit, offset: (page-1)*limit, q: q?.trim() || undefined })
        ])
        if (!alive) return
        setHouses(housesRes)
        const list = Array.isArray(allotRes) ? allotRes : (allotRes?.results ?? [])
        setRows(list)
        setHasNext((allotRes?.has_next ?? list.length === limit))
        setError('')
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [page, limit, q])

  async function refresh() {
    // simple helper to reload current page
    try {
      setLoading(true)
      const res = await listAllotments({ limit, offset: (page-1)*limit, q: q?.trim() || undefined })
      const list = Array.isArray(res) ? res : (res?.results ?? [])
      setRows(list)
      setHasNext((res?.has_next ?? list.length === limit))
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({
      house_id: '',
      person_name: '',
      designation: '',
      directorate: '',
      cnic: '',
      pool: 'CDA',
      medium: '',
      bps: '',
      allotment_date: '',
      occupation_date: '',
      vacation_date: '',
      dob: '',
      dor: '',
      retention_until: '',
      retention_last: '',
      qtr_status: 'active',
      allottee_status: 'in_service',
      notes: '',
    })
    setShowForm(true)
  }

  function openEdit(row) {
    const f = {
      house_id: row.house_id ?? '',
      person_name: row.person_name ?? '',
      designation: row.designation ?? '',
      directorate: row.directorate ?? '',
      cnic: row.cnic ?? '',
      pool: row.pool && ALLOWED_POOLS.includes(row.pool) ? row.pool : 'CDA',
      medium: row.medium ?? '',
      bps: (row.bps ?? '') + '',
      allotment_date: toDateInput(row.allotment_date),
      occupation_date: toDateInput(row.occupation_date),
      vacation_date: toDateInput(row.vacation_date),
      dob: toDateInput(row.dob),
      dor: toDateInput(row.dor),
      retention_until: toDateInput(row.retention_until),
      retention_last: toDateInput(row.retention_last),
      qtr_status: row.qtr_status ?? 'active',
      allottee_status: row.allottee_status ?? 'in_service',
      notes: row.notes ?? '',
    }
    setEditing(row)
    setForm(f)
    setShowForm(true)
  }

  async function saveForm(e) {
    e?.preventDefault?.()
    const payload = {
      ...form,
      house_id: Number(form.house_id),
      bps: form.bps === '' ? null : Number(form.bps),
      allotment_date: fromDateInput(form.allotment_date),
      occupation_date: fromDateInput(form.occupation_date),
      vacation_date: fromDateInput(form.vacation_date),
      dob: fromDateInput(form.dob),
      dor: fromDateInput(form.dor),
      retention_until: fromDateInput(form.retention_until),
      retention_last: fromDateInput(form.retention_last),
      pool: form.pool, // already limited by UI
    }
    if (editing) {
      await updateAllotment(editing.id, payload)
    } else {
      await createAllotment(payload)
    }
    setShowForm(false)
    await refresh()
  }

  async function onDelete(row) {
    if (!window.confirm('Delete this allotment?')) return
    await deleteAllotment(row.id)
    await refresh()
  }

  function houseLabel(id) {
    const h = houseById.get(id)
    if (!h) return `#${id}`
    return `${h.file_no ?? '-'} — ${h.qtr_no ?? '-'} (${h.sector ?? '-'})`
  }

  return (
    <div className="container">
      <h1>Allotments</h1>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="filters">
          <input
            placeholder="Search name, CNIC, file or qtr no…"
            value={q}
            onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: 260 }}
          />
          {hasPerm('allotments:create') && (
            <button className="btn primary" onClick={openNew}>Add allotment</button>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>House</th>
                <th>Allottee</th>
                <th>Pool</th>
                <th>Medium</th>
                <th>BPS</th>
                <th>Allotment</th>
                <th>Occupation</th>
                <th>Vacation</th>
                <th>DOB</th>
                <th>DOR</th>
                <th>Status</th>
                {hasPerm('allotments:update') || hasPerm('allotments:delete') ? <th style={{ width: 120 }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{houseLabel(row.house_id)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.person_name || '-'}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{row.designation || '-'}</div>
                  </td>
                  <td>{row.pool || '-'}</td>
                  <td>{row.medium || '-'}</td>
                  <td>{row.bps ?? '-'}</td>
                  <td>{row.allotment_date || '-'}</td>
                  <td>{row.occupation_date || '-'}</td>
                  <td>{row.vacation_date || '-'}</td>
                  <td>{row.dob || '-'}</td>
                  <td>{row.dor || '-'}</td>
                  <td>
                    <span className="badge">{(row.qtr_status || 'active').replace('_', ' ')}</span>
                    {' '}
                    <span className="badge muted">{(row.allottee_status || 'in_service').replace('_',' ')}</span>
                  </td>
                  {(hasPerm('allotments:update') || hasPerm('allotments:delete')) && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {hasPerm('allotments:update') && (
                          <button className="btn" onClick={()=>openEdit(row)}>Edit</button>
                        )}
                        {hasPerm('allotments:delete') && (
                          <button className="btn danger" onClick={()=>onDelete(row)}>Delete</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="btn" disabled={loading || page<=1} onClick={()=>setPage(p => Math.max(1, p-1))} aria-label="Previous page">« Prev</button>
          <div className="pager-info">{page}</div>
          <button className="btn" disabled={loading || !hasNext} onClick={()=>setPage(p => p+1)} aria-label="Next page">Next »</button>
        </div>
      </div>

      {/* Modal form */}
      <Modal
        open={showForm}
        title={editing ? 'Edit allotment' : 'New allotment'}
        onClose={()=>setShowForm(false)}
        actions={
          <>
            <button className="btn" type="button" onClick={()=>setShowForm(false)}>Cancel</button>
            {hasPerm(editing ? 'allotments:update' : 'allotments:create') && (
              <button className="btn primary" type="button" onClick={saveForm}>
                {editing ? 'Save changes' : 'Create'}
              </button>
            )}
          </>
        }
      >
        {!!form && (
          <form className="grid2" onSubmit={(e)=>e.preventDefault()}>
            <label>
              <div>House</div>
              <select value={form.house_id} onChange={e => setForm(f => ({...f, house_id: e.target.value}))} required>
                <option value="" disabled>Select house…</option>
                {houses.map(h =>
                  <option key={h.id} value={h.id}>
                    {h.file_no ?? '-'} — {String(h.qtr_no ?? '-')} ({h.sector ?? '-'})
                  </option>
                )}
              </select>
            </label>
            <label>
              <div>Allottee Name</div>
              <input value={form.person_name} onChange={e => setForm(f => ({...f, person_name: e.target.value}))} required />
            </label>
            <label>
              <div>Designation</div>
              <input value={form.designation} onChange={e => setForm(f => ({...f, designation: e.target.value}))} />
            </label>
            <label>
              <div>Directorate</div>
              <input value={form.directorate} onChange={e => setForm(f => ({...f, directorate: e.target.value}))} />
            </label>
            <label>
              <div>CNIC</div>
              <input value={form.cnic} onChange={e => setForm(f => ({...f, cnic: e.target.value}))} />
            </label>
            <label>
              <div>Pool</div>
              <select value={form.pool} onChange={e => setForm(f => ({...f, pool: e.target.value}))}>
                {ALLOWED_POOLS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>
              <div>Medium</div>
              <input value={form.medium} onChange={e => setForm(f => ({...f, medium: e.target.value}))} />
            </label>
            <label>
              <div>BPS</div>
              <input type="number" value={form.bps} onChange={e => setForm(f => ({...f, bps: e.target.value}))} />
            </label>
            <label>
              <div>Allotment date</div>
              <input type="date" value={form.allotment_date} onChange={e => setForm(f => ({...f, allotment_date: e.target.value}))} />
            </label>
            <label>
              <div>Occupation date</div>
              <input type="date" value={form.occupation_date} onChange={e => setForm(f => ({...f, occupation_date: e.target.value}))} />
            </label>
            <label>
              <div>Vacation date</div>
              <input type="date" value={form.vacation_date} onChange={e => setForm(f => ({...f, vacation_date: e.target.value}))} />
            </label>
            <label>
              <div>DOB</div>
              <input type="date" value={form.dob} onChange={e => setForm(f => ({...f, dob: e.target.value}))} />
            </label>
            <label>
              <div>DOR</div>
              <input type="date" value={form.dor} onChange={e => setForm(f => ({...f, dor: e.target.value}))} />
            </label>
            <label>
              <div>Retention until</div>
              <input type="date" value={form.retention_until} onChange={e => setForm(f => ({...f, retention_until: e.target.value}))} />
            </label>
            <label>
              <div>Retention last</div>
              <input type="date" value={form.retention_last} onChange={e => setForm(f => ({...f, retention_last: e.target.value}))} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <div>Notes</div>
              <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            </label>
            <label>
              <div>Quarter Status</div>
              <select value={form.qtr_status} onChange={e => setForm(f => ({...f, qtr_status: e.target.value}))}>
                <option value="active">active</option>
                <option value="ended">ended</option>
              </select>
            </label>
            <label>
              <div>Allottee Status</div>
              <select value={form.allottee_status} onChange={e => setForm(f => ({...f, allottee_status: e.target.value}))}>
                <option value="in_service">in service</option>
                <option value="retention">retention</option>
                <option value="retired">retired</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
          </form>
        )}
      </Modal>

      <style>{`
        .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
        .table-wrap { overflow:auto; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
        .badge { padding: 2px 8px; border-radius: 12px; background: var(--surface-2); }
        .badge.muted { background: #eceff1; color: #37474f; }
        .pager { display:flex; gap: 8px; align-items: center; justify-content: flex-end; padding: 8px; }
        .pager-info { min-width: 80px; text-align: center; font-weight: 600; }
      `}</style>
    </div>
  )
}
