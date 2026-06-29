import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { API_URL } from '../utils/constants.js'
import { getNetworkStatus, getEvents } from '../services/api.js'

function formatEventTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}

const PANEL_STYLE = {
  background: 'var(--color-surface)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(var(--color-primary-rgb),0.20)',
  borderRadius: 18,
  padding: '14px 16px',
  marginBottom: 11,
  boxShadow: '0 0 28px rgba(var(--color-primary-rgb),0.10), inset 0 0 18px rgba(var(--color-primary-rgb),0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
}

const TITLE_STYLE = {
  fontFamily: 'Rajdhani, sans-serif',
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
  display: 'block',
  marginBottom: 12,
}

// Lightweight SVG globe thumbnail — no canvas, no RAF, GPU-friendly
function GlobeThumbnail() {
  return (
    <div style={{ width: '100%', height: 82, marginBottom: 9, position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'rgba(4,2,18,0.65)', border: '1px solid rgba(88,54,180,0.18)' }}>
      <svg viewBox="0 0 230 82" style={{ width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="tg-sphere" cx="36%" cy="33%">
            <stop offset="0%"   stopColor="rgba(24,12,65,1)"/>
            <stop offset="65%"  stopColor="rgba(10,5,30,1)"/>
            <stop offset="100%" stopColor="rgba(14,7,44,1)"/>
          </radialGradient>
          <radialGradient id="tg-atm" cx="50%" cy="50%">
            <stop offset="76%" stopColor="rgba(80,40,200,0)"/>
            <stop offset="100%" stopColor="rgba(112,68,248,0.36)"/>
          </radialGradient>
        </defs>

        {/* Atmosphere */}
        <circle cx="41" cy="41" r="38" fill="url(#tg-atm)"/>
        {/* Globe base */}
        <circle cx="41" cy="41" r="32" fill="url(#tg-sphere)"/>

        {/* Latitude ellipses */}
        <ellipse cx="41" cy="41" rx="32" ry="10.5" fill="none" stroke="rgba(78,48,168,0.22)" strokeWidth="0.4"/>
        <ellipse cx="41" cy="41" rx="32" ry="21"   fill="none" stroke="rgba(78,48,168,0.18)" strokeWidth="0.4"/>
        <ellipse cx="41" cy="41" rx="32" ry="29"   fill="none" stroke="rgba(78,48,168,0.14)" strokeWidth="0.4"/>
        {/* Equator */}
        <line x1="9" y1="41" x2="73" y2="41" stroke="rgba(105,68,210,0.28)" strokeWidth="0.6"/>

        {/* Continent blobs */}
        <ellipse cx="26" cy="36" rx="11" ry="8"  fill="rgba(90,56,192,0.48)" stroke="rgba(128,84,245,0.55)" strokeWidth="0.5"/>
        <ellipse cx="52" cy="31" rx="14" ry="9"  fill="rgba(90,56,192,0.48)" stroke="rgba(128,84,245,0.55)" strokeWidth="0.5"/>
        <ellipse cx="54" cy="50" rx="7"  ry="6"  fill="rgba(90,56,192,0.40)" stroke="rgba(128,84,245,0.45)" strokeWidth="0.5"/>
        <ellipse cx="36" cy="52" rx="5"  ry="4"  fill="rgba(90,56,192,0.35)" stroke="rgba(128,84,245,0.38)" strokeWidth="0.4"/>

        {/* Globe edge */}
        <circle cx="41" cy="41" r="32" fill="none" stroke="rgba(112,78,238,0.62)" strokeWidth="0.9"/>

        {/* City nodes */}
        <circle cx="27" cy="34" r="1.4" fill="#A874FF" filter="url(#tg-glow)"/>
        <circle cx="50" cy="29" r="1.4" fill="#A874FF"/>
        <circle cx="60" cy="44" r="1.1" fill="#7B4DFF"/>
        <circle cx="37" cy="54" r="1.0" fill="#7B4DFF"/>

        {/* Signal routes */}
        <line x1="27" y1="34" x2="50" y2="29" stroke="rgba(85,148,255,0.30)" strokeWidth="0.6" strokeDasharray="2,4"/>
        <line x1="50" y1="29" x2="60" y2="44" stroke="rgba(85,148,255,0.24)" strokeWidth="0.6" strokeDasharray="2,4"/>

        {/* Right side text info */}
        <text x="84" y="24" fill="rgba(128,92,228,0.75)" fontSize="8" fontFamily="Rajdhani,sans-serif" fontWeight="700" letterSpacing="3">NYX GLOBAL</text>
        <text x="84" y="36" fill="rgba(88,64,188,0.52)" fontSize="6" fontFamily="Share Tech Mono,monospace" letterSpacing="1.5">HOLOGRAPHIC EARTH</text>
        <line x1="84" y1="41" x2="224" y2="41" stroke="rgba(88,54,178,0.18)" strokeWidth="0.5"/>
        <text x="84" y="52" fill="rgba(100,70,200,0.58)" fontSize="6" fontFamily="Share Tech Mono,monospace">12 NODES · 12 ROUTES</text>
        <text x="84" y="62" fill="rgba(80,55,175,0.40)" fontSize="5.5" fontFamily="Share Tech Mono,monospace">SCROLL TO ZOOM · DRAG TO ROTATE</text>
        <text x="84" y="72" fill="rgba(72,48,160,0.32)" fontSize="5" fontFamily="Share Tech Mono,monospace">DEMO VISUALIZATION</text>
      </svg>

      {/* Subtle pulsing atmosphere ring via framer-motion */}
      <motion.div
        animate={{ opacity: [0.18, 0.38, 0.18] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: 5, left: 5, width: 72, height: 72, borderRadius: '50%', border: '1px solid rgba(112,68,248,0.40)', pointerEvents: 'none' }}
      />
    </div>
  )
}

export default function RightPanels({ visible, onOpenGlobalView }) {
  const [hovered, setHovered]   = useState(false)
  const [memStats, setMemStats] = useState(null)
  const [events, setEvents]     = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const status = await getNetworkStatus()
        setMemStats(status.memory)
      } catch {}
      try {
        const e = await getEvents(6)
        setEvents(e.events || [])
      } catch {}
    }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      width: 268, flexShrink: 0,
      padding: '14px 12px',
      overflowY: 'auto', overflowX: 'hidden',
    }}>

      {/* Global View — clickable CTA card */}
      <div
        className="panel-anim"
        onClick={onOpenGlobalView}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...PANEL_STYLE,
          cursor: 'pointer',
          border: hovered ? '1px solid rgba(var(--color-primary-rgb),0.52)' : PANEL_STYLE.border,
          boxShadow: hovered
            ? '0 0 36px rgba(var(--color-primary-rgb),0.22), inset 0 0 18px rgba(var(--color-primary-rgb),0.07), inset 0 1px 0 rgba(255,255,255,0.08)'
            : PANEL_STYLE.boxShadow,
          transition: 'border 0.2s, box-shadow 0.2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={TITLE_STYLE}>Global View</span>
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: hovered ? 'var(--color-accent)' : 'var(--color-primary)', letterSpacing: '0.12em', transition: 'color 0.2s' }}>OPEN →</span>
        </div>
        <GlobeThumbnail />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: 'var(--color-text-disabled)', letterSpacing: '0.10em' }}>
              RENDERER READY
            </span>
          </div>
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: hovered ? 'var(--color-accent)' : 'var(--color-primary)', letterSpacing: '0.10em', transition: 'color 0.2s' }}>
            OPEN GLOBAL VIEW →
          </span>
        </div>
      </div>

      {/* Nyx Intelligence */}
      <div style={PANEL_STYLE} className="panel-anim">
        <span style={TITLE_STYLE}>NYX Intelligence</span>
        {!memStats ? (
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--color-text-disabled)' }}>Loading...</div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 2.0 }}>
            <div>Tracking <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{memStats.memory_count}</span> memory notes.</div>
            <div><span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{memStats.conv_log_count}</span> conversation logs saved.</div>
            <div style={{ marginTop: 2 }}>
              Vault status:{' '}
              <span style={{ color: memStats.vault_exists ? '#22c55e' : '#f87171', fontFamily: 'Share Tech Mono', fontSize: 10 }}>
                {memStats.vault_exists ? 'CONNECTED' : 'NOT FOUND'}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => onOpenGlobalView?.()}
          style={{
            marginTop: 10,
            fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.target.style.color = 'var(--color-accent)'}
          onMouseLeave={e => e.target.style.color = 'var(--color-primary)'}
        >
          View Insights →
        </button>
      </div>

      {/* Recent Events */}
      <div style={PANEL_STYLE} className="panel-anim">
        <span style={TITLE_STYLE}>Recent Events</span>
        {events.length === 0 ? (
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: 'var(--color-text-disabled)' }}>No events yet</div>
        ) : events.map(ev => (
          <div key={ev.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '7px 0', borderBottom: '1px solid rgba(100,75,200,0.10)',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              border: '1px solid rgba(130,95,240,0.28)',
              background: 'rgba(100,70,200,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
            }}>{ev.status === 'warning' ? '⚠' : '●'}</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-primary)' }}>{ev.title}</div>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'var(--color-text-disabled)', marginTop: 2 }}>{formatEventTime(ev.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* OpenClaw Status */}
      <OpenClawPanel />
    </div>
  )
}

