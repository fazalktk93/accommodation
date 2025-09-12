// frontend/src/api.js
// Mirrors backend routes and enforces each route's pagination constraints:
// - /houses/  -> { offset, limit<=200 }
// - /allotments/ -> { skip, limit<=1000 }
// - /files/ -> { skip, limit>=1 }
// Also provides aliases for old component imports.

import { getToken } from "./auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

// -------------------- helpers --------------------
function makeUrl(path, params) {
  const url = new URL(
    path.startsWith("http") ? path : API_BASE + (path.startsWith("/") ? path : "/" + path),
    (typeof window !== "undefined" ? window.location.origin : "http://localhost")
  );
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v)) v.forEach((vv) => url.searchParams.append(k, vv));
      else url.searchParams.set(k, v);
    });
  }
  return url.toString();
}

async function request(method, path, { params, data, headers } = {}) {
  const h = new Headers(headers || {});
  const token = getToken();
  if (token && !h.has("Authorization")) h.set("Authorization", `Bearer ${token}`);
  if (data != null && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (!h.has("Accept")) h.set("Accept", "application/json");

  let res = await fetch(makeUrl(path, params), {
    method,
    headers: h,
    body:
      data != null
        ? h.get("Content-Type")?.includes("json")
          ? JSON.stringify(data)
          : data
        : undefined,
    credentials: "include",
  });

  // fallback if someone configured /app-api but server serves /api
  if (res.status === 404 && API_BASE === "/app-api") {
    const fallback = makeUrl(path.replace(/^\/?/, "/").replace("/app-api/", "/api/"), params);
    res = await fetch(fallback, {
      method,
      headers: h,
      body:
        data != null
          ? h.get("Content-Type")?.includes("json")
            ? JSON.stringify(data)
            : data
          : undefined,
      credentials: "include",
    });
  }

  return res;
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

// Normalize pagination params for each resource
function normalizeHousesParams(params = {}) {
  const out = { ...params };
  // Accept page/pageSize or skip/offset; backend expects offset+limit (limit<=200)
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
  let limit = Number(
    params.limit ?? params.size ?? params.pageSize ?? 50
  );
  // clamp per backend: 1..200
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  out.offset = offset;
  out.limit = limit;

  // Pass through supported filters if present
  // (q, sector, type_code, status, sort, order)
  return out;
}

function normalizeAllotmentsParams(params = {}) {
  const out = { ...params };
  // Backend expects skip+limit (limit<=1000)
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
  if (limit > 1000) limit = 1000;
  if (!Number.isFinite(skip) || skip < 0) skip = 0;

  out.skip = skip;
  out.limit = limit;
  return out;
}

function normalizeFilesParams(params = {}) {
  const out = { ...params };
  // Backend expects skip+limit (limit>=1, backend default 5000)
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
export async function getHouses(params) {
  const qp = normalizeHousesParams(params);
  const res = await request("GET", "/houses/", { params: qp });
  return listify(await jsonOrText(res));
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
export async function getAllotments(params) {
  const qp = normalizeAllotmentsParams(params);
  const res = await request("GET", "/allotments/", { params: qp });
  return listify(await jsonOrText(res));
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
  const qp = normalizeFilesParams(params);
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
