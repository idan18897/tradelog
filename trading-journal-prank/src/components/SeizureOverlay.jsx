import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * SeizureOverlay — dramatic fake "domain seized" overlay.
 * Full-screen, blocks all interaction with the app underneath.
 * PRANK USE ONLY. Nothing here is real.
 *
 * Hidden on /landing so the public marketing page looks normal.
 * Shown on every other route — so any click that navigates away triggers it.
 */
export default function SeizureOverlay() {
  const location = useLocation()
  // Landing is the public "home" — let it load clean.
  if (location.pathname === '/landing' || location.pathname === '/landing/') {
    return null
  }
  return <OverlayInner />
}

function OverlayInner() {
  const [elapsed, setElapsed] = useState(0)
  const [logLines, setLogLines] = useState([])
  const [flash, setFlash] = useState(false)
  const [caseId] = useState(
    () =>
      'US-CY-' +
      Math.floor(100000 + Math.random() * 899999) +
      '-' +
      new Date().getFullYear()
  )
  const [ipAddr] = useState(
    () =>
      [
        Math.floor(Math.random() * 223) + 1,
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 254) + 1,
      ].join('.')
  )
  const logRef = useRef(null)

  // Tick timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Red flash strobe
  useEffect(() => {
    const id = setInterval(() => setFlash((f) => !f), 900)
    return () => clearInterval(id)
  }, [])

  // Rolling fake security log
  useEffect(() => {
    const templates = [
      '> establishing secure channel with law-enforcement-node-04 ...',
      '> HANDSHAKE OK :: cert=EXPIRED :: override=FORCED',
      '> dumping trades table ... 18,422 rows exfiltrated',
      '> dumping user_settings ... 2,109 rows exfiltrated',
      '> archiving auth.users ... COMPLETE',
      '> scanning /api/stripe-webhook for PII ... MATCHES: 412',
      '> customer financial data flagged for review',
      '> broadcasting to cyber-division gateway 10.44.x.x ...',
      '> CRYPTO KEYS REVOKED — supabase anon ::BURNED',
      '> closing outbound socket :: packet loss 0.00%',
      '> pushing forensic image to evidence locker #7 ...',
      '> 📁 snapshot stored :: /evidence/tradelog-*.img',
      '> WARN :: intrusion detection bypass active',
      '> WARN :: user session invalidated across all devices',
      '> syncing case file with federal registry ...',
      '> notifying affected users via registered email ...',
    ]

    let i = 0
    const id = setInterval(() => {
      setLogLines((prev) => {
        const next = [...prev, templates[i % templates.length]]
        i += 1
        return next.slice(-10)
      })
    }, 450)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logLines])

  // Swallow keyboard shortcuts (F5 etc.) so the prank feels properly stuck.
  // This is a prank — we're just preventing default on keys, nothing malicious.
  useEffect(() => {
    const onKey = (e) => {
      // allow devtools escape hatch (F12 / Ctrl+Shift+I)
      if (e.key === 'F12') return
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i')
        return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <>
      <style>{keyframesCss}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Security notice"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483647, // max 32-bit int — sits above literally everything
          background:
            'radial-gradient(ellipse at center, #2a0000 0%, #0a0000 70%, #000 100%)',
          color: '#ff2a2a',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
          overflow: 'hidden',
          userSelect: 'none',
          cursor: 'not-allowed',
          pointerEvents: 'auto',
          animation: 'sz-shake 0.18s infinite',
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* red flashing vignette */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: flash
              ? 'radial-gradient(ellipse at center, rgba(255,0,0,0.25) 0%, rgba(0,0,0,0) 60%)'
              : 'radial-gradient(ellipse at center, rgba(255,0,0,0.05) 0%, rgba(0,0,0,0) 60%)',
            transition: 'background 120ms linear',
            pointerEvents: 'none',
          }}
        />

        {/* scanlines */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,0,0,0.06) 0px, rgba(255,0,0,0.06) 1px, transparent 1px, transparent 3px)',
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />

        {/* faint rolling noise */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.08,
            background:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
            animation: 'sz-noise 0.9s steps(6) infinite',
            pointerEvents: 'none',
          }}
        />

        {/* top bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 22px',
            borderBottom: '2px solid #ff2a2a',
            background:
              'linear-gradient(180deg, rgba(255,0,0,0.12) 0%, rgba(0,0,0,0) 100%)',
            textTransform: 'uppercase',
            letterSpacing: 2,
            fontSize: 13,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: flash ? '#ff3a3a' : '#6a0000',
              boxShadow: flash ? '0 0 16px 4px #ff0000' : 'none',
              transition: 'all 120ms',
            }}
          />
          <span style={{ fontWeight: 700 }}>
            U.S. CYBER DIVISION — DOMAIN SEIZURE NOTICE
          </span>
          <span style={{ marginLeft: 'auto', opacity: 0.8 }}>
            CASE {caseId}
          </span>
        </div>

        {/* main panel */}
        <div
          style={{
            position: 'relative',
            maxWidth: 960,
            margin: '40px auto 0',
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              fontSize: 80,
              lineHeight: 1,
              marginBottom: 12,
              filter: 'drop-shadow(0 0 16px #ff0000)',
              animation: 'sz-pulse 1.2s ease-in-out infinite',
            }}
          >
            ⚠
          </div>

          <h1
            style={{
              fontSize: 'clamp(34px, 6vw, 64px)',
              fontWeight: 900,
              letterSpacing: 6,
              margin: 0,
              color: '#ff0000',
              textShadow:
                '0 0 2px #fff, 0 0 12px #ff0000, 0 0 28px #ff0000',
              animation: 'sz-glitch 2.5s infinite',
            }}
            data-text="THIS DOMAIN HAS BEEN SEIZED"
          >
            THIS DOMAIN HAS BEEN SEIZED
          </h1>

          <div
            style={{
              marginTop: 10,
              color: '#ffb3b3',
              letterSpacing: 3,
              fontSize: 14,
              textTransform: 'uppercase',
            }}
          >
            By order of the Joint Cyber-Financial Task Force
          </div>

          <div
            style={{
              marginTop: 28,
              padding: '18px 22px',
              border: '1px solid #661010',
              background: 'rgba(30,0,0,0.55)',
              color: '#ffdada',
              textAlign: 'left',
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            <div style={{ marginBottom: 10 }}>
              This website and its associated infrastructure have been
              suspended pursuant to an active investigation into unauthorized
              financial data processing.
            </div>
            <div style={{ marginBottom: 10, color: '#ff6a6a' }}>
              ALL USER DATA — including trade history, account credentials,
              uploaded screenshots, and payment records — has been copied to
              evidence servers and flagged for review.
            </div>
            <div style={{ color: '#ffd0d0' }}>
              Do not attempt to refresh, close, or navigate away from this
              page. Your session has been logged.
            </div>
          </div>

          {/* grid of fake telemetry */}
          <div
            style={{
              marginTop: 22,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
              textAlign: 'left',
              fontSize: 12,
            }}
          >
            <Stat label="Origin IP" value={ipAddr} />
            <Stat label="Locked For" value={`${mm}:${ss}`} blink />
            <Stat
              label="Records Exfiltrated"
              value={(18422 + elapsed * 37).toLocaleString()}
            />
            <Stat label="Threat Level" value="CRITICAL" blink />
            <Stat label="Case File" value={caseId} />
            <Stat label="Jurisdiction" value="FEDERAL / INTERNATIONAL" />
          </div>

          {/* live log terminal */}
          <div
            ref={logRef}
            style={{
              marginTop: 22,
              height: 160,
              overflow: 'hidden',
              border: '1px solid #661010',
              background: '#0a0000',
              color: '#ff7a7a',
              textAlign: 'left',
              fontSize: 12,
              padding: '10px 14px',
              lineHeight: 1.5,
              boxShadow: 'inset 0 0 40px rgba(255,0,0,0.15)',
            }}
          >
            {logLines.map((l, i) => (
              <div key={i} style={{ opacity: 0.6 + (i / logLines.length) * 0.4 }}>
                {l}
              </div>
            ))}
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 8,
                height: 14,
                marginLeft: 2,
                background: '#ff2a2a',
                animation: 'sz-cursor 1s steps(2) infinite',
                verticalAlign: 'middle',
              }}
            />
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 11,
              letterSpacing: 2,
              color: '#ff9a9a',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}
          >
            Title 18 U.S.C. §§ 981, 982, 1030 · 31 U.S.C. § 5317
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              letterSpacing: 1,
              color: '#7a1a1a',
            }}
          >
            Evidence transmission in progress — do not disconnect.
          </div>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, blink }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        border: '1px solid #4a0a0a',
        background: 'rgba(20,0,0,0.55)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2,
          color: '#ff8080',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'inherit',
          fontWeight: 700,
          color: '#ffdcdc',
          animation: blink ? 'sz-blink 1s steps(2) infinite' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}

