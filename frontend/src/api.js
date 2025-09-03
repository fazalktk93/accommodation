import axios from 'axios'

// Safe access to Vite env (won't crash elsewhere)
const viteEnv = (typeof import !== 'undefined' && typeof import.meta !== 'undefined' && import.meta && import.meta.env)
  ? import.meta.env
  : {}

const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`
const baseURL = viteEnv.VITE_API_BASE_URL || defaultApiBase

console.log('[api] baseURL =', baseURL)

export const api = axios.create({ baseURL, timeout: 10000 })

// Log all requests
api.interceptors.request.use(cfg => {
  console.log('[api req]', cfg.method?.toUpperCase(), cfg.url, { params: cfg.params, data: cfg.data })
  return cfg
})

// Normalize + log errors
api.interceptors.response.use(
  res => {
    console.log('[api res]', res.config.method?.toUpperCase(), res.config.url, res.status)
    return res
  },
  err => {
    const msg =
      (err && err.response && err.response.data && err.response.data.detail) ||
      err.message || 'Request failed'
    console.error('[api err]', msg, err?.response?.status, err?.config?.url)
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
