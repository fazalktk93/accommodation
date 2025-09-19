// frontend/src/App.jsx
import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import HousesPage from './pages/HousesPage';
import AllotmentsPage from './pages/AllotmentsPage';
import FilesPage from './pages/FilesPage';
import HouseAllotmentsPage from './pages/HouseAllotmentsPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HouseAllotmentHistory from "./pages/HouseAllotmentHistory";
import { useAuth } from './context/AuthProvider'; // <-- use context (not raw isLoggedIn/logout)

// 👇 ADDED: Users page
import UsersPage from './pages/UsersPage.jsx';

export default function App() {
  // 👇 CHANGED: also pull `user` so we can show the Users link only for admin/manager
  const { loading, isAuthed, signout, user } = useAuth();

  // 👇 ADDED: simple role check
  const canManageUsers = !!user && (user.role === 'admin' || user.role === 'manager');

  return (
    <div>
      <nav className="nav">
        <div className="container nav-inner">
          <div className="nav-left">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/">Houses</NavLink>
            <NavLink to="/allotments">Allotments</NavLink>
            <NavLink to="/files">File Movement</NavLink>
            {/* 👇 ADDED: show Users link only to admin/manager */}
            {canManageUsers && <NavLink to="/users">Users</NavLink>}
          </div>
          <div className="nav-right">
            {loading ? (
              <span style={{ opacity: 0.6 }}>…</span>
            ) : isAuthed ? (
              <button className="btn btn-logout" onClick={signout} title="Sign out">
                Logout
              </button>
            ) : (
              <NavLink to="/login">Login</NavLink>
            )}
          </div>
        </div>
      </nav>

      <div className="container">
        <Routes>
          {/* public */}
          <Route path="/login" element={<Login />} />

          {/* protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<HousesPage />} />
            <Route path="/allotments" element={<AllotmentsPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/houses/:fileNo/allotments" element={<HouseAllotmentsPage />} />
            <Route path="/history/file/:fileNo" element={<HouseAllotmentHistory />} />
            <Route path="/history/house/:houseId" element={<HouseAllotmentHistory />} />

            {/* 👇 ADDED: Users page route; only admin/manager can access */}
            <Route
              path="/users"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </div>
    </div>
  );
}
