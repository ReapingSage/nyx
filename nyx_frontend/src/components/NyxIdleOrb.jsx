import { useRef, useEffect } from 'react'

// ── 32 alien-mathematical rune glyphs ─────────────────────────────────────────
// Each glyph: (ctx, size) → draws at origin, caller handles translate/rotate
const RUNES = [
  // 01: Circle + upward radial spike + center fill dot
  (c,s)=>{c.beginPath();c.arc(0,0,s,0,6.28);c.stroke();c.beginPath();c.moveTo(0,-s);c.lineTo(0,-s*1.55);c.stroke();c.beginPath();c.arc(0,0,s*.11,0,6.28);c.fill()},
  // 02: Broken ring — 4 arc segments with uneven gaps
  (c,s)=>{[[0,1.2],[1.7,2.9],[3.4,4.5],[5.0,5.9]].forEach(([a0,a1])=>{c.beginPath();c.arc(0,0,s,a0,a1);c.stroke()})},
  // 03: 270° arc with a line extending from the open gap
  (c,s)=>{c.beginPath();c.arc(0,0,s,0.79,3.93);c.stroke();c.beginPath();c.moveTo(s*.71,s*.71);c.lineTo(s*1.42,s*1.42);c.stroke()},
  // 04: Two opposing arcs bridged by a vertical line
  (c,s)=>{c.beginPath();c.arc(0,-s*.32,s*.52,0,3.14,true);c.stroke();c.beginPath();c.arc(0,s*.32,s*.52,3.14,6.28,true);c.stroke();c.beginPath();c.moveTo(0,-s*.9);c.lineTo(0,s*.9);c.stroke()},
  // 05: Ruler — vertical axis with staggered horizontal ticks
  (c,s)=>{c.beginPath();c.moveTo(0,-s);c.lineTo(0,s);c.stroke();[[-s*.75,-0.75],[s*.5,-0.28],[-s*.55,0.15],[s*.38,0.55],[-s*.62,0.85]].forEach(([len,fy])=>{c.beginPath();c.moveTo(0,fy*s);c.lineTo(len,fy*s);c.stroke()})},
  // 06: Outer circle + inner 240° arc + vertical bisector
  (c,s)=>{c.beginPath();c.arc(0,0,s,0,6.28);c.stroke();c.beginPath();c.arc(0,0,s*.5,0.65,4.2);c.stroke();c.beginPath();c.moveTo(0,-s*1.1);c.lineTo(0,s*1.1);c.stroke()},
  // 07: Open square (top-right corner missing) with center dot
  (c,s)=>{c.beginPath();c.moveTo(-s,-s);c.lineTo(-s,s);c.lineTo(s,s);c.lineTo(s,s*.1);c.stroke();c.beginPath();c.moveTo(-s,-s);c.lineTo(s*.1,-s);c.stroke();c.beginPath();c.arc(0,0,s*.12,0,6.28);c.fill()},
  // 08: Three nested partial arcs — decreasing angular span
  (c,s)=>{[[s,0,4.71],[s*.62,0.45,4.00],[s*.34,0.90,3.30]].forEach(([r,a0,a1])=>{c.beginPath();c.arc(0,0,r,a0,a1);c.stroke()})},
  // 09: Offset cross — unequal arms, dot at longer horizontal end
  (c,s)=>{c.beginPath();c.moveTo(0,-s);c.lineTo(0,s*.6);c.moveTo(-s*.35,s*.22);c.lineTo(s*.85,s*.22);c.stroke();c.beginPath();c.arc(s*.85,s*.22,s*.12,0,6.28);c.fill()},
  // 10: Crescent — two overlapping arcs with internal pupil dot
  (c,s)=>{c.beginPath();c.arc(0,0,s,3.49,5.93);c.stroke();c.beginPath();c.arc(s*.18,s*.42,s*.6,3.49,5.93);c.stroke();c.beginPath();c.arc(-s*.08,s*.1,s*.09,0,6.28);c.fill()},
  // 11: L-bracket with fill dot at inner corner + short upward extension
  (c,s)=>{c.beginPath();c.moveTo(-s*.55,s);c.lineTo(-s*.55,-s*.18);c.lineTo(s*.85,-s*.18);c.stroke();c.beginPath();c.arc(-s*.55,-s*.18,s*.11,0,6.28);c.fill();c.beginPath();c.moveTo(-s*.55,-s*.18);c.lineTo(-s*.55,-s*.9);c.stroke()},
  // 12: Tight inward spiral (~1.5 turns)
  (c,s)=>{c.beginPath();for(let i=0;i<=55;i++){const a=(i/55)*9.42,r=s*(0.18+0.82*(i/55));i===0?c.moveTo(Math.cos(a-1.57)*r,Math.sin(a-1.57)*r):c.lineTo(Math.cos(a-1.57)*r,Math.sin(a-1.57)*r)}c.stroke()},
  // 13: Hexagon fragment (4 of 6 sides) with center dot
  (c,s)=>{const p=(n)=>[Math.cos((n/6)*6.28-1.57)*s,Math.sin((n/6)*6.28-1.57)*s];c.beginPath();c.moveTo(...p(0));[1,2,3,4].forEach(i=>c.lineTo(...p(i)));c.stroke();c.beginPath();c.arc(0,0,s*.12,0,6.28);c.fill()},
  // 14: Venn-like overlapping offset circles
  (c,s)=>{c.beginPath();c.arc(-s*.30,0,s*.70,0,6.28);c.stroke();c.beginPath();c.arc(s*.30,0,s*.70,0,6.28);c.stroke()},
  // 15: Equal cross with hollow circle endpoints at right + top arm
  (c,s)=>{c.beginPath();c.moveTo(-s,0);c.lineTo(s,0);c.moveTo(0,-s);c.lineTo(0,s);c.stroke();c.beginPath();c.arc(s,0,s*.14,0,6.28);c.stroke();c.beginPath();c.arc(0,-s,s*.14,0,6.28);c.stroke()},
  // 16: Key glyph — vertical line with one-sided arc + short crossbar
  (c,s)=>{c.beginPath();c.moveTo(0,-s);c.lineTo(0,s);c.stroke();c.beginPath();c.arc(0,-s*.38,s*.42,0,3.14,false);c.stroke();c.beginPath();c.moveTo(-s*.22,s*.3);c.lineTo(s*.22,s*.3);c.stroke()},
  // 17: Diamond with lines extending beyond top and right points
  (c,s)=>{c.beginPath();c.moveTo(0,-s);c.lineTo(s*.62,0);c.lineTo(0,s);c.lineTo(-s*.62,0);c.closePath();c.stroke();c.beginPath();c.moveTo(0,-s);c.lineTo(0,-s*1.42);c.moveTo(s*.62,0);c.lineTo(s*1.05,0);c.stroke()},
  // 18: Sigma/Z-shape with fill dot at top-right corner
  (c,s)=>{c.beginPath();c.moveTo(-s*.65,-s);c.lineTo(s*.65,-s);c.lineTo(-s*.65,s);c.lineTo(s*.65,s);c.stroke();c.beginPath();c.arc(s*.65,-s,s*.12,0,6.28);c.fill()},
  // 19: Circle + offset inner dot + partial orbital arc
  (c,s)=>{c.beginPath();c.arc(0,0,s,0,6.28);c.stroke();c.beginPath();c.arc(0,0,s*.45,0.8,4.4);c.stroke();c.beginPath();c.arc(s*.18,-s*.14,s*.10,0,6.28);c.fill()},
  // 20: Angular Z-glyph with hollow circle at bottom-right end
  (c,s)=>{c.beginPath();c.moveTo(-s*.72,-s*.8);c.lineTo(s*.72,-s*.8);c.lineTo(-s*.72,s*.8);c.lineTo(s*.72,s*.8);c.stroke();c.beginPath();c.arc(s*.72,s*.8,s*.18,0,6.28);c.stroke()},
  // 21: Three-sided rectangle (open top) with inner ascending arc
  (c,s)=>{c.beginPath();c.moveTo(-s,-s*.55);c.lineTo(-s,s*.55);c.lineTo(s,s*.55);c.lineTo(s,-s*.55);c.stroke();c.beginPath();c.arc(0,s*.1,s*.40,3.67,5.76);c.stroke()},
  // 22: Outer circle with 3 inward radials stopping before center
  (c,s)=>{c.beginPath();c.arc(0,0,s,0,6.28);c.stroke();for(let i=0;i<3;i++){const a=(i/3)*6.28-1.57;c.beginPath();c.moveTo(Math.cos(a)*s,Math.sin(a)*s);c.lineTo(Math.cos(a)*s*.35,Math.sin(a)*s*.35);c.stroke()}},
  // 23: Sine-wave path segment with inflection dot
  (c,s)=>{c.beginPath();for(let i=0;i<=44;i++){const x=-s+(i/44)*s*2,y=Math.sin((i/44)*6.28)*s*.48;i===0?c.moveTo(x,y):c.lineTo(x,y)}c.stroke();c.beginPath();c.arc(0,0,s*.10,0,6.28);c.fill()},
  // 24: Phi glyph — circle with full cross
  (c,s)=>{c.beginPath();c.arc(0,0,s*.62,0,6.28);c.stroke();c.beginPath();c.moveTo(0,-s);c.lineTo(0,s);c.moveTo(-s*.9,0);c.lineTo(s*.9,0);c.stroke()},
  // 25: Arc with fill dots at endpoints + perpendicular bisector
  (c,s)=>{c.beginPath();c.arc(-s*.4,-s*.25,s*.65,0.2,2.5);c.stroke();c.beginPath();c.arc(-s*.38,s*.42,s*.09,0,6.28);c.fill();c.beginPath();c.arc(s*.38,-s*.18,s*.09,0,6.28);c.fill();c.beginPath();c.moveTo(0,s*.15);c.lineTo(0,-s*.72);c.stroke()},
  // 26: Broken equilateral triangle — one corner deliberately gapped
  (c,s)=>{c.beginPath();c.moveTo(0,-s);c.lineTo(s*.87,s*.5);c.moveTo(s*.87,s*.5);c.lineTo(s*.18,s*.5);c.moveTo(-s*.18,s*.5);c.lineTo(-s*.87,s*.5);c.lineTo(0,-s);c.stroke()},
  // 27: Saturn-like — small circle with angled ring arc
  (c,s)=>{c.beginPath();c.arc(0,0,s*.52,0,6.28);c.stroke();c.beginPath();c.arc(0,s*.14,s*1.05,-2.85,-0.30);c.stroke()},
  // 28: Three horizontal bars of varying width
  (c,s)=>{[[-s*.88,-s*.55],[-s*.62,0],[-s*.75,s*.55]].forEach(([x0,y])=>{c.beginPath();c.moveTo(x0,y);c.lineTo(-x0,y);c.stroke()})},
  // 29: Circle with tangent line and fill dot at line end
  (c,s)=>{c.beginPath();c.arc(0,0,s,0,6.28);c.stroke();c.beginPath();c.moveTo(s,0);c.lineTo(s*1.72,0);c.stroke();c.beginPath();c.arc(s*1.72,0,s*.13,0,6.28);c.fill()},
  // 30: Forking upward line — single stem splits into two, fill dot at base
  (c,s)=>{c.beginPath();c.moveTo(0,s*.95);c.lineTo(0,-s*.08);c.moveTo(0,-s*.08);c.lineTo(-s*.52,-s);c.moveTo(0,-s*.08);c.lineTo(s*.52,-s);c.stroke();c.beginPath();c.arc(0,s*.95,s*.12,0,6.28);c.fill()},
  // 31: Omega — arc with two descending lines at the open ends
  (c,s)=>{c.beginPath();c.arc(0,-s*.14,s*.72,0.52,2.62);c.stroke();const ex0=Math.cos(0.52)*s*.72,ey0=Math.sin(0.52)*s*.72-s*.14,ex1=Math.cos(2.62)*s*.72,ey1=Math.sin(2.62)*s*.72-s*.14;c.beginPath();c.moveTo(ex0,ey0);c.lineTo(s*.52,s*.82);c.moveTo(ex1,ey1);c.lineTo(-s*.52,s*.82);c.stroke()},
  // 32: Large arc fragment (300°) with inner rotated diamond
  (c,s)=>{c.beginPath();c.arc(0,0,s,0.52,5.24);c.stroke();const h=s*.46;c.beginPath();c.moveTo(0,-h);c.lineTo(h,0);c.lineTo(0,h);c.lineTo(-h,0);c.closePath();c.stroke()},
]

