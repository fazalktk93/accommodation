// frontend/src/routes.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HouseDetail from "./pages/HouseDetail";
import AllotmentEdit from "./pages/AllotmentEdit";
import HouseAllotmentHistory from "./pages/HouseAllotmentHistory";
import Login from "./pages/Login";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* login page */}
        <Route path="/login" element={<Login />} />

        {/* House details */}
        <Route path="/houses/:id" element={<HouseDetail />} />

        {/* House allotment history */}
        <Route
          path="/houses/:houseId/allotments"
          element={<HouseAllotmentHistory />}
        />
        {/* legacy alias */}
        <Route
          path="/houses/:id/allotments"
          element={<HouseAllotmentHistory />}
        />

        {/* Allotment edit */}
        <Route path="/allotments/:id/edit" element={<AllotmentEdit />} />

        {/* you can add a default fallback route if needed */}
        {/* <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
