import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getNetworkStatus, testConnections, getNetworkLogs,
  emergencyDisconnect, reconnectSystems, openVault,
} from '../services/api.js'

const NAV_W    = 140
const PANEL_W  = 278
const BOTTOM_H = 46

const RINGS = [
  { id: 'providers',    label: 'AI PROVIDERS',   rx: 148, ry: 52,  yOff: -195, speed:  0.0038, color: '#7B60FF' },
  { id: 'memory',       label: 'VAULT & MEMORY', rx: 258, ry: 93,  yOff:  -58, speed: -0.0026, color: '#4DC8FF' },
  { id: 'integrations', label: 'INTEGRATIONS',   rx: 368, ry: 132, yOff:   80, speed:  0.0020, color: '#C77DFF' },
  { id: 'devices',      label: 'NETWORK NODES',  rx: 478, ry: 170, yOff:  218, speed: -0.0016, color: '#5B8FFF' },
]

const CONNECTIONS = [
  { from: 'ollama',       to: 'constellation', color: '#7B60FF', alpha: 0.32 },
  { from: 'ollama',       to: 'vault',         color: '#4DC8FF', alpha: 0.26 },
  { from: 'vault',        to: 'constellation', color: '#4DC8FF', alpha: 0.30 },
  { from: 'convlogs',     to: 'constellation', color: '#A855F7', alpha: 0.22 },
  { from: 'local',        to: 'ollama',        color: '#5B8FFF', alpha: 0.20 },
  { from: 'internet',     to: 'ollama',        color: '#5B8FFF', alpha: 0.16 },
  { from: 'openclaw',     to: 'ollama',        color: '#FF9555', alpha: 0.28 },
]

const NAV_ITEMS = [
  { id: 'dashboard', label: 'DASHBOARD', icon: '▣' },
  { id: 'systems',   label: 'SYSTEMS',   icon: '◈' },
  { id: 'tasks',     label: 'TASKS',     icon: '✓' },
  { id: 'memory',    label: 'MEMORY',    icon: '◉' },
  { id: 'network',   label: 'NETWORK',   icon: '⬡' },
  { id: 'updates',   label: 'UPDATES',   icon: '↻' },
  { id: 'settings',  label: 'SETTINGS',  icon: '⚙' },
]

function buildNodes(status) {
  const p = status?.providers || {}
  const m = status?.memory    || {}
  const v = status?.voice     || {}
  const offline = status?.offline_mode || false
  function spread(total, i) { return -Math.PI / 2 + (Math.PI * 2 * i) / total }

  const providers = []
  if (p.ollama) providers.push({
    id: 'ollama', ring: 'providers', label: 'OLLAMA', sub: p.ollama.model || '',
    icon: '⬡', color: '#7B60FF', phase: 0,
    online: p.ollama.online && !offline, active: p.ollama.is_active,
    latency: p.ollama.latency_ms, configured: true,
    detail: p.ollama.base_url || 'localhost:11434',
    status: p.ollama.online && !offline ? 'ONLINE' : offline ? 'ISOLATED' : 'OFFLINE',
  })
  if (p.openclaw) providers.push({
    id: 'openclaw', ring: 'providers', label: 'OPENCLAW', sub: p.openclaw.model || 'llama3.2:3b',
    icon: '⚡', color: '#FF9555', phase: 1.05,
    online: p.openclaw.online && !offline, active: p.openclaw.is_active,
    latency: p.openclaw.latency_ms, configured: true,
    detail: p.openclaw.gateway_url || 'ws://127.0.0.1:18789',
    status: p.openclaw.online && !offline ? 'ONLINE' : offline ? 'ISOLATED' : 'OFFLINE',
  })
  if (p.openai?.configured) providers.push({
    id: 'openai', ring: 'providers', label: 'OPENAI', sub: p.openai.model || 'gpt-4o',
    icon: '◎', color: '#5B8FFF', phase: 2.09,
    online: !offline, active: p.openai.is_active,
    latency: null, configured: true, detail: 'api.openai.com',
    status: offline ? 'ISOLATED' : 'ONLINE',
  })
  if (p.claude?.configured) providers.push({
    id: 'claude', ring: 'providers', label: 'CLAUDE', sub: p.claude.model || '',
    icon: 'AI', color: '#C77DFF', phase: 4.19,
    online: !offline, active: p.claude.is_active,
    latency: null, configured: true, detail: 'api.anthropic.com',
    status: offline ? 'ISOLATED' : 'ONLINE',
  })
  providers.push({
    id: 'offline_prov', ring: 'providers', label: 'OFFLINE',
    sub: offline ? 'ISOLATED' : 'STANDBY', icon: '◐',
    color: offline ? '#FF6B35' : '#2a2a55', phase: 3.5,
    online: offline, active: offline, latency: null, configured: true,
    detail: offline ? 'Emergency isolation' : 'Standby mode',
    status: offline ? 'ACTIVE' : 'STANDBY',
  })
  providers.forEach((n, i) => { n.angle = spread(providers.length, i) })

  const memory = [
    { id: 'vault', ring: 'memory', label: 'OBSIDIAN',
      sub: m.vault_exists ? `${m.vault_md_count} files` : 'Not found',
      icon: '◈', color: '#4DC8FF', phase: 0.5,
      online: !!m.vault_exists, active: !!m.vault_exists,
      latency: null, configured: !!m.vault_exists, detail: 'NYX_VAULT',
      status: m.vault_exists ? 'SYNCED' : 'NOT FOUND' },
    { id: 'constellation', ring: 'memory', label: 'MEMORIES',
      sub: `${m.memory_count || 0} nodes`,
      icon: '◉', color: '#A855F7', phase: 2.59,
      online: true, active: true, latency: null, configured: true,
      detail: 'constellation.json', status: 'ACTIVE' },
    { id: 'convlogs', ring: 'memory', label: 'CONV LOGS',
      sub: `${m.conv_log_count || 0} sessions`,
      icon: '▦', color: '#4DC8FF', phase: 4.71,
      online: true, active: true, latency: null, configured: true,
      detail: 'memory/conversations', status: 'LOGGING' },
  ]
  memory.forEach((n, i) => { n.angle = spread(memory.length, i) })

  const integrations = [
    { id: 'voice', ring: 'integrations', label: 'VOICE SYS',
      sub: v.enabled ? 'ENABLED' : 'DISABLED', icon: '♪',
      color: v.enabled ? '#FF9555' : '#2a2a55', phase: 0,
      online: !!v.enabled, active: !!v.enabled, latency: null,
      configured: v.stt_provider !== 'none',
      detail: v.enabled ? `${v.stt_provider}/${v.tts_provider}` : 'Not configured',
      status: v.enabled ? 'ACTIVE' : 'INACTIVE' },
    { id: 'discord', ring: 'integrations', label: 'DISCORD',
      sub: 'Desktop Launcher', icon: '⚙', color: '#7289DA', phase: 2.09,
      online: true, active: true, latency: null, configured: true,
      detail: 'App launcher', status: 'ACTIVE' },
    { id: 'browser_ext', ring: 'integrations', label: 'BROWSER',
      sub: 'Not Configured', icon: '⊕', color: '#1e1e3a', phase: 4.19,
      online: false, active: false, latency: null, configured: false,
      detail: 'Extension not installed', status: 'INACTIVE' },
  ]
  integrations.forEach((n, i) => { n.angle = spread(integrations.length, i) })

  const devices = [
    { id: 'local', ring: 'devices', label: 'LOCAL HOST',
      sub: status ? fmtUptime(status.uptime_seconds) : 'Online',
      icon: '□', color: '#5B8FFF', phase: 0,
      online: true, active: true, latency: 0, configured: true,
      detail: 'This machine', status: 'ONLINE' },
    { id: 'internet', ring: 'devices', label: 'INTERNET',
      sub: status?.internet?.online ? 'CONNECTED' : 'NO SIGNAL',
      icon: '⇅', color: status?.internet?.online ? '#4DC8FF' : '#FF4444', phase: 2.09,
      online: !!status?.internet?.online, active: !!status?.internet?.online,
      latency: status?.internet?.latency_ms, configured: true,
      detail: status?.internet?.online ? `${status.internet.latency_ms}ms` : 'Unreachable',
      status: status?.internet?.online ? 'CONNECTED' : 'NO SIGNAL' },
    { id: 'tailscale', ring: 'devices', label: 'TAILSCALE',
      sub: 'Not Configured', icon: '⬡', color: '#1e1e3a', phase: 4.19,
      online: false, active: false, latency: null, configured: false,
      detail: 'VPN mesh not set up', status: 'INACTIVE' },
  ]
  devices.forEach((n, i) => { n.angle = spread(devices.length, i) })

  return { providers, memory, integrations, devices }
}

