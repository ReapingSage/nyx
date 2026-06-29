import { useRef, useEffect, useMemo } from 'react'
import { ORB_RINGS } from '../utils/constants.js'

function mkRand(seed) {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}

function ringColor(temp, ring) {
  if (temp < 0.12) return `rgba(42,27,87,${temp * 2})`
  if (temp < 0.38) return `rgba(111,77,255,${0.55 + temp})`
  if (temp < 0.65) return `rgba(155,108,255,${0.70 + temp * 0.3})`
  if (temp < 0.85) return `rgba(194,155,255,${0.80 + temp * 0.18})`
  return `rgba(243,238,255,${Math.min(1, 0.88 + temp * 0.12)})`
}

function ringGlowColor(temp) {
  if (temp < 0.3) return 'rgba(70,45,180,0.6)'
  if (temp < 0.6) return 'rgba(120,70,255,0.7)'
  if (temp < 0.85) return 'rgba(170,120,255,0.8)'
  return 'rgba(240,225,255,0.9)'
}

export default function NyxOrb({ size = 560, state = 'idle', chatMode = false, onHover }) {
  const canvasRef  = useRef(null)
  const animRef    = useRef(null)
  const timeRef    = useRef(0)
  const hoverRef   = useRef(false)
  const stateRef   = useRef(state)

  useEffect(() => { stateRef.current = state }, [state])

  const ringData = useMemo(() => {
    return ORB_RINGS.map((ring, ri) => {
      const rand = mkRand(42 + ri * 137)
      const SEGS = 140
      const segments = Array.from({ length: SEGS }, () => ({
        baseOpacity:  rand(),
        width:        0.5 + rand() * 1.8,
        flickerSpeed: 1.2 + rand() * 4.5,
        flickerOff:   rand() * 6.28,
        colorBias:    rand(),
      }))
      const particles = Array.from({ length: ring.pc }, (_, i) => ({
        angleOffset:  (i / ring.pc) * 6.28,
        size:         1.0 + rand() * 3.2,
        baseOpacity:  0.35 + rand() * 0.65,
        twSpeed:      1.2 + rand() * 4.0,
        twOff:        rand() * 6.28,
        detached:     rand() < 0.20,
        detachAmp:    0.04 + rand() * 0.06,
        colorBias:    rand(),
      }))
      const nodes = Array.from({ length: 2 + (ri % 2) }, (_, ni) => ({
        angle:  (ni / 3) * 6.28 + rand() * 0.6,
        speed:  (0.65 + rand() * 1.0) * (rand() > 0.5 ? 1 : -1),
        size:   2.5 + rand() * 3.0,
        trail:  Array.from({ length: 18 }, () => ({ angle: 0, alpha: 0 })),
        heat:   0.5 + rand() * 0.5,
      }))
      return { segments, particles, nodes, SEGS }
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      const cx = W / 2, cy = H / 2
      const t  = timeRef.current
      const s  = stateRef.current

      const sm  = s === 'thinking'  ? 2.4
                : s === 'speaking'  ? 1.7
                : s === 'listening' ? 1.3
                : s === 'error'     ? 0.55
                : hoverRef.current  ? 1.2 : 1.0
      const bm  = s === 'thinking'  ? 1.5
                : s === 'speaking'  ? 1.3
                : s === 'listening' ? 1.1
                : s === 'error'     ? 1.4
                : hoverRef.current  ? 1.1 : 1.0
      const isError = s === 'error'

      timeRef.current += 0.016 * sm

      ctx.clearRect(0, 0, W, H)

      const baseR = Math.min(W, H) * (chatMode ? 0.34 : 0.43)

      // ── Plasma orbital rings ─────────────────────────────────
      ORB_RINGS.forEach((ring, ri) => {
        const { segments, particles, nodes, SEGS } = ringData[ri]
        const rx  = baseR * ring.rxR
        const ry  = baseR * ring.ryR
        const rot = t * ring.speed

        const hotAngle = t * ring.speed * 1.6 + ri * 1.8 + 0.4
        const hotWidth = 3.14 * (0.28 + 0.12 * Math.sin(t * 0.55 + ri))

        const coldAngle = hotAngle + 3.14 * 0.7
        const coldWidth = 3.14 * 0.25

        ctx.save()
        ctx.translate(cx, cy)

        for (let si = 0; si < SEGS; si++) {
          const seg    = segments[si]
          const a0     = (si / SEGS) * 6.28 + rot
          const a1     = ((si + 1) / SEGS) * 6.28 + rot
          const aMid   = (a0 + a1) / 2

          const flicker = 0.45 + 0.55 * Math.sin(t * seg.flickerSpeed + seg.flickerOff)
          let rawOpacity = seg.baseOpacity * flicker

          if (rawOpacity < 0.06) continue

          const hotDiff  = Math.abs(((aMid - hotAngle + 9.42) % 6.28) - 3.14)
          const hotBoost = hotDiff < hotWidth
            ? 1.0 + 3.4 * Math.pow(1 - hotDiff / hotWidth, 2.2)
            : 1.0

          const coldDiff = Math.abs(((aMid - coldAngle + 9.42) % 6.28) - 3.14)
          const coldMult = coldDiff < coldWidth
            ? 0.10 + 0.90 * (coldDiff / coldWidth)
            : 1.0

          const temp         = Math.min(1, (rawOpacity * hotBoost * coldMult * seg.colorBias + 0.15) * bm)
          const finalAlpha   = Math.min(0.98, rawOpacity * ring.opacity * hotBoost * coldMult * bm)

          if (isError && Math.random() < 0.18) continue

          const segGlowColor = isError
            ? `rgba(220,10,55,0.85)`
            : ringGlowColor(temp)
          const segCoreColor = isError
            ? `rgba(${140 + Math.round(80 * Math.abs(Math.sin(t * 7 + si * 0.18)))},8,${35 + Math.round(35 * Math.abs(Math.cos(t * 5 + si * 0.22)))},${finalAlpha})`
            : ringColor(temp, ring)

          // Outer wide glow
          ctx.beginPath()
          ctx.ellipse(0, 0, rx, ry, a0, 0, a1 - a0 + 0.012)
          ctx.strokeStyle = segGlowColor
          ctx.shadowColor = segGlowColor
          ctx.shadowBlur  = isError
            ? ring.blur * 1.4
            : chatMode ? ring.blur * 0.35 : ring.blur * 1.8 * Math.max(1, hotBoost * 0.7)
          ctx.lineWidth   = seg.width * ring.lw * (chatMode ? 0.4 : 2.2) * Math.max(1, hotBoost * 0.6)
          ctx.globalAlpha = finalAlpha * 0.30
          ctx.stroke()

          // Hot core
          ctx.beginPath()
          ctx.ellipse(0, 0, rx, ry, a0, 0, a1 - a0 + 0.008)
          ctx.strokeStyle = segCoreColor
          ctx.shadowBlur  = chatMode ? ring.blur * 0.20 : ring.blur * 0.7 * hotBoost
          ctx.lineWidth   = seg.width * ring.lw * (chatMode ? 0.30 : 0.80) * Math.max(1, hotBoost * 0.8)
          ctx.globalAlpha = finalAlpha
          ctx.stroke()
        }

        // Particles
        particles.forEach(p => {
          const angle  = p.angleOffset + rot
          const rScale = p.detached
            ? 1.0 + p.detachAmp * Math.sin(t * 2.2 + p.twOff)
            : 1.0
          const px     = Math.cos(angle) * rx * rScale
          const py     = Math.sin(angle) * ry * rScale
          const tw     = 0.20 + 0.80 * Math.abs(Math.sin(t * p.twSpeed + p.twOff))
          const pSz    = p.size * (chatMode ? 0.38 : 1.0)

          const temp   = Math.min(1, (p.colorBias + 0.2) * tw)

          ctx.shadowBlur  = chatMode ? 4 : 22
          ctx.shadowColor = '#E4D3FF'
          ctx.fillStyle   = `rgba(212,188,255,0.45)`
          ctx.globalAlpha = p.baseOpacity * tw * bm * 0.45
          ctx.beginPath(); ctx.arc(px, py, pSz * 2.0, 0, 6.28); ctx.fill()

          ctx.shadowBlur  = chatMode ? 2.5 : 9
          ctx.fillStyle   = temp > 0.7 ? 'rgba(247,242,255,0.95)' : temp > 0.4 ? 'rgba(194,155,255,0.90)' : 'rgba(130,90,255,0.80)'
          ctx.globalAlpha = p.baseOpacity * tw * bm
          ctx.beginPath(); ctx.arc(px, py, pSz * 0.52, 0, 6.28); ctx.fill()
        })

        // Energy nodes with trails
        nodes.forEach(node => {
          for (let ti = node.trail.length - 1; ti > 0; ti--) {
            node.trail[ti].angle = node.trail[ti - 1].angle
            node.trail[ti].alpha = node.trail[ti - 1].alpha * 0.80
          }
          node.trail[0].angle = node.angle
          node.trail[0].alpha = 0.92
          node.angle += 0.016 * sm * node.speed

          node.trail.forEach((tp, ti) => {
            if (tp.alpha < 0.015) return
            const tpx = Math.cos(tp.angle) * rx
            const tpy = Math.sin(tp.angle) * ry
            const tsz = node.size * (1 - ti / node.trail.length) * (chatMode ? 0.38 : 1.0)
            const tc  = node.heat > 0.7 ? '#DCC9FF' : '#9B6CFF'
            ctx.shadowBlur  = chatMode ? 7 : 28
            ctx.shadowColor = tc
            ctx.fillStyle   = tc
            ctx.globalAlpha = tp.alpha * 0.65 * bm
            ctx.beginPath(); ctx.arc(tpx, tpy, Math.max(0.1, tsz), 0, 6.28); ctx.fill()
          })

          const npx = Math.cos(node.angle) * rx
          const npy = Math.sin(node.angle) * ry
          const nc  = node.heat > 0.7 ? '#E9D8FF' : '#C29BFF'
          ctx.shadowBlur  = chatMode ? 10 : 38
          ctx.shadowColor = nc
          ctx.fillStyle   = nc
          ctx.globalAlpha = 0.92 * bm
          ctx.beginPath(); ctx.arc(npx, npy, chatMode ? 1.8 : node.size, 0, 6.28); ctx.fill()
          ctx.shadowBlur  = chatMode ? 3.5 : 14
          ctx.fillStyle   = '#F7F2FF'
          ctx.globalAlpha = bm
          ctx.beginPath(); ctx.arc(npx, npy, chatMode ? 0.9 : node.size * 0.42, 0, 6.28); ctx.fill()
        })

        ctx.restore()
      })

      // ── Core nebula sphere ────────────────────────────────────
      const pulse = 1 + 0.033 * Math.sin(t * 1.7)
      const coreR = baseR * 0.56 * pulse

      const cg1 = ctx.createRadialGradient(cx - baseR * 0.05, cy - baseR * 0.05, 0, cx, cy, coreR)
      cg1.addColorStop(0,    `rgba(218,184,255,${0.28 * bm})`)
      cg1.addColorStop(0.30, `rgba(170,120,255,${0.14 * bm})`)
      cg1.addColorStop(0.65, `rgba(100,48,205,${0.05 * bm})`)
      cg1.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.globalAlpha = 1; ctx.fillStyle = cg1
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 6.28); ctx.fill()

      const cg2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.22)
      cg2.addColorStop(0,   `rgba(255,250,255,${0.35 * bm})`)
      cg2.addColorStop(0.5, `rgba(233,216,255,${0.15 * bm})`)
      cg2.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle = cg2
      ctx.beginPath(); ctx.arc(cx, cy, baseR * 0.22, 0, 6.28); ctx.fill()

      if (isError) {
        const ef = 0.5 + 0.5 * Math.abs(Math.sin(t * 14))
        const erg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 0.9)
        erg.addColorStop(0,   `rgba(255,20,70,${0.22 * ef * bm})`)
        erg.addColorStop(0.5, `rgba(180,5,55,${0.12 * bm})`)
        erg.addColorStop(1,   'rgba(0,0,0,0)')
        ctx.fillStyle = erg; ctx.globalAlpha = 1
        ctx.beginPath(); ctx.arc(cx, cy, coreR * 0.9, 0, 6.28); ctx.fill()
      }

      // Outer breathing ring
      const ph   = Math.sin(t * (s === 'listening' ? 4.5 : 1.25))
      const prR  = baseR * (1.045 + ph * (s === 'listening' ? 0.07 : 0.038))
      ctx.strokeStyle = s === 'listening'
        ? `rgba(140,190,255,${(0.20 + Math.abs(ph) * 0.22) * bm})`
        : `rgba(199,155,255,${(0.12 + ph * 0.08) * bm})`
      ctx.lineWidth   = s === 'listening' ? 1.1 : 0.7
      ctx.shadowColor = s === 'listening' ? '#88BBFF' : '#7B4DFF'
      ctx.shadowBlur  = s === 'listening' ? 28 + Math.abs(ph) * 18 : 24
      ctx.globalAlpha = 1
      ctx.beginPath(); ctx.arc(cx, cy, prR, 0, 6.28); ctx.stroke()

      const prR2  = baseR * (1.08 + Math.sin(t * 0.9 + 1.0) * 0.028)
      ctx.strokeStyle = `rgba(160,110,255,${(0.07 + Math.sin(t * 0.9) * 0.04) * bm})`
      ctx.lineWidth   = 0.45; ctx.shadowBlur = 14
      ctx.beginPath(); ctx.arc(cx, cy, prR2, 0, 6.28); ctx.stroke()

      // ── LISTENING: sonar pulse rings ───────────────────────────
      if (s === 'listening') {
        for (let pi = 0; pi < 3; pi++) {
          const pp = ((t * 3.8 + pi * 0.9) % 2.2)
          const pR = baseR * (1.0 + pp * 0.18)
          const pA = Math.max(0, 0.38 - pp * 0.17)
          ctx.strokeStyle = `rgba(120,180,255,${pA})`
          ctx.shadowColor = '#80AAFF'
          ctx.shadowBlur  = 14 + pp * 10
          ctx.lineWidth   = Math.max(0.1, 1.4 - pp * 0.55)
          ctx.globalAlpha = 1
          ctx.beginPath(); ctx.arc(cx, cy, pR, 0, 6.28); ctx.stroke()
        }
      }

      // ── SPEAKING: sound-wave rings ─────────────────────────────
      if (s === 'speaking') {
        for (let wi = 0; wi < 5; wi++) {
          const wp = ((t * 3.4 + wi * 0.68) % 2.2)
          const wR = baseR * (0.88 + wp * 0.42)
          const wA = Math.max(0, 0.32 - wp * 0.14)
          ctx.strokeStyle = `rgba(190,130,255,${wA})`
          ctx.shadowColor = '#C080FF'
          ctx.shadowBlur  = 16 + wp * 8
          ctx.lineWidth   = Math.max(0.1, 1.8 - wp * 0.75)
          ctx.globalAlpha = 1
          ctx.beginPath(); ctx.arc(cx, cy, wR, 0, 6.28); ctx.stroke()
        }
      }

      // ── ERROR: red glitch corona ───────────────────────────────
      if (isError) {
        const ef  = Math.sin(t * 18)
        const ef2 = Math.sin(t * 11 + 1.4)
        const eg  = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 1.45)
        eg.addColorStop(0,    'rgba(200,0,55,0)')
        eg.addColorStop(0.45, `rgba(200,0,55,${0.10 + Math.abs(ef) * 0.14})`)
        eg.addColorStop(1,    'rgba(140,0,70,0)')
        ctx.fillStyle = eg; ctx.globalAlpha = 1
        ctx.beginPath(); ctx.arc(cx, cy, baseR * 1.45, 0, 6.28); ctx.fill()

        ctx.strokeStyle = `rgba(255,15,65,${0.40 + Math.abs(ef) * 0.45})`
        ctx.shadowColor = '#FF1040'
        ctx.shadowBlur  = 18 + Math.abs(ef) * 22
        ctx.lineWidth   = 1.3 + Math.abs(ef) * 1.6
        ctx.globalAlpha = 1
        ctx.beginPath(); ctx.arc(cx, cy, baseR * (1.01 + Math.abs(ef) * 0.065), 0, 6.28); ctx.stroke()

        ctx.strokeStyle = `rgba(200,0,90,${0.22 + Math.abs(ef2) * 0.28})`
        ctx.shadowBlur  = 10
        ctx.lineWidth   = 0.7
        ctx.beginPath(); ctx.arc(cx, cy, baseR * (0.97 - Math.abs(ef2) * 0.04), 0, 6.28); ctx.stroke()
      }

      // Thinking beam
      if (s === 'thinking' && !chatMode) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 2.0)
        const beam = ctx.createLinearGradient(-baseR, 0, baseR, 0)
        beam.addColorStop(0,   'rgba(155,108,255,0)')
        beam.addColorStop(0.5, 'rgba(199,155,255,0.30)')
        beam.addColorStop(1,   'rgba(155,108,255,0)')
        ctx.fillStyle = beam; ctx.globalAlpha = 1
        ctx.fillRect(-baseR, -1.5, baseR * 2, 3); ctx.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [chatMode, ringData])

  return (
    <canvas
      ref={canvasRef} width={size} height={size}
      onMouseEnter={() => { hoverRef.current = true;  onHover?.(true) }}
      onMouseLeave={() => { hoverRef.current = false; onHover?.(false) }}
      style={{ display: 'block', mixBlendMode: 'screen' }}
    />
  )
}
