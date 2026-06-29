/**
 * SystemsPage.jsx — Nyx AI Operational Environment v2
 * Cinematic, fully-animated systems dashboard.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_URL } from '../utils/constants.js'
import { useTheme } from '../utils/themeContext.jsx'
import { THEMES } from '../utils/themes.js'

// ─────────────────────────────────────────────────────────────
// THEME HELPERS
// ─────────────────────────────────────────────────────────────
function getPRgb() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary-rgb').trim() || '123,77,255'
}
function getPHex() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary').trim() || '#7B4DFF'
}

// ─────────────────────────────────────────────────────────────
// BACKGROUND FX
// ─────────────────────────────────────────────────────────────
function BackgroundFX() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, t = 0
    const pts = []

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      pts.length = 0
      for (let i = 0; i < 80; i++) pts.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.20,
        vy: (Math.random() - 0.5) * 0.20,
        r: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.30 + 0.05,
      })
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const draw = () => {
      if (!canvas.width) { raf = requestAnimationFrame(draw); return }
      const { width: W, height: H } = canvas
      const rgb = getPRgb()
      t += 0.003
      ctx.clearRect(0, 0, W, H)

      // Tactical grid
      ctx.lineWidth = 0.5
      ctx.strokeStyle = `rgba(${rgb},0.028)`
      for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
      for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }

      // Particles
      pts.forEach(p => {
        p.x = (p.x + p.vx + W) % W
        p.y = (p.y + p.vy + H) % H
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${rgb},${p.a})`; ctx.fill()
      })

      // Constellation lines
      for (let i = 0; i < pts.length; i++) for (let j = i+1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
        if (d < 90) {
          ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y)
          ctx.strokeStyle = `rgba(${rgb},${0.05*(1-d/90)})`; ctx.lineWidth = 0.3; ctx.stroke()
        }
      }

      // Vignette
      const v = ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.82)
      v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(1,1,14,0.65)')
      ctx.fillStyle = v; ctx.fillRect(0,0,W,H)

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:0 }} />
}

// ─────────────────────────────────────────────────────────────
// NYX CORE CANVAS
// ─────────────────────────────────────────────────────────────
const CORE_NODES = [
  { label:'LOCAL AI',  color:'#A874FF', baseAngle: 0 },
  { label:'MEMORY',    color:'#4DC8FF', baseAngle: Math.PI/3 },
  { label:'VOICE',     color:'#FF9555', baseAngle: 2*Math.PI/3 },
  { label:'OPENCLAW',  color:'#22c55e', baseAngle: Math.PI },
  { label:'TOOLS',     color:'#C77DFF', baseAngle: 4*Math.PI/3 },
  { label:'CLOUD AI',  color:'#5B8FFF', baseAngle: 5*Math.PI/3 },
]

function NyxCoreCanvas({ activity = 0.5 }) {
  const ref    = useRef(null)
  const actRef = useRef(activity)
  actRef.current = activity

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx  = canvas.getContext('2d')
    const SZ   = 400
    const dpr  = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = canvas.height = SZ * dpr
    ctx.scale(dpr, dpr)
    const cx = SZ / 2, cy = SZ / 2

    const rings = [
      { r:64,  spd:0.009,  tilt:0.18, w:1.6, dash:[] },
      { r:92,  spd:-0.006, tilt:-0.28, w:1.0, dash:[] },
      { r:122, spd:0.004,  tilt:0.44, w:0.7, dash:[] },
      { r:152, spd:-0.0025,tilt:0.08, w:1.1, dash:[] },
    ]
    rings.forEach(r => r._a = 0)
    const pulse_particles = []
    let t = 0, raf

    const draw = () => {
      const act = actRef.current
      t += 0.013 + act * 0.007
      const rgb = getPRgb()
      ctx.clearRect(0, 0, SZ, SZ)

      // Ambient halo
      const halo = ctx.createRadialGradient(cx,cy,130,cx,cy,210)
      halo.addColorStop(0, `rgba(${rgb},${0.04+act*0.05})`)
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo; ctx.fillRect(0,0,SZ,SZ)

      // Node orbitals
      CORE_NODES.forEach((nd, i) => {
        const ang = nd.baseAngle + t * 0.0015 * (i%2===0?1:-1)
        const nr  = 183
        nd._x = cx + Math.cos(ang)*nr
        nd._y = cy + Math.sin(ang)*nr

        // Routing line
        ctx.save()
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(nd._x,nd._y)
        ctx.strokeStyle = `rgba(${rgb},${0.09+0.05*Math.sin(t+i)})`
        ctx.lineWidth = 0.7; ctx.stroke()
        ctx.restore()

        // Data pulse
        const tp = ((t*0.28 + i*0.55) % 1)
        ctx.beginPath()
        ctx.arc(cx+(nd._x-cx)*tp, cy+(nd._y-cy)*tp, 2.2, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${rgb},${0.75*Math.sin(tp*Math.PI)})`; ctx.fill()

        // Node dot
        ctx.save()
        ctx.shadowBlur = 0
        ctx.beginPath(); ctx.arc(nd._x, nd._y, 5, 0, Math.PI*2)
        ctx.fillStyle = nd.color; ctx.fill()
        ctx.restore()

        // Node label
        ctx.font = '8px "Share Tech Mono",monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(210,190,255,0.55)'
        ctx.fillText(nd.label, nd._x, nd._y + 15)
      })

      // Rotating rings
      rings.forEach((ring, i) => {
        ring._a += ring.spd
        const alpha = 0.28 + 0.10*Math.sin(t*0.4+i)
        ctx.save()
        ctx.translate(cx,cy); ctx.rotate(ring._a); ctx.scale(1, Math.cos(ring.tilt))
        ctx.shadowBlur = 0
        ctx.beginPath(); ctx.arc(0,0, ring.r, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${rgb},${alpha})`
        ctx.lineWidth = ring.w; ctx.setLineDash(ring.dash); ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      })

      // Central orb
      const orbR = 48 + Math.sin(t*1.1)*2
      const cg = ctx.createRadialGradient(cx,cy,0,cx,cy,orbR)
      cg.addColorStop(0, `rgba(255,250,255,${0.9+act*0.1})`)
      cg.addColorStop(0.28, `rgba(${rgb},0.9)`)
      cg.addColorStop(0.7,  `rgba(${rgb},0.35)`)
      cg.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.save()
      ctx.shadowBlur = 35+act*25; ctx.shadowColor=`rgba(${rgb},0.85)`
      ctx.beginPath(); ctx.arc(cx,cy,orbR,0,Math.PI*2)
      ctx.fillStyle=cg; ctx.fill()
      ctx.restore()

      // Inner core
      const ig = ctx.createRadialGradient(cx,cy,0,cx,cy,22)
      ig.addColorStop(0,'rgba(240,230,255,0.95)')
      ig.addColorStop(0.5,`rgba(${rgb},0.55)`)
      ig.addColorStop(1,'rgba(0,0,0,0)')
      ctx.save()
      ctx.shadowBlur=10; ctx.shadowColor=`rgba(${rgb},0.7)`
      ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2)
      ctx.fillStyle=ig; ctx.fill()
      ctx.restore()

      // NYX label
      ctx.font = 'bold 10px "Rajdhani",sans-serif'
      ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,0.9)'
      ctx.fillText('N Y X', cx, cy+4)

      // Particles
      if (Math.random() < 0.14+act*0.18) {
        const a = Math.random()*Math.PI*2, s = 0.6+Math.random()*1.8
        pulse_particles.push({ x:cx, y:cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:1 })
      }
      for (let i = pulse_particles.length - 1; i >= 0; i--) {
        pulse_particles[i].x += pulse_particles[i].vx
        pulse_particles[i].y += pulse_particles[i].vy
        pulse_particles[i].life -= 0.014
        if (pulse_particles[i].life <= 0) pulse_particles.splice(i, 1)
      }
      pulse_particles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x,p.y, (1.8+p.life)*p.life, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${rgb},${p.life*0.65})`; ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} style={{ width:400, height:400, flexShrink:0 }} />
}

// ─────────────────────────────────────────────────────────────
// ROUTING ENGINE
// ─────────────────────────────────────────────────────────────
function RoutingEngine({ netStatus, aiStatus }) {
  const ollaOnline = netStatus?.providers?.ollama?.online
  const clawOnline = netStatus?.providers?.openclaw?.online
  const model      = aiStatus?.model || '—'
  const provider   = aiStatus?.provider?.toUpperCase() || '—'
  const ollaMs     = netStatus?.providers?.ollama?.latency_ms

  const nodeStyle = (active, sc) => ({
    fill: 'rgba(4,3,20,0.90)',
    stroke: active ? (sc || 'rgba(168,116,255,0.6)') : 'rgba(80,70,120,0.22)',
    strokeWidth: active ? 1 : 0.5,
  })

  const CY = 36
  const nodes = [
    { x:26,  label:'INPUT',    sub:'',              active:true,        sc:null },
    { x:118, label:'ROUTER',   sub:'local-first',   active:true,        sc:null },
    { x:230, label:'LOCAL AI', sub:model,           active:ollaOnline,  sc:'rgba(168,116,255,0.65)' },
    { x:230, label:'CLOUD AI', sub:'standby',       active:false,       sc:'rgba(91,143,255,0.35)', yOff:24 },
    { x:342, label:'OPENCLAW', sub:clawOnline?`${netStatus?.providers?.openclaw?.latency_ms??'?'}ms`:'offline',
      active:clawOnline, sc:'rgba(34,197,94,0.55)' },
    { x:456, label:'RESPONSE', sub:'',              active:true,        sc:null },
  ]

  return (
    <div style={{ width:'100%', overflow:'hidden' }}>
      <style>{`
        @keyframes nyx-flow { from { stroke-dashoffset: 52 } to { stroke-dashoffset: 0 } }
        @keyframes nyx-flow-slow { from { stroke-dashoffset: 44 } to { stroke-dashoffset: 0 } }
        .nyx-flow  { animation: nyx-flow 1.4s linear infinite; }
        .nyx-flows { animation: nyx-flow-slow 2.6s linear infinite; }
      `}</style>
      <svg viewBox="0 0 500 70" width="100%" height="70" style={{ overflow:'visible' }}>
        <defs>
          <filter id="rg2" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <line x1="56" y1={CY} x2="84" y2={CY} stroke="rgba(168,116,255,0.5)" strokeWidth="1.1" strokeDasharray="4 7" className="nyx-flow" />
        <line x1="152" y1={CY} x2="196" y2={CY}
          stroke={ollaOnline ? 'rgba(168,116,255,0.65)' : 'rgba(80,70,120,0.18)'}
          strokeWidth={ollaOnline ? 1.2 : 0.6}
          strokeDasharray="4 7" className={ollaOnline ? 'nyx-flow' : ''} />
        <path d={`M 152 ${CY} Q 192 ${CY} 196 ${CY+24}`}
          fill="none" stroke="rgba(91,143,255,0.12)" strokeWidth="0.6" strokeDasharray="3 8" />
        <line x1="264" y1={CY} x2="308" y2={CY}
          stroke={clawOnline && ollaOnline ? 'rgba(34,197,94,0.5)' : 'rgba(60,60,80,0.18)'}
          strokeWidth={clawOnline ? 1.1 : 0.5}
          strokeDasharray="4 8" className={clawOnline && ollaOnline ? 'nyx-flows' : ''} />
        <line x1="376" y1={CY} x2="422" y2={CY} stroke="rgba(168,116,255,0.55)" strokeWidth="1.1" strokeDasharray="4 7" className="nyx-flow" />
        {nodes.map((n, i) => {
          const y = CY + (n.yOff || 0)
          const s = nodeStyle(n.active, n.sc)
          return (
            <g key={i} filter="url(#rg2)">
              <rect x={n.x-30} y={y-12} width="60" height="22" rx="4"
                fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth} />
              <text x={n.x} y={y-2} textAnchor="middle"
                fill={n.active ? (n.sc || 'rgba(200,180,255,0.8)') : 'rgba(120,110,160,0.5)'}
                fontFamily="Rajdhani,sans-serif" fontSize="8.5" fontWeight="700" letterSpacing="1">
                {n.label}
              </text>
              <text x={n.x} y={y+8} textAnchor="middle"
                fill="rgba(120,108,165,0.40)"
                fontFamily="Share Tech Mono,monospace" fontSize="6.5">
                {n.sub}
              </text>
            </g>
          )
        })}
        <text x="250" y="65" textAnchor="middle"
          fill="rgba(140,120,200,0.28)"
          fontFamily="Share Tech Mono,monospace" fontSize="7" letterSpacing="1.5">
          MODEL: {model} · PROVIDER: {provider}{ollaMs != null ? ` · ${ollaMs}ms` : ''}
        </text>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CIRCULAR GAUGE
// ─────────────────────────────────────────────────────────────
function CircularGauge({ value = 0, max = 100, label, sub, danger, size = 82 }) {
  const pct   = Math.min(Math.max(value || 0, 0) / (max || 100), 1)
  const R     = size * 0.37
  const C     = size / 2
  const circ  = 2 * Math.PI * R
  const arc   = circ * 0.75
  const valArc = arc * pct
  const col   = danger ? '#ef4444' : 'var(--color-primary)'
  const shadowCol = danger ? '#ef444470' : `rgba(var(--color-primary-rgb),0.7)`

  return (
    <svg width={size} height={size} style={{ overflow:'visible' }}>
      {/* Track */}
      <circle cx={C} cy={C} r={R}
        fill="none"
        stroke="rgba(var(--color-primary-rgb),0.10)"
        strokeWidth={size * 0.058}
        strokeDasharray={`${arc} ${circ - arc}`}
        strokeLinecap="round"
        transform={`rotate(135 ${C} ${C})`}
      />
      {/* Value arc */}
      <circle cx={C} cy={C} r={R}
        fill="none"
        stroke={col}
        strokeWidth={size * 0.058}
        strokeDasharray={`${valArc} ${circ - valArc}`}
        strokeLinecap="round"
        transform={`rotate(135 ${C} ${C})`}
        style={{
          transition: 'stroke-dasharray 0.7s ease',
          filter: `drop-shadow(0 0 3px ${shadowCol})`,
        }}
      />
      {/* Inner glow dot at tip */}
      {pct > 0.02 && (() => {
        const tipAngle = (135 + 270 * pct) * Math.PI / 180
        const tx = C + R * Math.cos(tipAngle)
        const ty = C + R * Math.sin(tipAngle)
        return (
          <circle cx={tx} cy={ty} r={size * 0.035} fill={col}
            style={{ filter: `drop-shadow(0 0 2px ${shadowCol})` }} />
        )
      })()}
      {/* Percentage */}
      <text x={C} y={C + size * 0.04} textAnchor="middle"
        fill={danger ? '#ef4444' : 'var(--color-text-primary)'}
        fontFamily="Share Tech Mono, monospace"
        fontSize={size * 0.165}
        fontWeight="700"
      >{Math.round(value || 0)}%</text>
      {/* Label */}
      <text x={C} y={C + size * 0.19} textAnchor="middle"
        fill="rgba(var(--color-primary-rgb),0.45)"
        fontFamily="Rajdhani, sans-serif"
        fontSize={size * 0.11}
        fontWeight="700"
        letterSpacing="0.10em"
        textTransform="uppercase"
      >{label}</text>
      {/* Sub text */}
      {sub && (
        <text x={C} y={C + size * 0.30} textAnchor="middle"
          fill="rgba(var(--color-primary-rgb),0.28)"
          fontFamily="Share Tech Mono, monospace"
          fontSize={size * 0.086}
        >{sub}</text>
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// PERF GRAPH CANVAS
// ─────────────────────────────────────────────────────────────
function PerfGraphCanvas({ samplesRef }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, t = 0

    const draw = () => {
      t += 0.012
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      if (!W || !H) { raf = requestAnimationFrame(draw); return }

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width  = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const rgb = getPRgb()
      ctx.clearRect(0, 0, W, H)

      const raw = samplesRef.current
      const data = raw.length > 1
        ? raw
        : Array.from({ length: 40 }, (_, i) => 25 + 18 * Math.sin(i * 0.35 + t))

      const step = W / Math.max(data.length - 1, 1)

      // Grid
      ctx.strokeStyle = `rgba(${rgb},0.07)`
      ctx.lineWidth = 0.5
      ;[0.25, 0.5, 0.75].forEach(pct => {
        const y = H * (1 - pct * 0.82 - 0.09)
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      })

      // Gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, `rgba(${rgb},0.30)`)
      grad.addColorStop(0.6, `rgba(${rgb},0.08)`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')

      ctx.beginPath()
      ctx.moveTo(0, H)
      data.forEach((v, i) => {
        const x = i * step
        const y = H - (v / 100) * H * 0.82 - H * 0.09
        ctx.lineTo(x, y)
      })
      ctx.lineTo((data.length - 1) * step, H)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // Line
      ctx.beginPath()
      data.forEach((v, i) => {
        const x = i * step
        const y = H - (v / 100) * H * 0.82 - H * 0.09
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = `rgba(${rgb},0.85)`
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.stroke()

      // Live dot
      const lv  = data[data.length - 1]
      const lx  = (data.length - 1) * step
      const ly  = H - (lv / 100) * H * 0.82 - H * 0.09
      ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI*2)
      ctx.fillStyle = getPHex()
      ctx.shadowBlur = 8; ctx.shadowColor = getPHex()
      ctx.fill(); ctx.shadowBlur = 0

      // Axis labels
      ctx.font = '6.5px "Share Tech Mono",monospace'
      ctx.fillStyle = `rgba(${rgb},0.28)`
      ctx.textAlign = 'left'
      ctx.fillText('100%', 3, H * 0.09 + 5)
      ctx.fillText('50%',  3, H * (1 - 0.5 * 0.82 - 0.09) + 5)
      ctx.fillText('0%',   3, H - 3)

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [samplesRef])

  return <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
}

// ─────────────────────────────────────────────────────────────
// MINI WORLD MAP
// ─────────────────────────────────────────────────────────────
const MAP_LANDMASSES = [
  [[71,-140],[65,-130],[60,-140],[55,-130],[50,-125],[42,-124],[32,-117],
   [22,-110],[17,-100],[9,-85],[9,-78],[11,-62],[20,-73],[25,-77],[35,-75],
   [40,-74],[45,-67],[50,-55],[60,-65],[65,-55],[70,-68],[72,-80],[72,-95],
   [68,-105],[70,-95],[71,-140]],
  [[12,-72],[11,-62],[5,-52],[0,-50],[-5,-35],[-10,-37],[-23,-43],
   [-34,-53],[-55,-67],[-55,-64],[-42,-63],[-28,-49],[-22,-40],[-5,-35],[5,-52],[12,-72]],
  [[71,26],[60,25],[55,22],[54,14],[56,10],[58,5],[63,5],[68,18],[71,26]],
  [[37,10],[37,37],[25,38],[12,44],[-5,40],[-15,35],[-34,26],[-34,18],
   [-20,12],[0,9],[5,3],[10,-2],[15,-17],[20,-17],[35,-5],[37,10]],
  [[70,30],[70,60],[70,90],[70,120],[70,180],[60,180],[55,135],[40,140],
   [35,139],[25,120],[5,100],[1,104],[10,78],[25,57],[30,48],[40,40],
   [45,42],[55,60],[65,70],[70,30]],
  [[-13,130],[-14,136],[-12,140],[-18,147],[-25,153],[-38,147],
   [-38,140],[-34,123],[-22,115],[-17,122],[-13,130]],
]
const MAP_CITIES = [
  { lat:40.7, lon:-74.0 }, { lat:51.5, lon:-0.1 },
  { lat:35.7, lon:139.7 }, { lat:-33.9, lon:151.2 },
  { lat:1.4,  lon:103.8 }, { lat:25.2, lon:55.3 },
]

function MiniWorldMap() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, t = 0

    const draw = () => {
      t += 0.008
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      if (!W || !H) { raf = requestAnimationFrame(draw); return }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width  = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const rgb = getPRgb()
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = 'rgba(2,3,18,0.7)'
      ctx.fillRect(0, 0, W, H)

      // Grid lines
      ctx.strokeStyle = `rgba(${rgb},0.07)`
      ctx.lineWidth = 0.4
      for (let i = 1; i < 6; i++) {
        const x = W * i / 6
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let i = 1; i < 4; i++) {
        const y = H * i / 4
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Equator
      ctx.strokeStyle = `rgba(${rgb},0.12)`
      ctx.lineWidth = 0.5
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke()
      ctx.setLineDash([])

      const proj = (lat, lon) => ({
        x: (lon + 180) / 360 * W,
        y: (90 - lat) / 180 * H,
      })

      // Landmasses
      MAP_LANDMASSES.forEach(poly => {
        ctx.beginPath()
        poly.forEach(([lat, lon], i) => {
          const { x, y } = proj(lat, lon)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fillStyle = `rgba(${rgb},0.13)`
        ctx.fill()
        ctx.strokeStyle = `rgba(${rgb},0.38)`
        ctx.lineWidth = 0.6
        ctx.stroke()
      })

      // City dots + pulse rings
      MAP_CITIES.forEach((city, i) => {
        const { x, y } = proj(city.lat, city.lon)
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.9)
        ctx.beginPath()
        ctx.arc(x, y, 2 + pulse * 4, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${rgb},${0.18 * pulse})`
        ctx.lineWidth = 0.7; ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 1.8, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${rgb},0.9)`;  ctx.fill()
      })

      // Scan line
      const scanX = (t * 22) % W
      const sg = ctx.createLinearGradient(scanX - 22, 0, scanX + 2, 0)
      sg.addColorStop(0, 'rgba(0,0,0,0)')
      sg.addColorStop(1, `rgba(${rgb},0.10)`)
      ctx.fillStyle = sg
      ctx.fillRect(scanX - 22, 0, 24, H)

      // Border
      ctx.strokeStyle = `rgba(${rgb},0.18)`
      ctx.lineWidth = 0.8
      ctx.strokeRect(0.4, 0.4, W - 0.8, H - 0.8)

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} style={{ width:'100%', height:'100%', display:'block' }} />
}

// ─────────────────────────────────────────────────────────────
// LIVE CLOCK
// ─────────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const pad = n => String(n).padStart(2, '0')
  return (
    <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:13,
      color:'var(--color-text-primary)', letterSpacing:'0.12em' }}>
      {pad(t.getHours())}:{pad(t.getMinutes())}:{pad(t.getSeconds())}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// THEME PICKER
// ─────────────────────────────────────────────────────────────
function ThemePicker() {
  const { themeId, setThemeId } = useTheme()
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
      {THEMES.map(t => (
        <button key={t.id} onClick={() => setThemeId(t.id)} title={t.name}
          style={{
            width: themeId === t.id ? 11 : 7,
            height: themeId === t.id ? 11 : 7,
            borderRadius:'50%',
            background: t.preview.primary,
            border: themeId === t.id ? '1.5px solid rgba(255,255,255,0.65)' : '1px solid transparent',
            cursor:'pointer', padding:0, transition:'all 0.2s',
            boxShadow: themeId === t.id ? `0 0 7px ${t.preview.primary}` : 'none',
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL PRIMITIVES
// ─────────────────────────────────────────────────────────────
function HoloPanel({ title, badge, badgeColor = '#22c55e', children, style = {}, noMargin }) {
  return (
    <div style={{
      background: 'rgba(4,3,22,0.82)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(var(--color-primary-rgb),0.17)',
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: noMargin ? 0 : 8,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{ position:'absolute', top:0, left:'12%', right:'12%', height:1,
        background:'linear-gradient(90deg,transparent,rgba(var(--color-primary-rgb),0.50),transparent)' }}/>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:8.5, fontWeight:700,
          letterSpacing:'0.24em', textTransform:'uppercase',
          color:'var(--color-text-muted)' }}>{title}</span>
        {badge && (
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <motion.div animate={{ opacity:[1,0.25,1] }} transition={{ duration:2.2, repeat:Infinity }}
              style={{ width:5, height:5, borderRadius:'50%', background:badgeColor, boxShadow:`0 0 6px ${badgeColor}` }}/>
            <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
              color:badgeColor, letterSpacing:'0.10em' }}>{badge}</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
      padding:'3px 0', borderBottom:'1px solid rgba(var(--color-primary-rgb),0.05)' }}>
      <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:9, fontWeight:600,
        letterSpacing:'0.14em', textTransform:'uppercase',
        color:'rgba(var(--color-primary-rgb),0.42)' }}>{label}</span>
      <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:9,
        color: color || 'var(--color-text-primary)', letterSpacing:'0.04em' }}>{value ?? '—'}</span>
    </div>
  )
}

function ProvDot({ online, standby }) {
  const c = online ? '#22c55e' : standby ? '#666' : '#ef4444'
  return (
    <motion.div
      animate={{ opacity: online ? [1,0.4,1] : 1 }}
      transition={{ duration:2, repeat: online ? Infinity : 0 }}
      style={{ width:6, height:6, borderRadius:'50%', background:c,
        boxShadow:`0 0 5px ${c}`, flexShrink:0 }}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// LEFT COLUMN PANELS
// ─────────────────────────────────────────────────────────────
function AICorePanel({ aiStatus }) {
  const online = !!aiStatus
  return (
    <HoloPanel title="AI Core" badge={online?'ACTIVE':'LOADING'} badgeColor={online?'#a874ff':'#666'}>
      <Row label="Model"    value={aiStatus?.model} />
      <Row label="Provider" value={aiStatus?.provider?.toUpperCase()} />
      <Row label="Routing"  value="LOCAL-FIRST" color="rgba(var(--color-primary-rgb),0.7)" />
      <Row label="Voice"    value={aiStatus?.voice_enabled ? 'ENABLED' : 'DISABLED'}
        color={aiStatus?.voice_enabled ? '#22c55e' : 'rgba(var(--color-primary-rgb),0.4)'} />
      <Row label="User"     value={aiStatus?.user} />
    </HoloPanel>
  )
}

function MemoryVaultPanel({ netStatus }) {
  const m = netStatus?.memory
  const synced = m?.vault_exists
  return (
    <HoloPanel title="Memory Vault" badge={synced?'SYNCED':'NO VAULT'} badgeColor={synced?'#4DC8FF':'#666'}>
      <Row label="Nodes"    value={m?.memory_count != null ? `${m.memory_count} indexed` : null} />
      <Row label="Vault"    value={m?.vault_exists ? `${m.vault_md_count} files` : 'not found'}
        color={m?.vault_exists ? 'var(--color-text-primary)' : '#ef4444'} />
      <Row label="Sessions" value={m?.conv_log_count != null ? `${m.conv_log_count} logs` : null} />
      <Row label="Sync"     value={m?.last_synced ? 'RECENT' : 'PENDING'}
        color={m?.last_synced ? '#22c55e' : '#FF9555'} />
    </HoloPanel>
  )
}

function VoiceEnginePanel({ aiStatus }) {
  const enabled = aiStatus?.voice_enabled
  return (
    <HoloPanel title="Voice Engine" badge={enabled?'ACTIVE':'STANDBY'} badgeColor={enabled?'#FF9555':'#555'}>
      <Row label="Wake Word" value={enabled ? `"${aiStatus?.wake_word||'nyx'}"` : 'disabled'} />
      <Row label="STT"       value={aiStatus?.stt_provider || 'none'}
        color={aiStatus?.stt_provider && aiStatus.stt_provider!=='none' ? '#22c55e' : 'rgba(var(--color-primary-rgb),0.35)'} />
      <Row label="TTS"       value={aiStatus?.tts_provider || 'none'}
        color={aiStatus?.tts_provider && aiStatus.tts_provider!=='none' ? '#22c55e' : 'rgba(var(--color-primary-rgb),0.35)'} />
      <Row label="Mode"      value={aiStatus?.voice_mode || 'push-to-talk'} />
    </HoloPanel>
  )
}

function OpenClawPanel({ clawStatus }) {
  const online = clawStatus?.online
  return (
    <HoloPanel title="OpenClaw" badge={online?'ONLINE':'OFFLINE'} badgeColor={online?'#22c55e':'#ef4444'}>
      <Row label="Gateway" value={online ? `${clawStatus?.latency_ms??'?'}ms` : 'unreachable'}
        color={online ? '#22c55e' : '#ef4444'} />
      <Row label="Model"   value={clawStatus?.model} />
      <Row label="Mode"    value={clawStatus?.permission_mode?.toUpperCase()} />
      <Row label="Tools"   value={clawStatus?.tool_access ? 'ENABLED' : 'DISABLED'}
        color={clawStatus?.tool_access ? '#22c55e' : '#777'} />
      <Row label="Config"  value={clawStatus?.config_found ? 'FOUND' : 'MISSING'}
        color={clawStatus?.config_found ? 'var(--color-text-primary)' : '#ef4444'} />
    </HoloPanel>
  )
}

// ─────────────────────────────────────────────────────────────
// RIGHT COLUMN PANELS
// ─────────────────────────────────────────────────────────────
function HardwareGaugesPanel({ sysData }) {
  const c = sysData?.cpu
  const m = sysData?.memory
  const g = sysData?.gpu
  const d = sysData?.disk

  const gauges = [
    { label:'CPU',  value:c?.usage,  sub:c ? `${c.cores}c` : null,  danger:c?.usage > 85 },
    { label:'RAM',  value:m?.usage,  sub:m ? `${m.used_gb}/${m.total_gb}G` : null, danger:m?.usage > 88 },
    { label:'GPU',  value:g?.available ? g.usage : 0, sub:g?.temp_c != null ? `${g.temp_c}°C` : null, danger:g?.usage > 90 },
    { label:'DISK', value:d?.usage,  sub:d ? `${d.used_gb}/${d.total_gb}G` : null, danger:d?.usage > 90 },
  ]

  return (
    <HoloPanel title="Hardware Status" badge={sysData?'LIVE':'LOADING'} badgeColor={sysData?'#4DC8FF':'#666'}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, justifyItems:'center' }}>
        {gauges.map(gg => (
          <CircularGauge key={gg.label} {...gg} size={82} />
        ))}
      </div>
      {g?.name && (
        <div style={{ textAlign:'center', marginTop:5,
          fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
          color:'rgba(var(--color-primary-rgb),0.28)', letterSpacing:'0.05em' }}>
          {g.name}
        </div>
      )}
      {sysData?.network && (
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:5,
          fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
          color:'rgba(var(--color-primary-rgb),0.32)', letterSpacing:'0.04em' }}>
          <span>↑ {sysData.network.bytes_sent_mb} MB</span>
          <span>↓ {sysData.network.bytes_recv_mb} MB</span>
        </div>
      )}
    </HoloPanel>
  )
}

function ProviderNetworkPanel({ netStatus }) {
  const p = netStatus?.providers || {}
  const entries = [
    { key:'ollama',   label:'OLLAMA',    color:'var(--color-primary)' },
    { key:'openclaw', label:'OPENCLAW',  color:'#22c55e' },
    { key:'openai',   label:'OPENAI',    color:'#5B8FFF' },
    { key:'claude',   label:'ANTHROPIC', color:'#C77DFF' },
  ]
  return (
    <HoloPanel title="Provider Network" badge="MONITORING" badgeColor="rgba(var(--color-primary-rgb),0.65)">
      {entries.map(({ key, label, color }) => {
        const pr = p[key]
        if (!pr) return null
        const online  = pr.online === true
        const standby = pr.online == null
        return (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:7, padding:'3.5px 0',
            borderBottom:'1px solid rgba(var(--color-primary-rgb),0.055)' }}>
            <ProvDot online={online} standby={standby} />
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:9.5, fontWeight:700,
              letterSpacing:'0.12em', color, flex:1 }}>{label}</span>
            <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:8.5,
              color: online ? '#22c55e' : standby ? '#666' : '#ef4444' }}>
              {online ? (pr.latency_ms != null ? `${pr.latency_ms}ms` : 'ONLINE') : standby ? 'STANDBY' : 'OFFLINE'}
            </span>
          </div>
        )
      })}
    </HoloPanel>
  )
}

