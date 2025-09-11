// frontend/src/api.js
import axios from "axios";
import { getToken } from "./auth";

/**
 * Axios instance
 * DEV: baseURL '/api' → Vite proxy routes to backend at :8000
 * PROD: your web server should reverse-proxy '/api' to the backend
 */
const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
  withCredentials: true, // send cookies for cookie-based auth backends
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/** Build Authorization + companion headers for a given scheme */
function buildAuthHeaders(token, scheme = "Bearer") {
  if (!token) return {};
  const h = {
    Authorization: `${scheme} ${token}`,
    "X-Auth-Token": token,
    "X-Api-Token": token,
  };
  return h;
}

/**
 * Generic request with robust auth fallbacks:
 *  1) First try: Bearer + token headers
 *  2) If 401: retry with Token, then JWT schemes
 *  3) If still 401: append ?token=... then ?access_token=...
 *  4) If 404 on POST without trailing slash: retry with trailing slash
 */
async function requestWithAuth(cfg) {
  const token = getToken?.();
  const tryConfigs = [];

  // Base attempt (Bearer + extra token headers)
  tryConfigs.push({
    ...cfg,
    headers: {
      ...(cfg.headers || {}),
      ...buildAuthHeaders(token, "Bearer"),
    },
  });

  // 401 fallbacks: alternate schemes
  if (token) {
    for (const scheme of ["Token", "JWT"]) {
      tryConfigs.push({
        ...cfg,
        headers: {
          ...(cfg.headers || {}),
          ...buildAuthHeaders(token, scheme),
        },
        __altScheme: scheme,
      });
    }
  }

  // Helper to actually fire a request with axios
  const doOne = async (conf) => {
    try {
      return await api.request(conf);
    } catch (err) {
      // if 404 on POST and no trailing slash, retry with trailing slash immediately
      const status = err?.response?.status;
      const method = String(conf.method || "get").toLowerCase();
      const url = String(conf.url || "");
      if (
        status === 404 &&
        method === "post" &&
        !url.endsWith("/") &&
        // avoid double slashes
        !url.includes("?")
      ) {
        const withSlash = { ...conf, url: url + "/" };
        return await api.request(withSlash);
      }
      throw err;
    }
  };

  // 1 & 2: run the header-based attempts
  for (let i = 0; i < tryConfigs.length; i++) {
    try {
      const res = await doOne(tryConfigs[i]);
      return res;
    } catch (e) {
      const status = e?.response?.status;
      if (status !== 401) throw e; // non-401 -> bubble up
      // else continue to next attempt
    }
  }

  // 3) query-param fallbacks for backends that only accept token in URL
  if (token) {
    const url = new URL(
      (cfg.url || "").replace(/^\//, ""),
      "http://placeholder" // base to use URL util safely; we'll strip host below
    );
    const qsFirst = url.search ? "&" : "?";
    const basePath = (cfg.url || "");
    const paramAttempts = [
      `${basePath}${qsFirst}token=${encodeURIComponent(token)}`,
      `${basePath}${qsFirst}access_token=${encodeURIComponent(token)}`,
    ];

    for (const u of paramAttempts) {
      try {
        const res = await api.request({ ...cfg, url: u, headers: { ...(cfg.headers || {}) } });
        return res;
      } catch (e) {
        const status = e?.response?.status;
        if (status !== 401) throw e;
      }
    }
  }

  // If we’re here, all auth variants failed
  // Just throw the last 401 so UI can show a friendly message
  const err = new Error("Unauthorized");
  err.status = 401;
  throw err;
}

/* ---------------- small list helper ---------------- */
function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/* ========== HOUSES ========== */
export async function listHouses(params = {}) {
  const { data } = await requestWithAuth({ method: "get", url: "/houses", params });
  return asList(data);
}
export async function getHouse(id) {
  const { data } = await requestWithAuth({ method: "get", url: `/houses/${id}` });
  return data;
}
export async function createHouse(payload) {
  const { data } = await requestWithAuth({ method: "post", url: "/houses", data: payload });
  return data;
}
export async function updateHouse(id, payload) {
  const { data } = await requestWithAuth({ method: "patch", url: `/houses/${id}`, data: payload });
  return data;
}
export async function deleteHouse(id) {
  await requestWithAuth({ method: "delete", url: `/houses/${id}` });
  return true;
}
export async function findHouseByFileNoStrict(file_no) {
  if (!file_no) throw new Error("file_no required");
  const { data } = await requestWithAuth({ method: "get", url: `/houses/by-file/${encodeURIComponent(file_no)}` });
  return data;
}
export async function patchHouseStatus(id, status, extra = {}) {
  const { data } = await requestWithAuth({ method: "patch", url: `/houses/${id}`, data: { status, ...extra } });
  return data;
}

/* ========== ALLOTMENTS ========== */
export async function listAllotments(params = {}) {
  const { data } = await requestWithAuth({ method: "get", url: "/allotments", params });
  return asList(data);
}
export async function getAllotment(id) {
  const { data } = await requestWithAuth({ method: "get", url: `/allotments/${id}` });
  return data;
}
export async function createAllotment(payload) {
  const { data } = await requestWithAuth({ method: "post", url: "/allotments", data: payload });
  return data;
}
export async function updateAllotment(id, payload) {
  const { data } = await requestWithAuth({ method: "patch", url: `/allotments/${id}`, data: payload });
  return data;
}
export async function deleteAllotment(id) {
  await requestWithAuth({ method: "delete", url: `/allotments/${id}` });
  return true;
}
export async function listAllotmentsByFileNoStrict(file_no, { limit = 500, offset = 0 } = {}) {
  const { data } = await requestWithAuth({ method: "get", url: "/allotments", params: { file_no, limit, offset } });
  return asList(data);
}

/* ========== FILES / MOVEMENTS ========== */
export async function listMovements(params = {}) {
  const { data } = await requestWithAuth({ method: "get", url: "/files", params });
  return asList(data);
}
/** Issue file (outgoing) — also retries with trailing slash if server needs it */
export async function issueFile(payload) {
  const { data } = await requestWithAuth({ method: "post", url: "/files", data: payload });
  return data;
}
/** Return file (incoming) */
export async function returnFile(id, returned_date = null) {
  const { data } = await requestWithAuth({ method: "post", url: `/files/${id}/return`, data: { returned_date } });
  return data;
}

export { api };
export default api;
