// frontend/src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'
import { isLoggedIn } from '../auth'

export default function ProtectedRoute() {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
