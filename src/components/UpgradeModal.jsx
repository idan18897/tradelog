import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const PLANS = [
  { key: 'yearly', label: 'Yearly — $99 / year', sub: 'Best value · Save ~$81 vs monthly', highlight: true, badge: 'BEST VALUE' },
  { key: 'monthly', label: 'Monthly — $14.99 / month', sub: 'Cancel anytime', highlight: false },
  { key: 'lifetime', label: 'Lifetime — $199 once', sub: 'Pay once, use forever', highlight: false },
]

export default function UpgradeModal({ onClose }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')

  async function handleCheckout(plan) {
    setLoading(plan)
    setError('')
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: user?.id, email: user?.email }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Something went wrong')
        setLoading(null)
      }
    } catch {
      setError('Network error. Try again.')
      setLoading(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '20px', padding: '36px', maxWidth: '480px', width: '100%',
        position: 'relative',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1,
        }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚀</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            Free plan limit reached
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            You've used all 10 free trades. Upgrade to log unlimited trades and unlock all analytics.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {PLANS.map(plan => (
            <button
              key={plan.key}
              onClick={() => handleCheckout(plan.key)}
              disabled={!!loading}
              style={{
                padding: '16px 20px', borderRadius: '14px', cursor: 'pointer',
                background: plan.highlight ? 'rgba(29,158,117,0.1)' : 'var(--bg)',
                border: plan.highlight ? '1.5px solid rgba(29,158,117,0.4)' : '1px solid var(--border)',
                textAlign: 'left', transition: 'all 0.15s', position: 'relative',
                opacity: loading && loading !== plan.key ? 0.5 : 1,
              }}
            >
              {plan.badge && (
                <span style={{ position: 'absolute', top: '10px', right: '12px', background: '#1D9E75', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '50px' }}>
                  {plan.badge}
                </span>
              )}
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>
                {loading === plan.key ? 'Redirecting…' : plan.label}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{plan.sub}</p>
            </button>
          ))}
        </div>

        {error && <p style={{ marginTop: '12px', fontSize: '13px', color: '#f87171', textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  )
}
