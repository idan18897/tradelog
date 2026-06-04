import { useState, useEffect, useRef } from 'react'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const parsed = value ? new Date(value + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function openCalendar() {
    if (value) {
      const d = new Date(value + 'T12:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
    setOpen(true)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }

  function buildDays() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }

  const cells = buildDays()
  const selectedDay = value ? parseInt(value.split('-')[2], 10) : null
  const isCurrentMonth = value
    && parseInt(value.split('-')[0]) === viewYear
    && parseInt(value.split('-')[1]) - 1 === viewMonth

  const today = new Date()
  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

  const displayDate = value
    ? (() => {
        const d = new Date(value + 'T12:00:00')
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      })()
    : 'Select date'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={openCalendar}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'var(--input-bg)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--input-border)'}`,
          borderRadius: '8px',
          color: value ? 'var(--text)' : 'var(--text-muted)',
          fontSize: '14px',
          cursor: 'pointer',
          textAlign: 'start',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          transition: 'border-color 0.15s',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <span>{displayDate}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          insetInlineStart: 0,
          zIndex: 200,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '16px',
          minWidth: '260px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '6px', fontSize: '16px' }}>‹</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{MONTH_NAMES[viewMonth]}</span>
              <select
                value={viewYear}
                onChange={e => setViewYear(parseInt(e.target.value))}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', padding: '2px 6px', fontSize: '13px', cursor: 'pointer' }}
              >
                {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 5 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '6px', fontSize: '16px' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
            {DAY_HEADERS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const isSelected = isCurrentMonth && day === selectedDay
              const isTodayDay = isToday(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: '7px',
                    border: isTodayDay && !isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : isTodayDay ? 'var(--accent)' : 'var(--text)',
                    fontSize: '13px',
                    fontWeight: isSelected || isTodayDay ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    padding: '4px 0',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--accent-light)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const t = new Date()
              const y = t.getFullYear(), m = String(t.getMonth()+1).padStart(2,'0'), d = String(t.getDate()).padStart(2,'0')
              onChange(`${y}-${m}-${d}`)
              setOpen(false)
            }}
            style={{ width: '100%', marginTop: '10px', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  )
}
