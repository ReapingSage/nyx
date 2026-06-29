import { useRef, useEffect } from 'react'
import { useTheme } from '../utils/themeContext.jsx'
import { getPrimaryRGB, getBgRGB, isLightTheme } from '../utils/themes.js'

const MATRIX_CHARS = '01◈⟁⊕⊗⊘◎⬡⌗⌘≡⊞◆◐♪⟲⊡⊛⟁01100101'

function makeRng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF }
}

function buildData(W, H) {
  const sr = makeRng(0xDEAD)
  const clamp01 = v => Math.max(0, Math.min(1, v))
  const gauss = (cx, cy, sp) => ({
    x: clamp01(cx + (sr() + sr() + sr() - 1.5) * sp),
    y: clamp01(cy + (sr() + sr() + sr() - 1.5) * sp),
  })

  // Deep Space
  const dimStars = Array.from({ length: 300 }, () => {
    const pos = sr() < 0.55 ? gauss(0.58, 0.42, 0.28) : { x: sr(), y: sr() }
    return { ...pos, radius: 0.15 + sr() * 0.5, opacity: 0.05 + sr() * 0.18, color: sr() > 0.7 ? '180,165,255' : sr() > 0.4 ? '100,130,255' : '220,215,255', tw: 0.15 + sr() * 1.0, off: sr() * 6.28 }
  })
  const medStars = Array.from({ length: 90 }, () => {
    const pos = sr() < 0.7 ? gauss(0.58, 0.42, 0.22) : { x: sr(), y: sr() }
    return { ...pos, radius: 0.55 + sr() * 1.0, opacity: 0.20 + sr() * 0.35, color: sr() > 0.55 ? '160,110,255' : sr() > 0.3 ? '240,228,255' : '90,130,255', tw: 0.7 + sr() * 2.5, off: sr() * 6.28 }
  })
  const brightStars = Array.from({ length: 18 }, () => ({
    ...gauss(0.58, 0.38, 0.26), radius: 1.0 + sr() * 1.8, opacity: 0.50 + sr() * 0.45, tw: 0.5 + sr() * 1.5, off: sr() * 6.28,
  }))
  const dustClouds = Array.from({ length: 8 }, () => ({
    x: 0.1 + sr() * 0.8, y: 0.05 + sr() * 0.75,
    rx: 0.06 + sr() * 0.14, ry: 0.04 + sr() * 0.08,
    opacity: 0.02 + sr() * 0.04, color: sr() > 0.5 ? '160,100,255' : '80,100,220',
    pulse: 0.3 + sr() * 0.6, off: sr() * 6.28,
  }))
  const makeProfile = (seedOff, yMin, yMax, count) => {
    const lr = makeRng(seedOff)
    return Array.from({ length: count }, (_, i) => ({ x: i / (count - 1), y: yMin + lr() * (yMax - yMin) }))
  }
  const farPeaks  = makeProfile(111, 0.69, 0.78, 22)
  const midPeaks  = makeProfile(222, 0.76, 0.86, 24)
  const nearPeaks = makeProfile(333, 0.83, 0.93, 28)

  // Tactical Grid
  const sp = 56
  const gridDots = []
  for (let x = 0; x < W + sp; x += sp)
    for (let y = 0; y < H + sp; y += sp)
      gridDots.push({ x, y, pulse: sr() * 6.28 })

  // Neural Network
  const netNodes = Array.from({ length: 65 }, () => ({
    x: sr() * W, y: sr() * H,
    vx: (sr() - 0.5) * 0.22, vy: (sr() - 0.5) * 0.22,
    r: 1.2 + sr() * 2.0, pulse: sr() * 6.28,
  }))

  // Matrix Rain
  const matrixCols = Array.from({ length: Math.max(1, Math.floor(W / 18)) }, () => ({
    y: sr() * (H / 16) * -1 - 5,
    speed: 0.4 + sr() * 1.0,
    trailLen: 14 + Math.floor(sr() * 14),
    charOff: Math.floor(sr() * MATRIX_CHARS.length),
  }))

  // Cyberpunk City
  const br = makeRng(0xC177)
  const buildings = Array.from({ length: 28 }, (_, i) => {
    const bw = 24 + br() * 48
    const bh = 60 + br() * 220
    const bx = (i / 27) * W - bw * 0.3 + (br() - 0.5) * 30
    return { x: bx, w: bw, h: bh, windows: Array.from({ length: Math.floor(br() * 12 + 4) }, () => ({ wx: br(), wy: br(), lit: br() > 0.35 })) }
  })

  // Pulse Radar — target blips scattered at various distances/angles
  const radarBlips = Array.from({ length: 11 }, () => ({
    r: 0.08 + sr() * 0.42,
    angle: sr() * 6.28,
    brightness: 0.45 + sr() * 0.55,
    size: 0.8 + sr() * 1.6,
  }))

  // Holographic Fog — interference grid nodes
  const holoNodes = Array.from({ length: 6 }, () => ({
    x: sr(), y: sr(),
    vx: (sr() - 0.5) * 0.0003, vy: (sr() - 0.5) * 0.0002,
    phase: sr() * 6.28,
  }))

  return { dimStars, medStars, brightStars, dustClouds, farPeaks, midPeaks, nearPeaks, gridDots, netNodes, matrixCols, buildings, radarBlips, holoNodes }
}

