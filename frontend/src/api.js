// frontend/src/api.js
// Mirrors backend routes under /api/* exactly, adds common aliases so pages don't break.

import { getToken } from "./auth";

// Base URL (prefers Vite env, then window override, then /api)
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

// ---------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------
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
    body: data != null ? (h.get("Content-Type")?.includes("json") ? JSON.stringify(data) : data) : undefined,
    credentials: "include",
  });

  // Auto-fallback if someone configured /app-api but server serves /api
  if (res.status === 404 && API_BASE === "/app-api") {
    let fallback = makeUrl(path.replace(/^\/?/, "/").replace("/app-api/", "/api/"), params);
    res = await fetch(fallback, {
      method,
      headers: h,
      body: data != null ? (h.get("Content-Type")?.includes("json") ? JSON.stringify(data) : data) : undefined,
      credentials: "include",
    });
  }

  return res;
}

async function jsonOrText(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

const listify = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// ---------------------------------------------------------
// AUTH  (/api/auth/*)  — backend exposes /auth/login, /auth/jwt/login, /auth/token, /auth/me
// ---------------------------------------------------------
export async function login(username, password) {
  // Try cookie-first login, then jwt, then oauth2 token, trying form+json
  const attempts = [
    { path: "/auth/login", type: "json" },
    { path: "/auth/login", type: "form" },
    { path: "/auth/jwt/login", type: "json" },
    { path: "/auth/jwt/login", type: "form" },
    { path: "/auth/token", type: "form" }, // OAuth2 token
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      const headers = new Headers();
      let body;
      if (a.type === "form") {
        headers.set("Content-Type", "application/x-www-form-urlencoded");
        body = new URLSearchParams({ username, password });
        const res = await request("POST", a.path, { headers, data: body });
        if (!res.ok) { lastErr = await res.text().catch(() => String(res.status)); continue; }
        return await jsonOrText(res);
      } else {
        headers.set("Content-Type", "application/json");
        const res = await request("POST", a.path, { headers, data: { username, password } });
        if (!res.ok) { lastErr = await res.text().catch(() => String(res.status)); continue; }
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

// ---------------------------------------------------------
// HEALTH
// ---------------------------------------------------------
export async function health() {
  const res = await request("GET", "/health");
  return await jsonOrText(res);
}

// ---------------------------------------------------------
// HOUSES  (/api/houses/*)
// ---------------------------------------------------------
export async function getHouses(params) {
  // backend defines @router.get("/") so include trailing slash
  const res = await request("GET", "/houses/", { params });
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
  // backend uses PATCH
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

// ---------------------------------------------------------
// ALLOTMENTS  (/api/allotments/*)
// ---------------------------------------------------------
export async function getAllotments(params) {
  const res = await request("GET", "/allotments/", { params });
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

// ---------------------------------------------------------
// FILE MOVEMENTS  (/api/files/*)
// ---------------------------------------------------------
export async function getFiles(params) {
  const res = await request("GET", "/files/", { params });
  return listify(await jsonOrText(res));
}
export const listFiles = getFiles;

export async function getFile(id) {
  const res = await request("GET", `/files/${id}`);
  return await jsonOrText(res);
}

export async function createFile(payload) {
  const res = await request("POST", "/files/", { data: payload });
  return await jsonOrText(res);
}
export const issueFile = createFile; // alias used in some pages

export async function updateFile(id, payload) {
  const res = await request("PATCH", `/files/${id}`, { data: payload });
  return await jsonOrText(res);
}
export const patchFile = updateFile;
export const editFile = updateFile;

export async function returnFile(id, returned_date = null) {
  const data = returned_date ? { returned_date } : {};
  const res = await request("POST", `/files/${id}/return`, { data });
  return await jsonOrText(res);
}

export async function deleteFile(id) {
  const res = await request("DELETE", `/files/${id}`);
  return await jsonOrText(res);
}
export const removeFile = deleteFile;

// ---------------------------------------------------------
// USERS  (/api/users/*) – backend exposes only list + create
// ---------------------------------------------------------
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

// ---------------------------------------------------------
export const api = { request, makeUrl };
export default api;
