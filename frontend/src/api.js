// frontend/src/api.js
import axios from 'axios'

// ---- SAFE env read (no "typeof import")
const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`
let baseURL = defaultApiBase
try {
  if (
    typeof import.meta !== 'undefined' &&
    import.meta &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL
  ) {
    baseURL = import.meta.env.VITE_API_BASE_URL
  }
} catch (_) {}

console.log('[api] baseURL =', baseURL)

export const api = axios.create({ baseURL, timeout: 10000 })

// --- logging
api.interceptors.request.use(cfg => {
  try {
    console.log('[api req]', (cfg.method || 'get').toUpperCase(), cfg.url, { params: cfg.params })
  } catch (_) {}
  return cfg
})
api.interceptors.response.use(
  res => res,
  err => {
    const msg =
      (err && err.response && err.response.data && err.response.data.detail) ||
      err.message ||
      'Request failed'
    try {
      console.error('[api err]', msg, err?.response?.status, err?.config?.url)
    } catch (_) {}
    return Promise.reject(new Error(msg))
  }
)

// ---------------- Houses ----------------
export const listHouses = (params = {}) =>
  api.get('/houses/', { params }).then(r => r.data)

export const createHouse = data =>
  api.post('/houses/', data).then(r => r.data)

export const updateHouse = (id, data) =>
  api.patch(`/houses/${id}/`, data).then(r => r.data)

export const deleteHouse = id =>
  api.delete(`/houses/${id}/`).then(r => r.data)

// ---------------- Allotments ----------------
export const listAllotments = (params = {}) =>
  api.get('/allotments/', { params }).then(r => r.data)

export const searchAllotments = (query, params = {}) =>
  api.get('/allotments/', { params: { search: query, ...params } }).then(r => r.data)

export const createAllotment = data =>
  api.post('/allotments/', data).then(r => r.data)

export const updateAllotment = (id, payload) =>
  api.patch(`/allotments/${id}/`, payload).then(r => r.data)

export const deleteAllotment = id =>
  api.delete(`/allotments/${id}/`).then(r => r.data)

// ---------------- Files (movements) ----------------
export const listMovements = (params = {}) =>
  api.get('/files/', { params }).then(r => r.data)

export const issueFile = data =>
  api.post('/files/', data).then(r => r.data)

export const updateFile = (id, payload) =>
  api.patch(`/files/${id}/`, payload).then(r => r.data)

export const returnFile = (id, returned_date = null) =>
  api.post(`/files/${id}/return/`, null, { params: { returned_date } }).then(r => r.data)

export const deleteFile = id =>
  api.delete(`/files/${id}/`).then(r => r.data)

// ---------------- House ↔ File relation ----------------
export const getHouseByFile = (fileId) =>
  api.get(`/files/${fileId}/house/`).then(r => r.data)
