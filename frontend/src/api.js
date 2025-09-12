// frontend/src/api.js
import { getToken } from "./auth";

const API_PREFIX =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" && window.API_BASE_URL) ||
  "/api";

function buildUrl(path, params) {
  const url = new URL(
    API_PREFIX + (path.startsWith("/") ? path : `/${path}`),
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v)) v.forEach((vv) => url.searchParams.append(k, vv));
      else url.searchParams.set(k, v);
    });
  }
  return url.toString();
}

async function request(method, path, { params, data, headers } = {}) {
  const url = buildUrl(path, params);
  const h = new Headers(headers || {});
  const token = getToken();
  if (token && !h.has("Authorization")) h.set("Authorization", `Bearer ${token}`);
  if (data != null && !h.has("Content-Type")) h.set("Content-Type", "application/json");
  if (!h.has("Accept")) h.set("Accept", "application/json");

  let res = await fetch(url, {
    method,
    headers: h,
    body: data != null ? (h.get("Content-Type")?.includes("json") ? JSON.stringify(data) : data) : undefined,
    credentials: "include",
  });

  if (res.status === 404 && API_PREFIX === "/app-api") {
    const url2 = url.replace("/app-api/", "/api/");
    res = await fetch(url2, {
      method,
      headers: h,
      body: data != null ? (h.get("Content-Type")?.includes("json") ? JSON.stringify(data) : data) : undefined,
      credentials: "include",
    });
  }

  return res;
}

async function getJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

const asList = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// --- AUTH ---
export async function login(username, password) {
  const res = await request("POST", "/auth/login", { data: { username, password } });
  return await getJson(res);
}
export async function me() {
  const res = await request("GET", "/auth/me");
  return await getJson(res);
}

// --- HOUSES ---
export async function getHouses(params) {
  const res = await request("GET", "/houses", { params });
  return asList(await getJson(res));
}
// alias for compatibility
export const listHouses = getHouses;

export async function getHouse(id) {
  const res = await request("GET", `/houses/${id}`);
  return await getJson(res);
}
export async function createHouse(payload) {
  const res = await request("POST", "/houses", { data: payload });
  return await getJson(res);
}
export async function updateHouse(id, payload) {
  const res = await request("PUT", `/houses/${id}`, { data: payload });
  return await getJson(res);
}
export async function deleteHouse(id) {
  const res = await request("DELETE", `/houses/${id}`);
  return await getJson(res);
}

// --- ALLOTMENTS ---
export async function getAllotments(params) {
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
  const res = await request("PUT", `/allotments/${id}`, { data: payload });
  return await getJson(res);
}
export async function deleteAllotment(id) {
  const res = await request("DELETE", `/allotments/${id}`);
  return await getJson(res);
}

// --- FILES ---
export async function getFiles(params) {
  const res = await request("GET", "/files", { params });
  return asList(await getJson(res));
}
export async function getFile(id) {
  const res = await request("GET", `/files/${id}`);
  return await getJson(res);
}
export async function issueFile(payload) {
  const res = await request("POST", "/files", { data: payload });
  return await getJson(res);
}
export async function returnFile(id, returned_date = null) {
  const res = await request("POST", `/files/${id}/return`, { data: { returned_date } });
  return await getJson(res);
}
export async function deleteFile(id) {
  const res = await request("DELETE", `/files/${id}`);
  return await getJson(res);
}

// --- USERS (optional if backend exposes) ---
export async function getUsers(params) {
  const res = await request("GET", "/users", { params });
  return asList(await getJson(res));
}
export async function getUser(id) {
  const res = await request("GET", `/users/${id}`);
  return await getJson(res);
}
export async function createUser(payload) {
  const res = await request("POST", "/users", { data: payload });
  return await getJson(res);
}
export async function updateUser(id, payload) {
  const res = await request("PUT", `/users/${id}`, { data: payload });
  return await getJson(res);
}
export async function deleteUser(id) {
  const res = await request("DELETE", `/users/${id}`);
  return await getJson(res);
}

export const api = { request, buildUrl };
export default api;
