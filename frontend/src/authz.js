// frontend/src/authz.js
import { authFetch, api } from "./auth";

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
  viewer: [
    "houses:read","allotments:read","files:read",
  ],
};

// normalize roles in api responses
function extractRoles(data) {
  const r = data?.role || data?.roles || data?.data?.roles || [];
  if (Array.isArray(r)) return r.map(String);
  if (typeof r === "string") return [r];
  return [];
}

function buildPerms(user) {
  const roles = extractRoles(user);
  const p = new Set();
  if (!roles.length) {
    // default: viewer perms for anonymous
    ROLE_PERMS.viewer.forEach((x) => p.add(x));
    return p;
  }
  roles.forEach((role) => {
    const list = ROLE_PERMS[role?.toLowerCase()] || [];
    list.forEach((x) => p.add(x));
  });
  return p;
}

export async function loadMe() {
  // try common endpoints; never throw, never logout here
  const endpoints = [api("/auth/me"), api("/users/me"), api("/me")];
  for (const url of endpoints) {
    try {
      const res = await authFetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      _user = data;
      _perms = buildPerms(data);
      return _user;
    } catch {
      // keep trying others
    }
  }
  // anonymous fallback
  _user = null;
  _perms = buildPerms(null);
  return null;
}

export function hasPerm(p) {
  return _perms.has(p);
}
export function currentUser() {
  return _user;
}