// ── Renderers ─────────────────────────────────────────────────

function drawDeepSpace(ctx, W, H, t, data, pRGB) {
  const { dimStars, medStars, brightStars, dustClouds, farPeaks, midPeaks, nearPeaks } = data

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#02030A'); bg.addColorStop(0.28, '#040510')
  bg.addColorStop(0.58, '#070B1A'); bg.addColorStop(0.82, '#0B1026'); bg.addColorStop(1, '#0E1230')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  const vig = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.08, W * 0.5, H * 0.42, W * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(0.7, 'rgba(2,3,10,0.18)'); vig.addColorStop(1, 'rgba(2,3,10,0.75)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
  const tl = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.4)
  tl.addColorStop(0, 'rgba(10,8,30,0.40)'); tl.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = tl; ctx.fillRect(0, 0, W, H)

  dustClouds.forEach(d => {
    const op = d.opacity * (0.6 + 0.4 * Math.sin(t * d.pulse + d.off))
    const g = ctx.createRadialGradient(d.x * W, d.y * H, 0, d.x * W, d.y * H, d.rx * W)
    g.addColorStop(0, `rgba(${pRGB},${op * 1.5})`); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.rx * W, 0, 6.28); ctx.fill()
  })
  dimStars.forEach(s => {
    ctx.fillStyle = `rgba(${s.color},${s.opacity * (0.5 + 0.5 * Math.sin(t * s.tw + s.off))})`
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.radius, 0, 6.28); ctx.fill()
  })
  medStars.forEach(s => {
    ctx.fillStyle = `rgba(${s.color},${s.opacity * (0.42 + 0.58 * Math.abs(Math.sin(t * s.tw + s.off)))})`
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.radius, 0, 6.28); ctx.fill()
  })
  brightStars.forEach(s => {
    const op = s.opacity * (0.6 + 0.4 * Math.sin(t * s.tw + s.off))
    const px = s.x * W, py = s.y * H
    ctx.shadowColor = 'rgba(230,215,255,0.9)'; ctx.shadowBlur = 12
    ctx.fillStyle = `rgba(247,242,255,${op})`
    ctx.beginPath(); ctx.arc(px, py, s.radius, 0, 6.28); ctx.fill()
    ctx.shadowBlur = 0
    if (s.opacity > 0.80) {
      const len = s.radius * 3.5
      ctx.strokeStyle = `rgba(247,242,255,${op * 0.35})`; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(px - len, py); ctx.lineTo(px + len, py); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px, py - len); ctx.lineTo(px, py + len); ctx.stroke()
    }
  })

  const ox = W * 0.566, oy = H * 0.43
  const fc = (g, cx, cy, r) => { ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.fill() }
  const b1 = ctx.createRadialGradient(ox, oy, 0, ox, oy, W * 0.34)
  b1.addColorStop(0, `rgba(${pRGB},${0.12 + 0.02 * Math.sin(t * 0.6)})`); b1.addColorStop(0.5, `rgba(${pRGB},${0.04 + 0.01 * Math.sin(t * 0.45)})`); b1.addColorStop(1, 'rgba(0,0,0,0)')
  fc(b1, ox, oy, W * 0.34)
  const b2 = ctx.createRadialGradient(ox, oy, 0, ox, oy, W * 0.13)
  b2.addColorStop(0, `rgba(${pRGB},${0.15 + 0.03 * Math.sin(t * 1.2)})`); b2.addColorStop(1, 'rgba(0,0,0,0)')
  fc(b2, ox, oy, W * 0.13)
  const b3 = ctx.createRadialGradient(ox + W * 0.04, oy - H * 0.06, 0, ox + W * 0.04, oy - H * 0.06, W * 0.16)
  b3.addColorStop(0, `rgba(${pRGB},${0.05 + 0.01 * Math.sin(t * 0.8)})`); b3.addColorStop(1, 'rgba(0,0,0,0)')
  fc(b3, ox + W * 0.04, oy - H * 0.06, W * 0.16)

  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = 'rgba(12,10,35,0.90)'
  ctx.beginPath(); ctx.moveTo(0, H); farPeaks.forEach(p => ctx.lineTo(p.x * W, p.y * H)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); ctx.restore()
  ctx.fillStyle = 'rgba(7,6,22,0.92)'
  ctx.beginPath(); ctx.moveTo(0, H); midPeaks.forEach(p => ctx.lineTo(p.x * W, p.y * H)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#02030A'
  ctx.beginPath(); ctx.moveTo(0, H); nearPeaks.forEach(p => ctx.lineTo(p.x * W, p.y * H)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill()
}

function drawTacticalGrid(ctx, W, H, t, data, pRGB) {
  const { gridDots } = data
  const sp = 56

  ctx.fillStyle = '#010409'; ctx.fillRect(0, 0, W, H)

  // Minor grid lines
  ctx.strokeStyle = `rgba(${pRGB}, 0.12)`; ctx.lineWidth = 0.5
  for (let x = 0; x < W + sp; x += sp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H + sp; y += sp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Major grid lines every 3 cells — clearly brighter
  ctx.strokeStyle = `rgba(${pRGB}, 0.32)`; ctx.lineWidth = 0.8
  for (let x = 0; x < W + sp * 3; x += sp * 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H + sp * 3; y += sp * 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Intersection dots — all visible, brighter on major intersections
  gridDots.forEach(d => {
    const isMajor = (d.x % (sp * 3) < 2) && (d.y % (sp * 3) < 2)
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.9 + d.pulse)
    const op = isMajor ? 0.55 + 0.25 * pulse : 0.22 + 0.18 * pulse
    const r  = isMajor ? 2.5 : 1.5
    if (isMajor) { ctx.shadowColor = `rgba(${pRGB}, 0.9)`; ctx.shadowBlur = 8 }
    ctx.fillStyle = `rgba(${pRGB}, ${op})`
    ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.28); ctx.fill()
    if (isMajor) ctx.shadowBlur = 0
  })

  // Cross-hair tick marks on major intersections
  ctx.strokeStyle = `rgba(${pRGB}, 0.22)`; ctx.lineWidth = 0.6
  gridDots.forEach(d => {
    if (d.x % (sp * 3) < 2 && d.y % (sp * 3) < 2) {
      const len = 6
      ctx.beginPath(); ctx.moveTo(d.x - len, d.y); ctx.lineTo(d.x + len, d.y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(d.x, d.y - len); ctx.lineTo(d.x, d.y + len); ctx.stroke()
    }
  })

  // Moving scan line — bright and visible
  const scanY = (t * 60) % H
  const sg = ctx.createLinearGradient(0, scanY - 5, 0, scanY + 5)
  sg.addColorStop(0, `rgba(${pRGB}, 0)`); sg.addColorStop(0.5, `rgba(${pRGB}, 0.45)`); sg.addColorStop(1, `rgba(${pRGB}, 0)`)
  ctx.fillStyle = sg; ctx.fillRect(0, scanY - 5, W, 10)

  // Second slower scan line
  const scan2 = (t * 22 + H * 0.6) % H
  const sg2 = ctx.createLinearGradient(0, scan2 - 2, 0, scan2 + 2)
  sg2.addColorStop(0, `rgba(${pRGB}, 0)`); sg2.addColorStop(0.5, `rgba(${pRGB}, 0.18)`); sg2.addColorStop(1, `rgba(${pRGB}, 0)`)
  ctx.fillStyle = sg2; ctx.fillRect(0, scan2 - 2, W, 4)

  // Center cross-hair
  const cx = W * 0.56, cy = H * 0.43
  ctx.strokeStyle = `rgba(${pRGB}, 0.18)`; ctx.lineWidth = 0.6
  ctx.setLineDash([4, 10])
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()
  ctx.setLineDash([])
  // Targeting reticle around center
  ctx.strokeStyle = `rgba(${pRGB}, 0.28)`; ctx.lineWidth = 0.8
  const rs = 28
  ctx.beginPath(); ctx.moveTo(cx - rs, cy - rs + 8); ctx.lineTo(cx - rs, cy - rs); ctx.lineTo(cx - rs + 8, cy - rs); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + rs - 8, cy - rs); ctx.lineTo(cx + rs, cy - rs); ctx.lineTo(cx + rs, cy - rs + 8); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx - rs, cy + rs - 8); ctx.lineTo(cx - rs, cy + rs); ctx.lineTo(cx - rs + 8, cy + rs); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + rs - 8, cy + rs); ctx.lineTo(cx + rs, cy + rs); ctx.lineTo(cx + rs, cy + rs - 8); ctx.stroke()

  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, W * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.70)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
}

