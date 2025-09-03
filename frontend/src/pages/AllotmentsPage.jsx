// frontend/src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  listHouses,
  searchAllotments,
  createAllotment,
  updateAllotment,
} from '../api'

// ---------- helpers
function normalizeList(resp) {
  if (!resp) return []
  if (Array.isArray(resp)) return resp
  if (resp && Array.isArray(resp.results)) return resp.results
  return []
}
function toDateInput(val) {
  if (!val) return ''
  const d = typeof val === 'string' ? new Date(val) : val
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
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

export default function AllotmentsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')

  // houses for selects / fallback rendering
  const [houses, setHouses] = useState([])
  const safeHouses = useMemo(() => (Array.isArray(houses) ? houses : []), [houses])

  // Add / Edit forms
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
    vacation_date: '',
    dob: '',
    dor: '',
    retention_last: '',
    qtr_status: 'active',
    allottee_status: 'in_service',
    notes: '',
  }
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const [editTarget, setEditTarget] = useState(null)
  const [updating, setUpdating] = useState(false)

  // Load houses once
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const hs = await listHouses()
        const arr = Array.isArray(hs) ? hs : (hs && hs.results ? hs.results : [])
        if (mounted) setHouses(arr)
      } catch (e) {
        console.warn('listHouses failed:', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Initial search
  useEffect(() => { search() }, []) // eslint-disable-line

  async function search() {
    try {
      setLoading(true); setError('')
      // API helper expects the query string (optional)
      const resp = await searchAllotments(q && q.trim() ? q.trim() : undefined)
      setRows(normalizeList(resp))
    } catch (e) {
      setError(e?.message || 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function onChange(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function onSave(e) {
    if (e?.preventDefault) e.preventDefault()
    try {
      setSaving(true); setError('')
      const payload = {
        house_id: form.house_id || null,
        person_name: form.person_name || null,
        designation: form.designation || null,
        directorate: form.directorate || null,
        cnic: form.cnic || null,
        pool: form.pool || null,
        medium: form.medium || null,
        bps: numOrNull(form.bps),
        allotment_date: form.allotment_date || null,
        occupation_date: form.occupation_date || null,
        vacation_date: form.vacation_date || null,
        dob: form.dob || null,
        dor: form.dob ? computeDOR(form.dob) : (form.dor || null),
        retention_last: form.retention_last || null,
        qtr_status: form.qtr_status || 'active',
        allottee_status: form.allottee_status || 'in_service',
        notes: form.notes || null,
      }
      await createAllotment(payload)
      setShowForm(false)
      setForm(emptyForm)
      await search()
    } catch (e) {
      setError(e?.message || 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  // open Edit with only the fields you actually edit
  function openEdit(row) {
    if (!row) return
    setEditTarget({
      id: row.id,
      house_id: row.house_id,
      person_name: row.person_name || '',
      bps: (row.bps === 0 || row.bps) ? String(row.bps) : '',
      medium: row.medium || '',
      allotment_date: toDateInput(row.allotment_date),
      occupation_date: toDateInput(row.occupation_date),
      vacation_date: toDateInput(row.vacation_date),
      qtr_status: row.qtr_status || 'active',
      allottee_status: row.allottee_status || 'in_service',
      notes: row.notes || '',
    })
  }

  async function onUpdate(e) {
    if (e?.preventDefault) e.preventDefault()
    if (!editTarget?.id) return
    try {
      setUpdating(true); setError('')
      const payload = {
        ...editTarget,
        bps: numOrNull(editTarget.bps),
        // if DOB is not part of edit, keep dor as-is
      }
      await updateAllotment(editTarget.id, payload)
      setEditTarget(null)
      await search()
    } catch (e) {
      setError(e?.message || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  // helpers to show house fields even if backend doesn't embed full house
  function houseFromRow(row) {
    if (row?.house) return row.house
    if (!row?.house_id) return null
    return safeHouses.find(h => String(h.id) === String(row.house_id)) || null
  }

  return (
    <div className="page">
      {/* toolbar */}
      <div className="toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search name, CNIC, file no, etc."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search() }}
          style={{ minWidth: 260 }}
        />
        <button onClick={search} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowForm(v => !v)}>{showForm ? 'Close' : 'Add Allotment'}</button>
      </div>

      {error ? (
        <div className="error" style={{ marginTop: 8, color: '#b00020' }}>{error}</div>
      ) : null}

      {/* ADD form */}
      {showForm ? (
        <form className="card" onSubmit={onSave} style={{ margin: '1rem 0', padding: 12 }}>
          <strong>New Allotment</strong>

          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
            <label>House
              <select value={form.house_id} onChange={e => onChange('house_id', e.target.value)} required>
                <option value="">-- Select house / Qtr --</option>
                {safeHouses.map(h => (
                  <option key={h.id} value={h.id}>
                    {(h.file_no ?? '-') + ' — Sector ' + (h.sector ?? '-') + ' • Street ' + (h.street ?? '-') + ' • Qtr ' + (h.qtr_no ?? h.number ?? h.id)}
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
              <select value={form.medium} onChange={e => onChange('medium', e.target.value)}>
                <option value="">Select medium</option>
                <option value="family transfer">Family Transfer</option>
                <option value="mutual">Mutual</option>
                <option value="changes">Changes</option>
                <option value="fresh">Fresh</option>
              </select>
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

            <label>Vacation Date
              <input type="date" value={form.vacation_date} onChange={e => onChange('vacation_date', e.target.value)} />
            </label>

            <label>DOB
              <input type="date" value={form.dob} onChange={e => onChange('dob', e.target.value)} />
            </label>

            <label>DOR (auto from DOB)
              <input readOnly value={form.dob ? computeDOR(form.dob) : ''} />
            </label>

            <label>Retention Last
              <input type="date" value={form.retention_last} onChange={e => onChange('retention_last', e.target.value)} />
            </label>

            <label>Quarter Status
              <select value={form.qtr_status} onChange={e => onChange('qtr_status', e.target.value)}>
                <option value="active">active (occupied)</option>
                <option value="ended">ended (vacant)</option>
              </select>
            </label>

            <label>Allottee Status
              <select value={form.allottee_status} onChange={e => onChange('allottee_status', e.target.value)}>
                <option value="in_service">in service</option>
                <option value="retired">retired</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>

            <label>Notes
              <input value={form.notes} onChange={e => onChange('notes', e.target.value)} />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>{' '}
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : null}

      {/* table */}
      <div className="card" style={{ marginTop: 12, overflow: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Allottee</th>
              <th style={{ textAlign: 'left' }}>File No</th>
              <th style={{ textAlign: 'left' }}>Sector</th>
              <th style={{ textAlign: 'left' }}>Street</th>
              <th style={{ textAlign: 'left' }}>Qtr</th>
              <th>BPS</th>
              <th>Medium</th>
              <th>Allotment</th>
              <th>Occupation</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map(r => {
              const h = houseFromRow(r) || {}
              return (
                <tr key={r.id}>
                  <td>
                    <div><strong>{r.person_name || '-'}</strong></div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.designation || ''}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.cnic || ''}</div>
                  </td>

                  {/* separate house fields */}
                  <td>{h.file_no ?? '-'}</td>
                  <td>{h.sector ?? '-'}</td>
                  <td>{h.street ?? '-'}</td>
                  <td>{h.qtr_no ?? h.number ?? '-'}</td>

                  <td style={{ textAlign: 'center' }}>{(r.bps === 0 || r.bps) ? r.bps : ''}</td>
                  <td style={{ textAlign: 'center' }}>{r.medium || ''}</td>
                  <td style={{ textAlign: 'center' }}>{toDateInput(r.allotment_date)}</td>
                  <td style={{ textAlign: 'center' }}>{toDateInput(r.occupation_date)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span title={'Quarter: ' + (r.qtr_status || '-') + ' | Allottee: ' + (r.allottee_status || '-')}>
                      {r.qtr_status || '-'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => openEdit(r)}>Edit</button>
                  </td>
                </tr>
              )
            })}
            {!loading && (!rows || rows.length === 0) ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 16, opacity: 0.7 }}>No records</td></tr>
            ) : null}
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 16 }}>Loading…</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <style>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
        .table th, .table td { border-bottom: 1px solid #eee; padding: 8px; }
        input, select { width: 100%; height: 34px; box-sizing: border-box; }
        input[readonly] { background: #f8f8f8; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
        button { height: 32px; padding: 0 12px; }
        .page { padding: 12px; }
      `}</style>

      {/* EDIT modal (clean, focused) */}
      {editTarget ? (
        <div className="modal-backdrop">
          <div className="modal card" style={{ maxWidth: 700, margin: '5vh auto', padding: 16, background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Edit Allotment</strong>
              <button onClick={() => setEditTarget(null)}>✕</button>
            </div>

            <form onSubmit={onUpdate}>
              <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
                
                <label>House
                  <select
                    value={editTarget.house_id || ''}
                    onChange={e => setEditTarget(p => ({ ...p, house_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Select house / Qtr --</option>
                    {safeHouses.map(h => (
                      <option key={h.id} value={h.id}>
                        {(h.file_no ?? '-') + ' — Sector ' + (h.sector ?? '-') + ' • Street ' + (h.street ?? '-') + ' • Qtr ' + (h.qtr_no ?? h.number ?? h.id)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>Allottee
                  <input
                    value={editTarget.person_name}
                    onChange={e => setEditTarget(p => ({ ...p, person_name: e.target.value }))}
                  />
                </label>

                <label>BPS
                  <input
                    value={editTarget.bps}
                    onChange={e => setEditTarget(p => ({ ...p, bps: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>

                <label>Medium
                  <select
                    value={editTarget.medium}
                    onChange={e => setEditTarget(p => ({ ...p, medium: e.target.value }))}
                  >
                    <option value="">Select medium</option>
                    <option value="family transfer">Family Transfer</option>
                    <option value="mutual">Mutual</option>
                    <option value="changes">Changes</option>
                    <option value="fresh">Fresh</option>
                  </select>
                </label>

                <label>Allotment Date
                  <input
                    type="date"
                    value={editTarget.allotment_date || ''}
                    onChange={e => setEditTarget(p => ({ ...p, allotment_date: e.target.value }))}
                  />
                </label>

                <label>Occupation Date
                  <input
                    type="date"
                    value={editTarget.occupation_date || ''}
                    onChange={e => setEditTarget(p => ({ ...p, occupation_date: e.target.value }))}
                  />
                </label>

                <label>Vacation Date
                  <input
                    type="date"
                    value={editTarget.vacation_date || ''}
                    onChange={e => setEditTarget(p => ({ ...p, vacation_date: e.target.value }))}
                  />
                </label>

                <label>Quarter Status
                  <select
                    value={editTarget.qtr_status}
                    onChange={e => setEditTarget(p => ({ ...p, qtr_status: e.target.value }))}
                  >
                    <option value="active">active (occupied)</option>
                    <option value="ended">ended (vacant)</option>
                  </select>
                </label>

                <label>Allottee Status
                  <select
                    value={editTarget.allottee_status}
                    onChange={e => setEditTarget(p => ({ ...p, allottee_status: e.target.value }))}
                  >
                    <option value="in_service">in service</option>
                    <option value="retired">retired</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>

                <label>Notes
                  <input
                    value={editTarget.notes}
                    onChange={e => setEditTarget(p => ({ ...p, notes: e.target.value }))}
                  />
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => setEditTarget(null)}>Cancel</button>{' '}
                <button type="submit" disabled={updating}>{updating ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </div>
          <style>{`
            .modal-backdrop {
              position: fixed; inset: 0; background: rgba(0,0,0,.25);
              display: flex; align-items: flex-start; justify-content: center; z-index: 50;
            }
          `}</style>
        </div>
      ) : null}
    </div>
  )
}
