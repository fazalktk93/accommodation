// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { hasPerm } from '../authz';

const Loader = () => <div style={{ padding: 16 }}>Loading…</div>;

/**
 * Route guard with optional permission checks.
 *
 * Props:
 * - requirePerm: string | undefined        -> single permission required
 * - anyOf: string[] | undefined            -> at least one permission required
 * - allOf: string[] | undefined            -> all permissions required
 * - fallback: string | undefined           -> where to send users lacking perms (default: "/dashboard")
 *
 * Usage:
 * <ProtectedRoute requirePerm="allotments:update">
 *   <EditAllotmentPage />
 * </ProtectedRoute>
 *
 * or as a wrapper for nested routes:
 * <Route element={<ProtectedRoute anyOf={['houses:update','houses:delete']} />}>
 *   ...
 * </Route>
 */
export default function ProtectedRoute({
  children,
  requirePerm,
  anyOf,
  allOf,
  fallback = '/dashboard',
}) {
  const { loading, isAuthed } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;

  // not authenticated -> go to login and remember where we were headed
  if (!isAuthed) {
    const intended =
      (location.pathname || '/') + (location.search || '') + (location.hash || '');
    return <Navigate to="/login" replace state={{ from: intended }} />;
  }

  // ----- permission checks (optional) -----
  const hasAny = (list) => Array.isArray(list) && list.some((p) => hasPerm(p));
  const hasAll = (list) => Array.isArray(list) && list.every((p) => hasPerm(p));

  let allowed = true;
  if (requirePerm) allowed = hasPerm(requirePerm);
  if (allowed && anyOf?.length) allowed = hasAny(anyOf);
  if (allowed && allOf?.length) allowed = hasAll(allOf);

  if (!allowed) {
    // authenticated but unauthorized -> bump to a safe page
    return <Navigate to={fallback} replace state={{ deniedFrom: location }} />;
  }

  // support both wrapped-children and nested routes
  return children ? children : <Outlet />;
}
