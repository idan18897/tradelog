import { useState, useEffect } from 'react'

export default function StreakToast() {
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('streak_toast')
    if (!raw) return
    try {
      const { msg, ts } = JSON.parse(raw)
      // Only show if less than 30 seconds old (fresh from a save)
      if (Date.now() - ts < 30000) {
        setToast(msg)
        localStorage.removeItem('streak_toast')
        setTimeout(() => setToast(null), 5000)
      } else {
        localStorage.removeItem('streak_toast')
      }
    } catch (_) {
      localStorage.removeItem('streak_toast')
    }
  }, [])

  if (!toast) return null

  const isWin = toast.startsWith('🔥')

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: isWin
        ? 'linear-gradient(135deg, #1a3a1a, #0d2a0d)'
        : 'linear-gradient(135deg, #3a1a1a, #2a0d0d)',
      border: `1px solid ${isWin ? 'rgba(48,209,88,0.4)' : 'rgba(255,69,58,0.4)'}`,
      borderRadius: '14px',
      padding: '14px 20px',
      boxShadow: `0 8px 32px ${isWin ? 'rgba(48,209,88,0.25)' : 'rgba(255,69,58,0.25)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      animation: 'fadeIn 0.3s ease',
      maxWidth: '90vw',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: '16px' }}>{isWin ? '🔥' : '⚠️'}</span>
      <span style={{
        fontSize: '13px',
        fontWeight: 600,
        color: isWin ? '#30D158' : '#FF453A',
      }}>
        {toast.replace(/^🔥\s?/, '').replace(/^⚠️\s?/, '')}
      </span>
      <button
        onClick={() => setToast(null)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.3)', fontSize: '16px', padding: '0 0 0 4px', lineHeight: 1,
        }}
      >×</button>
    </div>
  )
}