// ── Star field populations — generated once at module load ────────────────────
const STARS_FAR = Array.from({ length: 140 }, (_, i) => ({
  x:    Math.sin(i * 3.1711 + 1.1) * 0.5 + 0.5,
  y:    Math.cos(i * 2.0183 + 0.7) * 0.5 + 0.5,
  sz:   0.18 + (i % 5) * 0.14,
  al:   0.04 + (i % 8) * 0.020,
  tSpd: 0.08 + (i % 7) * 0.08,
  tOff: (i * 2.414) % 6.28,
}))
const STARS_MID = Array.from({ length: 80 }, (_, i) => ({
  x:    Math.sin(i * 2.3999 + 0.7) * 0.5 + 0.5,
  y:    Math.cos(i * 1.6180 + 0.4) * 0.5 + 0.5,
  sz:   0.28 + (i % 6) * 0.24,
  al:   0.06 + (i % 9) * 0.038,
  tSpd: 0.14 + (i % 8) * 0.11,
  tOff: (i * 1.618) % 6.28,
  hue:  i % 3,  // 0=cool-white, 1=warm-purple, 2=blue-tint
}))
const STARS_BRIGHT = Array.from({ length: 28 }, (_, i) => ({
  x:     Math.sin(i * 5.3311 + 0.9) * 0.5 + 0.5,
  y:     Math.cos(i * 3.7182 + 0.3) * 0.5 + 0.5,
  sz:    0.9 + (i % 4) * 0.62,
  al:    0.42 + (i % 5) * 0.10,
  tSpd:  0.22 + (i % 6) * 0.14,
  tOff:  (i * 3.141) % 6.28,
  cross: i % 5 === 0,  // diffraction spikes on every 5th
}))

// ── 1. Background star field — three populations ──────────────────────────────
function drawStars(ctx, w, h, t) {
  ctx.shadowBlur = 0
  STARS_FAR.forEach(s => {
    const al = s.al + s.al * 0.9 * Math.sin(t * s.tSpd + s.tOff)
    if (al < 0.015) return
    ctx.globalAlpha = Math.max(0, al)
    ctx.fillStyle = '#D8D0FF'
    ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.sz, 0, 6.28); ctx.fill()
  })
  STARS_MID.forEach(s => {
    const al = s.al + s.al * 0.8 * Math.sin(t * s.tSpd + s.tOff)
    if (al < 0.02) return
    ctx.globalAlpha = Math.max(0, al)
    ctx.fillStyle = s.hue === 0 ? '#EEE8FF' : s.hue === 1 ? '#D0BEFF' : '#C8D8FF'
    ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.sz, 0, 6.28); ctx.fill()
  })
  STARS_BRIGHT.forEach(s => {
    const al = s.al + s.al * 0.6 * Math.sin(t * s.tSpd + s.tOff)
    if (al < 0.05) return
    const px = s.x * w, py = s.y * h
    ctx.globalAlpha = 1
    ctx.shadowColor = 'rgba(220,200,255,0.9)'; ctx.shadowBlur = 8 + s.sz * 3
    ctx.fillStyle = `rgba(240,232,255,${al})`
    ctx.beginPath(); ctx.arc(px, py, s.sz, 0, 6.28); ctx.fill()
    if (s.cross) {
      ctx.shadowBlur = 0
      const len = s.sz * 3.5
      ctx.strokeStyle = `rgba(230,220,255,${al * 0.4})`; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(px - len, py); ctx.lineTo(px + len, py); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px, py - len); ctx.lineTo(px, py + len); ctx.stroke()
    }
  })
  ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

