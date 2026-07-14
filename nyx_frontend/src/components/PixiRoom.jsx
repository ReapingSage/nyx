/**
 * PixiRoom.jsx — WebGL cozy room (Agents plugin, Path B engine)
 *
 * A real 2D scene rendered with PixiJS instead of CSS divs: layered depth,
 * additive glow lighting with bloom, an animated rain shader-ish particle
 * window, floating dust, and a smoothly tweened hooded character that walks
 * between furniture and reacts to the agent's real status.
 *
 * No external art assets — everything is drawn in-engine with Graphics +
 * glow textures + filters, which is a large step up from the flat CSS room
 * and leaves the door open to drop in illustrated sprites later.
 */

import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Sprite, Texture, FillGradient } from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'

// Idle behaviors -> a floor spot (fraction of room) + activity label
const BEHAVIORS = [
  { label: 'Pacing around',            spot: 'center'  },
  { label: 'Relaxing on the bean bag', spot: 'beanbag', sit: true },
  { label: 'Sleeping',                 spot: 'bed', sleep: true },
  { label: 'Watching the rain',        spot: 'window'  },
  { label: 'Browsing the shelf',       spot: 'shelf'   },
  { label: 'Stretching',               spot: 'center'  },
  { label: 'Reading a book',           spot: 'beanbag', sit: true },
  { label: 'Drinking coffee',          spot: 'rug'     },
  { label: 'Watering the plant',       spot: 'plant'   },
  { label: 'Tinkering at the desk',    spot: 'desk', sit: true },
]

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
  return Texture.from(c)
}

