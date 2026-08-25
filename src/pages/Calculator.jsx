import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUserSettings } from '../context/UserSettingsContext'
import { useIsMobile } from '../hooks/useIsMobile'

const INSTRUMENT_TYPES = [
  { key: 'forex',   label: '💱 Forex / Metals / Crypto', slLabel: 'SL (pips)',   sizeLabel: 'Lot Size',   sizeUnit: 'lots' },
  { key: 'stocks',  label: '📈 Stocks / ETFs',           slLabel: 'SL ($ / share)', sizeLabel: 'Shares',  sizeUnit: 'shares' },
  { key: 'indices', label: '📊 Indices / Futures',       slLabel: 'SL (points)', sizeLabel: 'Contracts',  sizeUnit: 'contracts' },
]

const FOREX_PAIRS = [
  { label: 'EURUSD / GBPUSD / AUDUSD / NZDUSD', pipValue: 10 },
  { label: 'USDJPY / USDCAD (approx.)', pipValue: 9.1 },
  { label: 'XAUUSD (Gold)', pipValue: 1 },
  { label: 'BTCUSD / Crypto', pipValue: 1 },
  { label: 'Custom pip value', pipValue: null },
]

function row(label, value, big, color) {
  return { label, value, big, color }
}

export default function Calculator() {
  const { accountSize: savedAccount } = useUserSettings()
  const isMobile = useIsMobile()

  const [instrType, setInstrType] = useState('forex')
  const [account, setAccount]     = useState('')
  const [riskPct, setRiskPct]     = useState('0.5')
  const [slPips, setSlPips]       = useState('')
  const [pipValue, setPipValue]   = useState('10')
  const [pairIdx, setPairIdx]     = useState(0)
  const [rr, setRr]               = useState('3')
  // stocks/indices
  const [pointValue, setPointValue] = useState('10')

  // Pre-fill account from settings
  useEffect(() => {
    if (savedAccount) setAccount(String(savedAccount))
  }, [savedAccount])

  // When pair changes, auto-fill pip value
  useEffect(() => {
    const pair = FOREX_PAIRS[pairIdx]
    if (pair?.pipValue !== null) setPipValue(String(pair.pipValue))
  }, [pairIdx])

  const accountNum  = parseFloat(account)  || 0
  const riskPctNum  = parseFloat(riskPct)  || 0
  const slNum       = parseFloat(slPips)   || 0
  const pipValNum   = parseFloat(pipValue) || 0
  const rrNum       = parseFloat(rr)       || 0
  const pvNum       = parseFloat(pointValue) || 0

  const riskDollar = accountNum * riskPctNum / 100

  let lotSize = null, potProfit = null, potProfitDollar = null

  if (instrType === 'forex') {
    if (slNum > 0 && pipValNum > 0) {
      lotSize = riskDollar / (slNum * pipValNum)
      potProfitDollar = riskDollar * rrNum
      potProfit = (potProfitDollar / accountNum) * 100
    }
  } else if (instrType === 'stocks') {
    if (slNum > 0) {
      lotSize = Math.floor(riskDollar / slNum)
      potProfitDollar = riskDollar * rrNum
      potProfit = (potProfitDollar / accountNum) * 100
    }
  } else if (instrType === 'indices') {
    if (slNum > 0 && pvNum > 0) {
      lotSize = riskDollar / (slNum * pvNum)
      potProfitDollar = riskDollar * rrNum
      potProfit = (potProfitDollar / accountNum) * 100
    }
  }

  const instr = INSTRUMENT_TYPES.find(i => i.key === instrType)

  const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '20px',
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '10px 13px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const labelStyle = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
    display: 'block',
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: isMobile ? '16px' : '28px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>Position Size Calculator</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Calculate your exact position size before every trade</p>
        </div>
        <Link to="/" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      {/* Instrument type toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
        {INSTRUMENT_TYPES.map(it => (
          <button
            key={it.key}
            onClick={() => setInstrType(it.key)}
            style={{
              padding: '11px 16px',
              borderRadius: '10px',
              border: instrType === it.key ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: instrType === it.key ? 'var(--accent-light)' : 'var(--card)',
              color: instrType === it.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >{it.label}</button>
        ))}
      </div>

      {/* Inputs */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>Inputs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>

          {/* Account Size */}
          <div>
            <label style={labelStyle}>Account Size ($)</label>
            <input
              type="number" value={account} onChange={e => setAccount(e.target.value)}
              placeholder="e.g. 10000" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Risk % */}
          <div>
            <label style={labelStyle}>Risk %</label>
            <input
              type="number" step="0.1" value={riskPct} onChange={e => setRiskPct(e.target.value)}
              placeholder="0.5" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            {accountNum > 0 && riskPctNum > 0 && (
              <p style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px', fontWeight: 600 }}>
                = ${riskDollar.toFixed(2)} at risk
              </p>
            )}
          </div>

          {/* SL */}
          <div>
            <label style={labelStyle}>{instr.slLabel}</label>
            <input
              type="number" step="any" value={slPips} onChange={e => setSlPips(e.target.value)}
              placeholder="e.g. 10" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Pip value (forex) / Point value (indices) */}
          {instrType === 'forex' && (
            <div>
              <label style={labelStyle}>Pip Value ($ per std lot)</label>
              <select
                value={pairIdx}
                onChange={e => setPairIdx(Number(e.target.value))}
                style={{ ...inputStyle, fontSize: '13px' }}
              >
                {FOREX_PAIRS.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
              {FOREX_PAIRS[pairIdx]?.pipValue === null && (
                <input
                  type="number" step="any" value={pipValue} onChange={e => setPipValue(e.target.value)}
                  placeholder="e.g. 10" style={{ ...inputStyle, marginTop: '8px' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              )}
            </div>
          )}

          {instrType === 'indices' && (
            <div>
              <label style={labelStyle}>Point Value ($ per contract per point)</label>
              <input
                type="number" step="any" value={pointValue} onChange={e => setPointValue(e.target.value)}
                placeholder="e.g. 20" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          {/* Target R:R */}
          <div>
            <label style={labelStyle}>Target R:R</label>
            <input
              type="number" step="0.5" value={rr} onChange={e => setRr(e.target.value)}
              placeholder="3" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

        </div>
      </div>

      {/* Results */}
      {lotSize !== null && accountNum > 0 ? (
        <div style={{ ...cardStyle, border: '2px solid var(--accent)', background: 'var(--accent-light)' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', marginBottom: '16px' }}>Results</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: instr.sizeLabel, value: instrType === 'stocks' ? String(Math.max(0, Math.floor(lotSize))) : lotSize.toFixed(instrType === 'indices' ? 2 : 3), unit: instr.sizeUnit, accent: true },
              { label: 'Risk Amount', value: `$${riskDollar.toFixed(2)}`, unit: `${riskPctNum}% of account` },
              { label: 'Pot. Profit', value: potProfitDollar ? `$${potProfitDollar.toFixed(2)}` : '--', unit: potProfit ? `+${potProfit.toFixed(2)}%` : '' },
            ].map(r => (
              <div key={r.label} style={{
                background: 'var(--card)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center',
                border: r.accent ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{r.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: r.accent ? 'var(--accent)' : '#30D158', letterSpacing: '-0.02em' }}>{r.value}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.unit}</p>
              </div>
            ))}
          </div>

          {instrType === 'forex' && lotSize !== null && (
            <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--card)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>Lot breakdown</p>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Standard lots (1.0)', val: lotSize.toFixed(3) },
                  { label: 'Mini lots (0.1)', val: (lotSize * 10).toFixed(2) },
                  { label: 'Micro lots (0.01)', val: (lotSize * 100).toFixed(1) },
                ].map(b => (
                  <div key={b.label}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{b.label}</p>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{b.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
          Fill in all fields above to see your position size
        </div>
      )}

      {/* Tips */}
      <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>💡 Tips</p>
        <p style={{ fontSize: '12px', color: 'var(--text-subtle)', lineHeight: 1.6 }}>
          {instrType === 'forex' && 'For XAUUSD, 1 pip = $0.01. For standard pairs like EURUSD, 1 pip = 0.0001. Pip value per standard lot = $10 for USD-quoted pairs.'}
          {instrType === 'stocks' && 'SL $ = distance between entry and stop loss price in dollars per share. Shares = Risk$ ÷ SL$.'}
          {instrType === 'indices' && 'Point value depends on the contract (e.g. ES = $50/pt, NQ = $20/pt, MNQ = $2/pt). Contracts = Risk$ ÷ (SL pts × point value).'}
        </p>
      </div>

    </div>
  )
}
