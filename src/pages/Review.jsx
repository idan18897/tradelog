import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { computePnL } from '../lib/utils'

// ── helpers ──────────────────────────────────────────────────────────────────

function getISOWeekBounds(date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  const mon = new Date(d); mon.setDate(d.getDate() - (day - 1))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = dt =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return { from: fmt(mon), to: fmt(sun), monDate: mon }
}

function fmtDate(iso) {
  if (!iso) return '--'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtShort(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreGrade(s) {
  if (s === null) return { grade: '--', label: 'No closed trades', color: 'var(--text-muted)' }
  if (s >= 80) return { grade: 'A', label: 'Excellent week 🔥', color: '#30D158' }
  if (s >= 65) return { grade: 'B', label: 'Strong week 💪', color: '#0A84FF' }
  if (s >= 50) return { grade: 'C', label: 'Decent week', color: '#FF9F0A' }
  if (s >= 35) return { grade: 'D', label: 'Needs improvement', color: '#FF6B6B' }
  return { grade: 'F', label: 'Rough week — review & reset', color: '#FF453A' }
}

const OUTCOME_COLORS = {
  TP: '#4ade80', 'Partial TP': '#a3e635', SL: '#f87171', BE: '#facc15',
  Invalid: '#9ca3af', Open: '#60a5fa',
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Review() {
  const { user } = useAuth()
  const isMobile = useIsMobile()

  // week offset from current week (0 = this week, -1 = last week, …)
  const [weekOffset, setWeekOffset] = useState(0)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  // { [tradeId]: string }
  const [reviewNotes, setReviewNotes] = useState({})
  // { [tradeId]: 'saving' | 'saved' | null }
  const [saveStatus, setSaveStatus] = useState({})
  // week-level summary stored in localStorage
  const [weekSummary, setWeekSummary] = useState('')
  const [summaryKey, setSummaryKey] = useState('')

  const now = new Date()
  const anchorDate = new Date(now)
  anchorDate.setDate(now.getDate() + weekOffset * 7)
  const bounds = getISOWeekBounds(anchorDate)

  const isCurrentWeek = weekOffset === 0

  // load all trades once
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('trade_type', 'live')
        .order('date', { ascending: true })
      setTrades(data || [])
      setLoading(false)
    }
    load()
  }, [user.id])

  // when week changes: populate reviewNotes + load summary from localStorage
  useEffect(() => {
    const key = `week_review_${bounds.from}`
    setSummaryKey(key)
    setWeekSummary(localStorage.getItem(key) || '')

    // pre-fill notes from existing review_note on trades
    const week = (trades || []).filter(t => t.date >= bounds.from && t.date <= bounds.to)
    const initial = {}
    week.forEach(t => { if (t.review_note) initial[t.id] = t.review_note })
    setReviewNotes(initial)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, trades])

  const weekTrades = trades.filter(t => t.date >= bounds.from && t.date <= bounds.to)
  const weekClosed = weekTrades.filter(t => ['TP', 'Partial TP', 'SL', 'BE'].includes(t.outcome))
  const weekTP = weekClosed.filter(t => t.outcome === 'TP' || t.outcome === 'Partial TP').length
  const weekPnL = parseFloat(weekTrades.reduce((s, t) => s + computePnL(t), 0).toFixed(2))
  const weekWR = weekClosed.length ? Math.round(weekTP / weekClosed.length * 100) : null
  const weekViolations = weekTrades.filter(t => t.rule_violated).length
  const weekScore = (() => {
    if (!weekClosed.length) return null
    const wrScore = weekWR !== null ? Math.min(40, Math.round(weekWR / 100 * 40)) : 0
    const pnlScore = weekPnL > 0 ? Math.min(30, Math.round(weekPnL * 3)) : 0
    const disc = weekTrades.length > 0 ? (1 - weekViolations / weekTrades.length) : 1
    const discScore = Math.round(disc * 30)
    return Math.min(100, wrScore + pnlScore + discScore)
  })()
  const grade = scoreGrade(weekScore)

  // save review note for a trade
  const saveNote = useCallback(async (tradeId, note) => {
    setSaveStatus(s => ({ ...s, [tradeId]: 'saving' }))
    await supabase.from('trades').update({ review_note: note }).eq('id', tradeId)
    setSaveStatus(s => ({ ...s, [tradeId]: 'saved' }))
    setTimeout(() => setSaveStatus(s => ({ ...s, [tradeId]: null })), 1800)
  }, [])

  function saveSummary() {
    localStorage.setItem(summaryKey, weekSummary)
  }

  // ── styles ─────────────────────────────────────────────────────────────────

  const card = {
    background: 'var(--card)',
    borderRadius: '14px',
    border: '1px solid var(--border)',
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: isMobile ? '16px' : '28px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>Weekly Review</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Review your trades, add lessons, and plan ahead</p>
        </div>
        <Link to="/" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
      </div>

      {/* Week navigator */}
      <div style={{ ...card, padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: 'var(--text)', fontSize: '14px', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        >←</button>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
            {fmtShort(bounds.from)} – {fmtShort(bounds.to)}
          </p>
          {isCurrentWeek && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0A84FF', background: 'rgba(10,132,255,0.12)', padding: '1px 8px', borderRadius: '20px' }}>
              Current week
            </span>
          )}
        </div>

        <button
          onClick={() => setWeekOffset(o => Math.min(o + 1, 0))}
          disabled={weekOffset === 0}
          style={{
            background: weekOffset === 0 ? 'var(--bg-secondary)' : 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 14px',
            cursor: weekOffset === 0 ? 'default' : 'pointer',
            color: weekOffset === 0 ? 'var(--text-subtle)' : 'var(--text)', fontSize: '14px',
            opacity: weekOffset === 0 ? 0.4 : 1,
          }}
        >→</button>
      </div>

      {/* Week Stats */}
      <div style={{ ...card, padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>

          {/* Score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '72px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: `conic-gradient(${grade.color} ${(weekScore ?? 0) * 3.6}deg, var(--bg-secondary) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: '50px', height: '50px', borderRadius: '50%', background: 'var(--card)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: grade.color, lineHeight: 1 }}>
                  {weekScore !== null ? weekScore : '--'}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>/100</span>
              </div>
            </div>
            <span style={{ fontSize: '10px', color: grade.color, fontWeight: 600, textAlign: 'center', maxWidth: '80px' }}>{grade.label}</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', flex: 1, minWidth: '200px' }}>
            {[
              { label: 'Trades', value: weekTrades.length, color: 'var(--text)' },
              { label: 'Win Rate', value: weekWR !== null ? `${weekWR}%` : '--', color: weekWR !== null ? (weekWR >= 50 ? '#30D158' : '#FF453A') : 'var(--text-muted)' },
              { label: 'P&L', value: `${weekPnL >= 0 ? '+' : ''}${weekPnL.toFixed(2)}%`, color: weekPnL >= 0 ? '#30D158' : '#FF453A' },
              { label: 'Violations', value: weekViolations === 0 ? '✅ None' : weekViolations, color: weekViolations === 0 ? '#30D158' : '#FF453A' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>{s.label}</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade list */}
      {weekTrades.length === 0 ? (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '8px' }}>No trades this week</p>
          <Link to="/new" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>Log a trade →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {weekTrades.map((tr, idx) => {
            const pnl = computePnL(tr)
            const isWin = tr.outcome === 'TP' || tr.outcome === 'Partial TP'
            const outcomeColor = OUTCOME_COLORS[tr.outcome] || '#9ca3af'
            const note = reviewNotes[tr.id] ?? ''
            const status = saveStatus[tr.id]

            return (
              <div key={tr.id} style={{ ...card, padding: '16px 18px' }}>
                {/* Trade header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      #{idx + 1} · {fmtDate(tr.date)}{tr.time ? ` · ${tr.time}` : ''}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{tr.pair}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                      background: tr.direction === 'Long' ? 'rgba(48,209,88,0.15)' : 'rgba(248,113,113,0.15)',
                      color: tr.direction === 'Long' ? '#30D158' : '#f87171',
                    }}>{tr.direction}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                      background: `${outcomeColor}22`, color: outcomeColor,
                    }}>{tr.outcome}</span>
                    {tr.rule_violated && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                        background: 'rgba(248,113,113,0.12)', color: '#f87171',
                      }}>⚠️ Rule violated</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: pnl >= 0 ? '#30D158' : '#FF453A' }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                    </p>
                    {tr.rr_potential ? (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1:{tr.rr_potential} R:R</p>
                    ) : null}
                  </div>
                </div>

                {/* Existing notes */}
                {tr.notes && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Trade notes</p>
                    <p style={{ fontSize: '13px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{tr.notes}</p>
                  </div>
                )}

                {/* Review note */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      📝 What did you learn from this trade?
                    </label>
                    {status === 'saving' && <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Saving…</span>}
                    {status === 'saved' && <span style={{ fontSize: '11px', color: '#30D158' }}>✓ Saved</span>}
                  </div>
                  <textarea
                    value={note}
                    onChange={e => setReviewNotes(n => ({ ...n, [tr.id]: e.target.value }))}
                    onBlur={() => saveNote(tr.id, note)}
                    placeholder={isWin
                      ? 'What did you do well? What made this setup work?'
                      : 'What went wrong? What will you do differently next time?'}
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '10px 12px',
                      color: 'var(--text)', fontSize: '13px', resize: 'vertical',
                      outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlurCapture={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Week Summary */}
      <div style={{ ...card, padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Week Summary</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Reflect on the week as a whole — what patterns do you see?
        </p>

        <div key={summaryKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { key: 'learned', label: '💡 Key lessons this week', placeholder: 'What are the 1–3 most important things you learned?' },
            { key: 'improve', label: '🎯 What to improve next week', placeholder: 'Specific rules or habits to focus on…' },
          ].map(field => {
            const storageKey = `${summaryKey}_${field.key}`
            const val = field.key === 'learned'
              ? (weekSummary || '')
              : (localStorage.getItem(storageKey) || '')

            return (
              <div key={field.key}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  {field.label}
                </label>
                <textarea
                  defaultValue={val}
                  onBlur={e => {
                    if (field.key === 'learned') {
                      setWeekSummary(e.target.value)
                      localStorage.setItem(summaryKey, e.target.value)
                    } else {
                      localStorage.setItem(storageKey, e.target.value)
                    }
                  }}
                  placeholder={field.placeholder}
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '10px 12px',
                    color: 'var(--text)', fontSize: '13px', resize: 'vertical',
                    outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlurCapture={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '10px' }}>
          Auto-saved when you click away from each field
        </p>
      </div>

    </div>
  )
}
