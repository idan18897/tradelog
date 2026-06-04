import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { useUserSettings } from '../context/UserSettingsContext'
import { useTheme } from '../context/ThemeContext'
import DatePicker from '../components/DatePicker'
import UpgradeModal from '../components/UpgradeModal'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DEFAULT_PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'USDCHF', 'AUDUSD', 'NAS100', 'US30', 'USOIL']

const DEFAULT_PAIRS_V2 = [
  { category: 'Forex', symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'] },
  { category: 'Metals', symbols: ['XAUUSD', 'XAGUSD'] },
  { category: 'Indices', symbols: ['US500', 'NQ100', 'DOW30', 'UK100', 'GER40'] },
  { category: 'Commodities', symbols: ['USOIL', 'NATGAS', 'COPPER'] },
  { category: 'Crypto', symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD'] },
  { category: 'Stocks', symbols: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'] },
  { category: 'ETFs', symbols: ['SPY', 'QQQ', 'GLD', 'TLT'] },
]

// Pip size per pair (1 pip = X price units)
const PIP_SIZES = {
  XAUUSD: 0.1,
  XAGUSD: 0.001,
  EURUSD: 0.0001,
  GBPUSD: 0.0001,
  USDJPY: 0.01,
  GBPJPY: 0.01,
  EURJPY: 0.01,
  AUDJPY: 0.01,
  CADJPY: 0.01,
  CHFJPY: 0.01,
  NZDJPY: 0.01,
  USDCHF: 0.0001,
  AUDUSD: 0.0001,
  NZDUSD: 0.0001,
  USDCAD: 0.0001,
  EURGBP: 0.0001,
  EURCAD: 0.0001,
  EURCHF: 0.0001,
  EURNZD: 0.0001,
  EURAUD: 0.0001,
  GBPCAD: 0.0001,
  GBPCHF: 0.0001,
  GBPNZD: 0.0001,
  GBPAUD: 0.0001,
  AUDCAD: 0.0001,
  AUDCHF: 0.0001,
  AUDNZD: 0.0001,
  CADCHF: 0.0001,
  NZDCAD: 0.0001,
  NZDCHF: 0.0001,
  NAS100: 1,
  US30: 1,
  SPX500: 1,
  DE30: 1,
  UK100: 1,
  JP225: 1,
  USOIL: 0.01,
  UKOIL: 0.01,
  BTCUSD: 1,
  ETHUSD: 0.1,
}

function getPipSize(pair) {
  if (!pair) return 0.0001
  const p = pair.toUpperCase()
  if (PIP_SIZES[p] !== undefined) return PIP_SIZES[p]
  // Smart fallback by pattern
  if (p.includes('JPY')) return 0.01
  if (p.includes('XAU')) return 0.1
  if (p.includes('XAG')) return 0.001
  if (p.includes('BTC') || p.includes('ETH')) return 1
  if (/NAS|US30|SPX|DAX|FTSE|CAC|NIK|DOW/.test(p)) return 1
  return 0.0001
}
const OUTCOMES = ['TP', 'Partial TP', 'SL', 'BE', 'Invalid', 'Open']

function StarRating({ value, onChange, readonly = false, size = 30 }) {
  const [hover, setHover] = useState(null)
  const display = hover !== null ? hover : (value || 0)

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '3px' }}
      onMouseLeave={() => !readonly && setHover(null)}
    >
      {[1, 2, 3, 4, 5].map(n => {
        const starVal = display >= n ? 1 : display >= n - 0.5 ? 0.5 : 0
        return (
          <div key={n} style={{ position: 'relative', width: size, height: size, cursor: readonly ? 'default' : 'pointer', flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
              <polygon
                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill="none" stroke="var(--border-strong)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            {starVal > 0 && (
              <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0 }}>
                <defs>
                  <clipPath id={`sc-${n}`}>
                    <rect x="0" y="0" width={starVal === 0.5 ? '12' : '24'} height="24" />
                  </clipPath>
                </defs>
                <polygon
                  points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                  fill="#FFD60A" stroke="#FFD60A" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  clipPath={`url(#sc-${n})`}
                />
              </svg>
            )}
            {!readonly && (
              <>
                <div
                  style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', zIndex: 1 }}
                  onMouseEnter={() => setHover(n - 0.5)}
                  onClick={() => onChange(value === n - 0.5 ? null : n - 0.5)}
                />
                <div
                  style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', zIndex: 1 }}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => onChange(value === n ? null : n)}
                />
              </>
            )}
          </div>
        )
      })}
      {value > 0 && (
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '8px', marginLeft: '4px' }}>
          {value}/5
        </span>
      )}
      {!readonly && value > 0 && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '11px', padding: '0 4px' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}


function getISOWeek(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function getDayName(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date(dateStr).getDay()]
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function currentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function computeRR(entry, sl, tp) {
  const e = parseFloat(entry)
  const s = parseFloat(sl)
  const tpVal = parseFloat(tp)
  if (!e || !s || !tpVal || e === s) return null
  const rr = Math.abs(tpVal - e) / Math.abs(e - s)
  return isNaN(rr) ? null : rr.toFixed(2)
}

// Screenshot upload zone component
function ScreenshotSlot({ label, preview, isActive, onActivate, onFile, onRemove, onPasteHint, dropRef, fileInputRef, inputStyle }) {
  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (dropRef.current) dropRef.current.style.borderColor = 'var(--accent)'
  }
  function handleDragLeave(e) {
    e.preventDefault()
    if (dropRef.current) dropRef.current.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)'
  }
  function handleDrop(e) {
    e.preventDefault()
    if (dropRef.current) dropRef.current.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)'
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onFile(file)
  }

  const borderColor = isActive ? 'var(--accent)' : 'var(--border)'
  const bgColor = isActive ? 'var(--accent-light)' : 'transparent'

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text)' }}>{label}</span>
        {isActive && (
          <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 8px', borderRadius: '20px' }}>
            ← Ctrl+V to paste
          </span>
        )}
      </div>

      {preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <img
            src={preview}
            alt={label}
            style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg)' }}
          />
          <button
            type="button"
            onClick={onRemove}
            style={{
              alignSelf: 'flex-start',
              fontSize: '12px',
              padding: '5px 12px',
              borderRadius: '7px',
              cursor: 'pointer',
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              color: '#f87171',
            }}
          >
            הסר תמונה
          </button>
        </div>
      ) : (
        <div
          ref={dropRef}
          onClick={() => { onActivate(); fileInputRef.current?.click() }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isActive ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: '14px',
            padding: '28px 16px',
            background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p style={{ fontSize: '12px', color: isActive ? 'var(--accent)' : 'var(--text-muted)', textAlign: 'center' }}>
            Drag, click, or paste (Ctrl+V)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => onFile(e.target.files[0])}
          />
        </div>
      )}
    </div>
  )
}