// ── 2. Orbiting midground particles ───────────────────────────────────────────
function drawParticles(ctx, cx, cy, eR, t) {
  ctx.shadowBlur = 0
  for (let i = 0; i < 55; i++) {
    const seed  = i * 7.31, bAngle = seed % 6.28
    const bR    = eR * (1.22 + (i % 15) * 0.095)
    const angle = bAngle + t * (0.003 + (i % 5) * 0.0014) * (i % 2 === 0 ? 1 : -1)
    const r     = bR + Math.sin(t * 0.24 + i) * eR * 0.038
    if (r < eR * 1.10) continue
    const alpha = 0.06 + 0.20 * Math.abs(Math.sin(t * 0.62 + i * 0.88))
    const sz    = 0.30 + (i % 4) * 0.28
    ctx.globalAlpha = 1
    ctx.fillStyle = i % 4 === 0 ? `rgba(228,192,255,${alpha})` : `rgba(135,78,252,${alpha})`
    ctx.shadowColor = '#8850FF'; ctx.shadowBlur = sz > 0.58 ? 5 : 0
    ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, sz, 0, 6.28); ctx.fill()
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

// ── 3. Nebula atmosphere — layered, turbulent ─────────────────────────────────
function drawNebula(ctx, cx, cy, eR, t, s, isAlert, isError) {
  const isThinking = s === 'thinking', isSpeaking = s === 'speaking'
  const bm = isThinking ? 1.55 : isSpeaking ? 1.30 : 1.0

  const [rA,gA,bA] = isAlert ? [195,50,225]  : isError ? [148,30,68]  : [82,28,198]
  const [rB,gB,bB] = isAlert ? [150,28,188]  : isError ? [100,18,44]  : [55,16,162]
  const [rH,gH,bH] = isAlert ? [255,118,255] : isError ? [218,72,82]  : [200,148,255]

  // A: Deep outer atmosphere
  const og = ctx.createRadialGradient(cx, cy, eR * 0.88, cx, cy, eR * 3.20)
  og.addColorStop(0,    'rgba(0,0,0,0)')
  og.addColorStop(0.05, `rgba(${rA},${gA},${bA},${0.62 * bm})`)
  og.addColorStop(0.22, `rgba(${rB},${gB},${bB},${0.38 * bm})`)
  og.addColorStop(0.50, `rgba(${Math.round(rB*.5)},${Math.round(gB*.5)},${Math.round(bB*.55)},${0.16 * bm})`)
  og.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.globalAlpha = 1; ctx.fillStyle = og
  ctx.beginPath(); ctx.arc(cx, cy, eR * 3.20, 0, 6.28); ctx.fill()

  // B: Macro storm cloud blobs (reduced from 16 to 9)
  const MACRO = [
    [1.26, 0.082,0.90,0.56,0.00],[1.52,-0.062,0.74,0.44,1.80],
    [1.20, 0.112,0.62,0.52,0.90],[1.72,-0.088,0.84,0.38,3.20],
    [1.12, 0.076,0.55,0.60,2.10],[1.44,-0.055,0.68,0.36,4.70],
    [1.34, 0.100,0.78,0.48,5.50],[1.65,-0.078,0.65,0.40,1.10],
    [1.88, 0.058,0.72,0.30,3.80],
  ]
  MACRO.forEach(([rm,sp,sz,al,ph]) => {
    const ang = sp*t+ph, pulse = 0.87+0.13*Math.sin(t*1.05+ph)
    const bx  = cx+Math.cos(ang)*eR*rm, by = cy+Math.sin(ang)*eR*rm, br = eR*sz*pulse*bm
    const g   = ctx.createRadialGradient(bx,by,0,bx,by,br)
    g.addColorStop(0,  `rgba(${rA},${gA},${bA},${al*bm})`)
    g.addColorStop(0.4,`rgba(${rB},${gB},${bB},${al*0.52*bm})`)
    g.addColorStop(1,  'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx,by,br,0,6.28); ctx.fill()
  })

  // C: Micro cloud detail (reduced from 12 to 6)
  const MICRO = [
    [1.18,0.145,0.32,0.55,0.6],[1.38,-0.118,0.27,0.48,2.3],
    [1.55,0.132,0.30,0.44,4.1],[1.68,-0.108,0.28,0.40,5.8],
    [1.24,0.125,0.25,0.52,1.5],[1.48,-0.140,0.30,0.46,3.7],
  ]
  MICRO.forEach(([rm,sp,sz,al,ph]) => {
    const ang = sp*t+ph, pulse = 0.80+0.20*Math.sin(t*1.8+ph)
    const bx  = cx+Math.cos(ang)*eR*rm, by = cy+Math.sin(ang)*eR*rm, br = eR*sz*pulse*bm
    const g   = ctx.createRadialGradient(bx,by,0,bx,by,br)
    g.addColorStop(0,  `rgba(${rH},${gH},${bH},${al*0.70*bm})`)
    g.addColorStop(0.5,`rgba(${rA},${gA},${bA},${al*0.30*bm})`)
    g.addColorStop(1,  'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx,by,br,0,6.28); ctx.fill()
  })

  // D: Plasma pressure hotspots — intense bright nodes
  const HOTSPOTS = [
    [1.14,0.185,0.18,0.75,0.4],[1.40,-0.158,0.15,0.70,2.2],
    [1.62,0.170,0.14,0.66,4.0],[1.28,-0.148,0.16,0.72,5.6],
    [1.54,0.178,0.13,0.64,1.8],[1.82,-0.128,0.17,0.60,3.3],
  ]
  HOTSPOTS.forEach(([rm,sp,sz,al,ph]) => {
    const ang = sp*t+ph, pulse = 0.58+0.42*Math.abs(Math.sin(t*2.8+ph*2))
    const bx  = cx+Math.cos(ang)*eR*rm, by = cy+Math.sin(ang)*eR*rm, br = eR*sz*pulse*bm
    const g   = ctx.createRadialGradient(bx,by,0,bx,by,br)
    g.addColorStop(0,  `rgba(${rH},${gH},${bH},${al*pulse*bm})`)
    g.addColorStop(0.5,`rgba(${rA},${gA},${bA},${al*0.4*pulse*bm})`)
    g.addColorStop(1,  'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx,by,br,0,6.28); ctx.fill()
  })

  // E: Plasma tendrils — thin arcing veins
  ctx.save(); ctx.translate(cx, cy)
  for (let i = 0; i < 10; i++) {
    const baseA = (i/20)*6.28 + t*0.015 + (i%3)*0.95
    const inR   = eR*(1.04+0.07*Math.sin(t*0.32+i*1.2))
    const outR  = eR*(1.40+0.32*Math.abs(Math.sin(i*2.15+t*0.09)))
    const br    = 0.07+0.18*Math.abs(Math.sin(t*0.40+i*1.62))
    const spr   = 0.060+0.044*Math.sin(t*0.65+i*0.88)
    const mx    = Math.cos(baseA+spr*0.85)*((inR+outR)*0.52)
    const my    = Math.sin(baseA+spr*0.85)*((inR+outR)*0.52)
    ctx.beginPath()
    ctx.moveTo(Math.cos(baseA)*inR, Math.sin(baseA)*inR)
    ctx.quadraticCurveTo(mx, my, Math.cos(baseA+spr*1.75)*outR, Math.sin(baseA+spr*1.75)*outR)
    ctx.strokeStyle = `rgba(${rH},${gH},${bH},${br})`
    ctx.lineWidth   = 0.40+0.55*br
    ctx.shadowColor = `rgba(${rH},${gH},${bH},0.9)`
    ctx.shadowBlur  = 4+9*br; ctx.globalAlpha = 1; ctx.stroke()
  }
  ctx.shadowBlur = 0; ctx.restore()

  // F: Dense inner corona cloud
  const breath = 0.88+0.12*Math.sin(t*0.55)
  const cP     = (0.58+0.36*Math.sin(t*0.78))*breath
  const cg     = ctx.createRadialGradient(cx,cy,eR*1.04,cx,cy,eR*1.58)
  cg.addColorStop(0,    `rgba(${rH},${gH},${bH},${0.42*cP*bm})`)
  cg.addColorStop(0.28, `rgba(${rA},${gA},${bA},${0.28*cP*bm})`)
  cg.addColorStop(0.62, `rgba(${rB},${gB},${bB},${0.10*cP*bm})`)
  cg.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx,cy,eR*1.58,0,6.28); ctx.fill()
}

// Offscreen canvas — reused each frame for single-pass blur
let _glowOff = null, _glowOffW = 0, _glowOffH = 0
function _getGlowCanvas(w, h) {
  if (!_glowOff || _glowOffW !== w || _glowOffH !== h) {
    _glowOff = document.createElement('canvas')
    _glowOff.width = w; _glowOff.height = h
    _glowOffW = w; _glowOffH = h
  }
  return _glowOff
}

// ── 4. Localized corona aurora — single-pass blur for performance ─────────────
function drawCoronaAurora(ctx, cx, cy, eR, t, isAlert, isError, w, h) {
  const [rA,gA,bA] = isAlert ? [195,50,225]  : isError ? [148,30,68]  : [88,32,205]
  const [rH,gH,bH] = isAlert ? [255,118,255] : isError ? [218,72,82]  : [200,145,255]
  const [rD,gD,bD] = isAlert ? [55,8,95]     : isError ? [55,8,28]    : [18,4,80]

  // L1+L2: Draw all fog/wisps to offscreen without filter, then drawImage once with blur.
  // This replaces ~380 individual blurred draw calls with 1 blurred composite.
  const off    = _getGlowCanvas(w, h)
  const offCtx = off.getContext('2d')
  offCtx.clearRect(0, 0, w, h)

  // L1: 22 atmospheric fog dots (was 52)
  for (let i = 0; i < 22; i++) {
    const a  = (i / 22) * 6.28318 + t * 0.007 + Math.sin(i * 2.618) * 0.32
    const rm = 1.16 + 0.44 * Math.abs(Math.sin(i * 1.382 + t * 0.028))
    const r  = eR * (0.155 + 0.125 * Math.abs(Math.sin(i * 2.1 + t * 0.022)))
    const al = 0.26 + 0.20 * Math.abs(Math.sin(i * 1.618 + t * 0.045))
    offCtx.fillStyle = `rgba(${rD},${gD},${bD},${al.toFixed(3)})`
    offCtx.beginPath()
    offCtx.arc(cx + Math.cos(a) * eR * rm, cy + Math.sin(a) * eR * rm, r, 0, 6.28318)
    offCtx.fill()
  }

  // L2: 6 wisp chains × 12 dots each (was 12 chains × 28 dots = 336 → now 72)
  const WISPS = [
    [0.00,1.80,1.12,1.42,12,0.32, 0.013,0.13],
    [1.05,2.00,1.15,1.48,12,0.28,-0.015,0.17],
    [2.09,1.70,1.13,1.38,12,0.30, 0.016,0.11],
    [3.14,2.10,1.10,1.52,12,0.26,-0.012,0.19],
    [4.19,1.85,1.16,1.44,12,0.29, 0.014,0.14],
    [5.24,2.05,1.12,1.50,12,0.27,-0.016,0.15],
  ]
  WISPS.forEach(([a0,span,rmI,rmO,N,al,sp,curl]) => {
    const sA = a0 + sp * t
    for (let i = 0; i < N; i++) {
      const fr    = i / (N - 1)
      const a     = sA + fr * span
      const wv    = curl * Math.sin(fr * Math.PI * 2.7 + t * 0.36 + a0 * 1.9)
      const rm    = rmI + fr * (rmO - rmI) + wv * 0.065
      const env   = Math.sin(fr * Math.PI) * (0.58 + 0.42 * Math.abs(Math.sin(t * 0.40 + a0)))
      const blend = Math.min(1, fr * 2, (1 - fr) * 2)
      const rC    = Math.round(rD + (rA - rD) * blend)
      const gC    = Math.round(gD + (gA - gD) * blend)
      const bC    = Math.round(bD + (bA - bD) * blend)
      const sz    = eR * (0.026 + 0.018 * fr)
      offCtx.fillStyle = `rgba(${rC},${gC},${bC},${(al * env).toFixed(3)})`
      offCtx.beginPath()
      offCtx.arc(cx + Math.cos(a) * eR * rm, cy + Math.sin(a) * eR * rm, sz, 0, 6.28318)
      offCtx.fill()
    }
  })

  // Single blur drawImage — 1 GPU pass for all fog and wisps
  ctx.save()
  ctx.filter = `blur(${Math.round(eR * 0.072)}px)`
  ctx.drawImage(off, 0, 0)
  ctx.filter = 'none'
  ctx.restore()

  // ── L3: Orbital plasma arcs — 12 arcs, no filter ─────────────────────────
  ctx.save()
  ctx.lineCap = 'round'; ctx.globalAlpha = 1
  const ORBARCS = [
    [0.00,0.42,1.07,0.0055,0.32, 0.014, 1],[1.08,0.50,1.06,0.0060,0.34, 0.018, 1],
    [2.24,0.46,1.08,0.0058,0.30, 0.013, 1],[3.36,0.48,1.07,0.0062,0.32, 0.017, 1],
    [4.52,0.44,1.06,0.0056,0.30, 0.016, 1],[5.68,0.51,1.08,0.0065,0.35, 0.015, 1],
    [0.16,0.60,1.30,0.0038,0.19, 0.008, 1],[1.62,0.56,1.36,0.0040,0.17, 0.009, 1],
    [3.16,0.62,1.29,0.0042,0.21, 0.007, 1],[4.72,0.58,1.31,0.0036,0.18, 0.010, 1],
    [0.38,0.82,1.60,0.0025,0.12, 0.005, 1],[2.78,0.88,1.57,0.0028,0.13, 0.006, 1],
  ]
  ORBARCS.forEach(([a0,span,rm,lwR,al,sp,dir]) => {
    const startA = a0 + dir * sp * t
    const pulse  = 0.70 + 0.30 * Math.abs(Math.sin(t * 0.55 + a0 * 1.6))
    const lw     = eR * lwR * (0.7 + 0.3 * Math.abs(Math.sin(t * 0.42 + a0)))
    const fRm    = Math.max(0, Math.min(1, (rm - 1.0) / 0.7))
    const rC     = Math.round(rH + (rD - rH) * fRm)
    const gC     = Math.round(gH + (gD - gH) * fRm)
    const bC     = Math.round(bH + (bD - bH) * fRm)
    ctx.beginPath()
    ctx.arc(cx, cy, eR * rm, startA, startA + span)
    ctx.strokeStyle = `rgba(${rC},${gC},${bC},${(al * pulse).toFixed(3)})`
    ctx.lineWidth   = lw; ctx.stroke()
  })
  ctx.lineCap = 'butt'; ctx.restore()

  // ── L4: Radial filaments — 40 lines, no filter ───────────────────────────
  ctx.save()
  ctx.lineCap = 'round'; ctx.globalAlpha = 1
  for (let i = 0; i < 40; i++) {
    const a   = (i / 40) * 6.28318 + t * 0.004
    const len = eR * (0.04 + 0.26 * Math.pow(Math.abs(Math.sin(i * 2.618 + t * 0.10)), 2.5))
    const al  = Math.pow(Math.abs(Math.sin(t * 0.92 + i * 0.718)), 1.9) * 0.80
    const lw  = 0.30 + 0.90 * Math.abs(Math.sin(i * 1.618 + t * 0.06))
    if (al < 0.05) continue
    const x0 = cx + Math.cos(a) * eR * 0.988
    const y0 = cy + Math.sin(a) * eR * 0.988
    const x1 = cx + Math.cos(a) * (eR + len)
    const y1 = cy + Math.sin(a) * (eR + len)
    const g  = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0,    `rgba(${rH},${gH},${bH},${al.toFixed(3)})`)
    g.addColorStop(0.55, `rgba(${rA},${gA},${bA},${(al * 0.35).toFixed(3)})`)
    g.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1)
    ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.stroke()
  }
  ctx.lineCap = 'butt'; ctx.restore()
}

// ── Solid void — blacks out eclipse interior ─────────────────────────────────
function drawVoid(ctx, cx, cy, eR) {
  ctx.globalAlpha = 1; ctx.shadowBlur = 0
  ctx.fillStyle = '#000000'
  ctx.beginPath(); ctx.arc(cx, cy, eR * 0.970, 0, 6.28); ctx.fill()
}

// ── 5. Void dimensional depth — subconscious interior movement ────────────────
function drawVoidDepth(ctx, cx, cy, eR, t) {
  const eg = ctx.createRadialGradient(cx, cy, eR*0.64, cx, cy, eR*0.970)
  eg.addColorStop(0,    'rgba(0,0,0,0)')
  eg.addColorStop(0.80, 'rgba(0,0,0,0)')
  eg.addColorStop(1,    `rgba(58,18,125,${0.28+0.08*Math.sin(t*0.72)})`)
  ctx.globalAlpha = 1; ctx.fillStyle = eg
  ctx.beginPath(); ctx.arc(cx, cy, eR*0.970, 0, 6.28); ctx.fill()

  const dg = ctx.createRadialGradient(cx-eR*0.06, cy-eR*0.09, 0, cx, cy, eR*0.84)
  const dp  = 0.10+0.06*Math.sin(t*0.26)
  dg.addColorStop(0,   `rgba(6,2,22,${dp})`)
  dg.addColorStop(0.5, `rgba(3,1,10,${dp*0.5})`)
  dg.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, eR*0.84, 0, 6.28); ctx.fill()

  const dg2 = ctx.createRadialGradient(cx+eR*0.05, cy+eR*0.07, 0, cx, cy, eR*0.60)
  const dp2  = 0.06+0.04*Math.sin(t*0.38+1.8)
  dg2.addColorStop(0,   `rgba(4,1,15,${dp2})`)
  dg2.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = dg2; ctx.beginPath(); ctx.arc(cx, cy, eR*0.60, 0, 6.28); ctx.fill()

  ctx.save(); ctx.translate(cx, cy)
  // Primary plasma wisps — slow drift across void interior
  for (let i = 0; i < 5; i++) {
    const a  = (i/5)*6.28 + t*0.005 + (i%2 ? 1:-1)*t*0.003
    const r1 = eR*(0.07+0.06*Math.sin(t*0.11+i*2.1))
    const r2 = eR*(0.48+0.14*Math.sin(t*0.14+i*1.7))
    const al = 0.036+0.050*Math.abs(Math.sin(t*0.16+i*1.4))
    ctx.beginPath()
    ctx.moveTo(Math.cos(a)*r1, Math.sin(a)*r1)
    ctx.quadraticCurveTo(
      Math.cos(a+0.32)*(r1+r2)*0.50, Math.sin(a+0.32)*(r1+r2)*0.50,
      Math.cos(a+0.60)*r2,           Math.sin(a+0.60)*r2
    )
    ctx.strokeStyle = `rgba(72,26,162,${al})`
    ctx.lineWidth   = 1.5
    ctx.shadowColor = 'rgba(92,36,210,0.22)'
    ctx.shadowBlur  = 9; ctx.globalAlpha = 1; ctx.stroke()
  }
  // Deep plasma veins — hidden marbling barely perceptible under void
  for (let i = 0; i < 8; i++) {
    const a  = (i/8)*6.28 + t*0.0028 + i*0.38
    const r1 = eR*(0.04+0.05*Math.sin(t*0.09+i*1.8))
    const r2 = eR*(0.62+0.16*Math.sin(t*0.11+i*2.4))
    const cm = eR*(0.28+0.12*Math.cos(t*0.07+i*1.3))
    const al = 0.018+0.028*Math.abs(Math.sin(t*0.13+i*1.65))
    ctx.beginPath()
    ctx.moveTo(Math.cos(a)*r1, Math.sin(a)*r1)
    ctx.bezierCurveTo(
      Math.cos(a+0.28)*cm,          Math.sin(a+0.28)*cm,
      Math.cos(a+0.55)*(r2*0.75),   Math.sin(a+0.55)*(r2*0.75),
      Math.cos(a+0.82)*r2,          Math.sin(a+0.82)*r2
    )
    ctx.strokeStyle = `rgba(88,30,185,${al})`
    ctx.lineWidth   = 0.9
    ctx.shadowColor = 'rgba(100,40,220,0.18)'
    ctx.shadowBlur  = 6; ctx.stroke()
  }
  // Ghost inner structure ring — faint circular resonance echo
  ctx.beginPath(); ctx.arc(0, 0, eR*0.38+eR*0.018*Math.sin(t*0.34), 0, 6.28)
  ctx.strokeStyle = `rgba(60,20,140,${0.028+0.016*Math.sin(t*0.44)})`
  ctx.lineWidth = 0.6; ctx.shadowBlur = 0; ctx.stroke()
  ctx.restore(); ctx.shadowBlur = 0
}

