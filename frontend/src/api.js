// frontend/src/api.js
import axios from 'axios'
import { getToken, logout } from './auth'

// Default base = http://HOST:8000/api (matches your .env.sample)
// Use relative path in dev so Vite proxy handles it (avoids CORS entirely)
const defaultApiBase = '/api'
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

/** Axios instance with auth + error handling */
export const api = axios.create({
  baseURL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** Attach token if present */
api.interceptors.request.use((config) => {
  const tok = getToken?.()
  if (tok) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${tok}`
  }
  return config
})

/** Handle 401 globally */
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) {
      try { logout?.() } catch {}
    }
    throw e
  }
)

/** Normalize API list responses (array or {data:[...]}) */
function asList(res) {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.data)) return res.data
  return []
}

// ----------------- Houses -----------------
export const createHouse = async (payload) => {
  const r = await api.post('/houses/', payload)
  return r.data
}

export const updateHouse = async (houseId, payload) => {
  const r = await api.patch(`/houses/${houseId}`, payload)
  return r.data
}

export const deleteHouse = async (houseId) => {
  await api.delete(`/houses/${houseId}`)
}

// ----------------- Allotments -----------------
export const listAllotments = async (params = {}) => {
  const r = await api.get('/allotments/', { params })
  return asList(r.data)
}

/** NEW: admin-only in practice (server enforces permission) */
export const deleteAllotment = async (allotmentId) => {
  await api.delete(`/allotments/${allotmentId}`)
}

// Backward-compatible search for Houses (used by pages)
export async function searchHouses(params = {}) {
  const { q, limit = 100, offset = 0, type, status } = params

  const base = (import.meta?.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
  const url = new URL(`${base}/houses/`, window.location.origin)

  if (q) url.searchParams.set('q', q)
  if (type) url.searchParams.set('type_code', type)
  if (status) url.searchParams.set('status', status)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      ...(getToken?.() ? { 'Authorization': `Bearer ${getToken()}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`Failed to load houses (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? data : data?.data ?? []
}

// ----------------- Helper: Allotments by house (used in HouseAllotmentsPage) -----------------
export const listAllotmentsByHouse = async (house, params = {}) => {
  if (!house) return []
  const r = await api.get('/allotments/', {
    params: { house_id: house.id, ...params },
  })
  return asList(r.data)
}

// ----------------- File Movements (FilesPage.jsx) -----------------
export const listMovements = async (params = {}) => {
  const r = await api.get('/files/', { params })
  return asList(r.data)
}

export const issueFile = async (payload) => {
  const r = await api.post('/files/', payload)
  return r.data
}

export const returnFile = async (id, returned_date = null) => {
  const r = await api.post(`/files/${id}/return`, { returned_date })
  return r.data
}

export { api }
export default api
