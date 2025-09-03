import axios from 'axios'

const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`
const baseURL = import.meta.env.VITE_API_BASE_URL || defaultApiBase

export const api = axios.create({ baseURL, timeout: 10000 })

// Normalize errors
api.interceptors.response.use(
  res => res,
  err => {
    const msg = (err && err.response && err.response.data && err.response.data.detail) || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// ---------------- Houses ----------------
export const listHouses     = (params = {}) => api.get('/houses/', { params })
export const createHouse    = (data)        => api.post('/houses/', data)
export const updateHouse    = (id, data)    => api.patch(`/houses/${id}`, data)
export const deleteHouse    = (id)          => api.delete(`/houses/${id}`)

// ---------------- Allotments ------------
export const listAllotments = (params = {}) => api.get('/allotments/', { params })

// The backend is mounted at /allotments (no trailing slash required).
// Keep force_end_previous=true to auto-end any previous active allotment for that house.
export const createAllotment = (data) =>
  api.post('/allotments', data, { params: { force_end_previous: true } })

export const endAllotment = (id, notes, vacation_date = null) =>
  api.post(`/allotments/${id}/end`, null, { params: { notes, vacation_date } })

export const updateAllotment = (id, payload) =>
  api.patch(`/allotments/${id}`, payload)

export const deleteAllotment = (id) =>
  api.delete(`/allotments/${id}`)