// ── 6. Corona — hot glowing eclipse edge, breathing ──────────────────────────
function drawCorona(ctx, cx, cy, eR, t, isAlert, isError) {
  ctx.save()
  const breath = 0.88+0.12*Math.sin(t*0.55)

  // Outermost wide halo
  ctx.beginPath(); ctx.arc(cx, cy, eR*1.18, 0, 6.28)
  ctx.strokeStyle = `rgba(${isAlert?'160,40,200':'55,20,155'},${(0.15+0.05*Math.sin(t*0.42))*breath})`
  ctx.lineWidth = 42; ctx.shadowColor = isAlert?'#A028C8':'#360E90'; ctx.shadowBlur = 55
  ctx.globalAlpha = 1; ctx.stroke()

  // Middle purple halo
  ctx.beginPath(); ctx.arc(cx, cy, eR*1.10, 0, 6.28)
  ctx.strokeStyle = `rgba(${isAlert?'205,75,238':'92,48,208'},${(0.28+0.09*Math.sin(t*0.50))*breath})`
  ctx.lineWidth = 26; ctx.shadowColor = isAlert?'#C240E2':'#4820A8'; ctx.shadowBlur = 40
  ctx.globalAlpha = 1; ctx.stroke()

  // Inner medium ring
  ctx.beginPath(); ctx.arc(cx, cy, eR*0.995, 0, 6.28)
  ctx.strokeStyle = `rgba(${isAlert?'238,112,255':'192,146,255'},${(0.55+0.17*Math.sin(t*0.65))*breath})`
  ctx.lineWidth = 10; ctx.shadowColor = isAlert?'#DE60FF':'#B87AFF'; ctx.shadowBlur = 22; ctx.stroke()

  // Bright hot edge
  const ca = (0.90+0.10*Math.sin(t*1.05))*breath
  ctx.beginPath(); ctx.arc(cx, cy, eR, 0, 6.28)
  ctx.strokeStyle = isAlert?`rgba(255,155,255,${ca})`:isError?`rgba(222,88,88,${ca})`:`rgba(252,228,255,${ca})`
  ctx.lineWidth = 2.6
  ctx.shadowColor = isAlert?'#FF95FF':isError?'#FF2060':'#FAE8FF'
  ctx.shadowBlur = 55+20*Math.sin(t*0.75); ctx.stroke()

  // Ultra-thin inner accent
  ctx.beginPath(); ctx.arc(cx, cy, eR*0.977, 0, 6.28)
  ctx.strokeStyle = isAlert?`rgba(252,115,255,${ca*0.65})`:isError?`rgba(200,62,65,${ca*0.65})`:`rgba(215,168,255,${ca*0.65})`
  ctx.lineWidth = 1.1; ctx.shadowColor = isAlert?'#FF75FF':isError?'#CC1545':'#D2AAFF'
  ctx.shadowBlur = 18; ctx.stroke()

  // Uneven energy distribution — instability arcs flickering around rim
  ctx.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const baseA = (i / 8) * 6.28 + Math.sin(i * 2.7) * 0.22
    const span  = 0.12 + 0.24 * Math.abs(Math.sin(i * 3.1))
    const flick = Math.abs(Math.sin(t * (1.8 + (i%4)*0.7) + i * 2.618))
    const iOp   = (0.30 + 0.45 * Math.abs(Math.sin(i * 1.9 + 0.8))) * flick * breath
    if (iOp < 0.04) continue
    ctx.beginPath()
    ctx.arc(cx, cy, eR * (0.998 + flick * 0.006), baseA, baseA + span)
    ctx.strokeStyle = isAlert
      ? `rgba(255,148,255,${iOp})`
      : isError
        ? `rgba(220,90,90,${iOp})`
        : `rgba(248,222,255,${iOp})`
    ctx.lineWidth   = 1.2 + 3.5 * flick
    ctx.shadowColor = isAlert ? '#FF90FF' : isError ? '#FF3060' : '#F5DEFF'
    ctx.shadowBlur  = 12 * flick; ctx.stroke()
  }
  ctx.lineCap = 'butt'

  ctx.restore()
}

