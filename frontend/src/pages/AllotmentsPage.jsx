import { useEffect, useState } from 'react'
import { listHouses, listAllotments, createAllotment, endAllotment } from '../api'

export default function AllotmentsPage(){
  const [houses, setHouses] = useState([])
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState({ house_id:'', active:'true' })
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    file_no: '',  // we send file_no instead of house_id
    allottee_name: '',
    designation: '',
    bps: '',
    directorate: '',
    cnic: '',
    allotment_date: '',
    date_of_birth: '',
    pool: '',
    qtr_status: '',
    accommodation_type: '',
    occupation_date: '',
    allotment_medium: '',
    vacation_date: '',
    notes: ''
  })

  const load = () => listAllotments({
    house_id: filter.house_id || undefined,
    active: filter.active === '' ? undefined : filter.active
  }).then(r => setItems(r.data)).catch(e => setError(e?.response?.data?.detail || e.message))

  useEffect(() => { listHouses().then(r=>setHouses(r.data)); }, [])
  useEffect(() => { load() }, [filter])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        ...form,
        bps: form.bps ? Number(form.bps) : null,
        allotment_date: form.allotment_date || null,
        date_of_birth: form.date_of_birth || null,
        occupation_date: form.occupation_date || null,
        vacation_date: form.vacation_date || null
      }
      await createAllotment(payload)
      setForm({
        file_no: '', allottee_name:'', designation:'', bps:'', directorate:'', cnic:'',
        allotment_date:'', date_of_birth:'', pool:'', qtr_status:'', accommodation_type:'',
        occupation_date:'', allotment_medium:'', vacation_date:'', notes:''
      })
      load()
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const end = async (id) => {
    if(confirm('Mark as vacated/ended?')){
      await endAllotment(id, 'Ended via UI')
      load()
    }
  }

  return (
    <div className="card">
      <h1>Allotments</h1>
      {error && <div style={{background:'#fee2e2',padding:8,border:'1px solid #fecaca',borderRadius:6,marginBottom:10}}>{error}</div>}

      <div className="card">
        <h2>New Allotment</h2>
        <form onSubmit={submit} style={{display:'grid', gap:'.5rem', gridTemplateColumns:'repeat(4, 1fr)'}}>
          <select value={form.file_no} onChange={e=>setForm({...form, file_no:e.target.value})} required>
            <option value="">File No</option>
            {houses.map(h => <option key={h.id} value={h.file_no}>{h.file_no} — {h.qtr_no} — {h.sector}</option>)}
          </select>
          <input placeholder="Allottee Name" value={form.allottee_name} onChange={e=>setForm({...form, allottee_name:e.target.value})} required/>
          <input placeholder="Designation" value={form.designation} onChange={e=>setForm({...form, designation:e.target.value})}/>
          <input placeholder="BPS" type="number" value={form.bps} onChange={e=>setForm({...form, bps:e.target.value})}/>

          <input placeholder="Directorate" value={form.directorate} onChange={e=>setForm({...form, directorate:e.target.value})}/>
          <input placeholder="CNIC" value={form.cnic} onChange={e=>setForm({...form, cnic:e.target.value})}/>
          <label>Allotment Date<input type="date" value={form.allotment_date} onChange={e=>setForm({...form, allotment_date:e.target.value})} required/></label>
          <label>Date of Birth<input type="date" value={form.date_of_birth} onChange={e=>setForm({...form, date_of_birth:e.target.value})} required/></label>

          <input placeholder="Pool" value={form.pool} onChange={e=>setForm({...form, pool:e.target.value})}/>
          <input placeholder="Qtr Status" value={form.qtr_status} onChange={e=>setForm({...form, qtr_status:e.target.value})}/>
          <input placeholder="Accommodation Type" value={form.accommodation_type} onChange={e=>setForm({...form, accommodation_type:e.target.value})}/>
          <label>Occupation Date<input type="date" value={form.occupation_date} onChange={e=>setForm({...form, occupation_date:e.target.value})}/></label>

          <input placeholder="Allotment Medium" value={form.allotment_medium} onChange={e=>setForm({...form, allotment_medium:e.target.value})}/>
          <label>Vacation Date<input type="date" value={form.vacation_date} onChange={e=>setForm({...form, vacation_date:e.target.value})}/></label>
          <textarea placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} style={{gridColumn:'span 2'}}/>
          <button className="btn" style={{gridColumn:'span 4'}}>Create</button>
        </form>
      </div>

      <div className="card">
        <h2>Filter</h2>
        <div style={{display:'flex', gap:'.5rem'}}>
          <select value={filter.house_id} onChange={e=>setFilter({...filter, house_id:e.target.value})}>
            <option value="">All houses</option>
            {houses.map(h => <option key={h.id} value={h.id}>{h.file_no} — {h.qtr_no} — {h.sector}</option>)}
          </select>
          <select value={filter.active} onChange={e=>setFilter({...filter, active:e.target.value})}>
            <option value="true">Active</option>
            <option value="false">Ended</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>#</th><th>File No</th><th>Allottee</th><th>Dir/BPS</th><th>CNIC</th>
            <th>Allotment</th><th>DOB</th><th>Superannuation</th>
            <th>Pool</th><th>Qtr Status</th><th>Acc. Type</th>
            <th>Occupation</th><th>Vacation</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={15} style={{color:'#6b7280'}}>No allotments</td></tr>}
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{houses.find(h=>h.id===it.house_id)?.file_no || '-'}</td>
              <td>{it.allottee_name}</td>
              <td>{it.directorate || '-'} / {it.bps || '-'}</td>
              <td>{it.cnic || '-'}</td>
              <td>{it.allotment_date}</td>
              <td>{it.date_of_birth}</td>
              <td><strong>{it.superannuation_date}</strong></td>
              <td>{it.pool || '-'}</td>
              <td>{it.qtr_status || '-'}</td>
              <td>{it.accommodation_type || '-'}</td>
              <td>{it.occupation_date || '-'}</td>
              <td>{it.vacation_date || '-'}</td>
              <td>{it.active ? 'Active' : 'Ended'}</td>
              <td>{it.active && <button onClick={()=>end(it.id)}>End</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
