// frontend/src/api.js
import axios from 'axios'

// ---- SAFE env read (no "typeof import")
const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`
let baseURL = defaultApiBase
try {
  if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    baseURL = import.meta.env.VITE_API_BASE_URL
  }
} catch (_) {}

console.log('[api] baseURL =', baseURL)

export const api = axios.create({ baseURL, timeout: 10000 })

// (optional) simple logs
api.interceptors.request.use(cfg => {
  try { console.log('[api req]', (cfg.method || 'get').toUpperCase(), cfg.url, { params: cfg.params }) } catch (_) {}
  return cfg
})
api.interceptors.response.use(
  res => res, // keep the full axios response here; we .then(r => r.data) per call below
  err => {
    const msg =
      (err && err.response && err.response.data && err.response.data.detail) ||
      err.message || 'Request failed'
    try { console.error('[api err]', msg, err?.response?.status, err?.config?.url) } catch (_) {}
    return Promise.reject(new Error(msg))
  }
)

// ---------------- Houses ----------------
export const listHouses  = (params = {}) => api.get('/houses/', { params }).then(r => r.data)
export const createHouse = (data)        => api.post('/houses/', data).then(r => r.data)
export const updateHouse = (id, data)    => api.patch(`/houses/${id}`, data).then(r => r.data)
export const deleteHouse = (id)          => api.delete(`/houses/${id}`).then(r => r.data)

// ---------------- Allotments ------------
export const listAllotments = (params = {}) =>
  api.get('/allotments/', { params }).then(r => r.data)

// 👇 alias so pages can import either name
export const searchAllotments = (params = {}) => listAllotments(params)

export const createAllotment = (data) =>
  api.post('/allotments', data, { params: { force_end_previous: true } }).then(r => r.data)

export const endAllotment = (id, notes, vacation_date = null) =>
  api.post(`/allotments/${id}/end`, null, { params: { notes, vacation_date } }).then(r => r.data)

export const updateAllotment = (id, payload) =>
  api.patch(`/allotments/${id}`, payload).then(r => r.data)

export const deleteAllotment = (id) =>
  api.delete(`/allotments/${id}`).then(r => r.data)
