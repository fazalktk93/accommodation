// frontend/src/pages/AllotmentsPage.jsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  listHouses,
  searchAllotments,
  createAllotment,
  updateAllotment,
} from '../api' // <-- keep this path as in your project

// ----- helpers --------------------------------------------------------------
function toDateInput(val) {
  if (!val) return ''
  var d = typeof val === 'string' ? new Date(val) : val
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
function computeDOR(dob) {
  if (!dob) return ''
  var d = new Date(dob)
  if (isNaN(d.getTime())) return ''
  d.setFullYear(d.getFullYear() + 60)
  return toDateInput(d)
}
function numOrNull(v) {
  if (v === '' || v === null || typeof v === 'undefined') return null
  var n = Number(v)
  return isFinite(n) ? n : null
}

// ----- component ------------------------------------------------------------
export default function AllotmentsPage() {
  // list/search
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)

  // houses for selects
  const [houses, setHouses] = useState([])
  const safeHouses = useMemo(function () {
    return Array.isArray(houses) ? houses : []
  }, [houses])

  // add form (FULL)
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
    notes: '',
    qtr_status: 'active',
    allottee_status: 'in_service',
  }
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  // edit modal
  const [editTarget, setEditTarget] = useState(null)
  const [updating, setUpdating] = useState(false)

  // boot load houses
  useEffect(function () {
    var mounted = true
    ;(async function () {
      try {
        const hs = await listHouses()
        if (mounted) setHouses(hs || [])
      } catch (e) {
        // non-fatal
        // console.warn('listHouses failed:', e)
      }
    })()
    return function () { mounted = false }
  }, [])

  // initial search
  useEffect(function () { search() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function search() {
    try {
      setLoading(true); setError('')
      const resp = await searchAllotments({
        q: q && q.trim() ? q.trim() : undefined,
        active: activeOnly ? true : undefined,
      })
      const list = Array.isArray(resp && resp.results) ? resp.results : (Array.isArray(resp) ? resp : [])
      setRows(list)
    } catch (e) {
      setError(e && e.message ? e.message : 'Failed to load allotments')
    } finally {
      setLoading(false)
    }
  }

  function onChange(key, val) {
    setForm(function (prev) { return Object.assign({}, prev, { [key]: val }) })
  }

  async function onSave(e) {
    if (e && e.preventDefault) e.preventDefault()
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
        // compute DOR from DOB if given
        dor: form.dob ? computeDOR(form.dob) : (form.dor || null),

        // many backends accept either retention_last or retention_until; keep one
        retention_last: form.retention_last || null,

        qtr_status: form.qtr_status || 'active',
        allottee_status: form.allottee_status || 'in_service',
        notes: form.notes || null,

        // preserve existing behavior if your backend uses this
        force_end_previous: true,
      }
      await createAllotment(payload)
      setShowForm(false)
      setForm(emptyForm)
      await search()
    } catch (e) {
      setError(e && e.message ? e.message : 'Failed to create allotment')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row) {
    if (!row) return
    setEditTarget({
      id: row.id,
      house_id: row.house_id,
      person_name: row.person_name || '',
      designation: row.designation || '',
      directorate: row.directorate || '',
      cnic: row.cnic || '',
      pool: row.pool || '',
      medium: row.medium || '',
      bps: row.bps,

      allotment_date: toDateInput(row.allotment_date),
      occupation_date: toDateInput(row.occupation_date),
      vacation_date: toDateInput(row.vacation_date),

      dob: toDateInput(row.dob),
      dor: toDateInput(row.dor || (row.dob ? computeDOR(row.dob) : '')),

      retention_last: toDateInput(row.retention_last || row.retention_until),

      qtr_status: row.qtr_status || 'active',
      allottee_status: row.allottee_status || 'in_service',
      notes: row.notes || '',
      house: row.house || null,
    })
  }

  async function onUpdate(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (!editTarget || !editTarget.id) return
    try {
      setUpdating(true); setError('')
      const payload = Object.assign({}, editTarget, {
        bps: numOrNull(editTarget.bps),
        dor: editTarget.dob ? computeDOR(editTarget.dob) : (editTarget.dor || null),
        retention_until: editTarget.retention_last || null,
      })
      await updateAllotment(editTarget.id, payload)
      setEditTarget(null)
      await search()
    } catch (e) {
      setError(e && e.message ? e.message : 'Failed to update allotment')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="page" style={{ padding: 12 }}>
      <div className="toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search name, CNIC, file no, etc."
          value={q}
          onChange={function (e) { setQ(e.target.value) }}
          onKeyDown={function (e) { if (e.key === 'Enter') search() }}
          style={{ minWidth: 260, height: 32 }}
        />
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={function (e) { setActiveOnly(e.target.checked) }}
          />
          Active only
        </label>
        <button onClick={search} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        <div style={{ flex: 1 }} />
        <button onClick={function () { setShowForm(function (v) { return !v }) }}>{showForm ? 'Close' : 'Add Allotment'}</button>
      </div>

      {error ? (
        <div style={{ marginTop: 8, color: '#b00020' }}>{error}</div>
      ) : null}

      {/* ADD form (FULL) */}
      {showForm ? (
        <form onSubmit={onSave} className="card" style={{ margin: '12px 0', padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <strong>New Allotment</strong>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
            <label>House
              <select value={form.house_id} onChange={function (e) { onChange('house_id', e.target.value) }} required>
                <option value="">-- Select house / Qtr --</option>
                {safeHouses.map(function (h) {
                  return (
                    <option key={h.id} value={h.id}>
                      {(h.file_no ? (h.file_no + ' — ') : '') + 'Qtr ' + (h.qtr_no || h.number || h.id)}
                    </option>
                  )
                })}
              </select>
            </label>

            <label>Allottee
              <input value={form.person_name} onChange={function (e) { onChange('person_name', e.target.value) }} />
            </label>

            <label>Designation
              <input value={form.designation} onChange={function (e) { onChange('designation', e.target.value) }} />
            </label>

            <label>Directorate
              <input value={form.directorate} onChange={function (e) { onChange('directorate', e.target.value) }} />
            </label>

            <label>CNIC
              <input value={form.cnic} onChange={function (e) { onChange('cnic', e.target.value) }} />
            </label>

            <label>Pool
              <input value={form.pool} onChange={function (e) { onChange('pool', e.target.value) }} />
            </label>

            <label>Medium
              <select value={form.medium} onChange={function (e) { onChange('medium', e.target.value) }}>
                <option value="">Select medium</option>
                <option value="family transfer">Family Transfer</option>
                <option value="mutual">Mutual</option>
                <option value="changes">Changes</option>
                <option value="fresh">Fresh</option>
              </select>
            </label>

            <label>BPS
              <input value={form.bps} onChange={function (e) { onChange('bps', e.target.value) }} inputMode="numeric" />
            </label>

            <label>Allotment Date
              <input type="date" value={form.allotment_date} onChange={function (e) { onChange('allotment_date', e.target.value) }} />
            </label>

            <label>Occupation Date
              <input type="date" value={form.occupation_date} onChange={function (e) { onChange('occupation_date', e.target.value) }} />
            </label>

            <label>Vacation Date
              <input type="date" value={form.vacation_date} onChange={function (e) { onChange('vacation_date', e.target.value) }} />
            </label>

            <label>DOB
              <input type="date" value={form.dob} onChange={function (e) { onChange('dob', e.target.value) }} />
            </label>

            <label>DOR (auto)
              <input readOnly value={form.dob ? computeDOR(form.dob) : ''} />
            </label>

            <label>Retention Last
              <input type="date" value={form.retention_last} onChange={function (e) { onChange('retention_last', e.target.value) }} />
            </label>

            <label>Quarter Status
              <select value={form.qtr_status} onChange={function (e) { onChange('qtr_status', e.target.value) }}>
                <option value="active">active (occupied)</option>
                <option value="ended">ended (vacant)</option>
              </select>
            </label>

            <label>Allottee Status
              <select value={form.allottee_status} onChange={function (e) { onChange('allottee_status', e.target.value) }}>
                <option value="in_service">in service</option>
                <option value="retired">retired</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>

            <label>Notes
              <input value={form.notes} onChange={function (e) { onChange('notes', e.target.value) }} />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={function () { setShowForm(false) }}>Cancel</button>{' '}
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : null}

      {/* table */}
      <div className="card" style={{ marginTop: 12, overflow: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Allottee</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>House</th>
              <th style={{ borderBottom: '1px solid #eee', padding: 8 }}>BPS</th>
              <th style={{ borderBottom: '1px solid #eee', padding: 8 }}>Medium</th>
              <th style={{ borderBottom: '1px solid #eee', padding: 8 }}>Allotment</th>
              <th style={{ borderBottom: '1px solid #eee', padding: 8 }}>Occupation</th>
              <th style={{ borderBottom: '1px solid #eee', padding: 8 }}>Status</th>
              <th style={{ borderBottom: '1px solid #eee', padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).length ? (rows || []).map(function (r) {
              var house = r && r.house ? r.house : null
              return (
                <tr key={r.id}>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                    <div><strong>{r.person_name || '-'}</strong></div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.designation || ''}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.cnic || ''}</div>
                  </td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                    <div>{(house && house.file_no ? (house.file_no + ' — ') : '') + 'Qtr ' + (house && (house.qtr_no || house.number) || r.house_id)}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{r.directorate || ''}</div>
                  </td>
                  <td style={{ textAlign: 'center', borderBottom: '1px solid #eee', padding: 8 }}>{(r.bps === 0 || r.bps) ? r.bps : ''}</td>
                  <td style={{ textAlign: 'center', borderBottom: '1px solid #eee', padding: 8 }}>{r.medium || ''}</td>
                  <td style={{ textAlign: 'center', borderBottom: '1px solid #eee', padding: 8 }}>{toDateInput(r.allotment_date)}</td>
                  <td style={{ textAlign: 'center', borderBottom: '1px solid #eee', padding: 8 }}>{toDateInput(r.occupation_date)}</td>
                  <td style={{ textAlign: 'center', borderBottom: '1px solid #eee', padding: 8 }}>
                    <span title={'Quarter: ' + (r.qtr_status || '-') + ' | Allottee: ' + (r.allottee_status || '-')}>
                      {r.qtr_status || '-'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', borderBottom: '1px solid #eee', padding: 8 }}>
                    <button onClick={function () { openEdit(r) }}>Edit</button>
                  </td>
                </tr>
              )
            }) : (!loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, opacity: 0.7 }}>No records</td></tr>
            ) : (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16 }}>Loading…</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EDIT modal */}
      {editTarget ? (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50
        }}>
          <div className="card" style={{ maxWidth: 980, margin: '5vh auto', padding: 16, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, width: 'min(980px, 96vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Edit Allotment</strong>
              <button onClick={function () { setEditTarget(null) }}>✕</button>
            </div>

            <form onSubmit={onUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 12 }}>
                <label>House
                  <select
                    value={editTarget.house_id || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { house_id: e.target.value }) }) }}
                    required
                  >
                    <option value="">-- Select house / Qtr --</option>
                    {safeHouses.map(function (h) {
                      return (
                        <option key={h.id} value={h.id}>
                          {(h.file_no ? (h.file_no + ' — ') : '') + 'Qtr ' + (h.qtr_no || h.number || h.id)}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <label>Allottee
                  <input
                    value={editTarget.person_name || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { person_name: e.target.value }) }) }}
                  />
                </label>

                <label>Designation
                  <input
                    value={editTarget.designation || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { designation: e.target.value }) }) }}
                  />
                </label>

                <label>Directorate
                  <input
                    value={editTarget.directorate || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { directorate: e.target.value }) }) }}
                  />
                </label>

                <label>CNIC
                  <input
                    value={editTarget.cnic || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { cnic: e.target.value }) }) }}
                  />
                </label>

                <label>Pool
                  <input
                    value={editTarget.pool || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { pool: e.target.value }) }) }}
                  />
                </label>

                <label>Medium
                  <select
                    value={editTarget.medium || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { medium: e.target.value }) }) }}
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
                    value={(editTarget.bps === 0 || editTarget.bps) ? editTarget.bps : ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { bps: e.target.value }) }) }}
                    inputMode="numeric"
                  />
                </label>

                <label>Allotment Date
                  <input
                    type="date"
                    value={editTarget.allotment_date || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { allotment_date: e.target.value }) }) }}
                  />
                </label>

                <label>Occupation Date
                  <input
                    type="date"
                    value={editTarget.occupation_date || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { occupation_date: e.target.value }) }) }}
                  />
                </label>

                <label>Vacation Date
                  <input
                    type="date"
                    value={editTarget.vacation_date || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { vacation_date: e.target.value }) }) }}
                  />
                </label>

                <label>DOB
                  <input
                    type="date"
                    value={editTarget.dob || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { dob: e.target.value, dor: computeDOR(e.target.value) }) }) }}
                  />
                </label>

                <label>DOR (auto)
                  <input readOnly value={editTarget.dob ? computeDOR(editTarget.dob) : (editTarget.dor || '')} />
                </label>

                <label>Retention Last
                  <input
                    type="date"
                    value={editTarget.retention_last || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { retention_last: e.target.value }) }) }}
                  />
                </label>

                <label>Quarter Status
                  <select
                    value={editTarget.qtr_status || 'active'}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { qtr_status: e.target.value }) }) }}
                  >
                    <option value="active">active (occupied)</option>
                    <option value="ended">ended (vacant)</option>
                  </select>
                </label>

                <label>Allottee Status
                  <select
                    value={editTarget.allottee_status || 'in_service'}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { allottee_status: e.target.value }) }) }}
                  >
                    <option value="in_service">in service</option>
                    <option value="retired">retired</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>

                <label>Notes
                  <input
                    value={editTarget.notes || ''}
                    onChange={function (e) { setEditTarget(function (p) { return Object.assign({}, p, { notes: e.target.value }) }) }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={function () { setEditTarget(null) }}>Cancel</button>{' '}
                <button type="submit" disabled={updating}>{updating ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
