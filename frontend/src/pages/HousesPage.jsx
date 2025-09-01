import { useEffect, useState } from 'react'
import { listHouses, createHouse, deleteHouse, updateHouse } from '../api'
import { useNavigate } from 'react-router-dom'

export default function HousesPage(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ file_no:'', qtr_no:'', sector:'' })
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () => listHouses().then(r => setItems(r.data)).catch(e => setError(e?.response?.data?.detail || e.message))
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editing) { await updateHouse(editing.id, form); setEditing(null) }
      else { await createHouse(form) }
      setForm({ file_no:'', qtr_no:'', sector:'' })
      load()
    } catch (err) { setError(err?.response?.data?.detail || err.message) }
  }

  const onEdit = (it) => { setEditing(it); setForm({ file_no: it.file_no, qtr_no: it.qtr_no, sector: it.sector }) }
  const onDelete = async (id) => { if(confirm('Delete?')){ await deleteHouse(id); load() } }
  const gotoFileMovement = (fileNo) => navigate(`/files?file_no=${encodeURIComponent(fileNo)}`)

  return (
    <div className="card">
      <h1>Accommodation</h1>
      {error && <div style={{background:'#fee2e2',padding:8,border:'1px solid #fecaca',borderRadius:6,marginBottom:10}}>{error}</div>}
      <form onSubmit={submit} style={{display:'grid', gap:'.5rem', gridTemplateColumns:'repeat(4, 1fr)'}}>
        <input placeholder="File No" value={form.file_no} onChange={e=>setForm({...form, file_no:e.target.value})} required />
        <input placeholder="Qtr No"  value={form.qtr_no} onChange={e=>setForm({...form, qtr_no:e.target.value})} required />
        <input placeholder="Sector"  value={form.sector} onChange={e=>setForm({...form, sector:e.target.value})} required />
        <button className="btn" type="submit">{editing ? 'Update' : 'Add'}</button>
      </form>

      <table className="table" style={{marginTop:12}}>
        <thead><tr><th>#</th><th>File No</th><th>Qtr No</th><th>Sector</th><th>Actions</th></tr></thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={5} style={{color:'#6b7280'}}>No accommodation yet</td></tr>}
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td><a href="#" onClick={(e)=>{e.preventDefault(); gotoFileMovement(it.file_no)}}>{it.file_no}</a></td>
              <td>{it.qtr_no}</td>
              <td>{it.sector}</td>
              <td>
                <button onClick={()=>onEdit(it)}>Edit</button>{' '}
                <button onClick={()=>onDelete(it.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
