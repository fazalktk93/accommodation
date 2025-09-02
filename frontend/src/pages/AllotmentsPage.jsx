import { useEffect, useState } from 'react'
import { listAllotments } from '../api'

export default function AllotmentsPage(){
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState({ person_name:'', file_no:'', qtr_no:'', active:'true' })
  const [error, setError] = useState('')

  const search = (e) => {
    e && e.preventDefault()
    const params = {
      person_name: filter.person_name || undefined,
      file_no: filter.file_no || undefined,
      qtr_no: filter.qtr_no || undefined,
      active: filter.active === '' ? undefined : filter.active,
    }
    listAllotments(params).then(r => setItems(r.data)).catch(e => setError(e.message))
  }

  useEffect(() => { search() }, [])

  return (
    <div>
      <h2>Allotments</h2>
      {error && <div className="error">{error}</div>}

      <form className="filters" onSubmit={search}>
        <input placeholder="Allottee name" value={filter.person_name} onChange={e=>setFilter({...filter, person_name:e.target.value})}/>
        <input placeholder="House File No" value={filter.file_no} onChange={e=>setFilter({...filter, file_no:e.target.value})}/>
        <input placeholder="Quarter No" value={filter.qtr_no} onChange={e=>setFilter({...filter, qtr_no:e.target.value})}/>
        <select value={filter.active} onChange={e=>setFilter({...filter, active:e.target.value})}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Ended</option>
        </select>
        <button type="submit">Search</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>ID</th><th>Allottee</th><th>CNIC</th><th>File No</th><th>Qtr No</th>
            <th>Occupation</th><th>Vacation</th><th>Period (days)</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.id}</td>
              <td>{it.person_name}</td>
              <td>{it.cnic || '-'}</td>
              <td>{it.house_file_no || '-'}</td>
              <td>{it.house_qtr_no || '-'}</td>
              <td>{it.start_date}</td>
              <td>{it.end_date || '-'}</td>
              <td>{it.period_of_stay ?? '-'}</td>
              <td>{it.active ? 'Active' : 'Ended'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
