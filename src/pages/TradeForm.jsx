import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import DatePicker from '../components/DatePicker'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DEFAULT_PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'USDCHF', 'AUDUSD', 'NAS100', 'US30', 'USOIL']

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
                  fill="#facc15" stroke="#facc15" strokeWidth="1.5"
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
            border: `2px dashed ${borderColor}`,
            borderRadius: '12px',
            padding: '28px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            background: bgColor,
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
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    date: today(),
    time: currentTime(),
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
  })
  const [exitModes, setExitModes] = useState([
    { name: 'Standard', be_at: 3, levels: [{ pct: 50, rr: 3 }] }
  ])
  const [confirmationsList, setConfirmationsList] = useState([])
  const [pairsList, setPairsList] = useState(DEFAULT_PAIRS)

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

  const [sectionOrder, setSectionOrder] = useState(() => {
    try { const s = localStorage.getItem('tradeFormSectionOrder'); return s ? JSON.parse(s) : DEFAULT_SECTION_ORDER } catch { return DEFAULT_SECTION_ORDER }
  })
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  function handleSectionDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSectionOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id))
      localStorage.setItem('tradeFormSectionOrder', JSON.stringify(next))
      return next
    })
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
    async function init() {
      await Promise.all([fetchConfirmations(), fetchUserSettings()])
      if (isEditing) await fetchTrade()
      setFetching(false)
      setTimeout(() => setVisible(true), 10)
    }
    init()
  }, [id])

  async function fetchUserSettings() {
    const { data } = await supabase
      .from('user_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (data) {
      if (data.pairs?.length) setPairsList(data.pairs)
      if (!isEditing && data.default_risk_pct) {
        setFormData(prev => ({ ...prev, risk_pct: data.default_risk_pct.toString() }))
      }
      if (data.exit_modes?.length) setExitModes(data.exit_modes)
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
      trade_type: data.trade_type || 'live',
      missed_reason: data.missed_reason || '',
      sl_to_be: data.sl_to_be || false,
      be_at: data.be_at || 3,
      exit_levels: data.exit_levels || [],
      exit_mode_name: '',
      pot_rr: data.pot_rr?.toString() || '',
    })
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
          {isEditing ? t.editTradeTitle : t.newTradeTitle}
        </h1>
        <button
          onClick={() => navigate('/journal')}
          style={{
            fontSize: '13px',
            padding: '7px 14px',
            borderRadius: '8px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {t.cancel}
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Live / Missed toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '3fr 160px 2fr', gap: '14px' }}>
                        <div>
                          <label style={labelStyle}>{t.date}</label>
                          <DatePicker value={formData.date} onChange={val => handleField('date', val)} />
                        </div>
                        <div>
                          <label style={labelStyle}>{t.time}</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="number" min="0" max="23" value={parseInt(timeHours, 10)} onChange={e => setTimeHours(e.target.value)} style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '8px 6px' }} placeholder="HH" />
                            <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>:</span>
                            <input type="number" min="0" max="59" value={parseInt(timeMinutes, 10)} onChange={e => setTimeMinutes(e.target.value)} style={{ ...inputStyle, width: '64px', textAlign: 'center', padding: '8px 6px' }} placeholder="MM" />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>{t.pair}</label>
                          <select value={formData.pair} onChange={e => handleField('pair', e.target.value)} style={inputStyle}>
                            {pairsList.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  {sectionId === 'direction' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.direction}</h2>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['Long', 'Short'].map(dir => (
                          <button key={dir} type="button" onClick={() => handleField('direction', dir)} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: formData.direction === dir ? dir === 'Long' ? 'var(--long-color-bg)' : 'var(--short-color-bg)' : 'var(--bg)', border: `1px solid ${formData.direction === dir ? dir === 'Long' ? 'var(--long-color)' : 'var(--short-color)' : 'var(--border)'}`, color: formData.direction === dir ? dir === 'Long' ? 'var(--long-color)' : 'var(--short-color)' : 'var(--text-muted)' }}>
                            {dir}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {sectionId === 'prices' && (
                    <div style={cardStyle}>
                      <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>{t.prices}</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }} className="md:grid-cols-3">
                        <div><label style={labelStyle}>{t.entry}</label><input type="number" step="any" value={formData.entry} onChange={e => handleField('entry', e.target.value)} style={inputStyle} placeholder="0.00000" /></div>
                        <div><label style={labelStyle}>SL</label><input type="number" step="any" value={formData.sl} onChange={e => handleField('sl', e.target.value)} style={inputStyle} placeholder="0.00000" /></div>
                        <div><label style={labelStyle}>TP</label><input type="number" step="any" value={formData.tp} onChange={e => handleField('tp', e.target.value)} style={inputStyle} placeholder="0.00000" /></div>
                        <div><label style={labelStyle}>R:R</label><input readOnly value={rr ? `1:${rr}` : '--'} style={{ ...inputStyle, color: rr ? 'var(--accent)' : 'var(--text-muted)', cursor: 'default', opacity: 0.8 }} /></div>
                        <div><label style={labelStyle}>Potential R:R</label><input type="number" step="0.1" min="0" placeholder="1:?" value={formData.pot_rr} onChange={e => handleField('pot_rr', e.target.value)} style={inputStyle} /></div>
                        <div>
                          <label style={labelStyle}>{t.slPips}{formData.sl_pips && <span style={{ fontSize: '10px', color: 'var(--accent)', marginRight: '6px', fontWeight: 400 }}>⚡ auto</span>}</label>
                          <input type="number" step="any" value={formData.sl_pips} readOnly style={{ ...inputStyle, borderColor: formData.sl_pips ? 'var(--accent)' : 'var(--input-border)', cursor: 'default', opacity: 0.8 }} placeholder="Auto" />
                        </div>
                        <div><label style={labelStyle}>{t.risk}</label><input type="number" step="any" value={formData.risk_pct} onChange={e => handleField('risk_pct', e.target.value)} style={inputStyle} placeholder="0.5" /></div>
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
                            <button key={conf.id} type="button" onClick={() => toggleConfirmation(conf.label)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: isSelected ? 'var(--accent-light)' : 'var(--bg)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
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
                            <button key={outcome} type="button" onClick={() => handleField('outcome', outcome)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? c.active : 'var(--bg)', border: `1px solid ${isActive ? c.border : 'var(--border)'}`, color: isActive ? c.text : 'var(--text-muted)' }}>
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
                      <div style={{ marginBottom: '14px' }}>
                        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{t.tradeRating || 'דירוג עסקה'}</h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.tradeRatingHint || 'כמה איכותית הייתה ההגדרה? (אופציונלי)'}</p>
                      </div>
                      <StarRating value={formData.rating} onChange={val => handleField('rating', val)} size={34} />
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
              padding: '12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-color)',
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
