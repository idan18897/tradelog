import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLang } from '../context/LanguageContext'

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)
const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export default function TopNav() {
  const { user, logout } = useAuth()
  const { isDark, toggle: toggleTheme } = useTheme()
  const { t } = useLang()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const navItems = [
    { to: '/', label: t.dashboard, end: true },
    { to: '/journal', label: t.journal },
    { to: '/new', label: t.newTrade },
  ]

  const navLinkStyle = ({ isActive }) => ({
    padding: '6px 14px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
    letterSpacing: '-0.01em',
    color: isActive ? 'var(--text)' : 'var(--text-muted)',
    textDecoration: 'none',
    borderRadius: '20px',
    background: isActive ? 'var(--card)' : 'transparent',
    boxShadow: isActive ? 'var(--shadow)' : 'none',
    transition: 'color 0.15s, background 0.15s',
    whiteSpace: 'nowrap',
  })

  const iconBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: '6px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s, color 0.15s',
  }

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  return (
    <>
    <style>{`
      @media (max-width: 600px) {
        .topnav-desktop-nav { display: none !important; }
        .topnav-bottom { display: flex !important; }
      }
      @media (min-width: 601px) {
        .topnav-bottom { display: none !important; }
      }
    `}</style>
    <header style={{
      background: 'var(--bg)',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 40,
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Top row */}
      <div style={{ height: '60px', display: 'flex', alignItems: 'center', paddingLeft: '16px', paddingRight: '16px' }}>
        {/* Logo — left */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate('/')}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/logo-light.png" alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        {/* Nav pill — absolute center (desktop only) */}
        <nav className="topnav-desktop-nav" style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '30px',
          padding: '4px',
          boxShadow: 'var(--shadow)',
        }}>
          {navItems.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} style={navLinkStyle}
              onMouseEnter={e => { if (!e.currentTarget.style.boxShadow || e.currentTarget.style.boxShadow === 'none') e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!e.currentTarget.style.boxShadow || e.currentTarget.style.boxShadow === 'none') e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginInlineStart: 'auto' }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme} style={iconBtn}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-hover)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
          title={t.darkMode}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Settings */}
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            ...iconBtn,
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            background: isActive ? 'var(--card-hover)' : 'none',
            textDecoration: 'none',
          })}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-hover)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
          title={t.settings}
        >
          <SettingsIcon />
        </NavLink>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

        {/* User button + dropdown */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            style={{
              ...iconBtn,
              background: userMenuOpen ? 'var(--card-hover)' : 'none',
              color: userMenuOpen ? 'var(--text)' : 'var(--text-muted)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-hover)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { if (!userMenuOpen) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' } }}
          >
            <UserIcon />
          </button>

          {userMenuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-md)',
              padding: '12px',
              minWidth: '200px',
              zIndex: 50,
            }}>
              {/* Email */}
              <p style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                margin: '0 0 10px 0',
                paddingBottom: '10px',
                borderBottom: '1px solid var(--border)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user?.email}
              </p>

              {/* Logout button */}
              <button
                onClick={() => { setUserMenuOpen(false); logout() }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'none',
                  color: '#f87171',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <LogoutIcon />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="topnav-bottom" style={{
        display: 'none',
        borderTop: '1px solid var(--border)',
        padding: '0 4px 4px',
      }}>
        {navItems.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '10px 4px',
            fontSize: '13px',
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            textDecoration: 'none',
            borderRadius: '10px',
            background: isActive ? 'var(--card)' : 'transparent',
          })}>
            {label}
          </NavLink>
        ))}
      </div>
    </header>
    </>
  )
}
