// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { hasPerm } from '../authz';

const Loader = () => <div style={{ padding: 16 }}>Loading…</div>;

/**
 * Route guard with optional role + permission checks.
 *
 * Props:
 * - roles?: string[]                       -> user.role must be one of these (e.g., ['admin','manager'])
 * - requirePerm?: string                   -> single permission required
 * - anyOf?: string[]                       -> at least one permission required
 * - allOf?: string[]                       -> all permissions required
 * - fallback?: string                      -> redirect if unauthorized (default: "/dashboard")
 *
 * Usage:
 * <ProtectedRoute roles={['admin','manager']}>
 *   <UsersPage />
 * </ProtectedRoute>
 *
 * <ProtectedRoute requirePerm="allotments:update">
 *   <EditAllotmentPage />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({
  children,
  roles,
  requirePerm,
  anyOf,
  allOf,
  fallback = '/dashboard',
}) {
  const { loading, isAuthed, user } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;

  if (!isAuthed) {
    const intended = (location.pathname || '/') + (location.search || '') + (location.hash || '');
    return <Navigate to="/login" replace state={{ from: intended }} />;
  }

  // ---- role check (new) ----
  let allowed = true;
  if (Array.isArray(roles) && roles.length) {
    const role = user?.role?.toLowerCase?.();
    const allowedRoles = roles.map((r) => String(r).toLowerCase());
    allowed = !!role && allowedRoles.includes(role);
  }

  // ---- permission checks (existing) ----
  const hasAny = (list) => Array.isArray(list) && list.some((p) => hasPerm(p));
  const hasAll = (list) => Array.isArray(list) && list.every((p) => hasPerm(p));

  if (allowed && requirePerm) allowed = hasPerm(requirePerm);
  if (allowed && anyOf?.length) allowed = hasAny(anyOf);
  if (allowed && allOf?.length) allowed = hasAll(allOf);

  if (!allowed) return <Navigate to={fallback} replace state={{ deniedFrom: location }} />;

  return children ? children : <Outlet />;
}