// ── 7. Glitch shimmer — rare corona distortion ────────────────────────────────
function drawGlitchShimmer(ctx, cx, cy, eR, t) {
  const beat     = Math.floor(t * 3.5)
  const glitchV  = Math.abs(Math.sin(beat * 2.618 + 1.3))
  if (glitchV < 0.84) return

  const intensity = (glitchV - 0.84) / 0.16
  const arcStart  = (beat * 1.618) % 6.28
  const arcLen    = 0.12 + 0.28 * Math.abs(Math.sin(beat * 1.1))
  const xOff      = (Math.sin(beat * 7.3) * 0.5) * eR * 0.014
  const yOff      = (Math.cos(beat * 5.7) * 0.5) * eR * 0.008

  ctx.save()
  ctx.translate(cx + xOff, cy + yOff)

  // Primary glitch arc
  ctx.beginPath(); ctx.arc(0, 0, eR * (0.98 + Math.sin(beat * 3.1) * 0.012), arcStart, arcStart + arcLen)
  ctx.strokeStyle = `rgba(255,190,255,${0.55 * intensity})`
  ctx.lineWidth   = 2.2 + 2.5 * intensity
  ctx.shadowColor = '#FF80FF'; ctx.shadowBlur = 22 * intensity
  ctx.globalAlpha = 1; ctx.stroke()

  // Offset echo arc
  ctx.beginPath(); ctx.arc(xOff * 2, yOff * 2, eR * 0.994, arcStart + 0.04, arcStart + arcLen * 0.7)
  ctx.strokeStyle = `rgba(220,140,255,${0.25 * intensity})`
  ctx.lineWidth   = 1.0; ctx.shadowBlur = 8 * intensity; ctx.stroke()

  ctx.restore(); ctx.shadowBlur = 0
}

