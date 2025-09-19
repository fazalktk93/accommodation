// frontend/src/routes.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

import HouseDetail from "./pages/HouseDetail";
import AllotmentEdit from "./pages/AllotmentEdit";
import HouseAllotmentHistory from "./pages/HouseAllotmentHistory";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import UsersPage from "./pages/UsersPage";

export default function AppRoutes() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/houses/:id"
            element={
              <ProtectedRoute>
                <HouseDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/houses/:houseId/allotments"
            element={
              <ProtectedRoute>
                <HouseAllotmentHistory />
              </ProtectedRoute>
            }
          />
          {/* legacy alias */}
          <Route
            path="/houses/:id/allotments"
            element={
              <ProtectedRoute>
                <HouseAllotmentHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/allotments/:id/edit"
            element={
              <ProtectedRoute>
                <AllotmentEdit />
              </ProtectedRoute>
            }
          />

          {/* Optional fallback:
          <Route path="*" element={<Navigate to="/dashboard" replace />} /> */}
          <Route path="/users" element={
            <ProtectedRoute roles={['admin','manager']}>
              <UsersPage />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </>

  );
}
