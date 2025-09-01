import { useEffect, useState } from 'react'
import { listHouses, createHouse, deleteHouse, updateHouse } from '../api'

export default function HousesPage(){
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name:'', address:'' })
  const [editing, setEditing] = useState(null)

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
    setForm({ name:'', address:'' }); load()
  }

  const onEdit = (it) => { setEditing(it); setForm({ name: it.name, address: it.address || '' }) }
  const onDelete = async (id) => { if(confirm('Delete?')){ await deleteHouse(id); load() } }

  return (
    <div className="card">
      <h1>Houses</h1>
      <form onSubmit={submit} style={{display:'grid', gap:'.5rem', gridTemplateColumns:'1fr 2fr auto'}}>
        <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
        <input placeholder="Address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} />
        <button className="btn" type="submit">{editing ? 'Update' : 'Add'}</button>
      </form>

      <table className="table">
        <thead><tr><th>#</th><th>Name</th><th>Address</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.name}</td>
              <td>{it.address || '-'}</td>
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