const DragHandle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
)

function SortableSection({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative' }}>
      <div
        {...attributes} {...listeners}
        style={{ position: 'absolute', top: '14px', right: '14px', cursor: 'grab', color: 'var(--text-subtle)', zIndex: 10, padding: '4px', borderRadius: '4px', lineHeight: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-subtle)'}
      >
        <DragHandle />
      </div>
      {children}
    </div>
  )
}

const DEFAULT_SECTION_ORDER = ['basic', 'direction', 'prices', 'confirmations', 'outcome', 'sl_to_be', 'missed', 'rating', 'notes', 'screenshots']

export default function TradeForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const location = useLocation()
  const duplicateData = !isEditing ? location.state?.duplicate : null
  const { user } = useAuth()
  const { t } = useLang()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { plan, continuationEnabled, continuationWindowDays, longColor, shortColor } = useUserSettings()
  const { theme } = useTheme()
  // Ensure direction colors are visible in light mode (darken if too light)
  function visibleColor(hex) {
    if (theme === 'dark' || !hex?.startsWith('#') || hex.length < 7) return hex
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return lum > 0.6 ? `rgb(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)})` : hex
  }
  const longVis = visibleColor(longColor)
  const shortVis = visibleColor(shortColor)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const [formData, setFormData] = useState({
    date: today(),
    time: currentTime(),
    exit_time: '',
    pair: 'XAUUSD',
    direction: 'Long',
    entry: '',
    sl: '',
    tp: '',
    sl_pips: '',
    risk_pct: '0.5',
    confirmations: [],
    outcome: 'Open',
    notes: '',
    rating: null,
    trade_type: 'live',
    missed_reason: '',
    sl_to_be: false,
    be_at: 3,
    exit_levels: [],
    exit_mode_name: '',
    pot_rr: '',
    shares: '',
    contracts: '',
    point_value: '',
    is_continuation: false,
    parent_trade_id: null,
    mood: null,
    setup_quality: null,
    rule_violated: false,
    rule_violation_notes: '',
  })
  const [exitModes, setExitModes] = useState([
    { name: 'Standard', be_at: 3, levels: [{ pct: 50, rr: 3 }] }
  ])
  const [confirmationsList, setConfirmationsList] = useState([])
  const [pairsList, setPairsList] = useState(DEFAULT_PAIRS)
  const [pairsV2, setPairsV2] = useState(DEFAULT_PAIRS_V2)
  const [instrumentType, setInstrumentType] = useState('forex')
  const [parentTrades, setParentTrades] = useState([])
  const [pairSearch, setPairSearch] = useState('')
  const [showPairDrop, setShowPairDrop] = useState(false)
  const pairDropRef = useRef(null)

  // HTF screenshot
  const [htfFile, setHtfFile] = useState(null)
  const [htfPreview, setHtfPreview] = useState(null)
  const [existingHtf, setExistingHtf] = useState(null)
  const htfInputRef = useRef(null)
  const htfDropRef = useRef(null)

  // LTF screenshot
  const [ltfFile, setLtfFile] = useState(null)
  const [ltfPreview, setLtfPreview] = useState(null)
  const [existingLtf, setExistingLtf] = useState(null)
  const ltfInputRef = useRef(null)
  const ltfDropRef = useRef(null)

  // Which slot receives paste (null = none, 'htf', 'ltf')
  const [activeSlot, setActiveSlot] = useState(null)

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(false)

  // Templates
  const [templates, setTemplates] = useState([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [showLoadDropdown, setShowLoadDropdown] = useState(false)
  const loadDropdownRef = useRef(null)

  const [sectionOrder, setSectionOrder] = useState(() => {
    try { const s = localStorage.getItem('tradeFormSectionOrder'); return s ? JSON.parse(s) : DEFAULT_SECTION_ORDER } catch { return DEFAULT_SECTION_ORDER }
  })
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  async function handleSectionDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const next = arrayMove(sectionOrder, sectionOrder.indexOf(active.id), sectionOrder.indexOf(over.id))
    setSectionOrder(next)
    localStorage.setItem('tradeFormSectionOrder', JSON.stringify(next))
    await supabase.from('user_settings').upsert(
      { user_id: user.id, form_section_order: next },
      { onConflict: 'user_id' }
    )
  }

  // Paste from clipboard handler
  useEffect(() => {
    function handlePaste(e) {
      if (!activeSlot) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (!blob) continue
          const file = new File([blob], `paste-${Date.now()}.png`, { type: blob.type })
          if (activeSlot === 'htf') handleHtfFile(file)
          else handleLtfFile(file)
          break
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [activeSlot])

  useEffect(() => {
    function handleClickOutside(e) {
      if (loadDropdownRef.current && !loadDropdownRef.current.contains(e.target)) {
        setShowLoadDropdown(false)
      }
      if (pairDropRef.current && !pairDropRef.current.contains(e.target)) {
        setShowPairDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function init() {
      await Promise.all([fetchConfirmations(), fetchUserSettings(), fetchTemplates()])
      if (isEditing) await fetchTrade()
      else if (duplicateData) {
        setFormData({
          date: today(),
          time: duplicateData.time || currentTime(),
          exit_time: '',
          pair: duplicateData.pair || 'XAUUSD',
          direction: duplicateData.direction || 'Long',
          entry: duplicateData.entry?.toString() || '',
          sl: duplicateData.sl?.toString() || '',
          tp: duplicateData.tp?.toString() || '',
          sl_pips: duplicateData.sl_pips?.toString() || '',
          risk_pct: duplicateData.risk_pct?.toString() || '0.5',
          confirmations: duplicateData.confirmations || [],
          outcome: 'Open',
          notes: duplicateData.notes || '',
          rating: duplicateData.rating || null,
          mood: duplicateData.mood || null,
          setup_quality: duplicateData.setup_quality || null,
          rule_violated: duplicateData.rule_violated || false,
          rule_violation_notes: duplicateData.rule_violation_notes || '',
          trade_type: duplicateData.trade_type || 'live',
          missed_reason: duplicateData.missed_reason || '',
          sl_to_be: duplicateData.sl_to_be || false,
          be_at: duplicateData.be_at || 3,
          exit_levels: duplicateData.exit_levels || [],
          exit_mode_name: '',
          pot_rr: duplicateData.pot_rr?.toString() || '',
        })
      }
      setFetching(false)
      setTimeout(() => setVisible(true), 10)
    }
    init()
  }, [id])

  async function fetchUserSettings() {
    const { data } = await supabase
      .from('user_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (data) {
      if (data.pairs_v2?.length) {
        setPairsV2(data.pairs_v2)
        const flat = data.pairs_v2.flatMap(c => c.symbols)
        setPairsList(flat)
        if (!isEditing && !duplicateData) {
          setFormData(prev => ({ ...prev, pair: flat.includes(prev.pair) ? prev.pair : flat[0] || prev.pair }))
        }
      } else if (data.pairs?.length) {
        setPairsList(data.pairs)
        if (!isEditing && !duplicateData) {
          setFormData(prev => ({ ...prev, pair: data.pairs.includes(prev.pair) ? prev.pair : data.pairs[0] }))
        }
      }
      if (!isEditing && data.default_risk_pct) {
        setFormData(prev => ({ ...prev, risk_pct: data.default_risk_pct.toString() }))
      }
      if (!isEditing && !duplicateData && data.default_pair) {
        setFormData(prev => ({ ...prev, pair: data.default_pair }))
      }
      if (!isEditing && data.default_outcome) {
        setFormData(prev => ({ ...prev, outcome: data.default_outcome }))
      }
      if (!isEditing && !duplicateData && data.instrument_type) {
        setInstrumentType(data.instrument_type)
      }
      if (data.exit_modes?.length) setExitModes(data.exit_modes)
      if (data.form_section_order?.length) {
        setSectionOrder(data.form_section_order)
        localStorage.setItem('tradeFormSectionOrder', JSON.stringify(data.form_section_order))
      }
    }
  }

  async function fetchConfirmations() {
    const { data } = await supabase
      .from('confirmations_library')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
    setConfirmationsList(data || [])
  }

  async function fetchTrade() {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (error || !data) {
      navigate('/journal')
      return
    }
    setFormData({
      date: data.date || today(),
      time: data.time || currentTime(),
      exit_time: data.exit_time || '',
      pair: data.pair || 'XAUUSD',
      direction: data.direction || 'Long',
      entry: data.entry?.toString() || '',
      sl: data.sl?.toString() || '',
      tp: data.tp?.toString() || '',
      sl_pips: data.sl_pips?.toString() || '',
      risk_pct: data.risk_pct?.toString() || '0.5',
      confirmations: data.confirmations || [],
      outcome: data.outcome || 'Open',
      notes: data.notes || '',
      rating: data.rating || null,
      mood: data.mood || null,
      setup_quality: data.setup_quality || null,
      rule_violated: data.rule_violated || false,
      rule_violation_notes: data.rule_violation_notes || '',
      trade_type: data.trade_type || 'live',
      missed_reason: data.missed_reason || '',
      sl_to_be: data.sl_to_be || false,
      be_at: data.be_at || 3,
      exit_levels: data.exit_levels || [],
      exit_mode_name: '',
      pot_rr: data.pot_rr?.toString() || '',
      shares: data.shares?.toString() || '',
      contracts: data.contracts?.toString() || '',
      point_value: data.point_value?.toString() || '',
      is_continuation: data.is_continuation || false,
      parent_trade_id: data.parent_trade_id || null,
    })
    if (data.instrument_type) setInstrumentType(data.instrument_type)
    if (data.screenshot_url) {
      setExistingHtf(data.screenshot_url)
      setHtfPreview(data.screenshot_url)
    }
    if (data.ltf_screenshot_url) {
      setExistingLtf(data.ltf_screenshot_url)
      setLtfPreview(data.ltf_screenshot_url)
    }
    setFetching(false)
    setTimeout(() => setVisible(true), 10)
  }

  // Fetch eligible parent trades (same pair + direction, within window days)
  useEffect(() => {
    if (!formData.is_continuation || !continuationEnabled) { setParentTrades([]); return }
    const windowDays = continuationWindowDays || 1
    const dateFrom = new Date(formData.date)
    dateFrom.setDate(dateFrom.getDate() - windowDays)
    const fromStr = dateFrom.toISOString().split('T')[0]
    supabase
      .from('trades')
      .select('id, date, time, pair, direction, outcome, rr_potential, pot_rr')
      .eq('user_id', user.id)
      .eq('pair', formData.pair)
      .eq('direction', formData.direction)
      .eq('trade_type', 'live')
      .gte('date', fromStr)
      .lt('date', formData.date)
      .neq('is_continuation', true)
      .order('date', { ascending: false })
      .then(({ data }) => setParentTrades(data || []))
  }, [formData.is_continuation, formData.pair, formData.direction, formData.date, continuationEnabled, continuationWindowDays])

  const rr = computeRR(formData.entry, formData.sl, formData.tp)

  // Auto-calculate SL pips when entry or SL changes
  useEffect(() => {
    const entry = parseFloat(formData.entry)
    const sl = parseFloat(formData.sl)
    if (!entry || !sl || isNaN(entry) || isNaN(sl) || entry === sl) return
    const pipSize = getPipSize(formData.pair)
    const pips = Math.abs(entry - sl) / pipSize
    setFormData(prev => ({ ...prev, sl_pips: pips.toFixed(1) }))
  }, [formData.entry, formData.sl, formData.pair])

  function handleField(name, value) {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  function toggleConfirmation(label) {
    setFormData(prev => ({
      ...prev,
      confirmations: prev.confirmations.includes(label)
        ? prev.confirmations.filter(c => c !== label)
        : [...prev.confirmations, label],
    }))
  }

  function handleHtfFile(file) {
    if (!file) return
    setHtfFile(file)
    const reader = new FileReader()
    reader.onload = e => setHtfPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  function handleLtfFile(file) {
    if (!file) return
    setLtfFile(file)
    const reader = new FileReader()
    reader.onload = e => setLtfPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  async function uploadImage(file, slot) {
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/${slot}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('screenshots')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw new Error(`שגיאת העלאה (${slot}): ${error.message}`)
    const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(path)
    return urlData.publicUrl
  }

  async function fetchTemplates() {
    const { data } = await supabase
      .from('trade_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function saveTemplate() {
    if (!templateName.trim()) return
    setTemplateSaving(true)
    const data = {
      pair: formData.pair,
      direction: formData.direction,
      confirmations: formData.confirmations,
      risk_pct: formData.risk_pct,
      exit_levels: formData.exit_levels,
      sl_to_be: formData.sl_to_be,
      be_at: formData.be_at,
      pot_rr: formData.pot_rr,
    }
    const { data: saved, error } = await supabase
      .from('trade_templates')
      .insert({ user_id: user.id, name: templateName.trim(), data })
      .select()
      .single()
    setTemplateSaving(false)
    if (!error && saved) {
      setTemplates(prev => [saved, ...prev])
      setShowSaveModal(false)
      setTemplateName('')
    }
  }

  function applyTemplate(template) {
    const d = template.data
    setFormData(prev => ({
      ...prev,
      pair: d.pair || prev.pair,
      direction: d.direction || prev.direction,
      confirmations: d.confirmations || [],
      risk_pct: d.risk_pct?.toString() || prev.risk_pct,
      exit_levels: d.exit_levels || [],
      sl_to_be: d.sl_to_be || false,
      be_at: d.be_at || 3,
      pot_rr: d.pot_rr?.toString() || '',
    }))
    setShowLoadDropdown(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Free tier: max 10 live trades
    if (!isEditing && plan === 'free') {
      const { count } = await supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('trade_type', 'live')
      if (count >= 10) {
        setShowUpgradeModal(true)
        return
      }
    }

    setLoading(true)

    try {
      let screenshot_url = existingHtf || null
      let ltf_screenshot_url = existingLtf || null

      if (htfFile) screenshot_url = await uploadImage(htfFile, 'htf')
      if (ltfFile) ltf_screenshot_url = await uploadImage(ltfFile, 'ltf')

      const rrVal = computeRR(formData.entry, formData.sl, formData.tp)
      const payload = {
        user_id: user.id,
        date: formData.date,
        day: getDayName(formData.date),
        time: formData.time,
        exit_time: formData.exit_time || null,
        pair: formData.pair,
        direction: formData.direction,
        entry: formData.entry ? parseFloat(formData.entry) : null,
        sl: formData.sl ? parseFloat(formData.sl) : null,
        tp: formData.tp ? parseFloat(formData.tp) : null,
        sl_pips: formData.sl_pips ? parseFloat(formData.sl_pips) : null,
        rr_potential: rrVal ? parseFloat(rrVal) : null,
        pot_rr: formData.pot_rr ? parseFloat(formData.pot_rr) : null,
        risk_pct: formData.risk_pct ? parseFloat(formData.risk_pct) : 0.5,
        confirmations: formData.confirmations,
        outcome: formData.outcome,
        notes: formData.notes,
        rating: formData.rating || null,
        screenshot_url,
        ltf_screenshot_url,
        week_number: getISOWeek(formData.date),
        trade_type: formData.trade_type,
        missed_reason: formData.trade_type === 'missed' ? formData.missed_reason : null,
        sl_to_be: formData.sl_to_be,
        be_at: formData.sl_to_be ? formData.be_at : null,
        exit_levels: formData.sl_to_be && formData.exit_levels.length ? formData.exit_levels : null,
        instrument_type: instrumentType,
        shares: instrumentType === 'stocks' && formData.shares ? parseFloat(formData.shares) : null,
        contracts: instrumentType === 'indices' && formData.contracts ? parseFloat(formData.contracts) : null,
        point_value: instrumentType === 'indices' && formData.point_value ? parseFloat(formData.point_value) : null,
        is_continuation: formData.is_continuation || false,
        parent_trade_id: formData.is_continuation && formData.parent_trade_id ? formData.parent_trade_id : null,
        mood: formData.mood || null,
        setup_quality: formData.setup_quality || null,
        rule_violated: formData.rule_violated || false,
        rule_violation_notes: formData.rule_violated ? (formData.rule_violation_notes || '') : null,
      }

      if (isEditing) {
        const { error } = await supabase.from('trades').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('trades').insert(payload)
        if (error) throw error
      }

      navigate('/journal')
    } catch (err) {
      setError(err.message || 'אירעה שגיאה')
    } finally {
      setLoading(false)
    }
  }

  // 24-hour time helpers
  const timeHours = formData.time ? formData.time.split(':')[0] : '00'
  const timeMinutes = formData.time ? formData.time.split(':')[1] : '00'

  function setTimeHours(h) {
    const hh = String(Math.min(23, Math.max(0, parseInt(h) || 0))).padStart(2, '0')
    handleField('time', `${hh}:${timeMinutes}`)
  }
  function setTimeMinutes(m) {
    const mm = String(Math.min(59, Math.max(0, parseInt(m) || 0))).padStart(2, '0')
    handleField('time', `${timeHours}:${mm}`)
  }

  // Exit time helpers
  const exitTimeHours = formData.exit_time ? formData.exit_time.split(':')[0] : ''
  const exitTimeMinutes = formData.exit_time ? formData.exit_time.split(':')[1] : ''

  function setExitTimeHours(h) {
    const hh = String(Math.min(23, Math.max(0, parseInt(h) || 0))).padStart(2, '0')
    handleField('exit_time', `${hh}:${exitTimeMinutes || '00'}`)
  }
  function setExitTimeMinutes(m) {
    const mm = String(Math.min(59, Math.max(0, parseInt(m) || 0))).padStart(2, '0')
    handleField('exit_time', `${exitTimeHours || '00'}:${mm}`)
  }

  const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    padding: '22px',
    boxShadow: 'var(--shadow-md)',
  }

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text)',
    borderRadius: '10px',
    padding: '9px 13px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    letterSpacing: '-0.01em',
  }

  const labelStyle = {
    color: 'var(--text-muted)',
    fontSize: '13px',
    marginBottom: '6px',
    display: 'block',
  }

  if (fetching) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div
      className={`page-wrap transition-all duration-300 ${visible ? 'fade-in' : 'opacity-0'}`}
      style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}
    >
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      {/* Save Template Modal */}
      {showSaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowSaveModal(false)}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
            padding: '24px', width: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>Save as Template</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Saves: pair, direction, confirmations, risk, exit levels
            </p>
            <input
              autoFocus
              type="text"
              placeholder="Template name..."
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTemplate()}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '14px',
                background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box', marginBottom: '14px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={saveTemplate}
                disabled={!templateName.trim() || templateSaving}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: !templateName.trim() || templateSaving ? 0.5 : 1,
                }}
              >{templateSaving ? 'Saving...' : 'Save'}</button>
              <button
                onClick={() => { setShowSaveModal(false); setTemplateName('') }}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px', fontSize: '14px',
                  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
          {isEditing ? t.editTradeTitle : t.newTradeTitle}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              style={{
                fontSize: '13px', padding: '7px 14px', borderRadius: '8px',
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              Save as Template
            </button>
          )}
          <button
            onClick={() => navigate('/journal')}
            style={{
              fontSize: '13px', padding: '7px 14px', borderRadius: '8px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            {t.cancel}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Live / Missed toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {['live', 'missed'].map(type => (
            <button
              key={type}
              type="button"
              onClick={() => handleField('trade_type', type)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                border: `2px solid ${formData.trade_type === type
                  ? type === 'live' ? 'var(--accent)' : '#f59e0b'
                  : 'var(--border)'}`,
                background: formData.trade_type === type
                  ? type === 'live' ? 'var(--accent-light)' : 'rgba(245,158,11,0.1)'
                  : 'transparent',
                color: formData.trade_type === type
                  ? type === 'live' ? 'var(--accent)' : '#f59e0b'
                  : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {type === 'live' ? <><span style={{ color: '#ef4444' }}>●</span> Live Trade</> : '◎ Missed Trade'}
            </button>
          ))}
        </div>

        {/* Continuation Trade toggle — only shown if feature is enabled in Settings */}
        {continuationEnabled && formData.trade_type === 'live' && (
          <div style={{
            padding: '12px 14px', borderRadius: '12px',
            border: `1px solid ${formData.is_continuation ? 'rgba(129,140,248,0.4)' : 'var(--border)'}`,
            background: formData.is_continuation ? 'rgba(129,140,248,0.08)' : 'transparent',
            transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.is_continuation ? '12px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = !formData.is_continuation
                    handleField('is_continuation', next)
                    if (!next) handleField('parent_trade_id', null)
                  }}
                  style={{
                    width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                    background: formData.is_continuation ? '#818cf8' : 'var(--border-strong)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '3px',
                    left: formData.is_continuation ? '21px' : '3px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: formData.is_continuation ? '#818cf8' : 'var(--text-muted)' }}>
                    Continuation Trade
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginLeft: '8px' }}>
                    follows an existing {formData.direction} setup on {formData.pair}
                  </span>
                </div>
              </div>
              {formData.is_continuation && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(129,140,248,0.15)', color: '#818cf8', letterSpacing: '0.04em' }}>
                  CONT
                </span>
              )}
            </div>

            {/* Parent trade dropdown */}
            {formData.is_continuation && (
              <div>
                <label style={{ ...labelStyle, color: '#818cf8', marginBottom: '6px', display: 'block' }}>Original Trade</label>
                {parentTrades.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
                    No matching {formData.direction} trades on {formData.pair} in the last {continuationWindowDays} day{continuationWindowDays !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <select
                    value={formData.parent_trade_id || ''}
                    onChange={e => handleField('parent_trade_id', e.target.value || null)}
                    style={{ ...inputStyle, borderColor: formData.parent_trade_id ? '#818cf8' : 'var(--input-border)' }}
                  >
                    <option value="">— Select original trade —</option>
                    {parentTrades.map(pt => (
                      <option key={pt.id} value={pt.id}>
                        {pt.date} · {pt.pair} {pt.direction} · {pt.outcome || 'Open'}{pt.rr_potential || pt.pot_rr ? ` · 1:${pt.pot_rr || pt.rr_potential}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {/* Instrument type toggle */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'forex', label: '💱 Forex', sub: 'Metals · Crypto' },
            { key: 'stocks', label: '📈 Stocks', sub: 'ETFs' },
            { key: 'indices', label: '📊 Indices', sub: 'Futures' },
          ].map(({ key, label, sub }) => (
            <button
              key={key}
              type="button"
              onClick={() => setInstrumentType(key)}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                border: `1px solid ${instrumentType === key ? 'var(--border-strong)' : 'var(--border)'}`,
                background: instrumentType === key ? 'var(--card-hover)' : 'transparent',
                color: instrumentType === key ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              <div>{label}</div>
              <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.6, marginTop: '1px' }}>{sub}</div>
            </button>
          ))}
        </div>

        {/* Load Template dropdown */}
        {templates.length > 0 && (
          <div ref={loadDropdownRef} style={{ position: 'relative', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setShowLoadDropdown(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                background: showLoadDropdown ? 'var(--card-hover)' : 'var(--bg)',
                border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer',
                width: '100%', justifyContent: 'space-between',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
                Load Template
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showLoadDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showLoadDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                zIndex: 100, overflow: 'hidden',
              }}>
                {templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    style={{
                      width: '100%', padding: '11px 14px', textAlign: 'left', background: 'none',
                      border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{tmpl.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {tmpl.data.pair} · {tmpl.data.direction}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
            {sectionOrder.map(sectionId => {
              if (sectionId === 'confirmations' && confirmationsList.length === 0) return null
              if (sectionId === 'missed' && formData.trade_type !== 'missed') return null
              return (
                <SortableSection key={sectionId} id={sectionId}>
                  {sectionId === 'basic' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.basicDetails}</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 160px 160px 2fr', gap: '14px' }}>
                        <div>
                          <label style={labelStyle}>{t.date}</label>
                          <DatePicker value={formData.date} onChange={val => handleField('date', val)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Entry Time</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="number" min="0" max="23" value={parseInt(timeHours, 10)} onChange={e => setTimeHours(e.target.value)} style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '8px 6px' }} placeholder="HH" />
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>:</span>
                            <input type="number" min="0" max="59" value={parseInt(timeMinutes, 10)} onChange={e => setTimeMinutes(e.target.value)} style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '8px 6px' }} placeholder="MM" />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Exit Time</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="number" min="0" max="23" value={exitTimeHours !== '' ? parseInt(exitTimeHours, 10) : ''} onChange={e => setExitTimeHours(e.target.value)} style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '8px 6px' }} placeholder="HH" />
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>:</span>
                            <input type="number" min="0" max="59" value={exitTimeMinutes !== '' ? parseInt(exitTimeMinutes, 10) : ''} onChange={e => setExitTimeMinutes(e.target.value)} style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '8px 6px' }} placeholder="MM" />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>{t.pair}</label>
                          <div ref={pairDropRef} style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => { setShowPairDrop(o => !o); setPairSearch('') }}
                              style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}
                            >
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '14px' }}>{formData.pair}</span>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showPairDrop ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                            {showPairDrop && (
                              <div style={{
                                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
                                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '300px', display: 'flex', flexDirection: 'column',
                              }}>
                                <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={pairSearch}
                                    onChange={e => setPairSearch(e.target.value)}
                                    placeholder="Search symbol..."
                                    style={{ ...inputStyle, padding: '7px 10px', fontSize: '13px', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                  {(() => {
                                    const q = pairSearch.toLowerCase()
                                    const hasResults = pairsV2.some(cat => cat.symbols.some(s => s.toLowerCase().includes(q)))
                                    if (!hasResults) return <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No symbols found</div>
                                    return pairsV2.map((cat, ci) => {
                                      const filtered = cat.symbols.filter(s => s.toLowerCase().includes(q))
                                      if (filtered.length === 0) return null
                                      return (
                                        <div key={ci}>
                                          <div style={{ padding: '6px 12px 3px', fontSize: '10px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--bg-secondary)' }}>
                                            {cat.category}
                                          </div>
                                          {filtered.map(sym => (
                                            <button
                                              key={sym}
                                              type="button"
                                              onClick={() => { handleField('pair', sym); setShowPairDrop(false); setPairSearch('') }}
                                              style={{
                                                width: '100%', padding: '8px 14px', textAlign: 'left',
                                                background: formData.pair === sym ? 'var(--accent-light)' : 'none',
                                                border: 'none', cursor: 'pointer',
                                                fontSize: '13px', fontWeight: 600, fontFamily: 'monospace',
                                                color: formData.pair === sym ? 'var(--accent)' : 'var(--text)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                              }}
                                              onMouseEnter={e => { if (formData.pair !== sym) e.currentTarget.style.background = 'var(--card-hover)' }}
                                              onMouseLeave={e => { if (formData.pair !== sym) e.currentTarget.style.background = 'none' }}
                                            >
                                              {sym}
                                              {formData.pair === sym && <span style={{ fontSize: '10px' }}>✓</span>}
                                            </button>
                                          ))}
                                        </div>
                                      )
                                    })
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {sectionId === 'direction' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.direction}</h2>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['Long', 'Short'].map(dir => (
                          <button key={dir} type="button" onClick={() => handleField('direction', dir)} style={{ flex: 1, padding: '10px', minHeight: '48px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: formData.direction === dir ? `${dir === 'Long' ? longVis : shortVis}22` : 'var(--bg)', border: `2px solid ${formData.direction === dir ? (dir === 'Long' ? longVis : shortVis) : 'var(--border)'}`, color: formData.direction === dir ? (dir === 'Long' ? longVis : shortVis) : 'var(--text-muted)' }}>
                            {dir}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {sectionId === 'prices' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.prices}</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px' }} className="md:grid-cols-3">
                        <div><label style={labelStyle}>{t.entry}</label><input type="number" step="any" value={formData.entry} onChange={e => handleField('entry', e.target.value)} style={inputStyle} placeholder="0.00000" /></div>
                        <div><label style={labelStyle}>SL</label><input type="number" step="any" value={formData.sl} onChange={e => handleField('sl', e.target.value)} style={inputStyle} placeholder="0.00000" /></div>
                        <div><label style={labelStyle}>TP</label><input type="number" step="any" value={formData.tp} onChange={e => handleField('tp', e.target.value)} style={inputStyle} placeholder="0.00000" /></div>
                        <div><label style={labelStyle}>R:R</label><input readOnly value={rr ? `1:${rr}` : '--'} style={{ ...inputStyle, color: rr ? 'var(--accent)' : 'var(--text-muted)', cursor: 'default', opacity: 0.8 }} /></div>
                        <div><label style={labelStyle}>Potential R:R</label><input type="number" step="0.1" min="0" placeholder="1:?" value={formData.pot_rr} onChange={e => handleField('pot_rr', e.target.value)} style={inputStyle} /></div>
                        {formData.trade_type === 'missed' && (rr || formData.pot_rr) && parseFloat(rr || formData.pot_rr) > 0 && (() => {
                          const fullRR = parseFloat(rr || formData.pot_rr)
                          const risk = parseFloat(formData.risk_pct || 0.5)
                          const isPartial = formData.outcome === 'Partial TP'
                          let gain = 0
                          if (formData.sl_to_be && formData.exit_levels?.length) {
                            // Always count exit levels (taken at partial)
                            let rem = 100
                            for (const lv of formData.exit_levels) { gain += (lv.pct / 100) * lv.rr * risk; rem -= lv.pct }
                            // Partial TP = remaining hit BE (0), TP = remaining runs to target
                            if (!isPartial) gain += (rem / 100) * fullRR * risk
                          } else {
                            gain = isPartial ? fullRR * risk * 0.5 : fullRR * risk
                          }
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', gridColumn: isMobile ? '1' : '1 / -1' }}>
                              <span style={{ fontSize: '12px', color: '#f59e0b' }}>Potential Gain if entered:</span>
                              <span style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>+{gain.toFixed(2)}%</span>
                            </div>
                          )
                        })()}
                        <div>
                          <label style={labelStyle}>
                            {instrumentType === 'stocks' ? 'SL ($)' : instrumentType === 'indices' ? 'SL Points' : t.slPips}
                            {formData.sl_pips && parseFloat(formData.entry) && parseFloat(formData.sl) && instrumentType === 'forex' && <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '6px', fontWeight: 400 }}>⚡ auto</span>}
                          </label>
                          <input type="number" step="any" value={formData.sl_pips} onChange={e => handleField('sl_pips', e.target.value)} style={{ ...inputStyle, borderColor: formData.sl_pips ? 'var(--accent)' : 'var(--input-border)' }} placeholder={instrumentType === 'forex' ? 'Auto' : '0'} />
                        </div>
                        <div><label style={labelStyle}>{t.risk}</label><input type="number" step="any" value={formData.risk_pct} onChange={e => handleField('risk_pct', e.target.value)} style={inputStyle} placeholder="0.5" /></div>
                        {instrumentType === 'stocks' && (
                          <div><label style={labelStyle}>Shares</label><input type="number" step="1" min="1" value={formData.shares} onChange={e => handleField('shares', e.target.value)} style={inputStyle} placeholder="100" /></div>
                        )}
                        {instrumentType === 'indices' && (
                          <>
                            <div><label style={labelStyle}>Contracts</label><input type="number" step="1" min="1" value={formData.contracts} onChange={e => handleField('contracts', e.target.value)} style={inputStyle} placeholder="1" /></div>
                            <div><label style={labelStyle}>Point Value ($)</label><input type="number" step="any" min="0" value={formData.point_value} onChange={e => handleField('point_value', e.target.value)} style={inputStyle} placeholder="20" /></div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {sectionId === 'confirmations' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.confirmations}</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {confirmationsList.map(conf => {
                          const isSelected = formData.confirmations.includes(conf.label)
                          return (
                            <button key={conf.id} type="button" onClick={() => toggleConfirmation(conf.label)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: isSelected ? 'var(--accent)' : 'transparent', border: isSelected ? 'none' : '1px solid var(--border-strong)', color: isSelected ? '#fff' : 'var(--text-muted)' }}>
                              {conf.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {sectionId === 'outcome' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.outcome}</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {OUTCOMES.map(outcome => {
                          const colorMap = { TP: { active: 'rgba(74,222,128,0.15)', border: '#4ade80', text: '#4ade80' }, 'Partial TP': { active: 'rgba(163,230,53,0.15)', border: '#a3e635', text: '#a3e635' }, SL: { active: 'rgba(248,113,113,0.15)', border: '#f87171', text: '#f87171' }, BE: { active: 'rgba(250,204,21,0.15)', border: '#facc15', text: '#facc15' }, Invalid: { active: 'rgba(156,163,175,0.15)', border: '#9ca3af', text: '#9ca3af' }, Open: { active: 'rgba(96,165,250,0.15)', border: '#60a5fa', text: '#60a5fa' } }
                          const c = colorMap[outcome]
                          const isActive = formData.outcome === outcome
                          return (
                            <button key={outcome} type="button" onClick={() => handleField('outcome', outcome)} style={{ padding: '8px 16px', minHeight: '44px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? c.active : 'var(--bg)', border: `1px solid ${isActive ? c.border : 'var(--border)'}`, color: isActive ? c.text : 'var(--text-muted)' }}>
                              {outcome}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {sectionId === 'sl_to_be' && (
                    <div style={cardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>SL to Breakeven</h2>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Partial exit strategy</p>
                        </div>
                        <button type="button" onClick={() => handleField('sl_to_be', !formData.sl_to_be)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: formData.sl_to_be ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                          <span style={{ position: 'absolute', top: '4px', left: formData.sl_to_be ? '23px' : '4px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                        </button>
                      </div>
                      {formData.sl_to_be && (
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {exitModes.length > 0 && (
                            <div>
                              <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>Exit Mode</label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {exitModes.map(mode => {
                                  const isActive = formData.exit_mode_name === mode.name
                                  return (
                                    <button key={mode.name} type="button" onClick={() => setFormData(prev => ({ ...prev, exit_mode_name: mode.name, be_at: mode.be_at, exit_levels: mode.levels.map(l => ({ ...l })) }))} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: isActive ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? 'var(--accent-light)' : 'var(--bg)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>{mode.name}</button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          <div>
                            <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>Move SL to BE at</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {[1, 2, 3, 4].map(rrVal => {
                                const isActive = formData.be_at === rrVal
                                return <button key={rrVal} type="button" onClick={() => handleField('be_at', rrVal)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: isActive ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? 'rgba(250,204,21,0.15)' : 'var(--bg)', border: `1px solid ${isActive ? '#facc15' : 'var(--border)'}`, color: isActive ? '#facc15' : 'var(--text-muted)' }}>1:{rrVal}</button>
                              })}
                            </div>
                          </div>
                          <div>
                            <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>Exit Levels</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {formData.exit_levels.map((level, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '52px' }}>Level {i + 1}</span>
                                  <input type="number" min="1" max="100" step="1" value={level.pct} onChange={e => { const updated = [...formData.exit_levels]; updated[i] = { ...updated[i], pct: parseInt(e.target.value) || 0 }; handleField('exit_levels', updated) }} style={{ ...inputStyle, width: '72px', textAlign: 'center' }} placeholder="%" />
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>% at R:R</span>
                                  <input type="number" min="1" max="20" step="0.5" value={level.rr} onChange={e => { const updated = [...formData.exit_levels]; updated[i] = { ...updated[i], rr: parseFloat(e.target.value) || 0 }; handleField('exit_levels', updated) }} style={{ ...inputStyle, width: '72px', textAlign: 'center' }} placeholder="3" />
                                  <button type="button" onClick={() => handleField('exit_levels', formData.exit_levels.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '16px', padding: '2px' }} onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)' }}>✕</button>
                                </div>
                              ))}
                              {formData.exit_levels.length < 4 && (
                                <button type="button" onClick={() => handleField('exit_levels', [...formData.exit_levels, { pct: 50, rr: 3 }])} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', alignSelf: 'flex-start' }}>+ Add Level</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {sectionId === 'missed' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>Why did I miss this trade?</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {['Hesitated', 'Not at screen', 'Not enough confirmations', 'Missed the entry', 'Risk management'].map(reason => (
                          <button key={reason} type="button" onClick={() => handleField('missed_reason', formData.missed_reason === reason ? '' : reason)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: formData.missed_reason === reason ? 'rgba(245,158,11,0.15)' : 'var(--bg)', border: `1px solid ${formData.missed_reason === reason ? '#f59e0b' : 'var(--border)'}`, color: formData.missed_reason === reason ? '#f59e0b' : 'var(--text-muted)', transition: 'all 0.15s' }}>{reason}</button>
                        ))}
                      </div>
                      <input type="text" value={formData.missed_reason} onChange={e => handleField('missed_reason', e.target.value)} placeholder="Or write another reason..." style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '100%' }} />
                    </div>
                  )}
                  {sectionId === 'rating' && (
                    <div style={cardStyle}>
                      {/* Trade Rating */}
                      <div style={{ marginBottom: '14px' }}>
                        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{t.tradeRating || 'Trade Rating'}</h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.tradeRatingHint || 'How clean was the setup? (optional)'}</p>
                      </div>
                      <StarRating value={formData.rating} onChange={val => handleField('rating', val)} size={34} />

                      {/* Mood */}
                      <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Mood before trade</h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>How were you feeling when you entered?</p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {[
                            { val: 1, emoji: '😴', label: 'Tired' },
                            { val: 2, emoji: '😤', label: 'Emotional' },
                            { val: 3, emoji: '😐', label: 'Neutral' },
                            { val: 4, emoji: '🙂', label: 'Focused' },
                            { val: 5, emoji: '🔥', label: 'In the zone' },
                          ].map(m => (
                            <button key={m.val} type="button" onClick={() => handleField('mood', formData.mood === m.val ? null : m.val)} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                              padding: '8px 12px', borderRadius: '10px', border: '1px solid',
                              borderColor: formData.mood === m.val ? '#0A84FF' : 'var(--border)',
                              background: formData.mood === m.val ? 'rgba(10,132,255,0.12)' : 'var(--bg-secondary)',
                              cursor: 'pointer', minWidth: '56px',
                            }}>
                              <span style={{ fontSize: '22px' }}>{m.emoji}</span>
                              <span style={{ fontSize: '10px', color: formData.mood === m.val ? '#0A84FF' : 'var(--text-muted)', fontWeight: formData.mood === m.val ? 600 : 400 }}>{m.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Rule Violation */}
                      <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div>
                            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>Rule violation</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Did you break your trading plan?</p>
                          </div>
                          <button type="button" onClick={() => handleField('rule_violated', !formData.rule_violated)} style={{
                            width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: formData.rule_violated ? '#f87171' : 'var(--bg-secondary)',
                            position: 'relative', transition: 'background 0.2s',
                          }}>
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                              position: 'absolute', top: '3px',
                              left: formData.rule_violated ? '23px' : '3px', transition: 'left 0.2s',
                            }} />
                          </button>
                        </div>
                        {formData.rule_violated && (
                          <textarea value={formData.rule_violation_notes} onChange={e => handleField('rule_violation_notes', e.target.value)}
                            placeholder="What rule did you break? (optional)" rows={2}
                            style={{ ...inputStyle, resize: 'vertical', padding: '10px 12px', fontFamily: 'inherit', marginTop: '6px' }} />
                        )}
                      </div>
                    </div>
                  )}
                  {sectionId === 'notes' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.notes}</h2>
                      <textarea value={formData.notes} onChange={e => handleField('notes', e.target.value)} rows={3} placeholder={t.notesPlaceholder} style={{ ...inputStyle, resize: 'vertical', padding: '10px 12px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }} />
                    </div>
                  )}
                  {sectionId === 'screenshots' && (
                    <div style={cardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Screenshots</h2>
                        {activeSlot && <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Click outside to deselect</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }} onClick={e => { if (e.target === e.currentTarget) setActiveSlot(null) }}>
                        <ScreenshotSlot label="HTF Screenshot" preview={htfPreview} isActive={activeSlot === 'htf'} onActivate={() => setActiveSlot('htf')} onFile={handleHtfFile} onRemove={() => { setHtfFile(null); setHtfPreview(null); setExistingHtf(null); if (htfInputRef.current) htfInputRef.current.value = '' }} dropRef={htfDropRef} fileInputRef={htfInputRef} inputStyle={inputStyle} />
                        <ScreenshotSlot label="LTF Screenshot" preview={ltfPreview} isActive={activeSlot === 'ltf'} onActivate={() => setActiveSlot('ltf')} onFile={handleLtfFile} onRemove={() => { setLtfFile(null); setLtfPreview(null); setExistingLtf(null); if (ltfInputRef.current) ltfInputRef.current.value = '' }} dropRef={ltfDropRef} fileInputRef={ltfInputRef} inputStyle={inputStyle} />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '12px' }}>💡 Click the HTF or LTF zone to select it, then paste from TradingView with Ctrl+V</p>
                    </div>
                  )}
                </SortableSection>
              )
            })}
          </SortableContext>
        </DndContext>

        {error && (
          <p style={{ fontSize: '13px', color: '#f87171', background: 'rgba(248,113,113,0.1)', borderRadius: '8px', padding: '12px 16px' }}>
            {error}
          </p>
        )}

        {/* Submit */}
        <div style={{ display: 'flex', gap: '10px', paddingBottom: '16px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '14px',
              fontSize: '15px',
              fontWeight: 700,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: 'var(--accent)',
              color: '#fff',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{
                  width: '14px', height: '14px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
                {isEditing ? t.saving : t.adding}
              </span>
            ) : (
              isEditing ? t.save : t.add
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/journal')}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  )
}
