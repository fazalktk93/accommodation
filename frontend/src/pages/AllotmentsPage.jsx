import React, { useEffect, useMemo, useState } from 'react'
import {
  listAllotments,
  listHouses,
  createAllotment,
  endAllotment,
  updateAllotment,
  deleteAllotment,
} from '../api'

const RETIREMENT_AGE_YEARS = 60

// normalize API responses that may be [] or {data:[]}
const asArray = (x) => (Array.isArray(x) ? x : (x && Array.isArray(x.data) ? x.data : []))

function toDateInput(val) {
  if (!val) return ''
  const d = typeof val === 'string' ? new Date(val) : val
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function computeDOR(dob) {
  if (!dob) return ''
  const parts = String(dob).split('-').map(n => parseInt(n, 10))
  const y = parts[0], m = parts[1], d = parts[2]
  if (!y || !m || !d) return ''
  const dt = new Date(Date.UTC(y + RETIREMENT_AGE_YEARS, m - 1, d))
  return dt.toISOString().slice(0, 10)
}

export default function AllotmentsPage() {
  // data
  const [items, setItems] = useState([])
  const [houses, setHouses] = useState([])

  // filters
  const [filter, setFilter] = useState({ person_name: '', file_no: '', qtr_no: '', active: 'true' })

  // add/edit state
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addMode, setAddMode] = useState('full') // 'full' | 'simple'
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
    retention: 'No',
    retention_last: '',
    notes: '',
    qtr_status: 'active',
    allottee_status: 'in_service',
  }
  const [form, setForm] = useState(emptyForm)

  // edit modal
  const [editTarget, setEditTarget] = useState(null)
  const [updating, setUpdating] = useState(false)
  const safeHouses = useMemo(() => Array.isArray(houses) ? houses : [], [houses])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const hs = await listHouses()
        if (mounted) setHouses(asArray(hs))
      } catch (e) {
        console.warn('listHouses failed:', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => { search() }, []) // initial

  async function search() {
    try {
      const resp = await listAllotments({
        person_name: filter.person_name || undefined,
        file_no: filter.file_no || undefined,
        qtr_no: filter.qtr_no || undefined,
        active: filter.active === 'true' ? true : (filter.active === 'false' ? false : undefined),
      })
      setItems(asArray(resp))
    } catch (e) {
      console.error('listAllotments failed:', e)
    }
  }

  function onChange(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function onSave(e) {
    e && e.preventDefault && e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        house_id: form.house_id || null,
        person_name: form.person_name || null,
        designation: form.designation || null,
        directorate: form.directorate || null,
        cnic: form.cnic || null,
        pool: form.pool || null,
        medium: form.medium || null,
        bps: form.bps === '' ? null : Number(form.bps),
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
      alert(e.message || 'Failed to create allotment')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row) {
    setEditTarget({
      ...row,
      allotment_date: toDateInput(row.allotment_date),
      occupation_date: toDateInput(row.occupation_date),
      vacation_date: toDateInput(row.vacation_date),
      dob: toDateInput(row.dob),
      dor: toDateInput(row.dor || (row.dob ? computeDOR(row.dob) : '')),
      retention_last: toDateInput(row.retention_last),
    })
  }
  function closeEdit(){ setEditTarget(null) }

  async function onUpdate(e) {
    e && e.preventDefault && e.preventDefault()
    if (!editTarget || !editTarget.id) return
    try {
      setUpdating(true)
      const payload = {
        ...editTarget,
        bps: editTarget.bps === '' ? null : Number(editTarget.bps),
        dor: editTarget.dob ? computeDOR(editTarget.dob) : (editTarget.dor || null),
      }
      await updateAllotment(editTarget.id, payload)
      setEditTarget(null)
      await search()
    } catch (e) {
      alert(e.message || 'Failed to update allotment')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="page">
      {/* filters */}
      <div className="card" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input placeholder="Name" value={filter.person_name} onChange={e => setFilter({ ...filter, person_name: e.target.value })} />
        <input placeholder="File No" value={filter.file_no} onChange={e => setFilter({ ...filter, file_no: e.target.value })} />
        <input placeholder="Qtr No" value={filter.qtr_no} onChange={e => setFilter({ ...filter, qtr_no: e.target.value })} />
        <select value={filter.active} onChange={e => setFilter({ ...filter, active: e.target.value })}>
          <option value="true">Active</option>
          <option value="false">Ended</option>
          <option value="all">All</option>
        </select>
        <button onClick={search}>Search</button>
        <div style={{ flex:1 }} />
        <button onClick={() => setShowForm(v => !v)}>{showForm ? 'Close' : 'Add Allotment'}</button>
      </div>

      {/* add form */}
      {showForm && (
        <form className="card" onSubmit={onSave} style={{ marginTop:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <strong>New Allotment</strong>
            <label style={{ fontSize:12 }}>
              <input type="checkbox" checked={addMode === 'simple'} onChange={e => setAddMode(e.target.checked ? 'simple' : 'full')} /> Simple mode
            </label>
          </div>

          <div className="grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginTop:12 }}>
            <label>House
              <select value={form.house_id} onChange={e => onChange('house_id', e.target.value)} required>
                <option value="">-- Select house / Qtr --</option>
                {safeHouses.map(h => (
                  <option key={h.id} value={h.id}>{(h.file_no ? `${h.file_no} — ` : '') + 'Qtr ' + (h.qtr_no || h.number || h.id)}</option>
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
              </>
            )}
          </div>

          <div style={{ marginTop:12 }}>
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
            {(Array.isArray(items) ? items : []).map((r) => {
              const house = r && r.house ? r.house : null
              return (
                <tr key={r.id}>
                  <td>
                    <div><strong>{r.person_name || '-'}</strong></div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.designation || ''}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.cnic || ''}</div>
                  </td>
                  <td>
                    <div>{(house && house.file_no ? `${house.file_no} — ` : '') + 'Qtr ' + ((house && (house.qtr_no || house.number)) || r.house_id)}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.directorate || ''}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{(r.bps === 0 || r.bps) ? r.bps : ''}</td>
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
              )
            })}
            {(!items || items.length === 0) && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, opacity: 0.7 }}>No records</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* edit modal */}
      {editTarget && (
        <div className="modal-backdrop">
          <div className="modal card" style={{ maxWidth: 980, margin: '5vh auto', padding: 16, background: 'white' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong>Edit Allotment</strong>
              <button onClick={closeEdit}>✕</button>
            </div>

            <form onSubmit={onUpdate}>
              <div className="grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginTop:12 }}>
                <label>House
                  <select value={editTarget.house_id || ''} onChange={e => setEditTarget(p => ({ ...p, house_id: e.target.value }))} required>
                    <option value="">-- Select house / Qtr --</option>
                    {safeHouses.map(h => (
                      <option key={h.id} value={h.id}>{(h.file_no ? `${h.file_no} — ` : '') + 'Qtr ' + (h.qtr_no || h.number || h.id)}</option>
                    ))}
                  </select>
                </label>

                <label>Allottee
                  <input value={editTarget.person_name || ''} onChange={e => setEditTarget(p => ({ ...p, person_name: e.target.value }))} />
                </label>

                <label>Designation
                  <input value={editTarget.designation || ''} onChange={e => setEditTarget(p => ({ ...p, designation: e.target.value }))} />
                </label>

                <label>Directorate
                  <input value={editTarget.directorate || ''} onChange={e => setEditTarget(p => ({ ...p, directorate: e.target.value }))} />
                </label>

                <label>CNIC
                  <input value={editTarget.cnic || ''} onChange={e => setEditTarget(p => ({ ...p, cnic: e.target.value }))} />
                </label>

                <label>Pool
                  <input value={editTarget.pool || ''} onChange={e => setEditTarget(p => ({ ...p, pool: e.target.value }))} />
                </label>

                <label>Medium
                  <select value={editTarget.medium || ''} onChange={e => setEditTarget(p => ({ ...p, medium: e.target.value }))}>
                    <option value="">Select medium</option>
                    <option value="family transfer">Family Transfer</option>
                    <option value="mutual">Mutual</option>
                    <option value="changes">Changes</option>
                    <option value="fresh">Fresh</option>
                  </select>
                </label>

                <label>BPS
                  <input value={(editTarget.bps === 0 || editTarget.bps) ? editTarget.bps : ''} onChange={e => setEditTarget(p => ({ ...p, bps: e.target.value }))} inputMode="numeric" />
                </label>

                <label>Allotment Date
                  <input type="date" value={editTarget.allotment_date || ''} onChange={e => setEditTarget(p => ({ ...p, allotment_date: e.target.value }))} />
                </label>

                <label>Occupation Date
                  <input type="date" value={editTarget.occupation_date || ''} onChange={e => setEditTarget(p => ({ ...p, occupation_date: e.target.value }))} />
                </label>

                <label>Vacation Date
                  <input type="date" value={editTarget.vacation_date || ''} onChange={e => setEditTarget(p => ({ ...p, vacation_date: e.target.value }))} />
                </label>

                <label>DOB
                  <input type="date" value={editTarget.dob || ''} onChange={e => setEditTarget(p => ({ ...p, dob: e.target.value, dor: computeDOR(e.target.value) }))} />
                </label>

                <label>DOR (auto from DOB)
                  <input readOnly value={editTarget.dob ? computeDOR(editTarget.dob) : (editTarget.dor || '')} />
                </label>

                <label>Retention Last
                  <input type="date" value={editTarget.retention_last || ''} onChange={e => setEditTarget(p => ({ ...p, retention_last: e.target.value }))} />
                </label>

                <label>Quarter Status
                  <select value={editTarget.qtr_status || 'active'} onChange={e => setEditTarget(p => ({ ...p, qtr_status: e.target.value }))}>
                    <option value="active">active (occupied)</option>
                    <option value="ended">ended (vacant)</option>
                  </select>
                </label>

                <label>Allottee Status
                  <select value={editTarget.allottee_status || 'in_service'} onChange={e => setEditTarget(p => ({ ...p, allottee_status: e.target.value }))}>
                    <option value="in_service">in service</option>
                    <option value="retired">retired</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>

                <label>Notes
                  <input value={editTarget.notes || ''} onChange={e => setEditTarget(p => ({ ...p, notes: e.target.value }))} />
                </label>
              </div>

              <div>
                <button type="button" onClick={closeEdit}>Cancel</button>{' '}
                <button type="submit" disabled={updating}>{updating ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page { padding: 12px; }
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
        .table th, .table td { border-bottom: 1px solid #eee; padding: 8px; }
        input, select { width: 100%; height: 34px; box-sizing: border-box; }
        input[readonly] { background: #f8f8f8; }
        label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
        button { height: 32px; padding: 0 12px; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.25); display: flex; align-items: flex-start; justify-content: center; z-index: 50; }
      `}</style>
    </div>
  )
}
