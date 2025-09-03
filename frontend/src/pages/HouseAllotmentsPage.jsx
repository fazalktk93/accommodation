import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, createAllotment } from '../api'

// ---------- utils
const asList = (d) => (Array.isArray(d) ? d : (d?.results ?? []))
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
const RETIREMENT_AGE_YEARS = 60
const addYears = (isoDate, years) => {
  if (!isIsoDate(isoDate)) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y + years, m - 1, d))
  return dt.toISOString().slice(0, 10)
}

// ✅ Resolve house strictly by backend route: /houses/by-file/{file_no}
async function findHouseByFileNoStrict(fileNo) {
  const r = await api.get(`/houses/by-file/${encodeURIComponent(fileNo)}`)
  return r.data || null
}

// ✅ Load allotments via the nested endpoint that matches your backend: /houses/{id}/allotments
async function listAllotmentsByHouseIdNested(houseId) {
  const r = await api.get(`/houses/${houseId}/allotments`)
  // backend returns a plain list
  return Array.isArray(r.data) ? r.data : asList(r.data)
}

// (kept for compatibility if you ever need it elsewhere; not used in load now)
async function listAllotmentsByFileNoStrict(fileNo, extraParams = {}) {
  const r = await api.get('/allotments/', {
    params: { q: fileNo, ordering: '-allotment_date', ...extraParams },
  })
  const raw = asList(r.data)
  return raw.filter(it => {
    const fn = (it && it.house && it.house.file_no) || it?.file_no
    return String(fn) === String(fileNo)
  })
}

export default function HouseAllotmentsPage() {
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
    retention_last_date:'',
    pool:'', qtr_status:'', allotment_medium:'other',
    notes:''
  })

  const title = useMemo(() => 'House — Allotment History', [])

  async function load() {
    setLoading(true); setError('')
    try {
      // ✅ Resolve the house strictly by file number (authoritative)
      const h = await findHouseByFileNoStrict(fileNo)
      if (!h) throw new Error('House not found for the given file number')
      setHouse(h)

      // ✅ Load history via nested endpoint (authoritative)
      const list = await listAllotmentsByHouseIdNested(h.id)

      // If (for any reason) nested returns empty but you know there is history,
      // you could fallback to listAllotmentsByFileNoStrict(fileNo) here.
      setHistory(list)
    } catch (e) {
      setError(e?.message || 'Failed to load')
      setHouse(null)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [fileNo])

  const onChange = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'date_of_birth') {
        next.date_of_retirement = addYears(v, RETIREMENT_AGE_YEARS)
      }
      return next
    })
  }

  async function submit(e){
    e.preventDefault()
    if (!house) return
    setSaving(true); setError('')
    try {
      const payload = {
        house_id: Number(house.id),
        person_name: (form.person_name || '').trim() || null,
        designation: form.designation || null,
        bps: form.bps ? Number(form.bps) : null,
        directorate: form.directorate || null,
        cnic: form.cnic || null,
        allotment_date: form.allotment_date || null,
        dob: form.date_of_birth || null,
        dor: form.date_of_retirement || null,
        occupation_date: form.occupation_date || null,
        vacation_date: form.vacation_date || null,
        retention_last: form.retention_last_date || null,
        pool: form.pool || null,
        qtr_status: form.qtr_status || null,
        medium: form.allotment_medium || 'other',
        notes: form.notes || null,
      }

      // Auto-end any active allotment for this house
      await createAllotment(payload, { forceEndPrevious: true })

      // reset + reload view
      setForm({
        person_name:'', designation:'', bps:'', directorate:'', cnic:'',
        allotment_date:'', date_of_birth:'', date_of_retirement:'',
        occupation_date:'', vacation_date:'',
        retention_last_date:'',
        pool:'', qtr_status:'', allotment_medium:'other',
        notes:''
      })
      setOpenForm(false)
      await load()
    } catch (e) {
      setError(e?.message || 'Save failed')
    } finally {
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

      {/* HISTORY */}
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
                <th>Pool</th>
                <th>Qtr Status</th>
                <th>Medium</th>
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
                  <td>{it.medium || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD FORM */}
      {openForm && (
        <form className="card" onSubmit={submit}>
          <h3>Add Allotment</h3>
          <div className="grid">
            <label>Allottee Name
              <input value={form.person_name} onChange={e=>onChange('person_name', e.target.value)} required/>
            </label>
            <label>Designation
              <input value={form.designation} onChange={e=>onChange('designation', e.target.value)} />
            </label>
            <label>BPS
              <input type="number" value={form.bps} onChange={e=>onChange('bps', e.target.value)} />
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
            <label>DOB
              <input type="date" value={form.date_of_birth} onChange={e=>onChange('date_of_birth', e.target.value)} />
            </label>
            <label>DOR (auto)
              <input type="date" value={form.date_of_retirement} onChange={e=>onChange('date_of_retirement', e.target.value)} />
            </label>
            <label>Occupation
              <input type="date" value={form.occupation_date} onChange={e=>onChange('occupation_date', e.target.value)} />
            </label>
            <label>Vacation
              <input type="date" value={form.vacation_date} onChange={e=>onChange('vacation_date', e.target.value)} />
            </label>
            <label>Retention Last
              <input type="date" value={form.retention_last_date} onChange={e=>onChange('retention_last_date', e.target.value)} />
            </label>
            <label>Pool
              <input value={form.pool} onChange={e=>onChange('pool', e.target.value)} />
            </label>
            <label>Qtr Status
              <input value={form.qtr_status} onChange={e=>onChange('qtr_status', e.target.value)} />
            </label>
            <label>Medium
              <select value={form.allotment_medium} onChange={e=>onChange('allotment_medium', e.target.value)}>
                <option value="family transfer">family transfer</option>
                <option value="changes">changes</option>
                <option value="mutual">mutual</option>
                <option value="other">other</option>
              </select>
            </label>
            <label>Notes
              <input value={form.notes} onChange={e=>onChange('notes', e.target.value)} />
            </label>
          </div>
          <div><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Allotment'}</button></div>
        </form>
      )}
    </div>
  )
}
