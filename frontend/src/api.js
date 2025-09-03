// frontend/src/api.js
import axios from 'axios'

// ---- SAFE env read (no "typeof import")
const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`
const asList = (d) => (Array.isArray(d) ? d : (d?.results ?? []));
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

export const createAllotment = (data, { forceEndPrevious = false } = {}) =>
  api.post(
    '/allotments/',
    { ...data, ...(forceEndPrevious ? { force_end_previous: true } : {}) },
    forceEndPrevious ? { params: { force_end_previous: true } } : undefined
  ).then(r => r.data)

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

// ---------------- House ↔ File relations ----------------
export const getHouseByFile = async (fileNo) => {
  // 1) try exact filter if backend supports it
  try {
    const r1 = await api.get('/houses/', { params: { file_no: fileNo } });
    const list1 = asList(r1.data);
    if (list1.length) return list1[0];
  } catch (_) {}

  // 2) fallback: generic search
  try {
    const r2 = await api.get('/houses/', { params: { q: fileNo } });
    const list2 = asList(r2.data);
    // try to pick the best match if multiple
    const exact = list2.find(h => String(h.file_no) === String(fileNo));
    return exact || list2[0] || null;
  } catch (_) {
    return null;
  }
};

export const listAllotmentHistoryByFile = async (fileNo, params = {}) => {
  const house = await getHouseByFile(fileNo);
  if (!house) return [];

  // Ask by house_id (most backends support this)
  const r = await api.get('/allotments/', {
    params: { house_id: house.id, ...params },
  });
  return asList(r.data);
};
