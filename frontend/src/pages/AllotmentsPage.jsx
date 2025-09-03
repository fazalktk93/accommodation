import { useEffect, useState } from 'react'
import {
  listAllotments,
  listHouses,
  createAllotment,
  endAllotment,
  updateAllotment,   // NEW
  deleteAllotment,   // NEW
} from '../api'

export default function AllotmentsPage() {
  // data
  const [items, setItems] = useState([])
  const [houses, setHouses] = useState([])

  // filters
  const [filter, setFilter] = useState({ person_name: '', file_no: '', qtr_no: '', active: 'true' })

  // add form
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
  retention_until: '',
  retention_last: '',
  qtr_status: 'active',
  allotment_medium: '',
  allottee_status: 'in_service',
  notes: ''
})
  const onChange = (k, v) => setForm(s => ({ ...s, [k]: v }))

  // END popover/modal
  const [endTarget, setEndTarget] = useState(null)
  const [endForm, setEndForm] = useState({ notes: '', vacation_date: '' })
  const openEnd = (row) => { setError(''); setEndTarget(row); setEndForm({ notes: '', vacation_date: '' }) }
  const closeEnd = () => { setEndTarget(null) }

  // EDIT modal
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ ...form })
  const [forceEndOnEdit, setForceEndOnEdit] = useState(false)
  const openEdit = (row) => {
    setError('')
    setEditTarget(row)
    setForceEndOnEdit(false)
    setEditForm({
      house_id: row.house_id,
      person_name: row.person_name || '',
      designation: row.designation || '',
      directorate: row.directorate || '',
      cnic: row.cnic || '',
      pool: row.pool || '',
      medium: row.medium || '',
      bps: row.bps ?? '',
      allotment_date: row.allotment_date || '',
      occupation_date: row.occupation_date || '',
      vacation_date: row.vacation_date || '',
      dob: row.dob || '',
      dor: row.dor || '',
      retention: row.retention ? 'Yes' : 'No',
      retention_last: row.retention_last || '',
      allotment_medium: row.allotment_medium || '',
      notes: row.notes || '',
    })
  }
  const closeEdit = () => setEditTarget(null)

  // DELETE
  const onDelete = async (row) => {
    if (!window.confirm('Delete this allotment record permanently?')) return
    try {
      setError('')
      await deleteAllotment(row.id)
      await search()
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    listHouses().then(r => setHouses(r.data || r))
    // initial load
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
        active: filter.active === '' ? undefined : filter.active
      })
      setItems(r.data || r)
    } catch (err) {
      setError(err.message)
    }
  }

  async function onSave(e) {
    e.preventDefault()
    try {
      setSaving(true); setError('')
      const payload = {
        ...form,
        bps: form.bps === '' ? null : Number(form.bps),
        retention: (form.retention || '').toLowerCase() === 'yes'
      }
      await createAllotment(payload)
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
      })
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

  async function onEditSave(e) {
    e.preventDefault()
    try {
      setSaving(true); setError('')
      const payload = {
        house_id: editForm.house_id,
        person_name: editForm.person_name || null,
        designation: editForm.designation || null,
        directorate: editForm.directorate || null,
        cnic: editForm.cnic || null,
        pool: editForm.pool || null,
        medium: editForm.medium || null,
        bps: editForm.bps === '' ? null : Number(editForm.bps),
        allotment_date: editForm.allotment_date || null,
        occupation_date: editForm.occupation_date || null,
        vacation_date: editForm.vacation_date || null,
        dob: editForm.dob || null,
        dor: editForm.dor || null,
        retention: (editForm.retention || '').toLowerCase() === 'yes',
        retention_last: editForm.retention_last || null,
        medium: form.medium || null,
        notes: editForm.notes || null,
      }
      await updateAllotment(editTarget.id, payload, forceEndOnEdit)
      closeEdit()
      await search()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2>Allotments</h2>
      {error && <div className="error">{error}</div>}

      <form className="filters" onSubmit={search}>
        <input
          placeholder="Allottee name"
          value={filter.person_name}
          onChange={e => setFilter({ ...filter, person_name: e.target.value })}
        />
        <input
          placeholder="House File No"
          value={filter.file_no}
          onChange={e => setFilter({ ...filter, file_no: e.target.value })}
        />
        <input
          placeholder="Quarter No"
          value={filter.qtr_no}
          onChange={e => setFilter({ ...filter, qtr_no: e.target.value })}
        />
        <select
          value={filter.active}
          onChange={e => setFilter({ ...filter, active: e.target.value })}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Ended</option>
        </select>
        <button type="submit">Search</button>
        <button type="button" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Close' : 'Add Allotment'}
        </button>
      </form>

      {showForm && (
        <form className="panel" onSubmit={onSave} style={{ margin: '1rem 0' }}>
          <div className="grid">
            {/* House (locked) */}
            <label>House
              <select
                value={form.house_id}
                onChange={e => onChange('house_id', e.target.value)}
                required
              >
                <option value="">-- Select house / Qtr --</option>
                {houses.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.file_no} — Qtr {h.qtr_no}
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
              <select
                value={form.medium}
                onChange={e => onChange('medium', e.target.value)}
              >
                <option value="">Select medium</option>
                <option value="family transfer">Family Transfer</option>
                <option value="mutual">Mutual</option>
                <option value="changes">Changes</option>
                <option value="gwl">GWL</option>
              </select>
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
            <label>Vacation Date
              <input type="date" value={form.vacation_date} onChange={e => onChange('vacation_date', e.target.value)} />
            </label>
            <label>DOB
              <input type="date" value={form.dob} onChange={e => onChange('dob', e.target.value)} />
            </label>
            <label>DOR
              <input type="date" value={form.dor} onChange={e => onChange('dor', e.target.value)} />
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
            <label>Allotment Medium
              <select
                value={editForm.allotment_medium}
                onChange={e => setEditForm({ ...editForm, allotment_medium: e.target.value })}
              >
                <option value="">Select medium</option>
                <option value="family transfer">Family Transfer</option>
                <option value="mutual">Mutual</option>
                <option value="changes">Changes</option>
                <option value="gwl">GWL</option>
              </select>
            </label>
            <label>Notes
              <input value={form.notes} onChange={e => onChange('notes', e.target.value)} />
            </label>
          </div>
          <div>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Allotment'}</button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>File No</th><th>Qtr No</th><th>Allottee</th><th>Designation</th><th>BPS</th><th>Directorate</th>
            <th>CNIC</th><th>Allotment Date</th><th>DOB</th><th>DOR</th>
            <th>Retention</th><th>Retention Last</th>
            <th>Occupation</th><th>Vacation</th><th>Pool</th><th>Qtr Status</th><th>Medium</th>
            <th>Period (days)</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.house_file_no || '-'}</td>
              <td>{it.house_qtr_no || '-'}</td>
              <td>{it.person_name}</td>
              <td>{it.designation || '-'}</td>
              <td>{it.bps ?? '-'}</td>
              <td>{it.directorate || '-'}</td>
              <td>{it.cnic || '-'}</td>
              <td>{it.allotment_date || '-'}</td>
              <td>{it.dob || '-'}</td>
              <td>{it.dor || '-'}</td>
              <td>{it.retention ? 'Yes' : 'No'}</td>
              <td>{it.retention_last || '-'}</td>
              <td>{it.occupation_date || '-'}</td>
              <td>{it.vacation_date || '-'}</td>
              <td>{it.pool || '-'}</td>
              <td>{it.house_status || '-'}</td>
              <td>{it.medium || '-'}</td>
              <td>{it.period_of_stay ?? '-'}</td>
              <td>{it.status || '-'}</td>
              <td>
                <button onClick={() => openEdit(it)}>Edit</button>{' '}
                {it.active && <button onClick={() => openEnd(it)}>End</button>}{' '}
                {!it.active && <button onClick={() => onDelete(it)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* END dialog */}
      {endTarget && (
        <div className="modal">
          <div className="modal-body">
            <h3>End Allotment</h3>
            <form onSubmit={onEndConfirm}>
              <div className="grid">
                <label>Vacation Date
                  <input type="date" value={endForm.vacation_date} onChange={e => setEndForm({ ...endForm, vacation_date: e.target.value })} />
                </label>
                <label>Notes
                  <input value={endForm.notes} onChange={e => setEndForm({ ...endForm, notes: e.target.value })} />
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

      {/* EDIT dialog */}
      {editTarget && (
        <div className="modal">
          <div className="modal-body">
            <h3>Edit Allotment</h3>
            <form className="panel" onSubmit={onSave} style={{ margin: '1rem 0' }}>
              <div className="grid">
                {/* EDIT: House (locked / read-only) */}
                <label>House
                  <div style={{ padding: '8px 10px', border: '1px solid #ccc', borderRadius: 4, background: '#f8f8f8' }}>
                    {editTarget?.house_file_no ?? '-'} — Qtr {editTarget?.house_qtr_no ?? '-'}
                  </div>
                  <input type="hidden" value={editForm.house_id} />
                </label>

                <label>Allottee
                  <input value={form.person_name} onChange={e => onChange('person_name', e.target.value)} required />
                </label>

                <label>Designation
                  <input value={form.designation} onChange={e => onChange('designation', e.target.value)} />
                </label>

                <label>Directorate
                  <input value={form.directorate} onChange={e => onChange('directorate', e.target.value)} />
                </label>

                <label>CNIC
                  <input value={form.cnic} onChange={e => onChange('cnic', e.target.value)} placeholder="xxxxx-xxxxxxx-x" />
                </label>

                <label>Pool
                  <input value={form.pool} onChange={e => onChange('pool', e.target.value)} />
                </label>

                <label>Medium
                <select
                  value={editForm.medium}
                  onChange={e => setEditForm({ ...editForm, medium: e.target.value })}
                >
                  <option value="">Select medium</option>
                  <option value="family transfer">Family Transfer</option>
                  <option value="mutual">Mutual</option>
                  <option value="changes">Changes</option>
                  <option value="gwl">GWL</option>
                </select>
              </label>

                <label>BPS
                  <input type="number" value={form.bps} onChange={e => onChange('bps', e.target.value)} />
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

                <label>DOR
                  <input type="date" value={form.dor} onChange={e => onChange('dor', e.target.value)} />
                </label>

                <label>Retention Until
                  <input type="date" value={form.retention_until} onChange={e => onChange('retention_until', e.target.value)} />
                </label>

                <label>Retention Last
                  <input type="date" value={form.retention_last} onChange={e => onChange('retention_last', e.target.value)} />
                </label>

                <label>Quarter Status
                  <select value={form.qtr_status} onChange={e => onChange('qtr_status', e.target.value)}>
                    <option value="active">active</option>
                    <option value="ended">ended</option>
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
                  <textarea value={form.notes} onChange={e => onChange('notes', e.target.value)} />
                </label>
              </div>

              <div>
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Allotment'}</button>
              </div>
            </form>

          </div>
        </div>
      )}
      {/* ------------------------------------ */}
    </div>
  )
}
