// frontend/src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  listHouses,
  searchAllotments,
  createAllotment,
  updateAllotment,
} from '../api' // <-- keep your existing API import path

// --- helpers ---------------------------------------------------------------

function toDateInput(val) {
  if (!val) return ''
  // accept Date or string; return yyyy-mm-dd
  const d = typeof val === 'string' ? new Date(val) : val
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function computeDOR(dob) {
  // Very simple DOR rule: 60 years from DOB
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 60)
  return toDateInput(d)
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// --- component -------------------------------------------------------------

export default function AllotmentsPage() {
  // listing/search
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)

  // houses for selects
  const [houses, setHouses] = useState([])
  const safeHouses = useMemo(() => Array.isArray(houses) ? houses : [], [houses])

  // add form (FULL by default; toggle to simple if you want)
  const [showForm, setShowForm] = useState(false)
  const [addMode, setAddMode] = useState('full') // 'full' | 'simple'
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
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
    retention: 'No',
    retention_last: '',
    notes: '',
    qtr_status: 'active',
    allottee_status: 'in_service',
  })

  // edit modal
  const [editTarget, setEditTarget] = useState(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const hs = await listHouses()
        if (mounted) setHouses(hs || [])
      } catch (e) {
        // non-fatal
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    // initial fetch
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function search() {
    try {
      setLoading(true); setError('')
      const resp = await searchAllotments({
        q: q?.trim() || undefined,
        active: activeOnly ? true : undefined,
      })
      setRows(Array.isArray(resp?.results) ? resp.results : (resp || []))
    } catch (e) {
      setError(e?.message || 'Failed to load allotments')
    } finally {
      setLoading(false)
    }
  }

  function onChange(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function onSave(e) {
    e?.preventDefault?.()
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

        retention_until: form.retention === 'Yes' ? (form.retention_last || null) : null,
        retention_last: form.retention_last || null,

        qtr_status: form.qtr_status || 'active',
        allottee_status: form.allottee_status || 'in_service',
        notes: form.notes || null,

        // if your backend supports it, this mirrors previous behavior
        force_end_previous: true,
      }
      await createAllotment(payload)

      // reset
      setShowForm(false)
      setForm({
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
        retention: 'No',
        retention_last: '',
        notes: '',
        qtr_status: 'active',
        allottee_status: 'in_service',
      })
      await search()
    } catch (e) {
      setError(e?.message || 'Failed to create allotment')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row) {
    setEditTarget({
      ...row,
      // ensure date inputs are normalized
      allotment_date: toDateInput(row.allotment_date),
      occupation_date: toDateInput(row.occupation_date),
      vacation_date: toDateInput(row.vacation_date),
      dob: toDateInput(row.dob),
      dor: toDateInput(row.dor || (row.dob ? computeDOR(row.dob) : '')),
      retention_last: toDateInput(row.retention_last || row.retention_until),
    })
  }

  async function onUpdate(e) {
    e?.preventDefault?.()
    if (!editTarget?.id) return
    try {
      setUpdating(true); setError('')
      const payload = {
        ...editTarget,
        bps: numOrNull(editTarget.bps),
        dor: editTarget.dob ? computeDOR(editTarget.dob) : (editTarget.dor || null),
        retention_until: editTarget.retention_last || null,
      }
      await updateAllotment(editTarget.id, payload)
      setEditTarget(null)
      await search()
    } catch (e) {
      setError(e?.message || 'Failed to update allotment')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="page">
      <div className="toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search name, CNIC, file no, etc."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          style={{ minWidth: 260 }}
        />
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
          />
          Active only
        </label>
        <button onClick={search} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowForm(v => !v)}>{showForm ? 'Close' : 'Add Allotment'}</button>
      </div>

      {error && (
        <div className="error" style={{ marginTop: 8, color: '#b00020' }}>
          {error}
        </div>
      )}

      {/* ADD form (FULL with optional Simple toggle) */}
      {showForm && (
        <form className="card" onSubmit={onSave} style={{ margin: '1rem 0', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>New Allotment</strong>
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={addMode === 'simple'}
                onChange={e => setAddMode(e.target.checked ? 'simple' : 'full')}
              />{' '}
              Simple mode
            </label>
          </div>

          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
            {/* Always show */}
            <label>House
              <select value={form.house_id} onChange={e => onChange('house_id', e.target.value)} required>
                <option value="">-- Select house / Qtr --</option>
                {safeHouses.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.file_no ? `${h.file_no} — ` : ''}Qtr {h.qtr_no || h.number || h.id}
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

            <label>BPS
              <input value={form.bps} onChange={e => onChange('bps', e.target.value)} inputMode="numeric" />
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

            <label>Allotment Date
              <input type="date" value={form.allotment_date} onChange={e => onChange('allotment_date', e.target.value)} />
            </label>

            {/* Full-only */}
            {addMode === 'full' && (
              <>
                <label>Directorate
                  <input value={form.directorate} onChange={e => onChange('directorate', e.target.value)} />
                </label>

                <label>CNIC
                  <input value={form.cnic} onChange={e => onChange('cnic', e.target.value)} />
                </label>

                <label>Pool
                  <input value={form.pool} onChange={e => onChange('pool', e.target.value)} />
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

                <label>Retention
                  <select value={form.retention} onChange={e => onChange('retention', e.target.value)}>
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </label>

                <label>Retention Last
                  <input type="date" value={form.retention_last} onChange={e => onChange('retention_last', e.target.value)} />
                </label>

                <label>Notes
                  <input value={form.notes} onChange={e => onChange('notes', e.target.value)} />
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
              </>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>{' '}
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      {/* table */}
      <div className="card" style={{ marginTop: 12, overflow: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Allottee</th>
              <th style={{ textAlign: 'left' }}>House</th>
              <th>BPS</th>
              <th>Medium</th>
              <th>Allotment</th>
              <th>Occupation</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div><strong>{r.person_name || '-'}</strong></div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{r.designation || ''}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{r.cnic || ''}</div>
                </td>
                <td>
                  <div>{r.house?.file_no ? `${r.house.file_no} — ` : ''}Qtr {r.house?.qtr_no || r.house_id}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{r.directorate || ''}</div>
                </td>
                <td style={{ textAlign: 'center' }}>{r.bps ?? ''}</td>
                <td style={{ textAlign: 'center' }}>{r.medium || ''}</td>
                <td style={{ textAlign: 'center' }}>{toDateInput(r.allotment_date)}</td>
                <td style={{ textAlign: 'center' }}>{toDateInput(r.occupation_date)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span title={`Quarter: ${r.qtr_status || '-'} | Allottee: ${r.allottee_status || '-'}`}>
                    {r.qtr_status || '-'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => openEdit(r)}>Edit</button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, opacity: 0.7 }}>No records</td></tr>
            )}
            {loading && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16 }}>Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT modal */}
      {editTarget && (
        <div className="modal-backdrop">
          <div className="modal card" style={{ maxWidth: 980, margin: '5vh auto', padding: 16, background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Edit Allotment</strong>
              <button onClick={() => setEditTarget(null)}>✕</button>
            </div>

            <form onSubmit={onUpdate}>
              <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
                <label>House
                  <select
                    value={editTarget.house_id || ''}
                    onChange={e => setEditTarget(prev => ({ ...prev, house_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Select house / Qtr --</option>
                    {safeHouses.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.file_no ? `${h.file_no} — ` : ''}Qtr {h.qtr_no || h.number || h.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label>Allottee
                  <input
                    value={editTarget.person_name || ''}
                    onChange={e => setEditTarget(p => ({ ...p, person_name: e.target.value }))}
                  />
                </label>

                <label>Designation
                  <input
                    value={editTarget.designation || ''}
                    onChange={e => setEditTarget(p => ({ ...p, designation: e.target.value }))}
                  />
                </label>

                <label>Directorate
                  <input
                    value={editTarget.directorate || ''}
                    onChange={e => setEditTarget(p => ({ ...p, directorate: e.target.value }))}
                  />
                </label>

                <label>CNIC
                  <input
                    value={editTarget.cnic || ''}
                    onChange={e => setEditTarget(p => ({ ...p, cnic: e.target.value }))}
                  />
                </label>

                <label>Pool
                  <input
                    value={editTarget.pool || ''}
                    onChange={e => setEditTarget(p => ({ ...p, pool: e.target.value }))}
                  />
                </label>

                <label>Medium
                  <select
                    value={editTarget.medium || ''}
                    onChange={e => setEditTarget(p => ({ ...p, medium: e.target.value }))}
                  >
                    <option value="">Select medium</option>
                    <option value="family transfer">Family Transfer</option>
                    <option value="mutual">Mutual</option>
                    <option value="changes">Changes</option>
                    <option value="fresh">Fresh</option>
                  </select>
                </label>

                <label>BPS
                  <input
                    value={editTarget.bps ?? ''}
                    onChange={e => setEditTarget(p => ({ ...p, bps: e.target.value }))}
                    inputMode="numeric"
                  />
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

                <label>DOB
                  <input
                    type="date"
                    value={editTarget.dob || ''}
                    onChange={e => setEditTarget(p => ({ ...p, dob: e.target.value, dor: computeDOR(e.target.value) }))}
                  />
                </label>

                <label>DOR (auto from DOB)
                  <input readOnly value={editTarget.dob ? computeDOR(editTarget.dob) : (editTarget.dor || '')} />
                </label>

                <label>Retention Last
                  <input
                    type="date"
                    value={editTarget.retention_last || ''}
                    onChange={e => setEditTarget(p => ({ ...p, retention_last: e.target.value }))}
                  />
                </label>

                <label>Quarter Status
                  <select
                    value={editTarget.qtr_status || 'active'}
                    onChange={e => setEditTarget(p => ({ ...p, qtr_status: e.target.value }))}
                  >
                    <option value="active">active (occupied)</option>
                    <option value="ended">ended (vacant)</option>
                  </select>
                </label>

                <label>Allottee Status
                  <select
                    value={editTarget.allottee_status || 'in_service'}
                    onChange={e => setEditTarget(p => ({ ...p, allottee_status: e.target.value }))}
                  >
                    <option value="in_service">in service</option>
                    <option value="retired">retired</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>

                <label>Notes
                  <input
                    value={editTarget.notes || ''}
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
      )}

      <style>{`
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
        .table th, .table td { border-bottom: 1px solid #eee; padding: 8px; }
        .toolbar input[type="text"], .toolbar input:not([type]), .toolbar input[type="search"] { height: 32px; }
        input, select { width: 100%; height: 34px; box-sizing: border-box; }
        input[readonly] { background: #f8f8f8; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
        button { height: 32px; padding: 0 12px; }
        .page { padding: 12px; }
      `}</style>
    </div>
  )
}
