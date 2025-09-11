import { useEffect, useState } from 'react'
import { createHouse, deleteHouse, updateHouse, listHouses } from '../api'
import { useNavigate, Link } from 'react-router-dom'
import { hasPerm } from '../authz'
import Modal from '../components/Modal'

function pad(n){ return String(n).padStart(2,'0') }
const toDateInput = (d) => {
  if (!d) return ''
  const x = new Date(d)
  if (isNaN(x)) return ''
  return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`
}

export default function HousesPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [hasNext, setHasNext] = useState(false)

  // modal
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)

  const gotoAllotmentHistory = (fileNo) => {
    if (fileNo) navigate(`/houses/${encodeURIComponent(fileNo)}/allotments`)
  }

  async function load(nextPage = 1) {
    try {
      setLoading(true)
      setError('')
      const res = await listHouses({
        limit,
        offset: (nextPage - 1) * limit,
        q: q?.trim() || undefined,
      })
      const list = Array.isArray(res) ? res : (res?.results ?? [])
      setRows(list)
      setPage(nextPage)
      setHasNext((res?.has_next ?? list.length === limit))
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [limit, q])

  function openNew() {
    setEditing(null)
    setForm({
      file_no: '',
      qtr_no: '',
      sector: '',
      street: '',
      type_code: 'A',
      status: 'available',
      status_manual: false,
      notes: '',
    })
    setShowForm(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      file_no: row.file_no ?? '',
      qtr_no: row.qtr_no ?? '',
      sector: row.sector ?? '',
      street: row.street ?? '',
      type_code: row.type_code ?? 'A',
      status: row.status ?? 'available',
      status_manual: !!row.status_manual,
      notes: row.notes ?? '',
    })
    setShowForm(true)
  }

  async function saveForm() {
    const payload = { ...form, qtr_no: String(form.qtr_no).trim() }
    if (editing) {
      await updateHouse(editing.id, payload)
    } else {
      await createHouse(payload)
    }
    setShowForm(false)
    await load(page)
  }

  async function onDelete(row) {
    if (!window.confirm('Delete this house?')) return
    await deleteHouse(row.id)
    await load(page)
  }

  return (
    <div className="container">
      <h1>Houses</h1>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="filters">
          <input
            placeholder="Search file no, qtr no, sector, street…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            style={{ flex: 1, minWidth: 260 }}
          />
          {hasPerm('houses:create') && (
            <button className="btn primary" onClick={openNew}>Add house</button>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>File #</th>
                <th>Quarter #</th>
                <th>Sector</th>
                <th>Street</th>
                <th>Type</th>
                <th>Status</th>
                {hasPerm('houses:update') || hasPerm('houses:delete') ? <th style={{ width: 140 }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>
                    <button className="link-btn" onClick={()=>gotoAllotmentHistory(row.file_no)} title="View allotment history">
                      {row.file_no}
                    </button>
                  </td>
                  <td>{String(row.qtr_no ?? '-')}</td>
                  <td>{row.sector ?? '-'}</td>
                  <td>{row.street ?? '-'}</td>
                  <td>{row.type_code ?? '-'}</td>
                  <td>{row.status ?? '-'}</td>
                  {(hasPerm('houses:update') || hasPerm('houses:delete')) && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {hasPerm('houses:update') && <button className="btn" onClick={()=>openEdit(row)}>Edit</button>}
                        {hasPerm('houses:delete') && <button className="btn danger" onClick={()=>onDelete(row)}>Delete</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="btn" disabled={loading || page<=1} onClick={()=>load(page-1)} aria-label="Previous page">« Prev</button>
          <div className="pager-info">{page}</div>
          <button className="btn" disabled={loading || !hasNext} onClick={()=>load(page+1)} aria-label="Next page">Next »</button>
        </div>
      </div>

      <Modal
        open={showForm}
        title={editing ? 'Edit house' : 'New house'}
        onClose={()=>setShowForm(false)}
        actions={
          <>
            <button className="btn" type="button" onClick={()=>setShowForm(false)}>Cancel</button>
            {hasPerm(editing ? 'houses:update' : 'houses:create') && (
              <button className="btn primary" type="button" onClick={saveForm}>
                {editing ? 'Save changes' : 'Create'}
              </button>
            )}
          </>
        }
      >
        {!!form && (
          <form className="grid2" onSubmit={e=>e.preventDefault()}>
            <label>
              <div>File #</div>
              <input value={form.file_no} onChange={e=>setForm(f=>({...f, file_no: e.target.value}))} required />
            </label>
            <label>
              <div>Quarter #</div>
              <input value={form.qtr_no} onChange={e=>setForm(f=>({...f, qtr_no: e.target.value}))} required />
            </label>
            <label>
              <div>Sector</div>
              <input value={form.sector} onChange={e=>setForm(f=>({...f, sector: e.target.value}))} />
            </label>
            <label>
              <div>Street</div>
              <input value={form.street} onChange={e=>setForm(f=>({...f, street: e.target.value}))} />
            </label>
            <label>
              <div>Type</div>
              <select value={form.type_code} onChange={e=>setForm(f=>({...f, type_code: e.target.value}))}>
                {['A','B','C','D','E','F','G','H'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              <div>Status</div>
              <select value={form.status} onChange={e=>setForm(f=>({...f, status: e.target.value}))}>
                <option value="available">available</option>
                <option value="occupied">occupied</option>
                <option value="vacant">vacant</option>
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <div>Notes</div>
              <textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f, notes: e.target.value}))} />
            </label>
            <label>
              <div>Manual status?</div>
              <input type="checkbox" checked={!!form.status_manual} onChange={e=>setForm(f=>({...f, status_manual: e.target.checked}))} />
            </label>
          </form>
        )}
      </Modal>
    </div>
  )
}