function fmtUptime(sec) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function fmtLatency(ms) { return ms == null ? '—' : `${ms}ms` }
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return '' }
}

function initParticles(w, h) {
  return Array.from({ length: 200 }, (_, i) => ({
    x: (i * 137.508 + 50) % w,
    y: (i * 89.442 + 20) % h,
    r: i % 3 === 0 ? 0.9 + (i % 5) * 0.18 : i % 3 === 1 ? 0.5 + (i % 3) * 0.12 : 0.25,
    phase: i * 0.44,
    layer: i % 3,
    baseAlpha: i % 3 === 0 ? 0.28 : i % 3 === 1 ? 0.18 : 0.10,
  }))
}

// ── Canvas: Background ────────────────────────────────────────────────────────
function drawBackground(ctx, w, h, t, offline) {
  ctx.fillStyle = offline ? '#070100' : '#020008'
  ctx.fillRect(0, 0, w, h)

  // Main depth gradient
  const cg = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.5, Math.max(w, h) * 0.65)
  if (offline) {
    cg.addColorStop(0,   'rgba(38,5,2,0.85)')
    cg.addColorStop(0.5, 'rgba(12,2,1,0.55)')
    cg.addColorStop(1,   'rgba(0,0,0,0)')
  } else {
    cg.addColorStop(0,   'rgba(18,5,48,0.88)')
    cg.addColorStop(0.4, 'rgba(9,3,26,0.65)')
    cg.addColorStop(0.75,'rgba(4,1,12,0.35)')
    cg.addColorStop(1,   'rgba(0,0,0,0)')
  }
  ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h)

  // Ambient glow clouds at corners + edges
  if (!offline) {
    const clouds = [
      { x: 0,   y: 0,   r: w * 0.38, col: 'rgba(60,15,140,0.12)' },
      { x: w,   y: h,   r: w * 0.42, col: 'rgba(20,8,80,0.10)'  },
      { x: w,   y: 0,   r: w * 0.30, col: 'rgba(30,60,120,0.09)' },
      { x: 0,   y: h,   r: w * 0.28, col: 'rgba(80,20,120,0.08)' },
      { x: w/2, y: h,   r: w * 0.35, col: 'rgba(40,12,100,0.11)' },
    ]
    clouds.forEach(c => {
      const breath = 0.9 + 0.1 * Math.sin(t * 0.18 + c.x * 0.001)
      const cl = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * breath)
      cl.addColorStop(0, c.col); cl.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = cl; ctx.fillRect(0, 0, w, h)
    })
  } else {
    const ecl = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.5)
    ecl.addColorStop(0, 'rgba(60,8,3,0.15)'); ecl.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = ecl; ctx.fillRect(0, 0, w, h)
  }

  // Brighter grid
  ctx.strokeStyle = offline ? 'rgba(120,20,5,0.055)' : 'rgba(55,28,110,0.065)'
  ctx.lineWidth = 0.5
  const gs = 54
  for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

  // Floating signal lines (horizontal streaks)
  if (!offline) {
    for (let i = 0; i < 5; i++) {
      const ly = (h * 0.15 * i + t * (8 + i * 3)) % h
      const lw = 80 + i * 40
      const lx = ((t * (12 + i * 7) + i * w * 0.2) % (w + lw)) - lw
      const sg = ctx.createLinearGradient(lx, 0, lx + lw, 0)
      sg.addColorStop(0, 'transparent')
      sg.addColorStop(0.5, `rgba(80,50,200,${0.04 + i * 0.008})`)
      sg.addColorStop(1, 'transparent')
      ctx.fillStyle = sg; ctx.fillRect(lx, ly - 0.5, lw, 1)
    }
  }

  // Scan lines
  [[22, 0.065, 5], [38, 0.038, 2], [13, 0.048, 8]].forEach(([spd, alpha, width], i) => {
    const sy = ((t * spd + i * (h / 3)) % (h + 20)) - 10
    const sg = ctx.createLinearGradient(0, sy - width, 0, sy + width)
    sg.addColorStop(0, 'transparent')
    sg.addColorStop(0.5, offline ? `rgba(200,40,8,${alpha})` : `rgba(80,40,210,${alpha})`)
    sg.addColorStop(1, 'transparent')
    ctx.fillStyle = sg; ctx.fillRect(0, sy - width, w, width * 2)
  })
}

// ── Canvas: Volumetric depth fog ──────────────────────────────────────────────
function drawDepthFog(ctx, cx, cy, t, offline, hs) {
  const breath = 0.88 + 0.12 * Math.sin(t * 0.28)
  ;[[520, 0.20, 0.12], [310, 0.30, 0.18], [155, 0.38, 0.25], [74, 0.50, 0.36]].forEach(([baseR, a1, a2]) => {
    const r = baseR * hs * breath
    const fog = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    if (offline) {
      fog.addColorStop(0,   `rgba(55,7,2,${a1})`)
      fog.addColorStop(0.6, `rgba(18,3,1,${a2})`)
      fog.addColorStop(1,   'rgba(0,0,0,0)')
    } else {
      fog.addColorStop(0,   `rgba(26,8,72,${a1})`)
      fog.addColorStop(0.55,`rgba(12,4,40,${a2})`)
      fog.addColorStop(1,   'rgba(0,0,0,0)')
    }
    ctx.fillStyle = fog
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * 0.48, 0, 0, Math.PI * 2)
    ctx.fill()
  })
}

// ── Canvas: Particles ─────────────────────────────────────────────────────────
function drawParticles(ctx, particles, t) {
  particles.forEach(p => {
    const a = p.layer === 2
      ? p.baseAlpha * 2.8 * (0.5 + 0.5 * Math.sin(t * 1.8 + p.phase))
      : p.baseAlpha + 0.10 * Math.sin(t * (0.18 + p.layer * 0.1) + p.phase)
    ctx.globalAlpha = Math.max(0, Math.min(0.95, a))
    ctx.fillStyle = p.layer === 0 ? '#c4b4ff' : p.layer === 1 ? '#90d8ff' : '#ffffff'
    if (p.layer === 0 && p.r > 0.8) { ctx.shadowColor = '#9070ff'; ctx.shadowBlur = 3 }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
  })
  ctx.globalAlpha = 1
}

