import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = ['Features', 'Pricing']

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: 'Trade Journal',
    desc: 'Log every trade with entry, SL, TP, confirmations, and screenshots. Full history with filters.',
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'Dashboard Analytics',
    desc: 'Equity curve, weekly P&L, win rate, profit factor, and performance by session, day, and hour.',
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    title: 'Confirmation Analysis',
    desc: 'Discover which setups win most. Analyze individual confirmations and their combinations.',
  },
  {
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Missed Trades Log',
    desc: 'Track opportunities you didn\'t take. Measure capture rate and see how much you left on the table.',
  },
]

const PLANS = [
  {
    name: 'Monthly',
    price: '$14.99',
    period: '/ month',
    highlight: false,
    features: [
      'Unlimited trade logs',
      'Full dashboard & analytics',
      'Confirmation analysis',
      'Missed trades tracking',
      'Screenshot uploads',
      'Cancel anytime',
    ],
    cta: 'Start Monthly',
  },
  {
    name: 'Yearly',
    price: '$99',
    period: '/ year',
    highlight: true,
    badge: 'BEST VALUE',
    features: [
      'Everything in Monthly',
      'Save ~$81 vs monthly',
      'Priority support',
      'Early access to new features',
    ],
    cta: 'Start Yearly',
  },
  {
    name: 'Lifetime',
    price: '$199',
    period: 'one-time',
    highlight: false,
    features: [
      'Everything in Yearly',
      'Pay once, use forever',
      'Lifetime updates',
      'No recurring charges',
    ],
    cta: 'Get Lifetime Access',
  },
]

const TESTIMONIALS = [
  {
    name: 'Lior M.',
    role: 'Forex Trader · 2 years',
    text: 'TradingLog completely changed how I review my trades. The confirmation analysis alone helped me cut losing setups by 40%.',
    avatar: 'LM',
  },
  {
    name: 'Sarah K.',
    role: 'Crypto Trader · 3 years',
    text: 'Finally a journal that doesn\'t feel like work. Clean UI, fast, and the equity curve keeps me accountable every single week.',
    avatar: 'SK',
  },
  {
    name: 'Noa R.',
    role: 'Gold & Indices · 1 year',
    text: 'The missed trades log was a game changer. I realized I was leaving more on the table than I was taking. Now I act on my setups.',
    avatar: 'NR',
  },
]

