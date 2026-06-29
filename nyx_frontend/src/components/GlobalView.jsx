import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'

// ── Constants ──────────────────────────────────────────────────────────────────

const ZOOM_MAP_THRESHOLD = 2.85   // globe scale that triggers map transition
const BASE_SCALE        = 0.375  // R = min(W,H) * BASE_SCALE * scale

// ── Data ──────────────────────────────────────────────────────────────────────

const CITIES = [
  { id: 'nyc', name: 'New York',    lat: 40.7,  lon: -74.0  },
  { id: 'lon', name: 'London',      lat: 51.5,  lon: -0.1   },
  { id: 'tok', name: 'Tokyo',       lat: 35.7,  lon: 139.7  },
  { id: 'syd', name: 'Sydney',      lat: -33.9, lon: 151.2  },
  { id: 'sao', name: 'São Paulo',   lat: -23.5, lon: -46.6  },
  { id: 'mos', name: 'Moscow',      lat: 55.8,  lon: 37.6   },
  { id: 'dub', name: 'Dubai',       lat: 25.2,  lon: 55.3   },
  { id: 'sin', name: 'Singapore',   lat: 1.4,   lon: 103.8  },
  { id: 'lax', name: 'Los Angeles', lat: 34.0,  lon: -118.2 },
  { id: 'ber', name: 'Berlin',      lat: 52.5,  lon: 13.4   },
  { id: 'mum', name: 'Mumbai',      lat: 19.1,  lon: 72.9   },
  { id: 'chi', name: 'Chicago',     lat: 41.9,  lon: -87.6  },
]
const CITY_MAP = Object.fromEntries(CITIES.map(c => [c.id, c]))

const ROUTES = [
  ['nyc','lon'],['lon','ber'],['nyc','lax'],['tok','sin'],
  ['sin','dub'],['dub','lon'],['mos','ber'],['tok','lax'],
  ['sao','nyc'],['syd','sin'],['mum','dub'],['chi','nyc'],
]

const INFRA_NODES = [
  { lat: 37.5, lon: -122.0 }, { lat: 47.6, lon: -122.3 },
  { lat: 50.1, lon:    8.7 }, { lat: 22.3, lon:  114.2 },
  { lat: -33.8, lon: 151.2 },
]