// ── Canvas: Ring track (segmented arcs + sweep + volumetric) ─────────────────
function drawRingTrack(ctx, ring, cx, cy, rot, t, offline, hs) {
  const rx  = ring.rx * hs
  const ry  = ring.ry * hs
  const x0  = cx
  const y0  = cy + ring.yOff * hs
  const col = ring.color
  const circ = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)

  // Ghost outer halo
  ctx.save()
  ctx.strokeStyle = offline ? '#220300' : col + '20'
  ctx.lineWidth   = offline ? 0.5 : 10 * hs
  ctx.globalAlpha = offline ? 0.25 : 0.70
  ctx.shadowColor = col
  ctx.shadowBlur  = offline ? 0 : 40
  ctx.beginPath(); ctx.ellipse(x0, y0, rx * 1.10, ry * 1.10, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()

  // Volumetric body glow
  ctx.save()
  ctx.strokeStyle = offline ? '#1a020044' : col + '18'
  ctx.lineWidth   = offline ? 1 : 30 * hs
  ctx.beginPath(); ctx.ellipse(x0, y0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()

  // Segmented arcs (8 segments rotating with ring)
  if (!offline) {
    const N = 8; const span = (Math.PI * 2) / N; const gap = 0.20
    ctx.save()
    ctx.shadowColor = col; ctx.shadowBlur = 14
    for (let i = 0; i < N; i++) {
      const sa = rot + i * span
      const ea = sa + span * (1 - gap)
      const alpha = 0.62 + 0.28 * Math.sin(t * 0.75 + i * 0.8)
      ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 2.2
      ctx.beginPath()
      for (let j = 0; j <= 22; j++) {
        const a = sa + (ea - sa) * j / 22
        const px = x0 + rx * Math.cos(a); const py = y0 + ry * Math.sin(a)
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  // Dashed animated flow track
  ctx.save()
  const dl = circ / 32
  ctx.setLineDash([dl * 0.55, dl * 0.45])
  ctx.lineDashOffset = -rot * (circ / (Math.PI * 2))
  ctx.strokeStyle = offline ? '#2e050055' : col + '60'
  ctx.lineWidth = 1.1; ctx.globalAlpha = 1
  ctx.beginPath(); ctx.ellipse(x0, y0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()

  // Counter-rotating inner dashed ring
  ctx.save()
  ctx.setLineDash([3, 13])
  ctx.lineDashOffset = rot * 0.65 * (circ / (Math.PI * 2))
  ctx.strokeStyle = offline ? '#1a020033' : col + '24'
  ctx.lineWidth = 0.6
  ctx.beginPath(); ctx.ellipse(x0, y0, rx * 0.87, ry * 0.87, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()

  // Radar sweep (bright arc cycling at 2.5× ring speed)
  if (!offline) {
    const sw = rot * 2.5; const ss = Math.PI / 4.2; const steps = 38
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.lineCap = 'round'
    for (let i = 0; i < steps; i++) {
      const frac = i / steps; const a = sw + frac * ss; const a2 = sw + (frac + 1 / steps) * ss
      ctx.strokeStyle = col; ctx.globalAlpha = Math.pow(1 - frac, 0.38) * 0.95
      ctx.beginPath()
      ctx.moveTo(x0 + rx * Math.cos(a), y0 + ry * Math.sin(a))
      ctx.lineTo(x0 + rx * Math.cos(a2), y0 + ry * Math.sin(a2))
      ctx.stroke()
    }
    ctx.restore()
  }

  // Ring label
  ctx.save()
  ctx.font = `700 ${Math.max(9, 11 * hs)}px "Rajdhani", monospace`
  ctx.fillStyle = offline ? 'rgba(190,55,22,0.45)' : col + 'aa'
  ctx.shadowColor = col; ctx.shadowBlur = offline ? 0 : 8
  ctx.textAlign = 'left'
  ctx.fillText(ring.label, x0 + rx * 0.24, y0 - ry * 1.06 - 11 * hs)
  ctx.restore()
}

// ── Canvas: Packets with trails ───────────────────────────────────────────────
function drawPackets(ctx, ring, cx, cy, rot, t, offline, hs) {
  const rx = ring.rx * hs; const ry = ring.ry * hs
  const x0 = cx; const y0 = cy + ring.yOff * hs
  for (let i = 0; i < 4; i++) {
    const baseA = (Math.PI * 2 * i) / 4
    const spd = 0.28 + i * 0.09; const dir = i % 2 === 0 ? 1 : -1
    const angle = baseA + rot + t * spd * dir
    for (let tr = 5; tr >= 0; tr--) {
      const ta = angle - dir * tr * 0.05
      const px = x0 + rx * Math.cos(ta); const py = y0 + ry * Math.sin(ta)
      ctx.save()
      ctx.globalAlpha = offline ? 0.05 : (0.6 * (1 - tr / 6))
      ctx.fillStyle = offline ? '#aa2808' : ring.color
      if (!offline && tr === 0) { ctx.shadowColor = ring.color; ctx.shadowBlur = 7 }
      ctx.beginPath(); ctx.arc(px, py, (2.4 - tr * 0.32) * hs, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
  }
}

// ── Canvas: Inter-ring bezier connections ─────────────────────────────────────
function drawInterconnections(ctx, drawnNodes, t, offline) {
  if (offline) return
  CONNECTIONS.forEach((conn, ci) => {
    const from = drawnNodes.find(n => n.id === conn.from)
    const to   = drawnNodes.find(n => n.id === conn.to)
    if (!from || !to) return
    const mx = (from.x + to.x) / 2; const my = (from.y + to.y) / 2
    const dx = to.x - from.x; const dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const cpx = mx + (-dy / len) * len * 0.20
    const cpy = my + ( dx / len) * len * 0.20
    const pulse = conn.alpha * (0.65 + 0.35 * Math.sin(t * 0.55 + ci * 1.1))

    ctx.save()
    ctx.strokeStyle = conn.color; ctx.lineWidth = 0.65; ctx.globalAlpha = pulse
    ctx.shadowColor = conn.color; ctx.shadowBlur = 3
    ctx.setLineDash([4, 9])
    ctx.lineDashOffset = -t * 16 * (ci % 2 === 0 ? 1 : -1)
    ctx.beginPath(); ctx.moveTo(from.x, from.y)
    ctx.quadraticCurveTo(cpx, cpy, to.x, to.y); ctx.stroke()
    ctx.restore()

    const tp = ((t * 0.26 + ci * 0.38) % 1)
    const bx = (1 - tp) * (1 - tp) * from.x + 2 * (1 - tp) * tp * cpx + tp * tp * to.x
    const by = (1 - tp) * (1 - tp) * from.y + 2 * (1 - tp) * tp * cpy + tp * tp * to.y
    ctx.save()
    ctx.globalAlpha = 0.88; ctx.shadowColor = conn.color; ctx.shadowBlur = 9; ctx.fillStyle = conn.color
    ctx.beginPath(); ctx.arc(bx, by, 2.0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  })
}

// ── Canvas: Node (hexagonal frame, signal bars, volumetric glow) ──────────────
function drawNode(ctx, node, nx, ny, t, hs) {
  const pulse = 0.72 + 0.28 * Math.sin(t * 1.7 + node.phase)
  const r     = (node.configured ? (node.online ? 22 : 15) : 10) * hs
  const col   = node.configured ? node.color : '#1a1a38'

  if (node.online) {
    ctx.save(); ctx.beginPath()
    ctx.arc(nx, ny, r * 2.4 * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = col + '35'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
  }
  if (node.active) {
    ctx.save(); ctx.beginPath()
    ctx.arc(nx, ny, r * 1.8 + 2.0 * hs * Math.sin(t * 2.0 + node.phase), 0, Math.PI * 2)
    ctx.strokeStyle = col + '50'; ctx.lineWidth = 0.9; ctx.stroke(); ctx.restore()
  }
  if (node.online || node.active) {
    ctx.save()
    const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 4.0 * pulse)
    grd.addColorStop(0, col + '68'); grd.addColorStop(0.45, col + '28'); grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd; ctx.globalAlpha = 0.95
    ctx.beginPath(); ctx.arc(nx, ny, r * 4.0 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }

  // Hexagonal frame
  if (node.configured) {
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = node.online ? 26 * hs : 7 * hs
    ctx.strokeStyle = col; ctx.lineWidth = node.active ? 2.4 : 1.6
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const px = nx + r * 1.08 * Math.cos(a); const py = ny + r * 1.08 * Math.sin(a)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.stroke(); ctx.restore()
  }

  // Core fill
  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = node.online ? 18 * hs : 4 * hs
  ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2)
  if (node.online) {
    const f = ctx.createRadialGradient(nx - r * 0.3, ny - r * 0.3, 0, nx, ny, r)
    f.addColorStop(0, col + 'dd'); f.addColorStop(1, col + '88')
    ctx.fillStyle = f
  } else {
    ctx.fillStyle = node.configured ? '#0c0c1c' : '#060610'
  }
  ctx.fill(); ctx.strokeStyle = col + (node.configured ? '99' : '1e'); ctx.lineWidth = 1; ctx.stroke(); ctx.restore()

  // Icon
  ctx.save(); ctx.fillStyle = node.online ? '#ffffff' : (node.configured ? col + '60' : '#252545')
  ctx.font = `700 ${Math.max(7, Math.round(r * 0.68))}px monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(node.icon, nx, ny); ctx.restore()

  // Signal bars (bottom-right corner)
  if (node.configured && node.online) {
    const bx = nx + r * 0.72; const by = ny + r * 0.72
    const bw = 2.2 * hs
    ctx.save()
    ;[3, 5, 7].forEach((h, i) => {
      ctx.fillStyle = col + 'bb'; ctx.globalAlpha = 0.8
      ctx.beginPath(); ctx.rect(bx + i * (bw + 1.4 * hs), by - h * hs, bw, h * hs); ctx.fill()
    })
    ctx.restore()
  }

  // Label
  ctx.save()
  ctx.fillStyle = node.configured ? 'rgba(230,220,255,0.97)' : 'rgba(70,70,110,0.50)'
  ctx.font = `700 ${Math.max(9, Math.round(11 * hs))}px "Rajdhani", monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.shadowColor = col; ctx.shadowBlur = node.online ? 8 : 0
  ctx.fillText(node.label, nx, ny + r + 5 * hs); ctx.restore()

  // Status sub-label
  ctx.save()
  ctx.fillStyle = !node.configured ? '#2e2e50' : node.online ? 'rgba(72,230,140,0.90)' : 'rgba(210,65,45,0.80)'
  ctx.font = `600 ${Math.max(8, Math.round(8.5 * hs))}px monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText(node.status || node.sub, nx, ny + r + 5 * hs + Math.round(13 * hs)); ctx.restore()
}

// ── Canvas: Center indicator ──────────────────────────────────────────────────
function drawCenterIndicator(ctx, cx, cy, t, offline, status, hs) {
  const col = offline ? '#FF6B35' : '#7B60FF'
  const p1 = 0.80 + 0.20 * Math.sin(t * 1.4)
  const p2 = 0.70 + 0.30 * Math.sin(t * 0.9 + 1.2)

  ctx.save(); ctx.strokeStyle = col + '28'; ctx.lineWidth = 0.8
  ctx.setLineDash([5, 11]); ctx.lineDashOffset = t * 10
  ctx.beginPath(); ctx.arc(cx, cy, 40 * hs, 0, Math.PI * 2); ctx.stroke(); ctx.restore()

  ctx.save(); ctx.strokeStyle = col + '50'; ctx.lineWidth = 1.1
  ctx.shadowColor = col; ctx.shadowBlur = 9 * p1
  ctx.setLineDash([])
  ctx.beginPath(); ctx.arc(cx, cy, 23 * hs, 0, Math.PI * 2); ctx.stroke(); ctx.restore()

  ctx.save(); ctx.strokeStyle = col + '32'; ctx.lineWidth = 0.5; ctx.setLineDash([3, 7])
  const cr = 58 * hs
  ctx.beginPath(); ctx.moveTo(cx - cr, cy); ctx.lineTo(cx + cr, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy - cr); ctx.lineTo(cx, cy + cr); ctx.stroke(); ctx.restore()

  ctx.save()
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 * hs)
  grd.addColorStop(0, col + '78'); grd.addColorStop(0.5, col + '25'); grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd; ctx.globalAlpha = p2
  ctx.beginPath(); ctx.arc(cx, cy, 30 * hs, 0, Math.PI * 2); ctx.fill(); ctx.restore()

  ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 22 * p1
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 5 * hs, 0, Math.PI * 2); ctx.fill(); ctx.restore()

  ctx.save(); ctx.textAlign = 'center'; ctx.shadowColor = col; ctx.shadowBlur = 8
  ctx.fillStyle = col + 'cc'
  ctx.font = `700 ${Math.max(8, 10 * hs)}px "Rajdhani", monospace`
  ctx.fillText(offline ? 'ISOLATED' : 'NETWORK OPS', cx, cy - 18 * hs)
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(140,120,195,0.38)'
  ctx.font = `500 ${Math.max(7, 8 * hs)}px monospace`
  ctx.fillText(status?.active_provider?.toUpperCase() || 'NYX', cx, cy + 12 * hs)
  ctx.restore()
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NetworkPage({ activePage = 'network', onNavigate = () => {} }) {
  const canvasRef = useRef(null)
  const stateRef  = useRef({
    t: 0, rots: { providers: 0, memory: 0, integrations: 0, devices: 0 },
    nodes: {}, particles: null, drawnNodes: [], status: null, offline: false,
  })
  const rafRef = useRef(null)

  const [status,        setStatus]        = useState(null)
  const [events,        setEvents]        = useState([])
  const [hoveredNode,   setHoveredNode]   = useState(null)
  const [tooltipPos,    setTooltipPos]    = useState({ x: 0, y: 0 })
  const [modal,         setModal]         = useState(null)
  const [testResults,   setTestResults]   = useState(null)
  const [testing,       setTesting]       = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [reconnecting,  setReconnecting]  = useState(false)
  const [toast,         setToast]         = useState(null)

  const notify = useCallback((msg, type = 'info') => {
    setToast({ msg, type, id: Date.now() })
    setTimeout(() => setToast(null), 3800)
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([getNetworkStatus(), getNetworkLogs(25)])
      setStatus(s); setEvents(l.events || [])
      stateRef.current.status  = s
      stateRef.current.offline = s.offline_mode || false
      stateRef.current.nodes   = buildNodes(s)
    } catch { /* keep last state */ }
  }, [])

  useEffect(() => { loadStatus(); const id = setInterval(loadStatus, 15000); return () => clearInterval(id) }, [loadStatus])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.parentElement.getBoundingClientRect()
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px'
      ctx.scale(dpr, dpr)
      const s = stateRef.current
      s.particles = initParticles(rect.width, rect.height)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement)

    const frame = () => {
      const s = stateRef.current; const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr; const h = canvas.height / dpr
      const cx = w * 0.50; const cy = h * 0.46; const hs = h / 900
      s.t += 0.016; RINGS.forEach(r => { s.rots[r.id] += r.speed })
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h)
      drawBackground(ctx, w, h, s.t, s.offline)
      drawDepthFog(ctx, cx, cy, s.t, s.offline, hs)
      if (s.particles) drawParticles(ctx, s.particles, s.t)

      // First pass: collect positions for interconnections
      const drawnNodes = []
      ;[...RINGS].reverse().forEach(ring => {
        const rot = s.rots[ring.id]
        ;(s.nodes[ring.id] || []).forEach(node => {
          const nx = cx + (ring.rx * hs) * Math.cos(node.angle + rot)
          const ny = cy + (ring.yOff * hs) + (ring.ry * hs) * Math.sin(node.angle + rot)
          drawnNodes.push({ id: node.id, x: nx, y: ny, r: 30 * hs, node })
        })
      })

      drawInterconnections(ctx, drawnNodes, s.t, s.offline)

      // Second pass: rings + nodes
      ;[...RINGS].reverse().forEach(ring => {
        const rot = s.rots[ring.id]
        drawRingTrack(ctx, ring, cx, cy, rot, s.t, s.offline, hs)
        drawPackets(ctx, ring, cx, cy, rot, s.t, s.offline, hs)
        ;(s.nodes[ring.id] || []).forEach(node => {
          const nx = cx + (ring.rx * hs) * Math.cos(node.angle + rot)
          const ny = cy + (ring.yOff * hs) + (ring.ry * hs) * Math.sin(node.angle + rot)
          drawNode(ctx, node, nx, ny, s.t, hs)
        })
      })

      drawCenterIndicator(ctx, cx, cy, s.t, s.offline, s.status, hs)
      s.drawnNodes = drawnNodes
      ctx.restore()
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [])

  const onMouseMove = useCallback((e) => {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top
    const hit = stateRef.current.drawnNodes.find(n => {
      const dx = n.x - mx; const dy = n.y - my; return Math.sqrt(dx * dx + dy * dy) < n.r
    })
    setHoveredNode(hit ? hit.node : null); setTooltipPos({ x: mx, y: my })
  }, [])
  const onMouseLeave = useCallback(() => setHoveredNode(null), [])

  const handleTest = useCallback(async () => {
    setTesting(true); setTestResults(null); setModal('diagnostics')
    try { const res = await testConnections(); setTestResults(res); await loadStatus() }
    catch { setTestResults({ error: 'Backend unreachable' }) }
    finally { setTesting(false) }
  }, [loadStatus])

  const handleEmergencyConfirm = useCallback(async () => {
    setDisconnecting(true)
    try {
      await emergencyDisconnect(); await loadStatus()
      const l = await getNetworkLogs(25); setEvents(l.events || [])
      notify('Emergency isolation active — all external connections terminated', 'error')
    } catch { notify('Backend unreachable', 'error') }
    finally { setDisconnecting(false); setModal(null) }
  }, [loadStatus, notify])

  const handleReconnect = useCallback(async () => {
    setReconnecting(true)
    try {
      await reconnectSystems(); await loadStatus()
      const l = await getNetworkLogs(25); setEvents(l.events || [])
      notify('Systems reconnected — normal operations resumed')
    } catch { notify('Reconnect failed', 'error') }
    finally { setReconnecting(false) }
  }, [loadStatus, notify])

  const handleRefresh = useCallback(async () => {
    await loadStatus(); const l = await getNetworkLogs(25); setEvents(l.events || [])
    notify('Network status refreshed')
  }, [loadStatus, notify])

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), status, events }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `nyx-network-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(url); notify('Network data exported')
  }, [status, events, notify])

  const offline = status?.offline_mode || false

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.55 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: offline ? '#070100' : '#020008',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Rajdhani', sans-serif", overflow: 'hidden',
        transition: 'background 1.2s ease',
      }}
    >
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 40, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{
              background: 'rgba(170,38,8,0.16)', borderBottom: '1px solid rgba(255,75,28,0.32)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 14, fontSize: 10, letterSpacing: '2.5px', color: '#FF8055',
              fontWeight: 700, flexShrink: 0, overflow: 'hidden',
            }}
          >
            ⚠ EMERGENCY ISOLATION ACTIVE — ALL EXTERNAL CONNECTIONS TERMINATED
            <button onClick={handleReconnect} disabled={reconnecting} style={{
              background: 'rgba(255,75,28,0.18)', border: '1px solid rgba(255,75,28,0.45)',
              color: '#FF8055', padding: '3px 13px', borderRadius: 4,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 9, letterSpacing: '1px',
            }}>
              {reconnecting ? 'RECONNECTING…' : 'RECONNECT SYSTEMS'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftNav activePage={activePage} onNavigate={onNavigate} offline={offline} status={status} />

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
            onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
          />
          <AnimatePresence>
            {hoveredNode && <NodeTooltip node={hoveredNode} pos={tooltipPos} />}
          </AnimatePresence>
        </div>

        <div style={{
          width: PANEL_W, display: 'flex', flexDirection: 'column',
          borderLeft: `1px solid ${offline ? 'rgba(220,60,20,0.35)' : 'rgba(110,65,220,0.35)'}`,
          background: offline ? 'rgba(10,2,1,0.94)' : 'rgba(6,2,16,0.94)',
          overflow: 'hidden', backdropFilter: 'blur(8px)',
          boxShadow: offline ? 'inset -1px 0 40px rgba(0,0,0,0.5), -8px 0 40px rgba(0,0,0,0.4)' : 'inset 0 0 40px rgba(20,8,60,0.5), -8px 0 40px rgba(0,0,0,0.4)',
          transition: 'background 1.2s, border-color 1.2s',
        }}>
          <PanelHeader status={status} offline={offline} />
          <ConnectionStatus status={status} offline={offline} />
          <ActivityFeed events={events} />
          <QuickActions
            offline={offline} testing={testing}
            onTest={handleTest} onRefresh={handleRefresh}
            onLogs={() => setModal('logs')} onExport={handleExport}
            onVault={openVault} onVoice={() => setModal('voice')}
            onEmergency={() => setModal('emergency')}
            onReconnect={handleReconnect} reconnecting={reconnecting}
          />
        </div>
      </div>

      <TelemetryBar status={status} offline={offline} />

      <AnimatePresence>
        {modal === 'emergency'   && <EmergencyModal   onConfirm={handleEmergencyConfirm} onCancel={() => setModal(null)} disconnecting={disconnecting} />}
        {modal === 'diagnostics' && <DiagnosticsModal results={testResults} testing={testing} onClose={() => setModal(null)} />}
        {modal === 'logs'        && <LogsModal        events={events} onClose={() => setModal(null)} />}
        {modal === 'voice'       && <VoiceModal       status={status}  onClose={() => setModal(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{ opacity: 0,    y: 12, scale: 0.96 }}
            style={{
              position: 'fixed', bottom: BOTTOM_H + 16, left: '50%',
              transform: 'translateX(-50%)', zIndex: 500,
              background: toast.type === 'error' ? 'rgba(110,12,8,0.97)' : 'rgba(16,7,34,0.97)',
              border: `1px solid ${toast.type === 'error' ? 'rgba(255,75,45,0.38)' : 'rgba(110,65,240,0.32)'}`,
              color: '#ddd', padding: '9px 22px', borderRadius: 7,
              fontSize: 12, letterSpacing: '0.5px',
              boxShadow: `0 4px 28px ${toast.type === 'error' ? 'rgba(190,28,8,0.28)' : 'rgba(75,38,175,0.28)'}`,
            }}
          >{toast.msg}</motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Left Nav Rail ─────────────────────────────────────────────────────────────
function LeftNav({ activePage, onNavigate, offline, status }) {
  const accent = offline ? '#FF6B35' : '#7B60FF'
  const memCount   = status?.memory?.memory_count  || 0
  const vaultFiles = status?.memory?.vault_md_count || 0
  const providerOn = !offline && (status?.providers?.ollama?.online || status?.providers?.openai?.configured || status?.providers?.claude?.configured)

  return (
    <div style={{
      width: NAV_W, display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${offline ? 'rgba(200,55,18,0.28)' : 'rgba(90,48,180,0.28)'}`,
      background: 'rgba(4,1,14,0.95)', flexShrink: 0, backdropFilter: 'blur(8px)',
      boxShadow: '8px 0 30px rgba(0,0,0,0.35)',
    }}>
      <div style={{ padding: '15px 13px 11px', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '5px', color: accent, lineHeight: 1 }}>NYX</div>
        <div style={{ fontSize: 7.5, color: '#2a2a44', letterSpacing: '2.5px', marginTop: 3 }}>OPERATIONS</div>
      </div>
      <div style={{ width: '52%', height: 1, background: `${accent}18`, margin: '0 13px 11px' }} />

      <div style={{ flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const isActive = item.id === activePage
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 13px', background: isActive ? `${accent}0d` : 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              borderLeft: `2px solid ${isActive ? accent : 'transparent'}`,
              color: isActive ? '#d8d8f0' : '#484870', transition: 'all 0.18s', position: 'relative',
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#8888b8'; e.currentTarget.style.borderLeftColor = accent + '44' } }}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#484870'; e.currentTarget.style.borderLeftColor = 'transparent' } }}
            >
              {isActive && <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                background: `linear-gradient(to bottom, ${accent}00, ${accent}, ${accent}00)`,
                boxShadow: `0 0 7px ${accent}`,
              }} />}
              <span style={{ fontSize: 9.5, width: 12, textAlign: 'center', color: isActive ? accent : 'inherit', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 9, letterSpacing: '1.2px', fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
              {isActive && <div style={{ marginLeft: 'auto', width: 3, height: 3, borderRadius: '50%', background: accent, boxShadow: `0 0 5px ${accent}`, flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>

      {/* System health */}
      <div style={{ padding: '9px 13px 8px', borderTop: '1px solid rgba(55,28,95,0.09)', flexShrink: 0 }}>
        <div style={{ fontSize: 8, letterSpacing: '2px', color: '#7B60FF66', fontWeight: 700, marginBottom: 8 }}>SYS HEALTH</div>

        {[
          { label: 'AI PROVIDER', val: providerOn ? 'LIVE' : 'OFF', pct: providerOn ? 80 : 0, col: providerOn ? accent : '#FF5544' },
          { label: 'MEM NODES',   val: String(memCount),   pct: Math.min(100, (memCount / 200) * 100),   col: '#4DC8FF44' },
          { label: 'VAULT FILES', val: String(vaultFiles), pct: Math.min(100, (vaultFiles / 100) * 100), col: '#4DC8FF33' },
        ].map(row => (
          <div key={row.label} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 8, color: '#5050a0', letterSpacing: '0.8px' }}>{row.label}</span>
              <span style={{ fontSize: 8, color: row.col.length === 7 ? row.col : '#60CCFF', fontFamily: 'monospace', fontWeight: 600 }}>{row.val}</span>
            </div>
            <div style={{ height: 2, background: '#0c0c18', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${row.pct}%`, background: row.col, transition: 'width 1s ease' }} />
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, background: offline ? '#FF6B35' : '#44DD88', boxShadow: `0 0 5px ${offline ? '#FF6B35' : '#44DD88'}` }} />
          <span style={{ fontSize: 7.5, color: '#1e1e34', letterSpacing: '1px' }}>{offline ? 'ISOLATED' : 'OPERATIONAL'}</span>
        </div>
      </div>
      <div style={{ padding: '5px 13px 9px', flexShrink: 0 }}>
        <div style={{ fontSize: 7, color: '#1a1a28', letterSpacing: '1px' }}>v0.1 ALPHA</div>
      </div>
    </div>
  )
}

// ── Panel Header ──────────────────────────────────────────────────────────────
function PanelHeader({ status, offline }) {
  return (
    <div style={{
      padding: '14px 16px 11px',
      borderBottom: `1px solid ${offline ? 'rgba(220,60,20,0.20)' : 'rgba(100,55,200,0.18)'}`,
      flexShrink: 0,
      background: offline ? 'rgba(30,5,2,0.4)' : 'rgba(20,8,50,0.4)',
    }}>
      <div style={{ fontSize: 8.5, letterSpacing: '3px', color: offline ? '#FF6B3588' : '#7B60FF88', fontWeight: 700, marginBottom: 6 }}>
        NETWORK OPERATIONS
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: offline ? '#FF6B35' : '#44DD88', boxShadow: `0 0 8px ${offline ? '#FF6B35' : '#44DD88'}` }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: offline ? '#FF9070' : '#e8e8f8', letterSpacing: '0.5px' }}>
          {offline ? 'EMERGENCY ISOLATION' : 'ALL SYSTEMS OPERATIONAL'}
        </span>
      </div>
      {status && !offline && (
        <div style={{ fontSize: 9.5, color: '#6050a0' }}>
          <span style={{ color: '#9878FF' }}>{status.active_provider?.toUpperCase()}</span>
          {' · '}
          <span style={{ color: '#60DDFF', fontFamily: 'monospace', fontSize: 9 }}>{status.active_model}</span>
        </div>
      )}
    </div>
  )
}

// ── Connection Status ─────────────────────────────────────────────────────────
const EVT_COLOR = { system: '#5B8FFF', security: '#FF5544', memory: '#4DC8FF', provider: '#A855F7', voice: '#FF9555' }

function ConnectionStatus({ status, offline }) {
  const rows = [
    { key: 'internet', label: 'INTERNET',    icon: '◉', online: status?.internet?.online,                            detail: status?.internet?.online ? `${status.internet.latency_ms}ms` : 'Unreachable' },
    { key: 'backend',  label: 'BACKEND',     icon: '◈', online: !!status,                                            detail: status ? 'localhost:8000' : 'Offline' },
    { key: 'ollama',   label: 'AI PROVIDER', icon: '⬡', online: status?.providers?.ollama?.online && !offline,       detail: offline ? 'Isolated' : status?.providers?.ollama?.online ? status?.active_provider?.toUpperCase() : 'Unreachable' },
    { key: 'vault',    label: 'VAULT SYNC',  icon: '◈', online: !!status?.memory?.vault_exists,                      detail: status?.memory?.vault_exists ? `${status.memory.vault_md_count} files` : 'Not found' },
    { key: 'voice',    label: 'VOICE SYS',   icon: '♪', online: !!status?.voice?.enabled,                            detail: status?.voice?.enabled ? `${status.voice.stt_provider}/${status.voice.tts_provider}` : 'Inactive' },
    { key: 'discord',  label: 'DISCORD',     icon: '⚙', online: true,                                                detail: 'Desktop' },
  ]
  return (
    <div style={{ padding: '8px 16px 6px', borderBottom: `1px solid ${offline ? 'rgba(200,55,18,0.16)' : 'rgba(90,48,180,0.16)'}`, flexShrink: 0 }}>
      <div style={{ fontSize: 8.5, letterSpacing: '2.5px', color: offline ? '#FF6B3555' : '#7B60FF77', fontWeight: 700, marginBottom: 7 }}>CONNECTIONS</div>
      {rows.map(row => (
        <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4.5px 0', borderBottom: '1px solid rgba(60,30,100,0.10)' }}>
          <span style={{ fontSize: 8, color: '#5050a0', width: 11, flexShrink: 0 }}>{row.icon}</span>
          <span style={{ fontSize: 9.5, letterSpacing: '0.8px', color: '#9090b8', fontWeight: 600, flex: 1 }}>{row.label}</span>
          <span style={{ fontSize: 8.5, color: '#5858a0', marginRight: 5, fontFamily: 'monospace' }}>{row.detail}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 700, minWidth: 30, color: row.online == null ? '#3a3a5a' : row.online ? '#44DD88' : '#FF5544' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: row.online == null ? '#2e2e48' : row.online ? '#44DD88' : '#FF5544', boxShadow: row.online ? '0 0 6px #44DD88' : row.online === false ? '0 0 4px #FF554466' : 'none' }} />
            {row.online == null ? '——' : row.online ? 'ON' : 'OFF'}
          </span>
        </div>
      ))}
    </div>
  )
}

const EVT_ICON = { system: '⚙', security: '⚠', memory: '◉', provider: '⬡', voice: '♪', network: '⇅' }
const EVT_LABEL_COL = { system: '#5B8FFF', security: '#FF5544', memory: '#A855F7', provider: '#7B60FF', voice: '#FF9555', network: '#4DC8FF' }

// ── Activity Feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ events }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '9px 16px 5px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(80,40,160,0.12)' }}>
        <div style={{ fontSize: 8.5, letterSpacing: '2.5px', color: '#7B60FF88', fontWeight: 700 }}>ACTIVITY FEED</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#44DD88', boxShadow: '0 0 6px #44DD88' }} />
          <div style={{ fontSize: 8, color: '#44DD8888', letterSpacing: '1px', fontWeight: 700 }}>LIVE</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
        {events.length === 0 && (
          <div style={{ fontSize: 10, color: '#3a3a5a', padding: '12px 16px', fontStyle: 'italic' }}>No events recorded.</div>
        )}
        {events.map(evt => {
          const col = EVT_COLOR[evt.category] || '#5B8FFF'
          const lCol = EVT_LABEL_COL[evt.category] || '#5B8FFF'
          const icon = EVT_ICON[evt.category] || '⚙'
          return (
            <div key={evt.id} style={{
              display: 'flex', gap: 0,
              borderBottom: '1px solid rgba(60,30,100,0.10)',
              borderLeft: `3px solid ${col}55`,
              background: `${col}06`,
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${col}12` }}
            onMouseLeave={e => { e.currentTarget.style.background = `${col}06` }}
            >
              {/* Category icon */}
              <div style={{
                width: 36, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: col,
                textShadow: `0 0 8px ${col}`,
              }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0, padding: '6px 12px 6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '1.5px', color: lCol, textTransform: 'uppercase' }}>
                    {evt.category}
                  </span>
                  <span style={{ fontSize: 7.5, color: '#5858a0', marginLeft: 'auto', fontFamily: 'monospace' }}>
                    {fmtTime(evt.timestamp)}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#c8c8e8', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {evt.title}
                </div>
                {evt.detail && (
                  <div style={{ fontSize: 8.5, color: '#7070a0', marginTop: 2, lineHeight: 1.4 }}>
                    {evt.detail}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
function QuickActions({ offline, testing, onTest, onRefresh, onLogs, onExport, onVault, onVoice, onEmergency, onReconnect, reconnecting }) {
  const tiles = [
    { label: 'TEST CONN',  icon: '◉', action: onTest,                    loading: testing   },
    { label: 'REFRESH',    icon: '↻', action: onRefresh                                      },
    { label: 'VIEW LOGS',  icon: '▤', action: onLogs                                         },
    { label: 'EXPORT',     icon: '↗', action: onExport                                       },
    { label: 'OPEN VAULT', icon: '◈', action: onVault                                        },
    { label: 'VOICE SYS',  icon: '♪', action: onVoice                                        },
    { label: offline ? 'RECONNECT' : 'EMERGENCY', icon: offline ? '◎' : '⚠',
      action: offline ? onReconnect : onEmergency, loading: reconnecting, danger: true },
  ]
  return (
    <div style={{ padding: '9px 16px 14px', flexShrink: 0, borderTop: `1px solid ${offline ? 'rgba(200,55,18,0.16)' : 'rgba(90,48,180,0.16)'}` }}>
      <div style={{ fontSize: 8.5, letterSpacing: '2.5px', color: '#7B60FF88', fontWeight: 700, marginBottom: 8 }}>QUICK ACTIONS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
        {tiles.map(tile => <QBtn key={tile.label} {...tile} />)}
      </div>
    </div>
  )
}

function QBtn({ label, icon, action, loading, danger }) {
  const [hov, setHov] = useState(false)
  const baseBg   = danger ? 'rgba(80,10,3,0.28)'   : 'rgba(35,16,85,0.35)'
  const hovBg    = danger ? 'rgba(160,25,8,0.50)'   : 'rgba(70,35,160,0.55)'
  const baseBdr  = danger ? 'rgba(200,45,25,0.40)'  : 'rgba(110,65,220,0.38)'
  const hovBdr   = danger ? 'rgba(255,65,40,0.75)'  : 'rgba(150,100,255,0.75)'
  const baseCol  = danger ? '#CC5544'                : '#8878cc'
  const hovCol   = danger ? '#FF9977'                : '#ddccff'
  const glow     = danger ? 'rgba(220,50,20,0.35)'  : 'rgba(100,60,255,0.30)'
  return (
    <button onClick={action} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      padding: '10px 7px',
      background: hov ? hovBg : baseBg,
      border: `1px solid ${hov ? hovBdr : baseBdr}`,
      borderRadius: 7, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
      transition: 'all 0.18s',
      color: hov ? hovCol : baseCol,
      boxShadow: hov ? `0 0 18px ${glow}, inset 0 1px 0 rgba(255,255,255,0.08)` : `inset 0 1px 0 rgba(255,255,255,0.04)`,
    }}>
      <div style={{ fontSize: 15, marginBottom: 3, filter: hov ? `drop-shadow(0 0 6px ${danger ? '#FF6644' : '#aa88ff'})` : 'none' }}>{loading ? '…' : icon}</div>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1.2 }}>{loading ? 'WORKING' : label}</div>
    </button>
  )
}

// ── Telemetry Bar (live operational status strip) ─────────────────────────────
function TelemetryBar({ status, offline }) {
  const [tick, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 900); return () => clearInterval(id) }, [])

  const provider  = status?.active_provider?.toUpperCase() || '—'
  const model     = status?.active_model || '—'
  const latency   = status?.providers?.ollama?.latency_ms
  const uptime    = fmtUptime(status?.uptime_seconds)
  const memNodes  = status?.memory?.memory_count || 0
  const internetOn = status?.internet?.online
  const voiceOn   = status?.voice?.enabled
  const integCount = [status?.voice?.enabled, true].filter(Boolean).length

  const latCol = latency == null ? '#5050a0' : latency < 100 ? '#44DD88' : latency < 500 ? '#FFAA44' : '#FF5544'

  const Dot = ({ on }) => (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%', verticalAlign: 'middle',
      background: on ? '#44DD88' : '#FF5544',
      boxShadow: on ? `0 0 ${6 + (tick % 2) * 3}px #44DD88` : '0 0 4px #FF554466',
      marginRight: 5, flexShrink: 0, transition: 'box-shadow 0.6s',
    }} />
  )

  const Sep = () => <span style={{ color: '#3a3060', fontSize: 10, margin: '0 10px', flexShrink: 0 }}>│</span>

  const Item = ({ label, value, col = '#8080b0' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <span style={{ fontSize: 7.5, letterSpacing: '1.5px', color: '#5050a0', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 10, color: col, fontFamily: label === 'MODEL' ? 'monospace' : 'inherit', fontWeight: 600 }}>{value}</span>
    </div>
  )

  const Bars = ({ on }) => (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1.5, height: 9, marginRight: 3 }}>
      {[3, 5, 7, 9].map((h, i) => (
        <span key={i} style={{
          display: 'inline-block', width: 2.5, height: h,
          background: on && i <= (tick % 4) ? '#44DD88' : '#18182a',
          borderRadius: 0.5, transition: 'background 0.4s',
        }} />
      ))}
    </span>
  )

  return (
    <div style={{
      height: BOTTOM_H, flexShrink: 0, position: 'relative', overflow: 'hidden',
      borderTop: `1px solid ${offline ? 'rgba(200,55,18,0.35)' : 'rgba(90,48,180,0.30)'}`,
      background: offline ? 'rgba(8,1,0,0.97)' : 'rgba(4,1,12,0.97)',
      boxShadow: offline ? '0 -4px 30px rgba(150,30,5,0.15)' : '0 -4px 30px rgba(60,20,120,0.20)',
      display: 'flex', alignItems: 'center', paddingLeft: NAV_W + 16, paddingRight: 20,
    }}>
      {/* Flowing packet lines in background */}
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          width: 60, height: 1,
          background: offline ? 'rgba(180,35,8,0.06)' : 'rgba(90,55,210,0.06)',
          left: `${((tick * 8 * (i + 1) * 3 + i * 25) % 115) - 10}%`,
          pointerEvents: 'none',
        }} />
      ))}

      <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, marginRight: 10 }}>
          <Dot on={!offline} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2.5px', color: offline ? '#FF7755' : '#44DD88', textShadow: offline ? '0 0 8px #FF6B3555' : '0 0 8px #44DD8866' }}>
            {offline ? 'ISOLATED' : 'ONLINE'}
          </span>
        </div>
        <Sep />
        <Item label="PROVIDER" value={provider} col="#7B60FF" />
        <Sep />
        <Item label="MODEL" value={model.length > 20 ? model.slice(0, 20) + '…' : model} col="#4DC8FF" />
        <Sep />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 7.5, letterSpacing: '1.5px', color: '#5050a0', fontWeight: 700 }}>LATENCY</span>
          <span style={{ fontSize: 10, color: latCol, fontFamily: 'monospace', fontWeight: 600 }}>{latency == null ? '—' : `${latency}ms`}</span>
        </div>
        <Sep />
        <Item label="UPTIME" value={uptime} col="#9090c0" />
        <Sep />
        <Item label="MEM" value={`${memNodes} nodes`} col="#C077FF" />
        <Sep />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 7.5, letterSpacing: '1.5px', color: '#5050a0', fontWeight: 700 }}>INTERNET</span>
          <Bars on={internetOn} />
          <span style={{ fontSize: 9.5, fontWeight: 600, color: internetOn ? '#44DD88' : '#FF5544' }}>
            {internetOn ? `${status?.internet?.latency_ms}ms` : 'NO SIGNAL'}
          </span>
        </div>
        <Sep />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 7.5, letterSpacing: '1.5px', color: '#5050a0', fontWeight: 700 }}>VOICE</span>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: voiceOn ? '#FF9555' : '#454575' }}>{voiceOn ? 'ACTIVE' : 'OFF'}</span>
        </div>
        <Sep />
        <Item label="INTEG" value={`${integCount}/3`} col="#8899EE" />
      </div>

      <LiveClock offline={offline} />
    </div>
  )
}

