import { useEffect, useMemo, useState } from 'react'
import { listHouses, listAllotments } from '../api'

/** ---------- Tiny SVG PieChart (no dependencies) ---------- */
function PieChart({ title, data, size = 220, onSliceClick }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8

  let acc = 0
  const arcs = data.map((d, i) => {
    const start = acc / total * Math.PI * 2
    acc += d.value
    const end = acc / total * Math.PI * 2

    // convert polar to cartesian
    const sx = cx + r * Math.cos(start - Math.PI / 2)
    const sy = cy + r * Math.sin(start - Math.PI / 2)
    const ex = cx + r * Math.cos(end - Math.PI / 2)
    const ey = cy + r * Math.sin(end - Math.PI / 2)
    const large = end - start > Math.PI ? 1 : 0

    const path = `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`
    return { ...d, path }
  })

  return (
    <div className="card chart-card">
      <div className="card-title">{title}</div>
      <div className="chart-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
          <circle cx={cx} cy={cy} r={r} fill="var(--surface-2)" />
          {arcs.map((a, i) => (
            <path
              key={i}
              d={a.path}
              fill={a.color}
              className="chart-slice"
              onClick={() => onSliceClick?.(a)}
            >
              <title>{`${a.label}: ${a.value}`}</title>
            </path>
          ))}
        </svg>
        <div className="legend">
          {data.map((d, i) => (
            <button
              type="button"
              key={i}
              className="legend-item"
              onClick={() => onSliceClick?.(d)}
              title="Filter by this slice"
            >
              <span className="dot" style={{ background: d.color }} />
              <span>{d.label}</span>
              <span className="count">{d.value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** ---------- Dashboard page ---------- */
export default function Dashboard() {
  const [houses, setHouses] = useState([])
  const [allotments, setAllotments] = useState([])
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(null) // {kind: 'houses'|'allot', field: 'status'|'type'|'medium', value: 'occupied'...}

  useEffect(() => {
    async function load() {
      try {
        setError('')
        const [h, a] = await Promise.all([
          listHouses(),
          listAllotments({ active: 'true' }) // active allotments for medium
        ])
        setHouses(Array.isArray(h) ? h : (h?.data ?? []))
        setAllotments(Array.isArray(a) ? a : (a?.data ?? []))
      } catch (e) {
        setError(e.message || 'Failed to load dashboard')
      }
    }
    load()
  }, [])

  // ----- Tiles -----
  const totals = useMemo(() => {
    const total = houses.length
    const occupied = houses.filter(h => (h.status || '').toLowerCase() === 'occupied').length
    const vacant = houses.filter(h => (h.status || '').toLowerCase() === 'vacant' || (h.status || '').toLowerCase() === 'available').length
    const other = total - occupied - vacant
    return { total, occupied, vacant, other }
  }, [houses])

  // ----- Pie: Quarter status -----
  const qtrData = useMemo(() => {
    const buckets = { Occupied: 0, Vacant: 0, Other: 0 }
    houses.forEach(h => {
      const s = (h.status || '').toLowerCase()
      if (s === 'occupied') buckets.Occupied++
      else if (s === 'vacant' || s === 'available') buckets.Vacant++
      else buckets.Other++
    })
    return [
      { label: 'Occupied', value: buckets.Occupied, color: '#5b8def', kind: 'houses', field: 'status', valueKey: 'occupied' },
      { label: 'Vacant', value: buckets.Vacant, color: '#2bb673', kind: 'houses', field: 'status', valueKey: 'vacant' },
      { label: 'Other', value: buckets.Other, color: '#c2c7cf', kind: 'houses', field: 'status', valueKey: 'other' },
    ]
  }, [houses])

  // ----- Pie: House Type (A–H + Other) -----
  const typeData = useMemo(() => {
    const counts = {}
    houses.forEach(h => {
      const t = (h.type_code || '').toUpperCase()
      const label = /^[A-H]$/.test(t) ? t : 'Other'
      counts[label] = (counts[label] || 0) + 1
    })
    const palette = ['#845ef7', '#339af0', '#22b8cf', '#12b886', '#82c91e', '#fab005', '#ff922b', '#ff6b6b', '#adb5bd']
    const keys = Object.keys(counts).sort()
    return keys.map((k, i) => ({
      label: k, value: counts[k], color: palette[i % palette.length],
      kind: 'houses', field: 'type_code', valueKey: k
    }))
  }, [houses])

  // ----- Pie: Allotment Medium (active only) -----
  const mediumData = useMemo(() => {
    const counts = {}
    allotments.forEach(a => {
      const m = (a.medium || '').trim().toLowerCase()
      const norm = m || 'unspecified'
      counts[norm] = (counts[norm] || 0) + 1
    })
    const palette = ['#5b8def', '#2bb673', '#ffb020', '#ef6c5b', '#9f7aea', '#00bcd4', '#78909c']
    return Object.keys(counts).sort().map((k, i) => ({
      label: k.replace(/^./, c => c.toUpperCase()),
      value: counts[k],
      color: palette[i % palette.length],
      kind: 'allot',
      field: 'medium',
      valueKey: k
    }))
  }, [allotments])

  // ----- Records filtered by clicked slice -----
  const filtered = useMemo(() => {
    if (!filter) return null
    if (filter.kind === 'houses') {
      if (filter.field === 'status') {
        const val = filter.valueKey
        return houses.filter(h => {
          const s = (h.status || '').toLowerCase()
          if (val === 'occupied') return s === 'occupied'
          if (val === 'vacant') return s === 'vacant' || s === 'available'
          return s !== 'occupied' && s !== 'vacant' && s !== 'available'
        })
      }
      if (filter.field === 'type_code') {
        return houses.filter(h => {
          const t = (h.type_code || '').toUpperCase()
          return /^[A-H]$/.test(filter.valueKey) ? t === filter.valueKey : !/^[A-H]$/.test(t)
        })
      }
    } else if (filter.kind === 'allot') {
      const want = (filter.valueKey || '').toLowerCase()
      return allotments.filter(a => (a.medium || '').toLowerCase() === want)
    }
    return null
  }, [filter, houses, allotments])

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      {error && <div className="error">{error}</div>}

      {/* Summary tiles */}
      <div className="tile-row">
        <div className="tile">
          <div className="tile-label">Total Houses</div>
          <div className="tile-value">{totals.total}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Occupied</div>
          <div className="tile-value">{totals.occupied}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Vacant/Available</div>
          <div className="tile-value">{totals.vacant}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Other</div>
          <div className="tile-value">{totals.other}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <PieChart
          title="Quarter Status"
          data={qtrData}
          onSliceClick={(slice) => setFilter({ kind: slice.kind, field: slice.field, value: slice.label, valueKey: slice.valueKey })}
        />
        <PieChart
          title="House Type (A–H, Other)"
          data={typeData}
          onSliceClick={(slice) => setFilter({ kind: slice.kind, field: slice.field, value: slice.label, valueKey: slice.valueKey })}
        />
        <PieChart
          title="Allotment Medium (Active)"
          data={mediumData}
          onSliceClick={(slice) => setFilter({ kind: slice.kind, field: slice.field, value: slice.label, valueKey: slice.valueKey })}
        />
      </div>

      {/* Filtered results */}
      <div className="card">
        <div className="card-title">
          {filter ? (
            <div className="filter-bar">
              <strong>Filtered by:</strong>&nbsp;
              <code>{filter.kind === 'houses' ? 'Houses' : 'Allotments'} → {filter.field} = {filter.value}</code>
              <button className="link-btn" onClick={() => setFilter(null)}>Clear</button>
            </div>
          ) : 'Click a chart slice to view records'}
        </div>

        {filter && filter.kind === 'houses' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>File No</th><th>Qtr No</th><th>Street</th><th>Sector</th><th>Type</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered && filtered.map(h => (
                  <tr key={h.id}>
                    <td>{h.id}</td>
                    <td>{h.file_no}</td>
                    <td>{h.qtr_no}</td>
                    <td>{h.street}</td>
                    <td>{h.sector}</td>
                    <td>{h.type_code}</td>
                    <td>{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filter && filter.kind === 'allot' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>House File</th><th>Qtr</th><th>Allottee</th><th>Medium</th><th>Allotment</th><th>Occupation</th>
                </tr>
              </thead>
              <tbody>
                {filtered && filtered.map(a => (
                  <tr key={a.id}>
                    <td>{a.house_file_no ?? '-'}</td>
                    <td>{a.house_qtr_no ?? '-'}</td>
                    <td>{a.person_name}</td>
                    <td>{a.medium || '-'}</td>
                    <td>{a.allotment_date || '-'}</td>
                    <td>{a.occupation_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
