import { useEffect, useState } from 'react'
import {
  listAllotments,
  listHouses,
  createAllotment,
  endAllotment,
  updateAllotment,
  deleteAllotment,
} from '../api'

const RETIREMENT_AGE_YEARS = 60

// Normalize API responses that might be either an array or { data: [...] }
const asArray = (x) => (Array.isArray(x) ? x : (x && Array.isArray(x.data) ? x.data : []))

// Safe DOR = DOB + RETIREMENT_AGE_YEARS (UTC to avoid TZ off-by-one)
function computeDOR(dobStr) {
  if (!dobStr) return ''
  const parts = dobStr.split('-').map(Number)
  if (parts.length !== 3 || !parts[0]) return ''
  const [y, m, d] = parts
  const dt = new Date(Date.UTC(y + RETIREMENT_AGE_YEARS, (m ?? 1) - 1, d ?? 1))
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
  const [error, setError] = useState('')

  // ------- ADD form (minimal fields) -------
  const [form, setForm] = useState({
    house_id: '',
    person_name: '',
    designation: '',
    bps: '',
    medium: '',
    allotment_date: '',
    dob: '',
    dor: '', // derived; read-only
  })
  const onChange = (k, v) => setForm((s) => {
    const next = { ...s, [k]: v }
    if (k === 'dob') next.dor = computeDOR(v)
    return next
  })

  // ------- END modal -------
  const [endTarget, setEndTarget] = useState(null)
  const [endForm, setEndForm] = useState({ notes: '', vacation_date: '' })
  const openEnd = (row) => { setError(''); setEndTarget(row); setEndForm({ notes: '', vacation_date: '' }) }
  const closeEnd = () => { setEndTarget(null) }

  // ------- EDIT modal (same minimal set; house locked) -------
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({
    house_id: '',
    person_name: '',
    designation: '',
    bps: '',
    medium: '',
    allotment_date: '',
    dob: '',
    dor: '',
  })
  const openEdit = (row) => {
    setError('')
    setEditTarget(row)
    setEditForm({
      house_id: row.house_id,
      person_name: row.person_name || '',
      designation: row.designation || '',
      bps: row.bps ?? '',
      medium: row.medium || '',
      allotment_date: row.allotment_date || '',
      dob: row.dob || '',
      dor: row.dor || computeDOR(row.dob || ''),
    })
  }
  const closeEdit = () => setEditTarget(null)

  // DELETE
  const onDelete = async (row) => {
    if (!window.confirm('Delete this allotment record permanently?')) return
    try { setError(''); await deleteAllotment(row.id); await search() }
    catch (e) { setError(e.message) }
  }

  useEffect(() => {
    // load houses + initial list, with normalization so it won't crash
    listHouses().then((h) => setHouses(asArray(h))).catch((e) => setError(e.message))
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function search(e) {
    if (e) e.preventDefault()
    try {
      setError('')
      const r = await listAllotments({
        person_name: filter.person_name || undefined,
        file_no: filter.file_no || undefined,
        qtr_no: filter.qtr_no || undefined,
        active: filter.active === '' ? undefined : filter.active,
      })
      setItems(asArray(r))
    } catch (err) {
      setError(err.message)
      setItems([]) // prevent render crash
    }
  }

  // --------- ADD SUBMIT ----------
  async function onSave(e) {
    e.preventDefault()
    try {
      setSaving(true); setError('')
      const payload = {
        house_id: form.house_id || null,
        person_name: form.person_name || null,
        designation: form.designation || null,
        bps: form.bps === '' ? null : Number(form.bps),
        medium: form.medium || null,
        allotment_date: form.allotment_date || null,
        dob: form.dob || null,
        dor: form.dob ? computeDOR(form.dob) : null, // derived
      }
      await createAllotment(payload) // api.js should send force_end_previous=true
      setShowForm(false)
      setForm({ house_id: '', person_name: '', designation: '', bps: '', medium: '', allotment_date: '', dob: '', dor: '' })
      await search()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onEndConfirm(e) {
    e.preventDefault()
    try {
      await endAllotment(endTarget.id, endForm.notes || null, endForm.vacation_date || null)
      closeEnd()
      search()
    } catch (err) {
      setError(err.message)
    }
  }

  // --------- EDIT SUBMIT ----------
  async function onEditSave(e) {
    e.preventDefault()
    try {
      setSaving(true); setError('')
      const payload = {
        house_id: editForm.house_id, // unchanged (locked)
        person_name: editForm.person_name || null,
        designation: editForm.designation || null,
        bps: editForm.bps === '' ? null : Number(editForm.bps),
        medium: editForm.medium || null,
        allotment_date: editForm.allotment_date || null,
        dob: editForm.dob || null,
        dor: editForm.dob ? computeDOR(editForm.dob) : null,
      }
      await updateAllotment(editTarget.id, payload) // api.js should send force_end_previous=true
      closeEdit()
      await search()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const showDate = (d) => d || '-'
  const safeHouses = Array.isArray(houses) ? houses : []
  const safeItems = Array.isArray(items) ? items : []

  return (
    <div>
      <h2>Allotments</h2>
      {error && <div className="error">{String(error)}</div>}

      {/* Filters */}
      <form className="filters" onSubmit={search}>
        <input
          placeholder="Allottee name"
          value={filter.person_name}
          onChange={(e) => setFilter({ ...filter, person_name: e.target.value })}
        />
        <input
          placeholder="House File No"
          value={filter.file_no}
          onChange={(e) => setFilter({ ...filter, file_no: e.target.value })}
        />
        <input
          placeholder="Quarter No"
          value={filter.qtr_no}
          onChange={(e) => setFilter({ ...filter, qtr_no: e.target.value })}
        />
        <select
          value={filter.active}
          onChange={(e) => setFilter({ ...filter, active: e.target.value })}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Ended</option>
        </select>
        <button type="submit">Search</button>
        <button type="button" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : 'Add Allotment'}
        </button>
      </form>

      {/* ADD form (minimal) */}
      {showForm && (
        <form className="card" onSubmit={onSave} style={{ margin: '1rem 0' }}>
          <div className="grid">
            <label>House
              <select
                value={form.house_id}
                onChange={(e) => onChange('house_id', e.target.value)}
                required
              >
                <option value="">-- Select house / Qtr --</option>
                {safeHouses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.file_no} — Qtr {h.qtr_no}
                  </option>
                ))}
              </select>
            </label>

            <label>Allottee
              <input value={form.person_name} onChange={(e) => onChange('person_name', e.target.value)} />
            </label>

            <label>Designation
              <input value={form.designation} onChange={(e) => onChange('designation', e.target.value)} />
            </label>

            <label>BPS
              <input value={form.bps} onChange={(e) => onChange('bps', e.target.value)} />
            </label>

            <label>Medium
              <select value={form.medium} onChange={(e) => onChange('medium', e.target.value)}>
                <option value="">Select medium</option>
                <option value="family transfer">Family Transfer</option>
                <option value="mutual">Mutual</option>
                <option value="changes">Changes</option>
                <option value="gwl">GWL</option>
              </select>
            </label>

            <label>Allotment Date
              <input type="date" value={form.allotment_date} onChange={(e) => onChange('allotment_date', e.target.value)} />
            </label>

            <label>DOB
              <input type="date" value={form.dob} onChange={(e) => onChange('dob', e.target.value)} />
            </label>

            <label>DOR (auto)
              <input value={form.dor} readOnly />
            </label>
          </div>

          <div>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Allotment'}</button>
          </div>
        </form>
      )}

      {/* TABLE: only essential columns */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>File No</th>
              <th>Qtr No</th>
              <th>Allottee</th>
              <th>BPS</th>
              <th>Designation</th>
              <th>Allotment Date</th>
              <th>DOB</th>
              <th>DOR</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(safeItems).map((it) => {
              const dor = it.dor || computeDOR(it.dob || '')
              return (
                <tr key={it.id}>
                  <td>{it.house_file_no || '-'}</td>
                  <td>{it.house_qtr_no || '-'}</td>
                  <td>{it.person_name || '-'}</td>
                  <td>{it.bps ?? '-'}</td>
                  <td>{it.designation || '-'}</td>
                  <td>{showDate(it.allotment_date)}</td>
                  <td>{showDate(it.dob)}</td>
                  <td>{showDate(dor)}</td>
                  <td>
                    <button onClick={() => openEdit(it)}>Edit</button>{' '}
                    {it.active && <button onClick={() => openEnd(it)}>End</button>}{' '}
                    {!it.active && <button onClick={() => onDelete(it)}>Delete</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* END dialog */}
      {endTarget && (
        <div className="modal">
          <div className="modal-body">
            <h3>End Allotment</h3>
            <form onSubmit={onEndConfirm}>
              <div className="grid">
                <label>Vacation Date
                  <input type="date" value={endForm.vacation_date}
                         onChange={(e) => setEndForm({ ...endForm, vacation_date: e.target.value })} />
                </label>
                <label>Notes
                  <input value={endForm.notes}
                         onChange={(e) => setEndForm({ ...endForm, notes: e.target.value })} />
                </label>
              </div>
              <div style={{ marginTop: '.75rem' }}>
                <button type="button" onClick={closeEnd}>Cancel</button>{' '}
                <button type="submit">Confirm End</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT dialog (minimal; house locked; DOR auto) */}
      {editTarget && (
        <div className="modal">
          <div className="modal-body">
            <h3>Edit Allotment</h3>
            <form className="card" onSubmit={onEditSave} style={{ margin: '1rem 0' }}>
              <div className="grid">
                <label>House
                  <div style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f1f3f9' }}>
                    {editTarget?.house_file_no ?? '-'} — Qtr {editTarget?.house_qtr_no ?? '-'}
                  </div>
                  <input type="hidden" value={editForm.house_id} />
                </label>

                <label>Allottee
                  <input value={editForm.person_name}
                         onChange={(e) => setEditForm({ ...editForm, person_name: e.target.value })} />
                </label>

                <label>Designation
                  <input value={editForm.designation}
                         onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
                </label>

                <label>BPS
                  <input value={editForm.bps}
                         onChange={(e) => setEditForm({ ...editForm, bps: e.target.value })} />
                </label>

                <label>Medium
                  <select value={editForm.medium}
                          onChange={(e) => setEditForm({ ...editForm, medium: e.target.value })}>
                    <option value="">Select medium</option>
                    <option value="family transfer">Family Transfer</option>
                    <option value="mutual">Mutual</option>
                    <option value="changes">Changes</option>
                    <option value="gwl">GWL</option>
                  </select>
                </label>

                <label>Allotment Date
                  <input type="date" value={editForm.allotment_date}
                         onChange={(e) => setEditForm({ ...editForm, allotment_date: e.target.value })} />
                </label>

                <label>DOB
                  <input type="date" value={editForm.dob}
                         onChange={(e) => setEditForm({
                           ...editForm,
                           dob: e.target.value,
                           dor: computeDOR(e.target.value)
                         })} />
                </label>

                <label>DOR (auto)
                  <input value={editForm.dor} readOnly />
                </label>
              </div>

              <div>
                <button type="button" onClick={closeEdit}>Cancel</button>{' '}
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
