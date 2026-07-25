/**
 * AgentsPage.jsx — Agents (AI workforce control center)
 *
 * Shows Nyx's real specialized workers — Momus, Hemera, Analyst, OpenClaw —
 * as nodes connected to a central Nyx core, each showing real status,
 * real active provider, and a configuration panel for real provider/API-key
 * management with health/fallback info. Every value here comes from
 * /api/workers (core/agent_registry.py) — nothing is fabricated. If real
 * data isn't available, the UI says so rather than inventing a number.
 *
 * Replaces the previous room/character rendering (FacilityView.jsx, and the
 * abandoned PixiRoom.jsx/ThreeRoom.jsx prototypes) with a node/core layout —
 * those files are left in place but unused, not deleted, since agents_store.py
 * and the room renderers are a separate, older system this page no longer
 * calls into.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../utils/themeContext.jsx'
import {
  getWorkers, getWorker, setWorkerProviderKey, removeWorkerProviderKey,
  setWorkerPriority, testWorkerProvider, getTasks, getConstellation,
} from '../services/api.js'

const RAJ  = { fontFamily: 'Rajdhani, sans-serif' }
const MONO = { fontFamily: 'Share Tech Mono, monospace' }
const POLL_MS = 5000

const STATUS_META = {
  active:                 { label: 'Active',              color: '#22c55e' },
  processing:             { label: 'Processing',          color: '#38bdf8' },
  unavailable:            { label: 'Unavailable',         color: '#f87171' },
  missing_configuration:  { label: 'Missing Configuration', color: '#facc15' },
}

// Per-agent identity color (badge) — distinct from status color (border/bar
// below), matching the reference's varied blue/gold/purple palette per card.
const AGENT_GLYPH = { momus: '⚖', hemera: '☀', analyst: '✦', openclaw: '⚙' }
const AGENT_COLOR = { momus: '#eab308', hemera: '#f97316', analyst: '#3b82f6', openclaw: '#a855f7' }

function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Unknown', color: 'var(--color-text-disabled)' }
}

function providerLabel(worker) {
  const p = worker.providers?.find(p => p.id === worker.active_provider)
  return p?.label || worker.active_provider || 'Unknown'
}

// Lucide's Brain glyph, inlined at card scale — same path data used for
// the "Self Task" quick-launch type on the Tasks page, so this card
// reads as the same real feature, not a new icon invented for this spot.
function BrainGlyph({ size = 30, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  )
}

// Checklist glyph — same path data as the sidebar's 'check-square' icon
// (already used for the Tasks nav item), given to the Task Queue card so
// it no longer shares the Brain glyph with the Constellation card.
function ChecklistGlyph({ size = 22, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

// ── Shared vertical CTA card — icon badge, title, real stat, real status
// row, "OPEN" link. Same clickable-card treatment as the sidebar's
// "Global View" card, just stacked vertically instead of landscape so two
// of these can sit side-by-side in a narrow right-hand column.
function SideCTACard({ icon, title, statValue, statLabel, statusColor, statusText, ctaText, onClick, glowEnabled, particlesEnabled }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer', width: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        background: 'rgba(6,7,20,0.9)', borderRadius: 14, padding: '18px 14px',
        border: `1px solid ${hovered ? 'rgba(var(--color-primary-rgb),0.5)' : 'rgba(var(--color-primary-rgb),0.18)'}`,
        boxShadow: glowEnabled ? `0 0 ${hovered ? 30 : 18}px rgba(var(--color-primary-rgb),${hovered ? 0.2 : 0.10}), inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 35% 30%, var(--color-accent), var(--color-primary) 70%)',
        boxShadow: glowEnabled ? '0 0 18px rgba(var(--color-primary-rgb),0.5)' : 'none', marginBottom: 11,
      }}>
        <motion.div
          animate={particlesEnabled ? { scale: [1, 1.08, 1] } : {}}
          transition={particlesEnabled ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          {icon}
        </motion.div>
      </div>

      <div style={{ ...MONO, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 9 }}>
        {title}
      </div>

      <div style={{ ...RAJ, fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{statValue}</div>
      <div style={{ ...MONO, fontSize: 8, color: 'var(--color-text-disabled)', letterSpacing: '0.10em', marginBottom: 11 }}>{statLabel}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, boxShadow: `0 0 5px ${statusColor}` }} />
        <span style={{ ...MONO, fontSize: 8, color: 'var(--color-text-disabled)', letterSpacing: '0.10em' }}>{statusText}</span>
      </div>

      <span style={{ ...MONO, fontSize: 8, color: hovered ? 'var(--color-accent)' : 'var(--color-primary)', letterSpacing: '0.12em', transition: 'color 0.2s' }}>
        {ctaText}
      </span>
    </div>
  )
}

// ── Memory Constellation CTA card — real stats from /api/constellation.
// Carries the Brain glyph (Constellation is Nyx's actual memory/"brain"
// feature) — the Task Queue card below gets its own distinct icon instead.
function ConstellationCard({ onNavigate, glowEnabled, particlesEnabled }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = () => getConstellation().then(r => { if (!cancelled) setStats(r.stats || null) }).catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const total = stats ? (stats.total_memories ?? 0) : null

  return (
    <SideCTACard
      icon={<BrainGlyph size={22} color="#fff" />}
      title="Memory Constellation"
      statValue={total === null ? '—' : total}
      statLabel={total === null ? 'LOADING' : total === 0 ? 'NO MEMORIES YET' : `REAL MEMOR${total === 1 ? 'Y' : 'IES'}`}
      statusColor={total > 0 ? '#22c55e' : 'var(--color-text-disabled)'}
      statusText={total > 0 ? 'LIVE' : 'EMPTY'}
      ctaText="OPEN CONSTELLATION →"
      onClick={() => onNavigate?.('memory')}
      glowEnabled={glowEnabled}
      particlesEnabled={particlesEnabled}
    />
  )
}

// ── Task Queue CTA card — real counts from /api/tasks (task_store.py).
// This is the agent plugin's missing entry point into real, self-directed
// tasks — no fabricated queue, no invented task rows.
function TasksCard({ onNavigate, glowEnabled, particlesEnabled }) {
  const [tasks, setTasks] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = () => getTasks().then(r => { if (!cancelled) setTasks(r.tasks || []) }).catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const counts = (tasks || []).reduce((acc, t) => {
    const key = (t.status || '').toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const running = counts.running || 0
  const queued  = counts.queued || 0
  const total   = (tasks || []).length

  return (
    <SideCTACard
      icon={<ChecklistGlyph size={22} color="#fff" />}
      title="Agent Task Queue"
      statValue={tasks === null ? '—' : total}
      statLabel={tasks === null ? 'LOADING' : total === 0 ? 'NO TASKS YET' : 'TOTAL TASKS'}
      statusColor={running > 0 ? '#38bdf8' : '#22c55e'}
      statusText={running > 0 ? `${running} RUNNING` : queued > 0 ? `${queued} QUEUED` : 'IDLE'}
      ctaText="OPEN TASKS →"
      onClick={() => onNavigate?.('tasks')}
      glowEnabled={glowEnabled}
      particlesEnabled={particlesEnabled}
    />
  )
}

// ── Top stat box — matches the reference's boxed stat readouts. Every
// value passed in is real (agent count, live status counts), never invented.
function StatBox({ label, value, color, dot }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
      background: 'rgba(4,5,18,0.7)', border: '1px solid rgba(var(--color-primary-rgb), 0.18)',
      borderRadius: 10,
    }}>
      <div>
        <div style={{ ...MONO, fontSize: 8, color: 'var(--color-text-disabled)', letterSpacing: '0.14em' }}>{label}</div>
        <div style={{ ...RAJ, fontSize: 16, fontWeight: 700, color: color || 'var(--color-text)' }}>{value}</div>
      </div>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />}
    </div>
  )
}

// Dot positions computed directly in JS (px offsets from center) rather
// than CSS transform chains — easier to verify correct, no risk of a
// transform-order bug silently making dots invisible/misplaced.
function ringDots(size, count, colorful) {
  const r = size / 2
  return Array.from({ length: count }).map((_, i) => {
    const angle = (2 * Math.PI * i) / count
    const big = i % 3 === 0
    return {
      key: i,
      left: r * Math.cos(angle),
      top: r * Math.sin(angle),
      size: big && colorful ? 5 : 3,
      accent: big && colorful,
    }
  })
}

// ── Central Nyx core — ambient glow wash + layered rings scattered with
// small nodes + a faceted gem, matching the reference image's core ──
function CoreNode({ particlesEnabled, glowEnabled }) {
  const RINGS = [
    { size: 240, dots: 12 },
    { size: 192, dots: 9 },
    { size: 146, dots: 7 },
    { size: 100, dots: 0 },
  ]
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
      {/* ambient radial wash behind the whole core, like the reference's glow */}
      {glowEnabled && (
        <div style={{
          position: 'absolute', width: 480, height: 480, marginLeft: -240, marginTop: -240,
          background: 'radial-gradient(circle, rgba(var(--color-primary-rgb),0.16), rgba(var(--color-primary-rgb),0) 68%)',
          pointerEvents: 'none',
        }} />
      )}

      {RINGS.map(({ size, dots }, i) => (
        <motion.div
          key={size}
          animate={particlesEnabled ? { rotate: i % 2 === 0 ? 360 : -360 } : {}}
          transition={particlesEnabled ? { duration: 26 + i * 12, repeat: Infinity, ease: 'linear' } : {}}
          style={{
            position: 'absolute', width: size, height: size,
            marginLeft: -size / 2, marginTop: -size / 2, borderRadius: '50%',
            border: `1px solid rgba(var(--color-primary-rgb), ${0.5 - i * 0.07})`,
          }}
        >
          {ringDots(size, dots, true).map(d => (
            <div key={d.key} style={{
              position: 'absolute', width: d.size, height: d.size, marginLeft: -d.size / 2, marginTop: -d.size / 2,
              borderRadius: '50%',
              background: d.accent ? 'var(--color-accent)' : 'rgba(255,255,255,0.85)',
              boxShadow: glowEnabled ? (d.accent ? '0 0 8px var(--color-accent)' : '0 0 4px rgba(255,255,255,0.6)') : 'none',
              left: size / 2 + d.left, top: size / 2 + d.top,
            }} />
          ))}
        </motion.div>
      ))}

      {/* faceted gem — layered rotated squares forming a crystal look */}
      <motion.div
        animate={particlesEnabled ? { scale: [1, 1.08, 1] } : {}}
        transition={particlesEnabled ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : {}}
      >
        <div style={{
          position: 'absolute', width: 58, height: 58, marginLeft: -29, marginTop: -29,
          transform: 'rotate(45deg)',
          background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary))',
          boxShadow: glowEnabled
            ? '0 0 40px rgba(var(--color-primary-rgb), 0.85), 0 0 90px rgba(var(--color-primary-rgb), 0.35)'
            : 'none',
          borderRadius: 8, opacity: 0.9,
        }} />
        <div style={{
          position: 'absolute', width: 58, height: 58, marginLeft: -29, marginTop: -29,
          transform: 'rotate(20deg)',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          borderRadius: 8, opacity: 0.4,
        }} />
        <div style={{
          position: 'absolute', width: 30, height: 30, marginLeft: -15, marginTop: -15,
          transform: 'rotate(45deg)', background: 'rgba(255,255,255,0.92)', borderRadius: 5,
          boxShadow: glowEnabled ? '0 0 24px rgba(255,255,255,0.95)' : 'none',
        }} />
      </motion.div>
    </div>
  )
}