export default function Landing() {
  const [visible, setVisible] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setTimeout(() => setVisible(true), 60)
  }, [])

  async function handleCheckout(plan) {
    if (!user) {
      navigate('/login')
      return
    }
    setCheckoutLoading(plan)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: user.id, email: user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      // fallback: do nothing
    }
    setCheckoutLoading(null)
  }

  const s = {
    // shared
    btn: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '13px 28px', borderRadius: '50px', fontSize: '15px', fontWeight: 700,
      cursor: 'pointer', border: 'none', textDecoration: 'none', transition: 'all 0.18s',
      letterSpacing: '-0.01em',
    },
  }

  return (
    <div style={{
      background: '#0a0a0b',
      color: '#f5f5f7',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflowX: 'hidden',
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s ease both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.15s; }
        .fade-up-3 { animation-delay: 0.25s; }
        .fade-up-4 { animation-delay: 0.35s; }
        .fade-up-5 { animation-delay: 0.45s; }
        .landing-cta-primary:hover { background: #178a65 !important; transform: translateY(-1px); box-shadow: 0 8px 30px rgba(29,158,117,0.35) !important; }
        .landing-cta-secondary:hover { background: rgba(255,255,255,0.1) !important; }
        .feature-card:hover { background: rgba(255,255,255,0.06) !important; transform: translateY(-3px); border-color: rgba(29,158,117,0.5) !important; }
        .plan-card:hover { transform: translateY(-4px); }
        .nav-link:hover { color: #f5f5f7 !important; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; text-align: center; }
          .hero-actions { justify-content: center !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .hero-title { font-size: clamp(36px, 10vw, 56px) !important; }
          .mockup-wrap { display: none; }
          .nav-links { display: none !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '60px',
        background: 'rgba(10,10,11,0.8)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden' }}>
            <img src="/logo-light.png" alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em' }}>TradingLog</span>
        </div>
        <div className="nav-links" style={{ display: 'flex', gap: '32px' }}>
          {NAV_LINKS.map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} className="nav-link" style={{ fontSize: '14px', color: '#8e8e93', textDecoration: 'none', transition: 'color 0.15s' }}>{l}</a>
          ))}
        </div>
        <Link to="/login" style={{ ...s.btn, padding: '8px 18px', fontSize: '13px', background: 'rgba(255,255,255,0.08)', color: '#f5f5f7', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)' }}
          className="landing-cta-secondary">Sign In</Link>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: '120px', paddingBottom: '80px', padding: '120px 40px 80px' }}>
        <div className="hero-grid" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '60px', alignItems: 'center' }}>

          {/* Left */}
          <div className={visible ? '' : 'opacity-0'}>
            <div className="fade-up fade-up-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: '50px', padding: '5px 14px', marginBottom: '24px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1D9E75', letterSpacing: '0.04em' }}>BUILT FOR SERIOUS TRADERS</span>
            </div>
            <h1 className="fade-up fade-up-2 hero-title" style={{ fontSize: 'clamp(48px, 6vw, 74px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: '20px', color: '#f5f5f7' }}>
              Trade smarter.<br />
              <span style={{ color: '#1D9E75' }}>Journal better.</span>
            </h1>
            <p className="fade-up fade-up-3" style={{ fontSize: '17px', color: '#8e8e93', lineHeight: 1.6, marginBottom: '36px', maxWidth: '440px' }}>
              The trading journal that actually improves your performance. Track every trade, analyze your edge, and stop missing profitable setups.
            </p>
            <div className="fade-up fade-up-4 hero-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => handleCheckout('lifetime')} disabled={checkoutLoading === 'lifetime'} className="landing-cta-primary" style={{ ...s.btn, background: '#1D9E75', color: '#fff', boxShadow: '0 4px 20px rgba(29,158,117,0.25)' }}>
                {checkoutLoading === 'lifetime' ? 'Redirecting…' : 'Get Lifetime Access →'}
              </button>
              <a href="#features" className="landing-cta-secondary" style={{ ...s.btn, background: 'rgba(255,255,255,0.06)', color: '#f5f5f7', border: '1px solid rgba(255,255,255,0.1)' }}>
                See Features
              </a>
            </div>
            <div className="fade-up fade-up-5" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
              <span style={{ fontSize: '14px', letterSpacing: '0.02em' }}>⭐⭐⭐⭐⭐</span>
              <span style={{ fontSize: '13px', color: '#8e8e93' }}>Loved by <strong style={{ color: '#f5f5f7' }}>200+ traders</strong></span>
            </div>
            <p style={{ fontSize: '12px', color: '#48484a', marginTop: '8px' }}>No credit card required · Cancel anytime</p>
          </div>

          {/* Right — mockup */}
          <div className="mockup-wrap fade-up fade-up-3" style={{ position: 'relative' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(29,158,117,0.15) 0%, rgba(96,165,250,0.08) 100%)',
              borderRadius: '20px', padding: '3px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
            }}>
              <div style={{ background: '#1c1c1e', borderRadius: '18px', overflow: 'hidden', padding: '20px' }}>
                {/* Fake dashboard preview */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {['#f87171', '#facc15', '#4ade80'].map(c => <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  {[['Win Rate', '95.8%', '#4ade80'], ['Total P&L', '+84%', '#4ade80'], ['Avg R:R', '1:4.9', '#f5f5f7'], ['Trades', '24', '#f5f5f7']].map(([label, val, col]) => (
                    <div key={label} style={{ background: '#2c2c2e', borderRadius: '10px', padding: '12px' }}>
                      <p style={{ fontSize: '10px', color: '#8e8e93', marginBottom: '4px' }}>{label}</p>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: col }}>{val}</p>
                    </div>
                  ))}
                </div>
                {/* Fake chart bars */}
                <div style={{ background: '#2c2c2e', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                  <p style={{ fontSize: '10px', color: '#8e8e93', marginBottom: '8px' }}>Equity Curve</p>
                  <div style={{ height: '60px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                    {[20, 35, 28, 45, 42, 55, 52, 65, 70, 68, 80, 84].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(to top, #1D9E75, rgba(29,158,117,0.3))', borderRadius: '3px 3px 0 0' }} />
                    ))}
                  </div>
                </div>
                <div style={{ background: '#2c2c2e', borderRadius: '10px', padding: '10px' }}>
                  <p style={{ fontSize: '10px', color: '#8e8e93', marginBottom: '6px' }}>Recent Trades</p>
                  {[['EURUSD', 'Long', 'TP', '+2.5%', '#4ade80'], ['GBPUSD', 'Short', 'SL', '-0.5%', '#f87171'], ['XAUUSD', 'Long', 'TP', '+4.5%', '#4ade80']].map(([pair, dir, out, pnl, col]) => (
                    <div key={pair+dir} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '11px', color: '#f5f5f7', fontWeight: 600 }}>{pair}</span>
                      <span style={{ fontSize: '10px', color: '#8e8e93' }}>{dir}</span>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: col === '#4ade80' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', color: col }}>{out}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: col }}>{pnl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Glow */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '300px', height: '300px', background: 'rgba(29,158,117,0.12)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: -1 }} />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '80px 40px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D9E75', letterSpacing: '0.1em', marginBottom: '12px', textTransform: 'uppercase' }}>Features</p>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7', marginBottom: '12px' }}>Everything you need to grow</h2>
            <p style={{ fontSize: '16px', color: '#8e8e93', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>Built around the workflow of consistently profitable traders.</p>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature-card" style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '18px', padding: '28px', transition: 'all 0.2s',
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D9E75', marginBottom: '16px' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f5f5f7', marginBottom: '8px', letterSpacing: '-0.02em' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: '#8e8e93', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '80px 40px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D9E75', letterSpacing: '0.1em', marginBottom: '12px', textTransform: 'uppercase' }}>Pricing</p>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7', marginBottom: '12px' }}>Simple, transparent pricing</h2>
            <p style={{ fontSize: '16px', color: '#8e8e93' }}>Pick what works for you.</p>
          </div>
          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {PLANS.map(plan => (
              <div key={plan.name} className="plan-card" style={{
                background: plan.highlight ? 'rgba(29,158,117,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${plan.highlight ? 'rgba(29,158,117,0.4)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '20px', padding: '32px', transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}>
                {(plan.highlight || plan.badge) && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#1D9E75', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '50px', letterSpacing: '0.04em' }}>{plan.badge || 'POPULAR'}</div>
                )}
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#8e8e93', marginBottom: '8px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{plan.name}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '42px', fontWeight: 800, color: '#f5f5f7', letterSpacing: '-0.04em' }}>{plan.price}</span>
                  <span style={{ fontSize: '14px', color: '#8e8e93' }}>{plan.period}</span>
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#d1d1d6' }}>
                      <span style={{ color: '#1D9E75', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => handleCheckout(plan.name.toLowerCase())} disabled={checkoutLoading === plan.name.toLowerCase()} style={{
                  ...s.btn, width: '100%', boxSizing: 'border-box', marginTop: 'auto',
                  background: plan.highlight ? '#1D9E75' : 'rgba(255,255,255,0.07)',
                  color: plan.highlight ? '#fff' : '#f5f5f7',
                  border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: plan.highlight ? '0 4px 20px rgba(29,158,117,0.3)' : 'none',
                }} className={plan.highlight ? 'landing-cta-primary' : 'landing-cta-secondary'}>
                  {checkoutLoading === plan.name.toLowerCase() ? 'Redirecting…' : plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '80px 40px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1D9E75', letterSpacing: '0.1em', marginBottom: '12px', textTransform: 'uppercase' }}>Testimonials</p>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7', marginBottom: '12px' }}>Traders love it</h2>
            <p style={{ fontSize: '16px', color: '#8e8e93' }}>Real results from real traders.</p>
          </div>
          <div className="testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '18px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px',
              }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: '13px' }}>⭐</span>)}
                </div>
                <p style={{ fontSize: '15px', color: '#d1d1d6', lineHeight: 1.65, flex: 1 }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(29,158,117,0.18)', border: '1px solid rgba(29,158,117,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#1D9E75', flexShrink: 0 }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#f5f5f7', marginBottom: '2px' }}>{t.name}</p>
                    <p style={{ fontSize: '12px', color: '#8e8e93' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '80px 40px 100px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f5f5f7', marginBottom: '16px' }}>
            Ready to trade with an edge?
          </h2>
          <p style={{ fontSize: '16px', color: '#8e8e93', marginBottom: '36px', lineHeight: 1.6 }}>
            Join traders who use TradingLog to understand their performance and improve their results.
          </p>
          <button onClick={() => handleCheckout('lifetime')} disabled={checkoutLoading === 'lifetime'} className="landing-cta-primary" style={{ ...s.btn, background: '#1D9E75', color: '#fff', fontSize: '16px', padding: '15px 36px', boxShadow: '0 6px 28px rgba(29,158,117,0.3)' }}>
            {checkoutLoading === 'lifetime' ? 'Redirecting…' : 'Get Started Free →'}
          </button>
          <p style={{ fontSize: '12px', color: '#48484a', marginTop: '14px' }}>No credit card · Full access · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '24px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: '#48484a' }}>© 2026 TradingLog. All rights reserved.</span>
        <Link to="/login" style={{ fontSize: '13px', color: '#8e8e93', textDecoration: 'none' }}>Sign In →</Link>
      </footer>
    </div>
  )
}
