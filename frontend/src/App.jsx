import { Routes, Route, NavLink } from 'react-router-dom'
import HousesPage from './pages/HousesPage'
import AllotmentsPage from './pages/AllotmentsPage'
import FilesPage from './pages/FilesPage'
import HouseAllotmentsPage from './pages/HouseAllotmentsPage.jsx'

export default function App(){
  return (
    <div>
      <nav className="nav">
        <div className="container">
          <NavLink to="/">Houses</NavLink>
          <NavLink to="/allotments">Allotments</NavLink>
          <NavLink to="/files">File Movement</NavLink>
        </div>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<HousesPage/>} />
          <Route path="/allotments" element={<AllotmentsPage/>} />
          <Route path="/files" element={<FilesPage/>} />
          <Route path="/houses/:fileNo/allotments" element={<HouseAllotmentsPage/>} /> {/* NEW */}
        </Routes>
      </div>
    </div>
  )
}
