/**
 * CalendarOverlay.jsx — NYX Calendar
 *
 * Fullscreen overlay opened from the dashboard's calendar button.
 * - Month grid with today highlighted; ←/→ month navigation + TODAY
 * - Reminders (the real ones that fire) plotted on their due dates
 * - Click a day → see its reminders, add one (name + time), delete
 * - Self-updating: rechecks the date every 30s so "today" rolls over
 *   at midnight without a refresh
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getReminders, createReminder, deleteReminder } from '../services/api.js'

const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
const WEEKDAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT']

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function parseDue(iso) {
  try { return new Date(iso.replace('Z', '+00:00')) } catch { return null }
}

export default function CalendarOverlay({ open, onClose }) {
  const [today, setToday]       = useState(() => new Date())
  const [viewYM, setViewYM]     = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  const [selected, setSelected] = useState(() => dayKey(new Date()))
  const [reminders, setReminders] = useState([])
  const [name, setName]         = useState('')
  const [time, setTime]         = useState('09:00')
  const [err, setErr]           = useState('')

  // Keep "today" honest across midnight while the dashboard sits open
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setToday(prev => (dayKey(prev) === dayKey(now) ? prev : now))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await getReminders()
      setReminders(data.reminders || [])
    } catch { /* backend offline — grid still works */ }
  }, [])

  useEffect(() => {
    if (!open) return
    load()
    // Fresh view every time it opens
    const now = new Date()
    setToday(now)
    setViewYM({ y: now.getFullYear(), m: now.getMonth() })
    setSelected(dayKey(now))
    setErr('')
  }, [open, load])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const byDay = useMemo(() => {
    const map = {}
    for (const r of reminders) {
      const d = parseDue(r.due_at)
      if (!d || isNaN(d)) continue
      const k = dayKey(d)
      ;(map[k] = map[k] || []).push({ ...r, _date: d })
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a._date - b._date)
    return map
  }, [reminders])

  // 6×7 grid: leading days from previous month, trailing from next
  const cells = useMemo(() => {
    const first = new Date(viewYM.y, viewYM.m, 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [viewYM])

  const nav = (dir) => setViewYM(({ y, m }) => {
    const d = new Date(y, m + dir, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const goToday = () => {
    const now = new Date()
    setViewYM({ y: now.getFullYear(), m: now.getMonth() })
    setSelected(dayKey(now))
  }

  const addReminder = async () => {
    if (!name.trim()) { setErr('Name the reminder first.'); return }
    const dueAt = `${selected}T${time}:00`
    try {
      await createReminder(name.trim(), dueAt)
      setName(''); setErr('')
      load()
    } catch (e) {
      setErr(String(e.message || e))
    }
  }

  const removeReminder = async (id) => {
    try { await deleteReminder(id); load() } catch { /* ignore */ }
  }

  const todayKey    = dayKey(today)
  const selReminders = byDay[selected] || []
  const selDate      = new Date(selected + 'T00:00:00')
  const isNarrow     = typeof window !== 'undefined' && window.innerWidth < 900

  const mono = { fontFamily: 'Share Tech Mono, monospace' }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cal-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(3,2,12,0.72)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <motion.div
            key="cal-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(920px, 96vw)', maxHeight: '90vh', overflowY: 'auto',
              background: 'rgba(10,8,28,0.94)',
              border: '1px solid rgba(150,110,255,0.30)',
              borderRadius: 20,
              boxShadow: '0 0 60px rgba(110,60,240,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
              padding: 24,
            }}
          >
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{
                fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 22,
                letterSpacing: '0.22em', color: '#F3EDFF',
                textShadow: '0 0 24px rgba(199,166,255,0.5)',
              }}>
                {MONTHS[viewYM.m]} <span style={{ color: '#B9A6FF' }}>{viewYM.y}</span>
              </div>
              <div style={{ flex: 1 }} />
              {[['‹', () => nav(-1)], ['TODAY', goToday], ['›', () => nav(1)], ['✕', onClose]].map(([label, fn]) => (
                <div key={label} onClick={fn} style={{
                  ...mono, fontSize: label.length > 1 ? 10 : 16,
                  letterSpacing: '0.2em', color: '#C7A6FF', cursor: 'pointer',
                  border: '1px solid rgba(140,100,255,0.32)', borderRadius: 10,
                  padding: label.length > 1 ? '7px 12px' : '4px 12px',
                  background: 'rgba(20,14,44,0.6)', userSelect: 'none',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(194,155,255,0.7)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,100,255,0.32)' }}
                >{label}</div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 20, flexDirection: isNarrow ? 'column' : 'row' }}>
              {/* ── Month grid ── */}
              <div style={{ flex: 1.7 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                  {WEEKDAYS.map(w => (
                    <div key={w} style={{ ...mono, fontSize: 9, letterSpacing: '0.25em', color: '#8E86B8', textAlign: 'center', padding: '4px 0' }}>{w}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {cells.map((d) => {
                    const k        = dayKey(d)
                    const inMonth  = d.getMonth() === viewYM.m
                    const isToday  = k === todayKey
                    const isSel    = k === selected
                    const dayRems  = byDay[k] || []
                    return (
                      <div key={k} onClick={() => setSelected(k)} style={{
                        minHeight: 58, borderRadius: 10, padding: '6px 7px',
                        cursor: 'pointer', position: 'relative',
                        border: isToday
                          ? '1px solid rgba(199,166,255,0.95)'
                          : isSel ? '1px solid rgba(150,110,255,0.55)' : '1px solid rgba(140,100,255,0.14)',
                        background: isSel ? 'rgba(100,50,220,0.22)' : inMonth ? 'rgba(16,12,38,0.55)' : 'rgba(10,8,26,0.35)',
                        boxShadow: isToday ? '0 0 18px rgba(140,80,255,0.45)' : 'none',
                        opacity: inMonth ? 1 : 0.38,
                        transition: 'all 0.15s ease',
                      }}>
                        <div style={{
                          ...mono, fontSize: 11,
                          color: isToday ? '#F3EDFF' : '#B9A6FF',
                          textShadow: isToday ? '0 0 10px rgba(199,166,255,0.8)' : 'none',
                        }}>{d.getDate()}</div>
                        {dayRems.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                            {dayRems.slice(0, 4).map(r => (
                              <div key={r.id} title={r.name} style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: r.fired ? 'rgba(142,134,184,0.6)' : '#B96CFF',
                                boxShadow: r.fired ? 'none' : '0 0 6px rgba(185,108,255,0.8)',
                              }} />
                            ))}
                            {dayRems.length > 4 && (
                              <div style={{ ...mono, fontSize: 8, color: '#8E86B8' }}>+{dayRems.length - 4}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Selected day panel ── */}
              <div style={{
                flex: 1, borderLeft: isNarrow ? 'none' : '1px solid rgba(140,100,255,0.18)',
                borderTop: isNarrow ? '1px solid rgba(140,100,255,0.18)' : 'none',
                paddingLeft: isNarrow ? 0 : 20, paddingTop: isNarrow ? 16 : 0,
                display: 'flex', flexDirection: 'column', minWidth: 0,
              }}>
                <div style={{ ...mono, fontSize: 10, letterSpacing: '0.25em', color: '#8E86B8', marginBottom: 4 }}>
                  {selected === todayKey ? '● TODAY' : 'SELECTED'}
                </div>
                <div style={{
                  fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 19,
                  color: '#EDE8FF', marginBottom: 12,
                }}>
                  {selDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 260 }}>
                  {selReminders.length === 0 && (
                    <div style={{ ...mono, fontSize: 11, color: '#5E587A' }}>Nothing scheduled.</div>
                  )}
                  {selReminders.map(r => (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', marginBottom: 6, borderRadius: 10,
                      background: 'rgba(20,14,44,0.6)',
                      border: '1px solid rgba(140,100,255,0.18)',
                      opacity: r.fired ? 0.5 : 1,
                    }}>
                      <div style={{ ...mono, fontSize: 11, color: '#B96CFF', flexShrink: 0 }}>
                        {r._date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 13, color: '#EDE8FF', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}{r.fired ? ' ✓' : ''}
                      </div>
                      <div onClick={() => removeReminder(r.id)} style={{ ...mono, color: '#8E86B8', cursor: 'pointer', fontSize: 12 }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#FF7AA2' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#8E86B8' }}
                      >✕</div>
                    </div>
                  ))}
                </div>

                {/* Add reminder */}
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(140,100,255,0.18)', paddingTop: 12 }}>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: '0.25em', color: '#8E86B8', marginBottom: 8 }}>ADD REMINDER</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addReminder() }}
                      placeholder="What should I remind you?"
                      style={{
                        flex: 1, minWidth: 0, background: 'rgba(16,12,38,0.8)',
                        border: '1px solid rgba(140,100,255,0.28)', borderRadius: 10,
                        padding: '9px 12px', color: '#EDE8FF', fontSize: 13, outline: 'none',
                      }}
                    />
                    <input
                      type="time" value={time}
                      onChange={e => setTime(e.target.value)}
                      style={{
                        background: 'rgba(16,12,38,0.8)', border: '1px solid rgba(140,100,255,0.28)',
                        borderRadius: 10, padding: '9px 8px', color: '#C7A6FF',
                        ...mono, fontSize: 12, outline: 'none', colorScheme: 'dark',
                      }}
                    />
                  </div>
                  <div
                    onClick={addReminder}
                    style={{
                      ...mono, marginTop: 8, textAlign: 'center', fontSize: 11,
                      letterSpacing: '0.25em', color: '#E9D8FF', cursor: 'pointer',
                      padding: '9px 0', borderRadius: 10,
                      background: 'linear-gradient(90deg, rgba(123,77,255,0.45), rgba(185,108,255,0.35))',
                      border: '1px solid rgba(170,120,255,0.45)',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 18px rgba(140,80,255,0.4)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                  >SET REMINDER</div>
                  {err && <div style={{ ...mono, fontSize: 10, color: '#FF7AA2', marginTop: 6 }}>{err}</div>}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
