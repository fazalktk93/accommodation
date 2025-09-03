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

  // new: options + confirmed house for the typed file number
  const [matchOptions, setMatchOptions] = useState([])
  const [selectedHouseId, setSelectedHouseId] = useState('')

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-'

  const load = () =>
    listMovements({
      outstanding: filter.outstanding === '' ? undefined : (filter.outstanding === 'true'),
      file_no: filter.file_no || undefined
    })
      .then(arr => setItems(Array.isArray(arr) ? arr : []))
      .catch(e => setError(e?.message || 'Failed to load'))

  useEffect(() => {
    load()
    listHouses().then(setHouses).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // recompute dropdown options whenever file_no or house list changes
  useEffect(() => {
    const q = String(form.file_no || '').trim().toLowerCase()
    if (!q) {
      setMatchOptions([])
      setSelectedHouseId('')
      return
    }
    const opts = (houses || []).filter(h =>
      String(h.file_no).toLowerCase().includes(q)
    )
    setMatchOptions(opts)
    if (!opts.find(h => String(h.id) === String(selectedHouseId))) {
      setSelectedHouseId('')
    }
  }, [form.file_no, houses])

  const search = (e) => { e.preventDefault(); load() }

  const issue = async (e) => {
    e.preventDefault()
    try{
      setError('')

      // ---- client-side guardrails (stop "auto-issue")
      if (!String(form.file_no || '').trim()) {
        setError('Enter a file number first.')
        return
      }
      if (!selectedHouseId) {
        setError('Please confirm the house for this file number from the dropdown.')
        return
      }
      if (!String(form.issued_to || '').trim()) {
        setError('Please fill “Issued To”.')
        return
      }

      const chosen = (houses || []).find(h => String(h.id) === String(selectedHouseId))
      if (!chosen) {
        setError('Selected house not found.')
        return
      }
      if (String(chosen.file_no) !== String(form.file_no)) {
        setError('Selected house does not match the typed file number.')
        return
      }

      await issueFile({
        ...form,
        file_no: chosen.file_no,     // trust the confirmed house’s file_no
        house_id: chosen.id,         // optional: helpful if backend accepts it
        due_date: form.due_date || null
      })

      // reset (keep file_no so you can issue more under same file)
      setForm(f => ({ ...f, subject:'', issued_to:'', department:'', due_date:'', remarks:'' }))
      await load()
    }catch(err){
      setError(err?.response?.data?.detail || err.message)
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

  const canIssue =
    String(form.file_no || '').trim() &&
    !!selectedHouseId &&
    String(form.issued_to || '').trim()

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
            <input
              value={form.file_no}
              onChange={e=>setForm({...form, file_no:e.target.value})}
              placeholder="e.g. ABC-123"
            />
            {matchOptions.length > 0 && (
              <select
                style={{ marginTop: 6, width: '100%' }}
                value={selectedHouseId}
                onChange={e=>setSelectedHouseId(e.target.value)}
              >
                <option value="">— Confirm house for this file —</option>
                {matchOptions.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.file_no} — Qtr {h.qtr_no}, Street {h.street}, Sector {h.sector}, Type {h.type_code}
                  </option>
                ))}
              </select>
            )}
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

        {/* button stays disabled until a house is confirmed + Issued To filled */}
        <div>
          <button type="submit" disabled={!canIssue}>
            Issue File
          </button>
        </div>
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
