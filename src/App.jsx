import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { UserSettingsProvider } from './context/UserSettingsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Journal from './pages/Journal'
import TradeForm from './pages/TradeForm'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import WelcomeModal from './components/WelcomeModal'

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
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowWelcome(true)
      searchParams.delete('payment')
      setSearchParams(searchParams, { replace: true })
    }
  }, [])

  return (
    <>
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="journal" element={<Journal />} />
          <Route path="new" element={<TradeForm />} />
          <Route path="edit/:id" element={<TradeForm />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