const keyframesCss = `
@keyframes sz-shake {
  0%   { transform: translate(0, 0) }
  25%  { transform: translate(-1px, 1px) }
  50%  { transform: translate(1px, -1px) }
  75%  { transform: translate(-1px, -1px) }
  100% { transform: translate(1px, 1px) }
}
@keyframes sz-pulse {
  0%,100% { transform: scale(1); filter: drop-shadow(0 0 12px #ff0000) }
  50%     { transform: scale(1.08); filter: drop-shadow(0 0 28px #ff2a2a) }
}
@keyframes sz-blink {
  0%,100% { opacity: 1 }
  50%     { opacity: 0.3 }
}
@keyframes sz-cursor {
  0%,100% { opacity: 1 }
  50%     { opacity: 0 }
}
@keyframes sz-noise {
  0%   { transform: translate(0, 0) }
  25%  { transform: translate(-3%, 2%) }
  50%  { transform: translate(2%, -3%) }
  75%  { transform: translate(-2%, -2%) }
  100% { transform: translate(3%, 3%) }
}
@keyframes sz-glitch {
  0%,100% { text-shadow: 0 0 2px #fff, 0 0 12px #ff0000, 0 0 28px #ff0000 }
  20%     { text-shadow: -2px 0 #00fff0, 2px 0 #ff0040, 0 0 18px #ff0000 }
  40%     { text-shadow: 2px 0 #00fff0, -2px 0 #ff0040, 0 0 22px #ff0000 }
  60%     { text-shadow: 0 0 2px #fff, 0 0 12px #ff0000, 0 0 28px #ff0000 }
  80%     { text-shadow: -1px 1px #00fff0, 1px -1px #ff0040, 0 0 20px #ff0000 }
}
`