// ── 8. Structural rings — containment geometry around eclipse ─────────────────
function drawStructuralRings(ctx, cx, cy, eR, t, isAlert, isError) {
  const [r,g,b] = isAlert ? [205,75,238] : isError ? [200,55,80] : [138,88,255]

  ctx.save(); ctx.translate(cx, cy)

  // S1a: Tight inner solid ring just outside eclipse
  ctx.beginPath(); ctx.arc(0, 0, eR * 1.012, 0, 6.28)
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.24+0.07*Math.sin(t*0.55)})`
  ctx.lineWidth = 0.85; ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.stroke()

  // S1b: Thin parallel ring — creates a subtle double-ring boundary
  ctx.beginPath(); ctx.arc(0, 0, eR * 1.036, 0, 6.28)
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.11+0.04*Math.sin(t*0.55+0.9)})`
  ctx.lineWidth = 0.45; ctx.stroke()

  // S2: Tick-mark ring — 72 ticks with 4-level hierarchy (cardinal/octant/major/fine)
  const tickRm = eR * 1.062
  for (let i = 0; i < 72; i++) {
    const a      = (i / 72) * 6.28
    const isCard = i % 18 === 0              // 0/90/180/270°
    const isOct  = i % 9 === 0 && !isCard   // 45/135/225/315°
    const isMaj  = i % 6 === 0 && !isCard && !isOct  // every 30°
    const isMed  = i % 3 === 0 && !isMaj && !isCard && !isOct  // every 15°
    const len    = isCard ? eR*0.033 : isOct ? eR*0.022 : isMaj ? eR*0.016 : isMed ? eR*0.009 : eR*0.005
    const op     = isCard ? 0.78 : isOct ? 0.54 : isMaj ? 0.40 : isMed ? 0.22 : 0.12
    const lw     = isCard ? 1.3 : isOct ? 0.90 : isMaj ? 0.65 : 0.38
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * (tickRm - len*0.6), Math.sin(a) * (tickRm - len*0.6))
    ctx.lineTo(Math.cos(a) * (tickRm + len*0.4), Math.sin(a) * (tickRm + len*0.4))
    ctx.strokeStyle = `rgba(${r},${g},${b},${op})`; ctx.lineWidth = lw; ctx.stroke()
  }

  // Cardinal crosshairs (N/S/E/W) — extended T-bar marks
  for (let i = 0; i < 4; i++) {
    const a   = (i / 4) * 6.28
    const x1  = Math.cos(a)*(tickRm-eR*0.030), y1 = Math.sin(a)*(tickRm-eR*0.030)
    const x2  = Math.cos(a)*(tickRm+eR*0.025), y2 = Math.sin(a)*(tickRm+eR*0.025)
    const pxp = Math.cos(a+Math.PI/2)*eR*0.013, pyp = Math.sin(a+Math.PI/2)*eR*0.013
    ctx.strokeStyle = `rgba(${r},${g},${b},0.70)`; ctx.lineWidth = 1.0
    ctx.shadowColor = `rgba(${r},${g},${b},0.65)`; ctx.shadowBlur = 6
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x1-pxp,y1-pyp); ctx.lineTo(x1+pxp,y1+pyp); ctx.stroke()
    ctx.shadowBlur = 0
  }

  // S3a: Dense segmented arc ring — 60 segs, opacity pulses per segment
  const segRm = eR * 1.120
  for (let i = 0; i < 60; i++) {
    const a0  = (i / 60) * 6.28
    const gap = 0.38 + 0.14 * Math.abs(Math.sin(i * 2.72))  // uneven gaps
    const a1  = ((i + gap) / 60) * 6.28
    const op  = 0.18 + 0.10 * Math.abs(Math.sin(i * 2.1 + t * 0.055))
    ctx.beginPath(); ctx.arc(0, 0, segRm, a0, a1)
    ctx.strokeStyle = `rgba(${r},${g},${b},${op})`; ctx.lineWidth = 0.60; ctx.stroke()
  }

  // S3b: Secondary sparse arc ring — wider gap rhythm, different visual frequency
  const seg2Rm = eR * 1.185
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * 6.28
    const a1 = ((i + 0.52) / 24) * 6.28
    const op = 0.10 + 0.06 * Math.abs(Math.sin(i * 1.7 + t * 0.038))
    ctx.beginPath(); ctx.arc(0, 0, seg2Rm, a0, a1)
    ctx.strokeStyle = `rgba(${r},${g},${b},${op})`; ctx.lineWidth = 0.40; ctx.stroke()
  }

  // S3c: Very sparse inter-ring marker ring — layered geometry between rune rings
  const sparseRm = eR * 1.355
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * 6.28
    const a1 = ((i + 0.28) / 16) * 6.28
    const op = 0.08 + 0.05 * Math.abs(Math.sin(i * 1.38 + t * 0.028))
    ctx.beginPath(); ctx.arc(0, 0, sparseRm, a0, a1)
    ctx.strokeStyle = `rgba(${r},${g},${b},${op})`; ctx.lineWidth = 0.35; ctx.stroke()
  }

  // S4: Breathing ring — subtle radial pulse
  const brth4 = 0.84 + 0.16 * Math.sin(t * 0.55)
  ctx.beginPath(); ctx.arc(0, 0, eR * 1.590 * (0.995+0.005*Math.sin(t*0.55)), 0, 6.28)
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.17 * brth4})`
  ctx.lineWidth   = 0.68; ctx.shadowColor = `rgba(${r},${g},${b},0.38)`
  ctx.shadowBlur  = 5; ctx.stroke(); ctx.shadowBlur = 0

  // S4b: Far atmospheric ring — between rune ring 2 and ghost ring 1
  ctx.beginPath(); ctx.arc(0, 0, eR * 1.820, 0, 6.28)
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.08+0.04*Math.sin(t*0.36)})`
  ctx.lineWidth   = 0.38; ctx.stroke()

  // S5: Outer dashed ring
  const dashUnit = eR * 0.025
  ctx.setLineDash([dashUnit, dashUnit * 0.72])
  ctx.beginPath(); ctx.arc(0, 0, eR * 1.940, 0, 6.28)
  ctx.strokeStyle = `rgba(${r},${g},${b},0.10)`
  ctx.lineWidth   = 0.40; ctx.stroke()
  ctx.setLineDash([])

  // Principal diamonds — 4 at 45° octant positions (large)
  for (let i = 0; i < 4; i++) {
    const a  = (i / 4) * 6.28 + Math.PI * 0.25
    const dm = eR * 1.062
    const dx = Math.cos(a) * dm, dy = Math.sin(a) * dm
    const ds = eR * 0.015
    ctx.strokeStyle = `rgba(${r},${g},${b},0.52)`; ctx.lineWidth = 0.80
    ctx.shadowColor = `rgba(${r},${g},${b},0.55)`; ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.moveTo(dx,dy-ds*1.5); ctx.lineTo(dx+ds,dy)
    ctx.lineTo(dx,dy+ds*1.5); ctx.lineTo(dx-ds,dy)
    ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0
  }

  // Secondary diamonds — 4 at 22.5° positions (small, dim)
  for (let i = 0; i < 4; i++) {
    const a  = (i / 4) * 6.28 + Math.PI * 0.125
    const dm = eR * 1.062
    const dx = Math.cos(a) * dm, dy = Math.sin(a) * dm
    const ds = eR * 0.009
    ctx.strokeStyle = `rgba(${r},${g},${b},0.28)`; ctx.lineWidth = 0.42
    ctx.beginPath()
    ctx.moveTo(dx,dy-ds*1.5); ctx.lineTo(dx+ds,dy)
    ctx.lineTo(dx,dy+ds*1.5); ctx.lineTo(dx-ds,dy)
    ctx.closePath(); ctx.stroke()
  }

  // S6: Deep void boundary ring — first ghost at cosmic scale
  ctx.beginPath(); ctx.arc(0, 0, eR * 2.66, 0, 6.28)
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.05+0.02*Math.sin(t*0.22)})`
  ctx.lineWidth = 0.28; ctx.stroke()

  // S7: Outermost containment ghost — barely visible edge suggesting infinite scale
  const dashU2 = eR * 0.038
  ctx.setLineDash([dashU2, dashU2 * 1.3])
  ctx.beginPath(); ctx.arc(0, 0, eR * 3.18, 0, 6.28)
  ctx.strokeStyle = `rgba(${r},${g},${b},0.028)`
  ctx.lineWidth = 0.22; ctx.stroke()
  ctx.setLineDash([])

  ctx.restore()
}

// ── 9. Rune rings — 3 main + 2 ghost outer ───────────────────────────────────
// orient: 'tangential' = glyph base follows ring curve
//         'radial'     = glyph points outward from center (upright on ring)
function drawRuneRings(ctx, cx, cy, eR, t, isAlert, rotations) {
  const RINGS = [
    // Dense inner ring — tangential (text-on-ring feel, 22 closely spaced)
    { rm:1.230, count:22, szR:0.038, col:isAlert?[255,108,255]:[184,136,255], op:0.82, ghost:false, orient:'tangential' },
    // Middle ring — radial (glyphs stand outward, 16 glyphs)
    { rm:1.490, count:16, szR:0.048, col:isAlert?[232,82,242] :[155,102,255], op:0.74, ghost:false, orient:'radial'     },
    // Outer sacred markers — radial + targeting brackets, 11 glyphs
    { rm:1.730, count:11, szR:0.056, col:isAlert?[255,125,255]:[206,158,255], op:0.68, ghost:false, orient:'radial'     },
    // Ghost rings — far beyond screen edge
    { rm:2.100, count: 8, szR:0.038, col:isAlert?[255,140,255]:[175,130,255], op:0.18, ghost:true,  orient:'radial'     },
    { rm:2.580, count: 5, szR:0.034, col:isAlert?[255,148,255]:[162,122,255], op:0.09, ghost:true,  orient:'radial'     },
  ]

  RINGS.forEach((ring, ri) => {
    const radius = eR * ring.rm
    const [r,g,b] = ring.col
    // Ghost rings: independent direction + slow multiplier → 145s / 230s periods
    const rot = ri < 3 ? rotations[ri]
      : ri === 3 ? -rotations[0] * 0.65
      : rotations[2] * 0.52
    const sz = ring.szR * eR

    ctx.save(); ctx.translate(cx, cy)

    // ── Guide circle ──────────────────────────────────────────────────────────
    if (ring.ghost) {
      for (let seg = 0; seg < 5; seg++) {
        const sa0 = (seg/5)*6.28 + rot*0.5 + seg*0.18
        const sa1 = sa0 + 0.65 + 0.45*Math.abs(Math.sin(seg*1.7+t*0.04))
        ctx.beginPath(); ctx.arc(0, 0, radius, sa0, sa1)
        ctx.strokeStyle = `rgba(${r},${g},${b},${ring.op*0.40})`
        ctx.lineWidth = 0.30; ctx.shadowColor = `rgba(${r},${g},${b},0.28)`
        ctx.shadowBlur = 3; ctx.globalAlpha = 1; ctx.stroke()
      }
    } else {
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, 6.28)
      ctx.strokeStyle = `rgba(${r},${g},${b},${ring.op * 0.28})`
      ctx.lineWidth = 0.50; ctx.shadowColor = `rgba(${r},${g},${b},0.35)`
      ctx.shadowBlur = 5; ctx.globalAlpha = 1; ctx.stroke()
      ctx.shadowBlur = 0
    }

    // ── Midpoint connector dots between every glyph slot (inner ring) ────────
    if (ri === 0 && !ring.ghost) {
      for (let i = 0; i < ring.count; i++) {
        const midA = ((i + 0.5) / ring.count) * 6.28 + rot
        const dAl  = (ring.op * 0.28) * (0.7 + 0.3 * Math.abs(Math.sin(t*0.15+i*0.8)))
        ctx.fillStyle = `rgba(${r},${g},${b},${dAl})`
        ctx.shadowColor = `rgba(${r},${g},${b},0.5)`; ctx.shadowBlur = 3
        ctx.beginPath(); ctx.arc(Math.cos(midA)*radius, Math.sin(midA)*radius, sz*0.09, 0, 6.28); ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    // ── Radial tick sub-marks on middle ring ─────────────────────────────────
    if (ri === 1 && !ring.ghost) {
      const ticksPerSlot = 3
      const totalTicks   = ring.count * ticksPerSlot
      for (let ti = 0; ti < totalTicks; ti++) {
        const ta    = (ti / totalTicks) * 6.28 + rot
        const major = ti % ticksPerSlot === 0
        const tLen  = major ? sz*0.22 : sz*0.11
        const tOp   = major ? ring.op*0.22 : ring.op*0.10
        ctx.beginPath()
        ctx.moveTo(Math.cos(ta)*radius,         Math.sin(ta)*radius)
        ctx.lineTo(Math.cos(ta)*(radius+tLen),  Math.sin(ta)*(radius+tLen))
        ctx.strokeStyle = `rgba(${r},${g},${b},${tOp})`
        ctx.lineWidth = major ? 0.45 : 0.28; ctx.stroke()
      }
    }

    // ── Glyph slots ───────────────────────────────────────────────────────────
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * 6.28 + rot
      const rx    = Math.cos(angle) * radius
      const ry    = Math.sin(angle) * radius

      // Intentional gap — draw tiny diamond marker instead
      const isGap = !ring.ghost && Math.abs(Math.sin(i*3.71+ri*2.13)) < 0.12
      if (isGap) {
        const ds  = sz * 0.20
        const dAl = ring.op * 0.35
        ctx.save(); ctx.translate(rx, ry)
        ctx.strokeStyle = `rgba(${r},${g},${b},${dAl})`; ctx.lineWidth = 0.42; ctx.shadowBlur = 0
        ctx.beginPath()
        ctx.moveTo(0, -ds*1.5); ctx.lineTo(ds, 0); ctx.lineTo(0, ds*1.5); ctx.lineTo(-ds, 0)
        ctx.closePath(); ctx.stroke()
        ctx.restore()
        continue
      }

      const breathe = 0.25 + 0.75 * Math.abs(Math.sin(t*0.18 + i*0.40 + ri*0.88))
      const alpha   = ring.op * breathe

      ctx.save()
      ctx.translate(rx, ry)

      // Orientation: tangential wraps glyph along ring curve; radial stands upright
      ctx.rotate(ring.orient === 'tangential' ? angle + Math.PI*0.5 : angle)

      // ── Targeting brackets around outer sacred ring glyphs ────────────────
      if (ri === 2) {
        const bs  = sz * 1.60, arm = bs * 0.38
        const bAl = ring.op * 0.24
        ctx.strokeStyle = `rgba(${r},${g},${b},${bAl})`; ctx.lineWidth = 0.38; ctx.shadowBlur = 0
        ctx.beginPath(); ctx.moveTo(-bs,-bs+arm); ctx.lineTo(-bs,-bs); ctx.lineTo(-bs+arm,-bs); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bs-arm,-bs);  ctx.lineTo(bs,-bs);  ctx.lineTo(bs,-bs+arm);  ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-bs,bs-arm);  ctx.lineTo(-bs,bs);  ctx.lineTo(-bs+arm,bs);  ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bs-arm,bs);   ctx.lineTo(bs,bs);   ctx.lineTo(bs,bs-arm);   ctx.stroke()
        // Alignment dots above and below each outer glyph
        ctx.fillStyle = `rgba(${r},${g},${b},${bAl*0.75})`
        ctx.beginPath(); ctx.arc(0, -sz*1.18, sz*0.07, 0, 6.28); ctx.fill()
        ctx.beginPath(); ctx.arc(0,  sz*1.18, sz*0.07, 0, 6.28); ctx.fill()
      }

      // ── Radial indicator line beneath middle ring glyphs ─────────────────
      if (ri === 1) {
        const lLen = sz * 0.45
        ctx.strokeStyle = `rgba(${r},${g},${b},${ring.op*0.18})`; ctx.lineWidth = 0.35; ctx.shadowBlur = 0
        ctx.beginPath(); ctx.moveTo(0, sz*0.65); ctx.lineTo(0, sz*0.65+lLen); ctx.stroke()
        ctx.beginPath(); ctx.arc(0, sz*0.65+lLen, sz*0.05, 0, 6.28)
        ctx.fillStyle = `rgba(${r},${g},${b},${ring.op*0.22})`; ctx.fill()
      }

      // ── Draw glyph ────────────────────────────────────────────────────────
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.fillStyle   = `rgba(${r},${g},${b},${alpha})`
      ctx.lineWidth   = ring.ghost ? 0.55 : (ri === 2 ? 0.88 : 0.80)
      ctx.lineJoin    = 'round'; ctx.lineCap = 'round'
      ctx.shadowColor = `rgba(${r},${g},${b},${ring.ghost ? 0.40 : 0.72})`
      ctx.shadowBlur  = ring.ghost ? 4 : (ri === 2 ? 11 : 8)
      ctx.globalAlpha = 1
      RUNES[(i*7 + ri*13) % RUNES.length](ctx, sz * (ring.ghost ? 1.12 : 1.0))

      ctx.restore()
    }

    ctx.restore()
  })
}

// ── 11. Atmospheric fog — drifts over runes/eyes ─────────────────────────────
function drawAtmosphericFog(ctx, cx, cy, eR, t) {
  const PATCHES = [
    {rm:1.32,sp:0.014,sz:0.60,al:0.22,ph:0.0},{rm:1.56,sp:-0.010,sz:0.50,al:0.18,ph:2.1},
    {rm:1.72,sp:0.012,sz:0.54,al:0.15,ph:4.4},{rm:1.22,sp:-0.016,sz:0.45,al:0.20,ph:1.3},
    {rm:1.85,sp:0.009,sz:0.58,al:0.13,ph:5.8},{rm:1.44,sp:-0.013,sz:0.52,al:0.16,ph:3.1},
    {rm:1.65,sp:0.011,sz:0.46,al:0.14,ph:0.7},
  ]
  PATCHES.forEach(p => {
    const ang = p.sp*t+p.ph, pulse = 0.70+0.30*Math.sin(t*0.35+p.ph)
    const bx  = cx+Math.cos(ang)*eR*p.rm, by = cy+Math.sin(ang)*eR*p.rm, r = eR*p.sz*pulse
    // Slight purple tint (visible on screen blend over dark backdrop)
    const g = ctx.createRadialGradient(bx,by,0,bx,by,r)
    g.addColorStop(0,   `rgba(18,6,38,${p.al*pulse})`)
    g.addColorStop(0.5, `rgba(8,3,18,${p.al*0.5*pulse})`)
    g.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.globalAlpha = 1
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 6.28); ctx.fill()
  })
}

// ── 12. Foreground dust — nearest depth layer ────────────────────────────────
function drawForegroundDust(ctx, cx, cy, eR, t) {
  ctx.shadowBlur = 0
  for (let i = 0; i < 48; i++) {
    const seed  = i*11.42, bA = seed%6.28
    const bR    = eR*(1.14+(i%8)*0.13)
    const angle = bA+t*(0.007+(i%4)*0.0022)*(i%2?1:-1)
    const r     = bR+Math.sin(t*0.44+i*0.7)*eR*0.044
    if (r < eR*1.08) continue
    const al = 0.12+0.28*Math.abs(Math.sin(t*0.90+i*1.1))
    const sz = 0.52+(i%5)*0.26
    ctx.globalAlpha = 1
    ctx.fillStyle   = i%5===0?`rgba(238,205,255,${al})`:`rgba(158,98,255,${al})`
    ctx.shadowColor = '#A278FF'; ctx.shadowBlur = sz>0.68?5:2
    ctx.beginPath(); ctx.arc(cx+Math.cos(angle)*r, cy+Math.sin(angle)*r, sz, 0, 6.28); ctx.fill()
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

// ── 13. HUD/lore overlay — subtle diagnostic text ────────────────────────────
function drawHUDText(ctx, cx, cy, eR, t, state, isAlert, isError) {
  const STATUS = {
    idle:      'SYSTEM  STANDBY',
    speaking:  'NEURAL  LINK  ACTIVE',
    listening: 'SIGNAL  ACQUISITION',
    thinking:  'PROCESSING . . .',
    alert:     'PRIORITY  ALERT',
    error:     'INTEGRITY  BREACH',
  }

  const baseOp  = 0.32 + 0.10 * Math.sin(t * 0.28)
  const textCol = isAlert ? `rgba(230,90,255,${baseOp})` : isError ? `rgba(230,80,100,${baseOp})` : `rgba(168,128,255,${baseOp})`
  const dimCol  = isAlert ? `rgba(160,50,200,${baseOp*0.60})` : `rgba(100,75,185,${baseOp*0.60})`

  ctx.save()
  ctx.textBaseline = 'middle'

  // Primary status — bottom center below eclipse
  ctx.font = '10px "Share Tech Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = textCol
  ctx.shadowColor = isAlert ? '#CC44FF' : isError ? '#CC2255' : '#8844CC'
  ctx.shadowBlur  = 10
  ctx.fillText(STATUS[state] || 'SYSTEM  STANDBY', cx, cy + eR * 1.88)

  // Secondary label
  ctx.font = '7px "Share Tech Mono", monospace'
  ctx.fillStyle = `rgba(${isAlert?'140,50,180':'80,60,155'},${baseOp*0.70})`
  ctx.shadowBlur = 5
  ctx.fillText('N · Y · X', cx, cy + eR * 2.06)

  // Top-right data block
  ctx.textAlign = 'left'
  const tx = cx + eR * 0.78, ty = cy - eR * 1.60
  ctx.font = '7px "Share Tech Mono", monospace'
  ctx.fillStyle = dimCol; ctx.shadowBlur = 4
  ctx.fillText('CORE ID: NYX-01',          tx, ty)
  ctx.fillText('CLASS: HYPER INTELLIGENCE', tx, ty + 14)
  ctx.fillText(`SEC: ${Math.floor(t * 16.67).toString().padStart(6,'0')}`, tx, ty + 28)

  // Top-left data block
  ctx.textAlign = 'right'
  const tx2 = cx - eR * 0.78
  ctx.fillText(`ΔE: ${(0.9918 + 0.0014 * Math.sin(t * 0.22)).toFixed(4)}`, tx2, ty)
  ctx.fillText('Φ: 3.14159...', tx2, ty + 14)
  ctx.fillText(`Θ: ${((t * 5.73) % 360).toFixed(1)}°`, tx2, ty + 28)

  // Small crosshair at bottom-left and bottom-right of eclipse area
  ctx.strokeStyle = dimCol; ctx.lineWidth = 0.6; ctx.shadowBlur = 3
  const chR = eR * 1.45, chSz = eR * 0.018
  for (let i = 0; i < 2; i++) {
    const sign = i === 0 ? -1 : 1
    const chx  = cx + sign * chR * 0.72, chy = cy + eR * 1.22
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(80,60,140,${baseOp*0.40})`
    ctx.font = '6px "Share Tech Mono", monospace'
    ctx.fillText(i === 0 ? '◈ A' : 'B ◈', chx, chy + chSz * 3)
    ctx.beginPath()
    ctx.moveTo(chx - chSz, chy); ctx.lineTo(chx + chSz, chy); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(chx, chy - chSz); ctx.lineTo(chx, chy + chSz); ctx.stroke()
    ctx.beginPath(); ctx.arc(chx, chy, chSz * 0.6, 0, 6.28); ctx.stroke()
  }

  ctx.restore()
}