function PermissionsPanel({ clawStatus }) {
  const perms = [
    { label:'Browser Control',    ok:true,  note:'Playwright' },
    { label:'Desktop Automation', ok:true,  note:'pyautogui' },
    { label:'File Read',          ok:true,  note:'limited scope' },
    { label:'File Modify',        ok:false, note:'confirm req.' },
    { label:'Network Requests',   ok:true,  note:'local only' },
    { label:'System Commands',    ok:false, note:'blocked' },
    { label:'Software Install',   ok:false, note:'blocked' },
  ]
  return (
    <HoloPanel title="Permissions" badge="ENFORCED" badgeColor="#FF9555">
      {perms.map(p => (
        <div key={p.label} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0',
          borderBottom:'1px solid rgba(var(--color-primary-rgb),0.05)' }}>
          <div style={{ width:5, height:5, borderRadius:'50%', flexShrink:0,
            background: p.ok ? '#22c55e' : '#ef4444',
            boxShadow:`0 0 4px ${p.ok ? '#22c55e50' : '#ef444450'}` }}/>
          <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:9, fontWeight:600,
            letterSpacing:'0.08em', flex:1, color:'var(--color-text-secondary)',
            textTransform:'uppercase' }}>{p.label}</span>
          <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
            color: p.ok ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.45)' }}>{p.note}</span>
        </div>
      ))}
    </HoloPanel>
  )
}

