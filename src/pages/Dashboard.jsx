import { useState, useEffect, useRef } from 'react'
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

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '2px' }}>{payload[0].payload.label}</p>
        <p style={{ color: val >= 0 ? '#4ade80' : '#f87171', fontWeight: 600, fontSize: '14px' }}>
          {val >= 0 ? '+' : ''}{val.toFixed(2)}%
        </p>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [dateFilter, setDateFilter] = useState({ type: 'all', from: '', to: '' })
  const [showMissed, setShowMissed] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [hourView, setHourView] = useState('winRate') // 'winRate' | 'volume'
  const [dashTab, setDashTab] = useState('overview') // 'overview' | 'confirmations'
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
    if (type === 'year') return tr.date.startsWith(String(new Date().getFullYear()))
    if (type === 'custom') {
      if (from && tr.date < from) return false
      if (to && tr.date > to) return false
      return true
    }
    return true
  }

  const allLiveTrades = trades.filter(t => (t.trade_type || 'live') === 'live')
  const allMissedTrades = trades.filter(t => t.trade_type === 'missed')

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

  const now = new Date()
  const monthTrades = liveTrades.filter(t => {
    const d = new Date(t.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
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

  const grossProfit = tpTrades.reduce((s, tr) => s + computePnL(tr), 0)
  const grossLoss = slTrades.reduce((s, tr) => s + Math.abs(computePnL(tr)), 0)
  const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : null

  // ── Confirmation Analysis ──
  const confTrades = liveTrades.filter(tr =>
    ['TP', 'Partial TP', 'SL', 'BE'].includes(tr.outcome) &&
    Array.isArray(tr.confirmations) && tr.confirmations.length > 0
  )
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

  // Combinations (2-conf pairs)
  const comboMap = {}
  confTrades.forEach(tr => {
    const confs = [...tr.confirmations].sort()
    const pnl = computePnL(tr)
    const isWin = tr.outcome === 'TP' || tr.outcome === 'Partial TP'
    for (let i = 0; i < confs.length; i++) {
      for (let j = i + 1; j < confs.length; j++) {
        const key = `${confs[i]} + ${confs[j]}`
        if (!comboMap[key]) comboMap[key] = { combo: key, trades: 0, wins: 0, pnl: 0 }
        comboMap[key].trades++
        if (isWin) comboMap[key].wins++
        comboMap[key].pnl += pnl
      }
    }
  })
  const comboStats = Object.values(comboMap)
    .filter(c => c.trades >= 2)
    .map(c => ({ ...c, winRate: Math.round(c.wins / c.trades * 100), pnl: parseFloat(c.pnl.toFixed(2)) }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 15)

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
        ? `${monthlyPnL >= 0 ? '+' : ''}${monthlyPnL.toFixed(2)}%`
        : '--',
      sub: `${monthTrades.length} trades this month`,
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

  return (
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
          { key: 'year', label: 'This Year' },
        ].map(btn => (
          <button
            key={btn.key}
            onClick={() => { setDateFilter({ type: btn.key, from: '', to: '' }); setCustomOpen(false) }}
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
      </div>

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
              {/* Bar chart — top confirmations by P&L */}
              <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Confirmations by P&L</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Which confirmations generate the most profit</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={confStats.slice(0, 12)} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
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
                      {confStats.slice(0, 12).map((c, i) => (
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
                      {confStats.map((c, i) => (
                        <tr key={c.name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{c.name}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right' }}>{c.trades}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: c.winRate >= 60 ? '#4ade80' : c.winRate >= 45 ? '#f59e0b' : '#f87171' }}>{c.winRate}%</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)', textAlign: 'right' }}>1:{c.avgRR || '--'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: c.pnl >= 0 ? '#4ade80' : '#f87171' }}>{c.pnl >= 0 ? '+' : ''}{c.pnl}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Combinations table */}
              {comboStats.length > 0 && (
                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>Best Combinations</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pairs of confirmations that appear together (min. 2 trades)</p>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Combination', 'Trades', 'Win Rate', 'Total P&L'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textAlign: h === 'Combination' ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comboStats.map((c, i) => (
                          <tr key={c.combo} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)' }}>
                            <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                              {c.combo.split(' + ').map((tag, idx) => (
                                <span key={idx}>
                                  <span style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>{tag}</span>
                                  {idx < c.combo.split(' + ').length - 1 && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>+</span>}
                                </span>
                              ))}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right' }}>{c.trades}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: c.winRate >= 60 ? '#4ade80' : c.winRate >= 45 ? '#f59e0b' : '#f87171' }}>{c.winRate}%</span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: c.pnl >= 0 ? '#4ade80' : '#f87171' }}>{c.pnl >= 0 ? '+' : ''}{c.pnl}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px' }}
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
                <p style={{ fontSize: '20px', fontWeight: 700, color: equityPositive ? '#4ade80' : '#f87171' }}>
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
                      <p style={{ fontSize: '15px', fontWeight: 700, color: d.value >= 0 ? '#4ade80' : '#f87171' }}>
                        {d.value >= 0 ? '+' : ''}{d.value}%
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#30D158' : '#FF453A'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

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
                      { label: 'Est. P&L', value: `${session.pnl >= 0 ? '+' : ''}${session.pnl.toFixed(1)}%`, color: session.pnl >= 0 ? '#4ade80' : '#f87171' },
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

      {/* Performance by Day */}
      {perfByDay.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '20px' }}>
            Performance by Day
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {perfByDay.map(day => {
              const barColor = day.winRate === null ? '#6b7280'
                : day.winRate >= 60 ? '#4ade80'
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
                  <div style={{ width: '58px', flexShrink: 0, textAlign: 'start' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: day.pnl >= 0 ? '#4ade80' : '#f87171' }}>
                      {day.pnl >= 0 ? '+' : ''}{day.pnl.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            {[{ label: '≥60% Win Rate', color: '#4ade80' }, { label: '40–59%', color: '#f59e0b' }, { label: '<40%', color: '#f87171' }].map(l => (
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
                  <p style={{ fontSize: '11px', color: '#4ade80' }}>+{best.pnl.toFixed(1)}%</p>
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
                          ? `rgba(74,222,128,${0.1 + intensity * 0.5})`
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
                              <span style={{ fontSize: '11px', fontWeight: 700, color: stat.pnl >= 0 ? '#4ade80' : '#f87171', lineHeight: 1 }}>
                                {stat.pnl >= 0 ? '+' : ''}{stat.pnl.toFixed(1)}%
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
                          background: yearTotal >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '52px',
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: yearTotal >= 0 ? '#4ade80' : '#f87171' }}>
                            {yearTotal >= 0 ? '+' : ''}{yearTotal.toFixed(1)}%
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
                            <p style={{ fontSize: '13px', fontWeight: 700, color: d.winRate >= 50 ? '#4ade80' : '#f87171', marginTop: '4px' }}>
                              {d.winRate !== null ? `${d.winRate}% win rate` : '--'}
                            </p>
                          )}
                          <p style={{ fontSize: '12px', color: d.pnl >= 0 ? '#4ade80' : '#f87171', marginTop: '2px' }}>
                            {d.pnl >= 0 ? '+' : ''}{d.pnl}% P&L
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
                        : h.winRate >= 60 ? '#4ade80'
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
                  {[t.date, t.pair, t.direction, t.rr, t.outcome].map(h => (
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
      </> }
    </div>
  )
}
