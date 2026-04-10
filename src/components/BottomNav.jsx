import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Bot, Map, Users, User } from 'lucide-react'
import './BottomNav.css'

const tabs = [
  { path: '/', label: '홈', icon: Home },
  { path: '/planner', label: 'AI플래너', icon: Bot },
  { path: '/footprint', label: '발자취', icon: Map },
  { path: '/team', label: '팀', icon: Users },
  { path: '/my', label: '마이', icon: User },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav">
      {tabs.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path
        return (
          <button
            key={path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
