import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const DEFAULT_LONG = '#4ade80'
const DEFAULT_SHORT = '#f87171'

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function applyColors(long, short) {
  const root = document.documentElement
  root.style.setProperty('--long-color', long)
  root.style.setProperty('--long-color-bg', hexToRgba(long, 0.15))
  root.style.setProperty('--short-color', short)
  root.style.setProperty('--short-color-bg', hexToRgba(short, 0.15))
}

const UserSettingsContext = createContext()

export function UserSettingsProvider({ children }) {
  const { user } = useAuth()
  const [longColor, setLongColor] = useState(DEFAULT_LONG)
  const [shortColor, setShortColor] = useState(DEFAULT_SHORT)
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    applyColors(DEFAULT_LONG, DEFAULT_SHORT)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_settings')
      .select('long_color, short_color, plan')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const lc = data?.long_color || DEFAULT_LONG
        const sc = data?.short_color || DEFAULT_SHORT
        setLongColor(lc)
        setShortColor(sc)
        applyColors(lc, sc)
        setPlan(data?.plan || 'free')
      })
  }, [user])

  function updateColors(long, short) {
    setLongColor(long)
    setShortColor(short)
    applyColors(long, short)
  }

  return (
    <UserSettingsContext.Provider value={{ longColor, shortColor, updateColors, plan }}>
      {children}
    </UserSettingsContext.Provider>
  )
}

export const useUserSettings = () => useContext(UserSettingsContext)
