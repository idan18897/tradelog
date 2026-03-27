import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

const DEFAULT_PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'USDCHF', 'AUDUSD', 'NAS100', 'US30', 'USOIL']
const OUTCOMES = ['TP', 'Partial TP', 'SL', 'BE', 'Invalid', 'Open']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function MiniStars({ value }) {
  if (!value) return <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>--</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const full = value >= n
        const half = !full && value >= n - 0.5
        return (
          <svg key={n} width="12" height="12" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            {(full || half) && (
              <defs>
                <clipPath id={`msc-${n}-${value}`}>
                  <rect x="0" y="0" width={half ? '12' : '24'} height="24" />
                </clipPath>
              </defs>
            )}
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              fill="none" stroke="var(--border-strong)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {(full || half) && (
              <polygon
                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill="#facc15" stroke="#facc15" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
                clipPath={half ? `url(#msc-${n}-${value})` : undefined}
              />
            )}
          </svg>
        )
      })}
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '3px' }}>{value}</span>
    </div>
  )
}

function Lightbox({ src, label, onClose }) {
  const [zoom, setZoom] = useState(1)

  const handleKey = useCallback(e => {
    if (e.key === 'Escape') onClose()
    if (e.key === '+' || e.key === '=') setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))
    if (e.key === '-') setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function handleWheel(e) {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.12 : -0.12
    setZoom(z => Math.min(5, Math.max(0.25, +(z + delta).toFixed(2))))
  }

  const toolBtn = {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    padding: '5px 14px',
    borderRadius: '7px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: 1,
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(0,0,0,0.7)', zIndex: 1001 }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={toolBtn} onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))}>+</button>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', minWidth: '46px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button style={toolBtn} onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}>−</button>
          <button style={{ ...toolBtn, color: 'rgba(255,255,255,0.5)', fontSize: '13px' }} onClick={() => setZoom(1)}>Reset</button>
          <button style={{ ...toolBtn, color: '#f87171', borderColor: 'rgba(248,113,113,0.4)', fontSize: '13px' }} onClick={onClose}>✕ Close</button>
        </div>
      </div>

      {/* Image container */}
      <div
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: '92vw', height: '82vh' }}
      >
        <img
          src={src}
          alt={label}
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
            transition: 'transform 0.1s',
            borderRadius: zoom <= 1 ? '10px' : '0',
            userSelect: 'none',
          }}
        />
      </div>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '16px' }}>
        Scroll to zoom · ESC to close · Click outside to close
      </p>
    </div>
  )
}

function DetailField({ label, value, children }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</p>
      {children || <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{value || '--'}</p>}
    </div>
  )
}

const CAL_DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function calPnL(tr) {
  if (tr.outcome === 'TP') return (tr.rr_potential || 0) * (tr.risk_pct || 0.5)
  if (tr.outcome === 'Partial TP') return (tr.rr_potential || 0) * (tr.risk_pct || 0.5) * 0.5
  if (tr.outcome === 'SL') return -(tr.risk_pct || 0.5)
  return 0
}

