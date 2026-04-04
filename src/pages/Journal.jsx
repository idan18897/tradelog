import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useUserSettings } from '../context/UserSettingsContext'
import { computePnL, computeMissedPotGain } from '../lib/utils'

const DEFAULT_PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'USDCHF', 'AUDUSD', 'NAS100', 'US30', 'USOIL']
const OUTCOMES = ['TP', 'Partial TP', 'SL', 'BE', 'Invalid', 'Open']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatDate(iso) {
  if (!iso) return '--'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function holdingTime(trade) {
  if (!trade.time || !trade.exit_time) return null
  const [h1, m1] = trade.time.split(':').map(Number)
  const [h2, m2] = trade.exit_time.split(':').map(Number)
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (mins < 0) mins += 24 * 60
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}


function getOutcomeBadge(outcome) {
  const map = {
    TP: { bg: 'rgba(48,209,88,0.15)', color: '#30D158' },
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
                fill="#FFD60A" stroke="#FFD60A" strokeWidth="1.5"
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
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)

  const changeZoom = useCallback((delta, cx, cy) => {
    setZoom(prev => {
      const next = Math.min(8, Math.max(1, parseFloat((prev + delta).toFixed(2))))
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  const handleKey = useCallback(e => {
    if (e.key === 'Escape') onClose()
    if (e.key === '+' || e.key === '=') changeZoom(0.5)
    if (e.key === '-') changeZoom(-0.5)
    if (e.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }) }
  }, [onClose, changeZoom])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function handleWheel(e) {
    e.preventDefault()
    changeZoom(e.deltaY < 0 ? 0.3 : -0.3)
  }

  function handleMouseDown(e) {
    if (zoom <= 1) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  function handleMouseMove(e) {
    if (!dragging || !dragStart.current) return
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }

  function handleMouseUp() {
    setDragging(false)
    dragStart.current = null
  }

  const btnStyle = {
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600, lineHeight: 1, transition: 'background 0.15s',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      {/* Wrapper — sized to image, toolbar glued on top */}
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', maxWidth: '100vw', maxHeight: '100vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar — same width as image, directly above it */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', flexShrink: 0,
          background: 'rgba(20,20,20,0.9)', backdropFilter: 'blur(10px)',
          borderRadius: '10px 10px 0 0',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: 600 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button style={btnStyle} onClick={() => changeZoom(0.5)}>+</button>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', minWidth: '38px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button style={btnStyle} onClick={() => changeZoom(-0.5)}>−</button>
            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)' }} />
            <button style={{ ...btnStyle, color: 'rgba(255,255,255,0.45)', fontSize: '12px' }} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Reset</button>
            <button style={{ ...btnStyle, background: 'rgba(255,69,58,0.2)', borderColor: 'rgba(255,69,58,0.35)', color: '#FF453A' }} onClick={onClose}>✕ Close</button>
          </div>
        </div>

        {/* Image */}
        <div
          style={{ overflow: 'hidden', cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default', borderRadius: '0 0 8px 8px', background: '#000' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={src}
            alt={label}
            draggable={false}
            style={{
              display: 'block',
              maxWidth: '100vw',
              maxHeight: 'calc(100vh - 44px)',
              objectFit: 'contain',
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center',
              transition: dragging ? 'none' : 'transform 0.15s ease',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
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
    dayStats[tr.date].pnl += computePnL(tr)
  })

  const missedStats = {}
  if (secondaryTrades) {
    secondaryTrades.forEach(tr => {
      if (!tr.date || tr.date.slice(0, 7) !== calMonth) return
      if (!missedStats[tr.date]) missedStats[tr.date] = { count: 0, potPnL: 0 }
      missedStats[tr.date].count++
      missedStats[tr.date].potPnL += computeMissedPotGain(tr)
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

  // Group cells into weeks of 7, pad last week to always have 7 day slots
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7)
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

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
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#30D158' }}>{winDays}/{tradingDays}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#30D158', marginBottom: '1px' }}>Winning Trades</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#30D158' }}>{winCount}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#f87171', marginBottom: '1px' }}>Losing Trades</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>{lossCount}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '1px' }}>Month P&L</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: monthPnL >= 0 ? '#30D158' : '#f87171' }}>
                {monthPnL >= 0 ? '+' : ''}{monthPnL.toFixed(2)}%
              </p>
            </div>
          </>}
          {secondaryTrades && missedDaysCount > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#FF9F0A', marginBottom: '1px' }}>Missed Days</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#FF9F0A' }}>{missedDaysCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(48,209,88,0.4)', display: 'inline-block', border: '1px solid rgba(48,209,88,0.5)' }} />
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
          let weekMissedPnL = 0
          weekCells.forEach(day => {
            if (!day) return
            const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            if (dayStats[ds]) { weekPnL += dayStats[ds].pnl; weekHasTrades = true }
            if (missedStats[ds]) { weekMissedPnL += missedStats[ds].potPnL }
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
                  bg = pnl >= 0 ? 'rgba(48,209,88,0.18)' : 'rgba(255,69,58,0.18)'
                  borderCol = isSelected ? 'var(--accent)' : 'rgba(255,159,10,0.6)'
                } else if (hasTrades) {
                  bg = pnl >= 0 ? 'rgba(48,209,88,0.18)' : 'rgba(255,69,58,0.18)'
                  borderCol = isSelected ? 'var(--accent)' : pnl >= 0 ? 'rgba(48,209,88,0.35)' : 'rgba(255,69,58,0.35)'
                } else if (hasMissed) {
                  bg = 'rgba(255,159,10,0.12)'
                  borderCol = isSelected ? 'var(--accent)' : 'rgba(255,159,10,0.35)'
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
                          <span style={{ fontSize: '10px', color: '#FF9F0A', lineHeight: 1.2 }}>
                            {missed.count} missed
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: hasAny ? 'var(--text)' : 'var(--text-subtle)' }}>
                        {day}
                      </span>
                    </div>
                    {hasTrades && (
                      <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 700, color: pnl >= 0 ? '#30D158' : '#FF453A' }}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                      </div>
                    )}
                    {!hasTrades && hasMissed && missed.potPnL > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 700, color: '#FF9F0A' }}>
                        +{missed.potPnL.toFixed(2)}%
                      </div>
                    )}
                    {hasTrades && hasMissed && missed.potPnL > 0 && (
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#FF9F0A', marginTop: '2px' }}>
                        +{missed.potPnL.toFixed(2)}%
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Weekly summary cell */}
              <div style={{
                minHeight: '72px',
                borderRadius: '8px',
                border: (weekHasTrades || weekMissedPnL > 0)
                  ? `1px solid ${weekHasTrades ? (weekPnL >= 0 ? 'rgba(48,209,88,0.35)' : 'rgba(255,69,58,0.35)') : 'rgba(255,159,10,0.35)'}`
                  : '1px solid transparent',
                background: (weekHasTrades || weekMissedPnL > 0)
                  ? weekHasTrades ? (weekPnL >= 0 ? 'rgba(48,209,88,0.18)' : 'rgba(255,69,58,0.18)') : 'rgba(255,159,10,0.12)'
                  : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px 4px',
              }}>
                {(weekHasTrades || weekMissedPnL > 0) && (
                  <>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weekly</span>
                    {weekHasTrades && (
                      <span style={{ fontSize: '13px', fontWeight: 700, color: weekPnL >= 0 ? '#30D158' : '#f87171', textAlign: 'center' }}>
                        {weekPnL >= 0 ? '+' : ''}{weekPnL.toFixed(2)}%
                      </span>
                    )}
                    {weekMissedPnL > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF9F0A', textAlign: 'center' }}>
                        +{weekMissedPnL.toFixed(2)}%
                      </span>
                    )}
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

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

export default function Journal() {
  const { user } = useAuth()
  const { t } = useLang()
  const { accountSize, showDollarValues } = useUserSettings()
  const navigate = useNavigate()
  const [trades, setTrades] = useState([])
  const [pairsList, setPairsList] = useState(DEFAULT_PAIRS)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [filterPair, setFilterPair] = useState('All')
  const [filterOutcome, setFilterOutcome] = useState('All')
  const [filterDirection, setFilterDirection] = useState('All')
  const [filterRating, setFilterRating] = useState(0)
  const [filterType, setFilterType] = useState('All')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('journal_tab') || 'live')
  const [lightbox, setLightbox] = useState(null) // { src, label }
  const [fullDetailTrade, setFullDetailTrade] = useState(null)
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
    // Optimistic: remove immediately
    setTrades(prev => prev.filter(tr => tr.id !== id))
    if (selectedTrade?.id === id) setSelectedTrade(null)
    const { error } = await supabase.from('trades').delete().eq('id', id)
    // Rollback on error
    if (error) fetchTrades()
  }

  // All live trades (existing behavior)
  const liveTrades = trades.filter(t => (t.trade_type || 'live') === 'live')

  // BackTesting = live TP trades + missed trades
  const liveTPTrades = liveTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP')
  const missedTrades = trades.filter(t => t.trade_type === 'missed')
  const backtestTrades = [...liveTPTrades, ...missedTrades].sort((a, b) =>
    new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'))
  )

  // Comparison stats — filtered to calMonth for Combined tab
  const inCalMonth = t => t.date?.slice(0, 7) === calMonth
  const mLiveTrades = liveTrades.filter(inCalMonth)
  const mLiveTPTrades = mLiveTrades.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP')
  const mMissedTrades = missedTrades.filter(inCalMonth)
  const mBacktestTrades = [...mLiveTPTrades, ...mMissedTrades]

  const liveClosed = mLiveTrades.filter(t => ['TP', 'Partial TP', 'SL', 'BE'].includes(t.outcome))
  const liveWinRate = liveClosed.length ? Math.round(mLiveTPTrades.length / liveClosed.length * 100) : 0
  const liveAvgRR = mLiveTPTrades.length ? (mLiveTPTrades.reduce((s, t) => s + (t.rr_potential || 0), 0) / mLiveTPTrades.length).toFixed(1) : '0'
  const liveTotalPnL = mLiveTrades.reduce((s, t) => s + computePnL(t), 0)

  const btAvgRR = mBacktestTrades.length ? (mBacktestTrades.reduce((s, t) => s + (t.rr_potential || 0), 0) / mBacktestTrades.length).toFixed(1) : '0'
  const btTotalPnL = mBacktestTrades.reduce((s, t) => s + (t.rr_potential || 0) * (t.risk_pct || 0.5), 0)
  const captureRate = mBacktestTrades.length ? Math.round(mLiveTPTrades.length / mBacktestTrades.length * 100) : 0
  const missedCount = mMissedTrades.length

  const takenAvgRR = mLiveTPTrades.length ? (mLiveTPTrades.reduce((s, t) => s + (t.rr_potential || 0), 0) / mLiveTPTrades.length).toFixed(1) : '0'
  const takenTotalPnL = mLiveTPTrades.reduce((s, t) => s + computePnL(t), 0)
  const missedAvgRR = mMissedTrades.length ? (mMissedTrades.reduce((s, t) => s + (Number(t.rr_potential) || Number(t.pot_rr) || 0), 0) / mMissedTrades.length).toFixed(1) : '0'
  const missedTotalPotPnL = mMissedTrades.reduce((s, t) => s + computeMissedPotGain(t), 0)

  // Live tab dashboard stats (month-filtered)
  const liveSL = mLiveTrades.filter(t => t.outcome === 'SL')
  const liveBE = mLiveTrades.filter(t => t.outcome === 'BE')
  const liveWins = mLiveTPTrades
  const grossProfit = liveWins.reduce((s, t) => s + computePnL(t), 0)
  const grossLoss = liveSL.reduce((s, t) => s + Math.abs(computePnL(t)), 0)
  const liveProfitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : liveWins.length > 0 ? '∞' : '--'
  const liveAvgWin = liveWins.length ? (grossProfit / liveWins.length).toFixed(2) : '0'
  const liveAvgLoss = liveSL.length ? (grossLoss / liveSL.length).toFixed(2) : '0'
  const livePnLs = mLiveTrades.map(t => computePnL(t)).filter(v => v !== 0)
  const liveBestTrade = livePnLs.length ? Math.max(...livePnLs) : null
  const liveWorstTrade = livePnLs.length ? Math.min(...livePnLs) : null
  const liveSorted = [...mLiveTrades].filter(t => ['TP','Partial TP','SL'].includes(t.outcome))
    .sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')))
  let streak = 0, streakType = null
  for (let i = liveSorted.length - 1; i >= 0; i--) {
    const isWin = liveSorted[i].outcome === 'TP' || liveSorted[i].outcome === 'Partial TP'
    if (streakType === null) streakType = isWin ? 'W' : 'L'
    if ((isWin && streakType === 'W') || (!isWin && streakType === 'L')) streak++
    else break
  }

  // Combined = all live + all missed (full picture)
  const combinedTrades = [...liveTrades, ...missedTrades].sort((a, b) =>
    new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'))
  )

  // Apply filters to the active tab
  const activeList = activeTab === 'live' ? liveTrades : activeTab === 'backtest' ? backtestTrades : combinedTrades
  const SORT_KEYS = {
    date: tr => tr.date + 'T' + (tr.time || '00:00'),
    'Entry Time': tr => tr.time || '',
    Pair: tr => tr.pair || '',
    Direction: tr => tr.direction || '',
    Entry: tr => Number(tr.entry) || 0,
    'SL Pips': tr => Number(tr.sl_pips) || 0,
    'Pot. R:R': tr => Number(tr.pot_rr || tr.rr_potential) || 0,
    'Risk%': tr => Number(tr.risk_pct) || 0,
    Outcome: tr => tr.outcome || '',
    Rating: tr => Number(tr.rating) || 0,
    'P&L': tr => computePnL(tr),
  }

  const filteredRaw = activeList.filter(tr => {
    if (filterDay && tr.date !== filterDay) return false
    else if (!filterDay && filterMonth !== 'All' && tr.date?.slice(0, 7) !== filterMonth) return false
    if (filterDateFrom && tr.date && tr.date < filterDateFrom) return false
    if (filterDateTo && tr.date && tr.date > filterDateTo) return false
    if (filterPair !== 'All' && tr.pair !== filterPair) return false
    if (filterOutcome !== 'All' && tr.outcome !== filterOutcome) return false
    if (filterDirection !== 'All' && tr.direction !== filterDirection) return false
    if (filterRating > 0 && (tr.rating || 0) < filterRating) return false
    if (filterType !== 'All' && (tr.trade_type || 'live') !== filterType) return false
    return true
  })

  const sortFn = SORT_KEYS[sortKey] || SORT_KEYS['date']
  const filtered = [...filteredRaw].sort((a, b) => {
    const va = sortFn(a), vb = sortFn(b)
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function exportCSV() {
    const cols = ['Date', 'Entry Time', 'Pair', 'Direction', 'Entry', 'SL', 'TP', 'SL Pips', 'Pot R:R', 'Risk%', 'Outcome', 'P&L', 'Rating', 'Notes']
    const rows = filtered.map(tr => [
      tr.date || '',
      tr.time || '',
      tr.pair || '',
      tr.direction || '',
      tr.entry || '',
      tr.sl || '',
      tr.tp || '',
      tr.sl_pips || '',
      tr.pot_rr || tr.rr_potential || '',
      tr.risk_pct || '',
      tr.outcome || '',
      computePnL(tr).toFixed(2),
      tr.rating || '',
      `"${(tr.notes || '').replace(/"/g, '""')}"`,
    ])
    const csv = [cols.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  const allHeaders = [
    { label: t.date,              key: 'date' },
    { label: 'Entry Time',        key: 'Entry Time' },
    { label: 'Type',              key: null },
    { label: t.pair,              key: 'Pair' },
    { label: t.direction,         key: 'Direction' },
    { label: t.entry,             key: 'Entry' },
    { label: t.slPips,            key: 'SL Pips' },
    { label: 'Pot. R:R',         key: 'Pot. R:R' },
    { label: t.risk,              key: 'Risk%' },
    { label: t.outcome,           key: 'Outcome' },
    { label: t.tradeRating || 'Trade Rating', key: 'Rating' },
    { label: t.confirmations,     key: null },
    { label: t.screenshot,        key: null },
    { label: t.actions,           key: null },
  ]
  const headerKeys = activeTab === 'backtest'
    ? ['date','Entry Time','Type','Pair','Direction','Entry','Pot. R:R','Outcome','Rating','actions']
    : activeTab === 'combined'
      ? ['date','Entry Time','Type','Pair','Direction','Entry','SL Pips','Pot. R:R','Risk%','Outcome','Rating','confirmations','actions']
      : ['date','Entry Time','Pair','Direction','Entry','SL Pips','Pot. R:R','Risk%','Outcome','Rating','confirmations','screenshot','actions']
  const headers = headerKeys.map(k => allHeaders.find(h => h.key === k || (k === 'actions' && h.label === t.actions) || (k === 'confirmations' && h.label === t.confirmations) || (k === 'screenshot' && h.label === t.screenshot)) || { label: k, key: null })

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
        <div style={{ fontSize: '64px', marginBottom: '20px', lineHeight: 1 }}>📒</div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.03em' }}>Your journal is empty</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '28px', maxWidth: '340px', lineHeight: 1.6 }}>
          Start logging trades to track your performance, spot patterns, and build your edge.
        </p>
        <Link
          to="/new"
          style={{
            padding: '12px 28px', borderRadius: '50px', fontSize: '15px', fontWeight: 700,
            background: 'var(--accent)', color: '#fff', textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(10,132,255,0.3)',
          }}
        >
          + Log First Trade
        </Link>
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
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'transparent'}`,
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
        <button
          onClick={exportCSV}
          style={{
            fontSize: '13px', padding: '8px 14px', borderRadius: '10px',
            fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-strong)',
            background: 'transparent', color: 'var(--text-muted)', alignSelf: 'center',
            marginBottom: '8px', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}
        >
          ↓ Export CSV
        </button>
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
                <p style={{ fontSize: '20px', fontWeight: 700, color: liveTotalPnL >= 0 ? '#30D158' : '#f87171' }}>
                  {liveTotalPnL >= 0 ? '+' : ''}{liveTotalPnL.toFixed(1)}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>TP</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#30D158' }}>{liveTPTrades.length}</p>
              </div>
            </div>
          </div>

          {/* BackTesting card */}
          <div style={{
            background: 'var(--card)',
            border: '2px solid #FF9F0A',
            borderRadius: '18px',
            padding: '18px',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF9F0A', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FF9F0A' }}>Opportunity Log</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 'auto' }}>{backtestTrades.length} opportunities</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Capture Rate</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: captureRate >= 70 ? '#30D158' : captureRate >= 50 ? '#FF9F0A' : '#f87171' }}>
                  {captureRate}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg R:R</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>1:{btAvgRR}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Potential P&L</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#30D158' }}>+{btTotalPnL.toFixed(1)}%</p>
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
              <span style={{ fontSize: '13px', fontWeight: 700, color: captureRate >= 70 ? '#30D158' : captureRate >= 50 ? '#FF9F0A' : '#f87171' }}>
                {liveTPTrades.length} / {backtestTrades.length}
              </span>
            </div>
            <div style={{ height: '10px', borderRadius: '5px', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${captureRate}%`,
                borderRadius: '5px',
                background: captureRate >= 70 ? '#30D158' : captureRate >= 50 ? '#FF9F0A' : '#f87171',
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

      {/* Mini dashboard — Live tab */}
      {activeTab === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }} className="fade-in">
          {/* Performance card */}
          <div style={{ background: 'var(--card)', border: '2px solid var(--accent)', borderRadius: '18px', padding: '18px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>Performance</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{mLiveTrades.length} trades</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total P&L</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: liveTotalPnL >= 0 ? '#30D158' : '#f87171' }}>
                  {liveTotalPnL >= 0 ? '+' : ''}{liveTotalPnL.toFixed(2)}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Win Rate</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: liveWinRate >= 60 ? '#30D158' : liveWinRate >= 45 ? '#FF9F0A' : '#f87171' }}>
                  {liveWinRate}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg R:R</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>1:{liveAvgRR}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Profit Factor</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: liveProfitFactor === '--' ? 'var(--text-muted)' : parseFloat(liveProfitFactor) >= 1.5 ? '#30D158' : parseFloat(liveProfitFactor) >= 1 ? '#FF9F0A' : '#f87171' }}>
                  {liveProfitFactor}
                </p>
              </div>
            </div>
          </div>

          {/* Trade Analysis card */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '18px', padding: '18px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Trade Analysis</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{liveWins.length}W · {liveSL.length}L · {liveBE.length}BE</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg Win</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#30D158' }}>+{liveAvgWin}%</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg Loss</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#f87171' }}>-{liveAvgLoss}%</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Best Trade</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#30D158' }}>
                  {liveBestTrade !== null ? `+${liveBestTrade.toFixed(2)}%` : '--'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  {streakType ? `${streak} ${streakType === 'W' ? 'Win' : 'Loss'} Streak` : 'Streak'}
                </p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: streakType === 'W' ? '#30D158' : streakType === 'L' ? '#f87171' : 'var(--text-muted)' }}>
                  {streak > 0 ? `${streakType === 'W' ? '🔥' : ''}${streak}×` : '--'}
                </p>
              </div>
            </div>
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

      {/* Stats panels — Opportunity Log tab */}
      {activeTab === 'backtest' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }} className="fade-in">
          {/* Trades Taken */}
          <div style={{ background: 'var(--card)', border: '2px solid var(--accent)', borderRadius: '18px', padding: '18px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>Trades Taken</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{mLiveTPTrades.length} trades</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Total P&L</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: takenTotalPnL >= 0 ? '#30D158' : '#f87171' }}>
                  {takenTotalPnL >= 0 ? '+' : ''}{takenTotalPnL.toFixed(1)}%
                </p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg R:R</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>1:{takenAvgRR}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Capture Rate</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: captureRate >= 70 ? '#30D158' : captureRate >= 50 ? '#FF9F0A' : '#f87171' }}>{captureRate}%</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>TP Count</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#30D158' }}>{mLiveTPTrades.length}</p>
              </div>
            </div>
          </div>
          {/* Trades Missed */}
          <div style={{ background: 'var(--card)', border: '2px solid #FF9F0A', borderRadius: '18px', padding: '18px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF9F0A', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FF9F0A' }}>Trades Missed</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{mMissedTrades.length} trades</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Potential P&L</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#FF9F0A' }}>+{missedTotalPotPnL.toFixed(1)}%</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Avg R:R</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>1:{missedAvgRR}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Missed Count</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#f87171' }}>{mMissedTrades.length}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Missed Days</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#FF9F0A' }}>
                  {new Set(mMissedTrades.map(t => t.date)).size}
                </p>
              </div>
            </div>
          </div>
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
        <select value={filterRating} onChange={e => setFilterRating(Number(e.target.value))} style={{ width: 'auto' }}>
          <option value={0}>All Ratings</option>
          <option value={1}>⭐ +</option>
          <option value={2}>⭐⭐ +</option>
          <option value={3}>⭐⭐⭐ +</option>
          <option value={4}>⭐⭐⭐⭐ +</option>
          <option value={5}>⭐⭐⭐⭐⭐</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto' }}>
          <option value="All">All Types</option>
          <option value="live">Live</option>
          <option value="missed">Missed</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          title="From date"
          style={{ width: 'auto', padding: '7px 10px', fontSize: '13px' }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', alignSelf: 'center' }}>→</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          title="To date"
          style={{ width: 'auto', padding: '7px 10px', fontSize: '13px' }}
        />
        {(filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', padding: '0', lineHeight: 1 }}
            title="Clear date range"
          >✕</button>
        )}
      </div>

      {/* Quick Stats */}
      {filtered.length > 0 && (() => {
        const qClosed = filtered.filter(tr => ['TP','Partial TP','SL','BE'].includes(tr.outcome))
        const qTP = filtered.filter(tr => tr.outcome === 'TP' || tr.outcome === 'Partial TP')
        const qWinRate = qClosed.length ? Math.round(qTP.length / qClosed.length * 100) : null
        const qPnL = filtered.reduce((s, tr) => s + computePnL(tr), 0)
        const qAvgRR = qTP.length ? (qTP.reduce((s, tr) => s + (tr.rr_potential || 0), 0) / qTP.length).toFixed(1) : null
        return (
          <div style={{
            display: 'flex', gap: '20px', flexWrap: 'wrap',
            padding: '10px 16px', marginBottom: '10px',
            background: 'var(--bg-secondary)', borderRadius: '12px',
            fontSize: '12px', color: 'var(--text-muted)',
          }}>
            <span><strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> trades</span>
            {qWinRate !== null && <span>Win Rate <strong style={{ color: qWinRate >= 50 ? '#30D158' : '#FF453A' }}>{qWinRate}%</strong></span>}
            <span>P&L <strong style={{ color: qPnL >= 0 ? '#30D158' : '#FF453A' }}>{qPnL >= 0 ? '+' : ''}{qPnL.toFixed(2)}%</strong></span>
            {qAvgRR && <span>Avg R:R <strong style={{ color: 'var(--accent)' }}>1:{qAvgRR}</strong></span>}
          </div>
        )
      })()}

      {/* Table + Side Panel */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (max-width: 768px) {
          .detail-side-panel {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            z-index: 200 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, transition: 'all 0.25s ease' }}>
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
                      {headers.map(h => {
                        const sortable = !!h.key && h.key in SORT_KEYS
                        const isActive = sortable && sortKey === h.key
                        return (
                          <th
                            key={h.label}
                            onClick={sortable ? () => handleSort(h.key) : undefined}
                            style={{
                              padding: '10px 12px', textAlign: 'start',
                              fontSize: '11px', fontWeight: 600,
                              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                              whiteSpace: 'nowrap', textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              cursor: sortable ? 'pointer' : 'default',
                              userSelect: 'none',
                            }}
                          >
                            {h.label}{isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </th>
                        )
                      })}
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
                                fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 600,
                                background: (trade.trade_type === 'missed') ? 'rgba(245,158,11,0.15)' : 'var(--accent-light)',
                                color: (trade.trade_type === 'missed') ? '#FF9F0A' : 'var(--accent)',
                              }}>
                                {trade.trade_type === 'missed' ? 'Missed' : 'Live ✓'}
                              </span>
                            </td>
                          )}

                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{trade.pair}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              fontSize: '11px', padding: '3px 8px', borderRadius: '5px', fontWeight: 500,
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
                            {(() => { const v = trade.pot_rr || trade.rr_potential; return v ? `1:${v}` : '--' })()}
                          </td>

                          {(activeTab === 'live' || activeTab === 'combined') && (
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text)' }}>
                              {trade.risk_pct ? `${trade.risk_pct}%` : '--'}
                            </td>
                          )}

                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', fontWeight: 500, background: badge.bg, color: badge.color }}>
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
                                  <span key={c} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>{c}</span>
                                ))}
                                {(trade.confirmations || []).length > 3 && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{trade.confirmations.length - 3}</span>
                                )}
                              </div>
                            </td>
                          )}

                          {activeTab === 'live' && (
                            <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {trade.screenshot_url && (
                                  <img src={trade.screenshot_url} alt="HTF" title="HTF Screenshot"
                                    onClick={() => setLightbox({ src: trade.screenshot_url, label: 'HTF Screenshot' })}
                                    style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '5px', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                  />
                                )}
                                {trade.ltf_screenshot_url && (
                                  <img src={trade.ltf_screenshot_url} alt="LTF" title="LTF Screenshot"
                                    onClick={() => setLightbox({ src: trade.ltf_screenshot_url, label: 'LTF Screenshot' })}
                                    style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '5px', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                  />
                                )}
                                {!trade.screenshot_url && !trade.ltf_screenshot_url && (
                                  <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>--</span>
                                )}
                              </div>
                            </td>
                          )}

                          <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button title="Duplicate" onClick={() => navigate('/new', { state: { duplicate: { ...trade, id: undefined } } })}
                                style={{ padding: '5px', borderRadius: '5px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              ><CopyIcon /></button>
                              <Link to={`/edit/${trade.id}`}
                                style={{ padding: '5px', borderRadius: '5px', color: 'var(--text-muted)', display: 'flex' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              ><EditIcon /></Link>
                              {(activeTab === 'live' || activeTab === 'combined' || trade.trade_type === 'missed') && (
                                <button onClick={() => deleteTrade(trade.id)}
                                  style={{ padding: '5px', borderRadius: '5px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                ><TrashIcon /></button>
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
        </div>

        {/* Side Detail Panel */}
        {selectedTrade && (() => {
          const tr = selectedTrade
          const badge = getOutcomeBadge(tr.outcome)
          const pnl = computePnL(tr)
          const rr = tr.pot_rr || tr.rr_potential
          const ht = holdingTime(tr)
          const dollarPart = showDollarValues && accountSize
            ? ` ($${pnl >= 0 ? '+' : ''}${((pnl / 100) * accountSize).toFixed(0)})`
            : ''

          return (
            <div
              className="detail-side-panel"
              style={{
                width: '360px', flexShrink: 0,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '18px', boxShadow: 'var(--shadow-md)',
                animation: 'slideInRight 0.22s ease',
                display: 'flex', flexDirection: 'column',
                maxHeight: 'calc(100vh - 120px)',
                position: 'sticky', top: '80px',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '20px', fontWeight: 750, color: 'var(--text)', letterSpacing: '-0.03em' }}>{tr.pair}</span>
                      <span style={{
                        fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                        background: tr.direction === 'Long' ? 'var(--long-color-bg)' : 'var(--short-color-bg)',
                        color: tr.direction === 'Long' ? 'var(--long-color)' : 'var(--short-color)',
                      }}>{tr.direction}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{tr.outcome}</span>
                      {tr.trade_type === 'missed' && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>Missed</span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '5px' }}>
                      {formatDate(tr.date)}{tr.day ? ` · ${tr.day}` : ''}
                      {tr.time ? ` · ${tr.time}` : ''}
                      {tr.exit_time ? ` → ${tr.exit_time}` : ''}
                    </p>
                  </div>
                  <button onClick={() => setSelectedTrade(null)}
                    style={{ padding: '6px', borderRadius: '8px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--card-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}
                  ><CloseIcon /></button>
                </div>

                {/* P&L hero */}
                {tr.outcome !== 'Open' && tr.trade_type !== 'missed' && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: pnl >= 0 ? '#30D158' : '#FF453A' }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                    </span>
                    {dollarPart && <span style={{ fontSize: '14px', fontWeight: 600, color: pnl >= 0 ? '#30D158' : '#FF453A', opacity: 0.8 }}>{dollarPart}</span>}
                  </div>
                )}
                {tr.trade_type === 'missed' && (() => {
                  const gain = computeMissedPotGain(tr)
                  return gain ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 800, color: '#FF9F0A' }}>+{gain.toFixed(2)}%</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>potential</span>
                    </div>
                  ) : null
                })()}
              </div>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { label: 'Entry', value: tr.entry ?? '--' },
                    { label: 'SL', value: tr.sl ?? '--' },
                    { label: 'TP', value: tr.tp ?? '--' },
                    { label: 'SL Pips', value: tr.sl_pips ?? '--' },
                    { label: 'R:R', value: rr ? `1:${rr}` : '--' },
                    { label: 'Risk', value: tr.risk_pct ? `${tr.risk_pct}%` : '--' },
                    ...(ht ? [{ label: 'Hold Time', value: ht }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px 12px' }}>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</p>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Rating */}
                {tr.rating > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Rating</p>
                    <MiniStars value={tr.rating} />
                  </div>
                )}

                {/* SL to BE */}
                {tr.sl_to_be && (
                  <div style={{ marginBottom: '14px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)' }}>
                    <p style={{ fontSize: '11px', color: '#facc15', fontWeight: 600, marginBottom: '4px' }}>SL → Breakeven at 1:{tr.be_at || 3}</p>
                    {(tr.exit_levels || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {tr.exit_levels.map((lvl, i) => (
                          <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(250,204,21,0.12)', color: '#facc15' }}>
                            {lvl.pct}% @ 1:{lvl.rr}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmations */}
                {(tr.confirmations || []).length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Confirmations</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {tr.confirmations.map(c => (
                        <span key={c} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(129,140,248,0.15)', color: '#818cf8', fontWeight: 600 }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missed reason */}
                {tr.missed_reason && (
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Why missed</p>
                    <p style={{ fontSize: '13px', color: '#FF9F0A' }}>{tr.missed_reason}</p>
                  </div>
                )}

                {/* Notes */}
                {tr.notes && (
                  <div style={{ marginBottom: '14px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Notes</p>
                    <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{tr.notes}</p>
                  </div>
                )}

              </div>

              {/* Action buttons */}
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                {/* View full details button */}
                <button
                  onClick={() => setFullDetailTrade(tr)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '11px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                    background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  View Full Details
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                <Link to={`/edit/${tr.id}`} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                  background: 'var(--accent)', color: '#fff', textDecoration: 'none', transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <EditIcon /> Edit
                </Link>
                <button onClick={() => navigate('/new', { state: { duplicate: { ...tr, id: undefined } } })}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                    background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                >
                  <CopyIcon /> Duplicate
                </button>
                {(activeTab === 'live' || activeTab === 'combined' || tr.trade_type === 'missed') && (
                  <button onClick={() => deleteTrade(tr.id)}
                    style={{
                      width: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                      background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
                    title="Delete trade"
                  >
                    <TrashIcon />
                  </button>
                )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Full Detail Modal */}
      {fullDetailTrade && (() => {
        const tr = fullDetailTrade
        const badge = getOutcomeBadge(tr.outcome)
        const pnl = computePnL(tr)
        const rr = tr.pot_rr || tr.rr_potential
        const ht = holdingTime(tr)
        const dollarPart = showDollarValues && accountSize
          ? ` ($${pnl >= 0 ? '+' : ''}${((pnl / 100) * accountSize).toFixed(0)})`
          : ''
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={() => setFullDetailTrade(null)}
          >
            <div
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 750, color: 'var(--text)', letterSpacing: '-0.03em' }}>{tr.pair}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: tr.direction === 'Long' ? 'var(--long-color-bg)' : 'var(--short-color-bg)', color: tr.direction === 'Long' ? 'var(--long-color)' : 'var(--short-color)' }}>{tr.direction}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{tr.outcome}</span>
                      {tr.trade_type === 'missed' && <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>Missed</span>}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {formatDate(tr.date)}{tr.day ? ` · ${tr.day}` : ''}
                      {tr.time ? ` · ${tr.time}` : ''}{tr.exit_time ? ` → ${tr.exit_time}` : ''}
                      {ht ? ` · ${ht}` : ''}
                    </p>
                    {tr.outcome !== 'Open' && tr.trade_type !== 'missed' && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                        <span style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.04em', color: pnl >= 0 ? '#30D158' : '#FF453A' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span>
                        {dollarPart && <span style={{ fontSize: '14px', fontWeight: 600, color: pnl >= 0 ? '#30D158' : '#FF453A', opacity: 0.8 }}>{dollarPart}</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setFullDetailTrade(null)}
                    style={{ padding: '6px', borderRadius: '8px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--card-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}
                  ><CloseIcon /></button>
                </div>
              </div>

              {/* Modal body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                  {[
                    { label: 'Entry', value: tr.entry ?? '--' },
                    { label: 'SL', value: tr.sl ?? '--' },
                    { label: 'TP', value: tr.tp ?? '--' },
                    { label: 'SL Pips', value: tr.sl_pips ?? '--' },
                    { label: 'R:R', value: rr ? `1:${rr}` : '--' },
                    { label: 'Risk', value: tr.risk_pct ? `${tr.risk_pct}%` : '--' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px 14px' }}>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</p>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* SL to BE */}
                {tr.sl_to_be && (
                  <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)' }}>
                    <p style={{ fontSize: '12px', color: '#facc15', fontWeight: 600, marginBottom: '4px' }}>SL → Breakeven at 1:{tr.be_at || 3}</p>
                    {(tr.exit_levels || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {tr.exit_levels.map((lvl, i) => (
                          <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(250,204,21,0.12)', color: '#facc15' }}>{lvl.pct}% @ 1:{lvl.rr}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rating */}
                {tr.rating > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Rating</p>
                    <MiniStars value={tr.rating} />
                  </div>
                )}

                {/* Confirmations */}
                {(tr.confirmations || []).length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Confirmations</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {tr.confirmations.map(c => (
                        <span key={c} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(129,140,248,0.15)', color: '#818cf8', fontWeight: 600 }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missed reason */}
                {tr.missed_reason && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Why missed</p>
                    <p style={{ fontSize: '13px', color: '#FF9F0A' }}>{tr.missed_reason}</p>
                  </div>
                )}

                {/* Notes */}
                {tr.notes && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Notes</p>
                    <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{tr.notes}</p>
                  </div>
                )}

                {/* Screenshots */}
                {(tr.screenshot_url || tr.ltf_screenshot_url) && (
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Screenshots</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {tr.screenshot_url && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <p style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, marginBottom: '6px' }}>HTF</p>
                          <img src={tr.screenshot_url} alt="HTF"
                            onClick={() => { setFullDetailTrade(null); setLightbox({ src: tr.screenshot_url, label: 'HTF Screenshot' }) }}
                            style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'zoom-in', background: 'var(--bg)' }}
                          />
                        </div>
                      )}
                      {tr.ltf_screenshot_url && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <p style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600, marginBottom: '6px' }}>LTF</p>
                          <img src={tr.ltf_screenshot_url} alt="LTF"
                            onClick={() => { setFullDetailTrade(null); setLightbox({ src: tr.ltf_screenshot_url, label: 'LTF Screenshot' }) }}
                            style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'zoom-in', background: 'var(--bg)' }}
                          />
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '8px' }}>Click image to open full size</p>
                  </div>
                )}
              </div>

              {/* Modal actions */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <Link to={`/edit/${tr.id}`} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '11px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                  background: 'var(--accent)', color: '#fff', textDecoration: 'none', transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                ><EditIcon /> Edit</Link>
                <button onClick={() => { setFullDetailTrade(null); navigate('/new', { state: { duplicate: { ...tr, id: undefined } } }) }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '11px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                    background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                ><CopyIcon /> Duplicate</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Lightbox */}
      {lightbox && <Lightbox src={lightbox.src} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </div>
  )
}