function GlobalViewPanel() {
  return (
    <HoloPanel title="Global View" badge="TACTICAL" badgeColor="rgba(var(--color-primary-rgb),0.65)">
      <div style={{ height:95, borderRadius:6, overflow:'hidden' }}>
        <MiniWorldMap />
      </div>
    </HoloPanel>
  )
}

// ─────────────────────────────────────────────────────────────
// BOTTOM PANELS
// ─────────────────────────────────────────────────────────────
const INIT_TASKS = [
  { id:1, name:'Memory constellation sync', status:'ACTIVE',   color:'#22c55e' },
  { id:2, name:'Vault index rebuild',        status:'PENDING',  color:'#FF9555' },
  { id:3, name:'OpenClaw heartbeat',         status:'ACTIVE',   color:'#22c55e' },
  { id:4, name:'Model router calibration',   status:'COMPLETE', color:'#4DC8FF' },
  { id:5, name:'Conversation archival',      status:'QUEUED',   color:'#666' },
]

function ActiveTasksPanel() {
  const [tasks, setTasks] = useState(INIT_TASKS)

  useEffect(() => {
    const id = setInterval(() => {
      setTasks(prev => prev.map(t => {
        if (t.status === 'ACTIVE'   && Math.random() < 0.12) return { ...t, status:'COMPLETE', color:'#4DC8FF' }
        if (t.status === 'PENDING'  && Math.random() < 0.20) return { ...t, status:'ACTIVE',   color:'#22c55e' }
        if (t.status === 'COMPLETE' && Math.random() < 0.06) return { ...t, status:'QUEUED',   color:'#666' }
        if (t.status === 'QUEUED'   && Math.random() < 0.10) return { ...t, status:'PENDING',  color:'#FF9555' }
        return t
      }))
    }, 3500)
    return () => clearInterval(id)
  }, [])

  const active = tasks.filter(t => t.status === 'ACTIVE').length

  return (
    <HoloPanel title="Active Tasks" badge={`${active} RUNNING`} badgeColor="#22c55e"
      style={{ flex:1, display:'flex', flexDirection:'column', marginBottom:0, height:'100%' }}>
      <div style={{ flex:1, overflow:'hidden' }}>
        {tasks.map(task => (
          <div key={task.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 0',
            borderBottom:'1px solid rgba(var(--color-primary-rgb),0.055)' }}>
            <motion.div animate={{ opacity: task.status==='ACTIVE' ? [1,0.25,1] : 1 }}
              transition={{ duration:1.6, repeat: task.status==='ACTIVE' ? Infinity : 0 }}
              style={{ width:5, height:5, borderRadius:'50%',
                background:task.color, boxShadow:`0 0 5px ${task.color}60`, flexShrink:0 }}
            />
            <span style={{ flex:1, fontFamily:'Rajdhani,sans-serif', fontSize:9.5, fontWeight:600,
              letterSpacing:'0.08em', color:'var(--color-text-secondary)', textTransform:'uppercase',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {task.name}
            </span>
            <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
              color:task.color, letterSpacing:'0.10em', flexShrink:0 }}>
              {task.status}
            </span>
          </div>
        ))}
      </div>
    </HoloPanel>
  )
}