// ── State effects ─────────────────────────────────────────────────────────────
function drawSpeakingPulses(ctx, cx, cy, eR, t) {
  for (let i = 0; i < 5; i++) {
    const ph = ((t*2.6+i*0.62)%2.2), pR = eR*(1.0+ph*0.65), pA = Math.max(0,0.40-ph*0.18)
    ctx.beginPath(); ctx.arc(cx, cy, pR, 0, 6.28)
    ctx.strokeStyle = `rgba(185,120,255,${pA})`; ctx.shadowColor = '#B875FF'
    ctx.shadowBlur = 14+ph*12; ctx.lineWidth = Math.max(0.1,1.6-ph*0.65); ctx.globalAlpha = 1; ctx.stroke()
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

function drawListeningPulses(ctx, cx, cy, eR, t) {
  for (let i = 0; i < 3; i++) {
    const ph = ((t*3.8+i*0.9)%2.2), pR = eR*(1.0+ph*0.20), pA = Math.max(0,0.44-ph*0.19)
    ctx.beginPath(); ctx.arc(cx, cy, pR, 0, 6.28)
    ctx.strokeStyle = `rgba(120,185,255,${pA})`; ctx.shadowColor = '#82AAFF'
    ctx.shadowBlur = 16+ph*12; ctx.lineWidth = Math.max(0.1,1.5-ph*0.58); ctx.globalAlpha = 1; ctx.stroke()
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

function drawThinkingSpiral(ctx, cx, cy, eR, t) {
  // Particles spiral inward from outer atmosphere to eclipse rim
  for (let i = 0; i < 28; i++) {
    const lifetime  = 3.2
    const phase     = (t * 1.6 + i * (lifetime / 28)) % lifetime
    const frac      = phase / lifetime
    const startR    = eR * 1.88
    const endR      = eR * 1.02
    const r         = startR - (startR - endR) * frac
    const baseAngle = (i / 28) * 6.28
    const spiral    = frac * 2.8
    const angle     = baseAngle + spiral - t * 1.0
    const alpha     = Math.sin(frac * Math.PI) * 0.80
    const sz        = 1.8 + 2.5 * (1 - frac)
    ctx.globalAlpha = 1
    ctx.fillStyle = `rgba(195,150,255,${alpha})`
    ctx.shadowColor = '#C070FF'; ctx.shadowBlur = 10 * alpha
    ctx.beginPath()
    ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, sz, 0, 6.28)
    ctx.fill()
  }
  // Rotating inner beam
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 2.2)
  const beam = ctx.createLinearGradient(-eR * 0.7, 0, eR * 0.7, 0)
  beam.addColorStop(0, 'rgba(130,80,255,0)')
  beam.addColorStop(0.5, 'rgba(190,140,255,0.18)')
  beam.addColorStop(1, 'rgba(130,80,255,0)')
  ctx.fillStyle = beam; ctx.globalAlpha = 1; ctx.fillRect(-eR * 0.7, -1.0, eR * 1.4, 2.0)
  ctx.restore()
  ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

function drawAlertFlares(ctx, cx, cy, eR, t) {
  ctx.save(); ctx.translate(cx, cy)
  for (let i = 0; i < 8; i++) {
    const baseA = (i/8)*6.28+t*0.35
    const fLen  = eR*(0.15+0.20*Math.abs(Math.sin(t*3.5+i*1.8)))
    const fAl   = 0.55+0.40*Math.abs(Math.sin(t*4.2+i*2.2))
    ctx.beginPath(); ctx.moveTo(Math.cos(baseA)*eR,Math.sin(baseA)*eR)
    ctx.lineTo(Math.cos(baseA)*(eR+fLen),Math.sin(baseA)*(eR+fLen))
    ctx.strokeStyle=`rgba(255,140,255,${fAl})`; ctx.lineWidth=1.0+fAl
    ctx.shadowColor='#FF80FF'; ctx.shadowBlur=18; ctx.globalAlpha=1; ctx.stroke()
  }
  ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

function drawErrorCracks(ctx, cx, cy, eR, t) {
  ctx.save(); ctx.translate(cx, cy)
  const ef = Math.abs(Math.sin(t*8))
  for (let i = 0; i < 6; i++) {
    const baseA  = (i/6)*6.28+i*0.55
    const crackL = eR*(0.10+0.18*Math.abs(Math.sin(t*5+i*2.1)))
    const x0=Math.cos(baseA)*eR*.94, y0=Math.sin(baseA)*eR*.94
    const mx=Math.cos(baseA+0.12)*(eR*.94+crackL*.5), my=Math.sin(baseA+0.12)*(eR*.94+crackL*.5)
    const x1=Math.cos(baseA-0.06)*(eR*.94+crackL),    y1=Math.sin(baseA-0.06)*(eR*.94+crackL)
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,x1,y1)
    ctx.strokeStyle=`rgba(255,30,70,${0.45+ef*0.45})`; ctx.lineWidth=0.8+ef*0.8
    ctx.shadowColor='#FF1050'; ctx.shadowBlur=10+ef*14; ctx.globalAlpha=1; ctx.stroke()
  }
  ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NyxIdleOrb({ w, h, state = 'idle' }) {
  const canvasRef  = useRef(null)
  const animRef    = useRef(null)
  const timeRef    = useRef(0)
  const stateRef   = useRef(state)
  const ringRotRef = useRef([0, 0, 0])

  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')

    const draw = () => {
      const t   = timeRef.current, s = stateRef.current
      const cx  = w / 2, cy = h / 2

      const isAlert    = s === 'alert',    isError     = s === 'error'
      const isSpeaking = s === 'speaking', isListening = s === 'listening'
      const isThinking = s === 'thinking'

      const sm = isThinking ? 2.2 : isSpeaking ? 1.7 : isListening ? 1.4 : isError ? 0.6 : 1.0
      timeRef.current += 0.016 * sm

      ctx.clearRect(0, 0, w, h)

      const eR     = Math.min(w, h) * 0.350
      // Idle: ~95s / ~68s / ~120s period. Active states multiply speed.
      const rSpeed = isThinking ? 3.0 : isSpeaking ? 2.0 : isAlert ? 1.8 : 1.0
      ringRotRef.current[0] += 0.00110 * rSpeed   // inner rune ring CW
      ringRotRef.current[1] -= 0.00155 * rSpeed   // middle rune ring CCW
      ringRotRef.current[2] += 0.00088 * rSpeed   // outer rune ring CW

      // Back to front draw order
      drawStars(ctx, w, h, t)
      drawParticles(ctx, cx, cy, eR, t)
      drawNebula(ctx, cx, cy, eR, t, s, isAlert, isError)
      drawCoronaAurora(ctx, cx, cy, eR, t, isAlert, isError, w, h)
      drawVoid(ctx, cx, cy, eR)
      drawVoidDepth(ctx, cx, cy, eR, t)
      drawCorona(ctx, cx, cy, eR, t, isAlert, isError)
      drawGlitchShimmer(ctx, cx, cy, eR, t)
      drawStructuralRings(ctx, cx, cy, eR, t, isAlert, isError)
      drawRuneRings(ctx, cx, cy, eR, t, isAlert, ringRotRef.current)
drawAtmosphericFog(ctx, cx, cy, eR, t)
      drawForegroundDust(ctx, cx, cy, eR, t)
      drawHUDText(ctx, cx, cy, eR, t, s, isAlert, isError)

      if (isAlert)     drawAlertFlares(ctx, cx, cy, eR, t)
      if (isError)     drawErrorCracks(ctx, cx, cy, eR, t)
      if (isSpeaking)  drawSpeakingPulses(ctx, cx, cy, eR, t)
      if (isListening) drawListeningPulses(ctx, cx, cy, eR, t)
      if (isThinking)  drawThinkingSpiral(ctx, cx, cy, eR, t)

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [w, h])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        display: 'block',
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  )
}