// ── One worker node/card — circular per-agent-colored badge + status
// bar (bar fill reflects real state; the number was deliberately dropped
// per your call — no invented precision score) ──
function WorkerNode({ worker, x, y, onOpen, glowEnabled }) {
  const meta = statusMeta(worker.status)
  const badgeColor = AGENT_COLOR[worker.id] || 'var(--color-primary)'
  const barFill = worker.status === 'active' ? 100 : worker.status === 'processing' ? 55 : 8
  return (
    <div
      onClick={() => onOpen(worker.id)}
      style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)',
        width: 196, cursor: 'pointer',
        background: 'rgba(6,7,20,0.9)', border: `1px solid ${badgeColor}55`,
        borderRadius: 14, padding: '13px 15px 12px',
        boxShadow: glowEnabled ? `0 0 20px ${badgeColor}1c, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        transition: 'transform 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.035)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 30%, ${badgeColor}, ${badgeColor}66 70%)`,
          boxShadow: glowEnabled ? `0 0 16px ${badgeColor}77` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 19, color: '#fff',
        }}>{AGENT_GLYPH[worker.id] || '○'}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...RAJ, fontSize: 14.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text)' }}>
            {worker.name}
          </div>
          <div style={{ ...MONO, fontSize: 8.5, color: badgeColor, letterSpacing: '0.05em', marginTop: 1 }}>{worker.engine_kind}</div>
        </div>
      </div>

      <div style={{
        ...MONO, fontSize: 8.5, color: 'var(--color-text-disabled)', lineHeight: 1.5,
        marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {worker.purpose}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, boxShadow: glowEnabled ? `0 0 6px ${meta.color}` : 'none' }} />
        <span style={{ ...MONO, fontSize: 8.5, color: meta.color, letterSpacing: '0.06em' }}>{meta.label.toUpperCase()}</span>
      </div>

      {/* Status bar — fill reflects real live state, no invented number */}
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 8 }}>
        <motion.div
          animate={{ width: `${barFill}%` }}
          transition={{ duration: 0.6 }}
          style={{ height: '100%', background: badgeColor, boxShadow: glowEnabled ? `0 0 6px ${badgeColor}` : 'none' }}
        />
      </div>

      <div style={{ ...MONO, fontSize: 8, color: 'var(--color-text-disabled)' }}>via {providerLabel(worker)}</div>
    </div>
  )
}

