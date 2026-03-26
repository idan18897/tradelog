import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import TradingLogIcon from '../components/TradingLogIcon'

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  const { login, signup, user, loginWithGoogle } = useAuth()
  const { t } = useLang()
  const { isDark, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    setTimeout(() => setVisible(true), 10)
  }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(email, password)
        navigate('/', { replace: true })
      } else {
        await signup(email, password)
        setSuccess(t.signupSuccess)
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '28px',
    boxShadow: 'var(--shadow-md)',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'var(--bg)',
        position: 'relative',
      }}
    >
      {/* Top-right controls */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={toggleTheme}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 8px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div
        className={`w-full transition-all duration-300 ${visible ? 'fade-in' : 'opacity-0'}`}
        style={{ maxWidth: '360px' }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontSize: '30px', fontWeight: 400, color: 'var(--logo-color)', letterSpacing: '0.07em' }}>Trading</span>
            <span style={{ fontSize: '30px', fontWeight: 700, color: 'var(--logo-color)', letterSpacing: '0.07em' }}>Log</span>
            <img src="/logo-light.png" alt="logo" style={{ width: '30px', height: '30px', marginInlineStart: '8px', flexShrink: 0, borderRadius: '50%', objectFit: 'cover' }} />
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t.loginSubtitle}</p>
        </div>

        <div style={cardStyle}>
          {/* Google OAuth */}
          <button
            type="button"
            onClick={loginWithGoogle}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              border: '1px solid var(--border-strong)',
              background: 'var(--card)',
              color: 'var(--text)',
              cursor: 'pointer',
              marginBottom: '20px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303C33.653 32.652 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#34A853" d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#FBBC05" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.618-3.328-11.28-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#EA4335" d="M43.611 20.083H42V20H24v8h11.303a11.99 11.99 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.801 44 34.417 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          {/* Toggle login/signup */}
          <div style={{
            display: 'flex',
            background: 'var(--bg)',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '24px',
            border: '1px solid var(--border)',
          }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess('') }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: mode === 'login' ? 'var(--btn-primary-bg)' : 'transparent',
                color: mode === 'login' ? 'var(--btn-primary-color)' : 'var(--text-muted)',
              }}
            >
              {t.loginBtn}
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: mode === 'signup' ? 'var(--btn-primary-bg)' : 'transparent',
                color: mode === 'signup' ? 'var(--btn-primary-color)' : 'var(--text-muted)',
              }}
            >
              {t.signupBtn}
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t.emailLabel}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="trader@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {t.passwordLabel}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
              />
            </div>

            {error && (
              <p style={{ fontSize: '13px', color: '#f87171', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', padding: '10px 12px' }}>
                {error}
              </p>
            )}

            {success && (
              <p style={{ fontSize: '13px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderRadius: '8px', padding: '10px 12px' }}>
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-color)',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
                marginTop: '4px',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{
                    width: '14px', height: '14px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  {mode === 'login' ? t.loginBtn : t.signupBtn}
                </span>
              ) : (
                mode === 'login' ? t.loginBtn : t.signupBtn
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
