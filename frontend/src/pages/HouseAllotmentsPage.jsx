import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getHouseByFile,
  listAllotmentHistoryByFile,
  createAllotment,
} from '../api'

export default function HouseAllotmentsPage(){
  const { fileNo } = useParams()
  const [house, setHouse] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    person_name:'', designation:'', bps:'', directorate:'', cnic:'',
    allotment_date:'', date_of_birth:'', date_of_retirement:'',
    occupation_date:'', vacation_date:'',
    retention:'false', retention_last_date:'',
    pool:'', qtr_status:'', allotment_medium:'other',
    active:'true', notes:''
  })

  const title = useMemo(() => `House — Allotment History`, [])

  async function load(){
    setLoading(true); setError('')
    try{
      const [h, hist] = await Promise.all([
        getHouseByFile(fileNo),
        listAllotmentHistoryByFile(fileNo),
      ])
      setHouse(h.data)
      setHistory(hist.data || [])
    }catch(err){
      setError(err.message || 'Failed to load')
    }finally{
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [fileNo])

  const onChange = (k,v) => setForm(f => ({...f, [k]: v}))

  async function submit(e){
    e.preventDefault()
    if(!house) return
    setSaving(true); setError('')
    try{
      const payload = {
        house_id: Number(house.id),
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
        notes: form.notes || null,
      }
      await createAllotment(payload)
      // reset form, close it, and refresh history
      setForm({
        person_name:'', designation:'', bps:'', directorate:'', cnic:'',
        allotment_date:'', date_of_birth:'', date_of_retirement:'',
        occupation_date:'', vacation_date:'',
        retention:'false', retention_last_date:'',
        pool:'', qtr_status:'', allotment_medium:'other',
        active:'true', notes:''
      })
      setOpenForm(false)
      await load()
    }catch(err){
      setError(err.message || 'Save failed')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div>
      <h2>{title}</h2>
      {error && <div className="error">{error}</div>}

      <div style={{marginBottom:'.75rem'}}>
        <Link to="/">← Back to Houses</Link>
      </div>

      {loading && <div>Loading…</div>}

      {house && (
        <div className="card" style={{marginBottom:'1rem'}}>
          <div><strong>File No:</strong> {house.file_no}</div>
          <div><strong>Quarter:</strong> {house.qtr_no}</div>
          <div><strong>Street:</strong> {house.street} &nbsp; <strong>Sector:</strong> {house.sector}</div>
          <div><strong>Type:</strong> {house.type_code} &nbsp; <strong>Status:</strong> {house.status}</div>
        </div>
      )}

      {/* HISTORY FIRST */}
      <div className="card" style={{marginBottom:'1rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.5rem'}}>
          <h3 style={{margin:0}}>Previous Allotments</h3>
          <button type="button" onClick={()=>setOpenForm(s=>!s)}>
            {openForm ? 'Close Form' : 'Add Allotment'}
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{padding:'.5rem 0'}}>No allotment history yet for this house.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Allottee</th><th>Designation</th><th>Directorate</th><th>CNIC</th>
                <th>Allotment</th><th>Occupation</th><th>Vacation</th><th>Period (days)</th>
                <th>Pool</th><th>Qtr Status</th><th>Medium</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(it => (
                <tr key={it.id}>
                  <td>{it.person_name}</td>
                  <td>{it.designation || '-'}</td>
                  <td>{it.directorate || '-'}</td>
                  <td>{it.cnic || '-'}</td>
                  <td>{it.allotment_date || '-'}</td>
                  <td>{it.occupation_date || '-'}</td>
                  <td>{it.vacation_date || '-'}</td>
                  <td>{it.period_of_stay ?? '-'}</td>
                  <td>{it.pool || '-'}</td>
                  <td>{it.qtr_status || '-'}</td>
                  <td>{it.allotment_medium || '-'}</td>
                  <td>{it.active ? 'Active' : 'Ended'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD FORM (collapsed by default) */}
      {openForm && (
        <form className="card" onSubmit={submit}>
          <h3>Add Allotment</h3>
          <div className="grid">
            <label>Allottee Name<input value={form.person_name} onChange={e=>onChange('person_name', e.target.value)} required/></label>
            <label>Designation<input value={form.designation} onChange={e=>onChange('designation', e.target.value)} /></label>
            <label>BPS<input type="number" value={form.bps} onChange={e=>onChange('bps', e.target.value)} /></label>
            <label>Directorate<input value={form.directorate} onChange={e=>onChange('directorate', e.target.value)} /></label>
            <label>CNIC<input value={form.cnic} onChange={e=>onChange('cnic', e.target.value)} placeholder="xxxxx-xxxxxxx-x"/></label>
            <label>Allotment Date<input type="date" value={form.allotment_date} onChange={e=>onChange('allotment_date', e.target.value)} /></label>
            <label>DOB<input type="date" value={form.date_of_birth} onChange={e=>onChange('date_of_birth', e.target.value)} /></label>
            <label>DOR<input type="date" value={form.date_of_retirement} onChange={e=>onChange('date_of_retirement', e.target.value)} /></label>
            <label>Occupation<input type="date" value={form.occupation_date} onChange={e=>onChange('occupation_date', e.target.value)} /></label>
            <label>Vacation<input type="date" value={form.vacation_date} onChange={e=>onChange('vacation_date', e.target.value)} /></label>
            <label>Retention<select value={form.retention} onChange={e=>onChange('retention', e.target.value)}><option value="false">No</option><option value="true">Yes</option></select></label>
            <label>Retention Last<input type="date" value={form.retention_last_date} onChange={e=>onChange('retention_last_date', e.target.value)} /></label>
            <label>Pool<input value={form.pool} onChange={e=>onChange('pool', e.target.value)} /></label>
            <label>Qtr Status<input value={form.qtr_status} onChange={e=>onChange('qtr_status', e.target.value)} /></label>
            <label>Medium<select value={form.allotment_medium} onChange={e=>onChange('allotment_medium', e.target.value)}>
              <option value="family transfer">family transfer</option>
              <option value="changes">changes</option>
              <option value="mutual">mutual</option>
              <option value="other">other</option>
            </select></label>
            <label>Active<select value={form.active} onChange={e=>onChange('active', e.target.value)}><option value="true">Active</option><option value="false">Ended</option></select></label>
            <label>Notes<input value={form.notes} onChange={e=>onChange('notes', e.target.value)} /></label>
          </div>
          <div><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Allotment'}</button></div>
        </form>
      )}
    </div>
  )
}
