import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HouseDetail from './pages/HouseDetail'
import AllotmentEdit from './pages/AllotmentEdit'
// import other pages as your app needs (Houses list, etc.)

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* your existing routes */}
        <Route path="/houses/:id/allotments" element={<HouseDetail />} />
        <Route path="/allotments/:id/edit" element={<AllotmentEdit />} />
        {/* add a fallback as needed */}
      </Routes>
    </BrowserRouter>
  )
}
