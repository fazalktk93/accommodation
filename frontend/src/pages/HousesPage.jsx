import { useEffect, useState } from 'react'
import { createHouse, deleteHouse, updateHouse } from '../api'
import { getToken, logout } from '../auth'
import { useNavigate, Link } from 'react-router-dom'

/** Build a robust API base that works with /api proxy or full URLs */
function resolveApiBase() {
  const envBase =
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE) ||
    '/api'
  return String(envBase).trim().replace(/\/+$/, '')
}
const API_BASE = resolveApiBase()

/** Local fetch with pagination + filters + trailing slash (avoids 307) */
async function searchHouses(params = {}) {
  const {
    q,
    status,
    type_code,          // project uses type_code on frontend
    limit = 50,
    offset = 0,
  } = params

  // Support either relative or absolute base
  const base = API_BASE || '/api'
  const isAbs = /^https?:\/\//i.test(base)
  const url = isAbs ? new URL(`${base}/houses/`) : new URL(`${base}/houses/`, window.location.origin)

  if (q && String(q).trim()) url.searchParams.set('q', String(q).trim())
  if (status) url.searchParams.set('status', String(status))
  if (type_code) {
    // send both keys to be safe with different backends
    url.searchParams.set('type_code', String(type_code))
    url.searchParams.set('type', String(type_code))
  }
  url.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 50, 1), 1000)))
  url.searchParams.set('offset', String(Math.max(Number(offset) || 0, 0)))

  const headers = {
    Accept: 'application/json',
    ...(getToken?.() ? { Authorization: `Bearer ${getToken()}` } : {}),
  }

  const r = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers,
  })

    if (r.status === 401) {
      try { logout?.() } catch {}
      throw new Error('Unauthorized')
    }
    if (!r.ok) throw new Error(`Failed to load houses (${r.status})`)
    const data = await r.json()
    return Array.isArray(data) ? data : data?.data ?? []

export default function HousesPage(){
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ status:'', type_code:'' })
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ file_no:'', qtr_no:'', street:'', sector:'', type_code:'A', status:'available' })
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  // pagination state
  const [page, setPage] = useState(1)
  const [limit] = useState(50)       // 50 per page
  const [hasNext, setHasNext] = useState(false)

  // ✅ goto by file_no instead of id
  const gotoAllotmentHistory = (fileNo) => {
    if (fileNo) navigate(`/houses/${encodeURIComponent(fileNo)}/allotments`)
  }

  async function load(nextPage = 1) {
    try {
      setLoading(true); setError('')
      const data = await searchHouses({
        q: q || undefined,
        status: filters.status || undefined,
        type_code: filters.type_code || undefined,
        limit,
        offset: (nextPage - 1) * limit,
      })
      const list = Array.isArray(data) ? data : (data?.results ?? [])
      setItems(list)
      setPage(nextPage)
      setHasNext(list.length === limit) // simple hasNext heuristic
    } catch (e) {
      setError(e?.message || 'Failed to load')
      setItems([])
      setHasNext(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])  // initial load

  const search = (e) => { e.preventDefault(); load(1) }

  const submit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateHouse(editing.id, form)
      } else {
        await createHouse(form)
      }
      setForm({ file_no:'', qtr_no:'', street:'', sector:'', type_code:'A', status:'available' })
      setEditing(null)
      setShowAdd(false)
      load(page) // reload current page
    } catch(err){ setError(err.message) }
  }

  const onEdit = (it) => { setEditing(it); setForm({ ...it }); setShowAdd(true) }
  const onDelete = async (id) => {
    if (confirm('Delete house?')) {
      await deleteHouse(id)
      // If we deleted the last item on the page, try to move back a page
      const newPage = (items.length === 1 && page > 1) ? (page - 1) : page
      load(newPage)
    }
  }
  const gotoFileMovement = (file_no) => navigate(`/files?file_no=${encodeURIComponent(file_no)}`)

  return (
    <div>
      <h2>Houses</h2>
      {error && <div className="error" style={{ color: '#b00020', marginBottom: 8 }}>{error}</div>}

      <form className="filters" onSubmit={search} style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: 8 }}>
        <input
          placeholder="Search (file no / sector / street / qtr no)"
          value={q}
          onChange={e=>setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search(e) }}
          style={{ minWidth: 260 }}
        />
        <select value={filters.type_code} onChange={e=>setFilters({...filters, type_code:e.target.value})}>
          <option value="">All Types</option>
          {"ABCDEFGH".split("").map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.status} onChange={e=>setFilters({...filters, status:e.target.value})}>
          <option value="">Any Status</option>
          {["available","vacant","occupied","reserved","maintenance","other","issue_in_record","missing"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        <button type="button" onClick={()=>setShowAdd(s=>!s)}>{showAdd ? 'Close' : 'Add House'}</button>
      </form>

      {showAdd && (
        <form className="card" onSubmit={submit} style={{ margin: '12px 0', padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>{editing ? 'Edit House' : 'Add House'}</h3>
          <div className="grid" style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>File No<input value={form.file_no} onChange={e=>setForm({...form, file_no:e.target.value})} required/></label>
            <label>Quarter No
              <input
                type="text"
                value={form.qtr_no ?? ''}
                onChange={e => setForm({ ...form, qtr_no: e.target.value })}
                required
              />
            </label>
            <label>Street<input value={form.street} onChange={e=>setForm({...form, street:e.target.value})} required/></label>
            <label>Sector
              <select value={form.sector || ''} onChange={e=>setForm({...form, sector:e.target.value})} required>
                <option value="" disabled>Select Sector</option>
                {["A","B","C","D","E","F","G","H","Site"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Type
              <select value={form.type_code} onChange={e=>setForm({...form, type_code:e.target.value})} required>
                {"ABCDEFGH".split("").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
                {["available","vacant","occupied","reserved","maintenance","other","issue_in_record","missing"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={loading}>{editing ? 'Update' : 'Save'}</button>{' '}
            {editing && <button type="button" onClick={()=>{setEditing(null); setShowAdd(false); setForm({ file_no:'', qtr_no:'', street:'', sector:'', type_code:'A', status:'available' })}}>Cancel</button>}
          </div>
        </form>
      )}

      <div className="card" style={{ overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <Link to={`/houses/${encodeURIComponent(it.file_no)}/allotments`}>
                    {it.file_no}
                  </Link>
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
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', padding: 16, opacity: 0.7 }}>No records</td></tr>
            )}
            {loading && (
              <tr><td colSpan={8} style={{ textAlign:'center', padding: 16 }}>Loading…</td></tr>
            )}
          </tbody>
        </table>

        {/* Pager */}
        <div className="pager" style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, padding:'12px 6px' }}>
          <button
            className="btn"
            disabled={loading || page <= 1}
            onClick={() => load(page - 1)}
            aria-label="Previous page"
          >
            « Prev
          </button>

          <span className="pager-info" style={{ minWidth:80, textAlign:'center', fontWeight:600 }}>
            Page {page}
          </span>

          <button
            className="btn"
            disabled={loading || !hasNext}
            onClick={() => load(page + 1)}
            aria-label="Next page"
          >
            Next »
          </button>
        </div>
      </div>
    </div>
  )
}
