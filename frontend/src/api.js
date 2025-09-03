import axios from 'axios'
const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`
const baseURL = import.meta.env.VITE_API_BASE_URL || defaultApiBase

export const api = axios.create({ baseURL, timeout: 10000 })

// Normalize errors
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err?.response?.data?.detail || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
  }
)

// Houses
export const listHouses = (params = {}) => api.get('/houses/', { params })
export const createHouse = (data) => api.post('/houses/', data)
export const updateHouse = (id, data) => api.patch(`/houses/${id}`, data)
export const deleteHouse = (id) => api.delete(`/houses/${id}`)

// Allotments
export const listAllotments = (params = {}) => api.get('/allotments/', { params })
export const createAllotment = (data) =>
  api.post('/allotments', data, {
    params: { force_end_previous: true }
  })
export const endAllotment = (id, notes, vacation_date = null) =>
  api.post(`/allotments/${id}/end`, null, { params: { notes, vacation_date } })

export const updateAllotment = (id, payload) =>
  api.patch(`/allotments/${id}`, payload, {
    params: { force_end_previous: true }
  })

// Delete an allotment (DELETE /allotments/:id)
export const deleteAllotment = (id) =>
  api.delete(`/allotments/${id}`)

// File movements
export const listMovements = (params = {}) =>
  api.get('/files', { params }).then(r => r.data)
export const issueFile = (data) =>
  api.post('/files', data).then(r => r.data)
export const returnFile = (id, returned_date = null) =>
  api.post(`/files/${id}/return`, null, {
    params: { returned_date }
  }).then(r => r.data)

export const updateMovement = (id, payload) =>
api.patch(`/files/${id}`, payload).then(r => r.data)

export const deleteMovement = (id) =>
  api.delete(`/files/${id}`).then(r => r.data)


// …keep existing imports/code…

export const getHouseByFile = (file_no) => api.get(`/houses/by-file/${encodeURIComponent(file_no)}`)
export const listAllotmentHistoryByFile = (file_no) => api.get(`/allotments/history/by-file/${encodeURIComponent(file_no)}`)