function PerfGraphPanel({ sysData, samplesRef }) {
  const cur = sysData?.cpu?.usage
  return (
    <HoloPanel title="System Performance"
      badge={cur != null ? `CPU ${cur.toFixed(1)}%` : 'LOADING'}
      badgeColor="var(--color-primary)"
      style={{ flex:1.4, display:'flex', flexDirection:'column', marginBottom:0, height:'100%' }}>
      <div style={{ flex:1, minHeight:0 }}>
        <PerfGraphCanvas samplesRef={samplesRef} />
      </div>
      {sysData && (
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, flexShrink:0,
          fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
          color:'rgba(var(--color-primary-rgb),0.35)', letterSpacing:'0.06em' }}>
          <span>MEM {sysData.memory?.usage?.toFixed(0)}%</span>
          <span>DISK {sysData.disk?.usage?.toFixed(0)}%</span>
          {sysData.gpu?.available && <span>GPU {sysData.gpu?.usage ?? '?'}%</span>}
        </div>
      )}
    </HoloPanel>
  )
}

function NetworkStatusPanel({ netStatus, sysData }) {
  const ollama  = netStatus?.providers?.ollama
  const claw    = netStatus?.providers?.openclaw

  return (
    <HoloPanel title="Network Status"
      badge={ollama?.online ? 'CONNECTED' : 'DEGRADED'}
      badgeColor={ollama?.online ? '#22c55e' : '#FF9555'}
      style={{ flex:1, display:'flex', flexDirection:'column', marginBottom:0, height:'100%' }}>
      <Row label="Ollama"   value={ollama?.online ? `${ollama.latency_ms??'?'}ms` : 'offline'}
        color={ollama?.online ? '#22c55e' : '#ef4444'} />
      <Row label="OpenClaw" value={claw?.online ? `${claw.latency_ms??'?'}ms` : 'offline'}
        color={claw?.online ? '#22c55e' : '#ef4444'} />
      <Row label="Mode"     value="LOCAL ONLY" color="rgba(var(--color-primary-rgb),0.6)" />
      {sysData?.network && (
        <>
          <Row label="Sent" value={`${sysData.network.bytes_sent_mb} MB`} />
          <Row label="Recv" value={`${sysData.network.bytes_recv_mb} MB`} />
        </>
      )}
    </HoloPanel>
  )
}

