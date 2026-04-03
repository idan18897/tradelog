import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function getDemoTrades(userId) {
  const today = new Date()
  function daysAgo(n) {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  function dayName(dateStr) { return days[new Date(dateStr).getDay()] }

  return [
    { date: daysAgo(1),  pair: 'XAUUSD', direction: 'Long',  entry: 2318.5, sl: 2312.0, tp: 2336.0, risk_pct: 0.5, outcome: 'TP',         rr_potential: 2.7, trade_type: 'live', confirmations: ['OB','MSS','HTF Align'] },
    { date: daysAgo(2),  pair: 'EURUSD', direction: 'Short', entry: 1.0845, sl: 1.0875, tp: 1.0775, risk_pct: 0.5, outcome: 'SL',         rr_potential: 2.3, trade_type: 'live', confirmations: ['BOS','FVG'] },
    { date: daysAgo(3),  pair: 'GBPJPY', direction: 'Long',  entry: 194.20, sl: 193.50, tp: 196.10, risk_pct: 1.0, outcome: 'Partial TP', rr_potential: 2.7, trade_type: 'live', confirmations: ['OB','Liquidity','Session'] },
    { date: daysAgo(5),  pair: 'XAUUSD', direction: 'Short', entry: 2342.0, sl: 2352.0, tp: 2312.0, risk_pct: 0.5, outcome: 'TP',         rr_potential: 3.0, trade_type: 'live', confirmations: ['MSS','FVG','Trend'] },
    { date: daysAgo(6),  pair: 'NAS100', direction: 'Long',  entry: 18240,  sl: 18150,  tp: 18510,  risk_pct: 0.5, outcome: 'BE',         rr_potential: 3.0, trade_type: 'live', confirmations: ['OB','HTF Align'] },
    { date: daysAgo(8),  pair: 'GBPUSD', direction: 'Short', entry: 1.2680, sl: 1.2720, tp: 1.2560, risk_pct: 0.5, outcome: 'TP',         rr_potential: 3.0, trade_type: 'live', confirmations: ['BOS','MSS','FVG'] },
    { date: daysAgo(10), pair: 'EURUSD', direction: 'Long',  entry: 1.0790, sl: 1.0760, tp: 1.0880, risk_pct: 1.0, outcome: 'SL',         rr_potential: 3.0, trade_type: 'live', confirmations: ['OB','Liquidity'] },
    { date: daysAgo(12), pair: 'XAUUSD', direction: 'Long',  entry: 2295.0, sl: 2287.0, tp: 2319.0, risk_pct: 0.5, outcome: 'TP',         rr_potential: 3.0, trade_type: 'live', confirmations: ['MSS','OB','Session'] },
    { date: daysAgo(14), pair: 'USDJPY', direction: 'Short', entry: 153.80, sl: 154.30, tp: 152.30, risk_pct: 0.5, outcome: 'SL',         rr_potential: 3.0, trade_type: 'live', confirmations: ['BOS','FVG'] },
    { date: daysAgo(16), pair: 'GBPJPY', direction: 'Short', entry: 196.50, sl: 197.20, tp: 194.40, risk_pct: 1.0, outcome: 'TP',         rr_potential: 3.0, trade_type: 'live', confirmations: ['Trend','MSS','HTF Align','FVG'] },
  ].map(t => ({
    user_id: userId,
    date: t.date,
    day: dayName(t.date),
    pair: t.pair,
    direction: t.direction,
    entry: t.entry,
    sl: t.sl,
    tp: t.tp,
    risk_pct: t.risk_pct,
    rr_potential: t.rr_potential,
    outcome: t.outcome,
    trade_type: t.trade_type,
    confirmations: t.confirmations,
    rating: Math.floor(Math.random() * 2) + 3,
    week_number: null,
  }))
}

const STEPS = [
  {
    icon: '📝',
    title: 'Log your trades',
    desc: 'Every trade gets its own entry — price, direction, confirmations, screenshots and outcome. The form is fast, drag-to-reorder, and saves instantly.',
    visual: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        {[['Pair', 'XAUUSD'], ['Direction', 'Long ▲'], ['Entry', '2,318.50'], ['Outcome', 'TP ✓']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{k}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '📊',
    title: 'Track your performance',
    desc: 'The Dashboard shows win rate, P&L, equity curve, performance by session, day, pair, and more — all updating in real time as you log trades.',
    visual: (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[['Win Rate', '62%', '#30D158'], ['Monthly P&L', '+4.8%', '#0A84FF'], ['Avg R:R', '1:2.6', 'var(--text)'], ['Profit Factor', '1.84', '#30D158']].map(([label, value, color]) => (
          <div key={label} style={{ flex: '1 1 80px', padding: '12px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '16px', fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '🔬',
    title: 'Analyze your edge',
    desc: 'See which confirmations actually work for you. Confirmation Analysis breaks down win rate, avg R:R and P&L per setup — so you know what to keep and what to cut.',
    visual: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        {[['MSS', '71%', '+3.2%'], ['OB', '65%', '+2.1%'], ['FVG', '48%', '-0.4%']].map(([conf, wr, pnl]) => (
          <div key={conf} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', width: '36px' }}>{conf}</span>
            <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: wr, background: '#0A84FF', borderRadius: '3px' }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '28px' }}>{wr}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: pnl.startsWith('+') ? '#30D158' : '#FF453A', width: '38px', textAlign: 'right' }}>{pnl}</span>
          </div>
        ))}
      </div>
    ),
  },
]

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  function close() {
    localStorage.setItem('onboarding_done', '1')
    localStorage.setItem('show_first_trade_tip', '1')
    onClose()
  }

  async function loadDemoData() {
    if (!user) return
    setLoadingDemo(true)
    const trades = getDemoTrades(user.id)
    await supabase.from('trades').insert(trades)
    setLoadingDemo(false)
    localStorage.setItem('onboarding_done', '1')
    onClose()
    navigate('/')
    window.location.reload()
  }

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '24px', padding: '36px 36px 28px', maxWidth: '480px', width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)', position: 'relative',
          animation: 'fadeInUp 0.25s ease',
        }}
      >
        <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }`}</style>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '28px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? '20px' : '6px', height: '6px', borderRadius: '3px',
              background: i === step ? 'var(--accent)' : 'var(--border-strong)',
              transition: 'all 0.25s',
            }} />
          ))}
        </div>

        {/* Icon + Title */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '44px', lineHeight: 1, marginBottom: '14px' }}>{current.icon}</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: '10px' }}>
            {step === 0 ? <>Welcome to <span style={{ color: 'var(--accent)' }}>TradingLog</span>! 👋</> : current.title}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.65 }}>{current.desc}</p>
        </div>

        {/* Visual */}
        <div style={{ marginBottom: '28px' }}>{current.visual}</div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                padding: '11px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >← Back</button>
          )}

          {!isLast ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >Next →</button>
          ) : (
            <>
              <button
                onClick={loadDemoData}
                disabled={loadingDemo}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
                  opacity: loadingDemo ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {loadingDemo ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />Loading...</> : '🎲 Demo Data'}
              </button>
              <button
                onClick={close}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >Get Started</button>
            </>
          )}
        </div>

        {/* Skip */}
        <button
          onClick={close}
          style={{
            display: 'block', margin: '16px auto 0', background: 'none', border: 'none',
            color: 'var(--text-subtle)', fontSize: '12px', cursor: 'pointer',
          }}
        >Skip intro</button>
      </div>
    </div>
  )
}
