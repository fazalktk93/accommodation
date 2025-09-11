// frontend/src/api.js
import { getToken } from "./auth";

/* ---------------- core helpers ---------------- */

// Prefer env or a window override in prod; fall back to /api
const API_PREFIX =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

function buildUrl(path, params) {
  const url = new URL(API_PREFIX + (path.startsWith("/") ? path : `/${path}`), window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v)) v.forEach((it) => url.searchParams.append(k, String(it)));
      else url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

function jsonHeaders(extra = {}) {
  const h = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  });
  return h;
}

function addTokenHeaders(headers) {
  const tok = getToken?.();
  if (!tok) return headers;
  const h = new Headers(headers || {});
  if (!h.has("Authorization")) h.set("Authorization", `Bearer ${tok}`);
  if (!h.has("X-Auth-Token")) h.set("X-Auth-Token", tok);
  if (!h.has("X-Api-Token")) h.set("X-Api-Token", tok);
  return h;
}

async function doFetch({ method = "GET", path, params, body, headers }) {
  const url = buildUrl(path, params);
  const opts = {
    method,
    headers,
    credentials: "include",
  };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    if (!res.ok && res.status === 404 && method.toUpperCase() === "POST" && !/\/$/.test(path)) {
      const retryUrl = buildUrl(path + "/", params);
      return await fetch(retryUrl, opts);
    }
    return res;
  } catch (e) {
    throw e;
  }
}

/* ---------- robust request with fallbacks ---------- */
async function request(method, path, { params, data, headers } = {}) {
  const token = getToken?.();
  const baseHeaders = addTokenHeaders(jsonHeaders(headers));

  let res = await doFetch({ method, path, params, body: data, headers: baseHeaders });
  if (res.status !== 401 || !token) return res;

  for (const scheme of ["Token", "JWT"]) {
    const h = jsonHeaders(headers);
    h.set("Authorization", `${scheme} ${token}`);
    h.set("X-Auth-Token", token);
    h.set("X-Api-Token", token);
    res = await doFetch({ method, path, params, body: data, headers: h });
    if (res.status !== 401) return res;
  }

  const params1 = { ...(params || {}), token };
  res = await doFetch({ method, path, params: params1, body: data, headers: jsonHeaders(headers) });
  if (res.status !== 401) return res;

  const params2 = { ...(params || {}), access_token: token };
  res = await doFetch({ method, path, params: params2, body: data, headers: jsonHeaders(headers) });
  return res;
}

async function getJson(res) {
  if (res.ok) {
    if (res.status === 204) return null;
    try { return await res.json(); } catch { return null; }
  }
  let msg = `${res.status} ${res.statusText}`;
  try {
    const j = await res.json();
    msg = j?.detail || j?.message || msg;
  } catch {}
  const err = new Error(msg);
  err.status = res.status;
  throw err;
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/* ---------------- API surface ---------------- */
export async function listHouses(params = {}) {
  const res = await request("GET", "/houses", { params });
  return asList(await getJson(res));
}
export async function getHouse(id) {
  const res = await request("GET", `/houses/${id}`);
  return await getJson(res);
}
export async function createHouse(payload) {
  const res = await request("POST", "/houses", { data: payload });
  return await getJson(res);
}
export async function updateHouse(id, payload) {
  const res = await request("PATCH", `/houses/${id}`, { data: payload });
  return await getJson(res);
}
export async function deleteHouse(id) {
  const res = await request("DELETE", `/houses/${id}`);
  await getJson(res);
  return true;
}
export async function findHouseByFileNoStrict(file_no) {
  if (!file_no) throw new Error("file_no required");
  const res = await request("GET", `/houses/by-file/${encodeURIComponent(file_no)}`);
  return await getJson(res);
}
export async function patchHouseStatus(id, status, extra = {}) {
  const res = await request("PATCH", `/houses/${id}`, { data: { status, ...extra } });
  return await getJson(res);
}

export async function listAllotments(params = {}) {
  const res = await request("GET", "/allotments", { params });
  return asList(await getJson(res));
}
export async function getAllotment(id) {
  const res = await request("GET", `/allotments/${id}`);
  return await getJson(res);
}
export async function createAllotment(payload) {
  const res = await request("POST", "/allotments", { data: payload });
  return await getJson(res);
}
export async function updateAllotment(id, payload) {
  const res = await request("PATCH", `/allotments/${id}`, { data: payload });
  return await getJson(res);
}
export async function deleteAllotment(id) {
  const res = await request("DELETE", `/allotments/${id}`);
  await getJson(res);
  return true;
}
export async function listAllotmentsByFileNoStrict(file_no, { limit = 500, offset = 0 } = {}) {
  const res = await request("GET", "/allotments", { params: { file_no, limit, offset } });
  return asList(await getJson(res));
}

export async function listMovements(params = {}) {
  const res = await request("GET", "/files", { params });
  return asList(await getJson(res));
}
export async function issueFile(payload) {
  const res = await request("POST", "/files", { data: payload });
  return await getJson(res);
}
export async function returnFile(id, returned_date = null) {
  const res = await request("POST", `/files/${id}/return`, { data: { returned_date } });
  return await getJson(res);
}

export const api = { request, buildUrl };
export default api;