function drawNeuralNetwork(ctx, W, H, t, data, pRGB) {
  const { netNodes } = data
  ctx.fillStyle = '#010308'; ctx.fillRect(0, 0, W, H)
  netNodes.forEach(n => {
    n.x += n.vx; n.y += n.vy
    if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx) } if (n.x > W) { n.x = W; n.vx = -Math.abs(n.vx) }
    if (n.y < 0) { n.y = 0; n.vy = Math.abs(n.vy) } if (n.y > H) { n.y = H; n.vy = -Math.abs(n.vy) }
  })
  for (let i = 0; i < netNodes.length; i++) {
    for (let j = i + 1; j < netNodes.length; j++) {
      const dx = netNodes[i].x - netNodes[j].x, dy = netNodes[i].y - netNodes[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 130) { ctx.strokeStyle = `rgba(${pRGB}, ${0.10 * (1 - dist / 130)})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(netNodes[i].x, netNodes[i].y); ctx.lineTo(netNodes[j].x, netNodes[j].y); ctx.stroke() }
    }
  }
  netNodes.forEach(n => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.2 + n.pulse)
    ctx.shadowColor = `rgba(${pRGB}, 0.8)`; ctx.shadowBlur = 5 + pulse * 5
    ctx.fillStyle = `rgba(${pRGB}, ${0.45 + 0.35 * pulse})`
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.28); ctx.fill()
    ctx.shadowBlur = 0
  })
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.70)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.70)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
}

function drawMatrixRain(ctx, W, H, t, data, pRGB) {
  const { matrixCols } = data
  const colW = 18, charH = 16
  const [r, g, b] = pRGB.split(',').map(Number)
  ctx.fillStyle = `rgb(${Math.round(r * 0.04)}, ${Math.round(g * 0.04)}, ${Math.round(b * 0.04)})`
  ctx.fillRect(0, 0, W, H)
  ctx.font = `${charH - 2}px 'Share Tech Mono', monospace`
  matrixCols.forEach((col, colIdx) => {
    col.y += col.speed
    if (col.y > H / charH + col.trailLen + 5) { col.y = -col.trailLen - Math.random() * 20; col.speed = 0.4 + Math.random() * 1.0 }
    const x = colIdx * colW + 2
    for (let row = 0; row <= col.trailLen; row++) {
      const charY = (col.y - row) * charH
      if (charY < -charH || charY > H + charH) continue
      const opacity = row === 0 ? 0.95 : Math.pow(1 - row / col.trailLen, 1.8) * 0.75
      if (opacity < 0.02) continue
      ctx.fillStyle = row === 0 ? `rgba(210, 255, 220, ${opacity})` : `rgba(${pRGB}, ${opacity})`
      ctx.fillText(MATRIX_CHARS[(col.charOff + row + Math.floor(t * col.speed * 2)) % MATRIX_CHARS.length], x, charY)
    }
  })
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.05, W / 2, H / 2, W * 0.7)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
}

function drawCyberpunkCity(ctx, W, H, t, data, pRGB) {
  const { buildings } = data
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#000000'); sky.addColorStop(0.55, '#020208'); sky.addColorStop(0.80, '#04020C'); sky.addColorStop(1, '#060210')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)
  const horizon = H * 0.72
  const hg = ctx.createRadialGradient(W * 0.5, horizon, 0, W * 0.5, horizon, W * 0.60)
  hg.addColorStop(0, `rgba(${pRGB}, ${0.14 + 0.03 * Math.sin(t * 0.3)})`); hg.addColorStop(0.5, `rgba(${pRGB}, ${0.05 + 0.01 * Math.sin(t * 0.25)})`); hg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H)
  const groundY = H * 0.75
  buildings.forEach(b => {
    const top = groundY - b.h
    ctx.fillStyle = 'rgba(4,3,12,0.96)'; ctx.fillRect(b.x, top, b.w, b.h)
    ctx.strokeStyle = `rgba(${pRGB}, 0.08)`; ctx.lineWidth = 0.5; ctx.strokeRect(b.x, top, b.w, b.h)
    b.windows.forEach(w => {
      if (!w.lit) return
      const flicker = Math.sin(t * 0.4 + w.wx * 10) > 0.92 ? 0.2 : 1
      ctx.fillStyle = `rgba(${pRGB}, ${(0.35 + w.wx * 0.35) * flicker})`
      ctx.fillRect(b.x + w.wx * (b.w - 6) + 2, top + w.wy * (b.h - 10) + 5, 3, 5)
    })
    if (b.h > 180) {
      const rg = ctx.createRadialGradient(b.x + b.w / 2, top, 0, b.x + b.w / 2, top, 30)
      rg.addColorStop(0, `rgba(${pRGB}, ${0.20 + 0.05 * Math.sin(t + b.x)})`); rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(b.x + b.w / 2, top, 30, 0, 6.28); ctx.fill()
    }
  })
  const gnd = ctx.createLinearGradient(0, groundY, 0, H)
  gnd.addColorStop(0, `rgba(${pRGB}, 0.08)`); gnd.addColorStop(1, 'rgba(0,0,0,0.8)')
  ctx.fillStyle = gnd; ctx.fillRect(0, groundY, W, H - groundY)
  const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.08, W / 2, H * 0.5, W * 0.70)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.78)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
}

function drawMinimalBlack(ctx, W, H, t, data, pRGB) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#000000'); bg.addColorStop(1, '#020308')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, W * 0.35)
  g.addColorStop(0, `rgba(${pRGB}, ${0.04 + 0.01 * Math.sin(t * 0.4)})`); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.78)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
}

// ── Pulse Radar ───────────────────────────────────────────────
// Sonar-style expanding rings + rotating sweep + target blips
function drawPulseRadar(ctx, W, H, t, data, pRGB) {
  const { radarBlips } = data
  const cx = W * 0.52, cy = H * 0.43
  const maxR = Math.min(W, H) * 0.46

  ctx.fillStyle = '#010310'; ctx.fillRect(0, 0, W, H)

  // Sub-rings (faint intermediate markers between main rings)
  for (let ring = 1; ring <= 8; ring++) {
    if (ring % 2 === 0) continue // skip — these are the main rings
    const r = maxR * (ring / 8)
    ctx.strokeStyle = `rgba(${pRGB}, 0.09)`; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.stroke()
  }

  // Main radar distance rings — glow pass then crisp pass
  for (let ring = 1; ring <= 4; ring++) {
    const r = maxR * (ring / 4)
    const outerFade = 0.55 + (ring / 4) * 0.25 // outer rings slightly brighter

    // Glow halo pass
    ctx.shadowColor = `rgba(${pRGB}, 0.6)`
    ctx.shadowBlur  = ring === 1 ? 10 : 7
    ctx.strokeStyle = `rgba(${pRGB}, ${outerFade * 0.22})`
    ctx.lineWidth   = 3.5
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.stroke()
    ctx.shadowBlur  = 0

    // Crisp inner line
    ctx.strokeStyle = `rgba(${pRGB}, ${outerFade * 0.65})`
    ctx.lineWidth   = 1.0
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.stroke()

    // Tick marks — long on cardinal directions, short elsewhere
    for (let tick = 0; tick < 36; tick++) {
      const angle    = (tick / 36) * 6.28
      const isCardinal = tick % 9 === 0
      const isMajor    = tick % 3 === 0
      const len  = isCardinal ? 8 : isMajor ? 5 : 3
      const opa  = isCardinal ? 0.70 : isMajor ? 0.45 : 0.22
      const x1 = cx + Math.cos(angle) * (r - len / 2)
      const y1 = cy + Math.sin(angle) * (r - len / 2)
      const x2 = cx + Math.cos(angle) * (r + len / 2)
      const y2 = cy + Math.sin(angle) * (r + len / 2)
      ctx.strokeStyle = `rgba(${pRGB}, ${opa})`; ctx.lineWidth = isCardinal ? 1.2 : 0.7
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }

    // Range label on right side of each ring
    ctx.fillStyle = `rgba(${pRGB}, 0.40)`
    ctx.font = '9px "Share Tech Mono", monospace'
    ctx.fillText(`${ring * 25}km`, cx + r + 4, cy - 4)
  }

  // Axis lines — bright enough to read
  ctx.shadowColor = `rgba(${pRGB}, 0.4)`; ctx.shadowBlur = 6
  ctx.strokeStyle = `rgba(${pRGB}, 0.28)`; ctx.lineWidth = 0.8
  ctx.setLineDash([4, 8])
  ctx.beginPath(); ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR); ctx.stroke()
  ctx.setLineDash([])
  ctx.shadowBlur = 0

  // Rotating sweep wedge
  const sweepAngle = (t * 0.7) % 6.28
  const wedgeArc  = Math.PI * 0.22
  ctx.save()
  ctx.translate(cx, cy)
  const sweep = ctx.createConicalGradient ? null : null // no conical in 2d ctx
  // Draw wedge as a filled arc
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, maxR, sweepAngle - wedgeArc, sweepAngle, false)
  ctx.closePath()
  const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR)
  sweepGrad.addColorStop(0, `rgba(${pRGB}, 0.32)`)
  sweepGrad.addColorStop(0.55, `rgba(${pRGB}, 0.14)`)
  sweepGrad.addColorStop(1, `rgba(${pRGB}, 0.0)`)
  ctx.fillStyle = sweepGrad; ctx.fill()
  // Bright leading edge with glow
  ctx.shadowColor = `rgba(${pRGB}, 1.0)`; ctx.shadowBlur = 8
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sweepAngle) * maxR, Math.sin(sweepAngle) * maxR)
  ctx.strokeStyle = `rgba(${pRGB}, 0.90)`; ctx.lineWidth = 2.0; ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()

  // Blips — glow when sweep passes over them, fade out afterward
  radarBlips.forEach(blip => {
    const bx = cx + Math.cos(blip.angle) * blip.r * maxR
    const by = cy + Math.sin(blip.angle) * blip.r * maxR

    // Angular distance from sweep
    let angDiff = ((blip.angle - sweepAngle) % 6.28 + 6.28) % 6.28
    if (angDiff > Math.PI) angDiff = 6.28 - angDiff
    // blip is bright just after the sweep passes (angDiff near 0 from behind)
    const timeSinceSweep = ((sweepAngle - blip.angle) % 6.28 + 6.28) % 6.28
    const decay = timeSinceSweep < 2.5 ? Math.pow(1 - timeSinceSweep / 2.5, 1.4) : 0
    const brightness = decay * blip.brightness

    if (brightness < 0.04) return
    ctx.shadowColor = `rgba(${pRGB}, 0.9)`; ctx.shadowBlur = 10 * brightness
    ctx.fillStyle = `rgba(${pRGB}, ${brightness * 0.9})`
    ctx.beginPath(); ctx.arc(bx, by, blip.size + 1.5 * brightness, 0, 6.28); ctx.fill()
    ctx.shadowBlur = 0

    // Small cross on bright blips
    if (brightness > 0.4) {
      ctx.strokeStyle = `rgba(${pRGB}, ${brightness * 0.6})`; ctx.lineWidth = 0.7
      const cs = 4
      ctx.beginPath(); ctx.moveTo(bx - cs, by); ctx.lineTo(bx + cs, by); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(bx, by - cs); ctx.lineTo(bx, by + cs); ctx.stroke()
    }
  })

  // Center glow
  ctx.shadowColor = `rgba(${pRGB}, 1.0)`; ctx.shadowBlur = 18
  ctx.fillStyle = `rgba(${pRGB}, 0.9)`
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 6.28); ctx.fill()
  ctx.shadowBlur = 0

  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.12, W / 2, H / 2, W * 0.70)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
}

// ── Holographic Fog — light-plane interference effect ─────────
function drawHolographicFog(ctx, W, H, t, data, pRGB) {
  const { holoNodes } = data

  ctx.fillStyle = '#010212'; ctx.fillRect(0, 0, W, H)

  // Drift nodes
  holoNodes.forEach(n => {
    n.x += n.vx; n.y += n.vy
    if (n.x < -0.1 || n.x > 1.1) n.vx *= -1
    if (n.y < -0.1 || n.y > 1.1) n.vy *= -1
  })

  // Light-plane layers — horizontal and diagonal bands of light
  const planeCount = 5
  for (let i = 0; i < planeCount; i++) {
    const baseY = H * (i / planeCount) + H * 0.05
    const drift  = Math.sin(t * 0.18 + i * 1.3) * H * 0.08
    const planeY = baseY + drift
    const width  = 18 + 14 * Math.abs(Math.sin(t * 0.22 + i * 0.9))
    const op     = 0.10 + 0.08 * Math.abs(Math.sin(t * 0.25 + i * 1.1))

    const lg = ctx.createLinearGradient(0, planeY - width, 0, planeY + width)
    lg.addColorStop(0,   `rgba(${pRGB}, 0)`)
    lg.addColorStop(0.3, `rgba(${pRGB}, ${op * 0.5})`)
    lg.addColorStop(0.5, `rgba(${pRGB}, ${op})`)
    lg.addColorStop(0.7, `rgba(${pRGB}, ${op * 0.5})`)
    lg.addColorStop(1,   `rgba(${pRGB}, 0)`)
    ctx.fillStyle = lg; ctx.fillRect(0, planeY - width, W, width * 2)
  }

  // Diagonal interference bands at 30°
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(0.52)
  for (let i = -4; i <= 4; i++) {
    const yOff  = i * 90 + Math.sin(t * 0.14 + i) * 20
    const op    = 0.06 + 0.04 * Math.abs(Math.sin(t * 0.2 + i * 0.7))
    const dg = ctx.createLinearGradient(0, yOff - 12, 0, yOff + 12)
    dg.addColorStop(0, `rgba(${pRGB}, 0)`); dg.addColorStop(0.5, `rgba(${pRGB}, ${op})`); dg.addColorStop(1, `rgba(${pRGB}, 0)`)
    ctx.fillStyle = dg; ctx.fillRect(-W, yOff - 12, W * 2, 24)
  }
  ctx.restore()

  // Holographic interference rings emanating from nodes
  holoNodes.forEach((n, ni) => {
    for (let ring = 0; ring < 3; ring++) {
      const phase = t * 0.55 + ni * 1.1 + ring * 2.1
      const r = (((phase % 6.28) / 6.28) * Math.min(W, H) * 0.55)
      const op = Math.max(0, 0.18 * (1 - r / (Math.min(W, H) * 0.55)))
      if (op < 0.01) continue
      ctx.strokeStyle = `rgba(${pRGB}, ${op})`; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(n.x * W, n.y * H, r, 0, 6.28); ctx.stroke()
    }
  })

  // Holographic grid overlay — thin, regular, angled
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = `rgba(${pRGB}, 1)`; ctx.lineWidth = 0.4
  const gsp = 44
  for (let x = -H; x < W + H; x += gsp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H * 0.6, H); ctx.stroke() }
  for (let y = -W; y < H + W; y += gsp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + W * 0.3); ctx.stroke() }
  ctx.restore()

  // Bright node points
  holoNodes.forEach(n => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + n.phase)
    ctx.shadowColor = `rgba(${pRGB}, 0.9)`; ctx.shadowBlur = 12 * pulse
    ctx.fillStyle = `rgba(${pRGB}, ${0.55 + 0.35 * pulse})`
    ctx.beginPath(); ctx.arc(n.x * W, n.y * H, 2.5, 0, 6.28); ctx.fill()
    ctx.shadowBlur = 0
  })

  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, W * 0.72)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
}

// ── Light theme background (Pure White, etc.) ─────────────────
function drawLightBackground(ctx, W, H, t, pRGB) {
  const bgR = getBgRGB().split(',').map(Number)
  const base = `rgb(${bgR[0]}, ${bgR[1]}, ${bgR[2]})`

  // Clean base fill
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H)

  // Subtle primary tint at center
  const bloom = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, W * 0.55)
  bloom.addColorStop(0, `rgba(${pRGB}, ${0.06 + 0.02 * Math.sin(t * 0.4)})`)
  bloom.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H)

  // Soft grid lines
  ctx.strokeStyle = `rgba(${pRGB}, 0.07)`; ctx.lineWidth = 0.5
  const gsp = 72
  for (let x = 0; x < W + gsp; x += gsp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H + gsp; y += gsp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // Edge tint (subtle primary at corners)
  const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.75)
  edge.addColorStop(0, 'rgba(255,255,255,0)'); edge.addColorStop(1, `rgba(${pRGB}, 0.04)`)
  ctx.fillStyle = edge; ctx.fillRect(0, 0, W, H)
}

// ── Main component ────────────────────────────────────────────
export default function Background() {
  const canvasRef  = useRef(null)
  const animRef    = useRef(null)
  const dataRef    = useRef(null)
  const bgStyleRef = useRef('deep-space')
  const prefsRef   = useRef({ particlesEnabled: true, targetFPS: 60 })

  const { bgStyle, visualPrefs } = useTheme()
  useEffect(() => { bgStyleRef.current = bgStyle }, [bgStyle])
  useEffect(() => {
    prefsRef.current = {
      particlesEnabled: visualPrefs.particlesEnabled,
      targetFPS: visualPrefs.targetFPS,
    }
  }, [visualPrefs.particlesEnabled, visualPrefs.targetFPS])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      dataRef.current = buildData(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    let t = 0
    let lastFrameTime = 0

    const renderFrame = () => {
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      t += 0.006

      const pRGB  = getPrimaryRGB()
      const style = bgStyleRef.current
      const data  = dataRef.current
      if (!data) return

      // Light themes get a clean light background regardless of bg style
      if (isLightTheme()) {
        drawLightBackground(ctx, W, H, t, pRGB)
        return
      }

      switch (style) {
        case 'tactical-grid':     drawTacticalGrid(ctx, W, H, t, data, pRGB);     break
        case 'neural-network':    drawNeuralNetwork(ctx, W, H, t, data, pRGB);    break
        case 'matrix-rain':       drawMatrixRain(ctx, W, H, t, data, pRGB);       break
        case 'cyberpunk-city':    drawCyberpunkCity(ctx, W, H, t, data, pRGB);    break
        case 'minimal-black':     drawMinimalBlack(ctx, W, H, t, data, pRGB);     break
        case 'orbital-particles': drawPulseRadar(ctx, W, H, t, data, pRGB);       break
        case 'holographic-fog':   drawHolographicFog(ctx, W, H, t, data, pRGB);   break
        default:                  drawDeepSpace(ctx, W, H, t, data, pRGB);        break
      }
    }

    const draw = (now) => {
      // Particle Systems toggle: render exactly one static frame, then stop
      // the animation loop entirely (real CPU/GPU savings, not just a label).
      if (!prefsRef.current.particlesEnabled) {
        renderFrame()
        return
      }

      // Target FPS: skip frames faster than the cap instead of running flat-out.
      const minInterval = 1000 / Math.max(1, prefsRef.current.targetFPS)
      if (now - lastFrameTime >= minInterval) {
        lastFrameTime = now
        renderFrame()
      }

      animRef.current = requestAnimationFrame(draw)
    }
    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      />
      {/* Scan Line Overlay — real CRT effect, toggled via --scanline-opacity */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
          opacity: 'var(--scanline-opacity, 0)',
          background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'overlay',
        }}
      />
    </>
  )
}
