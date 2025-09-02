import { useEffect, useState } from 'react'
import { listAllotments, createAllotment, endAllotment, listHouses } from '../api'

export default function AllotmentsPage(){
  // data
  const [items, setItems] = useState([])
  const [houses, setHouses] = useState([])

  // search filters (search-first stays)
  const [filter, setFilter] = useState({ person_name:'', file_no:'', qtr_no:'', active:'true' })

  // form
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // form state covers every field you asked for
  const [form, setForm] = useState({
    house_id: '',
    person_name: '', designation: '', bps: '', directorate: '', cnic: '',
    allotment_date: '', date_of_birth: '', date_of_retirement: '',
    occupation_date: '', vacation_date: '',
    retention: 'false', retention_last_date: '',
    pool: '', qtr_status: '', allotment_medium: 'other',
    active: 'true', notes: ''
  })

  const search = (e) => {
    e && e.preventDefault()
    const params = {
      person_name: filter.person_name || undefined,
      file_no:      filter.file_no      || undefined,
      qtr_no:       filter.qtr_no       || undefined,
      active:       filter.active === '' ? undefined : filter.active,
    }
    listAllotments(params)
      .then(r => setItems(r.data))
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    search()
    listHouses().then(r => setHouses(r.data)).catch(()=>{}) // for house dropdown
  }, [])

  const onChange = (name, value) => setForm(f => ({ ...f, [name]: value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try{
      // normalize payload types
      const payload = {
        house_id: Number(form.house_id),
        person_name: form.person_name.trim(),
        designation: form.designation || null,
        bps: form.bps ? Number(form.bps) : null,
        directorate: form.directorate || null,
        cnic: form.cnic || null,

        allotment_date: form.allotment_date || null,
        date_of_birth: form.date_of_birth || null,
        date_of_retirement: form.date_of_retirement || null,
        occupation_date: form.occupation_date || null,
        vacation_date: form.vacation_date || null,

        retention: form.retention === 'true',
        retention_last_date: form.retention_last_date || null,

        pool: form.pool || null,
        qtr_status: form.qtr_status || null,
        allotment_medium: form.allotment_medium || 'other',

        active: form.active === 'true',
        notes: form.notes || null
      }
      await createAllotment(payload)
      setShowForm(false)
      // reset a few fields, keep house_id handy
      setForm(f => ({ ...f, person_name:'', designation:'', bps:'', directorate:'', cnic:'',
        allotment_date:'', date_of_birth:'', date_of_retirement:'', occupation_date:'', vacation_date:'',
        retention:'false', retention_last_date:'', pool:'', qtr_status:'', allotment_medium:'other', notes:'' }))
      search()
    }catch(err){
      setError(err.message)
    }finally{
      setSaving(false)
    }
  }

  const end = async (id) => {
    if(!confirm('Mark this allotment as ended (vacated)?')) return
    try{
      await endAllotment(id, 'Ended via UI', null)
      search()
    }catch(err){ setError(err.message) }
  }

  return (
    <div>
      <h2>Allotments</h2>
      {error && <div className="error">{error}</div>}

      <form className="filters" onSubmit={search}>
        <input placeholder="Allottee name" value={filter.person_name} onChange={e=>setFilter({...filter, person_name:e.target.value})}/>
        <input placeholder="House File No" value={filter.file_no} onChange={e=>setFilter({...filter, file_no:e.target.value})}/>
        <input placeholder="Quarter No" value={filter.qtr_no} onChange={e=>setFilter({...filter, qtr_no:e.target.value})}/>
        <select value={filter.active} onChange={e=>setFilter({...filter, active:e.target.value})}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Ended</option>
        </select>
        <button type="submit">Search</button>
        <button type="button" onClick={()=>setShowForm(s=>!s)}>{showForm ? 'Close' : 'Add Allotment'}</button>
      </form>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <h3>Add Allotment</h3>
          <div className="grid">
            <label>House
              <select value={form.house_id} onChange={e=>onChange('house_id', e.target.value)} required>
                <option value="">Select house</option>
                {houses.map(h => (
                  <option key={h.id} value={h.id}>{h.file_no} — Qtr {h.qtr_no} — {h.sector}</option>
                ))}
              </select>
            </label>

            <label>Allottee Name
              <input value={form.person_name} onChange={e=>onChange('person_name', e.target.value)} required/>
            </label>

            <label>Designation
              <input value={form.designation} onChange={e=>onChange('designation', e.target.value)} />
            </label>

            <label>BPS
              <input type="number" min="0" value={form.bps} onChange={e=>onChange('bps', e.target.value)} />
            </label>

            <label>Directorate
              <input value={form.directorate} onChange={e=>onChange('directorate', e.target.value)} />
            </label>

            <label>CNIC
              <input value={form.cnic} onChange={e=>onChange('cnic', e.target.value)} placeholder="xxxxx-xxxxxxx-x"/>
            </label>

            <label>Allotment Date
              <input type="date" value={form.allotment_date} onChange={e=>onChange('allotment_date', e.target.value)} />
            </label>

            <label>Date of Birth
              <input type="date" value={form.date_of_birth} onChange={e=>onChange('date_of_birth', e.target.value)} />
            </label>

            <label>Date of Retirement
              <input type="date" value={form.date_of_retirement} onChange={e=>onChange('date_of_retirement', e.target.value)} />
            </label>

            <label>Occupation Date
              <input type="date" value={form.occupation_date} onChange={e=>onChange('occupation_date', e.target.value)} />
            </label>

            <label>Vacation Date
              <input type="date" value={form.vacation_date} onChange={e=>onChange('vacation_date', e.target.value)} />
            </label>

            <label>Retention
              <select value={form.retention} onChange={e=>onChange('retention', e.target.value)}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>

            <label>Retention Last Date
              <input type="date" value={form.retention_last_date} onChange={e=>onChange('retention_last_date', e.target.value)} />
            </label>

            <label>Pool
              <input value={form.pool} onChange={e=>onChange('pool', e.target.value)} />
            </label>

            <label>Qtr Status
              <input value={form.qtr_status} onChange={e=>onChange('qtr_status', e.target.value)} />
            </label>

            <label>Allotment Medium
              <select value={form.allotment_medium} onChange={e=>onChange('allotment_medium', e.target.value)}>
                <option value="family transfer">family transfer</option>
                <option value="changes">changes</option>
                <option value="mutual">mutual</option>
                <option value="other">other</option>
              </select>
            </label>

            <label>Active
              <select value={form.active} onChange={e=>onChange('active', e.target.value)}>
                <option value="true">Active</option>
                <option value="false">Ended</option>
              </select>
            </label>

            <label>Notes
              <input value={form.notes} onChange={e=>onChange('notes', e.target.value)} />
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
            <th>Period (days)</th><th>Status</th><th>Action</th>
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
              <td>{it.date_of_birth || '-'}</td>
              <td>{it.date_of_retirement || '-'}</td>
              <td>{it.retention ? 'Yes' : 'No'}</td>
              <td>{it.retention_last_date || '-'}</td>
              <td>{it.occupation_date || '-'}</td>
              <td>{it.vacation_date || '-'}</td>
              <td>{it.pool || '-'}</td>
              <td>{it.qtr_status || '-'}</td>
              <td>{it.allotment_medium || '-'}</td>
              <td>{it.period_of_stay ?? '-'}</td>
              <td>{it.active ? 'Active' : 'Ended'}</td>
              <td>{it.active && <button onClick={()=>end(it.id)}>End</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
