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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ? children : <Outlet />;
}
