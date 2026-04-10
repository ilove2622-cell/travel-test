import { Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Planner from './pages/Planner'
import Footprint from './pages/Footprint'
import Team from './pages/Team'
import My from './pages/My'
import TripDetail from './pages/TripDetail'
import './App.css'

function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trip/:id" element={<TripDetail />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/footprint" element={<Footprint />} />
          <Route path="/team" element={<Team />} />
          <Route path="/my" element={<My />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default App
