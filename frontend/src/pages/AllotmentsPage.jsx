import { useEffect, useState } from 'react'
import { listHouses, listAllotments, createAllotment, endAllotment } from '../api'

export default function AllotmentsPage(){
  const [houses, setHouses] = useState([])
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ person_name:'', person_contact:'', house_id:'', notes:'' })
  const [filter, setFilter] = useState({ house_id:'', active:'true' })

  const load = () => listAllotments({
    house_id: filter.house_id || undefined,
    active: filter.active === '' ? undefined : filter.active
  }).then(r => setItems(r.data))

  useEffect(() => { listHouses().then(r=>setHouses(r.data)) }, [])
  useEffect(() => { load() }, [filter])

  const submit = async (e) => {
    e.preventDefault()
    await createAllotment({ ...form, house_id: Number(form.house_id) })
    setForm({ person_name:'', person_contact:'', house_id:'', notes:'' })
    load()
  }

  const end = async (id) => {
    if(confirm('Mark as ended?')){ await endAllotment(id, 'Ended via UI'); load() }
  }

  return (
    <div className="card">
      <h1>Allotments</h1>

      <div className="card">
        <h2>New Allotment</h2>
        <form onSubmit={submit} style={{display:'grid', gap:'.5rem', gridTemplateColumns:'1fr 1fr 1fr auto'}}>
          <input placeholder="Person name" value={form.person_name} onChange={e=>setForm({...form, person_name:e.target.value})} required/>
          <input placeholder="Contact" value={form.person_contact} onChange={e=>setForm({...form, person_contact:e.target.value})} />
          <select value={form.house_id} onChange={e=>setForm({...form, house_id:e.target.value})} required>
            <option value="">Select house</option>
            {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button className="btn">Create</button>
        </form>
        <textarea placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
      </div>

      <div className="card">
        <h2>Filter</h2>
        <div style={{display:'flex', gap:'.5rem'}}>
          <select value={filter.house_id} onChange={e=>setFilter({...filter, house_id:e.target.value})}>
            <option value="">All houses</option>
            {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={filter.active} onChange={e=>setFilter({...filter, active:e.target.value})}>
            <option value="true">Active</option>
            <option value="false">Ended</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      <table className="table">
        <thead><tr><th>#</th><th>Person</th><th>House</th><th>Start</th><th>End</th><th></th></tr></thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.person_name} {it.person_contact ? <span className="badge">{it.person_contact}</span> : null}</td>
              <td>{houses.find(h=>h.id===it.house_id)?.name || it.house_id}</td>
              <td>{new Date(it.start_date).toLocaleString()}</td>
              <td>{it.end_date ? new Date(it.end_date).toLocaleString() : <span className="badge">Active</span>}</td>
              <td>{!it.end_date && <button onClick={()=>end(it.id)}>End</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