export default function PixiRoom({ agent, width, height, onSelect }) {
  const hostRef = useRef(null)
  const [activity, setActivity] = useState('Pacing around')
  const [objMsg, setObjMsg]     = useState(null)

  const workingRef = useRef(agent.status === 'Working')
  const taskRef    = useRef(agent.current_task)
  useEffect(() => { workingRef.current = agent.status === 'Working'; taskRef.current = agent.current_task }, [agent.status, agent.current_task])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let app, destroyed = false
    const cleanups = []
    const ACCENT = parseInt((agent.accent || '#7B4DFF').replace('#', ''), 16)
    const W = width, H = height

    ;(async () => {
      app = new Application()
      await app.init({ width: W, height: H, backgroundAlpha: 0, antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
      if (destroyed) { try { app.destroy(true) } catch {} ; return }
      host.appendChild(app.canvas)
      app.canvas.style.borderRadius = '20px'

      const glowTex = glowTexture()
      const floorY = H * 0.62

      // ── Layers ──
      const bg     = new Container()
      const lights = new Container()
      const furn   = new Container()
      const rain   = new Container()
      const charL  = new Container()
      const dust   = new Container()
      app.stage.addChild(bg, lights, furn, rain, charL, dust)
      lights.filters = [new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 0.7, brightness: 1, blur: 5 })]

      const glow = (x, y, size, color, alpha = 1) => {
        const s = new Sprite(glowTex); s.anchor.set(0.5); s.tint = color
        s.blendMode = 'add'; s.position.set(x, y); s.width = s.height = size; s.alpha = alpha
        lights.addChild(s); return s
      }

      // ── Walls + floor (gradients) ──
      const wallGrad = new FillGradient(0, 0, 0, floorY)
      wallGrad.addColorStop(0, 0x1a1330); wallGrad.addColorStop(1, 0x120d24)
      bg.addChild(new Graphics().rect(0, 0, W, floorY).fill(wallGrad))
      const floorGrad = new FillGradient(0, floorY, 0, H)
      floorGrad.addColorStop(0, 0x281c46); floorGrad.addColorStop(1, 0x0e0a1c)
      bg.addChild(new Graphics().rect(0, floorY, W, H - floorY).fill(floorGrad))
      bg.addChild(new Graphics().rect(0, floorY - 1, W, 2).fill({ color: ACCENT, alpha: 0.18 }))
      // ambient room glow + floor pool
      glow(W * 0.72, H * 0.28, W * 0.9, ACCENT, 0.10)
      glow(W * 0.5, H * 0.95, W * 0.8, ACCENT, 0.14)

      // ── Interactive helper ──
      const clickable = (g, msg) => {
        g.eventMode = 'static'; g.cursor = 'pointer'
        g.on('pointertap', (e) => { e.stopPropagation(); setObjMsg(msg); setTimeout(() => setObjMsg(null), 2200) })
        return g
      }

      // ── Window (rain + moon) ──
      const winX = W * 0.44, winY = H * 0.12, winW = W * 0.26, winH = H * 0.26
      const win = new Graphics().roundRect(winX, winY, winW, winH, 8)
        .fill({ color: 0x10173a }).stroke({ width: 3, color: 0x6b6aa0, alpha: 0.6 })
      clickable(win, 'Weather · Rainy'); furn.addChild(win)
      // moon glow
      glow(winX + winW * 0.76, winY + winH * 0.3, 34, 0xd8d0ff, 0.9)
      furn.addChild(new Graphics().circle(winX + winW * 0.76, winY + winH * 0.3, 7).fill(0xeae6ff))
      // rain drops (masked to window)
      const winMask = new Graphics().roundRect(winX, winY, winW, winH, 8).fill(0xffffff)
      furn.addChild(winMask); rain.mask = winMask
      const drops = []
      for (let i = 0; i < 26; i++) {
        const d = new Graphics().rect(0, 0, 1.4, 9).fill({ color: 0xbcd0ff, alpha: 0.5 })
        d.position.set(winX + Math.random() * winW, winY + Math.random() * winH)
        d.rotation = 0.18; rain.addChild(d); drops.push(d)
      }

      // ── Wall decor ──
      const poster = new Graphics().roundRect(W * 0.2, H * 0.13, 34, 46, 4)
        .fill({ color: ACCENT, alpha: 0.35 }).stroke({ width: 2, color: 0x9678c8, alpha: 0.4 })
      furn.addChild(poster)
      const clock = new Graphics().circle(W * 0.72, H * 0.16, 13).fill(0x1a142c).stroke({ width: 2, color: 0x9678c8, alpha: 0.4 })
      furn.addChild(clock)
      // string lights
      for (let i = 0; i < 12; i++) {
        const lx = W * 0.08 + (i / 11) * W * 0.84, ly = 8 + (i % 2) * 5
        glow(lx, ly, 12, i % 3 === 0 ? ACCENT : 0xc9a8ff, 0.8)
      }

      // ── Furniture ──
      // rug
      furn.addChild(new Graphics().ellipse(W * 0.52, H * 0.9, W * 0.2, H * 0.05).fill({ color: ACCENT, alpha: 0.14 }))
      // bed
      const bed = new Container()
      bed.addChild(new Graphics().roundRect(W * 0.05, floorY + H * 0.06, 104, 46, 8).fill(0x241a3c).stroke({ width: 1, color: ACCENT, alpha: 0.25 }))
      bed.addChild(new Graphics().roundRect(W * 0.05 + 6, floorY + H * 0.06 + 6, 26, 16, 4).fill({ color: ACCENT, alpha: 0.5 }))
      bed.addChild(new Graphics().roundRect(W * 0.05 + 36, floorY + H * 0.06 + 10, 62, 32, 5).fill(0x3a2c5e))
      clickable(bed, 'Sleeping'); furn.addChild(bed)
      // desk + monitor
      const deskX = W * 0.72
      const desk = new Container()
      const monitor = new Graphics().roundRect(deskX - 4, floorY + H * 0.02, 62, 34, 4).fill(0x0a0812).stroke({ width: 1, color: ACCENT, alpha: 0.4 })
      const screen = new Graphics().roundRect(deskX, floorY + H * 0.02 + 4, 54, 26, 2).fill({ color: ACCENT, alpha: 0.5 })
      const screenGlow = glow(deskX + 27, floorY + H * 0.02 + 17, 70, ACCENT, 0)   // brightens when working
      desk.addChild(new Graphics().roundRect(deskX - 12, floorY + H * 0.09, 84, 8, 3).fill(0x3a2c5e))
      desk.addChild(monitor, screen)
      clickable(desk, 'At the computer'); furn.addChild(desk)
      // bean bag
      const bean = new Graphics().ellipse(W * 0.34, floorY + H * 0.13, 26, 20).fill(0x3a2858).stroke({ width: 1, color: ACCENT, alpha: 0.2 })
      clickable(bean, 'Relaxing'); furn.addChild(bean)
      // shelf + books
      const shelf = new Container()
      shelf.addChild(new Graphics().roundRect(W * 0.9, floorY - 6, 30, 74, 4).fill(0x1c1430).stroke({ width: 1, color: ACCENT, alpha: 0.2 }))
      const bookCols = [0xB96CFF, 0x7AA7FF, 0x8F5CFF, 0xFF7742]
      for (let r = 0; r < 4; r++) for (let b = 0; b < 3; b++)
        shelf.addChild(new Graphics().rect(W * 0.9 + 4 + b * 8, floorY + r * 17, 6, 12).fill({ color: bookCols[r], alpha: 0.75 }))
      clickable(shelf, 'Knowledge'); furn.addChild(shelf)
      // plant
      const plant = new Container()
      plant.addChild(new Graphics().roundRect(W * 0.03, floorY + H * 0.16, 16, 14, 3).fill(0x3a2c5e))
      plant.addChild(new Graphics().ellipse(W * 0.03 + 8, floorY + H * 0.16, 12, 14).fill(0x2f7d54))
      clickable(plant, 'Watering the plant'); furn.addChild(plant)
      // lamp + warm glow
      furn.addChild(new Graphics().rect(W * 0.45, floorY - 4, 3, 30).fill(0x2a2142))
      furn.addChild(new Graphics().roundRect(W * 0.45 - 7, floorY - 16, 18, 14, 4).fill(0xc9a8ff))
      const lampGlow = glow(W * 0.45 + 1.5, floorY - 10, 34, 0xcaa8ff, 0.55)

      // ── Character ──
      const char = new Container()
      const shadow = new Graphics().ellipse(0, 0, 17, 5).fill({ color: 0x000000, alpha: 0.5 })
      const body = new Graphics().roundRect(-17, -40, 34, 42, 14).fill(0x1c1530).stroke({ width: 1, color: ACCENT, alpha: 0.5 })
      const hood = new Graphics().roundRect(-12, -37, 24, 18, 10).fill(0x050409)
      const eyeL = glow(0, 0, 12, ACCENT); const eyeR = glow(0, 0, 12, ACCENT)
      lights.removeChild(eyeL); lights.removeChild(eyeR)  // eyes live with the character
      eyeL.position.set(-6, -28); eyeR.position.set(6, -28)
      const eyeDotL = new Graphics().circle(0, 0, 2.2).fill(0xffffff); eyeDotL.position.set(-6, -28)
      const eyeDotR = new Graphics().circle(0, 0, 2.2).fill(0xffffff); eyeDotR.position.set(6, -28)
      char.addChild(shadow, body, hood, eyeL, eyeR, eyeDotL, eyeDotR)
      char.eventMode = 'static'; char.cursor = 'pointer'
      char.on('pointertap', (e) => { e.stopPropagation(); onSelect?.(agent.id); char._wave = 22 })
      charL.addChild(char)

      // spots (feet position)
      const SPOTS = {
        center:  [W * 0.5,  H * 0.9],
        bed:     [W * 0.15, floorY + H * 0.06],
        beanbag: [W * 0.34, floorY + H * 0.14],
        window:  [W * 0.5,  floorY + H * 0.02],
        shelf:   [W * 0.82, floorY + H * 0.06],
        desk:    [W * 0.72, floorY + H * 0.05],
        rug:     [W * 0.52, H * 0.9],
        plant:   [W * 0.1,  floorY + H * 0.1],
      }
      const targetRef = { current: SPOTS.center, sit: false, sleep: false }
      char.position.set(SPOTS.center[0], SPOTS.center[1])

      // behavior loop
      const pick = () => {
        if (workingRef.current) {
          targetRef.current = SPOTS.desk; targetRef.sit = true; targetRef.sleep = false
          setActivity(taskRef.current || 'Working…'); return
        }
        const b = BEHAVIORS[Math.floor(Math.random() * BEHAVIORS.length)]
        targetRef.current = SPOTS[b.spot] || SPOTS.center
        targetRef.sit = !!b.sit; targetRef.sleep = !!b.sleep
        setActivity(b.label)
      }
      pick()
      const bi = setInterval(pick, 6500 + Math.random() * 4000)
      const wi = setInterval(() => { if (workingRef.current) pick() }, 1500)  // snap to desk when a task starts
      cleanups.push(() => { clearInterval(bi); clearInterval(wi) })

      // ── dust ──
      const motes = []
      for (let i = 0; i < 16; i++) {
        const m = new Sprite(glowTex); m.anchor.set(0.5); m.tint = ACCENT; m.blendMode = 'add'
        m.width = m.height = 5 + Math.random() * 4
        m.position.set(Math.random() * W, floorY + Math.random() * (H - floorY))
        m._sp = 0.2 + Math.random() * 0.4; m.alpha = 0.1 + Math.random() * 0.3
        dust.addChild(m); motes.push(m)
      }

      // ── Ticker ──
      let t = 0
      const tick = (ticker) => {
        t += ticker.deltaMS
        // character move (lerp)
        const [tx, ty] = targetRef.current
        char.x += (tx - char.x) * 0.05
        char.y += (ty - char.y) * 0.05
        const moving = Math.abs(tx - char.x) > 1.5
        // bob / sit / sleep
        const sit = targetRef.sit, sleep = targetRef.sleep
        body.scale.y = sit ? 0.82 : 1
        char.rotation = sleep ? -0.5 : 0
        const bob = sleep ? 0 : Math.sin(t / 340) * 2 + (moving ? Math.sin(t / 90) * 1.5 : 0)
        body.y = bob; hood.y = bob; eyeL.y = -28 + bob; eyeR.y = -28 + bob
        eyeDotL.y = -28 + bob; eyeDotR.y = -28 + bob
        // eyes
        const eye = sleep ? 0.12 : 0.6 + Math.sin(t / 500) * 0.25
        eyeL.alpha = eye; eyeR.alpha = eye
        eyeDotL.visible = eyeDotR.visible = !sleep
        // wave
        if (char._wave > 0) { char._wave--; char.rotation = Math.sin(t / 60) * 0.12 }
        // rain
        for (const d of drops) { d.y += 4.2; if (d.y > winY + winH) { d.y = winY - 6; d.x = winX + Math.random() * winW } }
        // dust rise
        for (const m of motes) { m.y -= m._sp; m.alpha -= 0.0008; if (m.y < floorY - 20 || m.alpha <= 0) { m.y = H - Math.random() * 20; m.x = Math.random() * W; m.alpha = 0.1 + Math.random() * 0.3 } }
        // lights
        lampGlow.alpha = 0.7 + Math.sin(t / 900) * 0.12
        screen.alpha = workingRef.current ? 0.9 + Math.sin(t / 200) * 0.1 : 0.5
        screenGlow.alpha += ((workingRef.current ? 0.85 : 0) - screenGlow.alpha) * 0.08
      }
      app.ticker.add(tick)

      // click empty room -> select
      app.stage.eventMode = 'static'
      app.stage.hitArea = { contains: () => true }
      app.stage.on('pointertap', () => onSelect?.(agent.id))
    })()

    return () => {
      destroyed = true
      cleanups.forEach(fn => { try { fn() } catch {} })
      try { app?.destroy(true, { children: true, texture: false }) } catch {}
      if (host) host.innerHTML = ''
    }
  }, [width, height, agent.id, agent.accent])   // rebuild only on size/agent change

  return (
    <div style={{ position: 'relative', width, height, borderRadius: 20, overflow: 'hidden',
      border: '1px solid rgba(150,110,255,0.3)', boxShadow: '0 12px 46px rgba(0,0,0,0.5)' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {/* HTML overlays (crisp text) */}
      <div style={{ position: 'absolute', top: 12, left: 14, fontFamily: 'Share Tech Mono, monospace',
        fontSize: 10, letterSpacing: '0.22em', color: '#B9A6FF', textShadow: '0 1px 6px #000', pointerEvents: 'none' }}>
        ROOM — {agent.name.toUpperCase()}
      </div>
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 600, letterSpacing: '0.04em',
        color: agent.status === 'Working' ? (agent.accent || '#B96CFF') : '#EDE8FF',
        textShadow: '0 1px 8px #000', pointerEvents: 'none' }}>
        {objMsg || activity}{agent.status === 'Working' ? '' : '…'}
      </div>
    </div>
  )
}
