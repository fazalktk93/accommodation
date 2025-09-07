// frontend/src/api.js
import axios from 'axios'
import { getToken, logout } from './auth'

// Use relative base by default so the Vite proxy handles CORS in dev
const defaultApiBase = '/api'
let baseURL = defaultApiBase
try {
  if (import.meta?.env?.VITE_API_BASE_URL) {
    baseURL = import.meta.env.VITE_API_BASE_URL
  }
} catch (_) {}

/** Single axios instance */
const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
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

/** Global 401 → logout */
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) {
      try { logout?.() } catch {}
    }
    throw e
  }
)

/** Normalize list responses (array or {data:[...]}) */
function asList(res) {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.data)) return res.data
  return []
}

/* -------------------- Houses -------------------- */

export const listHouses = async (params = {}) => {
  const r = await api.get('/houses/', { params })
  return asList(r.data)
}

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

/** Also keep the fetch-based search used elsewhere (back-compat) */
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
      Accept: 'application/json',
      ...(getToken?.() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`Failed to load houses (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? data : data?.data ?? []
}

/* -------------------- Allotments -------------------- */

export const listAllotments = async (params = {}) => {
  const r = await api.get('/allotments/', { params })
  return asList(r.data)
}

/** CREATE allotment (backend typically accepts JSON body with fields you already send) */
export const createAllotment = async (payload) => {
  const r = await api.post('/allotments/', payload)
  return r.data
}

/** UPDATE allotment */
export const updateAllotment = async (id, payload) => {
  const r = await api.patch(`/allotments/${id}`, payload)
  return r.data
}

/** DELETE allotment (admin-only enforced by backend) */
export const deleteAllotment = async (id) => {
  await api.delete(`/allotments/${id}`)
}

/** Convenience: list by house */
export const listAllotmentsByHouse = async (house, params = {}) => {
  if (!house) return []
  const r = await api.get('/allotments/', { params: { house_id: house.id, ...params } })
  return asList(r.data)
}

/* -------------------- File Movements -------------------- */

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
