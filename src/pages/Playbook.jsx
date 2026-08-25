import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const cardStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  boxShadow: 'var(--shadow)',
}

const inputStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  color: 'var(--text)',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
}

const SETUP_TYPES = ['BOS + OB', 'FVG Retest', 'Liquidity Grab', 'Trend Follow', 'Break & Retest', 'Session Open', 'News Play', 'Other']

const ACCENT_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#32ADE6', '#FF6961', '#64D2FF']

function SetupModal({ setup, onSave, onClose }) {
  const [form, setForm] = useState({
    name: setup?.name || '',
    setup_type: setup?.setup_type || '',
    description: setup?.description || '',
    rules: setup?.rules || [''],
    confirmations: setup?.confirmations || [],
    notes: setup?.notes || '',
    color: setup?.color || '#0A84FF',
  })

  const { user } = useAuth()
  const [confLibrary, setConfLibrary] = useState([])
  useEffect(() => {
    supabase.from('confirmations_library').select('label').eq('user_id', user.id).order('sort_order')
      .then(({ data }) => setConfLibrary((data || []).map(d => d.label)))
  }, [user])

  const toggleConf = (label) => setForm(p => ({
    ...p,
    confirmations: p.confirmations.includes(label)
      ? p.confirmations.filter(c => c !== label)
      : [...p.confirmations, label]
  }))

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setArr = (k, idx, v) => setForm(p => ({ ...p, [k]: p[k].map((x, i) => i === idx ? v : x) }))
  const addArr = (k) => setForm(p => ({ ...p, [k]: [...p[k], ''] }))
  const removeArr = (k, idx) => setForm(p => ({ ...p, [k]: p[k].filter((_, i) => i !== idx) }))

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      ...form,
      rules: form.rules.filter(r => r.trim()),
      confirmations: form.confirmations,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '520px', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>{setup ? 'Edit Setup' : 'New Playbook Setup'}</h3>

        {/* Name */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Setup Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. London BOS + OB" style={inputStyle} />
        </div>

        {/* Setup type */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Setup Type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SETUP_TYPES.map(t => (
              <button key={t} onClick={() => set('setup_type', t === form.setup_type ? '' : t)}
                style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.setup_type === t ? 'var(--accent)' : 'var(--border)'}`, background: form.setup_type === t ? 'var(--accent-light)' : 'var(--bg)', color: form.setup_type === t ? 'var(--accent)' : 'var(--text-muted)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Color</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {ACCENT_COLORS.map(c => (
              <button key={c} onClick={() => set('color', c)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: form.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description of this setup..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* Rules */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Entry Rules</label>
          {form.rules.map((rule, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <input value={rule} onChange={e => setArr('rules', idx, e.target.value)} placeholder={`Rule ${idx + 1}`} style={{ ...inputStyle, flex: 1 }} />
              {form.rules.length > 1 && <button onClick={() => removeArr('rules', idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF453A', fontSize: '18px' }}>×</button>}
            </div>
          ))}
          <button onClick={() => addArr('rules')} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>+ Add rule</button>
        </div>

        {/* Required Confirmations — from library */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Required Confirmations</label>
          {confLibrary.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {confLibrary.map(label => {
                const selected = form.confirmations.includes(label)
                return (
                  <button key={label} onClick={() => toggleConf(label)} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: selected ? 'var(--accent-light)' : 'var(--bg)', color: selected ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                    {selected ? '✓ ' : ''}{label}
                  </button>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Add confirmations in Settings → Trading first</p>
          )}
          {form.confirmations.length > 0 && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Selected: {form.confirmations.join(', ')}</p>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes, examples, market context..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim()} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: form.name.trim() ? 'var(--accent)' : 'var(--border)', color: form.name.trim() ? '#fff' : 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>Save Setup</button>
        </div>
      </div>
    </div>
  )
}

export default function Playbook() {
  const { user } = useAuth()
  const [setups, setSetups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSetup, setEditingSetup] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    fetchSetups()
  }, [])

  useEffect(() => {
    if (!loading) setTimeout(() => setVisible(true), 10)
  }, [loading])

  async function fetchSetups() {
    const { data } = await supabase.from('playbook').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    setSetups(data || [])
    setLoading(false)
  }

  async function handleSave(form) {
    if (editingSetup) {
      const { data } = await supabase.from('playbook').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingSetup.id).select().single()
      setSetups(prev => prev.map(s => s.id === editingSetup.id ? data : s))
    } else {
      const { data } = await supabase.from('playbook').insert({ ...form, user_id: user.id }).select().single()
      setSetups(prev => [...prev, data])
    }
    setShowModal(false)
    setEditingSetup(null)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this setup?')) return
    await supabase.from('playbook').delete().eq('id', id)
    setSetups(prev => prev.filter(s => s.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function openNew() { setEditingSetup(null); setShowModal(true) }
  function openEdit(setup) { setEditingSetup(setup); setShowModal(true) }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading playbook...</div>

  return (
    <div className={`page-wrap transition-all duration-300 ${visible ? 'fade-in' : 'opacity-0'}`} style={{ padding: '28px 32px', maxWidth: '960px', margin: '0 auto' }}>
      {showModal && (
        <SetupModal
          setup={editingSetup}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingSetup(null) }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>📖 Playbook</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Your documented trading setups and rules</p>
        </div>
        <button onClick={openNew} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> New Setup
        </button>
      </div>

      {/* Empty state */}
      {setups.length === 0 && (
        <div style={{ ...cardStyle, padding: '60px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '16px' }}>📖</p>
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>No setups yet</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Document your trading setups to build a consistent edge</p>
          <button onClick={openNew} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Create First Setup</button>
        </div>
      )}

      {/* Setup cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {setups.map(setup => {
          const isExpanded = expandedId === setup.id
          const color = setup.color || '#0A84FF'
          return (
            <div key={setup.id} style={{ ...cardStyle, borderLeft: `4px solid ${color}`, overflow: 'hidden' }}>
              {/* Card header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : setup.id)}
                style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{setup.name}</h3>
                    {setup.setup_type && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: `${color}22`, color, border: `1px solid ${color}44`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{setup.setup_type}</span>
                    )}
                  </div>
                  {setup.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{setup.description}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(setup) }} style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(setup.id) }} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(255,69,58,0.3)', background: 'rgba(255,69,58,0.08)', color: '#FF453A', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                  <span style={{ fontSize: '18px', color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>›</span>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                    {/* Rules */}
                    {setup.rules?.length > 0 && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Entry Rules</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {setup.rules.map((rule, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ color, fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>{i + 1}.</span>
                              <span style={{ fontSize: '13px', color: 'var(--text)' }}>{rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Confirmations */}
                    {setup.confirmations?.length > 0 && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Required Confirmations</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {setup.confirmations.map((conf, i) => (
                            <span key={i} style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: `${color}18`, color, border: `1px solid ${color}33` }}>{conf}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Notes */}
                  {setup.notes && (
                    <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Notes</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{setup.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
