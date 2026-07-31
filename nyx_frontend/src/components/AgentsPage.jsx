/**
 * AgentsPage.jsx — Agents (AI workforce command center)
 *
 * Shows Nyx's real specialized workers — Momus, Hemera, Analyst, OpenClaw —
 * as modules connected to a central Nyx core, each showing real status,
 * real active provider, and a configuration panel for real provider/API-key
 * management with health/fallback info. Supporting panels (Memory Link,
 * Provider Health, Task Queue, Workforce Activity) are all backed by real
 * endpoints — /api/workers, /api/tasks, /api/constellation, /api/events.
 * If real data isn't available or is empty, the UI says so rather than
 * inventing a number, a log entry, or a percentage.
 *
 * Visual language is inspired by a denser reference "AI Core" mockup, but
 * only its density/hierarchy/lighting principles were adapted — the real
 * four-agent roster, real data, and existing NYX shell are unchanged. No
 * fictional agents, metrics, or activity were added.
 *
 * Replaces the previous room/character rendering (FacilityView.jsx, and the
 * abandoned PixiRoom.jsx/ThreeRoom.jsx prototypes) with a node/core layout —
 * those files are left in place but unused, not deleted, since agents_store.py
 * and the room renderers are a separate, older system this page no longer
 * calls into.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../utils/themeContext.jsx'
import {
  getWorkers, getWorker, setWorkerProviderKey, removeWorkerProviderKey,
  setWorkerPriority, testWorkerProvider, getTasks, getConstellation,
  getCategoryCounts, getEvents,
} from '../services/api.js'

const RAJ  = { fontFamily: 'Rajdhani, sans-serif' }
const MONO = { fontFamily: 'Share Tech Mono, monospace' }
const WORKERS_POLL_MS = 5000
const SIDE_DATA_POLL_MS = 15000

const STATUS_META = {
  active:                 { label: 'Active',              color: '#22c55e' },
  processing:             { label: 'Processing',          color: '#38bdf8' },
  unavailable:            { label: 'Unavailable',         color: '#f87171' },
  missing_configuration:  { label: 'Missing Configuration', color: '#facc15' },
}

// Per-agent identity color (icon glow / border / connection route) — kept
// distinct from status color (green/yellow/red/blue), matching the
// reference's varied palette-per-module without breaking the NYX system.
const AGENT_GLYPH = { momus: '⚖', hemera: '☀', analyst: '✦', openclaw: '⚙' }
const AGENT_COLOR = { momus: '#eab308', hemera: '#f97316', analyst: '#3b82f6', openclaw: '#a855f7' }

function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Unknown', color: 'var(--color-text-disabled)' }
}

function activeProviderOf(worker) {
  return worker.providers?.find(p => p.id === worker.active_provider)
}

function providerLabel(worker) {
  return activeProviderOf(worker)?.label || worker.active_provider || 'Unknown'
}

// Real key-connection state for the worker's currently active provider —
// never invented, directly reflects provider.requires_key/configured.
function keyStateOf(worker) {
  const p = activeProviderOf(worker)
  if (!p) return { label: 'UNKNOWN', color: 'var(--color-text-disabled)' }
  if (!p.requires_key) return { label: 'BUILT-IN', color: 'var(--color-text-disabled)' }
  return p.configured
    ? { label: 'KEY CONNECTED', color: '#22c55e' }
    : { label: 'KEY MISSING', color: '#facc15' }
}

function relTime(iso) {
  if (!iso) return null
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 5) return 'just now'
  if (d < 60) return `${Math.floor(d)}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

// ═══════════════════════════════════════════════════════
// Icons — inline SVGs at a consistent stroke weight, no external icon
// dependency for this page's small badges.
// ═══════════════════════════════════════════════════════

function BrainGlyph({ size = 22, color = 'currentColor' }) {
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

// Same path data as the sidebar's 'check-square' icon (Tasks nav item).
function ChecklistGlyph({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

function ActivityGlyph({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <polyline points="3 12 8 12 10 6 14 18 16 12 21 12" />
    </svg>
  )
}

// Same path data as the sidebar's 'plug' icon.
function PlugGlyph({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0V8zM12 17v5" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════
// Top command strip — real values only. Each chip: label, strong value,
// real status dot, subtle icon.
// ═══════════════════════════════════════════════════════
function StatusChip({ icon, label, value, color, dotColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 15px', height: 44, boxSizing: 'border-box',
      background: 'rgba(4,5,18,0.72)', border: '1px solid rgba(var(--color-primary-rgb), 0.18)',
      borderRadius: 10, borderTop: '1px solid rgba(255,255,255,0.07)',
    }}>
      <span style={{ color: color || 'var(--color-text-muted)', opacity: 0.85, display: 'flex' }}>{icon}</span>
      <div>
        <div style={{ ...MONO, fontSize: 7.5, color: 'var(--color-text-disabled)', letterSpacing: '0.16em' }}>{label}</div>
        <div style={{ ...RAJ, fontSize: 15, fontWeight: 700, color: color || 'var(--color-text)', lineHeight: 1.25, display: 'flex', alignItems: 'center', gap: 6 }}>
          {value}
          {dotColor && <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, boxShadow: `0 0 5px ${dotColor}` }} />}
        </div>
      </div>
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

// ═══════════════════════════════════════════════════════
// Central NYX core — layered rings (independent speeds), radial ports
// facing each real agent, faceted core, readable state label.
// ═══════════════════════════════════════════════════════
function WorkforceCore({ particlesEnabled, glowEnabled, activeCount, totalCount, ports }) {
  const RINGS = [
    { size: 240, dots: 12, speed: 26 },
    { size: 192, dots: 9,  speed: -38 },
    { size: 146, dots: 7,  speed: 50 },
    { size: 100, dots: 0,  speed: -64 },
  ]
  const allOnline = totalCount > 0 && activeCount === totalCount
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
      {glowEnabled && (
        <div style={{
          position: 'absolute', width: 480, height: 480, marginLeft: -240, marginTop: -240,
          background: 'radial-gradient(circle, rgba(var(--color-primary-rgb),0.16), rgba(var(--color-primary-rgb),0) 68%)',
          pointerEvents: 'none',
        }} />
      )}

      {RINGS.map(({ size, dots, speed }, i) => (
        <motion.div
          key={size}
          animate={particlesEnabled ? { rotate: speed > 0 ? 360 : -360 } : {}}
          transition={particlesEnabled ? { duration: Math.abs(speed), repeat: Infinity, ease: 'linear' } : {}}
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

      {/* Connection ports — one per real agent, facing its actual direction */}
      {ports.map(p => (
        <div key={p.id} style={{
          position: 'absolute', width: 8, height: 8, borderRadius: 2,
          marginLeft: -4, marginTop: -4, transform: `rotate(45deg)`,
          left: 122 * Math.cos(p.angle), top: 122 * Math.sin(p.angle),
          background: p.hot ? p.color : 'rgba(255,255,255,0.25)',
          boxShadow: glowEnabled && p.hot ? `0 0 8px ${p.color}` : 'none',
          transition: 'background 0.2s, box-shadow 0.2s',
        }} />
      ))}

      {/* Faceted core gem */}
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

      {/* Readable state label */}
      <div style={{
        position: 'absolute', left: 0, top: 118, transform: 'translateX(-50%)', textAlign: 'center', width: 160,
      }}>
        <div style={{ ...MONO, fontSize: 8.5, color: 'var(--color-text-disabled)', letterSpacing: '0.18em' }}>NYX CORE</div>
        <div style={{ ...MONO, fontSize: 8, color: allOnline ? '#22c55e' : 'var(--color-text-disabled)', letterSpacing: '0.1em', marginTop: 2 }}>
          {totalCount === 0 ? 'NO WORKERS' : `${activeCount}/${totalCount} ONLINE`}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Agent module card — real info: icon w/ activity ring, name, role,