const LANDMASSES = [
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

const DEMO_EVENTS = [
  { id: 1, col: '#7B4DFF', msg: 'Globe renderer initialized' },
  { id: 2, col: '#4D8DFF', msg: 'Demo mode — configure API for live feeds' },
  { id: 3, col: '#A874FF', msg: `${CITIES.length} city nodes loaded` },
  { id: 4, col: '#4D8DFF', msg: `${ROUTES.length} signal routes mapped` },
  { id: 5, col: '#5E587A', msg: 'Threat feeds — not configured' },
]

// ── Globe math ────────────────────────────────────────────────────────────────

function project(lat, lon, rotY, cx, cy, R) {
  const φ = (lat        * Math.PI) / 180
  const λ = ((lon+rotY) * Math.PI) / 180
  return {
    sx: cx + R * Math.cos(φ) * Math.sin(λ),
    sy: cy - R * Math.sin(φ),
    z:  R * Math.cos(φ) * Math.cos(λ),
  }
}

// ── Globe renderer ─────────────────────────────────────────────────────────────
// perf: 'cinematic' | 'balanced' | 'performance'

function drawGlobe(ctx, W, H, rot, scale, layers, hovId, selId, ts, perf) {
  ctx.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H / 2
  const R  = Math.min(W, H) * BASE_SCALE * Math.min(scale, 2.55)
  const isCin  = perf === 'cinematic'
  const isFull = perf !== 'performance'

  // ── Deep space background
  const bg = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy, Math.max(W, H) * 0.85)
  bg.addColorStop(0,   'rgba(10,5,36,1)')
  bg.addColorStop(0.55,'rgba(5,2,18,1)')
  bg.addColorStop(1,   'rgba(2,1,8,1)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // ── Star field (deterministic, GPU-friendly)
  const starCount = isCin ? 90 : isFull ? 55 : 30
  for (let i = 0; i < starCount; i++) {
    const sx  = (Math.sin(i * 137.508 + 13) * 0.5 + 0.5) * W
    const sy  = (Math.sin(i *  94.342 + 71) * 0.5 + 0.5) * H
    const r   = 0.35 + (Math.sin(i * 73.14) * 0.5 + 0.5) * 1.05
    const tw  = 0.08 + (Math.sin(i * 59.7) * 0.5 + 0.5) * 0.32
              + (isCin ? Math.sin(ts * 0.00085 + i * 1.13) * 0.06 : 0)
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(210,190,255,${tw})`
    ctx.fill()
  }

  // ── Multi-layer atmosphere glow
  const atmLayers = isCin
    ? [[1.40, 0, 0.16], [1.24, 0, 0.26], [1.10, 0, 0.14]]
    : [[1.32, 0, 0.20]]
  for (const [rf, , a1] of atmLayers) {
    const atm = ctx.createRadialGradient(cx, cy, R * (rf - 0.14), cx, cy, R * rf)
    atm.addColorStop(0, 'rgba(70,35,190,0)')
    atm.addColorStop(1, `rgba(115,68,248,${a1})`)
    ctx.beginPath()
    ctx.arc(cx, cy, R * rf, 0, Math.PI * 2)
    ctx.fillStyle = atm
    ctx.fill()
  }

  // ── Specular highlight
  if (isCin) {
    const spec = ctx.createRadialGradient(cx - R * 0.30, cy - R * 0.36, 0, cx - R * 0.30, cy - R * 0.36, R * 0.58)
    spec.addColorStop(0, 'rgba(160,120,255,0.11)')
    spec.addColorStop(1, 'rgba(80,40,200,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fillStyle = spec
    ctx.fill()
  }

  // ── Globe sphere base
  const sph = ctx.createRadialGradient(cx - R*0.28, cy - R*0.20, R*0.05, cx, cy, R)
  sph.addColorStop(0,    'rgba(24,12,65,1)')
  sph.addColorStop(0.42, 'rgba(14,7,40,1)')
  sph.addColorStop(0.78, 'rgba(8,4,24,1)')
  sph.addColorStop(1,    'rgba(13,6,38,1)')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = sph
  ctx.fill()

  // ── Clip to globe sphere ────────────────────────────────────────────────────
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2)
  ctx.clip()

  // Continents
  for (const land of LANDMASSES) {
    const pts = land.map(([lt, ln]) => project(lt, ln, rot, cx, cy, R))
    ctx.beginPath()
    let started = false
    for (const p of pts) {
      if (p.z >= 0) {
        if (!started) { ctx.moveTo(p.sx, p.sy); started = true }
        else ctx.lineTo(p.sx, p.sy)
      } else { started = false }
    }
    ctx.closePath()
    ctx.fillStyle   = 'rgba(90,58,195,0.50)'
    ctx.strokeStyle = 'rgba(130,88,250,0.65)'
    ctx.lineWidth   = 0.8
    ctx.fill()
    ctx.stroke()
    if (isFull) {
      ctx.fillStyle = 'rgba(115,75,225,0.10)'
      ctx.fill()
    }
  }

  // Grid lines
  for (let lat = -80; lat <= 80; lat += 20) {
    const isEq = lat === 0
    ctx.strokeStyle = isEq ? 'rgba(105,72,210,0.35)' : 'rgba(72,46,168,0.18)'
    ctx.lineWidth   = isEq ? 1.0 : 0.42
    ctx.beginPath()
    let first = true
    for (let ln = 0; ln <= 360; ln += 3) {
      const p = project(lat, ln, rot, cx, cy, R)
      if (p.z > 0) {
        if (first) { ctx.moveTo(p.sx, p.sy); first = false }
        else ctx.lineTo(p.sx, p.sy)
      } else { first = true }
    }
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(72,46,168,0.18)'
  ctx.lineWidth   = 0.42
  for (let ln = 0; ln < 360; ln += 20) {
    ctx.beginPath()
    let first = true
    for (let lat = -88; lat <= 88; lat += 3) {
      const p = project(lat, ln, rot, cx, cy, R)
      if (p.z > 0) {
        if (first) { ctx.moveTo(p.sx, p.sy); first = false }
        else ctx.lineTo(p.sx, p.sy)
      } else { first = true }
    }
    ctx.stroke()
  }

  // Animated energy band sweeping along latitudes
  if (isFull) {
    const bandLat = ((ts * 0.000280) % 1) * 170 - 85
    for (let ln = 0; ln < 360; ln += 36) {
      for (let dlt = -5; dlt <= 5; dlt++) {
        const p = project(bandLat + dlt, ln, rot, cx, cy, R)
        if (p.z <= 0) continue
        const a = 0.45 * (1 - Math.abs(dlt) / 5.5)
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, 0.7, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(145,95,255,${a})`
        ctx.fill()
      }
    }
  }

  // Radar scan sweep
  if (isCin) {
    const sweepA = (ts * 0.000520) % (Math.PI * 2)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, R, sweepA - 0.32, sweepA, false)
    ctx.closePath()
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
    sg.addColorStop(0, 'rgba(100,60,220,0)')
    sg.addColorStop(0.55, 'rgba(100,60,220,0.04)')
    sg.addColorStop(1, 'rgba(145,95,255,0.13)')
    ctx.fillStyle = sg
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + R * Math.cos(sweepA), cy + R * Math.sin(sweepA))
    ctx.strokeStyle = 'rgba(165,115,255,0.30)'
    ctx.lineWidth   = 1.4
    ctx.stroke()
    ctx.restore()
  }

  // Holographic horizontal scanlines
  if (isCin) {
    const spacing = 4.5
    ctx.beginPath()
    for (let ly = cy - R + spacing; ly < cy + R; ly += spacing) {
      const dx = Math.sqrt(Math.max(0, R * R - (ly - cy) ** 2))
      if (dx > 0) { ctx.moveTo(cx - dx, ly); ctx.lineTo(cx + dx, ly) }
    }
    ctx.strokeStyle = `rgba(140,80,225,${0.022 + Math.sin(ts * 0.00055) * 0.008})`
    ctx.lineWidth   = 0.5
    ctx.stroke()
  }

  ctx.restore() // end globe clip

  // ── Globe edge ring
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(118,82,242,0.68)'
  ctx.lineWidth   = 1.7
  ctx.stroke()

  // Rim glow band (annular gradient outside clip)
  if (isFull) {
    const rim = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.08)
    rim.addColorStop(0,    'rgba(80,50,200,0)')
    rim.addColorStop(0.50, 'rgba(105,62,225,0.20)')
    rim.addColorStop(1,    'rgba(140,85,255,0.42)')
    ctx.beginPath()
    ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2)
    ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2, true)
    ctx.fillStyle = rim
    ctx.fill()
  }

  // ── Orbital decoration ring
  if (isCin) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((ts * 0.000185) % (Math.PI * 2))
    ctx.beginPath()
    ctx.ellipse(0, 0, R * 1.30, R * 0.24, Math.PI * 0.07, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(95,60,198,0.15)'
    ctx.lineWidth   = 0.9
    ctx.setLineDash([4, 9])
    ctx.stroke()
    ctx.setLineDash([])
    // Orbital node
    ctx.beginPath()
    ctx.arc(R * 1.30, 0, 3.2, 0, Math.PI * 2)
    ctx.fillStyle  = 'rgba(145,95,255,0.60)'
    ctx.shadowBlur  = 9
    ctx.shadowColor = '#7B4DFF'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.restore()
  }

  // ── Signal routes with energy trails
  if (layers.signalRoutes) {
    const routeCols = [
      'rgba(75,138,255,0.25)', 'rgba(138,75,255,0.22)',
      'rgba(75,200,195,0.18)', 'rgba(220,120,255,0.20)',
    ]
    for (let ri = 0; ri < ROUTES.length; ri++) {
      const [aid, bid] = ROUTES[ri]
      const a = CITY_MAP[aid], b = CITY_MAP[bid]
      if (!a || !b) continue
      const STEPS = 58
      const LIFT  = 0.28
      const pts   = []
      for (let i = 0; i <= STEPS; i++) {
        const t   = i / STEPS
        const lat = a.lat + (b.lat - a.lat) * t
        const lon = a.lon + (b.lon - a.lon) * t
        const Ri  = R * (1 + LIFT * Math.sin(t * Math.PI))
        const φ   = (lat        * Math.PI) / 180
        const λ   = ((lon + rot) * Math.PI) / 180
        pts.push({
          sx: cx + Ri * Math.cos(φ) * Math.sin(λ),
          sy: cy - Ri * Math.sin(φ),
          z:  Ri * Math.cos(φ) * Math.cos(λ),
        })
      }
      // Base route line
      ctx.strokeStyle = routeCols[ri % routeCols.length]
      ctx.lineWidth   = 0.9
      ctx.setLineDash([3, 7])
      ctx.beginPath()
      let first = true
      for (const p of pts) {
        if (p.z > 0) {
          if (first) { ctx.moveTo(p.sx, p.sy); first = false }
          else ctx.lineTo(p.sx, p.sy)
        } else { first = true }
      }
      ctx.stroke()
      ctx.setLineDash([])
      // Energy packets (2 per route in cinematic mode)
      const pkCount = isFull ? 2 : 1
      for (let pk = 0; pk < pkCount; pk++) {
        const phase = ((ts * 0.000370 + ri * 0.145 + pk * 0.50) % 1)
        const pidx  = Math.floor(phase * STEPS)
        if (pidx >= pts.length || pts[pidx].z <= 8) continue
        const pp = pts[pidx]
        // Fading trail behind packet
        if (isFull) {
          for (let t = 1; t <= 7; t++) {
            const ti = pidx - t
            if (ti < 0 || pts[ti].z <= 0) continue
            const tp = pts[ti]
            ctx.beginPath()
            ctx.arc(tp.sx, tp.sy, 1.4 * (1 - t / 8), 0, Math.PI * 2)
            ctx.fillStyle = `rgba(115,178,255,${0.20 * (1 - t / 8)})`
            ctx.fill()
          }
        }
        ctx.save()
        ctx.beginPath()
        ctx.arc(pp.sx, pp.sy, 2.9, 0, Math.PI * 2)
        ctx.fillStyle  = '#92C8FF'
        ctx.shadowBlur  = 13
        ctx.shadowColor = '#4488FF'
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
      }
    }
  }

  // ── City pulse rings
  if (isCin && layers.cityMarkers) {
    for (let ci = 0; ci < CITIES.length; ci++) {
      const p = project(CITIES[ci].lat, CITIES[ci].lon, rot, cx, cy, R)
      if (p.z <= 0) continue
      const ph  = ((ts * 0.000620 + ci * 0.235) % 1)
      const pr  = ph * 22
      const pa  = (1 - ph) * 0.38
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, pr, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(168,116,255,${pa})`
      ctx.lineWidth   = 1.0
      ctx.stroke()
    }
  }

  // ── Infrastructure hexagonal nodes
  if (layers.networkNodes) {
    for (const nd of INFRA_NODES) {
      const p = project(nd.lat, nd.lon, rot, cx, cy, R)
      if (p.z <= 0) continue
      ctx.save()
      ctx.strokeStyle = 'rgba(168,116,255,0.75)'
      ctx.lineWidth   = 1.4
      ctx.shadowBlur  = 9
      ctx.shadowColor = '#7B4DFF'
      const hr = 5.2
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6
        i === 0 ? ctx.moveTo(p.sx + hr * Math.cos(a), p.sy + hr * Math.sin(a))
                : ctx.lineTo(p.sx + hr * Math.cos(a), p.sy + hr * Math.sin(a))
      }
      ctx.closePath()
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(168,116,255,0.85)'
      ctx.fill()
      ctx.restore()
    }
  }

  // ── City markers
  if (layers.cityMarkers) {
    for (const city of CITIES) {
      const p    = project(city.lat, city.lon, rot, cx, cy, R)
      if (p.z <= 0) continue
      const isHov = hovId === city.id
      const isSel = selId === city.id
      const r = isSel ? 6.2 : isHov ? 5.0 : 3.6

      // Multi-layer glow
      for (const [rM, al] of [[5.2, 0.11], [3.0, 0.22], [1.7, 0.38]]) {
        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * rM)
        g.addColorStop(0, `rgba(168,116,255,${isSel ? al * 2.1 : al})`)
        g.addColorStop(1, 'rgba(100,60,200,0)')
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r * rM, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }
      // Core dot
      ctx.save()
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
      ctx.fillStyle  = isSel ? '#E2CCFF' : isHov ? '#C7A6FF' : '#8E5EFF'
      ctx.shadowBlur  = isSel ? 20 : isHov ? 14 : 9
      ctx.shadowColor = '#6633FF'
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()
      // Outer ring on selected/hovered
      if (isHov || isSel) {
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, r + 4.5, 0, Math.PI * 2)
        ctx.strokeStyle = isSel ? 'rgba(226,204,255,0.55)' : 'rgba(168,116,255,0.38)'
        ctx.lineWidth   = 0.9
        ctx.stroke()
        ctx.save()
        ctx.font      = '700 12px Rajdhani, sans-serif'
        ctx.fillStyle = '#EDE8FF'
        ctx.shadowBlur  = 8
        ctx.shadowColor = 'rgba(120,70,240,0.90)'
        ctx.fillText(city.name, p.sx + r + 6, p.sy + 4)
        ctx.shadowBlur = 0
        ctx.restore()
      }
    }
  }
}

// ── Leaflet tactical map ───────────────────────────────────────────────────────

function MapReadyBridge({ onReady }) {
  const map = useMap()
  useEffect(() => { onReady(map) }, [map, onReady])
  return null
}

function LeafletTactical({ center, initZoom, onMapReady }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        key={`${center.lat.toFixed(3)},${center.lon.toFixed(3)}`}
        center={[center.lat, center.lon]}
        zoom={initZoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        touchZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
          subdomains="abcd"
        />
        <MapReadyBridge onReady={onMapReady} />
      </MapContainer>

      {/* Purple tint + scanlines (pointer-events:none — never block map input) */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'rgba(22,5,65,0.22)', mixBlendMode:'multiply' }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 3px)' }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        boxShadow:'inset 0 0 90px rgba(60,25,180,0.28)' }} />

      {/* Data notice */}
      <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)',
        fontFamily:'Share Tech Mono', fontSize:8, color:'rgba(105,70,210,0.55)',
        letterSpacing:'0.16em', pointerEvents:'none', whiteSpace:'nowrap' }}>
        OPENSTREETMAP · CARTO DARK · DEMO VISUALIZATION
      </div>
    </div>
  )
}

// ── Left navigation ────────────────────────────────────────────────────────────

const NAV_W = 228

const LAYER_ITEMS = [
  { key: 'networkNodes', label: 'Network Nodes', sub: 'Infrastructure nodes' },
  { key: 'signalRoutes', label: 'Signal Routes',  sub: 'Active data paths'   },
  { key: 'cityMarkers',  label: 'City Markers',   sub: 'Known locations'     },
  { key: 'threatFeeds',  label: 'Threat Feeds',   sub: 'Not configured', locked: true },
]

function Toggle({ on, onClick }) {
  return (
    <div onClick={onClick} style={{ width:30, height:15, borderRadius:8, position:'relative', flexShrink:0,
      background: on ? 'rgba(100,60,220,0.55)' : 'rgba(14,9,38,0.80)',
      border:`1px solid ${on ? 'rgba(150,95,255,0.65)' : 'rgba(68,44,158,0.28)'}`,
      cursor:'pointer', transition:'all 0.22s' }}>
      <div style={{ width:11, height:11, borderRadius:'50%', position:'absolute', top:1,
        left: on ? 16 : 1, background: on ? '#C7A6FF' : '#2A2048',
        transition:'all 0.22s', boxShadow: on ? '0 0 7px rgba(168,116,255,0.75)' : 'none' }} />
    </div>
  )
}

function GlobeNav({ layers, onToggle, viewStage, stageLabel, perfMode, onPerfChange, onClose, onBackToGlobe }) {
  return (
    <div style={{ width:NAV_W, flexShrink:0, background:'rgba(4,2,18,0.97)',
      borderRight:'1px solid rgba(100,60,220,0.28)', display:'flex', flexDirection:'column',
      boxShadow:'4px 0 30px rgba(48,24,138,0.16)' }}>

      {/* Header */}
      <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(100,60,220,0.16)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.28em', color:'#423E62', textTransform:'uppercase', marginBottom:3 }}>NYX SYSTEM</div>
            <div style={{ fontFamily:'Rajdhani', fontSize:17, fontWeight:700, letterSpacing:'0.16em', color:'#C7A6FF', textTransform:'uppercase', lineHeight:1 }}>GLOBAL VIEW</div>
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:'1px solid rgba(100,60,220,0.28)', borderRadius:6, width:26, height:26, cursor:'pointer', color:'#5E587A', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(145,92,255,0.55)'; e.currentTarget.style.color='#A874FF' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(100,60,220,0.28)'; e.currentTarget.style.color='#5E587A' }}
          >×</button>
        </div>
      </div>

      {/* View stage + zoom hints */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(100,60,220,0.10)' }}>
        <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.24em', color:'#423E62', textTransform:'uppercase', marginBottom:6 }}>Current Mode</div>
        <div style={{ fontFamily:'Rajdhani', fontSize:13, fontWeight:700, color:'#8B5CFF', letterSpacing:'0.14em' }}>{stageLabel}</div>
        {viewStage === 'globe' && (
          <div style={{ fontFamily:'Share Tech Mono', fontSize:8, color:'#423E62', marginTop:4, letterSpacing:'0.10em' }}>
            SCROLL TO ZOOM · DRAG TO ROTATE
          </div>
        )}
        {viewStage === 'map' && (
          <button onClick={onBackToGlobe} style={{ marginTop:6, fontFamily:'Rajdhani', fontSize:9, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color:'#7B4DFF', background:'none', border:'1px solid rgba(100,60,220,0.28)', borderRadius:5, padding:'4px 8px', cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color='#C7A6FF'; e.currentTarget.style.borderColor='rgba(145,92,255,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#7B4DFF'; e.currentTarget.style.borderColor='rgba(100,60,220,0.28)' }}
          >← BACK TO GLOBE</button>
        )}
      </div>

      {/* Overlay layers */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(100,60,220,0.10)' }}>
        <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.24em', color:'#423E62', textTransform:'uppercase', marginBottom:10 }}>Overlay Layers</div>
        {LAYER_ITEMS.map(item => {
          const on = layers[item.key] && !item.locked
          return (
            <div key={item.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid rgba(68,44,158,0.08)' }}>
              {item.locked
                ? <div style={{ width:30, height:15, borderRadius:8, background:'rgba(10,7,28,0.60)', border:'1px solid rgba(50,35,110,0.22)', flexShrink:0 }} />
                : <Toggle on={on} onClick={() => onToggle(item.key)} />
              }
              <div>
                <div style={{ fontSize:11, color: item.locked ? '#2A2048' : '#9090b8' }}>{item.label}</div>
                <div style={{ fontFamily:'Share Tech Mono', fontSize:8, color: item.locked ? '#2A2048' : '#423E62', marginTop:1 }}>{item.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Performance mode */}
      <div style={{ padding:'10px 16px', flex:1 }}>
        <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.24em', color:'#423E62', textTransform:'uppercase', marginBottom:8 }}>Performance</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {['cinematic','balanced','performance'].map(mode => {
            const active = perfMode === mode
            return (
              <button key={mode} onClick={() => onPerfChange(mode)} style={{ textAlign:'left', padding:'5px 8px', fontFamily:'Rajdhani', fontSize:9, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', background: active ? 'rgba(100,60,220,0.28)' : 'rgba(8,5,26,0.70)', border:`1px solid ${active ? 'rgba(140,90,255,0.50)' : 'rgba(60,38,140,0.20)'}`, borderRadius:5, color: active ? '#C7A6FF' : '#4A4468', cursor:'pointer', transition:'all 0.2s' }}>
                {mode}
              </button>
            )
          })}
        </div>
      </div>

      {/* Status */}
      <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(100,60,220,0.10)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e', flexShrink:0 }} />
          <span style={{ fontFamily:'Share Tech Mono', fontSize:8, color:'#423E62', letterSpacing:'0.12em' }}>RENDERER NOMINAL</span>
        </div>
        <div style={{ fontFamily:'Share Tech Mono', fontSize:7, color:'#2A2048', letterSpacing:'0.10em' }}>DEMO VISUALIZATION ACTIVE</div>
      </div>
    </div>
  )
}

// ── Right panel ────────────────────────────────────────────────────────────────

const RP_W = 244

function GlobeRightPanel({ selectedCity, viewStage, stageLabel }) {
  return (
    <div style={{ width:RP_W, flexShrink:0, background:'rgba(4,2,18,0.97)',
      borderLeft:'1px solid rgba(100,60,220,0.28)', display:'flex', flexDirection:'column',
      boxShadow:'-4px 0 30px rgba(48,24,138,0.16)' }}>

      {/* Selected location */}
      <div style={{ padding:'16px 14px 12px', borderBottom:'1px solid rgba(100,60,220,0.14)' }}>
        <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.24em', color:'#423E62', textTransform:'uppercase', marginBottom:8 }}>Selected Location</div>
        {selectedCity ? (
          <>
            <div style={{ fontFamily:'Rajdhani', fontSize:15, fontWeight:700, color:'#C7A6FF', letterSpacing:'0.10em' }}>{selectedCity.name}</div>
            <div style={{ fontFamily:'Share Tech Mono', fontSize:9, color:'#5E587A', marginTop:4 }}>
              {Math.abs(selectedCity.lat).toFixed(2)}°{selectedCity.lat >= 0 ? 'N' : 'S'}&nbsp;&nbsp;
              {Math.abs(selectedCity.lon).toFixed(2)}°{selectedCity.lon >= 0 ? 'E' : 'W'}
            </div>
            {selectedCity && (
              <div style={{ fontFamily:'Share Tech Mono', fontSize:8, color:'#4A4468', marginTop:3, letterSpacing:'0.10em' }}>
                {viewStage === 'map' ? 'TACTICAL MAP ACTIVE' : 'SCROLL TO ZOOM INTO MAP'}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontFamily:'Share Tech Mono', fontSize:8, color:'#2A2048', letterSpacing:'0.12em' }}>
            {viewStage === 'globe' ? 'CLICK GLOBE TO SELECT' : 'MAP MODE ACTIVE'}
          </div>
        )}
      </div>

      {/* View mode */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(100,60,220,0.10)' }}>
        <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.24em', color:'#423E62', textTransform:'uppercase', marginBottom:6 }}>Mode</div>
        <div style={{ fontFamily:'Rajdhani', fontSize:12, fontWeight:600, color:'#7B60FF', letterSpacing:'0.14em' }}>{stageLabel}</div>
        <div style={{ fontFamily:'Share Tech Mono', fontSize:8, color:'#2A2048', marginTop:3, letterSpacing:'0.10em' }}>
          {viewStage === 'globe' ? 'Canvas · Orthographic' : 'OpenStreetMap · CartoDB Dark'}
        </div>
      </div>

      {/* Data feeds */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(100,60,220,0.10)' }}>
        <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.24em', color:'#423E62', textTransform:'uppercase', marginBottom:8 }}>Data Feeds</div>
        {[
          ['Live Traffic',   'NOT CONFIGURED'],
          ['Weather Layer',  'NOT CONFIGURED'],
          ['Threat Intel',   'NOT CONFIGURED'],
          ['CartoDB Tiles',  'ACTIVE'],
        ].map(([name, status]) => (
          <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
            <span style={{ fontSize:10, color:'#5E587A' }}>{name}</span>
            <span style={{ fontFamily:'Share Tech Mono', fontSize:8, color: status === 'ACTIVE' ? '#22c55e' : '#2A2048', letterSpacing:'0.08em' }}>{status}</span>
          </div>
        ))}
      </div>

      {/* System events */}
      <div style={{ padding:'10px 14px', flex:1, overflowY:'auto' }}>
        <div style={{ fontFamily:'Rajdhani', fontSize:8, fontWeight:600, letterSpacing:'0.24em', color:'#423E62', textTransform:'uppercase', marginBottom:8 }}>System Events</div>
        {DEMO_EVENTS.map(ev => (
          <div key={ev.id} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'5px 0', borderBottom:'1px solid rgba(68,44,158,0.07)' }}>
            <div style={{ width:3, height:3, borderRadius:'50%', background:ev.col, marginTop:5, flexShrink:0, boxShadow:`0 0 4px ${ev.col}` }} />
            <div style={{ fontSize:10, color:'#6868a0', lineHeight:1.45 }}>{ev.msg}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Bottom bar ────────────────────────────────────────────────────────────────

function GlobeBottomBar({ onClose, onBackToGlobe, selectedCity, viewStage }) {
  const [cmd, setCmd] = useState('')
  return (
    <div style={{ height:52, flexShrink:0, background:'rgba(4,2,18,0.97)',
      borderTop:'1px solid rgba(100,60,220,0.26)', display:'flex', alignItems:'center', gap:12,
      padding:'0 16px', boxShadow:'0 -4px 30px rgba(48,24,138,0.14)' }}>

      <button onClick={onClose}
        style={{ fontFamily:'Rajdhani', fontSize:9, fontWeight:600, letterSpacing:'0.16em', textTransform:'uppercase', color:'#7B4DFF', background:'none', border:'1px solid rgba(100,60,220,0.28)', borderRadius:6, padding:'5px 10px', cursor:'pointer', flexShrink:0, transition:'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.color='#C7A6FF'; e.currentTarget.style.borderColor='rgba(150,95,255,0.55)' }}
        onMouseLeave={e => { e.currentTarget.style.color='#7B4DFF'; e.currentTarget.style.borderColor='rgba(100,60,220,0.28)' }}
      >← DASHBOARD</button>

      {viewStage === 'map' && (
        <button onClick={onBackToGlobe}
          style={{ fontFamily:'Rajdhani', fontSize:9, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color:'#4D8DFF', background:'none', border:'1px solid rgba(60,100,220,0.28)', borderRadius:6, padding:'5px 10px', cursor:'pointer', flexShrink:0, transition:'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color='#90C0FF'; e.currentTarget.style.borderColor='rgba(90,140,255,0.55)' }}
          onMouseLeave={e => { e.currentTarget.style.color='#4D8DFF'; e.currentTarget.style.borderColor='rgba(60,100,220,0.28)' }}
        >⊕ GLOBE</button>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:1.5, flexShrink:0 }}>
        {Array.from({ length: 22 }, (_, i) => {
          const h = 4 + Math.abs(Math.sin(i * 0.72) * 10 + Math.cos(i * 1.3) * 4)
          const a = 0.07 + Math.abs(Math.sin(i * 0.5)) * 0.22
          return <div key={i} style={{ width:2, height:h, background:`rgba(135,86,250,${a})`, borderRadius:1 }} />
        })}
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', background:'rgba(8,5,28,0.80)', border:'1px solid rgba(68,44,158,0.22)', borderRadius:8, padding:'0 12px', height:32 }}>
        <input value={cmd} onChange={e => setCmd(e.target.value)}
          placeholder="Global view command..."
          style={{ background:'none', border:'none', outline:'none', fontFamily:'Exo 2, sans-serif', fontSize:11, color:'#C7A6FF', flex:1 }} />
      </div>

      <div style={{ flexShrink:0, textAlign:'right' }}>
        <div style={{ fontFamily:'Share Tech Mono', fontSize:8, color:'#3A3060', letterSpacing:'0.10em' }}>
          {selectedCity
            ? `${Math.abs(selectedCity.lat).toFixed(2)}°${selectedCity.lat >= 0 ? 'N' : 'S'}  ${Math.abs(selectedCity.lon).toFixed(2)}°${selectedCity.lon >= 0 ? 'E' : 'W'}`
            : '—°N  —°E'}
        </div>
        <div style={{ fontFamily:'Share Tech Mono', fontSize:7, color:'#5E587A', letterSpacing:'0.08em', marginTop:1 }}>
          {viewStage === 'globe' ? 'GLOBE MODE' : 'TACTICAL MAP'}
        </div>
      </div>
    </div>
  )
}

// ── Stage label helper ─────────────────────────────────────────────────────────

function getStageLabel(viewStage, scale) {
  if (viewStage === 'map') return 'TACTICAL MAP'
  if (viewStage === 'fading') return 'ENTERING MAP…'
  if (scale < 1.65) return 'GLOBAL'
  if (scale < 2.30) return 'REGIONAL'
  return 'APPROACHING TACTICAL'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GlobalView({ onClose }) {
  const [layers,       setLayers]       = useState({ networkNodes:true, signalRoutes:true, cityMarkers:true, threatFeeds:false })
  const [selectedCity, setSelectedCity] = useState(null)
  const [hoveredCity,  setHoveredCity]  = useState(null)
  const [viewStage,    setViewStage]    = useState('globe') // 'globe' | 'fading' | 'map'
  const [perfMode,     setPerfMode]     = useState('cinematic')
  const [mapCenter,    setMapCenter]    = useState({ lat: 30, lon: 10 })
  const [entryDone,    setEntryDone]    = useState(false)
  const [globeReady,   setGlobeReady]   = useState(false)
  const [scaleDisplay, setScaleDisplay] = useState(1.0) // for label re-render

  // Animation refs
  const canvasRef       = useRef(null)
  const viewportRef     = useRef(null)
  const rafRef          = useRef(null)
  const rotRef          = useRef(30)
  const scaleRef        = useRef(1.0)
  const isDraggingRef   = useRef(false)
  const dragStartRef    = useRef(null)
  const stageRef        = useRef('globe')
  const layersRef       = useRef(layers)
  const hoverRef        = useRef(null)
  const selRef          = useRef(null)
  const perfRef         = useRef('cinematic')
  const drawnCities     = useRef([])
  const transitioningRef = useRef(false)
  const mapRef          = useRef(null)

  useEffect(() => { layersRef.current = layers     }, [layers])
  useEffect(() => { hoverRef.current  = hoveredCity }, [hoveredCity])
  useEffect(() => { selRef.current    = selectedCity }, [selectedCity])
  useEffect(() => { perfRef.current   = perfMode    }, [perfMode])

  // Entry animation
  useEffect(() => {
    const t1 = setTimeout(() => setEntryDone(true),  480)
    const t2 = setTimeout(() => setGlobeReady(true), 820)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Transition: globe → map
  const triggerMapMode = useCallback(() => {
    if (transitioningRef.current || stageRef.current !== 'globe') return
    transitioningRef.current = true
    const focus = selRef.current ?? hoverRef.current ? CITY_MAP[hoverRef.current] : null
    const center = focus ?? { lat: 30, lon: 10 }
    setMapCenter({ lat: center.lat, lon: center.lon })
    stageRef.current = 'fading'
    setViewStage('fading')
    setTimeout(() => {
      stageRef.current = 'map'
      setViewStage('map')
      transitioningRef.current = false
    }, 650)
  }, [])

  // Transition: map → globe
  const triggerGlobeMode = useCallback(() => {
    if (transitioningRef.current) return
    transitioningRef.current = true
    stageRef.current = 'globe'
    setViewStage('globe')
    scaleRef.current = 2.3
    setScaleDisplay(2.3)
    setTimeout(() => { transitioningRef.current = false }, 700)
  }, [])

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })
    ro.observe(canvas)
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    let lastT = 0
    const loop = (ts) => {
      if (stageRef.current !== 'map') {
        const dt = ts - lastT
        if (!isDraggingRef.current) rotRef.current += dt * 0.0052
        const W = canvas.offsetWidth, H = canvas.offsetHeight
        const cx = W/2, cy = H/2
        const R = Math.min(W, H) * BASE_SCALE * Math.min(scaleRef.current, 2.55)
        drawnCities.current = CITIES.map(city => {
          const p = project(city.lat, city.lon, rotRef.current, cx, cy, R)
          return { ...city, sx: p.sx, sy: p.sy, visible: p.z > 0 }
        }).filter(c => c.visible)
        const ctx = canvas.getContext('2d')
        drawGlobe(ctx, W, H, rotRef.current, scaleRef.current, layersRef.current,
          hoverRef.current, selRef.current?.id, ts, perfRef.current)
      }
      lastT = ts
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [])

  // Wheel zoom (non-passive, on viewport div)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e) => {
      if (stageRef.current === 'map') return // let Leaflet handle it
      e.preventDefault()
      const step = e.deltaY > 0 ? -0.072 : 0.072
      scaleRef.current = Math.max(0.55, Math.min(3.6, scaleRef.current + step))
      setScaleDisplay(scaleRef.current)
      if (scaleRef.current >= ZOOM_MAP_THRESHOLD) triggerMapMode()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [triggerMapMode])

  // Drag-to-rotate handlers
  const handleMouseDown = useCallback((e) => {
    if (stageRef.current !== 'globe') return
    isDraggingRef.current = true
    dragStartRef.current  = { clientX: e.clientX, rot: rotRef.current }
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.clientX
      rotRef.current = dragStartRef.current.rot + dx * 0.32
    }
    // Hover detection
    const canvas = canvasRef.current
    if (!canvas || stageRef.current !== 'globe') return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let found = null
    for (const dc of drawnCities.current) {
      if (Math.hypot(dc.sx - mx, dc.sy - my) < 14) { found = dc.id; break }
    }
    setHoveredCity(prev => prev !== found ? found : prev)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    dragStartRef.current  = null
  }, [])

  const handleClick = useCallback((e) => {
    // Skip if this was the end of a drag gesture
    if (!canvasRef.current || stageRef.current !== 'globe') return
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let found = null
    for (const dc of drawnCities.current) {
      if (Math.hypot(dc.sx - mx, dc.sy - my) < 16) { found = dc; break }
    }
    setSelectedCity(found ? CITY_MAP[found.id] : null)
  }, [])

  const toggleLayer = useCallback((key) => setLayers(prev => ({ ...prev, [key]: !prev[key] })), [])
  const handleMapReady = useCallback((map) => { mapRef.current = map }, [])

  const stageLabel = getStageLabel(viewStage, scaleDisplay)
  const inGlobe    = viewStage === 'globe' || viewStage === 'fading'
  const inMap      = viewStage === 'map'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:150, background:'#02010A', display:'flex', flexDirection:'column' }}>

      {/* Cinematic entry sweep */}
      <AnimatePresence>
        {!entryDone && (
          <motion.div initial={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.52, ease:'easeInOut' }}
            style={{ position:'absolute', inset:0, background:'#02010A', zIndex:999, pointerEvents:'none', overflow:'hidden' }}>
            <motion.div initial={{ left:'-12%' }} animate={{ left:'112%' }} transition={{ duration:0.52, ease:'easeInOut' }}
              style={{ position:'absolute', top:0, bottom:0, width:'14%',
                background:'linear-gradient(90deg,transparent,rgba(100,60,220,0.48),rgba(165,105,255,0.22),transparent)',
                pointerEvents:'none' }} />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        <GlobeNav
          layers={layers}
          onToggle={toggleLayer}
          viewStage={viewStage}
          stageLabel={stageLabel}
          perfMode={perfMode}
          onPerfChange={setPerfMode}
          onClose={onClose}
          onBackToGlobe={triggerGlobeMode}
        />

        {/* Viewport */}
        <div
          ref={viewportRef}
          style={{ flex:1, position:'relative', overflow:'hidden', cursor: isDraggingRef.current ? 'grabbing' : (hoveredCity ? 'pointer' : 'default') }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHoveredCity(null) }}
          onClick={handleClick}
        >
          {/* Globe canvas */}
          <canvas
            ref={canvasRef}
            style={{
              position:'absolute', inset:0, width:'100%', height:'100%',
              opacity: inGlobe ? (globeReady ? 1 : 0) : 0,
              transition: 'opacity 0.7s ease',
              pointerEvents: 'none', // viewport div handles events
            }}
          />

          {/* Leaflet tactical map */}
          <AnimatePresence>
            {inMap && (
              <motion.div key="leaflet"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                transition={{ duration:0.65 }}
                style={{ position:'absolute', inset:0 }}
                onMouseDown={e => e.stopPropagation()} // prevent globe drag on map
                onClick={e => e.stopPropagation()}
              >
                <LeafletTactical center={mapCenter} initZoom={5} onMapReady={handleMapReady} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Globe → map crossfade veil */}
          <AnimatePresence>
            {viewStage === 'fading' && (
              <motion.div key="veil"
                initial={{ opacity:0 }} animate={{ opacity:0.85 }} exit={{ opacity:0 }}
                transition={{ duration:0.35 }}
                style={{ position:'absolute', inset:0, background:'#02010A', pointerEvents:'none', zIndex:5 }}>
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ fontFamily:'Rajdhani', fontSize:16, fontWeight:700, letterSpacing:'0.28em', color:'rgba(150,100,255,0.70)', textTransform:'uppercase' }}>
                    ENTERING TACTICAL MAP
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Demo badge */}
          <div style={{ position:'absolute', top:12, right:12, fontFamily:'Share Tech Mono', fontSize:7, letterSpacing:'0.18em', color:'rgba(100,65,200,0.48)', border:'1px solid rgba(88,54,178,0.18)', borderRadius:4, padding:'3px 8px', pointerEvents:'none', background:'rgba(4,2,18,0.62)', textTransform:'uppercase', zIndex:10 }}>
            DEMO VISUALIZATION
          </div>

          {/* City hover label */}
          {hoveredCity && viewStage === 'globe' && (() => {
            const c = CITY_MAP[hoveredCity]
            return c ? (
              <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', fontFamily:'Rajdhani', fontSize:12, fontWeight:600, letterSpacing:'0.12em', color:'#C7A6FF', background:'rgba(4,2,18,0.92)', border:'1px solid rgba(100,60,220,0.38)', borderRadius:6, padding:'4px 12px', pointerEvents:'none', boxShadow:'0 0 16px rgba(80,40,200,0.20)', zIndex:10 }}>{c.name}</div>
            ) : null
          })()}

          {/* Zoom hint on globe */}
          {viewStage === 'globe' && (
            <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', fontFamily:'Share Tech Mono', fontSize:8, color:'rgba(100,65,200,0.45)', letterSpacing:'0.14em', pointerEvents:'none', whiteSpace:'nowrap', zIndex:10 }}>
              {scaleDisplay < ZOOM_MAP_THRESHOLD - 0.4 ? 'SCROLL TO ZOOM IN · DRAG TO ROTATE' : 'ALMOST THERE — ZOOM MORE TO ENTER MAP'}
            </div>
          )}
        </div>

        <GlobeRightPanel selectedCity={selectedCity} viewStage={viewStage} stageLabel={stageLabel} />
      </div>

      <GlobeBottomBar onClose={onClose} onBackToGlobe={triggerGlobeMode} selectedCity={selectedCity} viewStage={viewStage} />
    </div>
  )
}
