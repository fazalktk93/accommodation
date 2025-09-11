// frontend/src/authz.js
import { authFetch, getToken } from "./auth";

let _user = null;
let _perms = new Set();

const ROLE_PERMS = {
  admin: [
    "houses:read","houses:create","houses:update","houses:delete",
    "allotments:read","allotments:create","allotments:update","allotments:delete",
    "files:read","files:create","files:update","files:delete",
  ],
  editor: [
    "houses:read","houses:update",
    "allotments:read","allotments:create","allotments:update",
    "files:read","files:create","files:update",
  ],
  viewer: ["houses:read","allotments:read","files:read"],
};

function extractRoles(data) {
  const r = data?.role || data?.roles || data?.data?.roles || [];
  if (Array.isArray(r)) return r.map(String);
  if (typeof r === "string") return [r];
  return [];
}
function buildPerms(user) {
  const roles = extractRoles(user);
  const p = new Set();
  if (!roles.length) { ROLE_PERMS.viewer.forEach((x) => p.add(x)); return p; }
  roles.forEach((role) => (ROLE_PERMS[role?.toLowerCase()] || []).forEach((x) => p.add(x)));
  return p;
}

/** Bootstrap current user *only if* we already have a token. */
export async function loadMe() {
  if (!getToken()) { _user = null; _perms = buildPerms(null); return null; }
  const endpoints = ["/auth/me", "/users/me", "/me"]; // relative: authFetch will prefix /api
  for (const path of endpoints) {
    try {
      const res = await authFetch(path);
      if (!res.ok) continue; // ignore 401/404/etc.
      const data = await res.json();
      _user = data;
      _perms = buildPerms(data);
      return _user;
    } catch {}
  }
  _user = null;
  _perms = buildPerms(null);
  return null;
}

export function hasPerm(p) { return _perms.has(p); }
export function currentUser() { return _user; }
