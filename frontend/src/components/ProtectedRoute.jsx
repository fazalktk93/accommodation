// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

const Loader = () => <div style={{ padding: 16 }}>Loading…</div>;

export default function ProtectedRoute({ children }) {
  const { loading, isAuthed } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;

  if (!isAuthed) {
    // redirect to login and remember intended url
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // support both wrapped-children and nested routes
  return children ? children : <Outlet />;
}
