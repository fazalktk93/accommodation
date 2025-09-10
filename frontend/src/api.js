// frontend/src/api.js
import axios from 'axios'
import { getToken, logout } from './auth'

// -------- Base URL (keeps your Vite/env logic) --------
const defaultApiBase = '/api'
let baseURL = defaultApiBase
try {
  if (import.meta?.env?.VITE_API_BASE_URL) {
    baseURL = import.meta.env.VITE_API_BASE_URL
  }
} catch (_) {}

// -------- Params serializer: ignore empty values & support arrays --------
function buildSearchParams(params = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    if (Array.isArray(v)) v.forEach((it) => sp.append(k, String(it)))
    else sp.set(k, String(v))
  })
  return sp
}

// -------- Single axios instance --------
const api = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: false,
  paramsSerializer: { serialize: buildSearchParams },
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

// Attach bearer token
api.interceptors.request.use((config) => {
  const tok = getToken?.()
  if (tok) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${tok}`
  }
  return config
})

// Global 401 → logout
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e?.response?.status === 401) {
      try { logout?.() } catch {}
    }
    return Promise.reject(e)
  }
)

// -------- Helpers --------
export function cancellableGet(url, cfg = {}) {
  const controller = new AbortController()
  const p = api.get(url, { signal: controller.signal, ...cfg })
  p.cancel = () => controller.abort()
  return p
}

function asList(res) {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.data)) return res.data
  return []
}

// -------- Houses --------
export const listHouses = async ({ limit = 50, offset = 0, q, sector, type_code, status, sort = 'id', order = 'asc' } = {}) => {
  const r = await api.get('/houses', {
    params: { limit, offset, q, sector, type_code, status, sort, order },
  })
  return asList(r.data)
}

export const getHouse = async (id) => {
  const r = await api.get(`/houses/${id}`)
  return r.data
}

export const findHouseByFileNoStrict = async (file_no) => {
  if (!file_no) throw new Error('file_no required')
  const r = await api.get(`/houses/by-file/${encodeURIComponent(file_no)}`)
  return r.data
}

export const patchHouseStatus = async (id, status, extra = {}) => {
  const r = await api.patch(`/houses/${id}`, { status, ...extra })
  return r.data
}

// -------- Allotments --------
export const listAllotments = async ({
  limit = 50,
  offset = 0,
  q,
  file_no,
  house_id,
  person_name,
  designation,
  cnic,
  status,
  sort = 'id',
  order = 'asc',
} = {}) => {
  const r = await api.get('/allotments', {
    params: { limit, offset, q, file_no, house_id, person_name, designation, cnic, status, sort, order },
  })
  return asList(r.data)
}

export const listAllotmentsByFileNoStrict = async (file_no, { limit = 500, offset = 0 } = {}) => {
  const r = await api.get('/allotments', { params: { file_no, limit, offset } })
  return asList(r.data)
}

export const createAllotment = async (payload) => {
  const r = await api.post('/allotments/', payload)
  return r.data
}

export const updateAllotment = async (id, payload) => {
  const r = await api.patch(`/allotments/${id}`, payload)
  return r.data
}

export const deleteAllotment = async (id) => {
  await api.delete(`/allotments/${id}`)
  return true
}

// -------- Files (movements) --------
export const listMovements = async ({ limit = 50, offset = 0, q, file_no, due_before, outstanding } = {}) => {
  const r = await api.get('/files', { params: { limit, offset, q, file_no, due_before, outstanding } })
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
