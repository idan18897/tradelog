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
  const [accountSize, setAccountSize] = useState(10000)
  const [showDollarValues, setShowDollarValues] = useState(false)
  const [dailyReminder, setDailyReminder] = useState(false)
  const [reminderTime, setReminderTime] = useState('20:00')
  const [goalMonthlyPnl, setGoalMonthlyPnl] = useState(null)
  const [goalWinRate, setGoalWinRate] = useState(null)
  const [goalTradesCount, setGoalTradesCount] = useState(null)
  const [goalAvgRR, setGoalAvgRR] = useState(null)

  useEffect(() => {
    applyColors(DEFAULT_LONG, DEFAULT_SHORT)
  }, [])

  useEffect(() => {
    if (!user) return
    // Main settings — columns that always exist
    supabase
      .from('user_settings')
      .select('long_color, short_color, plan, account_size, show_dollar_values, daily_reminder, reminder_time')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const lc = data?.long_color || DEFAULT_LONG
        const sc = data?.short_color || DEFAULT_SHORT
        setLongColor(lc)
        setShortColor(sc)
        applyColors(lc, sc)
        setPlan(data?.plan || 'free')
        if (data?.account_size != null) setAccountSize(data.account_size)
        if (data?.show_dollar_values != null) setShowDollarValues(data.show_dollar_values)
        if (data?.daily_reminder != null) setDailyReminder(data.daily_reminder)
        if (data?.reminder_time) setReminderTime(data.reminder_time)
      })
    // Goal columns — loaded separately so a missing column never breaks main settings
    supabase
      .from('user_settings')
      .select('goal_monthly_pnl, goal_win_rate, goal_trades_count, goal_avg_rr')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return
        if (data.goal_monthly_pnl != null) setGoalMonthlyPnl(data.goal_monthly_pnl)
        if (data.goal_win_rate != null) setGoalWinRate(data.goal_win_rate)
        if (data.goal_trades_count != null) setGoalTradesCount(data.goal_trades_count)
        if (data.goal_avg_rr != null) setGoalAvgRR(data.goal_avg_rr)
      })
  }, [user])

  function updateColors(long, short) {
    setLongColor(long)
    setShortColor(short)
    applyColors(long, short)
  }

  return (
    <UserSettingsContext.Provider value={{ longColor, shortColor, updateColors, plan, accountSize, setAccountSize, showDollarValues, setShowDollarValues, dailyReminder, setDailyReminder, reminderTime, setReminderTime, goalMonthlyPnl, setGoalMonthlyPnl, goalWinRate, setGoalWinRate, goalTradesCount, setGoalTradesCount, goalAvgRR, setGoalAvgRR }}>
      {children}
    </UserSettingsContext.Provider>
  )
}

export const useUserSettings = () => useContext(UserSettingsContext)
