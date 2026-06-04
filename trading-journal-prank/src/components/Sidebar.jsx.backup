import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLang } from '../context/LanguageContext'

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
)

const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

const PlusCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const HamburgerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { isDark, toggle: toggleTheme } = useTheme()
  const { lang, setLang, t } = useLang()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { to: '/', labelKey: 'dashboard', icon: DashboardIcon, end: true },
    { to: '/journal', labelKey: 'journal', icon: ListIcon },
    { to: '/new', labelKey: 'newTrade', icon: PlusCircleIcon },
    { to: '/settings', labelKey: 'settings', icon: GearIcon },
  ]

  const sidebarStyle = {
    background: 'var(--sidebar-bg)',
    borderRight: lang === 'he' ? 'none' : '1px solid var(--sidebar-border)',
    borderLeft: lang === 'he' ? '1px solid var(--sidebar-border)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    width: '220px',
    minHeight: '100vh',
    flexShrink: 0,
    transition: 'background 0.2s',
  }

  const navItemStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textDecoration: 'none',
    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
    background: isActive ? 'var(--accent-light)' : 'transparent',
    marginBottom: '2px',
  })

  const bottomBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    width: '100%',
    textAlign: 'start',
  }

  function SidebarContent({ onClose }) {
    return (
      <>
        {/* Logo */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--accent)', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>Trade</span>
            <span style={{ color: 'var(--text)', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>Log</span>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginLeft: '2px' }} />
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {navItems.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              style={({ isActive }) => navItemStyle(isActive)}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>
                    <Icon />
                  </span>
                  <span>{t[labelKey]}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={bottomBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
            <span>{t.darkMode}</span>
          </button>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
            style={bottomBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', minWidth: '24px' }}>
              {lang === 'he' ? 'EN' : 'HE'}
            </span>
            <span>{t.language}</span>
          </button>

          {/* Email */}
          <p style={{
            fontSize: '12px',
            color: 'var(--text-subtle)',
            padding: '6px 10px 4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} title={user?.email}>
            {user?.email}
          </p>

          {/* Logout */}
          <button
            onClick={logout}
            style={bottomBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <LogoutIcon />
            <span>{t.logout}</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex" style={sidebarStyle}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'var(--sidebar-bg)',
          borderBottom: '1px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: 'var(--accent)', fontSize: '17px', fontWeight: 800 }}>Trade</span>
          <span style={{ color: 'var(--text)', fontSize: '17px', fontWeight: 800 }}>Log</span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginLeft: '2px' }} />
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
        >
          <HamburgerIcon />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          onClick={() => setMobileOpen(false)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
        </div>
      )}

      {/* Mobile drawer */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          [lang === 'he' ? 'left' : 'right']: 0,
          width: '260px',
          zIndex: 101,
          background: 'var(--sidebar-bg)',
          borderRight: lang === 'he' ? 'none' : '1px solid var(--sidebar-border)',
          borderLeft: lang === 'he' ? '1px solid var(--sidebar-border)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          transform: mobileOpen ? 'translateX(0)' : (lang === 'he' ? 'translateX(-100%)' : 'translateX(100%)'),
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
        }}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </div>

    </>
  )
}