// ── SVG connectors — solid glowing bent path (core -> elbow -> card) per
// agent's own identity color, with a traveling pulse when animations are
// on, matching the reference's brighter, richer-colored links ──
function Connectors({ positions, glowEnabled, particlesEnabled }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <filter id="connectorGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {positions.map(({ id, x, y, color }) => {
        const elbowX = 50 + (x - 50) * 0.5
        const elbowY = 50 + (y - 50) * 0.62
        const path = `M 50 50 L ${elbowX} ${elbowY} L ${x} ${y}`
        return (
          <g key={id} filter={glowEnabled ? 'url(#connectorGlow)' : undefined}>
            <path d={path} fill="none" stroke={color} strokeWidth="0.45" strokeOpacity={glowEnabled ? 0.75 : 0.4} strokeLinecap="round" />
            {particlesEnabled && (
              <circle r="0.7" fill="#fff" opacity={0.9}>
                <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
              </circle>
            )}
            <circle cx={elbowX} cy={elbowY} r="0.6" fill="#fff" opacity={glowEnabled ? 0.9 : 0.55} />
            <circle cx={x} cy={y} r="0.55" fill={color} opacity={glowEnabled ? 0.95 : 0.6} />
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════
// Detail modal — provider config, key management, fallback order
// ═══════════════════════════════════════════════════════
function ProviderCard({ worker, provider, onChanged }) {
  const [keyInput, setKeyInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const isPrimary = worker.provider_order[0] === provider.id

  const handleSave = async () => {
    if (!keyInput.trim()) return
    setBusy(true)
    try {
      await setWorkerProviderKey(worker.id, provider.id, keyInput.trim())
      setKeyInput('')
      setTestResult(null)
      await onChanged()
    } catch (e) {
      setTestResult({ ok: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      await removeWorkerProviderKey(worker.id, provider.id)
      setTestResult(null)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setBusy(true)
    setTestResult(null)
    try {
      const res = await testWorkerProvider(worker.id, provider.id)
      setTestResult(res)
    } catch (e) {
      setTestResult({ ok: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  const handleMakePrimary = async () => {
    setBusy(true)
    try {
      const rest = worker.provider_order.filter(p => p !== provider.id)
      await setWorkerPriority(worker.id, [provider.id, ...rest])
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      border: `1px solid ${isPrimary ? 'rgba(var(--color-primary-rgb), 0.4)' : 'rgba(var(--color-primary-rgb), 0.14)'}`,
      borderRadius: 12, padding: '13px 15px', marginBottom: 10,
      background: isPrimary ? 'rgba(var(--color-primary-rgb), 0.07)' : 'rgba(8,10,26,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...RAJ, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text)' }}>{provider.label}</span>
          {isPrimary && (
            <span style={{ ...MONO, fontSize: 7.5, color: 'var(--color-primary)', border: '1px solid rgba(var(--color-primary-rgb),0.4)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.08em' }}>PRIMARY</span>
          )}
        </div>
        <span style={{ ...MONO, fontSize: 8.5, color: provider.configured ? '#22c55e' : 'var(--color-text-disabled)' }}>
          {provider.configured ? 'CONNECTED' : provider.requires_key ? 'NOT CONNECTED' : 'BUILT-IN'}
        </span>
      </div>

      {provider.masked_key && (
        <div style={{ ...MONO, fontSize: 9, color: 'var(--color-text-disabled)', marginBottom: 6 }}>Key: {provider.masked_key}</div>
      )}

      {provider.requires_key && !provider.healthy && (
        <div style={{ ...MONO, fontSize: 8.5, color: '#facc15', marginBottom: 6 }}>
          Unhealthy — {provider.consecutive_failures} recent failure(s), cooling down before retry
        </div>
      )}

      {provider.requires_key && !provider.configured && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
            placeholder={`${provider.label} API key`}
            style={{
              flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(var(--color-primary-rgb),0.25)',
              borderRadius: 6, padding: '6px 9px', color: 'var(--color-text)', fontSize: 11, ...MONO,
            }}
          />
          <button onClick={handleSave} disabled={busy || !keyInput.trim()} style={btnStyle('primary')}>Save</button>
        </div>
      )}

      {testResult && (
        <div style={{ ...MONO, fontSize: 8.5, color: testResult.ok ? '#22c55e' : '#f87171', marginBottom: 6 }}>
          {testResult.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={handleTest} disabled={busy} style={btnStyle('ghost')}>Test Connection</button>
        {!isPrimary && (
          <button onClick={handleMakePrimary} disabled={busy} style={btnStyle('ghost')}>Set as Primary</button>
        )}
        {provider.requires_key && provider.configured && (
          <button onClick={handleRemove} disabled={busy} style={btnStyle('danger')}>Disconnect</button>
        )}
      </div>
    </div>
  )
}

function btnStyle(kind) {
  const base = {
    ...RAJ, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
    borderRadius: 6, padding: '6px 11px', cursor: 'pointer',
  }
  if (kind === 'primary') return { ...base, background: 'var(--color-primary)', border: 'none', color: '#fff' }
  if (kind === 'danger')  return { ...base, background: 'none', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }
  return { ...base, background: 'none', border: '1px solid rgba(var(--color-primary-rgb),0.3)', color: 'var(--color-text-muted)' }
}

function WorkerDetailModal({ workerId, onClose }) {
  const [worker, setWorker] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      const w = await getWorker(workerId)
      setWorker(w)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [workerId])

  useEffect(() => { reload() }, [reload])

  const meta = worker ? statusMeta(worker.status) : null

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(5px)' }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(4,5,18,0.98)', border: '1px solid rgba(var(--color-primary-rgb), 0.3)',
          borderRadius: 14, padding: 26, maxWidth: 520, width: '92%', maxHeight: '84vh', overflowY: 'auto',
          boxShadow: '0 0 60px rgba(var(--color-primary-rgb), 0.15)',
        }}
      >
        {error && <div style={{ ...MONO, fontSize: 11, color: '#f87171' }}>Could not load agent: {error}</div>}
        {!worker && !error && <div style={{ ...MONO, fontSize: 11, color: 'var(--color-text-disabled)' }}>Loading...</div>}

        {worker && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ ...RAJ, fontSize: 19, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-text)' }}>{worker.name}</div>
              <button onClick={onClose} style={{ ...btnStyle('ghost'), padding: '4px 10px' }}>Close</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
              <span style={{ ...MONO, fontSize: 9, color: meta.color, letterSpacing: '0.08em' }}>{meta.label.toUpperCase()}</span>
              <span style={{ ...MONO, fontSize: 9, color: 'var(--color-text-disabled)' }}> · currently via {providerLabel(worker)}</span>
            </div>

            <div style={{ ...MONO, fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              {worker.purpose}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ ...RAJ, fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-text-disabled)', marginBottom: 8 }}>Tools</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {worker.tools.map(t => (
                  <span key={t} style={{ ...MONO, fontSize: 8.5, color: 'var(--color-text-muted)', border: '1px solid rgba(var(--color-primary-rgb),0.2)', borderRadius: 5, padding: '3px 7px' }}>{t}</span>
                ))}
              </div>
            </div>

            <div>
              <div style={{ ...RAJ, fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-text-disabled)', marginBottom: 8 }}>
                Providers &amp; Fallback Order
              </div>
              <div style={{ ...MONO, fontSize: 8.5, color: 'var(--color-text-disabled)', marginBottom: 10 }}>
                Order: {worker.provider_order.map(p => worker.providers.find(x => x.id === p)?.label || p).join(' → ')}
              </div>
              {worker.providers.map(p => (
                <ProviderCard key={p.id} worker={worker} provider={p} onChanged={reload} />
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════
export default function AgentsPage({ onNavigate }) {
  const { visualPrefs } = useTheme()
  const [workers, setWorkers] = useState(null)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const { workers } = await getWorkers()
      setWorkers(workers)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [load])

  const glowEnabled = visualPrefs.glowEffectsEnabled
  const particlesEnabled = visualPrefs.particlesEnabled

  // Radial layout — angle from top, clockwise, evenly spaced.
  const positions = (workers || []).map((w, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, (workers || []).length) - Math.PI / 2
    const rx = 38, ry = 34
    return {
      id: w.id,
      x: 50 + rx * Math.cos(angle),
      y: 50 + ry * Math.sin(angle),
      color: AGENT_COLOR[w.id] || 'var(--color-primary)',
    }
  })

  const activeCount = (workers || []).filter(w => w.status === 'active' || w.status === 'processing').length
  const unavailableCount = (workers || []).filter(w => w.status === 'unavailable' || w.status === 'missing_configuration').length

  return (
    <div style={{ padding: '24px 28px', height: '100%', overflowY: 'auto', display: 'flex', gap: 22 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...RAJ, fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text)' }}>AI Workforce</div>
            <div style={{ ...MONO, fontSize: 9.5, color: 'var(--color-text-disabled)', marginTop: 2 }}>
              Nyx's real specialized workers — click a node to configure its providers.
            </div>
          </div>
          {workers && (
            <div style={{ display: 'flex', gap: 10 }}>
              <StatBox label="AGENTS" value={workers.length} color="var(--color-accent)" />
              <StatBox label="ACTIVE" value={activeCount} color="#22c55e" dot />
              {unavailableCount > 0 && <StatBox label="UNAVAILABLE" value={unavailableCount} color="#f87171" dot />}
              <StatBox
                label="OLLAMA"
                value={workers.some(w => w.ollama_reachable) ? 'Reachable' : 'Unreachable'}
                color={workers.some(w => w.ollama_reachable) ? '#22c55e' : '#f87171'}
                dot
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ ...MONO, fontSize: 11, color: '#f87171', padding: '10px 14px', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, marginBottom: 16 }}>
            Could not reach Nyx backend: {error}
          </div>
        )}

        {!workers && !error && (
          <div style={{ ...MONO, fontSize: 11, color: 'var(--color-text-disabled)' }}>Loading agents...</div>
        )}

        {workers && workers.length === 0 && (
          <div style={{ ...MONO, fontSize: 11, color: 'var(--color-text-disabled)' }}>No agents registered.</div>
        )}

        {workers && workers.length > 0 && (
          <div style={{ position: 'relative', width: '100%', height: 620, minWidth: 700 }}>
            <Connectors positions={positions} glowEnabled={glowEnabled} particlesEnabled={particlesEnabled} />
            <CoreNode particlesEnabled={particlesEnabled} glowEnabled={glowEnabled} />
            <div style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, 105px)',
              ...MONO, fontSize: 8.5, color: 'var(--color-text-disabled)', letterSpacing: '0.14em',
            }}>NYX CORE</div>
            {workers.map((w, i) => (
              <WorkerNode key={w.id} worker={w} x={positions[i].x} y={positions[i].y} onOpen={setOpenId} glowEnabled={glowEnabled} />
            ))}
          </div>
        )}
      </div>

      {/* Right-hand vertical CTA column — Constellation ("the brain") above
          the Task Queue card, same narrow width, both real-data-driven. */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 2 }}>
        <ConstellationCard onNavigate={onNavigate} glowEnabled={glowEnabled} particlesEnabled={particlesEnabled} />
        <TasksCard onNavigate={onNavigate} glowEnabled={glowEnabled} particlesEnabled={particlesEnabled} />
      </div>

      <AnimatePresence>
        {openId && <WorkerDetailModal workerId={openId} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </div>
  )
}
