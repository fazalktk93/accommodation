// frontend/src/pages/HousesPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { listHouses, api } from '../api'
import DataTable from '../components/DataTable'
import { hasPerm } from '../authz'

// ===== utilities =====
function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

const SORTABLE = new Set(['id', 'file_no', 'qtr_no', 'street', 'sector', 'type_code', 'status'])
function normalizeSort(s) { return SORTABLE.has(s) ? s : 'id' }
function nextOrder(current) { return current === 'asc' ? 'desc' : 'asc' }

// ===== page =====
export default function HousesPage() {
  // table state
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [page, setPage] = useState(1)
  const pageSize = 20

  // filters
  const [q, setQ] = useState('')
  const [sector, setSector] = useState('')
  const [typeCode, setTypeCode] = useState('')
  const [status, setStatus] = useState('')

  const [sort, setSort] = useState('id')
  const [order, setOrder] = useState('asc')

  // add/edit form
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // row | null
  const [form, setForm] = useState({
    file_no: '',
    qtr_no: '',
    street: '',
    sector: '',
    type_code: '',
    status: 'vacant',
    status_manual: false,
  })
  const [saving, setSaving] = useState(false)

  // debounced text search
  const debouncedQ = useDebounced(q, 300)

  // prevent races
  const reqId = useRef(0)

  // ===== data fetch =====
  async function fetchPage(p) {
    const my = ++reqId.current
    try {
      setLoading(true)
      setError('')
      const offset = (p - 1) * pageSize

      const data = await listHouses({
        limit: pageSize,
        offset,
        q: debouncedQ || undefined,
        sector: sector || undefined,
        type_code: typeCode || undefined,
        status: status || undefined,
        sort: normalizeSort(sort),
        order,
      })

      if (my !== reqId.current) return // stale
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      if (my !== reqId.current) return
      const msg = e?.response?.data?.detail || e?.message || 'Failed to load'
      setError(msg)
      setRows([])
    } finally {
      if (my === reqId.current) setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, sector, typeCode, status, sort, order])

  useEffect(() => {
    fetchPage(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, sector, typeCode, status, sort, order])

  // ===== table columns =====
  const onSort = (colKey) => {
    if (!SORTABLE.has(colKey)) return
    if (sort === colKey) setOrder((o) => nextOrder(o))
    else { setSort(colKey); setOrder('asc') }
  }

  const SortHeader = ({ label, k }) => (
    <button
      type="button"
      onClick={() => onSort(k)}
      style={{ background:'transparent', border:'none', padding:0, cursor:'pointer', fontWeight: sort===k ? 700 : 500 }}
      title={`Sort by ${label}`}
      aria-label={`Sort by ${label} (${sort===k ? order : 'none'})`}
    >
      {label} {sort===k ? (order==='asc' ? '▲' : '▼') : '⇅'}
    </button>
  )

  const columns = useMemo(() => ([
    { key:'id', header:<SortHeader label="ID" k="id" /> },
    { key:'file_no', header:<SortHeader label="File" k="file_no" /> },
    { key:'qtr_no', header:<SortHeader label="Quarter" k="qtr_no" /> },
    { key:'street', header:<SortHeader label="Street" k="street" /> },
    { key:'sector', header:<SortHeader label="Sector" k="sector" /> },
    { key:'type_code', header:<SortHeader label="Type" k="type_code" /> },
    { key:'status', header:<SortHeader label="Status" k="status" /> },
    { key:'_actions', header:'', render: (r) => (
      <div style={{ display:'flex', gap:8, whiteSpace:'nowrap' }}>
        {hasPerm('houses:update') && <button className="btn" onClick={() => openEdit(r)}>Edit</button>}
        {hasPerm('houses:delete') && <button className="btn danger" onClick={() => onDelete(r)}>Delete</button>}
      </div>
    )},
  ]), [sort, order])

  // pager total estimate (works even without X-Total-Count)
  const estimatedTotal = rows.length < pageSize && page > 1
    ? (page - 1) * pageSize + rows.length
    : page * pageSize // optimistic; OK for simple pager UI

  // ===== form helpers =====
  function resetForm() {
    setForm({
      file_no: '',
      qtr_no: '',
      street: '',
      sector: '',
      type_code: '',
      status: 'vacant',
      status_manual: false,
    })
    setEditing(null)
  }

  function openAdd() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      file_no: row.file_no || '',
      qtr_no: row.qtr_no || '',
      street: row.street || '',
      sector: row.sector || '',
      type_code: row.type_code || '',
      status: row.status || 'vacant',
      status_manual: !!row.status_manual,
    })
    setShowForm(true)
  }

  async function onDelete(row) {
    if (!window.confirm('Delete this house?')) return
    try {
      setSaving(true)
      await api.delete(`/houses/${row.id}`)
      await fetchPage(page)
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        file_no: form.file_no?.trim(),
        qtr_no: form.qtr_no?.trim() || null,
        street: form.street?.trim() || null,
        sector: form.sector?.trim() || null,
        type_code: form.type_code?.trim() || null,
        status: form.status || 'vacant',
        status_manual: !!form.status_manual,
      }
      if (!payload.file_no) throw new Error('File no is required')

      if (editing) {
        await api.patch(`/houses/${editing.id}`, payload)
      } else {
        await api.post('/houses', payload)
      }
      setShowForm(false)
      resetForm()
      await fetchPage(1) // show latest at top if sorting by id asc; adjust as needed
      setPage(1)
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Save failed'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  // ===== render =====
  return (
    <div className="container">
      <h1>Houses</h1>

      {error && <div className="error" role="alert" style={{ marginBottom: 8 }}>{error}</div>}

      {/* filters */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
          <label>
            <div>Search</div>
            <input
              placeholder="file / quarter / street / sector / type"
              value={q}
              onChange={(e)=>{ setQ(e.target.value); setPage(1) }}
            />
          </label>

          <label>
            <div>Sector</div>
            <input value={sector} onChange={(e)=>{ setSector(e.target.value); setPage(1) }} placeholder="e.g. A" />
          </label>

          <label>
            <div>Type</div>
            <input value={typeCode} onChange={(e)=>{ setTypeCode(e.target.value); setPage(1) }} placeholder="e.g. B" />
          </label>

          <label>
            <div>Status</div>
            <select value={status} onChange={(e)=>{ setStatus(e.target.value); setPage(1) }}>
              <option value="">Any</option>
              <option value="vacant">vacant</option>
              <option value="occupied">occupied</option>
              <option value="maintenance">maintenance</option>
            </select>
          </label>
        </div>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Sorted by <strong>{sort}</strong> ({order})
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasPerm('houses:create') && <button className="btn" onClick={openAdd}>Add House</button>}
        </div>
      </div>

      {/* add/edit form */}
      {showForm && (hasPerm('houses:create') || hasPerm('houses:update')) && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>{editing ? 'Edit House' : 'Add House'}</h3>

          <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
            <label>File No<input value={form.file_no} onChange={e=>setForm({ ...form, file_no: e.target.value })} required /></label>
            <label>Quarter No<input value={form.qtr_no || ''} onChange={e=>setForm({ ...form, qtr_no: e.target.value })} /></label>
            <label>Street<input value={form.street || ''} onChange={e=>setForm({ ...form, street: e.target.value })} /></label>
            <label>Sector<input value={form.sector || ''} onChange={e=>setForm({ ...form, sector: e.target.value })} /></label>
            <label>Type Code<input value={form.type_code || ''} onChange={e=>setForm({ ...form, type_code: e.target.value })} /></label>

            <label>
              Status
              <select value={form.status || 'vacant'} onChange={e=>setForm({ ...form, status: e.target.value })}>
                <option value="vacant">vacant</option>
                <option value="occupied">occupied</option>
                <option value="maintenance">maintenance</option>
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.status_manual} onChange={e=>setForm({ ...form, status_manual: e.target.checked })} />
              <span>Set status manually</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn" type="button" onClick={()=>{ setShowForm(false); resetForm(); }}>Cancel</button>
          </div>
        </form>
      )}

      {/* table */}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={estimatedTotal}
        onPageChange={setPage}
      />

      <style>{`
        .btn { padding: 8px 12px; border-radius: 6px; border: 1px solid #ddd; background: #fff; cursor: pointer; }
        .btn:hover { filter: brightness(0.98); }
        .btn.danger { background: #ffe9e9; border-color: #ffd1d1; color: #9b2121; }
        .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
      `}</style>
    </div>
  )
}
