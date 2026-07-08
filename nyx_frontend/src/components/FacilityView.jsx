/**
 * FacilityView.jsx — Top-down neon facility for the Agents plugin
 *
 * The look from the reference: a bird's-eye cyberpunk facility where each
 * agent is a neon-bordered room packed with sci-fi machines, with little
 * agents moving around inside. Rooms tile into a grid connected by corridors;
 * you pan (drag) and zoom (wheel) across the whole facility, which grows as
 * you deploy more agents.
 *
 * Rendered in PixiJS (WebGL) with additive glow + bloom for the neon. All
 * procedural — no external art — so it ships with the plugin for everyone.
 */

import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'

const ROOM = 240          // room size in world px
const GAP = 40            // corridor gap between rooms
const CELL = ROOM + GAP

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d')
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  return Texture.from(c)
}

// deterministic pseudo-random from a seed
function rng(seed) {
  let s = seed || 1
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

export default function FacilityView({ agents, width, height, selected, onSelect }) {
  const hostRef = useRef(null)
  const agentsRef = useRef(agents)
  useEffect(() => { agentsRef.current = agents }, [agents])
  const [hud, setHud] = useState({ total: agents.length, working: 0 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let app, destroyed = false
    const cleanups = []

    ;(async () => {
      app = new Application()
      await app.init({ width, height, backgroundAlpha: 0, antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
      if (destroyed) { try { app.destroy(true) } catch {} ; return }
      host.appendChild(app.canvas)
      app.canvas.style.borderRadius = '18px'

      const gtex = glowTex()

      // world (pan/zoom) container
      const world = new Container()
      const glowLayer = new Container()
      glowLayer.filters = [new AdvancedBloomFilter({ threshold: 0.3, bloomScale: 1.3, brightness: 1.15, blur: 8 })]
      world.addChild(glowLayer)     // glow behind
      const solid = new Container()
      world.addChild(solid)
      app.stage.addChild(world)

      const glow = (x, y, size, color, alpha = 1) => {
        const s = new Sprite(gtex); s.anchor.set(0.5); s.tint = color; s.blendMode = 'add'
        s.position.set(x, y); s.width = s.height = size; s.alpha = alpha
        glowLayer.addChild(s); return s
      }

      const rooms = []   // {agent, container, machines, lights, agentDot, spots}

      const buildRoom = (agent, col, row) => {
        const ox = col * CELL, oy = row * CELL
        const accent = parseInt((agent.accent || '#7B4DFF').replace('#', ''), 16)
        const rand = rng((agent.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 7) + col * 31 + row * 17)

        const c = new Container(); c.position.set(ox, oy); solid.addChild(c)

        // floor
        c.addChild(new Graphics().roundRect(0, 0, ROOM, ROOM, 10).fill({ color: 0x0d0b1a }))
        // floor panel grid
        const grid = new Graphics()
        for (let i = 1; i < 6; i++) {
          grid.moveTo((ROOM / 6) * i, 6).lineTo((ROOM / 6) * i, ROOM - 6)
          grid.moveTo(6, (ROOM / 6) * i).lineTo(ROOM - 6, (ROOM / 6) * i)
        }
        grid.stroke({ width: 1, color: accent, alpha: 0.08 }); c.addChild(grid)

        // neon border (glow + solid)
        glow(ox + ROOM / 2, oy + ROOM / 2, ROOM * 1.15, accent, 0.10)
        const borderGlow = new Graphics().roundRect(ox + 2, oy + 2, ROOM - 4, ROOM - 4, 10)
          .stroke({ width: 3, color: accent, alpha: 0.9 })
        glowLayer.addChild(borderGlow)
        c.addChild(new Graphics().roundRect(2, 2, ROOM - 4, ROOM - 4, 10).stroke({ width: 1.5, color: accent, alpha: 0.5 }))

        // ── machines packed against the walls ──
        const machines = []; const lights = []; const spots = []
        const scr1 = 0x2fe0ff, scr2 = 0xff8a3c   // cyan + orange screen colors
        const mk = (mx, my, mw, mh, kind) => {
          const g = new Graphics()
          g.roundRect(mx, my, mw, mh, 3).fill({ color: 0x161227 }).stroke({ width: 1, color: accent, alpha: 0.4 })
          if (kind === 'rack') {
            for (let r = 0; r < Math.floor(mh / 7); r++) {
              g.rect(mx + 3, my + 4 + r * 7, mw - 6, 2).fill({ color: 0x0a0814 })
              const lc = rand() > 0.5 ? 0x33ff88 : (rand() > 0.5 ? scr1 : accent)
              const lx = mx + mw - 6, ly = my + 5 + r * 7
              g.circle(lx, ly, 1.4).fill(lc)
              lights.push({ x: ox + lx, y: oy + ly, c: lc })
            }
          } else { // terminal / workstation with a screen
            const sc = rand() > 0.5 ? scr1 : scr2
            g.roundRect(mx + 3, my + 3, mw - 6, mh - 8, 2).fill({ color: sc, alpha: 0.85 })
            for (let s = 0; s < mh / 4; s++) g.rect(mx + 4, my + 4 + s * 4, mw - 8, 1).fill({ color: 0x000000, alpha: 0.25 })
            glow(ox + mx + mw / 2, oy + my + mh / 2, mw * 1.8, sc, 0.5)
            spots.push({ x: ox + mx + mw / 2, y: oy + my + mh + 10 })
          }
          c.addChild(g); machines.push(g)
        }
        // top wall row of racks
        let x = 14
        while (x < ROOM - 30) { const w = 16 + Math.floor(rand() * 10); mk(x, 12, w, 34, rand() > 0.4 ? 'rack' : 'term'); x += w + 6 }
        // left wall terminals
        let y = 60
        while (y < ROOM - 40) { mk(12, y, 30, 20, 'term'); y += 28 }
        // right wall racks
        y = 60
        while (y < ROOM - 40) { mk(ROOM - 40, y, 26, 24, rand() > 0.5 ? 'rack' : 'term'); y += 30 }
        // bottom wall row
        x = 60
        while (x < ROOM - 70) { const w = 18 + Math.floor(rand() * 10); mk(x, ROOM - 34, w, 22, rand() > 0.5 ? 'term' : 'rack'); x += w + 5 }
        // central machine cluster (packed, but leaves a walkway ring)
        mk(ROOM / 2 - 42, ROOM / 2 - 34, 34, 26, 'term')
        mk(ROOM / 2 + 8,  ROOM / 2 - 34, 34, 26, rand() > 0.5 ? 'rack' : 'term')
        mk(ROOM / 2 - 42, ROOM / 2 + 14, 34, 24, 'rack')
        mk(ROOM / 2 + 8,  ROOM / 2 + 14, 34, 24, 'term')
        // a couple of scattered floor consoles
        mk(52, ROOM / 2 + 40, 30, 18, 'term')
        mk(ROOM - 78, ROOM / 2 - 58, 30, 18, 'term')

        // ── agent dot ──
        const dot = new Container()
        const body = new Graphics().circle(0, 0, 7).fill({ color: 0x0a0814 }).stroke({ width: 2, color: accent })
        const eye = glow(0, 0, 18, accent, 0.9); glowLayer.removeChild(eye)
        dot.addChild(body)
        const dotGlow = new Sprite(gtex); dotGlow.anchor.set(0.5); dotGlow.tint = accent; dotGlow.blendMode = 'add'
        dotGlow.width = dotGlow.height = 26; dotGlow.alpha = 0.7; dot.addChildAt(dotGlow, 0)
        dot.position.set(ox + ROOM / 2, oy + ROOM / 2)
        solid.addChild(dot)

        // label
        const room = { agent, c, machines, lights, dot, spots: spots.length ? spots : [{ x: ox + ROOM / 2, y: oy + ROOM / 2 }],
          ox, oy, accent, target: { x: ox + ROOM / 2, y: oy + ROOM / 2 }, borderGlow,
          hit: new Graphics().roundRect(0, 0, ROOM, ROOM, 10).fill({ color: 0xffffff, alpha: 0.001 }) }
        c.addChild(room.hit)
        room.hit.eventMode = 'static'; room.hit.cursor = 'pointer'
        room.hit.on('pointertap', (e) => { e.stopPropagation(); onSelect?.(agent.id) })
        rooms.push(room)
      }

      // lay out rooms in a roughly-square grid
      const layout = () => {
        rooms.forEach(r => { r.c.destroy({ children: true }); r.dot.destroy({ children: true }) })
        glowLayer.removeChildren(); rooms.length = 0
        const list = agentsRef.current
        const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)))
        list.forEach((a, i) => buildRoom(a, i % cols, Math.floor(i / cols)))
        // corridors between horizontally/vertically adjacent rooms
        const corr = new Graphics()
        list.forEach((a, i) => {
          const col = i % cols, row = Math.floor(i / cols)
          if (col < cols - 1 && i + 1 < list.length) {
            const y = row * CELL + ROOM / 2
            corr.rect(col * CELL + ROOM, y - 8, GAP, 16).fill({ color: 0x161227 }).stroke({ width: 1, color: 0x4a3a80, alpha: 0.5 })
          }
          if (i + cols < list.length) {
            const x = col * CELL + ROOM / 2
            corr.rect(x - 8, row * CELL + ROOM, 16, GAP).fill({ color: 0x161227 }).stroke({ width: 1, color: 0x4a3a80, alpha: 0.5 })
          }
        })
        solid.addChildAt(corr, 0)
        fitView()
      }

      // center + fit the facility in view
      const fitView = () => {
        const list = agentsRef.current
        const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)))
        const rowsN = Math.ceil(list.length / cols)
        const fw = cols * CELL - GAP, fh = rowsN * CELL - GAP
        const scale = Math.min(width / (fw + 80), height / (fh + 80), 1.1)
        world.scale.set(scale)
        world.position.set((width - fw * scale) / 2, (height - fh * scale) / 2)
      }

      let lastCount = -1
      const syncAgents = () => {
        const list = agentsRef.current
        if (list.length !== lastCount) { lastCount = list.length; layout() }
        setHud({ total: list.length, working: list.filter(a => a.status === 'Working').length })
        // selection highlight
        for (const r of rooms) r.borderGlow.alpha = (r.agent.id === selected) ? 1 : 0.75
      }
      syncAgents()
      const si = setInterval(syncAgents, 1500); cleanups.push(() => clearInterval(si))

      // ── pan / zoom ──
      let dragging = false, dragStart = null, moved = 0
      app.stage.eventMode = 'static'
      app.stage.hitArea = { contains: () => true }
      app.stage.on('pointerdown', (e) => { dragging = true; moved = 0; dragStart = { x: e.global.x - world.x, y: e.global.y - world.y } })
      app.stage.on('pointerup', () => { dragging = false })
      app.stage.on('pointerupoutside', () => { dragging = false })
      app.stage.on('pointermove', (e) => {
        if (!dragging) return
        moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)
        world.position.set(e.global.x - dragStart.x, e.global.y - dragStart.y)
      })
      const onWheel = (ev) => {
        ev.preventDefault()
        const factor = ev.deltaY < 0 ? 1.12 : 0.89
        const ns = Math.max(0.3, Math.min(2.4, world.scale.x * factor))
        const r = app.canvas.getBoundingClientRect()
        const mx = ev.clientX - r.left, my = ev.clientY - r.top
        const wx = (mx - world.x) / world.scale.x, wy = (my - world.y) / world.scale.y
        world.scale.set(ns)
        world.position.set(mx - wx * ns, my - wy * ns)
      }
      app.canvas.addEventListener('wheel', onWheel, { passive: false })
      cleanups.push(() => app.canvas.removeEventListener('wheel', onWheel))

      // ── animation ──
      let t = 0
      const tick = (ticker) => {
        t += ticker.deltaMS
        for (const r of rooms) {
          const working = r.agent.status === 'Working'
          // move agent dot toward a target; repick occasionally
          if (!r._nextMove || t > r._nextMove) {
            const sp = working ? r.spots[0] : r.spots[Math.floor(Math.random() * r.spots.length)]
            r.target = { x: sp.x, y: sp.y }; r._nextMove = t + 2500 + Math.random() * 3000
          }
          r.dot.x += (r.target.x - r.dot.x) * 0.04
          r.dot.y += (r.target.y - r.dot.y) * 0.04
          // blink machine lights
          if (r.lights.length && Math.random() < 0.3) {
            const L = r.lights[Math.floor(Math.random() * r.lights.length)]
            // (lights are baked; simulate blink with a transient glow)
            const s = glow(L.x, L.y, 6, L.c, 0.9); setTimeout(() => { try { s.destroy() } catch {} }, 120)
          }
          r.borderGlow.alpha = (r.agent.id === selected ? 1 : 0.75) * (working ? (0.7 + 0.3 * Math.sin(t / 200)) : 1)
        }
      }
      app.ticker.add(tick)
    })()

    return () => {
      destroyed = true
      cleanups.forEach(fn => { try { fn() } catch {} })
      try { app?.destroy(true, { children: true }) } catch {}
      if (host) host.innerHTML = ''
    }
  }, [width, height])  // eslint-disable-line

  return (
    <div style={{ position: 'relative', width, height, borderRadius: 18, overflow: 'hidden',
      border: '1px solid rgba(150,110,255,0.25)', background: 'radial-gradient(130% 100% at 50% 0%, rgba(24,14,48,0.6), rgba(6,5,14,0.99))',
      boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 14, fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
        letterSpacing: '0.2em', color: '#B9A6FF', textShadow: '0 1px 6px #000', pointerEvents: 'none' }}>
        NYX FACILITY · <span style={{ color: '#22c55e' }}>{hud.working} working</span> · {hud.total} agents
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 12, fontFamily: 'Share Tech Mono, monospace', fontSize: 7.5,
        color: '#5E587A', pointerEvents: 'none' }}>drag to pan · scroll to zoom</div>
    </div>
  )
}
