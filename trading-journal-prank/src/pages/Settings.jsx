import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useUserSettings } from '../context/UserSettingsContext'

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

function DragHandle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-subtle)' }}>
      <circle cx="9" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function SortableSection({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 100 : 'auto', position: 'relative' }}>
      <button
        {...listeners} {...attributes}
        style={{
          position: 'absolute', top: '14px', right: '14px', zIndex: 2,
          background: 'none', border: 'none', cursor: 'grab', padding: '4px',
          color: 'var(--text-subtle)', touchAction: 'none', display: 'flex', borderRadius: '6px',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.background = 'none' }}
        title="Drag to reorder"
      >
        <DragHandle />
      </button>
      {children}
    </div>
  )
}

function SortableItem({ item, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 100 : 'auto' }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: '8px',
        background: isDragging ? 'var(--card-hover)' : 'transparent',
        transition: 'background 0.15s',
      }}
      {...attributes}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'var(--card-hover)' }}
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'transparent' }}
    >
      <button {...listeners} style={{ background: 'none', border: 'none', cursor: 'grab', padding: '2px', color: 'var(--text-subtle)', touchAction: 'none' }}>
        <DragHandle />
      </button>
      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text)' }}>{item.label}</span>
      <button
        onClick={() => onDelete(item)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-subtle)', borderRadius: '6px', display: 'flex' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.background = 'transparent' }}
      >
        <TrashIcon />
      </button>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { t } = useLang()
  const { updateColors, plan, accountSize: ctxAccountSize, setAccountSize: ctxSetAccountSize, showDollarValues: ctxShowDollar, setShowDollarValues: ctxSetShowDollar, dailyReminder: ctxDailyReminder, setDailyReminder: ctxSetDailyReminder, reminderTime: ctxReminderTime, setReminderTime: ctxSetReminderTime, setGoalMonthlyPnl: ctxSetGoalMonthlyPnl, setGoalWinRate: ctxSetGoalWinRate, setGoalTradesCount: ctxSetGoalTradesCount, setGoalAvgRR: ctxSetGoalAvgRR, setContinuationEnabled: ctxSetContinuationEnabled, setContinuationWindowDays: ctxSetContinuationWindowDays } = useUserSettings()
  const [accountSize, setAccountSizeLocal] = useState(ctxAccountSize || 10000)
  const [showDollarValues, setShowDollarValuesLocal] = useState(ctxShowDollar || false)
  const [dailyReminder, setDailyReminderLocal] = useState(ctxDailyReminder || false)
  const [reminderTime, setReminderTimeLocal] = useState(ctxReminderTime || '20:00')
  const [notifPermission, setNotifPermission] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'default')

  // Confirmations state
  const [confirmations, setConfirmations] = useState([])
  const [newLabel, setNewLabel] = useState('')
  const [addError, setAddError] = useState('')

  // Pairs v2 state (categorized)
  const [pairsV2, setPairsV2] = useState(DEFAULT_PAIRS_V2)
  const [newSymbolInputs, setNewSymbolInputs] = useState({})
  const [newCatName, setNewCatName] = useState('')
  const [newCatError, setNewCatError] = useState('')

  // Default risk
  const [defaultRisk, setDefaultRisk] = useState('0.5')
  const [defaultOutcome, setDefaultOutcome] = useState('Open')
  const [defaultPair, setDefaultPairLocal] = useState('')
  const [defaultInstrumentType, setDefaultInstrumentType] = useState('forex')

  // Direction colors
  const [longColor, setLongColor] = useState('#4ade80')
  const [shortColor, setShortColor] = useState('#f87171')

  // Exit modes
  const [exitModes, setExitModes] = useState([
    { name: 'Standard', be_at: 3, levels: [{ pct: 50, rr: 3 }] }
  ])
  const [isDirty, setIsDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [visible, setVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('trading')
  const DEFAULT_SETTINGS_ORDER = ['confirmations', 'pairs', 'risk', 'exitModes']
  const [sectionOrder, setSectionOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('settings_section_order')) || DEFAULT_SETTINGS_ORDER }
    catch { return DEFAULT_SETTINGS_ORDER }
  })

  async function handleSectionDragEnd(event) {
    const { active, over } = event
    if (!active || !over || active.id === over.id) return
    const next = arrayMove(sectionOrder, sectionOrder.indexOf(active.id), sectionOrder.indexOf(over.id))
    setSectionOrder(next)
    localStorage.setItem('settings_section_order', JSON.stringify(next))
    await supabase.from('user_settings').upsert(
      { user_id: user.id, settings_section_order: next },
      { onConflict: 'user_id' }
    )
  }

  // Monthly goals
  const [goalMonthlyPnl, setGoalMonthlyPnlLocal] = useState('')
  const [goalWinRate, setGoalWinRateLocal] = useState('')
  const [goalTradesCount, setGoalTradesCountLocal] = useState('')
  const [goalAvgRR, setGoalAvgRRLocal] = useState('')

  // Continuation trades
  const [continuationEnabled, setContinuationEnabledLocal] = useState(false)
  const [continuationWindowDays, setContinuationWindowDaysLocal] = useState(1)

  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Trade Templates
  const [templates, setTemplates] = useState([])
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    Promise.all([fetchConfirmations(), fetchSettings(), fetchTemplates()]).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading) setTimeout(() => setVisible(true), 10)
  }, [loading])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  // ── Confirmations ──────────────────────────────────────────
  async function fetchConfirmations() {
    const { data } = await supabase
      .from('confirmations_library').select('*').eq('user_id', user.id).order('sort_order')
    setConfirmations(data || [])
  }

  // ── Trade Templates ─────────────────────────────────────────
  async function fetchTemplates() {
    const { data } = await supabase
      .from('trade_templates').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function handleDeleteTemplate(id) {
    await supabase.from('trade_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function handleRenameTemplate(id) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    await supabase.from('trade_templates').update({ name: renameValue.trim() }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: renameValue.trim() } : t))
    setRenamingId(null)
    setRenameValue('')
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = confirmations.findIndex(c => c.id === active.id)
    const newIndex = confirmations.findIndex(c => c.id === over.id)
    const newOrder = arrayMove(confirmations, oldIndex, newIndex)
    setConfirmations(newOrder)
    setSaving(true)
    try {
      await Promise.all(newOrder.map((item, idx) =>
        supabase.from('confirmations_library').update({ sort_order: idx + 1 }).eq('id', item.id)
      ))
      showToast(t.saved)
    } finally { setSaving(false) }
  }

  async function handleCancelSubscription() {
    if (!window.confirm("Are you sure? You'll lose access at the end of your current billing period.")) return
    setCancelLoading(true)
    try {
      const res = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      showToast('✓ Subscription canceled — access continues until end of billing period')
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleChangePassword() {
    setPwError('')
    if (!currentPassword) { setPwError('Please enter your current password'); return }
    if (!newPassword || newPassword.length < 6) { setPwError('New password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match'); return }
    if (newPassword === currentPassword) { setPwError('New password must be different from current password'); return }
    setPwLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (signInError) { setPwLoading(false); setPwError('Current password is incorrect'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) { setPwError(error.message); return }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    showToast('✓ Password updated successfully')
  }

  async function handleAddConfirmation() {
    const label = newLabel.trim()
    if (!label) return
    setAddError('')
    if (confirmations.find(c => c.label.toLowerCase() === label.toLowerCase())) {
      setAddError(t.duplicateConfirmation); return
    }
    const maxOrder = confirmations.length > 0 ? Math.max(...confirmations.map(c => c.sort_order || 0)) : 0
    const { data, error } = await supabase
      .from('confirmations_library')
      .insert({ user_id: user.id, label, sort_order: maxOrder + 1 })
      .select().single()
    if (error) { setAddError(error.message); return }
    if (data) { setConfirmations(prev => [...prev, data]); setNewLabel(''); showToast(t.saved) }
  }

  async function handleDeleteConfirmation(item) {
    if (!window.confirm(`${t.deleteConfirm} "${item.label}"?`)) return
    const { error } = await supabase.from('confirmations_library').delete().eq('id', item.id)
    if (!error) setConfirmations(prev => prev.filter(c => c.id !== item.id))
  }

  // ── User Settings (Pairs + Risk) ───────────────────────────
  async function fetchSettings() {
    const { data, error } = await supabase
      .from('user_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (error) {
      console.error('user_settings fetch error:', error.message)
    }
    if (data) {
      if (data.pairs_v2?.length) setPairsV2(data.pairs_v2)
      setDefaultRisk(data.default_risk_pct?.toString() || '0.5')
      if (data.default_outcome) setDefaultOutcome(data.default_outcome)
      if (data.default_pair) setDefaultPairLocal(data.default_pair)
      if (data.instrument_type) setDefaultInstrumentType(data.instrument_type)
      if (data.long_color) setLongColor(data.long_color)
      if (data.short_color) setShortColor(data.short_color)
      if (data.exit_modes?.length) setExitModes(data.exit_modes)
      if (data.settings_section_order?.length) {
        setSectionOrder(data.settings_section_order)
        localStorage.setItem('settings_section_order', JSON.stringify(data.settings_section_order))
      }
      if (data.daily_reminder != null) setDailyReminderLocal(data.daily_reminder)
      if (data.reminder_time) setReminderTimeLocal(data.reminder_time)
      if (data.goal_monthly_pnl != null) setGoalMonthlyPnlLocal(String(data.goal_monthly_pnl))
      if (data.goal_win_rate != null) setGoalWinRateLocal(String(data.goal_win_rate))
      if (data.goal_trades_count != null) setGoalTradesCountLocal(String(data.goal_trades_count))
      if (data.goal_avg_rr != null) setGoalAvgRRLocal(String(data.goal_avg_rr))
      if (data.continuation_enabled != null) setContinuationEnabledLocal(data.continuation_enabled)
      if (data.continuation_window_days != null) setContinuationWindowDaysLocal(data.continuation_window_days)
    } else {
      setPairs(DEFAULT_PAIRS)
    }
  }

  async function handleSaveAll() {
    setSaving(true)
    const flatPairs = pairsV2.flatMap(c => c.symbols)
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      pairs: flatPairs,
      pairs_v2: pairsV2,
      instrument_type: defaultInstrumentType,
      default_risk_pct: parseFloat(defaultRisk) || 0.5,
      default_outcome: defaultOutcome,
      default_pair: defaultPair || null,
      account_size: parseFloat(accountSize) || 10000,
      show_dollar_values: showDollarValues,
      long_color: longColor,
      short_color: shortColor,
      exit_modes: exitModes,
      daily_reminder: dailyReminder,
      reminder_time: reminderTime,
      goal_monthly_pnl: goalMonthlyPnl !== '' ? parseFloat(goalMonthlyPnl) : null,
      goal_win_rate: goalWinRate !== '' ? parseFloat(goalWinRate) : null,
      goal_trades_count: goalTradesCount !== '' ? parseInt(goalTradesCount) : null,
      goal_avg_rr: goalAvgRR !== '' ? parseFloat(goalAvgRR) : null,
      continuation_enabled: continuationEnabled,
      continuation_window_days: parseInt(continuationWindowDays) || 1,
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (error) {
      setToast('❌ ' + error.message)
      setTimeout(() => setToast(''), 5000)
    } else {
      updateColors(longColor, shortColor)
      ctxSetAccountSize(accountSize)
      ctxSetShowDollar(showDollarValues)
      ctxSetDailyReminder(dailyReminder)
      ctxSetReminderTime(reminderTime)
      ctxSetGoalMonthlyPnl(goalMonthlyPnl !== '' ? parseFloat(goalMonthlyPnl) : null)
      ctxSetGoalWinRate(goalWinRate !== '' ? parseFloat(goalWinRate) : null)
      ctxSetGoalTradesCount(goalTradesCount !== '' ? parseInt(goalTradesCount) : null)
      ctxSetGoalAvgRR(goalAvgRR !== '' ? parseFloat(goalAvgRR) : null)
      ctxSetContinuationEnabled(continuationEnabled)
      ctxSetContinuationWindowDays(parseInt(continuationWindowDays) || 1)
      // sync localStorage for reminder scheduler
      localStorage.setItem('reminder_enabled', dailyReminder ? '1' : '0')
      localStorage.setItem('reminder_time', reminderTime)
      setIsDirty(false)
      showToast(t.saved)
    }
  }

  async function handleToggleReminder() {
    const next = !dailyReminder
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      setNotifPermission(perm)
      if (perm !== 'granted') return
    }
    setDailyReminderLocal(next)
    setIsDirty(true)
  }

  // ── Styles ─────────────────────────────────────────────────
  const cardStyle = {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: '18px', padding: '22px', boxShadow: 'var(--shadow)',
    marginBottom: '16px',
  }
  const inputStyle = {
    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    color: 'var(--text)', borderRadius: '10px', padding: '9px 13px',
    fontSize: '14px', outline: 'none', flex: 1, letterSpacing: '-0.01em',
  }
  const btnPrimary = {
    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)', border: 'none',
    borderRadius: '10px', padding: '9px 18px', fontSize: '14px',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  }
  const sectionTitle = { fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px', letterSpacing: '-0.02em' }
  const sectionSub = { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className={visible ? 'fade-in' : ''} style={{ padding: '28px 32px', maxWidth: '800px', margin: '0 auto', opacity: visible ? 1 : 0, transition: 'opacity 0.25s' }}>

      {/* Toast */}
      {toast && (
        <div className="fade-in" style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: toast.startsWith('❌') ? '#ef4444' : 'var(--btn-primary-bg)',
          color: 'var(--btn-primary-color)', padding: '10px 20px',
          borderRadius: '10px', fontSize: '14px', fontWeight: 600, zIndex: 999,
        }}>
          {toast}
        </div>
      )}

      <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginBottom: '20px' }}>
        {t.settingsTitle}
      </h1>

      {/* ── Tabs ── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '2px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: '30px', padding: '4px', marginBottom: '24px',
        boxShadow: 'var(--shadow)',
      }}>
        {[
          { key: 'trading', label: 'Trading' },
          { key: 'general', label: 'General' },
          { key: 'account', label: 'Account' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '6px 18px', borderRadius: '20px', fontSize: '13px', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
              background: activeTab === tab.key ? 'var(--card)' : 'transparent',
              boxShadow: activeTab === tab.key ? 'var(--shadow)' : 'none',
              transition: 'all 0.15s',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {activeTab === 'trading' && (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          {sectionOrder.map(key => {
            if (key === 'confirmations') return (
              <SortableSection key="confirmations" id="confirmations">
                <div style={cardStyle}>
                  <p style={sectionTitle}>{t.confirmationsLibrary}</p>
                  <p style={sectionSub}>Drag to reorder, click to delete</p>
                  {confirmations.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>{t.noConfirmations}</p>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={confirmations.map(c => c.id)} strategy={verticalListSortingStrategy}>
                        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
                          {confirmations.map(item => <SortableItem key={item.id} item={item} onDelete={handleDeleteConfirmation} />)}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={newLabel} onChange={e => { setNewLabel(e.target.value); setAddError('') }} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddConfirmation())} placeholder={t.newConfirmationPlaceholder} style={inputStyle} />
                    <button onClick={handleAddConfirmation} style={btnPrimary}>{t.addBtn}</button>
                  </div>
                  {addError && <p style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>{addError}</p>}
                </div>
              </SortableSection>
            )
            if (key === 'pairs') return (
              <SortableSection key="pairs" id="pairs">
                <div style={cardStyle}>
                  <p style={sectionTitle}>Pairs Library</p>
                  <p style={sectionSub}>Organize symbols by category — shown in the trade form</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pairsV2.map((cat, catIdx) => (
                      <div key={catIdx} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', background: 'var(--bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cat.category}</span>
                          <button
                            onClick={() => {
                              if (!window.confirm(`Remove category "${cat.category}" and all its symbols?`)) return
                              setPairsV2(prev => prev.filter((_, i) => i !== catIdx)); setIsDirty(true)
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '11px', padding: '2px 6px', borderRadius: '6px' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)'; e.currentTarget.style.background = 'none' }}
                          >Remove</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {cat.symbols.map(sym => (
                            <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '7px', padding: '4px 8px 4px 10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace' }}>{sym}</span>
                              <button
                                onClick={() => { setPairsV2(prev => prev.map((c, i) => i === catIdx ? { ...c, symbols: c.symbols.filter(s => s !== sym) } : c)); setIsDirty(true) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: 'var(--text-subtle)', display: 'flex', lineHeight: 1 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-subtle)'}
                              ><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            value={newSymbolInputs[catIdx] || ''}
                            onChange={e => setNewSymbolInputs(prev => ({ ...prev, [catIdx]: e.target.value.toUpperCase() }))}
                            onKeyDown={e => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              const sym = (newSymbolInputs[catIdx] || '').trim().toUpperCase()
                              if (!sym || pairsV2.some(c => c.symbols.includes(sym))) return
                              setPairsV2(prev => prev.map((c, i) => i === catIdx ? { ...c, symbols: [...c.symbols, sym] } : c))
                              setNewSymbolInputs(prev => ({ ...prev, [catIdx]: '' })); setIsDirty(true)
                            }}
                            placeholder="Add symbol..."
                            style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '12px', padding: '7px 10px' }}
                          />
                          <button
                            onClick={() => {
                              const sym = (newSymbolInputs[catIdx] || '').trim().toUpperCase()
                              if (!sym || pairsV2.some(c => c.symbols.includes(sym))) return
                              setPairsV2(prev => prev.map((c, i) => i === catIdx ? { ...c, symbols: [...c.symbols, sym] } : c))
                              setNewSymbolInputs(prev => ({ ...prev, [catIdx]: '' })); setIsDirty(true)
                            }}
                            style={{ ...btnPrimary, padding: '7px 14px', fontSize: '13px' }}
                          >Add</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add Category</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={newCatName}
                          onChange={e => { setNewCatName(e.target.value); setNewCatError('') }}
                          onKeyDown={e => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            const name = newCatName.trim()
                            if (!name) return
                            if (pairsV2.some(c => c.category.toLowerCase() === name.toLowerCase())) { setNewCatError('Already exists'); return }
                            setPairsV2(prev => [...prev, { category: name, symbols: [] }]); setNewCatName(''); setIsDirty(true)
                          }}
                          placeholder="e.g. Futures"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                          onClick={() => {
                            const name = newCatName.trim()
                            if (!name) return
                            if (pairsV2.some(c => c.category.toLowerCase() === name.toLowerCase())) { setNewCatError('Already exists'); return }
                            setPairsV2(prev => [...prev, { category: name, symbols: [] }]); setNewCatName(''); setIsDirty(true)
                          }}
                          style={btnPrimary}
                        >Add Category</button>
                      </div>
                      {newCatError && <p style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>{newCatError}</p>}
                    </div>
                  </div>
                </div>
              </SortableSection>
            )
            if (key === 'risk') return (
              <SortableSection key="risk" id="risk">
                <div style={cardStyle}>
                  <p style={sectionTitle}>Default Risk %</p>
                  <p style={sectionSub}>Auto-loaded in every new trade</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
                    <input type="number" step="0.1" min="0.1" max="100" value={defaultRisk} onChange={e => { setDefaultRisk(e.target.value); setIsDirty(true) }} style={{ ...inputStyle, maxWidth: '120px' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>%</span>
                  </div>
                  <p style={sectionTitle}>Default Outcome</p>
                  <p style={sectionSub}>Pre-selected outcome in every new trade</p>
                  <select
                    value={defaultOutcome}
                    onChange={e => { setDefaultOutcome(e.target.value); setIsDirty(true) }}
                    style={{ ...inputStyle, maxWidth: '200px', marginBottom: '20px' }}
                  >
                    {['TP', 'Partial TP', 'SL', 'BE', 'Invalid', 'Open'].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <p style={sectionTitle}>Default Pair</p>
                  <p style={sectionSub}>Pre-selected pair in every new trade</p>
                  <select
                    value={defaultPair}
                    onChange={e => { setDefaultPairLocal(e.target.value); setIsDirty(true) }}
                    style={{ ...inputStyle, maxWidth: '200px', marginBottom: '20px' }}
                  >
                    <option value="">— None —</option>
                    {pairsV2.map(cat => (
                      <optgroup key={cat.category} label={cat.category}>
                        {cat.symbols.map(p => <option key={p} value={p}>{p}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <p style={sectionTitle}>Default Instrument Type</p>
                  <p style={sectionSub}>Pre-selected instrument mode for new trades</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { key: 'forex', label: '💱 Forex', sub: 'Metals · Crypto' },
                      { key: 'stocks', label: '📈 Stocks', sub: 'ETFs' },
                      { key: 'indices', label: '📊 Indices', sub: 'Futures' },
                    ].map(({ key, label, sub }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setDefaultInstrumentType(key); setIsDirty(true) }}
                        style={{
                          padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                          cursor: 'pointer', border: `1px solid ${defaultInstrumentType === key ? 'var(--accent)' : 'var(--border)'}`,
                          background: defaultInstrumentType === key ? 'var(--accent-light)' : 'transparent',
                          color: defaultInstrumentType === key ? 'var(--accent)' : 'var(--text-muted)',
                          transition: 'all 0.15s', textAlign: 'left',
                        }}
                      >
                        <div>{label}</div>
                        <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7, marginTop: '1px' }}>{sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </SortableSection>
            )

            if (key === 'exitModes') return (
              <SortableSection key="exitModes" id="exitModes">
              <div style={cardStyle}>
                <p style={sectionTitle}>Exit Modes</p>
                <p style={sectionSub}>Define partial exit presets for your trades (up to 4 levels each)</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {exitModes.map((mode, mi) => (
            <div key={mi} style={{
              border: '1px solid var(--border)', borderRadius: '10px', padding: '14px',
              background: 'var(--bg)',
            }}>
              {/* Mode header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <input
                  type="text"
                  value={mode.name}
                  onChange={e => {
                    const updated = [...exitModes]
                    updated[mi] = { ...updated[mi], name: e.target.value }
                    setExitModes(updated); setIsDirty(true)
                  }}
                  style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
                  placeholder="Mode name"
                />
                {exitModes.length > 1 && (
                  <button
                    onClick={() => { setExitModes(prev => prev.filter((_, i) => i !== mi)); setIsDirty(true) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex', padding: '4px' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)' }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>

              {/* BE at */}
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Move SL to BE at</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4].map(rr => {
                    const isActive = mode.be_at === rr
                    return (
                      <button
                        key={rr}
                        onClick={() => {
                          const updated = [...exitModes]
                          updated[mi] = { ...updated[mi], be_at: rr }
                          setExitModes(updated); setIsDirty(true)
                        }}
                        style={{
                          padding: '4px 12px', borderRadius: '7px', fontSize: '12px',
                          fontWeight: isActive ? 700 : 400, cursor: 'pointer',
                          background: isActive ? 'rgba(250,204,21,0.15)' : 'var(--card)',
                          border: `1px solid ${isActive ? '#facc15' : 'var(--border)'}`,
                          color: isActive ? '#facc15' : 'var(--text-muted)',
                        }}
                      >1:{rr}</button>
                    )
                  })}
                </div>
              </div>

              {/* Levels */}
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Exit Levels</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {mode.levels.map((level, li) => (
                    <div key={li} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '48px' }}>Level {li + 1}</span>
                      <input
                        type="number" min="1" max="100" step="1"
                        value={level.pct}
                        onChange={e => {
                          const updated = [...exitModes]
                          updated[mi].levels[li] = { ...level, pct: parseInt(e.target.value) || 0 }
                          setExitModes([...updated]); setIsDirty(true)
                        }}
                        style={{ ...inputStyle, width: '68px', textAlign: 'center', padding: '6px 8px' }}
                        placeholder="%"
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>% at R:R</span>
                      <input
                        type="number" min="1" max="20" step="0.5"
                        value={level.rr}
                        onChange={e => {
                          const updated = [...exitModes]
                          updated[mi].levels[li] = { ...level, rr: parseFloat(e.target.value) || 0 }
                          setExitModes([...updated]); setIsDirty(true)
                        }}
                        style={{ ...inputStyle, width: '68px', textAlign: 'center', padding: '6px 8px' }}
                        placeholder="3"
                      />
                      {mode.levels.length > 1 && (
                        <button
                          onClick={() => {
                            const updated = [...exitModes]
                            updated[mi].levels = mode.levels.filter((_, j) => j !== li)
                            setExitModes([...updated]); setIsDirty(true)
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '15px', padding: '2px' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-subtle)' }}
                        >✕</button>
                      )}
                    </div>
                  ))}
                  {mode.levels.length < 4 && (
                    <button
                      onClick={() => {
                        const updated = [...exitModes]
                        updated[mi].levels = [...mode.levels, { pct: 50, rr: mode.be_at || 3 }]
                        setExitModes([...updated]); setIsDirty(true)
                      }}
                      style={{
                        padding: '5px 10px', borderRadius: '7px', fontSize: '12px',
                        cursor: 'pointer', border: '1px dashed var(--border)',
                        background: 'transparent', color: 'var(--text-muted)', alignSelf: 'flex-start',
                      }}
                    >+ Add Level</button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add mode button */}
          {exitModes.length < 6 && (
            <button
              onClick={() => {
                setExitModes(prev => [...prev, { name: `Mode ${prev.length + 1}`, be_at: 3, levels: [{ pct: 50, rr: 3 }] }])
                setIsDirty(true)
              }}
              style={{
                padding: '9px', borderRadius: '9px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', border: '1px dashed var(--border)',
                background: 'transparent', color: 'var(--text-muted)',
              }}
            >+ Add Mode</button>
          )}
        </div>
              </div>
              </SortableSection>
            )
            return null
          })}
        </SortableContext>
      </DndContext>
      )}

      {/* Continuation Trades — outside DnD, always last in Trading tab */}
      {activeTab === 'trading' && (
        <div style={cardStyle}>
          <p style={sectionTitle}>Continuation Trades</p>
          <p style={sectionSub}>Track trades that continue the same directional move within a time window</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <button
              onClick={() => { setContinuationEnabledLocal(v => !v); setIsDirty(true) }}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: continuationEnabled ? 'var(--accent)' : 'var(--border-strong)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: continuationEnabled ? '23px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
                {continuationEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Shows continuation toggle in Trade Form
              </p>
            </div>
          </div>
          {continuationEnabled && (
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '6px' }}>
                Look-back window (days)
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                How far back to search for the original trade (same pair & direction)
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={continuationWindowDays}
                  onChange={e => { setContinuationWindowDaysLocal(Math.min(14, Math.max(1, parseInt(e.target.value) || 1))); setIsDirty(true) }}
                  style={{ ...inputStyle, maxWidth: '80px', textAlign: 'center' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>days</span>
                <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                  {[1, 2, 3, 5, 7].map(d => (
                    <button
                      key={d}
                      onClick={() => { setContinuationWindowDaysLocal(d); setIsDirty(true) }}
                      style={{
                        padding: '4px 10px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer',
                        background: continuationWindowDays === d ? 'var(--accent-light)' : 'var(--card)',
                        border: `1px solid ${continuationWindowDays === d ? 'var(--accent)' : 'var(--border)'}`,
                        color: continuationWindowDays === d ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: continuationWindowDays === d ? 700 : 400,
                      }}
                    >{d}d</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'general' && (<>

      {/* ── Account Settings ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Account</p>
        <p style={sectionSub}>Used to calculate dollar values across the dashboard</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '8px' }}>Account Size ($)</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={accountSize}
                onChange={e => { setAccountSizeLocal(Number(e.target.value)); setIsDirty(true) }}
                style={{ ...inputStyle, maxWidth: '160px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => { setShowDollarValuesLocal(v => !v); setIsDirty(true) }}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: showDollarValues ? 'var(--accent)' : 'var(--border-strong)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: showDollarValues ? '22px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
            <p style={{ fontSize: '13px', color: 'var(--text)' }}>Show Dollar Values</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Adds ($X) next to % P&L values</p>
          </div>
        </div>
      </div>

      {/* ── Daily Reminder ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Daily Trade Reminder</p>
        <p style={sectionSub}>Get a browser notification to log your trades if you haven't yet</p>
        {notifPermission === 'denied' && (
          <div style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', color: '#FF453A' }}>
              Notifications are blocked in your browser. Enable them in browser settings to use this feature.
            </p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleToggleReminder}
              disabled={notifPermission === 'denied'}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                cursor: notifPermission === 'denied' ? 'not-allowed' : 'pointer',
                background: dailyReminder ? 'var(--accent)' : 'var(--border-strong)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                opacity: notifPermission === 'denied' ? 0.5 : 1,
              }}
            >
              <span style={{
                position: 'absolute', top: '3px',
                left: dailyReminder ? '22px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
            <p style={{ fontSize: '13px', color: 'var(--text)' }}>Enable Daily Reminder</p>
          </div>
          {dailyReminder && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', minWidth: '80px' }}>Remind me at</p>
              <input
                type="time"
                value={reminderTime}
                onChange={e => { setReminderTimeLocal(e.target.value); setIsDirty(true) }}
                style={{
                  ...inputStyle, maxWidth: '120px',
                  colorScheme: 'dark',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Only fires if you have no trades logged today</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Direction Colors ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Direction Colors</p>
        <p style={sectionSub}>Customize the color used for Long and Short labels throughout the app</p>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Long */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ position: 'relative', cursor: 'pointer' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: longColor,
                border: '2px solid var(--border)',
                cursor: 'pointer',
                transition: 'transform 0.1s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              />
              <input
                type="color"
                value={longColor}
                onChange={e => { setLongColor(e.target.value); setIsDirty(true) }}
                style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
              />
            </label>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: longColor }}>Long</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{longColor.toUpperCase()}</p>
            </div>
          </div>

          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />

          {/* Short */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ position: 'relative', cursor: 'pointer' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: shortColor,
                border: '2px solid var(--border)',
                cursor: 'pointer',
                transition: 'transform 0.1s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              />
              <input
                type="color"
                value={shortColor}
                onChange={e => { setShortColor(e.target.value); setIsDirty(true) }}
                style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
              />
            </label>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: shortColor }}>Short</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{shortColor.toUpperCase()}</p>
            </div>
          </div>

          {/* Reset to defaults */}
          <button
            onClick={() => { setLongColor('#4ade80'); setShortColor('#f87171'); setIsDirty(true) }}
            style={{
              marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: '8px', padding: '6px 12px',
              fontSize: '12px', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            Reset defaults
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
          Click the color swatch to open the color picker
        </p>
      </div>

      {/* ── Trade Templates ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Trade Templates</p>
        <p style={sectionSub}>Saved setups to quickly prefill a new trade</p>
        {templates.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No templates yet — save one from the Trade Form
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            {templates.map((tmpl, i) => (
              <div
                key={tmpl.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '11px 14px',
                  borderBottom: i < templates.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {renamingId === tmpl.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameTemplate(tmpl.id)
                      if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                    }}
                    onBlur={() => handleRenameTemplate(tmpl.id)}
                    style={{
                      flex: 1, padding: '5px 8px', borderRadius: '6px', fontSize: '14px',
                      background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--text)', outline: 'none',
                    }}
                  />
                ) : (
                  <>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{tmpl.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>
                        {tmpl.data.pair} · {tmpl.data.direction} · {tmpl.data.risk_pct}% risk
                      </span>
                    </div>
                    {/* Rename */}
                    <button
                      onClick={() => { setRenamingId(tmpl.id); setRenameValue(tmpl.name) }}
                      title="Rename"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-subtle)', display: 'flex', borderRadius: '5px' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-subtle)'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-subtle)', display: 'flex', borderRadius: '5px' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-subtle)'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Monthly Goals ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Monthly Goals</p>
        <p style={sectionSub}>Set targets for the current month — progress is shown on the Dashboard</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Monthly P&L Target', sub: '% gain for the month', value: goalMonthlyPnl, set: v => { setGoalMonthlyPnlLocal(v); setIsDirty(true) }, suffix: '%', min: 0, step: 0.5, placeholder: 'e.g. 5' },
            { label: 'Win Rate Target', sub: '% of closed trades won', value: goalWinRate, set: v => { setGoalWinRateLocal(v); setIsDirty(true) }, suffix: '%', min: 0, max: 100, step: 1, placeholder: 'e.g. 70' },
            { label: 'Trades Count Target', sub: 'total trades this month', value: goalTradesCount, set: v => { setGoalTradesCountLocal(v); setIsDirty(true) }, suffix: '', min: 1, step: 1, placeholder: 'e.g. 20' },
            { label: 'Avg R:R Target', sub: 'average R:R on winning trades', value: goalAvgRR, set: v => { setGoalAvgRRLocal(v); setIsDirty(true) }, suffix: '', min: 0, step: 0.5, placeholder: 'e.g. 3' },
          ].map(goal => (
            <div key={goal.label}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>{goal.label}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{goal.sub}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  min={goal.min}
                  max={goal.max}
                  step={goal.step}
                  value={goal.value}
                  onChange={e => goal.set(e.target.value)}
                  placeholder={goal.placeholder}
                  style={{ ...inputStyle, maxWidth: '120px' }}
                />
                {goal.suffix && <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{goal.suffix}</span>}
                {goal.value !== '' && (
                  <button onClick={() => { goal.set(''); setIsDirty(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '16px', padding: '0 4px' }}
                    title="Clear goal"
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-subtle)'}
                  >✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      </>)}

      {/* ── Save All button — shown on Trading + General tabs ── */}
      {activeTab !== 'account' && <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', marginTop: '8px' }}>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          style={{
            ...btnPrimary,
            padding: '11px 28px',
            fontSize: '15px',
            borderRadius: '10px',
            opacity: saving ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          {saving ? (
            <>
              <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              Saving...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {t.save || 'Save Settings'}
            </>
          )}
        </button>
        {isDirty && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            • Unsaved changes
          </span>
        )}
      </div>}

      {activeTab === 'account' && (<>

      {/* ── Subscription ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>Subscription</p>
        {plan === 'free' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600, marginBottom: '2px' }}>Free Plan</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Limited to 10 live trades</p>
            </div>
            <a
              href="/landing"
              style={{
                padding: '9px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                background: 'var(--accent)', color: '#fff', textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(10,132,255,0.3)', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Upgrade Plan →
            </a>
          </div>
        )}
        {(plan === 'monthly' || plan === 'yearly') && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30D158', display: 'inline-block' }} />
                <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>
                  {plan === 'monthly' ? 'Monthly Plan' : 'Yearly Plan'}
                </p>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active subscription — unlimited trades</p>
            </div>
            <button
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              style={{
                padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)',
                color: '#f87171', cursor: cancelLoading ? 'not-allowed' : 'pointer',
                opacity: cancelLoading ? 0.6 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!cancelLoading) { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; e.currentTarget.style.borderColor = '#f87171' } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)' }}
            >
              {cancelLoading ? 'Canceling...' : 'Cancel Subscription'}
            </button>
          </div>
        )}
        {plan === 'lifetime' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>✓</span>
            <div>
              <p style={{ fontSize: '14px', color: '#30D158', fontWeight: 700, marginBottom: '2px' }}>Lifetime Access</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>One-time purchase — never expires</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Account ── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>{t.account}</p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{t.email}</p>
        <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '24px' }}>{user?.email}</p>

        <p style={{ ...sectionTitle, fontSize: '13px', marginBottom: '14px' }}>Change Password</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '340px' }}>
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={e => { setCurrentPassword(e.target.value); setPwError('') }}
            style={inputStyle}
          />
          <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setPwError('') }}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setPwError('') }}
            style={{
              ...inputStyle,
              borderColor: confirmPassword && newPassword !== confirmPassword ? '#f87171' : undefined,
            }}
          />
          {pwError && (
            <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>{pwError}</p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
            style={{
              ...btnPrimary,
              alignSelf: 'flex-start',
              opacity: pwLoading || !currentPassword || !newPassword || !confirmPassword ? 0.5 : 1,
            }}
          >
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>

      </>)}

    </div>
  )
}
