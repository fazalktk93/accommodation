import axios from 'axios'
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
export const api = axios.create({ baseURL })

// Houses
export const listHouses = (params={}) => api.get('/houses/', { params })
export const createHouse = (data) => api.post('/houses/', data)
export const updateHouse = (id, data) => api.patch(`/houses/${id}`, data)
export const deleteHouse = (id) => api.delete(`/houses/${id}`)

// Allotments
export const listAllotments = (params={}) => api.get('/allotments/', { params })
export const createAllotment = (data) => api.post('/allotments/', data)
export const endAllotment = (id, notes, vacation_date=null) =>
  api.post(`/allotments/${id}/end`, null, { params: { notes, vacation_date } })

// File movements (by File No)
export const listMovements = (params={}) => api.get('/files/', { params })
export const issueFile = (data) => api.post('/files/issue', data)   // {file_no, ...}
export const returnFile = (id, data={}) => api.post(`/files/${id}/return`, data)
export const getFileStatus = (file_no) => api.get(`/files/status/${file_no}`)