function OpenClawPanel() {
  const [status, setStatus] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/api/openclaw/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ online: false, model: 'unknown', config_found: false }))
  }, [])

  async function runTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch(`${API_URL}/api/openclaw/test`, { method: 'POST' })
      const data = await r.json()
      setTestResult(data)
      setStatus(prev => ({ ...prev, online: data.gateway_online, latency_ms: data.gateway_ms }))
    } catch {
      setTestResult({ passed: false, response: 'Network error' })
    } finally {
      setTesting(false)
    }
  }

  const online = status?.online
  const dotColor = online ? '#22c55e' : status === null ? '#888' : '#ef4444'
  const dotGlow  = online ? '#22c55e' : status === null ? 'transparent' : '#ef4444'
  const statusLabel = status === null ? 'CHECKING…' : online ? 'ONLINE' : 'OFFLINE'

  return (
    <div style={PANEL_STYLE} className="panel-anim">
      <span style={TITLE_STYLE}>OpenClaw Gateway</span>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotGlow}` }} />
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: online ? '#22c55e' : 'var(--color-text-disabled)', letterSpacing: '0.12em' }}>
            {statusLabel}
          </span>
        </div>
        {status?.latency_ms != null && (
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: 'var(--color-text-disabled)' }}>
            {status.latency_ms}ms
          </span>
        )}
      </div>

      {/* Info rows */}
      {status && (
        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', lineHeight: 1.9, marginBottom: 8 }}>
          <div>Model: <span style={{ color: 'var(--color-accent)', fontFamily: 'Share Tech Mono', fontSize: 9 }}>{status.model || '—'}</span></div>
          <div>Mode: <span style={{ color: 'var(--color-text-primary)' }}>{status.permission_mode || 'local'}</span></div>
          <div>Tools: <span style={{ color: status.tool_access ? 'var(--color-accent)' : 'var(--color-text-disabled)' }}>{status.tool_access ? 'enabled' : 'disabled'}</span></div>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div style={{
          background: testResult.passed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${testResult.passed ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`,
          borderRadius: 6, padding: '6px 8px', marginBottom: 8,
        }}>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: testResult.passed ? '#22c55e' : '#ef4444', marginBottom: 3, letterSpacing: '0.10em' }}>
            {testResult.passed ? 'TEST PASSED' : 'TEST FAILED'}{testResult.response_ms ? ` · ${testResult.response_ms}ms` : ''}
          </div>
          {testResult.response && (
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
              "{testResult.response.slice(0, 80)}{testResult.response.length > 80 ? '…' : ''}"
            </div>
          )}
        </div>
      )}

      {/* Test button */}
      <button
        onClick={runTest}
        disabled={testing}
        style={{
          fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: testing ? 'var(--color-text-disabled)' : 'var(--color-primary)',
          background: 'none', border: 'none', cursor: testing ? 'default' : 'pointer',
          padding: 0, transition: 'color 0.2s',
        }}
        onMouseEnter={e => { if (!testing) e.target.style.color = 'var(--color-accent)' }}
        onMouseLeave={e => { if (!testing) e.target.style.color = 'var(--color-primary)' }}
      >
        {testing ? 'Testing…' : 'Test OpenClaw →'}
      </button>
    </div>
  )
}
