import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import DatePicker from '../components/DatePicker'
import { computePnL } from '../lib/utils'
import { useUserSettings } from '../context/UserSettingsContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function formatDate(iso) {
  if (!iso) return '--'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function getOutcomeBadge(outcome) {
  const map = {
    TP: { bg: 'rgba(74,222,128,0.15)', color: '#4ade80' },
    'Partial TP': { bg: 'rgba(163,230,53,0.15)', color: '#a3e635' },
    SL: { bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
    BE: { bg: 'rgba(250,204,21,0.15)', color: '#facc15' },
    Invalid: { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af' },
    Open: { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
  }
  return map[outcome] || { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af' }
}

const CustomTooltip = ({ active, payload, showDollarValues, accountSize }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value
    const dollarPart = showDollarValues && accountSize ? ` ($${val >= 0 ? '+' : ''}${((val / 100) * accountSize).toFixed(0)})` : ''
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '2px' }}>{payload[0].payload.label}</p>
        <p style={{ color: val >= 0 ? '#4ade80' : '#f87171', fontWeight: 600, fontSize: '14px' }}>
          {val >= 0 ? '+' : ''}{val.toFixed(2)}%{dollarPart}
        </p>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const { accountSize, showDollarValues, goalMonthlyPnl, goalWinRate, goalTradesCount, goalAvgRR } = useUserSettings()
  const isMobile = useIsMobile()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [dateFilter, setDateFilter] = useState({ type: 'month', from: '', to: '' })
  const [navOffset, setNavOffset] = useState(0)
  const [showMissed, setShowMissed] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [hourView, setHourView] = useState('winRate') // 'winRate' | 'volume'
  const [dashTab, setDashTab] = useState('overview') // 'overview' | 'confirmations'
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportType, setReportType] = useState('weekly')
  const [reportWeekOf, setReportWeekOf] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
  const [reportMonthOf, setReportMonthOf] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [confFilter, setConfFilter] = useState([]) // empty = all confirmations
  const [comboSize, setComboSize] = useState(2)
  const [minComboTrades, setMinComboTrades] = useState(3)
  const [comboConfFilter, setComboConfFilter] = useState([]) // filter inside combinations section
  const [goalToast, setGoalToast] = useState(null)
  const [confettiPieces, setConfettiPieces] = useState([])
  const achievedGoalsRef = useRef(new Set())
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [claudeQuestion, setClaudeQuestion] = useState('')
  const [claudeLoading, setClaudeLoading] = useState(false)
  const [claudeHistory, setClaudeHistory] = useState([])
  const claudeBottomRef = useRef(null)
  const customRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (customRef.current && !customRef.current.contains(e.target)) setCustomOpen(false)
    }
    if (customOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [customOpen])

  useEffect(() => {
    fetchTrades()
  }, [])

  useEffect(() => {
    if (!loading) setTimeout(() => setVisible(true), 10)
  }, [loading])

  async function fetchTrades() {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (!error) setTrades(data || [])
    setLoading(false)
  }

  // Available years from all trades (for quick filter buttons)
  const availableYears = [...new Set(
    trades.map(t => t.date?.slice(0, 4)).filter(Boolean)
  )].sort()

  // Date range check
  function inDateRange(tr) {
    if (!tr.date) return true
    const { type, from, to } = dateFilter
    if (type === 'all') return true
    if (type === 'month') return tr.date.startsWith(navMonthStr)
    if (type === 'year') return tr.date.startsWith(navYearLabel)
    if (type === 'custom') {
      if (from && tr.date < from) return false
      if (to && tr.date > to) return false
      return true
    }
    return true
  }

  const allLiveTrades = trades.filter(t => (t.trade_type || 'live') === 'live')
  const allMissedTrades = trades.filter(t => t.trade_type === 'missed')

  // Navigation computed values (for Monthly / Yearly modes)
  const now = new Date()
  const navMonthDate = new Date(now.getFullYear(), now.getMonth() + navOffset, 1)
  const navMonthStr = `${navMonthDate.getFullYear()}-${String(navMonthDate.getMonth() + 1).padStart(2, '0')}`
  const navMonthLabel = navMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const navYearNum = now.getFullYear() + navOffset
  const navYearLabel = String(navYearNum)

  // Current month goal tracking — always uses allLiveTrades regardless of date filter
  const curMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const goalMonthTrades = allLiveTrades.filter(t => t.date?.startsWith(curMonthPrefix))
  const goalMonthClosed = goalMonthTrades.filter(t => ['TP', 'Partial TP', 'SL', 'BE'].includes(t.outcome))
  const goalMonthTP = goalMonthTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP')
  const goalMonthPnLVal = parseFloat(goalMonthTrades.reduce((s, t) => s + computePnL(t), 0).toFixed(2))
  const goalMonthWinRateVal = goalMonthClosed.length > 0 ? parseFloat((goalMonthTP.length / goalMonthClosed.length * 100).toFixed(1)) : 0
  const goalMonthCountVal = goalMonthTrades.length
  const goalMonthAvgRRVal = goalMonthTP.length > 0 ? parseFloat((goalMonthTP.reduce((s, t) => s + (t.rr_potential || 0), 0) / goalMonthTP.length).toFixed(2)) : 0

  const goalItems = [
    goalMonthlyPnl != null ? { key: 'pnl', label: 'Monthly P&L', current: goalMonthPnLVal, target: goalMonthlyPnl, format: v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, targetFormat: v => `${v}%` } : null,
    goalWinRate != null ? { key: 'wr', label: 'Win Rate', current: goalMonthWinRateVal, target: goalWinRate, format: v => `${v.toFixed(1)}%`, targetFormat: v => `${v}%` } : null,
    goalTradesCount != null ? { key: 'tc', label: 'Trades Count', current: goalMonthCountVal, target: goalTradesCount, format: v => String(v), targetFormat: v => String(v) } : null,
    goalAvgRR != null ? { key: 'rr', label: 'Avg R:R', current: goalMonthAvgRRVal, target: goalAvgRR, format: v => `1:${v.toFixed(2)}`, targetFormat: v => `1:${v}` } : null,
  ].filter(Boolean)

  // Goal achievement detection — fires confetti + toast when a goal hits 100%
  useEffect(() => {
    if (loading || goalItems.length === 0) return
    const CONFETTI_COLORS = ['#FF453A','#FF9F0A','#30D158','#0A84FF','#BF5AF2','#FFD60A','#32ADE6']
    let newAchievement = null
    goalItems.forEach(g => {
      const pct = g.target > 0 ? (g.current / g.target) * 100 : 0
      if (pct >= 100 && !achievedGoalsRef.current.has(g.key)) {
        achievedGoalsRef.current.add(g.key)
        newAchievement = g.label
      } else if (pct < 100) {
        achievedGoalsRef.current.delete(g.key)
      }
    })
    if (newAchievement) {
      const pieces = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.5 + Math.random() * 1.5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
      }))
      setConfettiPieces(pieces)
      setGoalToast(`🎯 Goal Achieved! ${newAchievement} target reached!`)
      setTimeout(() => setConfettiPieces([]), 4500)
      setTimeout(() => setGoalToast(null), 4500)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, goalMonthPnLVal, goalMonthWinRateVal, goalMonthCountVal, goalMonthAvgRRVal])

  // liveTrades = the dataset ALL analytics use (respects date filter + missed toggle)
  const liveTrades = [
    ...allLiveTrades.filter(inDateRange),
    ...(showMissed ? allMissedTrades.filter(inDateRange) : []),
  ]

  const closedTrades = liveTrades.filter(t => ['TP', 'Partial TP', 'SL', 'BE'].includes(t.outcome))
  const tpTrades = liveTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP')
  const slTrades = liveTrades.filter(t => t.outcome === 'SL')
  const beTrades = liveTrades.filter(t => t.outcome === 'BE')
  const invalidTrades = liveTrades.filter(t => t.outcome === 'Invalid')
  const openTrades = liveTrades.filter(t => t.outcome === 'Open')

  const missedTrades = allMissedTrades.filter(inDateRange)
  const backtestTotal = tpTrades.length + missedTrades.length
  const captureRate = backtestTotal > 0 ? Math.round(tpTrades.length / backtestTotal * 100) : null

  const winRate = closedTrades.length > 0
    ? ((tpTrades.length / closedTrades.length) * 100).toFixed(1)
    : null

  const monthTrades = dateFilter.type === 'month'
    ? liveTrades
    : liveTrades.filter(t => t.date?.startsWith(curMonthPrefix))
  const monthlyPnL = monthTrades.reduce((sum, tr) => sum + computePnL(tr), 0)

  const avgRR = tpTrades.length > 0
    ? (tpTrades.reduce((sum, tr) => sum + (tr.rr_potential || 0), 0) / tpTrades.length).toFixed(2)
    : null

  const weeklyMap = {}
  liveTrades.forEach(tr => {
    const w = tr.week_number
    if (!w) return
    if (!weeklyMap[w]) weeklyMap[w] = { week: w, pnl: 0 }
    weeklyMap[w].pnl += computePnL(tr)
  })
  const sortedWeeks = Object.values(weeklyMap).sort((a, b) => a.week - b.week).slice(-12)
  const chartData = sortedWeeks.map(w => ({
    label: `${t.week} ${w.week}`,
    pnl: parseFloat(w.pnl.toFixed(2)),
  }))

  const longCount = liveTrades.filter(tr => tr.direction === 'Long').length
  const shortCount = liveTrades.filter(tr => tr.direction === 'Short').length
  const recent5 = liveTrades.slice(0, 5)

  // Winners & Losers stats
  const avgWinRR = tpTrades.length
    ? (tpTrades.reduce((s, t) => s + (t.rr_potential || 0), 0) / tpTrades.length).toFixed(2)
    : null
  const maxWinRR = tpTrades.length
    ? Math.max(...tpTrades.map(t => t.rr_potential || 0)).toFixed(2)
    : null
  const avgLossRisk = slTrades.length
    ? (slTrades.reduce((s, t) => s + (t.risk_pct || 0.5), 0) / slTrades.length).toFixed(2)
    : null
  const maxLossRisk = slTrades.length
    ? Math.max(...slTrades.map(t => t.risk_pct || 0.5)).toFixed(2)
    : null

  // Consecutive streaks (sorted oldest→newest)
  const sortedClosed = [...closedTrades].sort((a, b) =>
    new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00'))
  )
  let maxConsecWins = 0, maxConsecLosses = 0, curW = 0, curL = 0
  const winStreaks = [], lossStreaks = []
  sortedClosed.forEach(tr => {
    if (tr.outcome === 'TP' || tr.outcome === 'Partial TP') {
      curW++; if (curL > 0) { lossStreaks.push(curL); curL = 0 }
      if (curW > maxConsecWins) maxConsecWins = curW
    } else if (tr.outcome === 'SL') {
      curL++; if (curW > 0) { winStreaks.push(curW); curW = 0 }
      if (curL > maxConsecLosses) maxConsecLosses = curL
    }
  })
  if (curW > 0) winStreaks.push(curW)
  if (curL > 0) lossStreaks.push(curL)
  const avgConsecWins = winStreaks.length
    ? (winStreaks.reduce((s, v) => s + v, 0) / winStreaks.length).toFixed(1)
    : null
  const avgConsecLosses = lossStreaks.length
    ? (lossStreaks.reduce((s, v) => s + v, 0) / lossStreaks.length).toFixed(1)
    : null
  // Current streak
  let currentStreak = 0, currentStreakType = null
  for (let i = sortedClosed.length - 1; i >= 0; i--) {
    const o = sortedClosed[i].outcome
    if (i === sortedClosed.length - 1) { currentStreakType = (o === 'TP' || o === 'Partial TP') ? 'win' : 'loss'; currentStreak = 1 }
    else if (((o === 'TP' || o === 'Partial TP') && currentStreakType === 'win') || (o === 'SL' && currentStreakType === 'loss')) currentStreak++
    else break
  }

  // Streak Analysis — Pattern cards + Timeline
  // sortedClosed already sorted oldest→newest, live only, no Open/Invalid
  const afterLossWins = [], afterWinWins = [], afterTwoLossWins = []
  let streakTimeline = [] // { idx, type:'win'|'loss', length }
  let tl_curType = null, tl_curLen = 0, tl_startIdx = 0
  sortedClosed.forEach((tr, i) => {
    const isWin = tr.outcome === 'TP' || tr.outcome === 'Partial TP'
    const isSL = tr.outcome === 'SL'
    // Pattern: after a loss
    if (i > 0) {
      const prev = sortedClosed[i - 1]
      const prevWin = prev.outcome === 'TP' || prev.outcome === 'Partial TP'
      const prevSL = prev.outcome === 'SL'
      if (prevSL) afterLossWins.push(isWin ? 1 : 0)
      if (prevWin) afterWinWins.push(isWin ? 1 : 0)
    }
    // Pattern: after 2+ losses in a row
    if (i >= 2) {
      const p1 = sortedClosed[i - 1], p2 = sortedClosed[i - 2]
      if (p1.outcome === 'SL' && p2.outcome === 'SL') afterTwoLossWins.push(isWin ? 1 : 0)
    }
    // Build timeline
    const thisType = isWin ? 'win' : isSL ? 'loss' : null
    if (!thisType) return
    if (thisType === tl_curType) {
      tl_curLen++
    } else {
      if (tl_curType) streakTimeline.push({ idx: tl_startIdx, type: tl_curType, length: tl_curLen })
      tl_curType = thisType; tl_curLen = 1; tl_startIdx = i
    }
  })
  if (tl_curType) streakTimeline.push({ idx: tl_startIdx, type: tl_curType, length: tl_curLen })

  const pctAfterLoss = afterLossWins.length ? Math.round(afterLossWins.reduce((s, v) => s + v, 0) / afterLossWins.length * 100) : null
  const pctAfterWin = afterWinWins.length ? Math.round(afterWinWins.reduce((s, v) => s + v, 0) / afterWinWins.length * 100) : null
  const pctAfterTwoLoss = afterTwoLossWins.length ? Math.round(afterTwoLossWins.reduce((s, v) => s + v, 0) / afterTwoLossWins.length * 100) : null
  const recoveryRate = pctAfterLoss // alias

  // Streak timeline chart data (last 30 streaks)
  const streakChartData = streakTimeline.slice(-30).map((s, i) => ({
    i,
    value: s.type === 'win' ? s.length : -s.length,
    type: s.type,
    length: s.length,
  }))

  // Performance by day of week
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const perfByDay = DAY_NAMES.map((name, idx) => {
    const dayTrades = liveTrades.filter(tr => new Date(tr.date).getDay() === idx)
    const dayClosed = dayTrades.filter(tr => ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome))
    const dayTP = dayTrades.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP').length
    const winRate = dayClosed.length ? Math.round(dayTP / dayClosed.length * 100) : null
    const pnl = dayTrades.reduce((s, tr) => s + computePnL(tr), 0)
    return { name, nameEn: DAY_NAMES_EN[idx], total: dayTrades.length, tp: dayTP, winRate, pnl }
  }).filter(d => d.total > 0)

  // Performance by Session
  const SESSIONS = [
    { name: 'London', start: 10, end: 14, color: '#60a5fa' },
    { name: 'New York', start: 15, end: 19, color: '#f59e0b' },
  ]
  const perfBySession = SESSIONS.map(session => {
    const sessionTrades = liveTrades.filter(tr => {
      if (!tr.time) return false
      const hour = parseInt(tr.time.split(':')[0], 10)
      return hour >= session.start && hour < session.end
    })
    const closed = sessionTrades.filter(tr => ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome))
    const tp = sessionTrades.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP')
    const sl = sessionTrades.filter(tr => tr.outcome === 'SL')
    const winRate = closed.length ? Math.round(tp.length / closed.length * 100) : null
    const avgRR = tp.length ? (tp.reduce((s, t) => s + (t.rr_potential || 0), 0) / tp.length).toFixed(2) : null
    const pnl = sessionTrades.reduce((s, tr) => s + computePnL(tr), 0)
    return { ...session, total: sessionTrades.length, tp: tp.length, sl: sl.length, winRate, avgRR, pnl }
  })

  // Performance by Month (calendar grid)
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthlyMap = {}
  liveTrades.forEach(tr => {
    if (!tr.date) return
    const [year, month] = tr.date.split('-')
    const key = `${year}-${month}`
    if (!monthlyMap[key]) monthlyMap[key] = { year: parseInt(year), month: parseInt(month), trades: [] }
    monthlyMap[key].trades.push(tr)
  })
  const monthlyStats = Object.values(monthlyMap).map(m => {
    const closed = m.trades.filter(tr => ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome))
    const tp = m.trades.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP').length
    const pnl = parseFloat(m.trades.reduce((s, tr) => s + computePnL(tr), 0).toFixed(2))
    const winRate = closed.length ? Math.round(tp / closed.length * 100) : null
    return { ...m, total: m.trades.length, tp, pnl, winRate }
  })
  const years = [...new Set(monthlyStats.map(m => m.year))].sort()

  // Performance by Hour (entry time)
  const hourMap = {}
  liveTrades.forEach(tr => {
    if (!tr.time) return
    const hour = parseInt(tr.time.split(':')[0], 10)
    if (!hourMap[hour]) hourMap[hour] = { hour, trades: [], tp: 0, sl: 0, closed: 0 }
    hourMap[hour].trades.push(tr)
    if (tr.outcome === 'TP' || tr.outcome === 'Partial TP') { hourMap[hour].tp++; hourMap[hour].closed++ }
    else if (tr.outcome === 'SL') { hourMap[hour].sl++; hourMap[hour].closed++ }
    else if (tr.outcome === 'BE') hourMap[hour].closed++
  })
  const perfByHour = Object.values(hourMap)
    .sort((a, b) => a.hour - b.hour)
    .map(h => ({
      ...h,
      label: `${String(h.hour).padStart(2, '0')}:00`,
      total: h.trades.length,
      winRate: h.closed ? Math.round(h.tp / h.closed * 100) : null,
      pnl: parseFloat(h.trades.reduce((s, tr) => s + computePnL(tr), 0).toFixed(2)),
    }))

  // Entry Heatmap (hour × day of week) — live + missed, filtered by date
  const ENTRY_DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  // entryGrid[day][hour] = { total, wins, losses }
  const entryGrid = {}
  ENTRY_DAY_KEYS.forEach(d => { entryGrid[d] = {} })
  allLiveTrades.filter(inDateRange).forEach(tr => {
    if (!tr.time || !tr.date) return
    const hour = parseInt(tr.time.split(':')[0], 10)
    const dayKey = ENTRY_DAY_KEYS[new Date(tr.date + 'T00:00:00').getDay()]
    if (!entryGrid[dayKey][hour]) entryGrid[dayKey][hour] = { total: 0, wins: 0, losses: 0 }
    entryGrid[dayKey][hour].total++
    if (tr.outcome === 'TP' || tr.outcome === 'Partial TP') entryGrid[dayKey][hour].wins++
    else if (tr.outcome === 'SL') entryGrid[dayKey][hour].losses++
  })
  // keep missed separate for count only
  const entryHeatmapMissed = {}
  ENTRY_DAY_KEYS.forEach(d => { entryHeatmapMissed[d] = {} })
  allMissedTrades.filter(inDateRange).forEach(tr => {
    if (!tr.time || !tr.date) return
    const hour = parseInt(tr.time.split(':')[0], 10)
    const dayKey = ENTRY_DAY_KEYS[new Date(tr.date + 'T00:00:00').getDay()]
    entryHeatmapMissed[dayKey][hour] = (entryHeatmapMissed[dayKey][hour] || 0) + 1
  })
  const entryHoursSet = new Set()
  ENTRY_DAY_KEYS.forEach(d => {
    Object.keys(entryGrid[d]).forEach(h => entryHoursSet.add(parseInt(h)))
    Object.keys(entryHeatmapMissed[d]).forEach(h => entryHoursSet.add(parseInt(h)))
  })
  const entryHours = Array.from(entryHoursSet).sort((a, b) => a - b)
  const entryHeatmapMax = Math.max(1, ...ENTRY_DAY_KEYS.flatMap(d => Object.keys(entryGrid[d]).map(h => (entryGrid[d][h]?.total || 0) + (entryHeatmapMissed[d][h] || 0))))
  const entryPeakHour = (() => {
    const totals = {}
    ENTRY_DAY_KEYS.forEach(d => {
      const allH = new Set([...Object.keys(entryGrid[d]), ...Object.keys(entryHeatmapMissed[d])])
      allH.forEach(h => { totals[h] = (totals[h] || 0) + (entryGrid[d][h]?.total || 0) + (entryHeatmapMissed[d][h] || 0) })
    })
    const best = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]
    return best ? { hour: parseInt(best[0]), count: best[1] } : null
  })()
  const entryPeakDay = (() => {
    const totals = ENTRY_DAY_KEYS.map(d => ({
      day: d,
      count: Object.values(entryGrid[d]).reduce((s, v) => s + (v.total || 0), 0) + Object.values(entryHeatmapMissed[d]).reduce((s, v) => s + v, 0)
    }))
    return totals.sort((a, b) => b.count - a.count)[0]
  })()

  // Average Holding Time
  function parseTimeToMinutes(t) {
    if (!t) return null
    const parts = t.split(':')
    if (parts.length < 2) return null
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }
  const holdingTimes = allLiveTrades.filter(inDateRange).filter(tr =>
    tr.time && tr.exit_time && !['Open', 'Invalid'].includes(tr.outcome)
  ).map(tr => {
    const entry = parseTimeToMinutes(tr.time)
    const exit = parseTimeToMinutes(tr.exit_time)
    if (entry === null || exit === null) return null
    const diff = exit >= entry ? exit - entry : (24 * 60 - entry) + exit
    return diff
  }).filter(v => v !== null && v > 0)
  const avgHoldMinutes = holdingTimes.length
    ? Math.round(holdingTimes.reduce((s, v) => s + v, 0) / holdingTimes.length)
    : null
  const avgHoldStr = avgHoldMinutes !== null
    ? avgHoldMinutes >= 60
      ? `${Math.floor(avgHoldMinutes / 60)}h ${avgHoldMinutes % 60}m`
      : `${avgHoldMinutes}m`
    : '--'

  // Expectancy
  const closedLive = allLiveTrades.filter(inDateRange).filter(tr =>
    ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome)
  )
  const wins = closedLive.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP')
  const losses = closedLive.filter(tr => tr.outcome === 'SL')
  const winRateRaw = closedLive.length ? wins.length / closedLive.length : 0
  const lossRateRaw = closedLive.length ? losses.length / closedLive.length : 0
  const avgWinPnL = wins.length ? wins.reduce((s, tr) => s + computePnL(tr), 0) / wins.length : 0
  const avgLossPnL = losses.length ? Math.abs(losses.reduce((s, tr) => s + computePnL(tr), 0) / losses.length) : 0
  const expectancy = closedLive.length >= 2
    ? parseFloat(((winRateRaw * avgWinPnL) - (lossRateRaw * avgLossPnL)).toFixed(2))
    : null

  // Performance by Pair
  const pairMap = {}
  allLiveTrades.filter(inDateRange).filter(tr => !['Open', 'Invalid'].includes(tr.outcome)).forEach(tr => {
    const p = tr.pair || 'Unknown'
    if (!pairMap[p]) pairMap[p] = { pair: p, trades: [], tp: 0, closed: 0 }
    pairMap[p].trades.push(tr)
    if (tr.outcome === 'TP' || tr.outcome === 'Partial TP') { pairMap[p].tp++; pairMap[p].closed++ }
    else if (['SL', 'BE'].includes(tr.outcome)) pairMap[p].closed++
  })
  const perfByPair = Object.values(pairMap).map(p => {
    const tp = p.trades.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP')
    const winRate = p.closed ? Math.round(p.tp / p.closed * 100) : null
    const avgRR = tp.length ? parseFloat((tp.reduce((s, tr) => s + (tr.rr_potential || 0), 0) / tp.length).toFixed(2)) : null
    const pnl = parseFloat(p.trades.reduce((s, tr) => s + computePnL(tr), 0).toFixed(2))
    return { pair: p.pair, total: p.trades.length, winRate, avgRR, pnl }
  }).sort((a, b) => b.pnl - a.pnl)

  // Exit Hour distribution (trades that have exit_time filled)
  const exitHourMap = {}
  liveTrades.forEach(tr => {
    if (!tr.exit_time) return
    const hour = parseInt(tr.exit_time.split(':')[0], 10)
    if (!exitHourMap[hour]) exitHourMap[hour] = { hour, total: 0 }
    exitHourMap[hour].total++
  })
  const exitByHour = Object.values(exitHourMap)
    .sort((a, b) => a.hour - b.hour)
    .map(h => ({ ...h, label: `${String(h.hour).padStart(2, '0')}:00` }))

  // Performance by Holding Time
  const HOLD_BUCKETS = [
    { label: '0–30 min', min: 0, max: 30, color: '#0A84FF' },
    { label: '30–60 min', min: 30, max: 60, color: '#30D158' },
    { label: '1–2 hrs', min: 60, max: 120, color: '#FF9F0A' },
    { label: '2–4 hrs', min: 120, max: 240, color: '#BF5AF2' },
    { label: '4+ hrs', min: 240, max: Infinity, color: '#64D2FF' },
  ]
  function timeToMins(t) {
    if (!t) return null
    const p = t.split(':')
    return p.length < 2 ? null : parseInt(p[0], 10) * 60 + parseInt(p[1], 10)
  }
  const perfByHoldTime = HOLD_BUCKETS.map(bucket => {
    const bucketTrades = allLiveTrades.filter(inDateRange).filter(tr => {
      if (!tr.time || !tr.exit_time || ['Open', 'Invalid'].includes(tr.outcome)) return false
      const entry = timeToMins(tr.time)
      const exit = timeToMins(tr.exit_time)
      if (entry === null || exit === null) return false
      const diff = exit >= entry ? exit - entry : 24 * 60 - entry + exit
      return diff >= bucket.min && diff < bucket.max
    })
    const closed = bucketTrades.filter(tr => ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome))
    const tp = bucketTrades.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP')
    const winRate = closed.length ? Math.round(tp.length / closed.length * 100) : null
    const avgRR = tp.length ? parseFloat((tp.reduce((s, tr) => s + (tr.rr_potential || 0), 0) / tp.length).toFixed(2)) : null
    const pnl = parseFloat(bucketTrades.reduce((s, tr) => s + computePnL(tr), 0).toFixed(2))
    return { ...bucket, total: bucketTrades.length, tp: tp.length, sl: bucketTrades.filter(t => t.outcome === 'SL').length, winRate, avgRR, pnl }
  }).filter(b => b.total > 0)

  // Equity curve — running cumulative P&L per closed trade
  const sortedForEquity = [...liveTrades]
    .filter(tr => ['TP', 'SL', 'BE'].includes(tr.outcome))
    .sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')))
  let running = 0
  const equityData = [{ label: 'Start', value: 0, idx: 0 }]
  sortedForEquity.forEach((tr, i) => {
    running += computePnL(tr)
    equityData.push({
      label: formatDate(tr.date),
      value: parseFloat(running.toFixed(2)),
      outcome: tr.outcome,
      pair: tr.pair,
      idx: i + 1,
    })
  })
  const equityFinal = equityData[equityData.length - 1]?.value ?? 0
  const equityMax = Math.max(...equityData.map(d => d.value))
  const equityMin = Math.min(...equityData.map(d => d.value))
  const equityPositive = equityFinal >= 0

  // Max Drawdown
  let maxDrawdown = 0
  let peak = -Infinity
  for (const d of equityData) {
    if (d.value > peak) peak = d.value
    const dd = peak - d.value
    if (dd > maxDrawdown) maxDrawdown = dd
  }
  const maxDrawdownPct = equityData.length > 1 ? parseFloat(maxDrawdown.toFixed(2)) : null

  // Risk of Ruin
  const edge = winRateRaw * avgWinPnL - lossRateRaw * avgLossPnL
  const rorTarget = 20 // 20% account loss
  let riskOfRuin = null
  if (closedLive.length >= 5 && avgLossPnL > 0) {
    const avgBet = avgLossPnL
    const ruinSteps = Math.ceil(rorTarget / avgBet)
    const q = edge > 0 ? Math.pow((1 - edge / avgWinPnL) / (1 + edge / avgWinPnL), ruinSteps) : 1
    riskOfRuin = parseFloat(Math.min(q * 100, 100).toFixed(1))
  }

  // ── Mood & Discipline Analytics ────────────────────────────────────────
  const MOOD_LABELS = { 1: { label: 'Tired', emoji: '😴' }, 2: { label: 'Emotional', emoji: '😤' }, 3: { label: 'Neutral', emoji: '😐' }, 4: { label: 'Focused', emoji: '🙂' }, 5: { label: 'In the zone', emoji: '🔥' } }
  const moodTrades = allLiveTrades.filter(inDateRange).filter(t => t.mood && ['TP','Partial TP','SL','BE'].includes(t.outcome))
  const moodStats = [1,2,3,4,5].map(m => {
    const ts = moodTrades.filter(t => t.mood === m)
    const wins = ts.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length
    const pnl = ts.reduce((s, t) => s + computePnL(t), 0)
    return { mood: m, ...MOOD_LABELS[m], total: ts.length, winRate: ts.length ? Math.round(wins / ts.length * 100) : null, pnl: parseFloat(pnl.toFixed(2)) }
  }).filter(m => m.total > 0)

  const disciplineTrades = allLiveTrades.filter(inDateRange).filter(t => ['TP','Partial TP','SL','BE'].includes(t.outcome))
  const violationTrades = disciplineTrades.filter(t => t.rule_violated)
  const cleanTrades = disciplineTrades.filter(t => !t.rule_violated)
  const violationWR = violationTrades.length ? Math.round(violationTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length / violationTrades.length * 100) : null
  const cleanWR = cleanTrades.length ? Math.round(cleanTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length / cleanTrades.length * 100) : null
  const violationPnl = parseFloat(violationTrades.reduce((s, t) => s + computePnL(t), 0).toFixed(2))
  const cleanPnl = parseFloat(cleanTrades.reduce((s, t) => s + computePnL(t), 0).toFixed(2))

  // ── Weekly Score ────────────────────────────────────────
  function getISOWeekBounds(d) {
    const day = d.getDay() || 7
    const mon = new Date(d); mon.setDate(d.getDate() - (day - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const fmt = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    return { from: fmt(mon), to: fmt(sun) }
  }
  const thisWeekBounds = getISOWeekBounds(now)
  const lastWeekDate = new Date(now); lastWeekDate.setDate(now.getDate() - 7)
  const lastWeekBounds = getISOWeekBounds(lastWeekDate)

  function calcWeekStats(bounds) {
    const wTrades = allLiveTrades.filter(t => t.date >= bounds.from && t.date <= bounds.to)
    const wClosed = wTrades.filter(t => ['TP','Partial TP','SL','BE'].includes(t.outcome))
    const wTP = wClosed.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length
    const wPnL = parseFloat(wTrades.reduce((s, t) => s + computePnL(t), 0).toFixed(2))
    const wWR = wClosed.length ? Math.round(wTP / wClosed.length * 100) : null
    const wViolations = wTrades.filter(t => t.rule_violated).length
    const wDisciplinePct = wTrades.length > 0 ? Math.round((1 - wViolations / wTrades.length) * 100) : null
    let score = null
    if (wClosed.length >= 1) {
      const wrScore = wWR !== null ? Math.min(40, Math.round(wWR / 100 * 40)) : 0
      const pnlScore = wPnL > 0 ? Math.min(30, Math.round(wPnL * 3)) : 0
      const discScore = wDisciplinePct !== null ? Math.round(wDisciplinePct / 100 * 30) : 30
      score = Math.min(100, wrScore + pnlScore + discScore)
    }
    return { trades: wTrades.length, closed: wClosed.length, tp: wTP, pnl: wPnL, winRate: wWR, violations: wViolations, score }
  }
  const thisWeekStats = calcWeekStats(thisWeekBounds)
  const lastWeekStats = calcWeekStats(lastWeekBounds)

  function weekScoreGrade(s) {
    if (s === null) return { grade: '--', label: 'No closed trades this week', color: 'var(--text-muted)' }
    if (s >= 80) return { grade: 'A', label: 'Excellent week 🔥', color: '#30D158' }
    if (s >= 65) return { grade: 'B', label: 'Strong week 💪', color: '#0A84FF' }
    if (s >= 50) return { grade: 'C', label: 'Decent week', color: '#FF9F0A' }
    if (s >= 35) return { grade: 'D', label: 'Needs improvement', color: '#FF6B6B' }
    return { grade: 'F', label: 'Rough week — review & reset', color: '#FF453A' }
  }
  const weekGrade = weekScoreGrade(thisWeekStats.score)

  // ── Trading Insights ────────────────────────────────────────
  const insightTrades = allLiveTrades.filter(inDateRange).filter(tr => !['Open', 'Invalid'].includes(tr.outcome))
  const insightClosed = insightTrades.filter(tr => ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome))
  const insightWR = insightClosed.length ? Math.round(insightTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length / insightClosed.length * 100) : null
  const rawInsights = []

  // 1. Best day of week
  if (perfByDay.length >= 2) {
    const withWR = perfByDay.filter(d => d.winRate !== null && d.total >= 3)
    if (withWR.length >= 2) {
      const best = withWR.reduce((a, b) => b.winRate > a.winRate ? b : a)
      const worst = withWR.reduce((a, b) => b.winRate < a.winRate ? b : a)
      const diff = best.winRate - worst.winRate
      if (diff >= 15) rawInsights.push({
        icon: '🏆', score: diff,
        text: `Your best day is <b>${best.name}</b> with <b>${best.winRate}% win rate</b> across ${best.total} trades — ${diff}% higher than ${worst.name}`,
      })
    }
  }

  // 2. Most profitable pair
  if (perfByPair.length >= 2) {
    const withMinTrades = perfByPair.filter(p => p.total >= 3)
    if (withMinTrades.length >= 1) {
      const best = withMinTrades[0] // already sorted by pnl
      const second = withMinTrades[1]
      if (best.pnl > 0 && (!second || best.pnl > second.pnl)) rawInsights.push({
        icon: '📈', score: Math.abs(best.pnl),
        text: `<b>${best.pair}</b> is your most profitable pair with <b>+${best.pnl.toFixed(2)}% total P&L</b>${best.winRate !== null ? ` and ${best.winRate}% win rate` : ''} across ${best.total} trades`,
      })
    }
    // Worst pair
    const withLoss = perfByPair.filter(p => p.total >= 3 && p.pnl < 0)
    if (withLoss.length >= 1) {
      const worst = withLoss[withLoss.length - 1]
      rawInsights.push({
        icon: '⚠️', score: Math.abs(worst.pnl),
        text: `<b>${worst.pair}</b> is dragging your P&L — <b>${worst.pnl.toFixed(2)}%</b> loss across ${worst.total} trades`,
      })
    }
  }

  // 3. Best confirmation (single) vs without
  if (insightClosed.length >= 6) {
    const confWRMap = {}
    insightClosed.forEach(tr => {
      (tr.confirmations || []).forEach(c => {
        if (!confWRMap[c]) confWRMap[c] = { wins: 0, total: 0 }
        confWRMap[c].total++
        if (tr.outcome === 'TP' || tr.outcome === 'Partial TP') confWRMap[c].wins++
      })
    })
    const confList = Object.entries(confWRMap)
      .filter(([, v]) => v.total >= 3)
      .map(([c, v]) => ({ conf: c, wr: Math.round(v.wins / v.total * 100), n: v.total }))
      .sort((a, b) => b.wr - a.wr)
    if (confList.length >= 1 && insightWR !== null) {
      const best = confList[0]
      const diff = best.wr - insightWR
      if (diff >= 10) rawInsights.push({
        icon: '💡', score: diff,
        text: `Trades with <b>${best.conf}</b> confirmation have <b>${diff}% higher win rate</b> than your average (${best.wr}% vs ${insightWR}%)`,
      })
    }
  }

  // 4. After 2 consecutive losses
  if (pctAfterTwoLoss !== null && insightWR !== null && afterTwoLossWins.length >= 3) {
    const diff = Math.abs(pctAfterTwoLoss - insightWR)
    if (diff >= 10) rawInsights.push({
      icon: pctAfterTwoLoss < insightWR ? '⚠️' : '💡',
      score: diff,
      text: pctAfterTwoLoss < insightWR
        ? `Your win rate drops to <b>${pctAfterTwoLoss}%</b> after 2 consecutive losses — ${diff}% below your average`
        : `Despite 2 losses in a row, your next trade wins <b>${pctAfterTwoLoss}%</b> of the time — you bounce back well`,
    })
  }

  // 5. London vs New York session comparison
  const londonS = perfBySession.find(s => s.name === 'London')
  const nyS = perfBySession.find(s => s.name === 'New York')
  if (londonS?.winRate !== null && nyS?.winRate !== null && londonS.total >= 3 && nyS.total >= 3) {
    const better = londonS.winRate >= nyS.winRate ? londonS : nyS
    const worse = better === londonS ? nyS : londonS
    const diff = better.winRate - worse.winRate
    if (diff >= 10) rawInsights.push({
      icon: '📈', score: diff,
      text: `You perform <b>${diff}% better during ${better.name} session</b> (${better.winRate}% win rate) than ${worse.name} (${worse.winRate}%)`,
    })
  }

  // 6. Holding time — long vs short trades
  if (perfByHoldTime.length >= 2) {
    const long = perfByHoldTime.filter(b => b.min >= 120)
    const short = perfByHoldTime.filter(b => b.max <= 60)
    const longWR = long.length && long.reduce((s, b) => s + b.total, 0) >= 3
      ? Math.round(long.reduce((s, b) => s + (b.tp || 0), 0) / long.reduce((s, b) => s + b.total, 0) * 100)
      : null
    const shortWR = short.length && short.reduce((s, b) => s + b.total, 0) >= 3
      ? Math.round(short.reduce((s, b) => s + (b.tp || 0), 0) / short.reduce((s, b) => s + b.total, 0) * 100)
      : null
    if (longWR !== null && shortWR !== null) {
      const diff = Math.abs(longWR - shortWR)
      if (diff >= 10) {
        const betterLabel = longWR >= shortWR ? 'longer (2h+)' : 'shorter (<1h)'
        const betterWR = longWR >= shortWR ? longWR : shortWR
        const worseWR = longWR >= shortWR ? shortWR : longWR
        rawInsights.push({
          icon: '💡', score: diff,
          text: `You win more on <b>${betterLabel} trades</b> — ${betterWR}% win rate vs ${worseWR}% for ${longWR >= shortWR ? 'shorter' : 'longer'} ones`,
        })
      }
    }
  }

  // 7. Friday overtrading
  const friday = perfByDay.find(d => d.name === 'Friday')
  if (friday && friday.total >= 3 && insightWR !== null) {
    const diff = insightWR - (friday.winRate ?? insightWR)
    if (diff >= 15) rawInsights.push({
      icon: '⚠️', score: diff,
      text: `You may be overtrading on Fridays — win rate drops to <b>${friday.winRate}%</b> with ${friday.total} trades (${diff}% below average)`,
    })
  }

  // 8. Best combo
  if (insightClosed.length >= 6) {
    function getCombos(arr, size) {
      if (size === 1) return arr.map(a => [a])
      return arr.flatMap((a, i) => getCombos(arr.slice(i + 1), size - 1).map(rest => [a, ...rest]))
    }
    const allConfs = [...new Set(insightClosed.flatMap(tr => tr.confirmations || []))]
    const combos = getCombos(allConfs, 2).map(combo => {
      const matches = insightClosed.filter(tr => combo.every(c => (tr.confirmations || []).includes(c)))
      if (matches.length < 3) return null
      const wins = matches.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length
      const wr = Math.round(wins / matches.length * 100)
      return { combo: combo.join(' + '), wr, n: matches.length }
    }).filter(Boolean).sort((a, b) => b.wr - a.wr)
    if (combos.length >= 1 && insightWR !== null) {
      const best = combos[0]
      const diff = best.wr - insightWR
      if (diff >= 10) rawInsights.push({
        icon: '🏆', score: diff * 1.5,
        text: `Your best confirmation combo is <b>${best.combo}</b> with <b>${best.wr}% win rate</b> across ${best.n} trades — ${diff}% above average`,
      })
    }
  }

  // 9c. Continuation trades win rate vs original trades
  const contTrades = insightClosed.filter(t => t.is_continuation)
  const origFollowedIds = new Set(insightClosed.filter(t => t.is_continuation && t.parent_trade_id).map(t => t.parent_trade_id))
  const origTrades = insightClosed.filter(t => origFollowedIds.has(t.id))
  if (contTrades.length >= 3 && origTrades.length >= 3) {
    const contWR = Math.round(contTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length / contTrades.length * 100)
    const origWR = Math.round(origTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length / origTrades.length * 100)
    const diff = Math.abs(contWR - origWR)
    if (diff >= 10) rawInsights.push({
      icon: contWR >= origWR ? '🔁' : '⚠️',
      score: diff * 1.2,
      text: contWR >= origWR
        ? `Your <b>Continuation trades win ${contWR}%</b> of the time — <b>${diff}% higher</b> than the original setups they follow (${origWR}%)`
        : `Your <b>Continuation trades win only ${contWR}%</b> — <b>${diff}% lower</b> than the original setups (${origWR}%). Consider tighter criteria for follow-on entries`,
    })
  }

  // 9. Current win/loss streak warning
  if (currentStreak >= 3 && currentStreakType === 'loss') rawInsights.push({
    icon: '⚠️', score: currentStreak * 10,
    text: `You're on a <b>${currentStreak}-trade losing streak</b> — consider reducing size or sitting out until conditions improve`,
  })
  if (currentStreak >= 4 && currentStreakType === 'win') rawInsights.push({
    icon: '🔥', score: currentStreak * 5,
    text: `You're on a <b>${currentStreak}-trade winning streak</b> — your edge is working, stay disciplined and stick to your rules`,
  })

  // Sort by score descending, cap at 6
  const insights = rawInsights.sort((a, b) => b.score - a.score).slice(0, 6)

  // Dollar P&L helper
  function dollarStr(pct) {
    if (!showDollarValues || !accountSize) return ''
    const val = (pct / 100) * accountSize
    return ` ($${val >= 0 ? '+' : ''}${val.toFixed(0)})`
  }

  const grossProfit = tpTrades.reduce((s, tr) => s + computePnL(tr), 0)
  const grossLoss = slTrades.reduce((s, tr) => s + Math.abs(computePnL(tr)), 0)
  const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : null

  function generateReport() {
    function localStr(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    }
    let fromStr, toStr, periodLabel
    if (reportType === 'weekly') {
      const anchor = new Date(reportWeekOf + 'T12:00:00')
      const day = anchor.getDay() === 0 ? 7 : anchor.getDay()
      const from = new Date(anchor); from.setDate(anchor.getDate() - (day - 1))
      const to = new Date(from); to.setDate(from.getDate() + 6)
      fromStr = localStr(from)
      toStr = localStr(to)
      periodLabel = `Week of ${fromStr}`
    } else {
      const [yr, mo] = reportMonthOf.split('-').map(Number)
      fromStr = localStr(new Date(yr, mo - 1, 1))
      toStr = localStr(new Date(yr, mo, 0)) // last day of month
      periodLabel = new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
    }
    // Use full unfiltered source (ignore dashboard date filter) — always show the actual report period
    const reportTrades = [
      ...allLiveTrades,
      ...(showMissed ? allMissedTrades : []),
    ].filter(tr =>
      tr.date >= fromStr && tr.date <= toStr && !['Open', 'Invalid'].includes(tr.outcome)
    )
    const rClosed = reportTrades.filter(tr => ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome))
    const rTP = reportTrades.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP')
    const rWinRate = rClosed.length ? ((rTP.length / rClosed.length) * 100).toFixed(1) : 'N/A'
    const rTotalPnL = reportTrades.reduce((s, tr) => s + computePnL(tr), 0).toFixed(2)
    const rAvgRR = rTP.length ? (rTP.reduce((s, tr) => s + (tr.rr_potential || 0), 0) / rTP.length).toFixed(2) : 'N/A'
    const rGrossProfit = rTP.reduce((s, tr) => s + computePnL(tr), 0)
    const rGrossLoss = reportTrades.filter(tr => tr.outcome === 'SL').reduce((s, tr) => s + Math.abs(computePnL(tr)), 0)
    const rPF = rGrossLoss > 0 ? (rGrossProfit / rGrossLoss).toFixed(2) : 'N/A'

    // Per-day summary
    const dayMap = {}
    reportTrades.forEach(tr => {
      if (!dayMap[tr.date]) dayMap[tr.date] = { date: tr.date, trades: 0, pnl: 0, wins: 0 }
      dayMap[tr.date].trades++
      dayMap[tr.date].pnl += computePnL(tr)
      if (tr.outcome === 'TP' || tr.outcome === 'Partial TP') dayMap[tr.date].wins++
    })
    const dayRows = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))

    // Per-pair summary
    const pairMapR = {}
    reportTrades.forEach(tr => {
      if (!pairMapR[tr.pair]) pairMapR[tr.pair] = { pair: tr.pair, trades: 0, pnl: 0, wins: 0, closed: 0 }
      pairMapR[tr.pair].trades++
      pairMapR[tr.pair].pnl += computePnL(tr)
      if (tr.outcome === 'TP' || tr.outcome === 'Partial TP') { pairMapR[tr.pair].wins++; pairMapR[tr.pair].closed++ }
      else if (['SL', 'BE'].includes(tr.outcome)) pairMapR[tr.pair].closed++
    })
    const pairRows = Object.values(pairMapR).sort((a, b) => b.pnl - a.pnl)

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const accent = [10, 132, 255]

    // Header bar
    doc.setFillColor(...accent)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('TradingLog Report', 14, 14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${periodLabel}  ·  ${fromStr} → ${toStr}`, pageW - 14, 14, { align: 'right' })

    // Stats summary
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, 32)

    const stats = [
      ['Trades', reportTrades.length.toString()],
      ['Win Rate', `${rWinRate}%`],
      ['Total P&L', `${Number(rTotalPnL) >= 0 ? '+' : ''}${rTotalPnL}%`],
      ['Avg R:R', rAvgRR !== 'N/A' ? `1:${rAvgRR}` : 'N/A'],
      ['Profit Factor', rPF],
    ]
    const colW = (pageW - 28) / stats.length
    stats.forEach(([key, val], i) => {
      const x = 14 + i * colW
      doc.setFillColor(245, 245, 250)
      doc.roundedRect(x, 36, colW - 3, 18, 2, 2, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 130)
      doc.text(key, x + (colW - 3) / 2, 41, { align: 'center' })
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(Number(rTotalPnL) < 0 && key === 'Total P&L' ? 200 : 30, 30, 30)
      doc.text(val, x + (colW - 3) / 2, 49, { align: 'center' })
    })
    doc.setTextColor(30, 30, 30)

    // Trades table
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Trades', 14, 63)
    autoTable(doc, {
      startY: 66,
      head: [['Date', 'Pair', 'Direction', 'Outcome', 'P&L %', 'Rating']],
      body: reportTrades.map(tr => {
        const pnl = computePnL(tr)
        return [
          tr.date,
          tr.pair || '—',
          tr.direction || '—',
          tr.outcome,
          `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%`,
          tr.rating ? `${tr.rating}/5` : '—',
        ]
      }),
      headStyles: { fillColor: accent, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    })

    let y = doc.lastAutoTable.finalY + 10

    // By Day
    if (dayRows.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Performance by Day', 14, y)
      autoTable(doc, {
        startY: y + 3,
        head: [['Date', 'Trades', 'Wins', 'P&L %']],
        body: dayRows.map(d => [
          d.date,
          d.trades.toString(),
          d.wins.toString(),
          `${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(2)}%`,
        ]),
        headStyles: { fillColor: [60, 60, 70], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 248, 252] },
        columnStyles: { 3: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      })
      y = doc.lastAutoTable.finalY + 10
    }

    // By Pair
    if (pairRows.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Performance by Pair', 14, y)
      autoTable(doc, {
        startY: y + 3,
        head: [['Pair', 'Trades', 'Win Rate', 'P&L %']],
        body: pairRows.map(p => [
          p.pair,
          p.trades.toString(),
          p.closed ? `${Math.round(p.wins / p.closed * 100)}%` : '—',
          `${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}%`,
        ]),
        headStyles: { fillColor: [60, 60, 70], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 248, 252] },
        columnStyles: { 3: { halign: 'right' } },
        margin: { left: 14, right: 14 },
      })
    }

    // Footer
    const totalPages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(160, 160, 160)
      doc.text(`TradingLog · Generated ${now.toLocaleDateString()} · Page ${i}/${totalPages}`, pageW / 2, 290, { align: 'center' })
    }

    doc.save(`TradingLog_${periodLabel.replace(' ', '_')}_${fromStr}.pdf`)
    setShowReportModal(false)
  }

  // ── Confirmation Analysis ──
  const confTrades = liveTrades.filter(tr =>
    ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome) &&
    Array.isArray(tr.confirmations) && tr.confirmations.length > 0
  )

  // All unique confirmation names (for filter UI)
  const allConfNames = [...new Set(confTrades.flatMap(tr => tr.confirmations))].sort()

  const confMap = {}
  confTrades.forEach(tr => {
    const pnl = computePnL(tr)
    const isWin = tr.outcome === 'TP' || tr.outcome === 'Partial TP'
    tr.confirmations.forEach(c => {
      if (!confMap[c]) confMap[c] = { name: c, trades: 0, wins: 0, pnl: 0, rrSum: 0, rrCount: 0 }
      confMap[c].trades++
      if (isWin) { confMap[c].wins++; if (tr.rr_potential) { confMap[c].rrSum += tr.rr_potential; confMap[c].rrCount++ } }
      confMap[c].pnl += pnl
    })
  })
  const confStats = Object.values(confMap)
    .map(c => ({ ...c, winRate: Math.round(c.wins / c.trades * 100), avgRR: c.rrCount ? parseFloat((c.rrSum / c.rrCount).toFixed(2)) : 0, pnl: parseFloat(c.pnl.toFixed(2)) }))
    .sort((a, b) => b.pnl - a.pnl)

  // Filtered confStats (based on multi-select filter)
  const filteredConfStats = confFilter.length === 0 ? confStats : confStats.filter(c => confFilter.includes(c.name))

  // Generic combinations helper
  function getCombinations(arr, size) {
    if (size === 1) return arr.map(x => [x])
    const result = []
    for (let i = 0; i <= arr.length - size; i++) {
      getCombinations(arr.slice(i + 1), size - 1).forEach(rest => result.push([arr[i], ...rest]))
    }
    return result
  }

  // Combinations (size 2/3/4, filtered)
  const comboMap = {}
  confTrades.forEach(tr => {
    const trConfs = (confFilter.length === 0
      ? [...tr.confirmations]
      : tr.confirmations.filter(c => confFilter.includes(c))
    ).sort()
    if (trConfs.length < comboSize) return
    const pnl = computePnL(tr)
    const isWin = tr.outcome === 'TP' || tr.outcome === 'Partial TP'
    getCombinations(trConfs, comboSize).forEach(combo => {
      const key = combo.join(' + ')
      if (!comboMap[key]) comboMap[key] = { combo: key, trades: 0, wins: 0, pnl: 0, rrSum: 0, rrCount: 0 }
      comboMap[key].trades++
      if (isWin) {
        comboMap[key].wins++
        if (tr.rr_potential) { comboMap[key].rrSum += tr.rr_potential; comboMap[key].rrCount++ }
      }
      comboMap[key].pnl += pnl
    })
  })
  const comboStats = Object.values(comboMap)
    .filter(c => c.trades >= minComboTrades)
    .filter(c => comboConfFilter.length === 0 || comboConfFilter.every(f => c.combo.split(' + ').includes(f)))
    .map(c => ({ ...c, winRate: Math.round(c.wins / c.trades * 100), avgRR: c.rrCount ? parseFloat((c.rrSum / c.rrCount).toFixed(2)) : 0, pnl: parseFloat(c.pnl.toFixed(2)) }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 20)

  // Best combo: highest score = winRate% × avgRR
  const bestCombo = comboStats.length > 0
    ? comboStats.reduce((best, c) => {
        const score = (c.winRate / 100) * (c.avgRR || 1)
        const bScore = (best.winRate / 100) * (best.avgRR || 1)
        return score > bScore ? c : best
      }, comboStats[0])
    : null

  // Heatmap: confirmation × day of week
  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const heatmapData = {}
  confTrades.forEach(tr => {
    if (!tr.date) return
    const dow = new Date(tr.date + 'T12:00:00').getDay() // 0=Sun
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]
    if (!heatmapDays.includes(dayName)) return
    const isWin = tr.outcome === 'TP' || tr.outcome === 'Partial TP'
    const confsToProcess = confFilter.length === 0 ? tr.confirmations : tr.confirmations.filter(c => confFilter.includes(c))
    confsToProcess.forEach(c => {
      if (!heatmapData[c]) heatmapData[c] = {}
      if (!heatmapData[c][dayName]) heatmapData[c][dayName] = { wins: 0, trades: 0 }
      heatmapData[c][dayName].trades++
      if (isWin) heatmapData[c][dayName].wins++
    })
  })

  const statCards = [
    {
      label: t.winRate,
      value: winRate !== null ? `${winRate}%` : '--',
      sub: `${closedTrades.length} closed trades`,
      color: 'var(--text)',
    },
    {
      label: t.monthlyPnl,
      value: monthTrades.length > 0
        ? `${monthlyPnL >= 0 ? '+' : ''}${monthlyPnL.toFixed(2)}%${dollarStr(monthlyPnL)}`
        : '--',
      sub: `${monthTrades.length} trades${dateFilter.type === 'month' ? ` in ${navMonthLabel}` : ' this month'}`,
      color: monthlyPnL >= 0 ? '#4ade80' : '#f87171',
    },
    {
      label: t.avgRR,
      value: avgRR !== null ? `1:${avgRR}` : '--',
      sub: `${tpTrades.length} TP trades`,
      color: 'var(--text)',
    },
    {
      label: t.openTrades,
      value: openTrades.length.toString(),
      sub: 'currently active',
      color: 'var(--text)',
    },
    {
      label: 'Total Trades',
      value: closedTrades.length.toString(),
      sub: `${tpTrades.length} TP · ${slTrades.length} SL · ${beTrades.length} BE`,
      color: 'var(--text)',
    },
    ...(captureRate !== null ? [{
      label: 'Capture Rate',
      value: `${captureRate}%`,
      sub: `${tpTrades.length} / ${backtestTotal} opportunities`,
      color: 'var(--text)',
    }] : []),
    ...(profitFactor !== null ? [{
      label: 'Profit Factor',
      value: profitFactor.toFixed(2),
      sub: `${grossProfit.toFixed(2)}% gross profit`,
      color: profitFactor >= 1.5 ? '#4ade80' : profitFactor >= 1 ? '#facc15' : '#f87171',
      tooltip: 'Gross Profit ÷ Gross Loss\n>1.5 = good  |  <1 = losing',
    }] : []),
    ...(avgHoldMinutes !== null ? [{
      label: 'Avg Hold Time',
      value: avgHoldStr,
      sub: `${holdingTimes.length} trades with exit time`,
      color: 'var(--text)',
    }] : []),
    ...(expectancy !== null ? [{
      label: 'Expectancy',
      value: `${expectancy >= 0 ? '+' : ''}${expectancy}%${dollarStr(expectancy)}`,
      sub: '(Win Rate × Avg Win) − (Loss Rate × Avg Loss)',
      color: expectancy >= 0 ? '#30D158' : '#FF453A',
      tooltip: 'Expected P&L per trade based on win rate and avg outcomes',
    }] : []),
    ...(maxDrawdownPct !== null ? [{
      label: 'Max Drawdown',
      value: `-${maxDrawdownPct}%${dollarStr(-maxDrawdownPct)}`,
      sub: 'Peak to trough on equity curve',
      color: '#FF453A',
      tooltip: 'Largest peak-to-trough drop in cumulative P&L',
    }] : []),
    ...(riskOfRuin !== null ? [{
      label: 'Risk of Ruin',
      value: `${riskOfRuin}%`,
      sub: 'Probability of -20% account loss',
      color: riskOfRuin < 5 ? '#30D158' : riskOfRuin < 20 ? '#FF9F0A' : '#FF453A',
      tooltip: 'Statistical risk of losing 20% of your account\n<5% = safe  |  5–20% = caution  |  >20% = high risk',
    }] : []),
  ]

  const outcomeBreakdown = [
    { label: 'TP', count: tpTrades.length, color: '#4ade80' },
    { label: 'SL', count: slTrades.length, color: '#f87171' },
    { label: 'BE', count: beTrades.length, color: '#facc15' },
    { label: 'Invalid', count: invalidTrades.length, color: '#9ca3af' },
  ]
  const totalOutcome = outcomeBreakdown.reduce((s, o) => s + o.count, 0)

  const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    boxShadow: 'var(--shadow)',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px', lineHeight: 1 }}>📈</div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.03em' }}>No trades yet</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '28px', maxWidth: '340px', lineHeight: 1.6 }}>
          Add your first trade to see your stats, equity curve, and performance analytics.
        </p>
        <Link
          to="/new"
          style={{
            padding: '12px 28px', borderRadius: '50px', fontSize: '15px', fontWeight: 700,
            background: 'var(--accent)', color: '#fff', textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(10,132,255,0.3)',
          }}
        >
          + Add First Trade
        </Link>
      </div>
    )
  }

  const askClaude = async () => {
    if (!claudeQuestion.trim() || claudeLoading) return
    const q = claudeQuestion.trim()
    setClaudeQuestion('')
    setClaudeLoading(true)
    setClaudeHistory(h => [...h, { role: 'user', text: q }])
    try {
      const res = await fetch('/api/ask-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, trades }),
      })
      const data = await res.json()
      setClaudeHistory(h => [...h, { role: 'claude', text: data.answer || data.error || 'Error' }])
    } catch {
      setClaudeHistory(h => [...h, { role: 'claude', text: 'Connection error' }])
    } finally {
      setClaudeLoading(false)
      setTimeout(() => claudeBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  return (
    <>
      {/* Confetti overlay */}
      {confettiPieces.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998, overflow: 'hidden' }}>
          <style>{`
            @keyframes confettiFall {
              0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
              80% { opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
          {confettiPieces.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: '-10px',
              width: p.shape === 'circle' ? `${p.size}px` : `${p.size * 0.7}px`,
              height: p.shape === 'circle' ? `${p.size}px` : `${p.size * 1.3}px`,
              borderRadius: p.shape === 'circle' ? '50%' : '2px',
              background: p.color,
              animation: `confettiFall ${p.dur}s ease-in ${p.delay}s forwards`,
              transform: `rotate(${p.rotate}deg)`,
            }} />
          ))}
        </div>
      )}

      {/* Goal achieved toast */}
      {goalToast && (
        <div className="fade-in" style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #30D158, #0A84FF)',
          color: '#fff', padding: '14px 24px',
          borderRadius: '14px', fontSize: '15px', fontWeight: 700,
          boxShadow: '0 8px 30px rgba(48,209,88,0.4)',
          zIndex: 9999, whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {goalToast}
        </div>
      )}

      {/* Report Modal — outside page-wrap to avoid transform clipping position:fixed */}
      {showReportModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowReportModal(false)}
        >
          <div
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', padding: '28px', width: '340px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Export PDF Report</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Select a period and export a PDF with stats and trade list</p>

            {/* Type toggle */}
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: '10px', padding: '3px', marginBottom: '20px', border: '1px solid var(--border)' }}>
              {[{ key: 'weekly', label: '📅 Weekly' }, { key: 'monthly', label: '📆 Monthly' }].map(({ key, label }) => (
                <button key={key} onClick={() => setReportType(key)} style={{
                  flex: 1, padding: '8px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: reportType === key ? 'var(--btn-primary-bg)' : 'transparent',
                  color: reportType === key ? 'var(--btn-primary-color)' : 'var(--text-muted)',
                }}>{label}</button>
              ))}
            </div>

            {/* Date picker */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {reportType === 'weekly' ? 'Pick any date within the week' : 'Select month'}
              </label>
              {reportType === 'weekly' ? (
                <input
                  type="date"
                  value={reportWeekOf}
                  onChange={e => setReportWeekOf(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              ) : (
                <input
                  type="month"
                  value={reportMonthOf}
                  onChange={e => setReportMonthOf(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={generateReport}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff',
                marginBottom: '10px', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Export PDF ↓
            </button>
            <button
              onClick={() => setShowReportModal(false)}
              style={{ width: '100%', padding: '9px', borderRadius: '10px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}
            >Cancel</button>
          </div>
        </div>
      )}

    <div
      className={`page-wrap transition-all duration-300 ${visible ? 'fade-in' : 'opacity-0'}`}
      style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}
    >
      {/* ── Time Filter Bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginRight: '8px', letterSpacing: '-0.03em' }}>
          {t.dashboard}
        </h1>

        {/* Filter buttons */}
        {[
          { key: 'all', label: 'All Time' },
          { key: 'month', label: 'Monthly' },
          { key: 'year', label: 'Yearly' },
        ].map(btn => (
          <button
            key={btn.key}
            onClick={() => { setDateFilter({ type: btn.key, from: '', to: '' }); setNavOffset(0); setCustomOpen(false) }}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              border: `1px solid ${dateFilter.type === btn.key && !customOpen ? 'var(--border-strong)' : 'var(--border)'}`,
              background: dateFilter.type === btn.key && !customOpen ? 'var(--card-hover)' : 'transparent',
              color: dateFilter.type === btn.key && !customOpen ? 'var(--text)' : 'var(--text-muted)',
            }}
          >{btn.label}</button>
        ))}

        {/* Custom Dates button + popup */}
        <div ref={customRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setCustomOpen(o => !o)}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              border: `1px solid ${(dateFilter.type === 'custom' || customOpen) ? 'var(--border-strong)' : 'var(--border)'}`,
              background: (dateFilter.type === 'custom' || customOpen) ? 'var(--card-hover)' : 'transparent',
              color: (dateFilter.type === 'custom' || customOpen) ? 'var(--text)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            Custom Dates
            {dateFilter.type === 'custom' && dateFilter.from && (
              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                {dateFilter.from.slice(0,4)}
                {dateFilter.to && dateFilter.to !== dateFilter.from ? ` → ${dateFilter.to.slice(0,4)}` : ''}
              </span>
            )}
            <span style={{ fontSize: '10px' }}>{customOpen ? '▲' : '▼'}</span>
          </button>

          {customOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 300,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '18px', padding: '16px', minWidth: '300px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            }}>
              {/* Year quick buttons */}
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quick Year
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {availableYears.map(y => {
                  const isActive = dateFilter.type === 'custom' && dateFilter.from === `${y}-01-01` && dateFilter.to === `${y}-12-31`
                  return (
                    <button
                      key={y}
                      onClick={() => setDateFilter({ type: 'custom', from: `${y}-01-01`, to: `${y}-12-31` })}
                      style={{
                        padding: '5px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                        background: isActive ? 'var(--accent)' : 'var(--bg)',
                        color: isActive ? '#fff' : 'var(--text)',
                        transition: 'all 0.12s',
                      }}
                    >{y}</button>
                  )
                })}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Custom Range
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>From</p>
                    <DatePicker
                      value={dateFilter.from}
                      onChange={v => setDateFilter(prev => ({ ...prev, from: v, type: 'custom' }))}
                    />
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '16px' }}>→</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>To</p>
                    <DatePicker
                      value={dateFilter.to}
                      onChange={v => setDateFilter(prev => ({ ...prev, to: v, type: 'custom' }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

        {/* Missed trades toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowMissed(v => !v)}
            style={{
              width: '40px', height: '22px', borderRadius: '11px', border: 'none',
              background: showMissed ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '3px',
              left: showMissed ? '21px' : '3px',
              width: '16px', height: '16px', borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '13px', color: showMissed ? 'var(--text)' : 'var(--text-muted)', fontWeight: showMissed ? 600 : 400 }}>
            Include Missed
          </span>
        </div>

        {/* Export Report — pushed to right */}
        <button
          onClick={() => setShowReportModal(true)}
          style={{
            marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export PDF
        </button>
      </div>

      {/* Month / Year navigation row */}
      {(dateFilter.type === 'month' || dateFilter.type === 'year') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={() => setNavOffset(o => o - 1)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '6px 14px', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s', fontWeight: 700 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >←</button>
          <button
            onClick={() => setNavOffset(0)}
            title={navOffset !== 0 ? 'Back to current' : undefined}
            style={{
              background: navOffset === 0 ? 'var(--card-hover)' : 'var(--accent-light)',
              border: `1px solid ${navOffset === 0 ? 'var(--border)' : 'var(--accent)'}`,
              borderRadius: '10px', padding: '6px 20px',
              fontSize: '14px', fontWeight: 700, cursor: navOffset !== 0 ? 'pointer' : 'default',
              color: navOffset === 0 ? 'var(--text)' : 'var(--accent)',
              transition: 'all 0.15s', letterSpacing: '-0.02em',
            }}
          >
            {dateFilter.type === 'month' ? navMonthLabel : navYearLabel}
            {navOffset !== 0 && <span style={{ fontSize: '11px', marginLeft: '6px', opacity: 0.7 }}>↩ now</span>}
          </button>
          <button
            onClick={() => setNavOffset(o => o + 1)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '6px 14px', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.15s', fontWeight: 700 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >→</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {[{ key: 'overview', label: 'Overview' }, { key: 'confirmations', label: '🔍 Confirmation Analysis' }].map(tab => (
          <button key={tab.key} onClick={() => setDashTab(tab.key)} style={{
            padding: '10px 20px', fontSize: '13.5px', fontWeight: dashTab === tab.key ? 600 : 400,
            background: 'none', border: 'none', cursor: 'pointer',
            color: dashTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${dashTab === tab.key ? 'var(--accent)' : 'transparent'}`,
            transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Confirmation Analysis Tab ── */}
      {dashTab === 'confirmations' && (
        <div>
          {confStats.length === 0 ? (
            <div style={{ ...cardStyle, padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No confirmation data yet — add confirmations to your trades to see analysis.</p>
            </div>
          ) : (
            <>
              {/* Multi-select filter */}
              <div style={{ ...cardStyle, padding: '14px 18px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px', whiteSpace: 'nowrap' }}>Filter:</span>
                  <button
                    onClick={() => setConfFilter([])}
                    style={{
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                      background: confFilter.length === 0 ? 'var(--accent)' : 'transparent',
                      color: confFilter.length === 0 ? '#fff' : 'var(--text-muted)',
                      borderColor: confFilter.length === 0 ? 'var(--accent)' : 'var(--border)',
                    }}
                  >All</button>
                  {allConfNames.map(name => {
                    const active = confFilter.includes(name)
                    return (
                      <button
                        key={name}
                        onClick={() => setConfFilter(prev => active ? prev.filter(x => x !== name) : [...prev, name])}
                        style={{
                          padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                          background: active ? 'rgba(96,165,250,0.18)' : 'transparent',
                          color: active ? '#60a5fa' : 'var(--text-muted)',
                          borderColor: active ? '#60a5fa' : 'var(--border)',
                        }}
                      >{name}</button>
                    )
                  })}
                </div>
              </div>

              {/* Bar chart — top confirmations by P&L */}
              <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Confirmations by P&L</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Which confirmations generate the most profit</p>
                <ResponsiveContainer width="100%" height={isMobile ? 170 : 220}>
                  <BarChart data={filteredConfStats.slice(0, 12)} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>{d.name}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.trades} trades · {d.winRate}% win rate</p>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: d.pnl >= 0 ? '#4ade80' : '#f87171', marginTop: '4px' }}>{d.pnl >= 0 ? '+' : ''}{d.pnl}% P&L</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg R:R 1:{d.avgRR}</p>
                        </div>
                      )
                    }} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {filteredConfStats.slice(0, 12).map((c, i) => (
                        <Cell key={i} fill={c.pnl >= 0 ? '#4ade80' : '#f87171'} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats table */}
              <div style={{ ...cardStyle, marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Confirmation Breakdown</h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Confirmation', 'Trades', 'Win Rate', 'Avg R:R', 'Total P&L'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: h === 'Confirmation' ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredConfStats.map((c, i) => (
                        <tr key={c.name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{c.name}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right' }}>{c.trades}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: c.winRate >= 60 ? '#4ade80' : c.winRate >= 45 ? '#f59e0b' : '#f87171' }}>{c.winRate}%</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)', textAlign: 'right' }}>1:{c.avgRR || '--'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: c.pnl >= 0 ? '#4ade80' : '#f87171' }}>{c.pnl >= 0 ? '+' : ''}{c.pnl}%{dollarStr(c.pnl)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Combinations Analysis */}
              <div style={{ ...cardStyle, overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>Combinations Analysis</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Confirmations that appear together, sorted by win rate</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                    {/* Combo size toggle */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[2, 3, 4].map(n => (
                        <button key={n} onClick={() => setComboSize(n)} style={{
                          padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                          background: comboSize === n ? 'var(--accent)' : 'transparent',
                          color: comboSize === n ? '#fff' : 'var(--text-muted)',
                          borderColor: comboSize === n ? 'var(--accent)' : 'var(--border)',
                        }}>{n} confs</button>
                      ))}
                    </div>
                    {/* Min trades */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Min trades:</span>
                      <input
                        type="number" min={1} max={20} value={minComboTrades}
                        onChange={e => setMinComboTrades(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '52px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Confirmation filter inside combinations */}
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: 'rgba(128,128,128,0.03)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Must include:</span>
                  <button
                    onClick={() => setComboConfFilter([])}
                    style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                      background: comboConfFilter.length === 0 ? 'var(--accent)' : 'transparent',
                      color: comboConfFilter.length === 0 ? '#fff' : 'var(--text-muted)',
                      borderColor: comboConfFilter.length === 0 ? 'var(--accent)' : 'var(--border)',
                    }}
                  >All</button>
                  {allConfNames.map(name => {
                    const active = comboConfFilter.includes(name)
                    return (
                      <button
                        key={name}
                        onClick={() => setComboConfFilter(prev => active ? prev.filter(x => x !== name) : [...prev, name])}
                        style={{
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                          background: active ? 'rgba(96,165,250,0.18)' : 'transparent',
                          color: active ? '#60a5fa' : 'var(--text-muted)',
                          borderColor: active ? '#60a5fa' : 'var(--border)',
                        }}
                      >{name}</button>
                    )
                  })}
                </div>

                {/* Best Combo highlight */}
                {bestCombo && (
                  <div style={{ padding: '12px 18px', background: 'rgba(250,204,21,0.06)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px' }}>🏆</span>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Best Combo</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {bestCombo.combo.split(' + ').map((tag, idx, arr) => (
                          <span key={idx}>
                            <span style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 700 }}>{tag}</span>
                            {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '18px', marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1px' }}>Win Rate</p>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: '#4ade80' }}>{bestCombo.winRate}%</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1px' }}>Avg R:R</p>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>1:{bestCombo.avgRR || '--'}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1px' }}>Trades</p>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{bestCombo.trades}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '1px' }}>P&L</p>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: bestCombo.pnl >= 0 ? '#4ade80' : '#f87171' }}>{bestCombo.pnl >= 0 ? '+' : ''}{bestCombo.pnl}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {comboStats.length === 0 ? (
                  <div style={{ padding: '28px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No combinations found with {comboSize} confirmations and min. {minComboTrades} trades.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Combination', 'Trades', 'Win Rate', 'Avg R:R', 'Total P&L'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: h === 'Combination' ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comboStats.map((c, i) => {
                          const isBest = bestCombo && c.combo === bestCombo.combo
                          return (
                            <tr key={c.combo} style={{ borderBottom: '1px solid var(--border)', background: isBest ? 'rgba(250,204,21,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)' }}>
                              <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                                {isBest && <span style={{ marginRight: '6px' }}>🏆</span>}
                                {c.combo.split(' + ').map((tag, idx, arr) => (
                                  <span key={idx}>
                                    <span style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>{tag}</span>
                                    {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>+</span>}
                                  </span>
                                ))}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right' }}>{c.trades}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: c.winRate >= 60 ? '#4ade80' : c.winRate >= 45 ? '#f59e0b' : '#f87171' }}>{c.winRate}%</span>
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)', textAlign: 'right' }}>1:{c.avgRR || '--'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: c.pnl >= 0 ? '#4ade80' : '#f87171' }}>{c.pnl >= 0 ? '+' : ''}{c.pnl}%{dollarStr(c.pnl)}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Confirmation × Day Heatmap */}
              {Object.keys(heatmapData).length > 0 && (
                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h2 style={{ fontSize: '15px', fontWeight: 650, color: 'var(--text)', marginBottom: '3px', letterSpacing: '-0.01em' }}>Confirmation × Day</h2>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Win rate per confirmation by day of week</p>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {[['#30D158', 'High (≥60%)'], ['#FF9F0A', 'Mid (40–60%)'], ['#FF453A', 'Low (<40%)']].map(([color, label]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, opacity: 0.7 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grid */}
                  <div style={{ overflowX: 'auto', padding: '20px 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(5, 1fr)`, gap: '6px', minWidth: '520px' }}>
                      {/* Header row */}
                      <div />
                      {heatmapDays.map(d => (
                        <div key={d} style={{ textAlign: 'center', padding: '6px 0', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d}</div>
                      ))}

                      {/* Data rows */}
                      {Object.keys(heatmapData).sort().map((conf, ri) => {
                        const totalTrades = heatmapDays.reduce((s, d) => s + (heatmapData[conf]?.[d]?.trades || 0), 0)
                        const totalWins = heatmapDays.reduce((s, d) => s + (heatmapData[conf]?.[d]?.wins || 0), 0)
                        const overallWR = totalTrades > 0 ? Math.round(totalWins / totalTrades * 100) : null
                        return [
                          // Label cell
                          <div key={`${conf}-label`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px 0 0', minHeight: '52px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{conf}</span>
                            {overallWR !== null && (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: overallWR >= 60 ? '#30D158' : overallWR >= 40 ? '#FF9F0A' : '#FF453A', flexShrink: 0 }}>{overallWR}%</span>
                            )}
                          </div>,
                          // Day cells
                          ...heatmapDays.map(day => {
                            const cell = heatmapData[conf]?.[day]
                            if (!cell || cell.trades === 0) {
                              return (
                                <div key={`${conf}-${day}`} style={{
                                  borderRadius: '10px', background: 'var(--bg-secondary)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  minHeight: '52px', opacity: 0.4,
                                }}>
                                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>–</span>
                                </div>
                              )
                            }
                            const wr = Math.round(cell.wins / cell.trades * 100)
                            const isGreen = wr >= 60
                            const isYellow = wr >= 40 && wr < 60
                            const bgColor = isGreen
                              ? `rgba(48,209,88,${0.08 + (wr / 100) * 0.22})`
                              : isYellow
                                ? `rgba(255,159,10,${0.08 + (wr / 100) * 0.2})`
                                : `rgba(255,69,58,${0.08 + ((100 - wr) / 100) * 0.22})`
                            const borderColor = isGreen ? 'rgba(48,209,88,0.25)' : isYellow ? 'rgba(255,159,10,0.25)' : 'rgba(255,69,58,0.25)'
                            const textColor = isGreen ? '#30D158' : isYellow ? '#FF9F0A' : '#FF453A'
                            return (
                              <div key={`${conf}-${day}`} style={{
                                borderRadius: '10px', background: bgColor, border: `1px solid ${borderColor}`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                minHeight: '52px', gap: '1px', cursor: 'default',
                                transition: 'transform 0.1s',
                              }}
                                title={`${conf} on ${day}: ${cell.wins}/${cell.trades} trades won`}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                <span style={{ fontSize: '14px', fontWeight: 700, color: textColor, letterSpacing: '-0.02em' }}>{wr}%</span>
                                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)' }}>{cell.trades} trade{cell.trades !== 1 ? 's' : ''}</span>
                              </div>
                            )
                          })
                        ]
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Overview Tab ── */}
      {dashTab === 'overview' && <>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px' }}
        className="lg:grid-cols-4">
        <style>{`@media (min-width: 1024px) { .stat-grid { grid-template-columns: repeat(4, 1fr) !important; } }`}</style>
        {statCards.map(card => (
          <div key={card.label} style={{ ...cardStyle, padding: '18px' }} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{card.label}</p>
              {card.tooltip && (
                <div style={{ position: 'relative', display: 'inline-flex' }}
                  onMouseEnter={e => e.currentTarget.querySelector('.tt').style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.querySelector('.tt').style.opacity = '0'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'default' }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <div className="tt" style={{
                    position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'pre',
                    boxShadow: 'var(--shadow-md)', pointerEvents: 'none', opacity: 0,
                    transition: 'opacity 0.15s', zIndex: 10, width: 'max-content',
                  }}>
                    {card.tooltip}
                  </div>
                </div>
              )}
            </div>
            <p style={{ fontSize: '24px', fontWeight: 700, color: card.color, marginBottom: '4px' }}>{card.value}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly Goals */}
      {goalItems.length > 0 && (() => {
        const monthName = now.toLocaleString('en-US', { month: 'long' })
        return (
          <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px', letterSpacing: '-0.01em' }}>Monthly Goals</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{monthName} progress</p>
              </div>
              <a href="/settings" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >Edit goals →</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {goalItems.map(g => {
                const rawPct = g.target > 0 ? (g.current / g.target) * 100 : 0
                const pct = Math.min(rawPct, 100)
                const achieved = pct >= 100
                const barColor = achieved ? '#30D158' : '#0A84FF'
                return (
                  <div key={g.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {achieved && <span style={{ fontSize: '14px' }}>✅</span>}
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{g.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: achieved ? '#30D158' : 'var(--text)' }}>
                          {g.format(g.current)}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {g.targetFormat(g.target)}</span>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                          background: achieved ? 'rgba(48,209,88,0.15)' : 'rgba(10,132,255,0.12)',
                          color: achieved ? '#30D158' : '#0A84FF',
                        }}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: '6px', borderRadius: '6px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: '6px',
                        background: achieved
                          ? '#30D158'
                          : `linear-gradient(90deg, #0A84FF, ${pct > 70 ? '#30D158' : '#0A84FF'})`,
                        transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                        boxShadow: achieved ? '0 0 8px rgba(48,209,88,0.5)' : 'none',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Weekly Score */}
      {thisWeekStats.trades > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>Weekly Score</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {thisWeekBounds.from.slice(5).replace('-', '/')} – {thisWeekBounds.to.slice(5).replace('-', '/')}
              </p>
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
              background: 'var(--bg-secondary)', color: 'var(--text-muted)',
            }}>This week</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Score circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: `conic-gradient(${weekGrade.color} ${(thisWeekStats.score ?? 0) * 3.6}deg, var(--bg-secondary) 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 16px ${weekGrade.color}40`,
              }}>
                <div style={{
                  width: '62px', height: '62px', borderRadius: '50%', background: 'var(--card)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: weekGrade.color, lineHeight: 1 }}>
                    {thisWeekStats.score !== null ? thisWeekStats.score : '--'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.2 }}>/100</span>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: weekGrade.color, textAlign: 'center' }}>{weekGrade.label}</span>
            </div>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {[
                {
                  label: 'Trades',
                  value: thisWeekStats.trades,
                  prev: lastWeekStats.trades,
                  format: v => String(v),
                  up: thisWeekStats.trades > lastWeekStats.trades,
                  neutral: thisWeekStats.trades === lastWeekStats.trades,
                },
                {
                  label: 'Win Rate',
                  value: thisWeekStats.winRate,
                  prev: lastWeekStats.winRate,
                  format: v => v !== null ? `${v}%` : '--',
                  up: (thisWeekStats.winRate ?? 0) > (lastWeekStats.winRate ?? 0),
                  neutral: thisWeekStats.winRate === lastWeekStats.winRate,
                  positive: v => v !== null && v >= 50,
                },
                {
                  label: 'P&L',
                  value: thisWeekStats.pnl,
                  prev: lastWeekStats.pnl,
                  format: v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                  up: thisWeekStats.pnl > lastWeekStats.pnl,
                  neutral: thisWeekStats.pnl === lastWeekStats.pnl,
                  positive: v => v >= 0,
                },
                {
                  label: 'Violations',
                  value: thisWeekStats.violations,
                  prev: lastWeekStats.violations,
                  format: v => v === 0 ? '✅ None' : `${v} trade${v > 1 ? 's' : ''}`,
                  up: thisWeekStats.violations < lastWeekStats.violations,
                  neutral: thisWeekStats.violations === lastWeekStats.violations,
                  positive: v => v === 0,
                },
              ].map(stat => {
                const val = stat.value
                const isPositive = stat.positive ? stat.positive(val) : stat.up
                const valColor = stat.label === 'P&L'
                  ? (val >= 0 ? '#30D158' : '#FF453A')
                  : stat.label === 'Win Rate'
                    ? ((val ?? 0) >= 50 ? '#30D158' : val !== null ? '#FF453A' : 'var(--text-muted)')
                    : stat.label === 'Violations'
                      ? (val === 0 ? '#30D158' : '#FF453A')
                      : 'var(--text)'
                const diff = lastWeekStats.trades > 0 && val !== null && stat.prev !== null
                  ? (stat.label === 'Violations' || stat.label === 'Trades')
                    ? val - stat.prev
                    : val - stat.prev
                  : null
                const arrow = diff === null || diff === 0 ? null : stat.label === 'Violations' ? (diff < 0 ? '↓' : '↑') : (diff > 0 ? '↑' : '↓')
                const arrowGood = diff === null ? false : stat.label === 'Violations' ? diff < 0 : stat.label === 'Trades' ? diff > 0 : diff > 0
                return (
                  <div key={stat.label} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px 14px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{stat.label}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: valColor }}>{stat.format(val)}</span>
                      {arrow && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: arrowGood ? '#30D158' : '#FF453A' }}>
                          {arrow} {Math.abs(diff ?? 0).toFixed(stat.label === 'P&L' ? 2 : 0)}{stat.label === 'P&L' ? '%' : stat.label === 'Win Rate' ? '%' : ''}
                        </span>
                      )}
                    </div>
                    {lastWeekStats.trades > 0 && (
                      <p style={{ fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                        Last week: {stat.format(stat.prev)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Equity Curve */}
      {equityData.length > 1 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Equity Curve</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cumulative P&L across all trades</p>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: equityPositive ? '#0A84FF' : '#f87171' }}>
                  {equityFinal >= 0 ? '+' : ''}{equityFinal.toFixed(2)}%
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Peak</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#30D158' }}>+{equityMax.toFixed(2)}%</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Low</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#f87171' }}>{equityMin.toFixed(2)}%</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={equityPositive ? '#0A84FF' : '#f87171'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={equityPositive ? '#0A84FF' : '#f87171'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{d.label}</p>
                      {d.pair && <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '2px' }}>{d.pair} · {d.outcome}</p>}
                      <p style={{ fontSize: '15px', fontWeight: 700, color: d.value >= 0 ? '#0A84FF' : '#f87171' }}>
                        {d.value >= 0 ? '+' : ''}{d.value}%{dollarStr(d.value)}
                      </p>
                    </div>
                  )
                }}
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={equityPositive ? '#0A84FF' : '#f87171'}
                strokeWidth={2}
                fill="url(#equityGrad)"
                dot={false}
                activeDot={{ r: 4, fill: equityPositive ? '#0A84FF' : '#f87171', stroke: 'var(--card)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly P&L Chart */}
      <div style={{ ...cardStyle, padding: '18px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>
          {t.weeklyPnl}
        </h2>
        {chartData.length === 0 ? (
          <p style={{ fontSize: '13px', textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            {t.noTrades}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<CustomTooltip showDollarValues={showDollarValues} accountSize={accountSize} />} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#0A84FF' : '#FF453A'} opacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Entry Heatmap */}
      {(allLiveTrades.filter(inDateRange).length > 0 || allMissedTrades.filter(inDateRange).length > 0) && entryHours.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Entry time heatmap</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>When do you enter trades? Darker = more</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#1d4ed8' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Live</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Missed</span>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {entryPeakHour && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 14px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Busiest hour</p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                  {String(entryPeakHour.hour).padStart(2, '0')}:00
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{entryPeakHour.count} trades total</p>
              </div>
            )}
            {entryPeakDay && entryPeakDay.count > 0 && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 14px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Busiest day</p>
                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{entryPeakDay.day}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{entryPeakDay.count} trades total</p>
              </div>
            )}
          </div>

          {/* Grid */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '480px' }}>
              {/* Hour labels */}
              <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${entryHours.length}, 1fr)`, gap: '3px', marginBottom: '3px' }}>
                <div />
                {entryHours.map(h => (
                  <div key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {/* Day rows — Mon→Sun order */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} style={{ display: 'grid', gridTemplateColumns: `52px repeat(${entryHours.length}, 1fr)`, gap: '3px', marginBottom: '3px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>{day}</div>
                  {entryHours.map(h => {
                    const cell = entryGrid[day][h] || { total: 0, wins: 0, losses: 0 }
                    const missed = entryHeatmapMissed[day][h] || 0
                    const live = cell.total
                    const total = live + missed
                    const isEmpty = total === 0
                    const closed = cell.wins + cell.losses
                    const winRate = closed > 0 ? cell.wins / closed : null
                    // Color by win rate: green=win, red=loss, blue=no closed trades
                    const cellBg = isEmpty ? 'var(--bg-secondary)'
                      : winRate === null ? (missed > 0 ? '#f59e0b66' : '#1d4ed866')
                      : winRate >= 0.6 ? '#16a34a'
                      : winRate >= 0.4 ? '#ca8a04'
                      : '#dc2626'
                    const textCol = isEmpty ? 'transparent' : '#fff'
                    const tooltipWR = closed > 0 ? ` · ${Math.round(winRate*100)}% WR (${cell.wins}W/${cell.losses}L)` : ''
                    return (
                      <div key={h} title={`${day} ${String(h).padStart(2, '0')}:00 — ${live} live${missed > 0 ? ` · ${missed} missed` : ''}${tooltipWR}`} style={{
                        height: '28px', borderRadius: '4px',
                        background: cellBg,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                      }}>
                        {!isEmpty && (
                          <>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: textCol, lineHeight: 1 }}>{total}</span>
                            {closed > 0 && <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', lineHeight: 1 }}>{Math.round(winRate*100)}%</span>}
                            {missed > 0 && <div style={{ position: 'absolute', top: 2, right: 3, width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b' }} />}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {[['#16a34a','≥60% wins'],['#ca8a04','40–60%'],['#dc2626','<40% wins'],['#1d4ed866','No closed'],['#f59e0b','● Missed']].map(([color, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Winners & Losers */}
      {closedTrades.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          {/* Winners */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>Winners</h2>
              <span style={{ marginRight: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                {tpTrades.length} trades
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '--', color: '#4ade80' },
                { label: 'Avg Win (R:R)', value: avgWinRR ? `1:${avgWinRR}` : '--' },
                { label: 'Best Win (R:R)', value: maxWinRR ? `1:${maxWinRR}` : '--' },
                { label: 'Max Win Streak', value: maxConsecWins > 0 ? maxConsecWins : '--' },
                { label: 'Avg Win Streak', value: avgConsecWins ?? '--' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Losers */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>Losers</h2>
              <span style={{ marginRight: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                {slTrades.length} trades
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Loss Rate', value: winRate !== null ? `${(100 - parseFloat(winRate)).toFixed(1)}%` : '--', color: '#f87171' },
                { label: 'Avg Loss (risk)', value: avgLossRisk ? `${avgLossRisk}%` : '--' },
                { label: 'Worst Loss (risk)', value: maxLossRisk ? `${maxLossRisk}%` : '--' },
                { label: 'Max Loss Streak', value: maxConsecLosses > 0 ? maxConsecLosses : '--' },
                { label: 'Avg Loss Streak', value: avgConsecLosses ?? '--' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: row.color || 'var(--text)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Current streak banner */}
          {currentStreak > 0 && currentStreakType && (
            <div style={{
              gridColumn: '1 / -1',
              ...cardStyle,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderColor: currentStreakType === 'win' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)',
            }}>
              <span style={{ fontSize: '22px' }}>{currentStreakType === 'win' ? '🔥' : '❄️'}</span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: currentStreakType === 'win' ? '#4ade80' : '#f87171' }}>
                  Current streak: {currentStreak} {currentStreakType === 'win' ? 'wins' : 'losses'} in a row
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {currentStreakType === 'win' ? 'Keep it up! Maintain your performance' : 'Analyze the losses and look for a pattern'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Streak Analysis */}
      {sortedClosed.length >= 3 && (
        <div style={{ ...cardStyle, padding: '22px', marginBottom: '20px' }}>
          {/* Header */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px', letterSpacing: '-0.01em' }}>Streak Analysis</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Patterns & behavior based on {sortedClosed.length} closed trades</p>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '12px', marginBottom: '22px' }}>
            {[
              { label: 'Max Win Streak', value: maxConsecWins || '--', color: '#30D158', icon: '🔥' },
              { label: 'Max Loss Streak', value: maxConsecLosses || '--', color: '#FF453A', icon: '❄️' },
              { label: 'Avg Win Streak', value: avgConsecWins ?? '--', color: '#30D158' },
              { label: 'Avg Loss Streak', value: avgConsecLosses ?? '--', color: '#FF453A' },
              { label: 'Recovery Rate', value: recoveryRate !== null ? `${recoveryRate}%` : '--', color: recoveryRate >= 50 ? '#30D158' : '#FF453A', tooltip: 'Win rate of the trade immediately after an SL' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '14px 16px', position: 'relative' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {stat.icon && <span>{stat.icon}</span>}{stat.label}
                  {stat.tooltip && (
                    <span title={stat.tooltip} style={{ cursor: 'default', opacity: 0.5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  )}
                </p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Pattern Analysis cards */}
          {(pctAfterLoss !== null || pctAfterWin !== null || pctAfterTwoLoss !== null) && (
            <div style={{ marginBottom: '22px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Pattern Analysis</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { label: 'After a Loss', pct: pctAfterLoss, n: afterLossWins.length, desc: 'win rate on the next trade after SL' },
                  { label: 'After a Win', pct: pctAfterWin, n: afterWinWins.length, desc: 'win rate on the next trade after TP' },
                  { label: 'After 2+ Losses', pct: pctAfterTwoLoss, n: afterTwoLossWins.length, desc: 'win rate after 2 consecutive SLs' },
                ].map(p => {
                  if (p.pct === null) return null
                  const good = p.pct >= 50
                  const color = good ? '#30D158' : '#FF453A'
                  const bg = good ? 'rgba(48,209,88,0.08)' : 'rgba(255,69,58,0.08)'
                  const border = good ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'
                  return (
                    <div key={p.label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>{p.label}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.desc}</p>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px', flexShrink: 0 }}>n={p.n}</span>
                      </div>
                      {/* Mini progress bar */}
                      <div style={{ height: '4px', borderRadius: '4px', background: 'var(--bg-secondary)', marginBottom: '8px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.pct}%`, borderRadius: '4px', background: color, transition: 'width 0.5s ease' }} />
                      </div>
                      <p style={{ fontSize: '24px', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{p.pct}%</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Streak Timeline */}
          {streakChartData.length >= 3 && (
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Streak Timeline</p>
              <div style={{ height: isMobile ? 100 : 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={streakChartData} barCategoryGap="20%">
                    <XAxis hide />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: d.type === 'win' ? '#30D158' : '#FF453A' }}>
                              {d.type === 'win' ? '🔥' : '❄️'} {d.length} {d.type === 'win' ? 'win' : 'loss'}{d.length > 1 ? 's' : ''} in a row
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={28}>
                      {streakChartData.map((d, i) => (
                        <Cell key={i} fill={d.type === 'win' ? '#30D158' : '#FF453A'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#30D158' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Win streak</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FF453A' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loss streak</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>Last {streakChartData.length} streaks</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance by Session */}
      {perfBySession.some(s => s.total > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
          {perfBySession.map(session => (
            <div key={session.name} style={{ ...cardStyle, padding: '20px', borderTop: `3px solid ${session.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: session.color }}>{session.name}</h2>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {String(session.start).padStart(2,'0')}:00 – {String(session.end).padStart(2,'0')}:00
                  </p>
                </div>
                <span style={{
                  fontSize: '12px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: `${session.color}20`,
                  color: session.color,
                  fontWeight: 600,
                }}>
                  {session.total} trades
                </span>
              </div>

              {session.total === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-subtle)', textAlign: 'center', padding: '16px 0' }}>No data</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Win rate bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Win Rate</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: session.winRate >= 50 ? '#4ade80' : '#f87171' }}>
                        {session.winRate !== null ? `${session.winRate}%` : '--'}
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${session.winRate ?? 0}%`,
                        borderRadius: '3px',
                        background: session.winRate >= 50 ? '#4ade80' : '#f87171',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { label: 'TP / SL', value: `${session.tp} / ${session.sl}`, color: 'var(--text)' },
                      { label: 'Avg R:R', value: session.avgRR ? `1:${session.avgRR}` : '--', color: 'var(--accent)' },
                      { label: 'Est. P&L', value: `${session.pnl >= 0 ? '+' : ''}${session.pnl.toFixed(1)}%${dollarStr(session.pnl)}`, color: session.pnl >= 0 ? '#4ade80' : '#f87171' },
                      { label: '% of All Trades', value: liveTrades.length ? `${Math.round(session.total / liveTrades.length * 100)}%` : '--', color: session.color },
                    ].map(stat => (
                      <div key={stat.label}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>{stat.label}</p>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: stat.color }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Performance by Pair */}
      {perfByPair.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>
            Performance by Pair
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Pair', 'Trades', 'Win Rate', 'Avg R:R', 'P&L'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: h === 'Pair' ? 'left' : 'right',
                      color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfByPair.map((p, i) => (
                  <tr key={p.pair} style={{ borderBottom: i < perfByPair.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{p.pair}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.total}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: p.winRate >= 60 ? '#0A84FF' : p.winRate >= 40 ? '#f59e0b' : '#f87171' }}>
                      {p.winRate !== null ? `${p.winRate}%` : '--'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text)' }}>
                      {p.avgRR !== null ? `1:${p.avgRR}` : '--'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: p.pnl >= 0 ? '#30D158' : '#FF453A' }}>
                      {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)}%{dollarStr(p.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance by Day */}
      {perfByDay.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '20px' }}>
            Performance by Day
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {perfByDay.map(day => {
              const barColor = day.winRate === null ? '#6b7280'
                : day.winRate >= 60 ? '#0A84FF'
                : day.winRate >= 40 ? '#f59e0b'
                : '#f87171'
              return (
                <div key={day.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Day name */}
                  <div style={{ width: '52px', flexShrink: 0, textAlign: 'end' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{day.nameEn}</span>
                  </div>
                  {/* Bar */}
                  <div style={{ flex: 1, height: '28px', background: 'var(--bg)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      width: `${day.winRate ?? 50}%`,
                      background: barColor,
                      opacity: 0.25,
                      borderRadius: '6px',
                      transition: 'width 0.5s ease',
                    }} />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      paddingInlineStart: '10px',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: barColor }}>
                        {day.winRate !== null ? `${day.winRate}%` : '--'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {day.total} trades · {day.tp} TP
                      </span>
                    </div>
                  </div>
                  {/* P&L */}
                  <div style={{ flexShrink: 0, textAlign: 'start' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: day.pnl >= 0 ? '#4ade80' : '#f87171' }}>
                      {day.pnl >= 0 ? '+' : ''}{day.pnl.toFixed(1)}%{dollarStr(day.pnl)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            {[{ label: '≥60% Win Rate', color: '#0A84FF' }, { label: '40–59%', color: '#f59e0b' }, { label: '<40%', color: '#f87171' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color, opacity: 0.8 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance by Month */}
      {monthlyStats.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Performance by Month</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Estimated P&L per month</p>
            </div>
            {(() => {
              const best = [...monthlyStats].sort((a,b) => b.pnl - a.pnl)[0]
              return best ? (
                <div style={{ textAlign: 'end' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Best Month</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>
                    {MONTHS_SHORT[best.month - 1]} {best.year}
                  </p>
                  <p style={{ fontSize: '11px', color: '#4ade80' }}>+{best.pnl.toFixed(1)}%{dollarStr(best.pnl)}</p>
                </div>
              ) : null
            })()}
          </div>

          {/* Month grid per year */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
              <thead>
                <tr>
                  <th style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, padding: '0 6px 8px', textAlign: 'start', width: '44px' }} />
                  {MONTHS_SHORT.map(m => (
                    <th key={m} style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, padding: '0 2px 8px', textAlign: 'center', minWidth: '48px' }}>
                      {m}
                    </th>
                  ))}
                  <th style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, padding: '0 6px 8px', textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {years.map(year => {
                  const yearTotal = monthlyStats
                    .filter(m => m.year === year)
                    .reduce((s, m) => s + m.pnl, 0)
                  return (
                    <tr key={year}>
                      <td style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', padding: '2px 6px' }}>{year}</td>
                      {MONTHS_SHORT.map((_, mi) => {
                        const month = mi + 1
                        const stat = monthlyStats.find(m => m.year === year && m.month === month)
                        if (!stat) return (
                          <td key={mi} style={{ padding: '2px' }}>
                            <div style={{ height: '44px', borderRadius: '6px', background: 'var(--bg)' }} />
                          </td>
                        )
                        const intensity = Math.min(Math.abs(stat.pnl) / 5, 1) // max opacity at 5%
                        const bg = stat.pnl > 0
                          ? `rgba(10,132,255,${0.1 + intensity * 0.5})`
                          : stat.pnl < 0
                          ? `rgba(248,113,113,${0.1 + intensity * 0.5})`
                          : 'var(--bg)'
                        return (
                          <td key={mi} style={{ padding: '2px' }}>
                            <div
                              title={`${MONTHS_SHORT[mi]} ${year}: ${stat.total} trades, Win ${stat.winRate ?? '--'}%, P&L ${stat.pnl >= 0 ? '+' : ''}${stat.pnl}%`}
                              style={{
                                height: '44px',
                                borderRadius: '6px',
                                background: bg,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'default',
                                gap: '1px',
                              }}
                            >
                              <span style={{ fontSize: '11px', fontWeight: 700, color: stat.pnl >= 0 ? '#0A84FF' : '#f87171', lineHeight: 1 }}>
                                {stat.pnl >= 0 ? '+' : ''}{stat.pnl.toFixed(1)}%{dollarStr(stat.pnl)}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1 }}>{stat.total} ✦</span>
                            </div>
                          </td>
                        )
                      })}
                      <td style={{ padding: '2px' }}>
                        <div style={{
                          height: '44px',
                          borderRadius: '6px',
                          background: yearTotal >= 0 ? 'rgba(10,132,255,0.15)' : 'rgba(248,113,113,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '52px',
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: yearTotal >= 0 ? '#0A84FF' : '#f87171' }}>
                            {yearTotal >= 0 ? '+' : ''}{yearTotal.toFixed(1)}%{dollarStr(yearTotal)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '12px' }}>
            Color intensity represents P&L size · ✦ = number of trades · Hover for details
          </p>
        </div>
      )}

      {/* Performance by Hour */}
      {perfByHour.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Performance by Hour</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {hourView === 'winRate' ? 'Which hour do you trade best?' : hourView === 'volume' ? 'When do you enter trades?' : 'When do you exit trades?'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hourView === 'winRate' && (() => {
                const best = perfByHour.filter(h => h.winRate !== null).sort((a, b) => b.winRate - a.winRate)[0]
                return best ? (
                  <div style={{ textAlign: 'end', marginRight: '8px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Best Hour</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#4ade80' }}>{best.label}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{best.winRate}% win rate</p>
                  </div>
                ) : null
              })()}
              {hourView === 'volume' && (() => {
                const peak = [...perfByHour].sort((a, b) => b.total - a.total)[0]
                return peak ? (
                  <div style={{ textAlign: 'end', marginRight: '8px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Peak Entry</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#60a5fa' }}>{peak.label}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{peak.total} trades</p>
                  </div>
                ) : null
              })()}
              {hourView === 'exit' && (() => {
                const peak = [...exitByHour].sort((a, b) => b.total - a.total)[0]
                return peak ? (
                  <div style={{ textAlign: 'end', marginRight: '8px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Peak Exit</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#a78bfa' }}>{peak.label}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{peak.total} trades</p>
                  </div>
                ) : null
              })()}
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '20px', padding: '3px', gap: '2px' }}>
                {[{ key: 'winRate', label: 'Win Rate' }, { key: 'volume', label: 'Entry' }, { key: 'exit', label: 'Exit' }].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setHourView(opt.key)}
                    style={{
                      padding: '4px 12px', fontSize: '12px', fontWeight: hourView === opt.key ? 600 : 400,
                      borderRadius: '16px', border: 'none', cursor: 'pointer',
                      background: hourView === opt.key ? 'var(--card)' : 'transparent',
                      color: hourView === opt.key ? 'var(--text)' : 'var(--text-muted)',
                      boxShadow: hourView === opt.key ? 'var(--shadow)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={hourView === 'exit' ? exitByHour : perfByHour}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => hourView === 'winRate' ? `${v}%` : v}
                domain={hourView === 'winRate' ? [0, 100] : [0, 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>{d.label}</p>
                      {hourView === 'exit' ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.total} exits</p>
                      ) : (
                        <>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.total} trades · {d.tp} TP · {d.sl} SL</p>
                          {hourView === 'winRate' && (
                            <p style={{ fontSize: '13px', fontWeight: 700, color: d.winRate >= 50 ? '#0A84FF' : '#f87171', marginTop: '4px' }}>
                              {d.winRate !== null ? `${d.winRate}% win rate` : '--'}
                            </p>
                          )}
                          <p style={{ fontSize: '12px', color: d.pnl >= 0 ? '#30D158' : '#f87171', marginTop: '2px' }}>
                            {d.pnl >= 0 ? '+' : ''}{d.pnl}% P&L{dollarStr(d.pnl)}
                          </p>
                        </>
                      )}
                    </div>
                  )
                }}
                cursor={{ fill: 'rgba(128,128,128,0.06)' }}
              />
              {hourView === 'winRate' ? (
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {perfByHour.map((h, i) => (
                    <Cell
                      key={i}
                      fill={h.winRate === null ? '#6b7280'
                        : h.winRate >= 60 ? '#0A84FF'
                        : h.winRate >= 40 ? '#f59e0b'
                        : '#f87171'}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              ) : hourView === 'volume' ? (
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {perfByHour.map((h, i) => (
                    <Cell key={i} fill="#60a5fa" opacity={0.7 + (h.total / Math.max(...perfByHour.map(x => x.total))) * 0.3} />
                  ))}
                </Bar>
              ) : (
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {exitByHour.map((h, i) => (
                    <Cell key={i} fill="#a78bfa" opacity={0.7 + (h.total / Math.max(...exitByHour.map(x => x.total), 1)) * 0.3} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
          {/* Session overlays legend */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '3px', background: '#60a5fa', borderRadius: '2px' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>London 10:00–14:00</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '3px', background: '#f59e0b', borderRadius: '2px' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>New York 15:00–19:00</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Performance by Holding Time ── */}
      {perfByHoldTime.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Performance by Holding Time</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Only trades with entry and exit time recorded</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {perfByHoldTime.map(bucket => (
              <div key={bucket.label} style={{ background: 'var(--bg)', borderRadius: '12px', padding: '16px', borderTop: `3px solid ${bucket.color}` }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: bucket.color, marginBottom: '12px' }}>{bucket.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Trades', value: bucket.total.toString(), color: 'var(--text)' },
                    { label: 'Win Rate', value: bucket.winRate !== null ? `${bucket.winRate}%` : '--', color: bucket.winRate >= 50 ? '#30D158' : '#FF453A' },
                    { label: 'Avg R:R', value: bucket.avgRR ? `1:${bucket.avgRR}` : '--', color: 'var(--text)' },
                    { label: 'P&L', value: `${bucket.pnl >= 0 ? '+' : ''}${bucket.pnl.toFixed(2)}%${dollarStr(bucket.pnl)}`, color: bucket.pnl >= 0 ? '#30D158' : '#FF453A' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {/* Win rate bar */}
                {bucket.winRate !== null && (
                  <div style={{ marginTop: '10px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${bucket.winRate}%`, background: bucket.color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}
        className="lg:grid-cols-3-custom">
        <style>{`@media (min-width: 1024px) { .outcome-grid { display: grid !important; grid-template-columns: 2fr 1fr; gap: 16px; } }`}</style>
        <div className="outcome-grid" style={{ display: 'contents' }}>
          {/* Outcome breakdown */}
          <div style={{ ...cardStyle, padding: '18px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>
              {t.outcomeBreakdown}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {outcomeBreakdown.map(o => {
                const pct = totalOutcome > 0 ? (o.count / totalOutcome) * 100 : 0
                return (
                  <div key={o.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{o.label}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {o.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg)' }}>
                      <div style={{
                        height: '6px',
                        borderRadius: '3px',
                        background: o.color,
                        width: `${pct}%`,
                        opacity: 0.75,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Long vs Short */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ ...cardStyle, padding: '18px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Long</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#4ade80' }}>{longCount}</p>
            </div>
            <div style={{ ...cardStyle, padding: '18px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Short</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#f87171' }}>{shortCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mood & Discipline Analytics */}
      {(moodStats.length > 0 || violationTrades.length > 0 || cleanTrades.length > 0) && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Mood & Discipline</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>How your mindset and discipline affect your results</p>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>

            {/* Mood performance */}
            {moodStats.length > 0 && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>Performance by mood</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {moodStats.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0)).map(m => (
                    <div key={m.mood} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px', width: '24px' }}>{m.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text)' }}>{m.label}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.total} trades · {m.pnl >= 0 ? '+' : ''}{m.pnl}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${m.winRate ?? 0}%`, background: (m.winRate ?? 0) >= 50 ? '#30D158' : '#FF453A', borderRadius: '3px', transition: 'width 0.4s' }} />
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.winRate !== null ? `${m.winRate}% win rate` : '--'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rule violation */}
            {(violationTrades.length > 0 || cleanTrades.length > 0) && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>Plan discipline</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: '✅ Followed the plan', wr: cleanWR, pnl: cleanPnl, total: cleanTrades.length, color: '#30D158' },
                    { label: '❌ Broke the rules', wr: violationWR, pnl: violationPnl, total: violationTrades.length, color: '#FF453A' },
                  ].filter(r => r.total > 0).map(r => (
                    <div key={r.label} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text)' }}>{r.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: r.pnl >= 0 ? '#30D158' : '#FF453A' }}>{r.pnl >= 0 ? '+' : ''}{r.pnl}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.total} trades</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: r.color }}>{r.wr !== null ? `${r.wr}% WR` : '--'}</span>
                      </div>
                    </div>
                  ))}
                  {violationTrades.length > 0 && cleanWR !== null && violationWR !== null && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {cleanWR > violationWR
                        ? `Following your plan gives you ${cleanWR - violationWR}% higher win rate`
                        : `Interesting — rule violations haven't hurt win rate yet`}
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Recent trades */}
      <div style={cardStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{t.recentTrades}</h2>
          <Link to="/journal" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>
            {t.viewAll} →
          </Link>
        </div>
        {recent5.length === 0 ? (
          <p style={{ fontSize: '13px', textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            {t.noTrades}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t.date, t.pair, t.direction, t.rr, 'P&L', t.outcome].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px',
                      textAlign: 'start',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent5.map(trade => {
                  const badge = getOutcomeBadge(trade.outcome)
                  return (
                    <tr
                      key={trade.id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 16px', fontSize: '13px', color: 'var(--text)' }}>{formatDate(trade.date)}</td>
                      <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{trade.pair}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontWeight: 500,
                          background: trade.direction === 'Long' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                          color: trade.direction === 'Long' ? '#4ade80' : '#f87171',
                        }}>
                          {trade.direction}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '13px', color: 'var(--text)' }}>
                        {trade.rr_potential ? `1:${trade.rr_potential}` : '--'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 600 }}>
                        {(() => {
                          const pnl = computePnL(trade)
                          if (pnl === 0 && trade.outcome === 'Open') return <span style={{ color: 'var(--text-muted)' }}>--</span>
                          const color = pnl > 0 ? '#30D158' : pnl < 0 ? '#FF453A' : 'var(--text-muted)'
                          return <span style={{ color }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%{dollarStr(pnl)}</span>
                        })()}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontWeight: 500,
                          background: badge.bg,
                          color: badge.color,
                        }}>
                          {trade.outcome}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trading Insights */}
      {insights.length > 0 && (
        <div style={{ ...cardStyle, padding: '22px', marginBottom: '20px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px', letterSpacing: '-0.01em' }}>Your Trading Insights</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Auto-generated from your trading data — no AI, pure math</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(10,132,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <span style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1.3 }}>{ins.icon}</span>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.65, margin: 0 }}
                  dangerouslySetInnerHTML={{ __html: ins.text.replace(/<b>(.*?)<\/b>/g, '<span style="color:#0A84FF;font-weight:700">$1</span>') }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claude Chat Widget */}
      {createPortal(<div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
        {claudeOpen && (
          <div style={{
            position: 'absolute', bottom: '64px', left: 0,
            width: '340px', maxHeight: '480px',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ask about your trades</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Powered by Claude AI</p>
              </div>
              <button onClick={() => setClaudeOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px' }}>
              {claudeHistory.length === 0 && (
                <div style={{ padding: '8px 0' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Try asking:</p>
                  {['What is my win rate?', 'Which pair is most profitable?', 'What is my best trading day?'].map(s => (
                    <button key={s} onClick={() => setClaudeQuestion(s)} style={{
                      display: 'block', width: '100%', textAlign: 'left', marginBottom: '6px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '7px 10px', fontSize: '11px',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}>{s}</button>
                  ))}
                </div>
              )}
              {claudeHistory.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '8px 11px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? '#0A84FF' : 'var(--bg-secondary)',
                    fontSize: '12px', lineHeight: 1.5,
                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                    whiteSpace: 'pre-wrap',
                  }}>{msg.text}</div>
                </div>
              ))}
              {claudeLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px 12px 12px 2px', padding: '8px 14px', fontSize: '18px', color: 'var(--text-muted)' }}>···</div>
                </div>
              )}
              <div ref={claudeBottomRef} />
            </div>
            <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
              <input
                value={claudeQuestion}
                onChange={e => setClaudeQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askClaude()}
                placeholder="Ask a question..."
                style={{
                  flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '8px 10px', fontSize: '12px',
                  color: 'var(--text)', outline: 'none',
                }}
              />
              <button onClick={askClaude} disabled={claudeLoading || !claudeQuestion.trim()} style={{
                background: '#0A84FF', border: 'none', borderRadius: '8px',
                padding: '8px 14px', cursor: 'pointer', fontSize: '16px', color: '#fff',
                opacity: claudeLoading || !claudeQuestion.trim() ? 0.5 : 1,
              }}>↑</button>
            </div>
          </div>
        )}
        <button onClick={() => setClaudeOpen(o => !o)} style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: claudeOpen ? 'var(--card)' : '#0A84FF',
          border: claudeOpen ? '1px solid var(--border)' : 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          cursor: 'pointer', fontSize: '22px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: claudeOpen ? 'var(--text-muted)' : '#fff',
          transition: 'all 0.2s',
        }}>
          {claudeOpen ? '×' : '✦'}
        </button>
      </div>, document.body)}
      </> }
    </div>
    </>
  )
}
