// frontend/src/authz.js
import { authFetch } from "./auth";

let _user = null;
let _perms = new Set();

/**
 * UI permission keys used across pages:
 *   houses:read|create|update|delete
 *   allotments:read|create|update|delete
 *   files:read|create|update|delete
 *   users:read|create|update|delete
 *
 * NOTE: Backend also provides permissions like "house.edit", "allotment.delete", etc.
 * We normalize those into the UI format as well.
 */

// ---- role -> UI permissions (keep simple) ----
const ROLE_PERMS = {
  admin: [
    "houses:read", "houses:create", "houses:update", "houses:delete",
    "allotments:read", "allotments:create", "allotments:update", "allotments:delete",
    "files:read", "files:create", "files:update", "files:delete",
    "users:read", "users:create", "users:update", "users:delete",
  ],
  // 👇 Your backend uses "manager", not "editor". Give managers create/update but no delete.
  manager: [
    "houses:read", "houses:create", "houses:update",
    "allotments:read", "allotments:create", "allotments:update",
    "files:read", "files:create", "files:update",
    "users:read",
  ],
  viewer: [
    "houses:read", "allotments:read", "files:read", "users:read",
  ],
};

// ---- map backend perms like "house.edit" -> UI keys like "houses:update" ----
function mapBackendPerm(p) {
  if (!p || typeof p !== "string") return null;
  const [domain, action] = p.toLowerCase().split(".", 2);
  if (!domain || !action) return null;

  // pluralize domain to match UI keys
  const plural = {
    house: "houses",
    allotment: "allotments",
    file: "files",
    user: "users",
  }[domain] || `${domain}s`;

  // normalize action names
  const act = {
    view: "read",
    create: "create",
    edit: "update",
    update: "update",
    delete: "delete",
    export: "export",
    return: "update",
  }[action] || action;

  return `${plural}:${act}`;
}

// ---- role extraction from various server payload shapes ----
function extractRoles(data) {
  const r = data?.role || data?.roles || data?.data?.roles || [];
  if (Array.isArray(r)) return r.map(String);
  if (typeof r === "string") return [r];
  return [];
}

// ---- main builder: union of role-based + backend permissions ----
function buildPerms(user) {
  const p = new Set();

  // 1) role-based
  const roles = extractRoles(user).map((x) => String(x || "").toLowerCase());
  const effectiveRoles = roles.length ? roles : ["viewer"];
  effectiveRoles.forEach((r) => (ROLE_PERMS[r] || []).forEach((k) => p.add(k)));

  // 2) backend-provided fine-grained perms (if any)
  const raw = Array.isArray(user?.permissions) ? user.permissions : [];
  raw.map(mapBackendPerm).filter(Boolean).forEach((k) => p.add(k));

  return p;
}

// ---- public API ----
export function hasPerm(key) { return _perms.has(key); }
export function currentUser() { return _user; }

// Re-fetch current user from the API and rebuild permission set
export async function refreshAuthz() {
  // Try common who-am-I endpoints; any 200 will do
  const paths = ["/auth/me", "/users/me", "/me"];
  for (const p of paths) {
    try {
      const res = await authFetch(p);
      if (!res.ok) continue;
      const data = await res.json();
      _user = data?.user || data;      // accept {user:{...}} or plain user
      _perms = buildPerms(_user);
      return _user;
    } catch {
      // ignore and try next
    }
  }
  _user = null;
  _perms = buildPerms(null);
  return null;
}

// Initialize once on app start (optional; caller can also call refreshAuthz)
(async () => { try { await refreshAuthz(); } catch {} })();