// ─────────────────────────────────────────────────────────────
// LIVE FEED TICKER
// ─────────────────────────────────────────────────────────────
const FEED_COLORS = {
  ONLINE:'#22c55e', INFO:'#4DC8FF', ROUTE:'#A874FF',
  ACTION:'#FF9555', WARN:'#facc15', ERROR:'#ef4444',
  SYSTEM:'rgba(var(--color-primary-rgb),0.7)',
}

function LiveFeed({ events }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth
  }, [events])

  return (
    <div style={{ position:'relative', zIndex:20, flexShrink:0, height:36,
      background:'rgba(2,2,16,0.90)',
      borderTop:'1px solid rgba(var(--color-primary-rgb),0.13)',
      display:'flex', alignItems:'center', overflow:'hidden' }}>
      <div style={{ padding:'0 12px',
        borderRight:'1px solid rgba(var(--color-primary-rgb),0.13)',
        fontFamily:'Rajdhani,sans-serif', fontSize:8, fontWeight:700,
        letterSpacing:'0.22em', color:'rgba(var(--color-primary-rgb),0.45)',
        whiteSpace:'nowrap', flexShrink:0 }}>SYS FEED</div>

      <div ref={ref} style={{ flex:1, display:'flex', alignItems:'center', gap:22,
        overflowX:'auto', padding:'0 16px', scrollbarWidth:'none' }}>
        {events.slice(-40).map((ev) => (
          <motion.div key={ev.id} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
            style={{ display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap', flexShrink:0 }}>
            <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
              color: FEED_COLORS[ev.type] || '#777', letterSpacing:'0.08em' }}>
              [{ev.type}]
            </span>
            <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
              color:'rgba(180,165,220,0.55)', letterSpacing:'0.04em' }}>
              {ev.text}
            </span>
            <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:6.5,
              color:'rgba(100,90,140,0.35)' }}>·</span>
          </motion.div>
        ))}
      </div>

      <div style={{ padding:'0 12px', flexShrink:0 }}>
        <motion.div animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.4, repeat:Infinity }}
          style={{ width:5, height:5, borderRadius:'50%',
            background:'var(--color-primary)', boxShadow:'0 0 7px var(--color-primary)' }}/>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// UPTIME COUNTER
