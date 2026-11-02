import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  CalendarDays,
  Flag,
  Home,
  Menu,
  Settings,
  StickyNote,
  Timer,
  Wallet,
} from 'lucide-react'
import { IconButton } from './ui'

export const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/habits', label: 'Habits', icon: Activity },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/goals', label: 'Goals', icon: Flag },
  { to: '/pomodoro', label: 'Pomodoro', icon: Timer },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </>
  )
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isDetail =
    location.pathname.startsWith('/notes/') ||
    location.pathname.startsWith('/pomodoro/') ||
    location.pathname.startsWith('/budget/') ||
    location.pathname.startsWith('/habits/')

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.querySelector<HTMLElement>('.drawer .nav-item')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">Clarity</div>
          <NavList />
        </div>
      </aside>

      <div className="main">
        {!isDetail && (
          <header className="topbar">
            <IconButton label="Open menu" onClick={() => setDrawerOpen(true)}>
              <Menu size={22} />
            </IconButton>
            <span className="topbar-title">Clarity</span>
            <IconButton label="Home" onClick={() => navigate('/')}>
              <Home size={20} />
            </IconButton>
          </header>
        )}

        <main className={`content ${isDetail ? 'content-detail' : ''}`}>
          <Outlet />
        </main>
      </div>

      {drawerOpen && (
        <>
          <div className="drawer-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
          <nav className="drawer" aria-label="Main navigation">
            <div className="brand">Clarity</div>
            <NavList onNavigate={() => setDrawerOpen(false)} />
          </nav>
        </>
      )}
    </div>
  )
}
