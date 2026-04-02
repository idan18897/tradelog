export default function WelcomeModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '24px', padding: '48px 40px', maxWidth: '460px', width: '100%',
          textAlign: 'center', position: 'relative',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1,
          }}
        >✕</button>

        <div style={{ fontSize: '52px', marginBottom: '20px' }}>🎉</div>

        <h2 style={{
          fontSize: '26px', fontWeight: 800, color: 'var(--text)',
          marginBottom: '12px', letterSpacing: '-0.03em',
        }}>
          Welcome to TradingLog Pro!
        </h2>

        <p style={{
          fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.7,
          marginBottom: '32px',
        }}>
          Your subscription is active. You now have unlimited trade logs,
          full analytics, and access to all features.
        </p>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          marginBottom: '32px', textAlign: 'left',
        }}>
          {[
            'Unlimited trade logs',
            'Full dashboard & analytics',
            'Confirmation analysis',
            'Missed trades tracking',
            'Screenshot uploads',
          ].map(feature => (
            <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'rgba(29,158,117,0.15)', color: '#1D9E75',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', flexShrink: 0,
              }}>✓</span>
              <span style={{ fontSize: '14px', color: 'var(--text)' }}>{feature}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: '50px',
            background: '#1D9E75', color: '#fff', border: 'none',
            fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          Start Trading
        </button>
      </div>
    </div>
  )
}
