// frontend/src/api.js
import axios from "axios";
import { getToken } from "./auth";

/**
 * Single axios instance.
 * DEV: baseURL '/api' so Vite proxy forwards to backend.
 * PROD: your server should reverse-proxy '/api' to backend as well.
 */
const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Attach auth header (default Bearer).
 */
api.interceptors.request.use((config) => {
  const tok = getToken?.();
  if (tok) {
    config.headers = config.headers || {};
    // set default scheme if none provided by the caller
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${tok}`;
      config.__authScheme = "Bearer";
    }
  }
  return config;
});

/**
 * On 401 from protected endpoints:
 *  - do NOT logout here (prevents redirect loop)
 *  - retry once with alternate schemes: 'Token' then 'JWT'
 *  - otherwise just reject so UI can show an error
 */
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) return Promise.reject(error);

    const status = response.status;
    if (status !== 401) return Promise.reject(error);

    // don't retry login endpoints
    const url = String(config.url || "");
    const isAuthEndpoint = /\/auth\/(token|login|jwt\/login)|\/login\/access-token/.test(url);
    if (isAuthEndpoint) return Promise.reject(error);

    // if there is no token, nothing to retry
    const tok = getToken?.();
    if (!tok) return Promise.reject(error);

    // avoid infinite retry loops
    if (config.__authRetried) return Promise.reject(error);

    const schemes = ["Token", "JWT"];
    for (const s of schemes) {
      try {
        const retried = {
          ...config,
          headers: { ...(config.headers || {}), Authorization: `${s} ${tok}` },
          __authRetried: true,
          __usedAltScheme: s,
        };
        return await api.request(retried);
      } catch (e) {
        if (e?.response?.status !== 401) throw e; // other error => bubble up
        // else try next scheme
      }
    }

    // still 401 after trying alternates; just reject (NO logout here)
    return Promise.reject(error);
  }
);

/* ---------------- helpers ---------------- */
function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/* ---------------- Houses ---------------- */
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

/* ---------------- Allotments ---------------- */
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

export { api };
export default api;