// ─────────────────────────────────────────────────────────────
function UptimeClock({ startRef }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    startRef.current = startRef.current || Date.now()
    const id = setInterval(() => {
      setSecs(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startRef])
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const pad = n => String(n).padStart(2, '0')
  return (
    <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:10,
      color:'rgba(var(--color-primary-rgb),0.55)', letterSpacing:'0.10em' }}>
      UP {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
let _feedId = 0
function mkEvent(type, text) { return { id: ++_feedId, type, text, ts: Date.now() } }

export default function SystemsPage() {
  const [sysData,    setSysData]    = useState(null)
  const [aiStatus,   setAiStatus]   = useState(null)
  const [clawStatus, setClawStatus] = useState(null)
  const [netStatus,  setNetStatus]  = useState(null)
  const [feed,       setFeed]       = useState([])

  const prevRef    = useRef({})
  const startRef   = useRef(null)
  const samplesRef = useRef([])

  const addEvent = useCallback((type, text) => {
    setFeed(f => [...f.slice(-60), mkEvent(type, text)])
  }, [])

  const fetchSys = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/system`)
      if (!r.ok) return
      const data = await r.json()
      setSysData(data)
      if (data?.cpu?.usage != null) {
        samplesRef.current = [...samplesRef.current.slice(-79), data.cpu.usage]
      }
    } catch { /* silent */ }
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const [ai, claw, net] = await Promise.all([
        fetch(`${API_URL}/api/status`).then(r => r.json()),
        fetch(`${API_URL}/api/openclaw/status`).then(r => r.json()),
        fetch(`${API_URL}/api/network/status`).then(r => r.json()),
      ])
      const prev = prevRef.current
      if (prev.ollama_online !== undefined && prev.ollama_online !== net?.providers?.ollama?.online)
        addEvent(net.providers.ollama.online ? 'ONLINE' : 'WARN',
          `Ollama ${net.providers.ollama.online ? 'connected' : 'disconnected'}`)
      if (prev.claw_online !== undefined && prev.claw_online !== claw?.online)
        addEvent(claw.online ? 'ONLINE' : 'WARN',
          `OpenClaw gateway ${claw.online ? 'online' : 'offline'}`)
      if (prev.provider !== undefined && prev.provider !== ai?.provider)
        addEvent('ROUTE', `Provider switched to ${ai.provider}`)
      prevRef.current = {
        ollama_online: net?.providers?.ollama?.online,
        claw_online: claw?.online,
        provider: ai?.provider,
      }
      setAiStatus(ai)
      setClawStatus(claw)
      setNetStatus(net)
    } catch { /* silent */ }
  }, [addEvent])

  useEffect(() => {
    const boot = [
      mkEvent('SYSTEM', 'Nyx OS kernel initialized'),
      mkEvent('INFO',   'Loading AI subsystems…'),
      mkEvent('INFO',   'Constellation memory engine online'),
      mkEvent('INFO',   'OpenClaw gateway handshake'),
      mkEvent('ROUTE',  'Routing engine: local-first mode active'),
      mkEvent('SYSTEM', 'All systems operational'),
    ]
    setFeed(boot)
    fetchSys()
    fetchAll()
    // laptop-lite: slower polling reduces psutil/GPU CPU overhead
    const sysT = setInterval(fetchSys,  8000)
    const allT = setInterval(fetchAll, 20000)
    const hbT  = setInterval(() => {
      const hb = [
        () => addEvent('INFO',   'System tick · uptime nominal'),
        () => addEvent('ROUTE',  `Model: ${prevRef.current.provider || 'ollama'} · local-first`),
        () => addEvent('SYSTEM', 'Constellation sync verified'),
        () => addEvent('INFO',   'OpenClaw heartbeat OK'),
      ]
      hb[Math.floor(Math.random() * hb.length)]()
    }, 8000)
    return () => { clearInterval(sysT); clearInterval(allT); clearInterval(hbT) }
  }, [fetchSys, fetchAll, addEvent])

  const cpuAct = sysData?.cpu?.usage != null ? sysData.cpu.usage / 100 : 0.3

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden',
      background:'#02030A', display:'flex', flexDirection:'column' }}>

      <BackgroundFX />

      {/* ── HEADER ─────────────────────────────────────── */}
      <div style={{ position:'relative', zIndex:10, flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 16px', height:34,
        borderBottom:'1px solid rgba(var(--color-primary-rgb),0.11)',
        background:'rgba(2,2,16,0.78)' }}>

        {/* Left: title + status */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:2, repeat:Infinity }}
            style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-primary)',
              boxShadow:'0 0 9px var(--color-primary)' }}/>
          <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:10, fontWeight:700,
            letterSpacing:'0.28em', textTransform:'uppercase',
            color:'var(--color-text-muted)' }}>NYX OPERATIONAL ENVIRONMENT</span>
          <div style={{ padding:'2px 8px', background:'rgba(34,197,94,0.10)',
            border:'1px solid rgba(34,197,94,0.28)', borderRadius:4 }}>
            <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
              color:'#22c55e', letterSpacing:'0.16em' }}>OPERATIONAL</span>
          </div>
        </div>

        {/* Center: clock + uptime */}
        <div style={{ display:'flex', alignItems:'center', gap:18 }}>
          <LiveClock />
          <UptimeClock startRef={startRef} />
        </div>

        {/* Right: quick stats + theme */}
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {[
            { lbl:'CPU', val: sysData?.cpu?.usage != null ? `${sysData.cpu.usage.toFixed(1)}%` : '—' },
            { lbl:'RAM', val: sysData?.memory?.usage != null ? `${sysData.memory.usage.toFixed(1)}%` : '—' },
            { lbl:'GPU', val: sysData?.gpu?.available ? `${sysData.gpu.usage??'?'}%` : 'N/A' },
          ].map(({ lbl, val }) => (
            <span key={lbl} style={{ fontFamily:'Share Tech Mono,monospace', fontSize:9,
              color:'rgba(var(--color-primary-rgb),0.5)', letterSpacing:'0.10em' }}>
              {lbl}:{' '}
              <span style={{ color:'var(--color-text-primary)' }}>{val}</span>
            </span>
          ))}
          <div style={{ width:1, height:16, background:'rgba(var(--color-primary-rgb),0.15)' }}/>
          <ThemePicker />
        </div>
      </div>

      {/* ── MAIN 3-COLUMN ──────────────────────────────── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden',
        position:'relative', zIndex:5, minHeight:0 }}>

        {/* LEFT COL */}
        <div style={{ width:226, flexShrink:0, overflowY:'auto', overflowX:'hidden',
          padding:'10px 9px 10px 11px',
          scrollbarWidth:'thin', scrollbarColor:'rgba(var(--color-primary-rgb),0.18) transparent' }}>
          <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:7.5, fontWeight:700,
            letterSpacing:'0.28em', color:'rgba(var(--color-primary-rgb),0.32)',
            textTransform:'uppercase', marginBottom:7, paddingLeft:2 }}>— AI SYSTEMS —</div>
          <AICorePanel    aiStatus={aiStatus} />
          <MemoryVaultPanel netStatus={netStatus} />
          <VoiceEnginePanel aiStatus={aiStatus} />
          <OpenClawPanel  clawStatus={clawStatus} />
        </div>

        {/* CENTER */}
        <div style={{ flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'flex-start',
          overflow:'hidden', padding:'6px 0 0' }}>

          {/* Core label */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:0, flexShrink:0 }}>
            <div style={{ width:36, height:1,
              background:'linear-gradient(90deg,transparent,rgba(var(--color-primary-rgb),0.4))' }}/>
            <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:8.5, fontWeight:700,
              letterSpacing:'0.30em', color:'rgba(var(--color-primary-rgb),0.42)',
              textTransform:'uppercase' }}>NYX CORE</span>
            <div style={{ width:36, height:1,
              background:'linear-gradient(90deg,rgba(var(--color-primary-rgb),0.4),transparent)' }}/>
          </div>

          {/* NyxCore canvas */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <NyxCoreCanvas activity={cpuAct} />
            <div style={{ position:'absolute', bottom:22, left:'50%',
              transform:'translateX(-50%)',
              fontFamily:'Share Tech Mono,monospace', fontSize:7.5,
              color:'rgba(var(--color-primary-rgb),0.38)',
              letterSpacing:'0.18em', whiteSpace:'nowrap' }}>
              {netStatus?.providers?.ollama?.online ? '● ROUTING ACTIVE' : '○ STANDBY'}
            </div>
          </div>

          {/* Routing engine */}
          <div style={{ width:'100%', padding:'0 20px', flexShrink:0 }}>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:7.5, fontWeight:700,
              letterSpacing:'0.28em', color:'rgba(var(--color-primary-rgb),0.28)',
              textTransform:'uppercase', marginBottom:3, textAlign:'center' }}>ROUTING ENGINE</div>
            <div style={{ background:'rgba(4,3,20,0.68)',
              border:'1px solid rgba(var(--color-primary-rgb),0.12)',
              borderRadius:8, padding:'6px 10px' }}>
              <RoutingEngine netStatus={netStatus} aiStatus={aiStatus} />
            </div>
          </div>
        </div>

        {/* RIGHT COL */}
        <div style={{ width:248, flexShrink:0, overflowY:'auto', overflowX:'hidden',
          padding:'10px 11px 10px 9px',
          scrollbarWidth:'thin', scrollbarColor:'rgba(var(--color-primary-rgb),0.18) transparent' }}>
          <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:7.5, fontWeight:700,
            letterSpacing:'0.28em', color:'rgba(var(--color-primary-rgb),0.32)',
            textTransform:'uppercase', marginBottom:7, paddingLeft:2 }}>— DIAGNOSTICS —</div>
          <HardwareGaugesPanel sysData={sysData} />
          <ProviderNetworkPanel netStatus={netStatus} />
          <PermissionsPanel clawStatus={clawStatus} />
          <GlobalViewPanel />
        </div>
      </div>

      {/* ── BOTTOM ROW ─────────────────────────────────── */}
      <div style={{ flexShrink:0, zIndex:10, position:'relative',
        display:'flex', gap:8, padding:'6px 11px',
        height:178,
        borderTop:'1px solid rgba(var(--color-primary-rgb),0.09)',
        background:'rgba(2,2,14,0.60)' }}>
        <ActiveTasksPanel />
        <PerfGraphPanel  sysData={sysData} samplesRef={samplesRef} />
        <NetworkStatusPanel netStatus={netStatus} sysData={sysData} />
      </div>

      {/* ── LIVE FEED ───────────────────────────────────── */}
      <LiveFeed events={feed} />
    </div>
  )
}