// purpose, status, provider, key state, configure action.
// ═══════════════════════════════════════════════════════
function AgentModuleCard({ worker, x, y, onOpen, onHover, hoveredId, glowEnabled, particlesEnabled }) {
  const meta = statusMeta(worker.status)
  const badgeColor = AGENT_COLOR[worker.id] || 'var(--color-primary)'
  const isActive = worker.status === 'active' || worker.status === 'processing'
  const keyState = keyStateOf(worker)
  const dimmed = hoveredId && hoveredId !== worker.id

  return (
    <div
      onClick={() => onOpen(worker.id)}
      onMouseEnter={() => onHover(worker.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)',
        width: 188, cursor: 'pointer', boxSizing: 'border-box',
        background: 'linear-gradient(180deg, rgba(14,15,32,0.92), rgba(6,7,20,0.92))',
        border: `1px solid ${dimmed ? 'rgba(var(--color-primary-rgb),0.14)' : badgeColor + '66'}`,
        borderTop: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 13, padding: '12px 14px 11px',
        boxShadow: glowEnabled ? `0 0 ${dimmed ? 10 : 20}px ${badgeColor}${dimmed ? '0d' : '22'}, 0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        opacity: dimmed ? 0.55 : 1,
        transition: 'transform 0.15s, border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(0.985)'}
      onMouseUp={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.03)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
          {isActive && (
            <motion.div
              animate={particlesEnabled ? { rotate: 360 } : {}}
              transition={particlesEnabled ? { duration: 6, repeat: Infinity, ease: 'linear' } : {}}
              style={{
                position: 'absolute', inset: -3, borderRadius: '50%',
                border: `1.5px solid transparent`, borderTopColor: badgeColor, borderRightColor: `${badgeColor}55`,
              }}
            />
          )}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${badgeColor}, ${badgeColor}66 70%)`,
            boxShadow: glowEnabled ? `0 0 14px ${badgeColor}77` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, color: '#fff',
          }}>{AGENT_GLYPH[worker.id] || '○'}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...RAJ, fontSize: 14.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text)' }}>
            {worker.name}
          </div>
          <div style={{ ...MONO, fontSize: 8.5, color: badgeColor, letterSpacing: '0.05em', marginTop: 1 }}>{worker.engine_kind}</div>
        </div>
      </div>

      <div style={{
        ...RAJ, fontSize: 10.5, color: 'var(--color-text-secondary)', lineHeight: 1.45,
        marginBottom: 9, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {worker.purpose}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, boxShadow: glowEnabled ? `0 0 6px ${meta.color}` : 'none' }} />
          <span style={{ ...MONO, fontSize: 8.5, color: meta.color, letterSpacing: '0.05em' }}>{meta.label.toUpperCase()}</span>
        </div>
        <span style={{ ...MONO, fontSize: 7, color: keyState.color, letterSpacing: '0.04em' }}>{keyState.label}</span>
      </div>

      <div style={{ ...MONO, fontSize: 8, color: 'var(--color-text-disabled)', marginBottom: 8 }}>via {providerLabel(worker)}</div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px 0',
        borderRadius: 6, border: `1px solid ${badgeColor}33`, background: `${badgeColor}0d`,
        ...MONO, fontSize: 7.5, fontWeight: 600, color: badgeColor, letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        Configure
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Connection routing — core edge -> short straight run -> right-angle
// bend with a junction point -> curved final approach into the card.
// Reads as routed data infrastructure, not a single laser beam.
// ═══════════════════════════════════════════════════════
function AgentConnections({ positions, glowEnabled, particlesEnabled, hoveredId }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <filter id="connectorGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.55" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {positions.map(({ id, x, y, color }) => {
        const dx = x - 50, dy = y - 50
        // First bend: short straight run out from the core along the
        // dominant axis, then a right-angle turn.
        const midX = 50 + dx * 0.42
        const midY = 50 + dy * 0.72
        // Second bend closer to the card, then a short curved approach.
        const nearX = 50 + dx * 0.82
        const nearY = 50 + dy * 0.90
        const path = `M 50 50 L ${midX} ${midY} L ${nearX} ${nearY} Q ${x} ${nearY + (y - nearY) * 0.3} ${x} ${y}`
        const isHot = !hoveredId || hoveredId === id
        const opacity = (glowEnabled ? 0.75 : 0.4) * (isHot ? 1 : 0.28)
        return (
          <g key={id} filter={glowEnabled ? 'url(#connectorGlow)' : undefined}>
            <path d={path} fill="none" stroke={color} strokeWidth={isHot && hoveredId ? 0.65 : 0.42} strokeOpacity={opacity} strokeLinecap="round" />
            {particlesEnabled && isHot && (
              <circle r="0.65" fill="#fff" opacity={0.9}>
                <animateMotion dur="2.4s" repeatCount="indefinite" path={path} />
              </circle>
            )}
            <circle cx={midX} cy={midY} r="0.5" fill="#fff" opacity={(glowEnabled ? 0.7 : 0.4) * (isHot ? 1 : 0.3)} />
            <circle cx={nearX} cy={nearY} r="0.5" fill="#fff" opacity={(glowEnabled ? 0.7 : 0.4) * (isHot ? 1 : 0.3)} />
            <circle cx={x} cy={y} r="0.55" fill={color} opacity={(glowEnabled ? 0.95 : 0.6) * (isHot ? 1 : 0.35)} />
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════
// Detail modal — provider config, key management, fallback order
// (unchanged behavior — real API calls, no regressions)
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
// Right-hand operations column — compact, real-data panels.
// ═══════════════════════════════════════════════════════

function OpsPanel({ title, icon, action, children }) {
  return (
    <div style={{
      background: 'rgba(6,7,20,0.85)', border: '1px solid rgba(var(--color-primary-rgb),0.16)',
      borderTop: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--color-primary)', opacity: 0.8, display: 'flex' }}>{icon}</span>
          <span style={{ ...MONO, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyRow({ text }) {
  return <div style={{ ...MONO, fontSize: 9, color: 'var(--color-text-disabled)', padding: '4px 0' }}>{text}</div>
}

// WORKFORCE STATUS — 3-line real summary (agents online, ollama, queued)
function WorkforceStatusPanel({ activeCount, totalCount, ollamaReachable, queuedCount }) {
  const rows = [
    { label: `${activeCount}/${totalCount} agents active`, ok: totalCount > 0 && activeCount === totalCount },
    { label: ollamaReachable ? 'Ollama online' : 'Ollama offline', ok: ollamaReachable },
    { label: `${queuedCount} queued task${queuedCount === 1 ? '' : 's'}`, ok: true },
  ]
  return (
    <OpsPanel title="Workforce Status" icon={<ActivityGlyph size={13} />}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: r.ok ? '#22c55e' : '#f87171', boxShadow: `0 0 5px ${r.ok ? '#22c55e' : '#f87171'}` }} />
          <span style={{ ...RAJ, fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{r.label}</span>
        </div>
      ))}
    </OpsPanel>
  )
}

// MEMORY LINK — compact real stats + open action
function MemoryLinkPanel({ stats, categoryCount, onNavigate }) {
  const total = stats?.total_memories ?? null
  return (
    <OpsPanel title="Memory Link" icon={<BrainGlyph size={13} />}>
      {total === null ? (
        <EmptyRow text="Loading..." />
      ) : total === 0 ? (
        <EmptyRow text="No memories yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 9 }}>
          <StatRow label="Total memories" value={total} />
          <StatRow label="Active categories" value={categoryCount ?? '—'} />
          <StatRow label="Relationships" value={stats.total_edges ?? '—'} />
          {stats.last_synced && <StatRow label="Last synced" value={relTime(stats.last_synced)} />}
        </div>
      )}
      <button onClick={() => onNavigate?.('memory')} style={panelLinkStyle}>Open Constellation →</button>
    </OpsPanel>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ ...RAJ, fontSize: 10.5, color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ ...MONO, fontSize: 10, color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

const panelLinkStyle = {
  ...MONO, fontSize: 8.5, color: 'var(--color-primary)', letterSpacing: '0.08em',
  background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2,
}

// PROVIDER HEALTH — real per-agent active provider + key state
function ProviderHealthPanel({ workers }) {
  return (
    <OpsPanel title="Provider Health" icon={<PlugGlyph size={13} />}>
      {(workers || []).map(w => {
        const keyState = keyStateOf(w)
        const badgeColor = AGENT_COLOR[w.id] || 'var(--color-primary)'
        return (
          <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: badgeColor, flexShrink: 0 }} />
              <span style={{ ...RAJ, fontSize: 10.5, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.name} <span style={{ color: 'var(--color-text-disabled)' }}>· {providerLabel(w)}</span>
              </span>
            </div>
            <span style={{ ...MONO, fontSize: 7.5, color: keyState.color, letterSpacing: '0.04em', flexShrink: 0, marginLeft: 6 }}>{keyState.label}</span>
          </div>
        )
      })}
      {(!workers || workers.length === 0) && <EmptyRow text="No agents registered." />}
    </OpsPanel>
  )
}

// TASK QUEUE — compact real list from task_store.py (/api/tasks)
function TaskQueuePanel({ tasks, onNavigate }) {
  const list = tasks || []
  const visible = list.slice(0, 4)
  return (
    <OpsPanel
      title="Task Queue" icon={<ChecklistGlyph size={13} />}
      action={<span style={{ ...MONO, fontSize: 9, color: 'var(--color-text-disabled)' }}>{list.length}</span>}
    >
      {tasks === null ? (
        <EmptyRow text="Loading..." />
      ) : list.length === 0 ? (
        <EmptyRow text="No tasks queued." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 9 }}>
          {visible.map(t => {
            const s = (t.status || '').toUpperCase()
            const color = s === 'COMPLETE' ? '#22c55e' : s === 'FAILED' ? '#f87171' : s === 'IN PROGRESS' ? '#38bdf8' : '#facc15'
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ ...RAJ, fontSize: 10.5, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.name}</span>
                <span style={{ ...MONO, fontSize: 7.5, color, letterSpacing: '0.04em', flexShrink: 0 }}>{s}</span>
              </div>
            )
          })}
          {list.length > 4 && <div style={{ ...MONO, fontSize: 8, color: 'var(--color-text-disabled)' }}>+{list.length - 4} more</div>}
        </div>
      )}
      <button onClick={() => onNavigate?.('tasks')} style={panelLinkStyle}>Open Tasks →</button>
    </OpsPanel>
  )
}

// WORKFORCE ACTIVITY — real recent events, honest empty state
function WorkforceActivityPanel({ events }) {
  const list = (events || []).slice(0, 5)
  return (
    <OpsPanel title="Workforce Activity" icon={<ActivityGlyph size={13} />}>
      {events === null ? (
        <EmptyRow text="Loading..." />
      ) : list.length === 0 ? (
        <EmptyRow text="No activity recorded yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {list.map(e => (
            <div key={e.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: e.status === 'warning' ? '#facc15' : '#22c55e', flexShrink: 0 }} />
                <span style={{ ...RAJ, fontSize: 10.5, color: 'var(--color-text-secondary)' }}>{e.title}</span>
              </div>
              <div style={{ ...MONO, fontSize: 8, color: 'var(--color-text-disabled)', marginLeft: 11 }}>{relTime(e.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </OpsPanel>
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
  const [hoveredId, setHoveredId] = useState(null)
  const [tasks, setTasks] = useState(null)
  const [constellationStats, setConstellationStats] = useState(null)
  const [categoryCounts, setCategoryCounts] = useState(null)
  const [events, setEvents] = useState(null)
  const workersPollRef = useRef(null)
  const sidePollRef = useRef(null)

  const loadWorkers = useCallback(async () => {
    try {
      const { workers } = await getWorkers()
      setWorkers(workers)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const loadSideData = useCallback(() => {
    getTasks().then(r => setTasks(r.tasks || [])).catch(() => {})
    getConstellation().then(r => setConstellationStats(r.stats || null)).catch(() => {})
    getCategoryCounts().then(r => setCategoryCounts(Object.keys(r.counts || {}).length)).catch(() => {})
    getEvents(8).then(r => setEvents(r.events || [])).catch(() => {})
  }, [])

  useEffect(() => {
    loadWorkers()
    workersPollRef.current = setInterval(loadWorkers, WORKERS_POLL_MS)
    return () => clearInterval(workersPollRef.current)
  }, [loadWorkers])

  useEffect(() => {
    loadSideData()
    sidePollRef.current = setInterval(loadSideData, SIDE_DATA_POLL_MS)
    return () => clearInterval(sidePollRef.current)
  }, [loadSideData])

  const glowEnabled = visualPrefs.glowEffectsEnabled
  const particlesEnabled = visualPrefs.particlesEnabled

  // Radial layout — angle from top, clockwise, evenly spaced. Pulled in
  // slightly from the previous rx/ry so cards keep clearance from the
  // hub's top/bottom edge instead of running flush against it.
  const positions = useMemo(() => (workers || []).map((w, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, (workers || []).length) - Math.PI / 2
    const rx = 38, ry = 34
    return {
      id: w.id,
      angle,
      x: 50 + rx * Math.cos(angle),
      y: 50 + ry * Math.sin(angle),
      color: AGENT_COLOR[w.id] || 'var(--color-primary)',
    }
  }), [workers])

  const activeCount = (workers || []).filter(w => w.status === 'active' || w.status === 'processing').length
  const unavailableCount = (workers || []).filter(w => w.status === 'unavailable' || w.status === 'missing_configuration').length
  const ollamaReachable = (workers || []).some(w => w.ollama_reachable)
  const queuedCount = (tasks || []).filter(t => (t.status || '').toUpperCase() === 'PENDING').length

  const ports = positions.map(p => ({ ...p, hot: hoveredId === p.id }))

  return (
    <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden', minWidth: 0 }}>

      {/* Mountain/skyline foreground (Background.jsx's global canvas, when
          that bg style is selected) reduced to a subtle lower-edge fade
          for this page only — real fix for the clipped Analyst card is
          the flex-based hub sizing below, this just keeps the busy
          skyline from visually crowding the bottom row. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, zIndex: 0, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(var(--color-bg-rgb),0), rgba(var(--color-bg-rgb),0.55) 55%, rgba(var(--color-bg-rgb),0.85) 100%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column',
        padding: '22px 26px', boxSizing: 'border-box', overflow: 'hidden',
      }}>
        {/* ── Header + unified status rail ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ ...RAJ, fontSize: 23, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-text)' }}>AI Workforce</div>
            <div style={{ ...RAJ, fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
              Four specialized systems operating through the NYX Core.
            </div>
          </div>
          {workers && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusChip icon={<PlugGlyph size={14} />} label="AGENTS" value={workers.length} />
              <StatusChip icon={<ActivityGlyph size={14} />} label="ACTIVE" value={activeCount} color="#22c55e" dotColor="#22c55e" />
              {unavailableCount > 0 && (
                <StatusChip icon={<ActivityGlyph size={14} />} label="UNAVAILABLE" value={unavailableCount} color="#f87171" dotColor="#f87171" />
              )}
              <StatusChip
                icon={<BrainGlyph size={14} />} label="OLLAMA"
                value={ollamaReachable ? 'Reachable' : 'Unreachable'}
                color={ollamaReachable ? '#22c55e' : '#f87171'} dotColor={ollamaReachable ? '#22c55e' : '#f87171'}
              />
              <StatusChip icon={<ChecklistGlyph size={14} />} label="QUEUED TASKS" value={queuedCount} />
            </div>
          )}
        </div>

        {error && (
          <div style={{ ...MONO, fontSize: 11, color: '#f87171', padding: '10px 14px', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, marginBottom: 16, flexShrink: 0 }}>
            Could not reach Nyx backend: {error}
          </div>
        )}

        {!workers && !error && (
          <div style={{ ...MONO, fontSize: 11, color: 'var(--color-text-disabled)' }}>Loading agents...</div>
        )}

        {workers && workers.length === 0 && (
          <div style={{ ...MONO, fontSize: 11, color: 'var(--color-text-disabled)' }}>No agents registered.</div>
        )}

        {/* ── Middle zone: central network (flex) + operations column (fixed) ── */}
        {workers && workers.length > 0 && (
          <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0 }}>

            {/* Central workforce network — sized to fill remaining vertical
                space (not a fixed pixel height), so it can never push the
                bottom agent card past the viewport regardless of window
                size or display scaling. */}
            <div
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'relative', flex: 1, minWidth: 480, minHeight: 460,
                borderRadius: 16,
                border: '1px solid rgba(var(--color-primary-rgb),0.10)',
                background: `
                  radial-gradient(circle at 50% 50%, rgba(var(--color-primary-rgb),0.05), transparent 60%),
                  repeating-linear-gradient(0deg, rgba(var(--color-primary-rgb),0.035) 0px, rgba(var(--color-primary-rgb),0.035) 1px, transparent 1px, transparent 34px),
                  repeating-linear-gradient(90deg, rgba(var(--color-primary-rgb),0.035) 0px, rgba(var(--color-primary-rgb),0.035) 1px, transparent 1px, transparent 34px)
                `,
              }}
            >
              <AgentConnections positions={positions} glowEnabled={glowEnabled} particlesEnabled={particlesEnabled} hoveredId={hoveredId} />
              <WorkforceCore particlesEnabled={particlesEnabled} glowEnabled={glowEnabled} activeCount={activeCount} totalCount={workers.length} ports={ports} />
              {workers.map((w, i) => (
                <AgentModuleCard
                  key={w.id} worker={w} x={positions[i].x} y={positions[i].y}
                  onOpen={setOpenId} onHover={setHoveredId} hoveredId={hoveredId}
                  glowEnabled={glowEnabled} particlesEnabled={particlesEnabled}
                />
              ))}
            </div>

            {/* Operations column */}
            <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 2 }}>
              <WorkforceStatusPanel activeCount={activeCount} totalCount={workers.length} ollamaReachable={ollamaReachable} queuedCount={queuedCount} />
              <MemoryLinkPanel stats={constellationStats} categoryCount={categoryCounts} onNavigate={onNavigate} />
              <ProviderHealthPanel workers={workers} />
              <TaskQueuePanel tasks={tasks} onNavigate={onNavigate} />
              <WorkforceActivityPanel events={events} />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {openId && <WorkerDetailModal workerId={openId} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </div>
  )
}
