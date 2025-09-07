// frontend/src/App.jsx
import { Routes, Route, NavLink } from 'react-router-dom'
import HousesPage from './pages/HousesPage'
import AllotmentsPage from './pages/AllotmentsPage'
import FilesPage from './pages/FilesPage'
import HouseAllotmentsPage from './pages/HouseAllotmentsPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { isLoggedIn, logout } from './auth'

export default function App() {
  const loggedIn = isLoggedIn()

  return (
    <div>
      <nav className="nav">
        <div className="container nav-inner">
          <div className="nav-left">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/">Houses</NavLink>
            <NavLink to="/allotments">Allotments</NavLink>
            <NavLink to="/files">File Movement</NavLink>
          </div>
          <div className="nav-right">
            {loggedIn ? (
              <button className="btn btn-logout" onClick={logout} title="Sign out">Logout</button>
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
          </Route>
        </Routes>
      </div>
    </div>
  )
}
