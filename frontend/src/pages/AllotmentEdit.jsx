// frontend/src/pages/AllotmentEdit.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

export default function AllotmentEdit() {
  const { id } = useParams() // allotment id
  const nav = useNavigate()
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        if (id === 'new') {
          // This screen is only for edit; new allotment can be your existing create page
          setError('This page is for editing an existing allotment.')
          return
        }
        // NOTE: trailing slash required
        const { data } = await api.get(`/allotments/${id}/`)
        setForm({
          ...data,
          qtr_status: data.qtr_status || 'active',
          allottee_status: data.allottee_status || 'in_service',
        })
      } catch (e) {
        setError(e.message || 'Failed to load allotment')
      }
    })()
  }, [id])

  const update = async () => {
    setSaving(true)
    try {
      // NOTE: trailing slash required
      await api.patch(`/allotments/${id}/`, {
        occupation_date: form.occupation_date || null,
        vacation_date: form.vacation_date || null,
        qtr_status: form.qtr_status,           // drives house.status when not manual
        allottee_status: form.allottee_status, // shows in lower Status column
      })
      nav(-1)
    } catch (e) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <p style={{ color: 'crimson', padding: 16 }}>{error}</p>
  if (!form) return <p style={{ padding: 16 }}>Loading…</p>

  return (
    <div style={{ padding: 24 }}>
      <h1>Edit Allotment</h1>

      <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <label>
          <div>Occupation date</div>
          <input
            type="date"
            value={form.occupation_date || ''}
            onChange={e => setForm(f => ({ ...f, occupation_date: e.target.value }))}
          />
        </label>

        <label>
          <div>Vacation date</div>
          <input
            type="date"
            value={form.vacation_date || ''}
            onChange={e => setForm(f => ({ ...f, vacation_date: e.target.value }))}
          />
        </label>

        <label>
          <div>Quarter Status (affects house status if not manual)</div>
          <select
            value={form.qtr_status}
            onChange={e => setForm(f => ({ ...f, qtr_status: e.target.value }))}
          >
            <option value="active">active (occupied)</option>
            <option value="ended">ended (vacant)</option>
          </select>
        </label>

        <label>
          <div>Allottee Status (shown in list)</div>
          <select
            value={form.allottee_status}
            onChange={e => setForm(f => ({ ...f, allottee_status: e.target.value }))}
          >
            <option value="in_service">in service</option>
            <option value="retired">retired</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button disabled={saving} onClick={update}>{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={() => nav(-1)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
