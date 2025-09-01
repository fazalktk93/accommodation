import { useEffect, useState } from 'react'
import { listMovements, issueFile, returnFile, listHouses } from '../api'
import { useLocation } from 'react-router-dom'

function useQuery(){
  const { search } = useLocation()
  return new URLSearchParams(search)
}

export default function FilesPage(){
  const query = useQuery()
  const initialCode = query.get('file_no') || ''

  const [items, setItems] = useState([])
  const [houses, setHouses] = useState([])
  const [filter, setFilter] = useState({ outstanding: 'true', file_no: initialCode })
  const [form, setForm] = useState({ file_no: initialCode, subject:'', issued_to:'', department:'', due_date:'', remarks:'' })
  const [error, setError] = useState('')

  const load = () => listMovements({
    outstanding: filter.outstanding === '' ? undefined : filter.outstanding,
    file_no: filter.file_no || undefined
  }).then(r => setItems(r.data)).catch(e => setError(e?.response?.data?.detail || e.message))

  useEffect(() => { listHouses().then(r=>setHouses(r.data)); }, [])
  useEffect(() => { load() }, [filter])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await issueFile({ ...form, due_date: form.due_date || null })
      setForm({ file_no: form.file_no, subject:'', issued_to:'', department:'', due_date:'', remarks:'' })
      load()
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const ret = async (id) => {
    if(confirm('Mark file as returned?')){
      await returnFile(id, { remarks: 'Returned via UI' })
      load()
    }
  }

  return (
    <div className="card">
      <h1>File Movement</h1>
      {error && <div style={{background:'#fee2e2',padding:8,border:'1px solid #fecaca',borderRadius:6,marginBottom:10}}>{error}</div>}

      <div className="card">
        <h2>Issue a File</h2>
        <form onSubmit={submit} style={{display:'grid', gap:'.5rem', gridTemplateColumns:'repeat(6, 1fr)'}}>
          <select value={form.file_no} onChange={e=>setForm({...form, file_no:e.target.value})} required>
            <option value="">File No</option>
            {houses.map(h => <option key={h.id} value={h.file_no}>{h.file_no} — {h.qtr_no} — {h.sector}</option>)}
          </select>
          <input placeholder="Subject" value={form.subject} onChange={e=>setForm({...form, subject:e.target.value})} />
          <input placeholder="Issued to" value={form.issued_to} onChange={e=>setForm({...form, issued_to:e.target.value})} required/>
          <input placeholder="Department" value={form.department} onChange={e=>setForm({...form, department:e.target.value})} />
          <input type="datetime-local" placeholder="Due date" value={form.due_date} onChange={e=>setForm({...form, due_date:e.target.value})}/>
          <button className="btn">Issue</button>
        </form>
        <textarea placeholder="Remarks (optional)" value={form.remarks} onChange={e=>setForm({...form, remarks:e.target.value})}/>
      </div>

      <div className="card">
        <h2>Filter</h2>
        <div style={{display:'flex', gap:'.5rem'}}>
          <select value={filter.outstanding} onChange={e=>setFilter({...filter, outstanding: e.target.value})}>
            <option value="true">Outstanding</option>
            <option value="false">Returned</option>
            <option value="">All</option>
          </select>
          <select value={filter.file_no} onChange={e=>setFilter({...filter, file_no: e.target.value})}>
            <option value="">All files</option>
            {houses.map(h => <option key={h.id} value={h.file_no}>{h.file_no} — {h.qtr_no} — {h.sector}</option>)}
          </select>
        </div>
      </div>

      <table className="table">
        <thead><tr><th>#</th><th>File No</th><th>Issued To</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={7} style={{color:'#6b7280'}}>No file movements</td></tr>}
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.file_no}</td>
              <td>{it.issued_to}{it.department ? ` (${it.department})` : ''}</td>
              <td>{new Date(it.issue_date).toLocaleString()}</td>
              <td>{it.due_date ? new Date(it.due_date).toLocaleString() : '-'}</td>
              <td>{it.return_date ? 'Returned' : 'Issued'}</td>
              <td>{!it.return_date && <button onClick={()=>ret(it.id)}>Mark Returned</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
