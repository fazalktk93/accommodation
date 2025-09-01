import { useEffect, useState } from 'react'
import { listHouses, createHouse, deleteHouse, updateHouse } from '../api'
import { useNavigate } from 'react-router-dom'

export default function HousesPage(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ file_no:'', qtr_no:'', sector:'' })
  const [editing, setEditing] = useState(null)
  const navigate = useNavigate()

  const load = () => listHouses().then(r => setItems(r.data))
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (editing){
      await updateHouse(editing.id, form)
      setEditing(null)
    } else {
      await createHouse(form)
    }
    setForm({ file_no:'', qtr_no:'', sector:'' }); load()
  }

  const onEdit = (it) => { setEditing(it); setForm({ file_no: it.file_no, qtr_no: it.qtr_no, sector: it.sector }) }
  const onDelete = async (id) => { if(confirm('Delete?')){ await deleteHouse(id); load() } }

  const gotoFileMovement = (fileNo) => {
    navigate(`/files?file_code=${encodeURIComponent(fileNo)}`)
  }

  return (
    <div className="card">
      <h1>Accommodation</h1>
      <form onSubmit={submit} style={{display:'grid', gap:'.5rem', gridTemplateColumns:'1fr 2fr 1fr auto'}}>
        <input placeholder="File No" value={form.file_no} onChange={e=>setForm({...form, file_no:e.target.value})} required />
        <input placeholder="Qtr No"  value={form.qtr_no} onChange={e=>setForm({...form, qtr_no:e.target.value})} required />
        <input placeholder="Sector"  value={form.sector} onChange={e=>setForm({...form, sector:e.target.value})} required />
        <button className="btn" type="submit">{editing ? 'Update' : 'Add'}</button>
      </form>

      <table className="table">
        <thead><tr><th>#</th><th>File No</th><th>Qtr No</th><th>Sector</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>
                <a href="#" onClick={(e)=>{e.preventDefault(); gotoFileMovement(it.file_no)}}>
                  {it.file_no}
                </a>
              </td>
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
