import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HouseDetail from './pages/HouseDetail'
import AllotmentEdit from './pages/AllotmentEdit'
import HouseAllotmentHistory from './pages/HouseAllotmentHistory' // ✅ add this

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* House details page (keep if you use it elsewhere) */}
        <Route path="/houses/:id" element={<HouseDetail />} />

        {/* ✅ history should render HouseAllotmentHistory */}
        <Route path="/houses/:houseId/allotments" element={<HouseAllotmentHistory />} />
        {/* ✅ legacy alias (if somewhere still links with :id) */}
        <Route path="/houses/:id/allotments" element={<HouseAllotmentHistory />} />

        {/* edit allotment */}
        <Route path="/allotments/:id/edit" element={<AllotmentEdit />} />

        {/* add a fallback as needed */}
      </Routes>
    </BrowserRouter>
  )
}
