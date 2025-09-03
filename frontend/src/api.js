// frontend/src/api.js
import axios from 'axios'
import { getToken, logout } from './auth'

// Default base = http://HOST:8000/api (from your .env.sample)
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
} catch {}

const api = axios.create({
  baseURL,
  timeout: 30000,
})

// Attach Authorization on every request if we have a token
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If the server says 401, force logout → /login
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err?.response?.status === 401) {
      logout()
      return Promise.reject(new Error('Unauthorized'))
    }
    return Promise.reject(err)
  }
)

// helpers
const asList = (d) => (Array.isArray(d) ? d : (d?.results ?? []))

// ----------------- EXISTING API CALLS (left intact, just using `api`) -----------------
export const listHouses = async (params = {}) => {
  const r = await api.get('/houses/', { params })
  return asList(r.data)
}

export const getHouse = async (houseId) => {
  const r = await api.get(`/houses/${houseId}`)
  return r.data
}

export const getHouseByFile = async (fileNo) => {
  try {
    const r = await api.get(`/houses/by-file/${encodeURIComponent(fileNo)}`)
    return r.data
  } catch (e) {
    if (e?.response?.status === 404) return null
    throw e
  }
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

export const listAllotments = async (params = {}) => {
  const r = await api.get('/allotments/', { params })
  return asList(r.data)
}

export const getAllotment = async (id) => {
  const r = await api.get(`/allotments/${id}`)
  return r.data
}

export const updateAllotment = async (id, payload) => {
  const r = await api.patch(`/allotments/${id}`, payload)
  return r.data
}

export const deleteAllotment = async (id) => {
  await api.delete(`/allotments/${id}`)
}

export const listAllotmentHistoryByFile = async (fileNo, params = {}) => {
  const house = await getHouseByFile(fileNo)
  if (!house) return []
  const r = await api.get('/allotments/', {
    params: { house_id: house.id, ...params },
  })
  return asList(r.data)
}

export default api
