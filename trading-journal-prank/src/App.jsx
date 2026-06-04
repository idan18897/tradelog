import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { UserSettingsProvider, useUserSettings } from './context/UserSettingsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Journal from './pages/Journal'
import TradeForm from './pages/TradeForm'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import WelcomeModal from './components/WelcomeModal'
import OnboardingModal from './components/OnboardingModal'
import SeizureOverlay from './components/SeizureOverlay'
import { supabase } from './lib/supabase'

function ReminderScheduler() {
  const { user } = useAuth()
  const { dailyReminder, reminderTime } = useUserSettings()
  const lastNotifiedRef = useRef(localStorage.getItem('reminder_last_notified') || '')

  useEffect(() => {
    if (!user || !dailyReminder) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    async function checkAndNotify() {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      const today = now.toISOString().slice(0, 10)

      if (hhmm !== reminderTime) return
      if (lastNotifiedRef.current === today) return

      // Check if user already has a trade today
      const { count } = await supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today)

      if (count > 0) {
        lastNotifiedRef.current = today
        localStorage.setItem('reminder_last_notified', today)
        return
      }

      new Notification('TradingLog 📊', {
        body: "Don't forget to log your trades for today!",
        icon: '/favicon.ico',
      })
      lastNotifiedRef.current = today
      localStorage.setItem('reminder_last_notified', today)
    }

    const interval = setInterval(checkAndNotify, 60000)
    checkAndNotify() // also run immediately on mount
    return () => clearInterval(interval)
  }, [user, dailyReminder, reminderTime])

  return null
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const [showWelcome, setShowWelcome] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const flag = localStorage.getItem('show_onboarding')
    const done = localStorage.getItem('onboarding_done')
    return flag === '1' && done !== '1'
  })
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowWelcome(true)
      searchParams.delete('payment')
      setSearchParams(searchParams, { replace: true })
    }
  }, [])

  function handleOnboardingClose() {
    localStorage.removeItem('show_onboarding')
    setShowOnboarding(false)
  }

  return (
    <>
      <ReminderScheduler />
      {showOnboarding && <OnboardingModal onClose={handleOnboardingClose} />}
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      <Routes>
        {/* PRANK: root now sends visitors to the real public landing page */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
        </Route>
        <Route path="/journal" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Journal />} />
        </Route>
        <Route path="/new" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<TradeForm />} />
        </Route>
        <Route path="/edit/:id" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<TradeForm />} />
        </Route>
        <Route path="/settings" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
      {/* PRANK overlay — renders on every route EXCEPT /landing */}
      <SeizureOverlay />
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <UserSettingsProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </UserSettingsProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
