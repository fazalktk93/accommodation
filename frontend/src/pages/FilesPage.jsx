import { useEffect, useState } from 'react'
import { listMovements, issueFile, returnFile } from '../api'

export default function FilesPage(){
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState({ outstanding: 'true', file_code:'' })
  const [form, setForm] = useState({ file_code:'', subject:'', issued_to:'', department:'', due_date:'', remarks:'' })

  const load = () => listMovements({
    outstanding: filter.outstanding === '' ? undefined : filter.outstanding,
    file_code: filter.file_code || undefined
  }).then(r => setItems(r.data))

  useEffect(() => { load() }, [filter])

  const submit = async (e) => {
    e.preventDefault()
    await issueFile({ ...form, due_date: form.due_date || null })
    setForm({ file_code:'', subject:'', issued_to:'', department:'', due_date:'', remarks:'' })
    load()
  }

  const ret = async (id) => {
    if(confirm('Mark file as returned?')){ await returnFile(id, { remarks: 'Returned via UI' }); load() }
  }

  return (
    <div className="card">
      <h1>File Movement</h1>

      <div className="card">
        <h2>Issue a File</h2>
        <form onSubmit={submit} style={{display:'grid', gap:'.5rem', gridTemplateColumns:'repeat(6, 1fr)'}}>
          <input placeholder="File code" value={form.file_code} onChange={e=>setForm({...form, file_code:e.target.value})} required/>
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
          <input placeholder="File code" value={filter.file_code} onChange={e=>setFilter({...filter, file_code: e.target.value})}/>
        </div>
      </div>

      <table className="table">
        <thead><tr><th>#</th><th>File</th><th>Issued To</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td><strong>{it.file_code}</strong><div style={{fontSize:'.85rem', color:'#555'}}>{it.subject}</div></td>
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