function LiveClock({ offline }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const upd = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    upd(); const id = setInterval(upd, 1000); return () => clearInterval(id)
  }, [])
  return (
    <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: 14 }}>
      <div style={{ fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: offline ? '#FF6B3577' : '#8870cc', letterSpacing: '2px', textShadow: offline ? 'none' : '0 0 8px rgba(120,90,220,0.4)' }}>{time}</div>
      <div style={{ fontSize: 7, color: '#404070', letterSpacing: '1.5px', marginTop: 1 }}>LOCAL TIME</div>
    </div>
  )
}

// ── Node Tooltip ──────────────────────────────────────────────────────────────
function NodeTooltip({ node, pos }) {
  const col = node.color || '#7B60FF'
  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.1 }}
      style={{
        position: 'absolute', left: pos.x + 20, top: Math.max(8, pos.y - 30),
        pointerEvents: 'none', zIndex: 50,
        background: 'rgba(3,1,10,0.98)', border: `1px solid ${col}2e`, borderRadius: 8,
        padding: '10px 13px', minWidth: 172, maxWidth: 238,
        boxShadow: `0 0 22px ${col}12, 0 4px 18px rgba(0,0,0,0.65)`,
        backdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 13 }}>{node.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 10.5, color: col, letterSpacing: '1.2px' }}>{node.label}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 7, letterSpacing: '0.8px', fontWeight: 700,
          padding: '2px 6px', borderRadius: 3,
          border: `1px solid ${!node.configured ? '#28284a' : node.online ? '#44DD8833' : '#FF554433'}`,
          color: !node.configured ? '#383858' : node.online ? '#44DD88' : '#FF5544',
          background: !node.configured ? 'transparent' : node.online ? 'rgba(25,90,45,0.14)' : 'rgba(90,18,18,0.14)',
        }}>
          {!node.configured ? 'INACTIVE' : node.online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <div style={{ width: '100%', height: 1, background: col + '18', marginBottom: 7 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 11px' }}>
        {node.sub && (
          <div><div style={{ fontSize: 7, color: '#2e2858', letterSpacing: '1px', marginBottom: 1 }}>STATUS</div>
            <div style={{ fontSize: 9, color: '#888' }}>{node.sub}</div></div>
        )}
        {node.detail && (
          <div><div style={{ fontSize: 7, color: '#2e2858', letterSpacing: '1px', marginBottom: 1 }}>ENDPOINT</div>
            <div style={{ fontSize: 8, color: '#484868', fontFamily: 'monospace' }}>{node.detail}</div></div>
        )}
        {node.latency != null && (
          <div><div style={{ fontSize: 7, color: '#2e2858', letterSpacing: '1px', marginBottom: 1 }}>LATENCY</div>
            <div style={{ fontSize: 9, color: '#4DC8FF', fontFamily: 'monospace' }}>{fmtLatency(node.latency)}</div></div>
        )}
        {node.active && (
          <div><div style={{ fontSize: 7, color: '#2e2858', letterSpacing: '1px', marginBottom: 1 }}>ROLE</div>
            <div style={{ fontSize: 8.5, color: col }}>ACTIVE</div></div>
        )}
      </div>
    </motion.div>
  )
}

// ── Emergency Modal ───────────────────────────────────────────────────────────
function EmergencyModal({ onConfirm, onCancel, disconnecting }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.86)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(5px)' }}
      onClick={onCancel}>
      <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(4,1,11,0.99)', border: '1px solid rgba(245,52,22,0.42)', borderRadius: 10, padding: 27, maxWidth: 395, width: '90%', boxShadow: '0 0 55px rgba(190,38,8,0.16)' }}>
        <div style={{ fontSize: 9.5, letterSpacing: '3px', color: '#FF5544', fontWeight: 700, marginBottom: 11 }}>⚠ EMERGENCY DISCONNECT</div>
        <div style={{ fontSize: 11.5, color: '#888', lineHeight: 1.7, marginBottom: 11 }}>This will immediately:</div>
        <ul style={{ fontSize: 11, color: '#606060', lineHeight: 2, marginBottom: 15, paddingLeft: 16 }}>
          <li>Disable all external AI providers</li>
          <li>Terminate active provider connections</li>
          <li>Halt all outgoing API requests</li>
          <li>Force NYX into offline isolation mode</li>
        </ul>
        <div style={{ fontSize: 10, color: '#FF7755', padding: '7px 10px', background: 'rgba(175,32,8,0.09)', borderRadius: 5, marginBottom: 17 }}>
          Use RECONNECT SYSTEMS to restore afterward.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px 0', background: 'rgba(35,18,72,0.16)', border: '1px solid rgba(75,42,152,0.23)', borderRadius: 6, color: '#666', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9.5, letterSpacing: '1.5px' }}>CANCEL</button>
          <button onClick={onConfirm} disabled={disconnecting} style={{ flex: 1, padding: '9px 0', background: 'rgba(155,27,7,0.26)', border: '1px solid rgba(245,52,22,0.48)', borderRadius: 6, color: '#FF7755', cursor: disconnecting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 9.5, fontWeight: 700, letterSpacing: '1.5px', opacity: disconnecting ? 0.5 : 1 }}>
            {disconnecting ? 'DISCONNECTING…' : 'CONFIRM DISCONNECT'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Diagnostics Modal ─────────────────────────────────────────────────────────
function DiagnosticsModal({ results, testing, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(5px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(4,2,13,0.99)', border: '1px solid rgba(85,52,182,0.32)', borderRadius: 10, padding: 23, maxWidth: 415, width: '90%' }}>
        <div style={{ fontSize: 9, letterSpacing: '3px', color: '#7B60FF', fontWeight: 700, marginBottom: 15 }}>DIAGNOSTICS RESULTS</div>
        {testing && <div style={{ fontSize: 11, color: '#484868', padding: '10px 0' }}>Running concurrent connection tests…</div>}
        {!testing && results?.error && <div style={{ fontSize: 11, color: '#FF5544' }}>{results.error}</div>}
        {!testing && results?.results && Object.entries(results.results).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '7.5px 0', borderBottom: '1px solid rgba(55,28,95,0.08)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: val.ok ? '#44DD88' : '#FF5544', display: 'inline-block', marginRight: 10, flexShrink: 0, boxShadow: `0 0 5px ${val.ok ? '#44DD88' : '#FF5544'}` }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#bbb', flex: 1, letterSpacing: '0.8px' }}>{key.toUpperCase()}</span>
            {val.latency_ms != null && <span style={{ fontSize: 9.5, color: '#4DC8FF', marginRight: 11, fontFamily: 'monospace' }}>{val.latency_ms}ms</span>}
            <span style={{ fontSize: 9, fontWeight: 700, color: val.ok ? '#44DD88' : '#FF5544' }}>{val.ok ? 'OK' : 'FAIL'}</span>
          </div>
        ))}
        {!testing && results?.all_ok != null && (
          <div style={{ marginTop: 11, padding: '8px 11px', borderRadius: 5, background: results.all_ok ? 'rgba(16,65,32,0.18)' : 'rgba(100,20,10,0.18)', fontSize: 10, fontWeight: 700, letterSpacing: '1px', color: results.all_ok ? '#44DD88' : '#FF7755' }}>
            {results.all_ok ? '✓ ALL CONNECTIONS NOMINAL' : '⚠ ISSUES DETECTED'}
          </div>
        )}
        <button onClick={onClose} style={{ marginTop: 15, width: '100%', padding: '8px 0', background: 'rgba(35,18,72,0.16)', border: '1px solid rgba(75,42,152,0.23)', borderRadius: 6, color: '#666', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9.5, letterSpacing: '1.5px' }}>CLOSE</button>
      </motion.div>
    </motion.div>
  )
}

// ── Logs Modal ────────────────────────────────────────────────────────────────
function LogsModal({ events, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(5px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(4,2,13,0.99)', border: '1px solid rgba(85,52,182,0.32)', borderRadius: 10, padding: 22, maxWidth: 535, width: '92%', maxHeight: '78vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 9, letterSpacing: '3px', color: '#7B60FF', fontWeight: 700, marginBottom: 11, flexShrink: 0 }}>SYSTEM EVENT LOG</div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {events.length === 0 && <div style={{ fontSize: 10.5, color: '#22223a' }}>No events recorded.</div>}
          {events.map(evt => (
            <div key={evt.id} style={{ padding: '6.5px 0', borderBottom: '1px solid rgba(45,22,75,0.08)', display: 'flex', gap: 10 }}>
              <div style={{ fontSize: 7.5, color: '#242238', fontFamily: 'monospace', flexShrink: 0, marginTop: 1, minWidth: 52 }}>{fmtTime(evt.timestamp)}</div>
              <div style={{ fontSize: 7.5, letterSpacing: '1px', color: EVT_COLOR[evt.category] || '#444', fontWeight: 700, flexShrink: 0, width: 46 }}>{evt.category?.toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#bbb' }}>{evt.title}</div>
                {evt.detail && <div style={{ fontSize: 8.5, color: '#303050', marginTop: 1 }}>{evt.detail}</div>}
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 11, padding: '8px 0', background: 'rgba(35,18,72,0.16)', border: '1px solid rgba(75,42,152,0.23)', borderRadius: 6, color: '#666', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9.5, letterSpacing: '1.5px', flexShrink: 0 }}>CLOSE</button>
      </motion.div>
    </motion.div>
  )
}

// ── Voice Modal ───────────────────────────────────────────────────────────────
function VoiceModal({ status, onClose }) {
  const v = status?.voice
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, backdropFilter: 'blur(5px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'rgba(4,2,13,0.99)', border: '1px solid rgba(85,52,182,0.32)', borderRadius: 10, padding: 23, maxWidth: 375, width: '90%' }}>
        <div style={{ fontSize: 9, letterSpacing: '3px', color: '#7B60FF', fontWeight: 700, marginBottom: 13 }}>VOICE SYSTEM</div>
        {!v?.enabled ? (
          <>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 9, lineHeight: 1.6 }}>Voice system is not configured.</div>
            <div style={{ fontSize: 10, color: '#383858', lineHeight: 1.9, fontFamily: 'monospace', marginBottom: 13 }}>
              STT: <span style={{ color: '#303050' }}>{v?.stt_provider || 'none'}</span><br />
              TTS: <span style={{ color: '#303050' }}>{v?.tts_provider || 'none'}</span>
            </div>
            <div style={{ fontSize: 9.5, color: '#362c60', padding: '8px 10px', background: 'rgba(50,25,88,0.11)', borderRadius: 5, marginBottom: 15, lineHeight: 1.6 }}>
              Configure STT_PROVIDER and TTS_PROVIDER in .env and set VOICE_ENABLED=true.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 10.5, color: '#666', marginBottom: 15 }}>Voice active: {v.stt_provider} / {v.tts_provider}</div>
        )}
        <button onClick={onClose} style={{ width: '100%', padding: '8px 0', background: 'rgba(35,18,72,0.16)', border: '1px solid rgba(75,42,152,0.23)', borderRadius: 6, color: '#666', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9.5, letterSpacing: '1.5px' }}>CLOSE</button>
      </motion.div>
    </motion.div>
  )
}
