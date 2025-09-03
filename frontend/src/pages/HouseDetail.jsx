import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api'

function DaysBetween(a, b) {
  if (!a || !b) return '-'
  const d1 = new Date(a)
  const d2 = new Date(b)
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)))
}

export default function HouseDetail() {
  const { id } = useParams()           // house id
  const nav = useNavigate()

  const [house, setHouse] = useState(null)
  const [allotments, setAllotments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = async () => {
    try {
      setLoading(true)
      const [h, a] = await Promise.all([
        api.get(`/houses/${id}`),
        api.get(`/houses/${id}/allotments`),
      ])
      setHouse(h.data)
      setAllotments(a.data || [])
    } catch (e) {
      setError(e.message || 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const latestAllotment = useMemo(
    () => [...allotments].sort((x, y) => (y.id ?? 0) - (x.id ?? 0))[0],
    [allotments]
  )

  const deleteAllotment = async (allotmentId) => {
    if (!confirm('Delete this allotment?')) return
    await api.delete(`/allotments/${allotmentId}`)
    await refetch()
  }

  const toggleManual = async (checked) => {
    await api.patch(`/houses/${house.id}`, { status_manual: checked })
    await refetch()
  }

  const setManualStatus = async (value) => {
    await api.patch(`/houses/${house.id}`, { status: value })
    await refetch()
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p style={{ color: 'crimson' }}>{error}</p>
  if (!house) return <p>Not found</p>

  return (
    <div style={{ padding: 24 }}>
      <nav style={{ marginBottom: 12 }}>
        <Link to="/houses">← Back to Houses</Link>
        {' '}|{' '}
        <Link to="/">Home</Link>
      </nav>

      <h1>House — Allotment History</h1>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <p><strong>File No:</strong> {house.file_no}</p>
        <p>
          <strong>Quarter:</strong> {house.quarter} &nbsp;&nbsp;
          <strong>Street:</strong> {house.street} &nbsp;&nbsp;
          <strong>Sector:</strong> {house.sector}
        </p>
        <p><strong>Type:</strong> {house.type}</p>

        {/* 👇 This Status mirrors the backend's "house.status" */}
        <p style={{ fontSize: 18 }}>
          <strong>Status:</strong> {house.status}
        </p>

        {/* Manual control */}
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={!!house.status_manual}
              onChange={(e) => toggleManual(e.target.checked)}
            />
            Manual status
          </label>

          {house.status_manual && (
            <select
              value={house.status}
              onChange={(e) => setManualStatus(e.target.value)}
              style={{ marginLeft: 12 }}
            >
              <option value="vacant">vacant</option>
              <option value="occupied">occupied</option>
              <option value="maintenance">maintenance</option>
            </select>
          )}
        </div>

        {/* Optional quick hint of what auto would be */}
        {!house.status_manual && latestAllotment && (
          <p style={{ marginTop: 6, color: '#666' }}>
            <em>Auto from latest allotment:</em>{' '}
            {latestAllotment.qtr_status === 'active' ? 'occupied' : 'vacant'}
          </p>
        )}
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Previous Allotments</h2>
          <button onClick={() => nav(`/houses/${house.id}/allotments/new`)}>Add Allotment</button>
        </div>

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Allottee</th>
                <th>Designation</th>
                <th>Directorate</th>
                <th>CNIC</th>
                <th>Allotment</th>
                <th>Occupation</th>
                <th>Vacation</th>
                <th>Period (days)</th>
                <th>Pool</th>
                {/* <th>Qtr Status</th>  HIDDEN as requested */}
                <th>Medium</th>
                <th>Status</th> {/* shows allottee_status */}
                <th></th>       {/* actions */}
              </tr>
            </thead>
            <tbody>
              {allotments.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 16 }}>No allotments</td></tr>
              )}
              {allotments.map(a => (
                <tr key={a.id}>
                  <td>{a.allottee_name ?? '—'}</td>
                  <td>{a.designation ?? '—'}</td>
                  <td>{a.directorate ?? '—'}</td>
                  <td>{a.cnic ?? '—'}</td>
                  <td>{a.allotment_date ?? '—'}</td>
                  <td>{a.occupation_date ?? '—'}</td>
                  <td>{a.vacation_date ?? '—'}</td>
                  <td>{DaysBetween(a.occupation_date, a.vacation_date) }</td>
                  <td>{a.pool ?? '—'}</td>
                  {/* Qtr status intentionally not rendered */}
                  <td>{a.medium ?? '—'}</td>
                  <td>{(a.allottee_status || 'in_service').replace('_', ' ')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => nav(`/allotments/${a.id}/edit`)}>Edit</button>
                      <button onClick={() => deleteAllotment(a.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
