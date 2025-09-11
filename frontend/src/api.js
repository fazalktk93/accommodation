// frontend/src/api.js
import axios from "axios";
import { getToken } from "./auth";

// Utility to refresh axios headers after login/logout
export function refreshApiAuthHeaders() {
  const tok = getToken?.();
  if (tok) {
    api.defaults.headers.common.Authorization = `Bearer ${tok}`;
    api.defaults.headers.common["X-Auth-Token"] = tok;
    api.defaults.headers.common["X-Api-Token"] = tok;
  } else {
    delete api.defaults.headers.common.Authorization;
    delete api.defaults.headers.common["X-Auth-Token"];
    delete api.defaults.headers.common["X-Api-Token"];
  }
}

/**
 * Axios instance
 * DEV: baseURL '/api' (Vite proxy -> backend)
 * PROD: have the web server reverse-proxy '/api' to backend
 */
const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
  withCredentials: true, // <-- send cookies for cookie-based auth
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Attach auth headers before every request.
 * - Default Authorization: Bearer <token>
 * - Also set common alternates some backends accept: X-Auth-Token, X-Api-Token
 */
api.interceptors.request.use((config) => {
  const tok = getToken?.();
  if (tok) {
    config.headers = config.headers || {};
    // if a caller didn't already set Authorization, set a default
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${tok}`;
      config.__authScheme = "Bearer";
    }
    // add extra token headers for backends that look for custom names
    if (!config.headers["X-Auth-Token"]) config.headers["X-Auth-Token"] = tok;
    if (!config.headers["X-Api-Token"]) config.headers["X-Api-Token"] = tok;
  }
  return config;
});

/**
 * On 401:
 *  - DO NOT logout (avoids redirect loop).
 *  - Retry once with alternate schemes: 'Token' then 'JWT'.
 *  - If still 401, just reject so UI can show an error.
 */
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) return Promise.reject(error);
    if (response.status !== 401) return Promise.reject(error);

    // Avoid retrying auth endpoints themselves
    const url = String(config.url || "");
    const isAuthEndpoint =
      /\/auth\/(token|login|jwt\/login)|\/login\/access-token/i.test(url);
    if (isAuthEndpoint) return Promise.reject(error);

    // No token? Nothing to retry
    const tok = getToken?.();
    if (!tok) return Promise.reject(error);

    // Guard against infinite loops
    if (config.__authRetried) return Promise.reject(error);

    for (const scheme of ["Token", "JWT"]) {
      try {
        const retried = {
          ...config,
          headers: {
            ...(config.headers || {}),
            Authorization: `${scheme} ${tok}`,
            "X-Auth-Token": tok,
            "X-Api-Token": tok,
          },
          __authRetried: true,
          __usedAltScheme: scheme,
        };
        return await api.request(retried);
      } catch (e) {
        if (e?.response?.status !== 401) throw e; // non-401 => bubble up
        // else try next scheme
      }
    }

    return Promise.reject(error);
  }
);

/* ---------------- list helper ---------------- */
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
export async function issueFile(payload) {
  // some servers require trailing slash; try both
  try {
    const { data } = await api.post("/files", payload);
    return data;
  } catch (e) {
    const { data: altData } = await api.post("/files/", payload);
    return altData;
  }
}
export async function returnFile(id, returned_date = null) {
  const body = { returned_date };
  const { data } = await api.post(`/files/${id}/return`, body);
  return data;
}

export { api };
export default api;
