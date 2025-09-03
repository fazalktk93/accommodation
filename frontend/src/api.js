// frontend/src/api.js
import axios from 'axios'

// ---- SAFE env read (no "typeof import"!)
const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`
let baseURL = defaultApiBase
try {
  // this is valid: we only ever reference import.meta, not "import"
  if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    baseURL = import.meta.env.VITE_API_BASE_URL
  }
} catch (e) {
  // ignore – fall back to defaultApiBase
}

console.log('[api] baseURL =', baseURL)

export const api = axios.create({ baseURL, timeout: 10000 })

// Log requests/responses to help debug
api.interceptors.request.use(cfg => {
  try { console.log('[api req]', (cfg.method || 'get').toUpperCase(), cfg.url, { params: cfg.params, data: cfg.data }) } catch (_) {}
  return cfg
})
api.interceptors.response.use(
  res => {
    try { console.log('[api res]', (res.config.method || 'get').toUpperCase(), res.config.url, res.status) } catch (_) {}
    return res
  },
  err => {
    const msg =
      (err && err.response && err.response.data && err.response.data.detail) ||
      err.message || 'Request failed'
    try { console.error('[api err]', msg, err && err.response && err.response.status, err && err.config && err.config.url) } catch (_) {}
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

export const createAllotment = (data) =>
  api.post('/allotments', data, { params: { force_end_previous: true } })

export const endAllotment = (id, notes, vacation_date = null) =>
  api.post(`/allotments/${id}/end`, null, { params: { notes, vacation_date } })

export const updateAllotment = (id, payload) =>
  api.patch(`/allotments/${id}`, payload)

export const deleteAllotment = (id) =>
  api.delete(`/allotments/${id}`)
