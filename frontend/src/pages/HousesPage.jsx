import { useEffect, useState } from 'react'
import { listHouses, createHouse, deleteHouse, updateHouse } from '../api'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'   // ✅ added: to resolve id from file_no when needed

export default function HousesPage(){
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ status:'', type_code:'' })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ file_no:'', qtr_no:'', street:'', sector:'', type_code:'A', status:'available' })
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // ✅ smarter navigation: accepts id or the full item; resolves by file_no if needed
  const gotoAllotmentHistory = async (target) => {
    try {
      // target can be an id or the item itself
      let hid = typeof target === 'object' && target !== null ? target.id : target
      if (!hid || Number.isNaN(Number(hid))) {
        // try resolving by file_no (robust when callers passed file_no or wrong id)
        const fileNo = typeof target === 'object' && target ? target.file_no : undefined
        if (fileNo) {
          const { data } = await api.get(`/houses/by-file/${encodeURIComponent(fileNo)}`)
          hid = data?.id
        }
      }
      if (hid) navigate(`/houses/${hid}/allotments`)
    } catch (e) {
      console.error(e)
    }
  }

  const load = () => listHouses({
    q: q || undefined,
    status: filters.status || undefined,
    type_code: filters.type_code || undefined
  }).then(r => setItems(r)).catch(e => setError(e.message))
  useEffect(() => { load() }, [])  

  const search = (e) => { e.preventDefault(); load() }

  const submit = async (e) => {
    e.preventDefault()
    try {
      if(editing){
        await updateHouse(editing.id, form)
      }else{
        await createHouse(form)
      }
      setForm({ file_no:'', qtr_no:'', street:'', sector:'', type_code:'A', status:'available' })
      setEditing(null)
      setShowAdd(false)
      load()
    } catch(err){ setError(err.message) }
  }

  const onEdit = (it) => { setEditing(it); setForm({...it}); setShowAdd(true) }
  const onDelete = async (id) => { if(confirm('Delete house?')){ await deleteHouse(id); load() } }
  const gotoFileMovement = (file_no) => navigate(`/files?file_no=${encodeURIComponent(file_no)}`)

  return (
    <div>
      <h2>Houses</h2>
      {error && <div className="error">{error}</div>}

      <form className="filters" onSubmit={search}>
        <input placeholder="Search (file no / sector / street / qtr no)" value={q} onChange={e=>setQ(e.target.value)} />
        <select value={filters.type_code} onChange={e=>setFilters({...filters, type_code:e.target.value})}>
          <option value="">All Types</option>
          {"ABCDEFGH".split("").map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.status} onChange={e=>setFilters({...filters, status:e.target.value})}>
          <option value="">Any Status</option>
          {["available","vacant","occupied","reserved","maintenance","other"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit">Search</button>
        <button type="button" onClick={()=>setShowAdd(s=>!s)}>Add House</button>
      </form>

      {showAdd && (
        <form className="card" onSubmit={submit}>
          <h3>{editing ? 'Edit House' : 'Add House'}</h3>
          <div className="grid">
            <label>File No<input value={form.file_no} onChange={e=>setForm({...form, file_no:e.target.value})} required/></label>
            <label>Quarter No<input type="number" value={form.qtr_no} onChange={e=>setForm({...form, qtr_no:Number(e.target.value)})} required/></label>
            <label>Street<input value={form.street} onChange={e=>setForm({...form, street:e.target.value})} required/></label>
            <label>Sector<input value={form.sector} onChange={e=>setForm({...form, sector:e.target.value})} required/></label>
            <label>Type
              <select value={form.type_code} onChange={e=>setForm({...form, type_code:e.target.value})} required>
                {"ABCDEFGH".split("").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
                {["available","vacant","occupied","reserved","maintenance","other"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div>
            <button type="submit">{editing ? 'Update' : 'Save'}</button>{' '}
            {editing && <button type="button" onClick={()=>{setEditing(null); setShowAdd(false); setForm({ file_no:'', qtr_no:'', street:'', sector:'', type_code:'A', status:'available' })}}>Cancel</button>}
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>ID</th><th>File No</th><th>Qtr No</th><th>Street</th><th>Sector</th><th>Type</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>
                {/* ✅ pass the whole item; helper will use id or resolve by file_no */}
                <a href="#" onClick={(e)=>{e.preventDefault(); gotoAllotmentHistory(it)}}>
                  {it.file_no}
                </a>
              </td>
              <td>{it.qtr_no}</td>
              <td>{it.street}</td>
              <td>{it.sector}</td>
              <td>{it.type_code}</td>
              <td>{it.status}</td>
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
