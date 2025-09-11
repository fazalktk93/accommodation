// frontend/src/api.js
import axios from "axios";
import { getToken } from "./auth";

/**
 * Axios instance
 * DEV: baseURL '/api' (Vite proxy -> backend)
 * PROD: have your web server reverse-proxy '/api' to the backend
 */
const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/** Attach Authorization header */
api.interceptors.request.use((config) => {
  const tok = getToken?.();
  if (tok) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      // default to Bearer; we may retry with other schemes on 401
      config.headers.Authorization = `Bearer ${tok}`;
      config.__authScheme = "Bearer";
    }
  }
  return config;
});

/**
 * On 401:
 *  - DO NOT logout here (prevents login loop)
 *  - Retry once with alternate schemes: 'Token' then 'JWT'
 *  - If still 401, reject; UI can show an error
 */
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) return Promise.reject(error);

    if (response.status !== 401) return Promise.reject(error);

    // Don't retry auth endpoints
    const url = String(config.url || "");
    const isAuthEndpoint =
      /\/auth\/(token|login|jwt\/login)|\/login\/access-token/i.test(url);
    if (isAuthEndpoint) return Promise.reject(error);

    // No token? Nothing to retry
    const tok = getToken?.();
    if (!tok) return Promise.reject(error);

    // Prevent infinite loops
    if (config.__authRetried) return Promise.reject(error);

    for (const scheme of ["Token", "JWT"]) {
      try {
        const retried = {
          ...config,
          headers: { ...(config.headers || {}), Authorization: `${scheme} ${tok}` },
          __authRetried: true,
          __usedAltScheme: scheme,
        };
        return await api.request(retried);
      } catch (e) {
        if (e?.response?.status !== 401) throw e; // bubble non-401
        // else try next scheme
      }
    }

    return Promise.reject(error);
  }
);

/* ---------------- small helpers ---------------- */
function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/* ========== HOUSES ========== */
export async function listHouses(params = {}) {
  const { data } = await api.get("/houses", { params });
  return asList(data);
}
export async function getHouse(id) {
  const { data } = await api.get(`/houses/${id}`);
  return data;
}
export async function createHouse(payload) {
  const { data } = await api.post("/houses", payload);
  return data;
}
export async function updateHouse(id, payload) {
  const { data } = await api.patch(`/houses/${id}`, payload);
  return data;
}
export async function deleteHouse(id) {
  await api.delete(`/houses/${id}`);
  return true;
}
export async function findHouseByFileNoStrict(file_no) {
  if (!file_no) throw new Error("file_no required");
  const { data } = await api.get(`/houses/by-file/${encodeURIComponent(file_no)}`);
  return data;
}
export async function patchHouseStatus(id, status, extra = {}) {
  const { data } = await api.patch(`/houses/${id}`, { status, ...extra });
  return data;
}

/* ========== ALLOTMENTS ========== */
export async function listAllotments(params = {}) {
  const { data } = await api.get("/allotments", { params });
  return asList(data);
}
export async function getAllotment(id) {
  const { data } = await api.get(`/allotments/${id}`);
  return data;
}
export async function createAllotment(payload) {
  const { data } = await api.post("/allotments", payload);
  return data;
}
export async function updateAllotment(id, payload) {
  const { data } = await api.patch(`/allotments/${id}`, payload);
  return data;
}
export async function deleteAllotment(id) {
  await api.delete(`/allotments/${id}`);
  return true;
}
export async function listAllotmentsByFileNoStrict(file_no, { limit = 500, offset = 0 } = {}) {
  const { data } = await api.get("/allotments", { params: { file_no, limit, offset } });
  return asList(data);
}

/* ========== FILES / MOVEMENTS ========== */
export async function listMovements(params = {}) {
  const { data } = await api.get("/files", { params });
  return asList(data);
}
/** Issue file (outgoing) */
export async function issueFile(payload) {
  // backend may accept with or without trailing slash
  const { data } = await api.post("/files", payload).catch(async (e) => {
    // retry with trailing slash if server demands it
    if (e?.response?.status === 404) {
      const { data: d2 } = await api.post("/files/", payload);
      return { data: d2 };
    }
    throw e;
  });
  return data;
}
/** Return file (incoming) */
export async function returnFile(id, returned_date = null) {
  const body = { returned_date };
  const { data } = await api.post(`/files/${id}/return`, body);
  return data;
}

export { api };
export default api;
