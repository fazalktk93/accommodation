import { useEffect, useState } from 'react'
import { listMovements, issueFile, returnFile, listHouses } from '../api'
import { useLocation } from 'react-router-dom'

function useQuery(){ const { search } = useLocation(); return new URLSearchParams(search) }

export default function FilesPage(){
  const query = useQuery()
  const initialCode = query.get('file_no') || ''

  const [items, setItems] = useState([])
  const [houses, setHouses] = useState([])
  const [filter, setFilter] = useState({ outstanding: 'true', file_no: initialCode })
  const [form, setForm] = useState({ file_no: initialCode, subject:'', issued_to:'', department:'', due_date:'', remarks:'' })
  const [error, setError] = useState('')

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-'

  // NOTE: listMovements() (from api.js) returns the data array directly
  const load = () =>
    listMovements({
      outstanding: filter.outstanding === '' ? undefined : (filter.outstanding === 'true'),
      file_no: filter.file_no || undefined
    })
      .then(arr => setItems(Array.isArray(arr) ? arr : []))
      .catch(e => setError(e?.message || 'Failed to load'))

  useEffect(() => {
    load()
    // listHouses() also returns data directly per updated api.js
    listHouses().then(setHouses).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = (e) => { e.preventDefault(); load() }

  const issue = async (e) => {
    e.preventDefault()
    try{
      setError('')
      await issueFile({
        ...form,
        // ensure empty strings don't break date parsing
        due_date: form.due_date || null
      })
      setForm({ file_no:'', subject:'', issued_to:'', department:'', due_date:'', remarks:'' })
      load()
    }catch(err){
      setError(err.message)
    }
  }

  const ret = async (id) => {
    try{
      setError('')
      await returnFile(id) // optional returned_date param, omitted => today
      load()
    }catch(err){
      setError(err.message)
    }
  }

  return (
    <div>
      <h2>File Movement</h2>
      {error && <div className="error">{error}</div>}

      <form className="filters" onSubmit={search}>
        <input
          placeholder="File No"
          value={filter.file_no}
          onChange={e=>setFilter({...filter, file_no:e.target.value})}
        />
        <select
          value={filter.outstanding}
          onChange={e=>setFilter({...filter, outstanding:e.target.value})}
        >
          <option value="">All</option>
          <option value="true">Outstanding Only</option>
          <option value="false">Include Returned</option>
        </select>
        <button type="submit">Search</button>
      </form>

      <form className="card" onSubmit={issue}>
        <h3>Issue File</h3>
        <div className="grid">
          <label>File No
            <input value={form.file_no} onChange={e=>setForm({...form, file_no:e.target.value})} placeholder="e.g. ABC-123"/>
          </label>
          <label>Subject
            <input value={form.subject} onChange={e=>setForm({...form, subject:e.target.value})}/>
          </label>
          <label>Issued To
            <input value={form.issued_to} onChange={e=>setForm({...form, issued_to:e.target.value})}/>
          </label>
          <label>Department
            <input value={form.department} onChange={e=>setForm({...form, department:e.target.value})}/>
          </label>
          <label>Due Date
            <input type="date" value={form.due_date} onChange={e=>setForm({...form, due_date:e.target.value})}/>
          </label>
          <label>Remarks
            <input value={form.remarks} onChange={e=>setForm({...form, remarks:e.target.value})}/>
          </label>
        </div>
        <div><button type="submit">Issue File</button></div>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>ID</th><th>File No</th><th>Issued To</th><th>Issue Date</th><th>Due</th><th>Status</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.file_no}</td>
              <td>{it.issued_to}{it.department ? ` (${it.department})` : ''}</td>
              <td>{fmtDate(it.issue_date)}</td>
              <td>{fmtDate(it.due_date)}</td>
              <td>{it.returned_date ? 'Returned' : 'Issued'}</td>
              <td>{!it.returned_date && <button onClick={()=>ret(it.id)}>Mark In-Record</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
