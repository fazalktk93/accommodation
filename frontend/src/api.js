// frontend/src/api.js
// Full client for your backend, with:
// - Transparent chunked fetch for Houses/Allotments/Files (same API as before)
// - One-time 401 retry after /auth/me check
// - CSRF header from cookie (x-csrf-token)
// - Small network retry with backoff + request timeout
// - Aliases kept so older pages don’t break

import { getToken } from "./auth";

const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

// Normalize once (leading slash, no trailing slash)
function normalizeApiBase(b) {
  if (!b) return "/api";
  if (!/^https?:\/\//i.test(b) && !b.startsWith("/")) b = "/" + b;  // <-- stops "api/..." bug
  b = b.replace(/\/+$/g, "");                                       // strip trailing slashes
  return b;
}
const API_BASE = normalizeApiBase(RAW_BASE);

// -------------------- helpers --------------------
function readCsrfCookie() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function makeUrl(path, params) {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  // absolute URL? just use it
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([k, v]) => {
        if (v == null || v === "") return;
        Array.isArray(v) ? v.forEach((vv) => url.searchParams.append(k, vv)) : url.searchParams.set(k, v);
      });
    }
    return url.toString();
  }

  // normalize relative paths and avoid "/api/api/*"
  let rel = path.startsWith("/") ? path : `/${path}`;
  if (rel.startsWith("/api/") && /\/api$/i.test(API_BASE)) rel = rel.slice(4); // drop the leading "/api"

  // avoid "//" when API_BASE is "/api" and origin already ends with "/"
  const base = `${API_BASE}${rel}`.replace(/([^:])\/{2,}/g, "$1/");

  const url = new URL(base, origin);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v)) v.forEach((vv) => url.searchParams.append(k, vv));
      else url.searchParams.set(k, v);
    });
  }
  return url.toString();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rawFetch(method, path, { params, data, headers, timeoutMs = 30000, signal } = {}) {
  const h = new Headers(headers || {});
  const token = getToken();
  if (token && !h.has("Authorization")) h.set("Authorization", `Bearer ${token}`);
  const csrf = readCsrfCookie();
  if (csrf && !h.has("x-csrf-token")) h.set("x-csrf-token", csrf);
  if (data != null && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (!h.has("Accept")) h.set("Accept", "application/json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  const compositeSignal = signal
    ? new AbortController()
    : null;

  if (compositeSignal) {
    // fuse external and our controller; abort if either aborts
    const onAbort = () => controller.abort(signal.reason || new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const res = await fetch(makeUrl(path, params), {
      method,
      headers: h,
      body:
        data != null
          ? h.get("Content-Type")?.includes("json")
            ? JSON.stringify(data)
            : data
          : undefined,
      credentials: "include",
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// One-time 401 retry after /auth/me to refresh/confirm session + small backoff on network failures
async function request(method, path, opts = {}) {
  let attempt = 0;
  const maxNetRetries = 1; // small backoff for flaky networks
  const backoff = [250];   // ms

  while (true) {
    try {
      let res = await rawFetch(method, path, opts);
      if (res.status !== 401) return res;

      // Try to confirm/refresh session, then retry once
      try {
        const me = await rawFetch("GET", "/auth/me", { timeoutMs: 10000 });
        if (me.ok) {
          res = await rawFetch(method, path, opts);
        }
      } catch {
        /* ignore */
      }
      return res;
    } catch (e) {
      // network error (fetch threw) → small controlled retry
      if (attempt < maxNetRetries) {
        await sleep(backoff[Math.min(attempt, backoff.length - 1)]);
        attempt += 1;
        continue;
      }
      throw e;
    }
  }
}

async function jsonOrText(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}
const listify = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// -------------------- pagination normalizers --------------------
function normHouses(params = {}) {
  const out = { ...params };
  const page = Number(params.page ?? params.p);
  const pageSize = Number(params.pageSize ?? params.ps);
  let offset =
    params.offset != null
      ? Number(params.offset)
      : params.skip != null
      ? Number(params.skip)
      : Number.isFinite(page) && Number.isFinite(pageSize)
      ? Math.max(0, page * pageSize)
      : Number(params.offset ?? 0);
  let limit = Number(params.limit ?? params.size ?? params.pageSize ?? 50);
  if (!Number.isFinite(limit) || limit < 1) limit = 5000;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  out.offset = offset;
  out.limit = limit;
  return out;
}
function normAllotments(params = {}) {
  const out = { ...params };
  const page = Number(params.page ?? params.p);
  const pageSize = Number(params.pageSize ?? params.ps);
  let skip =
    params.skip != null
      ? Number(params.skip)
      : params.offset != null
      ? Number(params.offset)
      : Number.isFinite(page) && Number.isFinite(pageSize)
      ? Math.max(0, page * pageSize)
      : 0;
  let limit = Number(params.limit ?? params.size ?? params.pageSize ?? 100);
  if (!Number.isFinite(limit) || limit < 1) limit = 100;
  if (!Number.isFinite(skip) || skip < 0) skip = 0;
  out.skip = skip;
  out.limit = limit;
  return out;
}
function normFiles(params = {}) {
  const out = { ...params };
  const page = Number(params.page ?? params.p);
  const pageSize = Number(params.pageSize ?? params.ps);
  let skip =
    params.skip != null
      ? Number(params.skip)
      : params.offset != null
      ? Number(params.offset)
      : Number.isFinite(page) && Number.isFinite(pageSize)
      ? Math.max(0, page * pageSize)
      : 0;
  let limit = Number(params.limit ?? params.size ?? params.pageSize ?? 5000);
  if (!Number.isFinite(limit) || limit < 1) limit = 5000;
  if (!Number.isFinite(skip) || skip < 0) skip = 0;
  out.skip = skip;
  out.limit = limit;
  return out;
}

// -------------------- AUTH --------------------
export async function login(username, password) {
  const attempts = [
    { path: "/auth/login", type: "json" },
    { path: "/auth/login", type: "form" },
    { path: "/auth/jwt/login", type: "json" },
    { path: "/auth/jwt/login", type: "form" },
    { path: "/auth/token", type: "form" },
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      const headers = new Headers();
      if (a.type === "form") {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
        const res = await request("POST", a.path, {
          headers,
          data: new URLSearchParams({ username, password }),
        });
        if (!res.ok) {
          lastErr = await res.text().catch(() => String(res.status));
          continue;
        }
        return await jsonOrText(res);
      } else {
        headers.set("Content-Type", "application/json");
        const res = await request("POST", a.path, {
          headers,
          data: { username, password },
        });
        if (!res.ok) {
          lastErr = await res.text().catch(() => String(res.status));
          continue;
        }
        return await jsonOrText(res);
      }
    } catch (e) {
      lastErr = String(e);
    }
  }
  throw new Error(lastErr || "Login failed");
}

export async function me() {
  const res = await request("GET", "/auth/me");
  return await jsonOrText(res);
}

// -------------------- HEALTH --------------------
export async function health() {
  const res = await request("GET", "/health");
  return await jsonOrText(res);
}

// -------------------- HOUSES (/api/houses/*) --------------------
// If asked for limit <= 200 → single call.
// If asked for limit > 200 → chunk into multiple calls of 200 and merge.
export async function getHouses(params) {
  const qp = normHouses(params);
  const MAX_PER_CALL = 200; // backend validation cap

  const want = qp.limit;
  const start = qp.offset;

  if (want <= MAX_PER_CALL) {
    const res = await request("GET", "/houses/", { params: { ...qp, limit: Math.min(want, MAX_PER_CALL) } });
    return listify(await jsonOrText(res));
  }

  // multi-chunk
  const chunks = [];
  let fetched = 0;
  while (fetched < want) {
    const thisLimit = Math.min(MAX_PER_CALL, want - fetched);
    const thisOffset = start + fetched;
    const res = await request("GET", "/houses/", { params: { ...qp, offset: thisOffset, limit: thisLimit } });
    if (!res.ok) {
      const errBody = await jsonOrText(res);
      throw new Error(typeof errBody === "string" ? errBody : JSON.stringify(errBody));
    }
    const data = listify(await jsonOrText(res));
    chunks.push(...data);
    if (data.length < thisLimit) break; // no more rows on server
    fetched += thisLimit;
  }
  return chunks;
}
export const listHouses = getHouses;

export async function getHouse(id) {
  const res = await request("GET", `/houses/${id}`);
  return await jsonOrText(res);
}

export async function createHouse(payload) {
  const res = await request("POST", "/houses/", { data: payload });
  return await jsonOrText(res);
}

export async function updateHouse(id, payload) {
  const res = await request("PATCH", `/houses/${id}`, { data: payload });
  return await jsonOrText(res);
}
export const patchHouse = updateHouse;
export const editHouse = updateHouse;

export async function deleteHouse(id) {
  const res = await request("DELETE", `/houses/${id}`);
  return await jsonOrText(res);
}
export const removeHouse = deleteHouse;

// -------------------- ALLOTMENTS (/api/allotments/*) --------------------
// If limit <= 10000 → single call. If > 10000 → chunked fetch in 10000s and merge.
export async function getAllotments(params) {
  const qp = normAllotments(params);
  const MAX_PER_CALL = 10000; // matches backend: Query(..., le=10000)

  const want = qp.limit;
  const start = qp.skip ?? qp.offset ?? 0;

  if (want <= MAX_PER_CALL) {
    const res = await request("GET", "/allotments/", {
      params: { ...qp, limit: Math.min(want, MAX_PER_CALL) },
    });
    return listify(await jsonOrText(res));
  }

  // multi-chunk fetch
  const chunks = [];
  let fetched = 0;
  while (fetched < want) {
    const thisLimit = Math.min(MAX_PER_CALL, want - fetched);
    const thisSkip = start + fetched;
    const res = await request("GET", "/allotments/", {
      params: { ...qp, skip: thisSkip, limit: thisLimit },
    });
    if (!res.ok) {
      const errBody = await jsonOrText(res);
      throw new Error(typeof errBody === "string" ? errBody : JSON.stringify(errBody));
    }
    const data = listify(await jsonOrText(res));
    chunks.push(...data);
    if (data.length < thisLimit) break; // no more rows on server
    fetched += thisLimit;
  }
  return chunks;
}
export const listAllotments = getAllotments;

export async function getAllotment(id) {
  const res = await request("GET", `/allotments/${id}`);
  return await jsonOrText(res);
}

export async function createAllotment(payload) {
  const res = await request("POST", "/allotments/", { data: payload });
  return await jsonOrText(res);
}
export const addAllotment = createAllotment;

export async function updateAllotment(id, payload) {
  const res = await request("PATCH", `/allotments/${id}`, { data: payload });
  return await jsonOrText(res);
}
export const patchAllotment = updateAllotment;
export const editAllotment = updateAllotment;

export async function deleteAllotment(id) {
  const res = await request("DELETE", `/allotments/${id}`);
  return await jsonOrText(res);
}
export const removeAllotment = deleteAllotment;

// -------------------- FILE MOVEMENTS (/api/files/*) --------------------
export async function getFiles(params) {
  const qp = normFiles(params);
  const res = await request("GET", "/files/", { params: qp });
  return listify(await jsonOrText(res));
}
export const listFiles = getFiles;
export const listMovements = getFiles;

export async function getFile(id) {
  const res = await request("GET", `/files/${id}`);
  return await jsonOrText(res);
}
export const getMovement = getFile;

export async function createFile(payload) {
  const res = await request("POST", "/files/", { data: payload });
  return await jsonOrText(res);
}
export const issueFile = createFile;
export const createMovement = createFile;

export async function updateFile(id, payload) {
  const res = await request("PATCH", `/files/${id}`, { data: payload });
  return await jsonOrText(res);
}
export const patchFile = updateFile;
export const editFile = updateFile;
export const updateMovement = updateFile;

export async function returnFile(id, returned_date = null) {
  const data = returned_date ? { returned_date } : {};
  const res = await request("POST", `/files/${id}/return`, { data });
  return await jsonOrText(res);
}
export const returnMovement = returnFile;

export async function deleteFile(id) {
  const res = await request("DELETE", `/files/${id}`);
  return await jsonOrText(res);
}
export const removeFile = deleteFile;
export const deleteMovement = deleteFile;

// -------------------- USERS (/api/users/*) --------------------
export async function getUsers(params) {
  const res = await request("GET", "/users/", { params });
  return listify(await jsonOrText(res));
}
export const listUsers = getUsers;

export async function createUser(payload) {
  const res = await request("POST", "/users/", { data: payload });
  return await jsonOrText(res);
}
export const addUser = createUser;

// -------------------- export low-level helpers --------------------
export const api = { request, makeUrl };
export default api;
