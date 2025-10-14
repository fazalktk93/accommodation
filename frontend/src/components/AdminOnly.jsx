// src/components/AdminOnly.jsx
import React from "react";
import { useAuth } from "../context/AuthProvider";

/**
 * Renders children only if the current user is an admin.
 * Recognizes shapes:
 *   user.role === "admin"
 *   user.user.role === "admin"
 *   user.roles includes "admin"
 *   user.is_admin / isAdmin / is_superuser === true
 *   user.permissions (or user.user.permissions) includes "admin"/"superuser"/"users.manage"
 * DEV: set VITE_FORCE_ADMIN=1 to always show admin UI in dev.
 */
export default function AdminOnly({ children, fallback = null, force = false }) {
  const devForce = import.meta?.env?.VITE_FORCE_ADMIN === "1";
  const { user, loading } = useAuth?.() ?? { user: null, loading: false };

  if (loading) return null; // avoid flicker while auth state is resolving

  const u = user ?? {};

  // Normalize role
  const role =
    (u.role ??
     u.user?.role ??
     (Array.isArray(u.roles) ? u.roles[0] : null) ??
     "").toString().toLowerCase();

  // Normalize roles array
  const roles = (Array.isArray(u.roles) ? u.roles : [])
    .concat(Array.isArray(u.user?.roles) ? u.user.roles : [])
    .map((r) => String(r).toLowerCase());

  // Normalize permissions
  const perms = (Array.isArray(u.permissions) ? u.permissions : [])
    .concat(Array.isArray(u.user?.permissions) ? u.user.permissions : [])
    .map((p) => String(p).toLowerCase());

  const flagAdmin =
    u.is_admin === true ||
    u.isAdmin === true ||
    u.is_superuser === true ||
    u.isSuperuser === true;

  const isAdmin =
    force ||
    devForce ||
    flagAdmin ||
    role === "admin" ||
    roles.includes("admin") ||
    roles.includes("superuser") ||
    perms.includes("admin") ||
    perms.includes("superuser") ||
    perms.includes("users.manage") ||
    perms.includes("users:manage");

  return isAdmin ? children : fallback;
}