// secondaryTrades = missed trades shown in amber overlay (optional)
function TradeCalendar({ trades, secondaryTrades, calMonth, onMonthChange, filterDay, onDayClick }) {
  const [year, month] = calMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1 // Mon = 0

  const dayStats = {}
  trades.forEach(tr => {
    if (!tr.date || tr.date.slice(0, 7) !== calMonth) return
    if (!dayStats[tr.date]) dayStats[tr.date] = { count: 0, pnl: 0 }
    dayStats[tr.date].count++
    dayStats[tr.date].pnl += calPnL(tr)
  })

  const missedStats = {}
  if (secondaryTrades) {
    secondaryTrades.forEach(tr => {
      if (!tr.date || tr.date.slice(0, 7) !== calMonth) return
      if (!missedStats[tr.date]) missedStats[tr.date] = { count: 0, potPnL: 0 }
      missedStats[tr.date].count++
      const fullRR = Number(tr.pot_rr) || Number(tr.rr_potential) || 0
      const risk = Number(tr.risk_pct) || 0.5
      let potGain = 0
      if (fullRR > 0) {
        if (tr.sl_to_be && tr.exit_levels?.length) {
          let rem = 100
          for (const lv of tr.exit_levels) { potGain += (lv.pct / 100) * lv.rr * risk; rem -= lv.pct }
          potGain += (rem / 100) * fullRR * risk
        } else {
          potGain = fullRR * risk
        }
      }
      missedStats[tr.date].potPnL += potGain
    })
  }

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1)
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(year, month, 1)
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthPnL = Object.values(dayStats).reduce((s, d) => s + d.pnl, 0)
  const tradingDays = Object.keys(dayStats).length
  const winDays = Object.values(dayStats).filter(d => d.pnl > 0).length
  const missedDaysCount = Object.keys(missedStats).length

  // Winning / Losing trade counts for this month
  const winCount = trades.filter(tr =>
    tr.date?.slice(0, 7) === calMonth && (tr.outcome === 'TP' || tr.outcome === 'Partial TP')
  ).length
  const lossCount = trades.filter(tr =>
    tr.date?.slice(0, 7) === calMonth && tr.outcome === 'SL'
  ).length

  // Group cells into weeks of 7
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const navBtn = {
    background: 'var(--bg)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: '7px', width: '32px', height: '32px',
    cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button style={navBtn} onClick={prevMonth}>‹</button>
        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', minWidth: '170px', textAlign: 'center' }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button style={navBtn} onClick={nextMonth}>›</button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {tradingDays > 0 && <>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>Trading Days</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{tradingDays}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>Win Days</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>{winDays}/{tradingDays}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#4ade80', marginBottom: '1px' }}>Winning Trades</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>{winCount}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#f87171', marginBottom: '1px' }}>Losing Trades</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>{lossCount}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>Month P&L</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: monthPnL >= 0 ? '#4ade80' : '#f87171' }}>
                {monthPnL >= 0 ? '+' : ''}{monthPnL.toFixed(2)}%
              </p>
            </div>
          </>}
          {secondaryTrades && missedDaysCount > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#f59e0b', marginBottom: '1px' }}>Missed Days</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>{missedDaysCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(74,222,128,0.4)', display: 'inline-block', border: '1px solid rgba(74,222,128,0.5)' }} />
          Win
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(248,113,113,0.4)', display: 'inline-block', border: '1px solid rgba(248,113,113,0.5)' }} />
          Loss
        </div>
        {secondaryTrades && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(245,158,11,0.3)', display: 'inline-block', border: '1px solid rgba(245,158,11,0.5)' }} />
            Missed
          </div>
        )}
      </div>

      {/* Day headers + Week column header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 72px', gap: '4px', marginBottom: '4px' }}>
        {CAL_DAY_HEADERS.map(h => (
          <div key={h} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', padding: '4px 0' }}>
            {h}
          </div>
        ))}
        <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', padding: '4px 0' }}>
          Week
        </div>
      </div>

      {/* Week rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {weeks.map((weekCells, wi) => {
          // Compute weekly P&L
          let weekPnL = 0
          let weekHasTrades = false
          weekCells.forEach(day => {
            if (!day) return
            const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            if (dayStats[ds]) { weekPnL += dayStats[ds].pnl; weekHasTrades = true }
          })

          return (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 72px', gap: '4px' }}>
              {weekCells.map((day, ci) => {
                if (day === null) return <div key={`e-${wi}-${ci}`} style={{ minHeight: '72px' }} />
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const stats = dayStats[dateStr]
                const missed = missedStats[dateStr]
                const isSelected = filterDay === dateStr
                const pnl = stats?.pnl ?? 0
                const hasTrades = !!stats
                const hasMissed = !!missed
                const hasAny = hasTrades || hasMissed
                let bg = 'transparent'
                let borderCol = 'var(--border)'
                if (hasTrades && hasMissed) {
                  bg = pnl >= 0 ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'
                  borderCol = isSelected ? 'var(--accent)' : 'rgba(245,158,11,0.6)'
                } else if (hasTrades) {
                  bg = pnl >= 0 ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'
                  borderCol = isSelected ? 'var(--accent)' : pnl >= 0 ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'
                } else if (hasMissed) {
                  bg = 'rgba(245,158,11,0.12)'
                  borderCol = isSelected ? 'var(--accent)' : 'rgba(245,158,11,0.35)'
                }

                return (
                  <div
                    key={dateStr}
                    onClick={() => hasAny && onDayClick(dateStr)}
                    style={{
                      minHeight: '72px',
                      borderRadius: '8px',
                      padding: '7px 8px',
                      background: bg,
                      border: isSelected ? `2px solid var(--accent)` : `1px solid ${borderCol}`,
                      cursor: hasAny ? 'pointer' : 'default',
                      transition: 'border-color 0.12s, background 0.12s',
                    }}
                    onMouseEnter={e => { if (hasAny && !isSelected) e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { if (hasAny && !isSelected) e.currentTarget.style.borderColor = borderCol }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {hasTrades && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                            {stats.count} trade{stats.count !== 1 ? 's' : ''}
                          </span>
                        )}
                        {hasMissed && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', lineHeight: 1.2 }}>
                            {missed.count} missed
                          </span>
                        )}
                        {hasMissed && missed.potPnL > 0 && (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', lineHeight: 1.2 }}>
                            +{missed.potPnL.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: hasAny ? 'var(--text)' : 'var(--text-subtle)' }}>
                        {day}
                      </span>
                    </div>
                    {hasTrades && (
                      <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 700, color: pnl >= 0 ? '#4ade80' : '#f87171' }}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Weekly summary cell */}
              <div style={{
                minHeight: '72px',
                borderRadius: '8px',
                border: weekHasTrades
                  ? `1px solid ${weekPnL >= 0 ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}`
                  : '1px solid transparent',
                background: weekHasTrades
                  ? weekPnL >= 0 ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'
                  : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px 4px',
              }}>
                {weekHasTrades && (
                  <>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weekly</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: weekPnL >= 0 ? '#4ade80' : '#f87171', textAlign: 'center' }}>
                      {weekPnL >= 0 ? '+' : ''}{weekPnL.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Journal() {
  const { user } = useAuth()
  const { t } = useLang()
  const [trades, setTrades] = useState([])
  const [pairsList, setPairsList] = useState(DEFAULT_PAIRS)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [filterPair, setFilterPair] = useState('All')
  const [filterOutcome, setFilterOutcome] = useState('All')
  const [filterDirection, setFilterDirection] = useState('All')
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('journal_tab') || 'live')
  const [lightbox, setLightbox] = useState(null) // { src, label }
  const [filterMonth, setFilterMonth] = useState('All')
  const [filterDay, setFilterDay] = useState(null)
  const [calMonth, setCalMonth] = useState(() => {
    const saved = localStorage.getItem('journal_calMonth')
    if (saved) return saved
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    fetchTrades()
    fetchUserSettings()
  }, [])

  async function fetchUserSettings() {
    const { data } = await supabase
      .from('user_settings').select('pairs').eq('user_id', user.id).maybeSingle()
    if (data?.pairs?.length) setPairsList(data.pairs)
  }

  useEffect(() => {
    if (!loading) setTimeout(() => setVisible(true), 10)
  }, [loading])

  async function fetchTrades() {
    setLoading(true)
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
    if (!error) setTrades(data || [])
    setLoading(false)
  }

  async function deleteTrade(id) {
    if (!window.confirm(t.deleteConfirm)) return
    const { error } = await supabase.from('trades').delete().eq('id', id)
    if (!error) {
      if (selectedTrade?.id === id) setSelectedTrade(null)
      fetchTrades()
    }
  }

  // All live trades (existing behavior)
  const liveTrades = trades.filter(t => (t.trade_type || 'live') === 'live')

  // BackTesting = live TP trades + missed trades
  const liveTPTrades = liveTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP')
  const missedTrades = trades.filter(t => t.trade_type === 'missed')
  const backtestTrades = [...liveTPTrades, ...missedTrades].sort((a, b) =>
    new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'))
  )

  // Comparison stats
  const computePnL = t => {
    if (t.outcome === 'TP') return (t.rr_potential || 0) * (t.risk_pct || 0.5)
    if (t.outcome === 'Partial TP') return (t.rr_potential || 0) * (t.risk_pct || 0.5) * 0.5
    if (t.outcome === 'SL') return -(t.risk_pct || 0.5)
    return 0
  }
  const liveClosed = liveTrades.filter(t => ['TP', 'Partial TP', 'SL', 'BE'].includes(t.outcome))
  const liveWinRate = liveClosed.length ? Math.round(liveTPTrades.length / liveClosed.length * 100) : 0
  const liveAvgRR = liveTPTrades.length ? (liveTPTrades.reduce((s, t) => s + (t.rr_potential || 0), 0) / liveTPTrades.length).toFixed(1) : '0'
  const liveTotalPnL = liveTrades.reduce((s, t) => s + computePnL(t), 0)

  const btAvgRR = backtestTrades.length ? (backtestTrades.reduce((s, t) => s + (t.rr_potential || 0), 0) / backtestTrades.length).toFixed(1) : '0'
  const btTotalPnL = backtestTrades.reduce((s, t) => s + (t.rr_potential || 0) * (t.risk_pct || 0.5), 0)
  const captureRate = backtestTrades.length ? Math.round(liveTPTrades.length / backtestTrades.length * 100) : 0
  const missedCount = missedTrades.length

  // Combined = all live + all missed (full picture)
  const combinedTrades = [...liveTrades, ...missedTrades].sort((a, b) =>
    new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'))
  )

  // Apply filters to the active tab
  const activeList = activeTab === 'live' ? liveTrades : activeTab === 'backtest' ? backtestTrades : combinedTrades
  const filtered = activeList.filter(tr => {
    if (filterDay && tr.date !== filterDay) return false
    else if (!filterDay && filterMonth !== 'All' && tr.date?.slice(0, 7) !== filterMonth) return false
    if (filterPair !== 'All' && tr.pair !== filterPair) return false
    if (filterOutcome !== 'All' && tr.outcome !== filterOutcome) return false
    if (filterDirection !== 'All' && tr.direction !== filterDirection) return false
    return true
  })

  function handleDayClick(dateStr) {
    if (filterDay === dateStr) {
      setFilterDay(null)
    } else {
      setFilterDay(dateStr)
      setFilterMonth(dateStr.slice(0, 7))
      setCalMonth(dateStr.slice(0, 7))
    }
  }

  function handleCalMonthChange(ym) {
    setCalMonth(ym)
    localStorage.setItem('journal_calMonth', ym)
    setFilterDay(null)
    setFilterMonth(ym)
  }


  const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    boxShadow: 'var(--shadow-md)',
  }

  const headers = activeTab === 'backtest'
    ? [t.date, t.time, 'Type', t.pair, t.direction, t.entry, 'Pot. R:R', t.outcome, t.tradeRating || 'Rating', t.actions]
    : activeTab === 'combined'
      ? [t.date, t.time, 'Type', t.pair, t.direction, t.entry, t.slPips, 'Pot. R:R', t.risk, t.outcome, t.tradeRating || 'Rating', t.confirmations, t.actions]
      : [t.date, t.time, t.pair, t.direction, t.entry, t.slPips, 'Pot. R:R', t.risk, t.outcome, t.tradeRating || 'Rating', t.confirmations, t.screenshot, t.actions]

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
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {[
          { key: 'live', label: '● Live' },
          { key: 'backtest', label: '◎ Opportunity Log' },
          { key: 'combined', label: '⊕ Combined' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); localStorage.setItem('journal_tab', tab.key); setSelectedTrade(null) }}
            style={{
              padding: '10px 20px',
              fontSize: '13.5px',
              fontWeight: activeTab === tab.key ? 600 : 400,
              letterSpacing: '-0.01em',
              color: activeTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--text)' : 'transparent'}`,
              cursor: 'pointer',
              transition: 'color 0.15s',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
        {/* New Trade button - pushed to end */}
        <div style={{ flex: 1 }} />
        <Link
          to="/new"
          style={{
            fontSize: '13px',
            padding: '8px 18px',
            borderRadius: '10px',
            fontWeight: 600,
            textDecoration: 'none',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-color)',
            alignSelf: 'center',
            marginBottom: '8px',
            letterSpacing: '-0.01em',
          }}
        >
          + {t.newTrade}
        </Link>
      </div>

      {/* Comparison panel - shown on Combined tab only */}
      {activeTab === 'combined' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {/* Live card */}
          <div style={{
            background: 'var(--card)',
            border: '2px solid var(--accent)',
            borderRadius: '18px',
            padding: '18px',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>Live</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 'auto' }}>{liveTrades.length} trades</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Win Rate</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{liveWinRate}%</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg R:R</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>1:{liveAvgRR}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total P&L</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: liveTotalPnL >= 0 ? '#4ade80' : '#f87171' }}>
                  {liveTotalPnL >= 0 ? '+' : ''}{liveTotalPnL.toFixed(1)}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>TP</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80' }}>{liveTPTrades.length}</p>
              </div>
            </div>
          </div>

          {/* BackTesting card */}
          <div style={{
            background: 'var(--card)',
            border: '2px solid #f59e0b',
            borderRadius: '18px',
            padding: '18px',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>Opportunity Log</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 'auto' }}>{backtestTrades.length} opportunities</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Capture Rate</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: captureRate >= 70 ? '#4ade80' : captureRate >= 50 ? '#f59e0b' : '#f87171' }}>
                  {captureRate}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg R:R</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>1:{btAvgRR}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Potential P&L</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80' }}>+{btTotalPnL.toFixed(1)}%</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Missed</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#f87171' }}>{missedCount}</p>
              </div>
            </div>
          </div>

          {/* Capture bar - spans both columns */}
          <div style={{
            gridColumn: '1 / -1',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '16px 18px',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Capture Rate — how many opportunities you actually took</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: captureRate >= 70 ? '#4ade80' : captureRate >= 50 ? '#f59e0b' : '#f87171' }}>
                {liveTPTrades.length} / {backtestTrades.length}
              </span>
            </div>
            <div style={{ height: '10px', borderRadius: '5px', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${captureRate}%`,
                borderRadius: '5px',
                background: captureRate >= 70 ? '#4ade80' : captureRate >= 50 ? '#f59e0b' : '#f87171',
                transition: 'width 0.5s ease',
              }} />
            </div>
            {missedCount > 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {missedCount} missed opportunities · Add them via "New Trade" → Missed
              </p>
            )}
          </div>
        </div>
      )}

      {/* Calendar — Live tab */}
      {activeTab === 'live' && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '16px' }} className="fade-in">
          <TradeCalendar
            trades={liveTrades}
            calMonth={calMonth}
            onMonthChange={handleCalMonthChange}
            filterDay={filterDay}
            onDayClick={handleDayClick}
          />
        </div>
      )}

      {/* Calendar — Opportunity Log tab (missed trades in amber) */}
      {activeTab === 'backtest' && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '16px' }} className="fade-in">
          <TradeCalendar
            trades={liveTPTrades}
            secondaryTrades={missedTrades}
            calMonth={calMonth}
            onMonthChange={handleCalMonthChange}
            filterDay={filterDay}
            onDayClick={handleDayClick}
          />
        </div>
      )}

      {/* Calendar — Combined tab (live P&L + missed overlay) */}
      {activeTab === 'combined' && (
        <div style={{ ...cardStyle, padding: '20px', marginBottom: '16px' }} className="fade-in">
          <TradeCalendar
            trades={liveTrades}
            secondaryTrades={missedTrades}
            calMonth={calMonth}
            onMonthChange={handleCalMonthChange}
            filterDay={filterDay}
            onDayClick={handleDayClick}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        {/* Day filter indicator */}
        {filterDay && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '5px 12px', borderRadius: '20px',
            background: 'var(--accent-light)', border: '1px solid var(--accent)',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
              📅 {formatDate(filterDay)}
            </span>
            <button
              onClick={() => setFilterDay(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', padding: '0', lineHeight: 1, display: 'flex' }}
            >✕</button>
          </div>
        )}


        <select value={filterPair} onChange={e => setFilterPair(e.target.value)} style={{ width: 'auto' }}>
          <option value="All">{t.filterPair}</option>
          {pairsList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} style={{ width: 'auto' }}>
          <option value="All">{t.filterOutcome}</option>
          {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)} style={{ width: 'auto' }}>
          <option value="All">{t.filterDirection}</option>
          <option value="Long">Long</option>
          <option value="Short">Short</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflow: 'hidden', marginBottom: '16px' }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: '13px', textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            {t.noResults}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {headers.map(h => (
                    <th key={h} style={{
                      padding: '10px 12px',
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
                {filtered.map(trade => {
                  const isSelected = selectedTrade?.id === trade.id
                  const badge = getOutcomeBadge(trade.outcome)
                  const showType = activeTab === 'backtest' || activeTab === 'combined'
                  return (
                    <tr
                      key={trade.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-light)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--card-hover)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                      onClick={() => setSelectedTrade(isSelected ? null : trade)}
                    >
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{formatDate(trade.date)}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>{trade.time || '--'}</td>

                      {showType && (
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            background: (trade.trade_type === 'missed') ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)',
                            color: (trade.trade_type === 'missed') ? '#f59e0b' : '#34d399',
                          }}>
                            {trade.trade_type === 'missed' ? 'Missed' : 'Live ✓'}
                          </span>
                        </td>
                      )}

                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{trade.pair}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontWeight: 500,
                          background: trade.direction === 'Long' ? 'var(--long-color-bg)' : 'var(--short-color-bg)',
                          color: trade.direction === 'Long' ? 'var(--long-color)' : 'var(--short-color)',
                        }}>
                          {trade.direction}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text)' }}>{trade.entry ?? '--'}</td>

                      {(activeTab === 'live' || activeTab === 'combined') && (
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text)' }}>{trade.sl_pips ?? '--'}</td>
                      )}

                      <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text)' }}>
                        {trade.rr_potential ? `1:${trade.rr_potential}` : '--'}
                      </td>

                      {(activeTab === 'live' || activeTab === 'combined') && (
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text)' }}>
                          {trade.risk_pct ? `${trade.risk_pct}%` : '--'}
                        </td>
                      )}

                      <td style={{ padding: '10px 12px' }}>
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
                      <td style={{ padding: '10px 12px' }}>
                        <MiniStars value={trade.rating} />
                      </td>

                      {(activeTab === 'live' || activeTab === 'combined') && (
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '140px' }}>
                            {(trade.confirmations || []).slice(0, 3).map(c => (
                              <span
                                key={c}
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(129,140,248,0.15)',
                                  color: '#818cf8',
                                }}
                              >
                                {c}
                              </span>
                            ))}
                            {(trade.confirmations || []).length > 3 && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                +{trade.confirmations.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {activeTab === 'live' && (
                        <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {trade.screenshot_url ? (
                              <img
                                src={trade.screenshot_url}
                                alt="HTF"
                                title="HTF Screenshot"
                                onClick={() => setLightbox({ src: trade.screenshot_url, label: 'HTF Screenshot' })}
                                style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '5px', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                              />
                            ) : null}
                            {trade.ltf_screenshot_url ? (
                              <img
                                src={trade.ltf_screenshot_url}
                                alt="LTF"
                                title="LTF Screenshot"
                                onClick={() => setLightbox({ src: trade.ltf_screenshot_url, label: 'LTF Screenshot' })}
                                style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '5px', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                              />
                            ) : null}
                            {!trade.screenshot_url && !trade.ltf_screenshot_url && (
                              <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>--</span>
                            )}
                          </div>
                        </td>
                      )}

                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Link
                            to={`/edit/${trade.id}`}
                            style={{ padding: '5px', borderRadius: '5px', color: 'var(--text-muted)', display: 'flex' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <EditIcon />
                          </Link>
                          {/* In backtest tab: only missed trades can be deleted; live TP rows are read-only */}
                          {(activeTab === 'live' || activeTab === 'combined' || trade.trade_type === 'missed') && (
                            <button
                              onClick={() => deleteTrade(trade.id)}
                              style={{ padding: '5px', borderRadius: '5px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && <Lightbox src={lightbox.src} label={lightbox.label} onClose={() => setLightbox(null)} />}

      {/* Detail panel */}
      {selectedTrade && (
        <div style={{ ...cardStyle, padding: '20px' }} className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontWeight: 600, color: 'var(--text)' }}>
              {selectedTrade.pair} — {formatDate(selectedTrade.date)}
              {selectedTrade.trade_type === 'missed' && (
                <span style={{
                  marginRight: '8px',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  background: 'rgba(245,158,11,0.15)',
                  color: '#f59e0b',
                  fontWeight: 500,
                }}>
                  Missed
                </span>
              )}
            </h2>
            <button
              onClick={() => setSelectedTrade(null)}
              style={{ padding: '4px', borderRadius: '5px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <CloseIcon />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '16px' }}
            className="md:grid-cols-4 lg:grid-cols-6">
            <DetailField label={t.date} value={formatDate(selectedTrade.date)} />
            <DetailField label="Day" value={selectedTrade.day} />
            <DetailField label={t.time} value={selectedTrade.time} />
            <DetailField label={t.pair} value={selectedTrade.pair} />
            <DetailField label={t.direction}>
              <span style={{
                fontSize: '13px',
                fontWeight: 500,
                color: selectedTrade.direction === 'Long' ? 'var(--long-color)' : 'var(--short-color)',
              }}>
                {selectedTrade.direction}
              </span>
            </DetailField>
            <DetailField label={t.outcome}>
              {(() => {
                const badge = getOutcomeBadge(selectedTrade.outcome)
                return (
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontWeight: 500,
                    background: badge.bg,
                    color: badge.color,
                  }}>
                    {selectedTrade.outcome}
                  </span>
                )
              })()}
            </DetailField>
            <DetailField label={t.entry} value={selectedTrade.entry} />
            <DetailField label="SL" value={selectedTrade.sl} />
            <DetailField label="TP" value={selectedTrade.tp} />
            <DetailField label={t.slPips} value={selectedTrade.sl_pips} />
            <DetailField label={t.rrPotential || 'R:R Potential'} value={selectedTrade.rr_potential ? `1:${selectedTrade.rr_potential}` : '--'} />
            <DetailField label={t.risk} value={selectedTrade.risk_pct ? `${selectedTrade.risk_pct}%` : '--'} />
          </div>

          {selectedTrade.sl_to_be && (
            <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)' }}>
              <p style={{ fontSize: '11px', color: '#facc15', fontWeight: 600, marginBottom: '8px' }}>SL to Breakeven</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: selectedTrade.exit_levels?.length ? '8px' : '0' }}>
                BE at 1:{selectedTrade.be_at || 3}
              </p>
              {(selectedTrade.exit_levels || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedTrade.exit_levels.map((lvl, i) => (
                    <span key={i} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(250,204,21,0.12)', color: '#facc15' }}>
                      {lvl.pct}% @ 1:{lvl.rr}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedTrade.rating > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {t.tradeRating || 'Trade Rating'}
              </p>
              <MiniStars value={selectedTrade.rating} />
            </div>
          )}

          {(selectedTrade.confirmations || []).length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{t.confirmations}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedTrade.confirmations.map(c => (
                  <span
                    key={c}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(129,140,248,0.15)',
                      color: '#818cf8',
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedTrade.missed_reason && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>Why missed?</p>
              <p style={{ fontSize: '13px', color: '#f59e0b' }}>{selectedTrade.missed_reason}</p>
            </div>
          )}

          {selectedTrade.notes && (
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>{t.notes}</p>
              <p style={{ fontSize: '13px', color: 'var(--text)' }}>{selectedTrade.notes}</p>
            </div>
          )}

          {(selectedTrade.screenshot_url || selectedTrade.ltf_screenshot_url) && (
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>Screenshots</p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {selectedTrade.screenshot_url && (
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '6px', fontWeight: 600 }}>HTF</p>
                    <img
                      src={selectedTrade.screenshot_url}
                      alt="HTF screenshot"
                      onClick={() => setLightbox({ src: selectedTrade.screenshot_url, label: 'HTF Screenshot' })}
                      style={{ width: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'zoom-in', background: 'var(--bg)' }}
                    />
                  </div>
                )}
                {selectedTrade.ltf_screenshot_url && (
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <p style={{ fontSize: '11px', color: '#60a5fa', marginBottom: '6px', fontWeight: 600 }}>LTF</p>
                    <img
                      src={selectedTrade.ltf_screenshot_url}
                      alt="LTF screenshot"
                      onClick={() => setLightbox({ src: selectedTrade.ltf_screenshot_url, label: 'LTF Screenshot' })}
                      style={{ width: '100%', maxHeight: '280px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'zoom-in', background: 'var(--bg)' }}
                    />
                  </div>
                )}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '8px' }}>Click image to open full size with zoom</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
