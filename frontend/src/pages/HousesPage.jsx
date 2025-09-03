// frontend/src/pages/HousesPage.jsx
import { useEffect, useState } from 'react'
import { listHouses, createHouse, updateHouse, deleteHouse } from '../api'

export default function HousesPage() {
  const [houses, setHouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const normalizeList = (data) =>
    Array.isArray(data) ? data : (data?.results ?? data?.items ?? [])

  const fetchHouses = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listHouses()
      setHouses(normalizeList(data))
    } catch (e) {
      setError(e.message || 'Failed to load houses')
      setHouses([]) // make sure it's always an array
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await listHouses()
        if (!cancelled) setHouses(normalizeList(data))
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load houses')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Example CRUD handlers (use these if you already had forms/buttons)
  const handleCreate = async (payload) => {
    await createHouse(payload)
    await fetchHouses()
  }
  const handleUpdate = async (id, payload) => {
    await updateHouse(id, payload)
    await fetchHouses()
  }
  const handleDelete = async (id) => {
    await deleteHouse(id)
    await fetchHouses()
  }

  if (loading) return <div>Loading houses…</div>
  if (error)   return <div style={{ color: 'crimson' }}>Error: {error}</div>

  const items = Array.isArray(houses) ? houses : []

  return (
    <div>
      <h1>Houses</h1>
      {items.length === 0 ? (
        <p>No houses found.</p>
      ) : (
        <ul>
          {items.map(h => (
            <li key={h.id}>
              <strong>{h.name ?? h.title ?? `House #${h.id}`}</strong>
              {/* Example actions:
              <button onClick={() => handleUpdate(h.id, {/* ... *!/})}>Edit</button>
              <button onClick={() => handleDelete(h.id)}>Delete</button>
              */}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
