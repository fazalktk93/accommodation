// src/components/AdminOnly.jsx
import React from "react";
import { useAuth } from "../context/AuthProvider";

/**
 * Renders children only if the current user is an admin.
 * Recognizes several common shapes:
 *   user.role === "admin"
 *   user.is_admin === true
 *   user.isAdmin === true
 *   user.is_superuser === true
 *   user.permissions includes "admin"
 * DEV helper: set VITE_FORCE_ADMIN=1 to always show admin UI in dev.
 */
export default function AdminOnly({ children, fallback = null }) {
  const force = import.meta?.env?.VITE_FORCE_ADMIN === "1";
  const ctx = typeof useAuth === "function" ? useAuth() : { user: null };
  const u = ctx?.user || {};
  const role = (u.role || u.user?.role || "").toString().toLowerCase();
  const perms = Array.isArray(u.permissions) ? u.permissions.map((p) => String(p).toLowerCase()) : [];
  const isAdmin =
    force ||
    role === "admin" ||
    u.is_admin === true ||
    u.isAdmin === true ||
    u.is_superuser === true ||
    perms.includes("admin") ||
    perms.includes("superuser") ||
    perms.includes("manage");

  return isAdmin ? children : fallback;
}
