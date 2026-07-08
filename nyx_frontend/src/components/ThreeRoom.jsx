/**
 * ThreeRoom.jsx — 3D dollhouse room for the Agents plugin
 *
 * A real three.js WebGL scene using CC0 Kenney assets (Furniture Kit + Mini
 * Characters, both public domain / redistributable). An open-walled dollhouse
 * you can orbit and zoom, warm lighting with soft shadows, and the agent as a
 * rigged low-poly character that walks between furniture and plays idle / sit /
 * interact animations reacting to its real status.
 *
 * Assets live in /room-assets (served by ui/server.py). Everything here is
 * redistributable CC0, so it ships inside the plugin for everyone.
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const FURN = '/room-assets/furniture/'
const CHAR = '/room-assets/character/agent.glb'

// Furniture placement: [model, gridX, gridZ, rotationY(deg), yOffset]
const LAYOUT = [
  ['bedSingle',        1.3, 1.3,   0, 0],
  ['sideTableDrawers', 0.5, 2.4,   0, 0],
  ['desk',             4.8, 0.7,   0, 0],
  ['computerScreen',   4.8, 0.7,   0, 0.55],
  ['computerKeyboard', 4.8, 1.05,  0, 0.55],
  ['chairDesk',        4.8, 1.6, 180, 0],
  ['bookcaseOpen',     0.6, 4.2,  90, 0],
  ['loungeSofa',       5.4, 5.2, 200, 0],
  ['tableCoffee',      4.3, 4.6,   0, 0],
  ['rugRounded',       3.4, 3.4,   0, 0.01],
  ['lampSquareFloor',  0.6, 5.6,   0, 0],
  ['pottedPlant',      6.2, 1.2,   0, 0],
  ['plantSmall1',      2.6, 0.5,   0, 0.55],
  ['trashcan',         6.2, 4.0,   0, 0],
  ['speaker',          0.5, 0.6,   0, 0],
]

// Character behaviour spots (grid) + which clip to play there
const SPOTS = {
  center: { x: 3.4, z: 3.6, clip: 'idle' },
  desk:   { x: 4.8, z: 2.1, clip: 'sit', ry: 180 },
  bed:    { x: 1.6, z: 1.8, clip: 'sit', ry: 0 },
  sofa:   { x: 5.1, z: 4.8, clip: 'sit', ry: 200 },
  window: { x: 3.4, z: 0.7, clip: 'idle', ry: 0 },
  shelf:  { x: 1.4, z: 4.2, clip: 'idle', ry: 90 },
  plant:  { x: 5.8, z: 1.4, clip: 'idle' },
}
const IDLE_SPOTS = ['center', 'bed', 'sofa', 'window', 'shelf', 'plant']
const ACTIVITY = {
  center: 'Pacing around', desk: 'Working', bed: 'Sleeping', sofa: 'Relaxing',
  window: 'Watching the rain', shelf: 'Browsing the shelf', plant: 'Watering the plant',
}

export default function ThreeRoom({ agent, width, height, onSelect }) {
  const hostRef = useRef(null)
  const [activity, setActivity] = useState('Pacing around')
  const [ready, setReady] = useState(false)
  const workingRef = useRef(agent.status === 'Working')
  useEffect(() => { workingRef.current = agent.status === 'Working' }, [agent.status])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let raf, destroyed = false
    const accent = new THREE.Color(agent.accent || '#7B4DFF')

    // ── Renderer / scene / camera ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    host.appendChild(renderer.domElement)
    renderer.domElement.style.borderRadius = '20px'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(12, 10, 12)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(3.4, 0.8, 3.4)
    controls.enableDamping = true; controls.dampingFactor = 0.08
    controls.minDistance = 6; controls.maxDistance = 26
    controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.25
    controls.enablePan = false

    // ── Lighting (cozy, warm + accent) ──
    scene.add(new THREE.HemisphereLight(0xbfc4ff, 0x2a2340, 0.75))
    const key = new THREE.DirectionalLight(0xfff0dd, 1.5)
    key.position.set(9, 14, 7); key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -10; key.shadow.camera.right = 12
    key.shadow.camera.top = 12; key.shadow.camera.bottom = -6
    key.shadow.bias = -0.0005
    scene.add(key)
    const lamp = new THREE.PointLight(0xffd9a0, 22, 9, 2); lamp.position.set(0.9, 2.2, 5.6); scene.add(lamp)
    const accentLight = new THREE.PointLight(accent.getHex(), 14, 12, 2); accentLight.position.set(4, 3, 3); scene.add(accentLight)

    // ── Room shell: floor + two back walls (open dollhouse) ──
    const GRID = 7
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a2e52, roughness: 0.9 })
    const floor = new THREE.Mesh(new THREE.BoxGeometry(GRID, 0.2, GRID), floorMat)
    floor.position.set(GRID / 2, -0.1, GRID / 2); floor.receiveShadow = true; scene.add(floor)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2142, roughness: 1 })
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(GRID, 3.2, 0.2), wallMat)
    backWall.position.set(GRID / 2, 1.5, 0); backWall.receiveShadow = true; scene.add(backWall)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, GRID), wallMat)
    leftWall.position.set(0, 1.5, GRID / 2); leftWall.receiveShadow = true; scene.add(leftWall)
    // window on back wall (glowing)
    const winMat = new THREE.MeshStandardMaterial({ color: 0x2a3a80, emissive: 0x3350a0, emissiveIntensity: 0.6, roughness: 0.4 })
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.05), winMat)
    win.position.set(3.4, 1.8, 0.13); win.userData.label = 'Weather · Rainy'; scene.add(win)

    // ── Interactables + character refs ──
    const clickable = []   // {obj, label}
    const g2w = (gx) => gx  // grid == world units here
    let mixer, character, actions = {}, current = null
    const charState = { spot: 'center', pos: new THREE.Vector3(3.4, 0, 3.6), target: new THREE.Vector3(3.4, 0, 3.6), ry: 0, tRy: 0, walking: false, wave: 0 }

    const play = (name, fade = 0.3) => {
      const a = actions[name] || actions['idle']
      if (!a || a === current) return
      a.reset().fadeIn(fade).play()
      if (current) current.fadeOut(fade)
      current = a
    }

    const goTo = (spotKey) => {
      const s = SPOTS[spotKey]; if (!s) return
      charState.spot = spotKey
      charState.target.set(s.x, 0, s.z)
      charState.tRy = (s.ry || 0) * Math.PI / 180
      charState.walking = true
      play('walk')
      setActivity(workingRef.current ? (agent.current_task || 'Working') : (ACTIVITY[spotKey] || 'Idle'))
    }

    // ── Load assets ──
    const loader = new GLTFLoader()
    const models = [...new Set(LAYOUT.map(l => l[0]))]
    Promise.all([
      ...models.map(m => loader.loadAsync(FURN + m + '.glb').then(g => [m, g]).catch(() => [m, null])),
      loader.loadAsync(CHAR).then(g => ['__char', g]).catch(() => ['__char', null]),
    ]).then(results => {
      if (destroyed) return
      const map = Object.fromEntries(results)

      // place furniture
      for (const [model, gx, gz, rdeg, yoff] of LAYOUT) {
        const g = map[model]; if (!g) continue
        const obj = g.scene.clone(true)
        obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
        obj.position.set(g2w(gx), yoff || 0, g2w(gz))
        obj.rotation.y = (rdeg || 0) * Math.PI / 180
        scene.add(obj)
        clickable.push({ obj, label: model })
      }

      // character
      const cg = map['__char']
      if (cg) {
        character = cg.scene
        character.traverse(o => { if (o.isMesh) { o.castShadow = true } })
        // scale to ~1 grid tall
        const box = new THREE.Box3().setFromObject(character)
        const h = box.max.y - box.min.y
        const s = 1.9 / (h || 1)   // a bit taller — the character is the star
        character.scale.setScalar(s)
        character.position.copy(charState.pos)
        scene.add(character)
        mixer = new THREE.AnimationMixer(character)
        for (const clip of cg.animations) actions[clip.name] = mixer.clipAction(clip)
        play('idle', 0)
        clickable.push({ obj: character, label: '__agent' })
      }
      setReady(true)
    })

    // ── Behavior loop ──
    const behave = () => {
      if (workingRef.current) { if (charState.spot !== 'desk') goTo('desk') }
      else { goTo(IDLE_SPOTS[Math.floor(Math.random() * IDLE_SPOTS.length)]) }
    }
    behave()
    const bi = setInterval(behave, 7000 + Math.random() * 4000)
    const wi = setInterval(() => { if (workingRef.current && charState.spot !== 'desk') goTo('desk') }, 1500)

    // ── Interaction ──
    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2()
    let downXY = null
    const onDown = (e) => { downXY = [e.clientX, e.clientY] }
    const onUp = (e) => {
      if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 5) return  // drag, not click
      const r = renderer.domElement.getBoundingClientRect()
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(mouse, camera)
      const hits = ray.intersectObjects(clickable.map(c => c.obj), true)
      onSelect?.(agent.id)
      if (!hits.length) return
      let node = hits[0].object
      let entry = null
      while (node && !entry) { entry = clickable.find(c => c.obj === node); node = node.parent }
      if (!entry) return
      if (entry.label === '__agent') { charState.wave = 1.2; play('emote-yes', 0.15) }
      else { const lbl = entry.obj.userData.label || labelFor(entry.label); setActivity(lbl); setTimeout(() => setActivity(a => a), 10) }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    // ── Render loop ──
    const clock = new THREE.Clock()
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const dt = clock.getDelta()
      if (mixer) mixer.update(dt)
      controls.update()
      // character move
      if (character) {
        const d = charState.pos.distanceTo(charState.target)
        if (charState.walking && d > 0.06) {
          const dir = charState.target.clone().sub(charState.pos).normalize()
          charState.pos.addScaledVector(dir, Math.min(dt * 2.2, d))
          charState.ry = Math.atan2(dir.x, dir.z)
          character.rotation.y = charState.ry
        } else if (charState.walking) {
          charState.walking = false
          charState.ry = charState.tRy; character.rotation.y = charState.tRy
          const s = SPOTS[charState.spot]
          play(workingRef.current && charState.spot === 'desk' ? 'interact-right' : (s?.clip || 'idle'))
        }
        character.position.copy(charState.pos)
        if (charState.wave > 0) { charState.wave -= dt; if (charState.wave <= 0) play('idle', 0.2) }
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      destroyed = true
      cancelAnimationFrame(raf)
      clearInterval(bi); clearInterval(wi)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse(o => { if (o.isMesh) { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m?.dispose?.()) } })
      renderer.dispose()
      if (host) host.innerHTML = ''
    }
  }, [width, height, agent.id, agent.accent])  // eslint-disable-line

  return (
    <div style={{ position: 'relative', width, height, borderRadius: 20, overflow: 'hidden',
      border: '1px solid rgba(150,110,255,0.3)', boxShadow: '0 12px 46px rgba(0,0,0,0.5)',
      background: 'radial-gradient(120% 100% at 60% 10%, rgba(50,30,90,0.5), rgba(8,6,18,0.98))' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: '#8E86B8' }}>building room…</div>
      )}
      <div style={{ position: 'absolute', top: 12, left: 14, fontFamily: 'Share Tech Mono, monospace',
        fontSize: 10, letterSpacing: '0.22em', color: '#B9A6FF', textShadow: '0 1px 6px #000', pointerEvents: 'none' }}>
        ROOM — {agent.name.toUpperCase()}
      </div>
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 600, letterSpacing: '0.04em',
        color: agent.status === 'Working' ? (agent.accent || '#B96CFF') : '#EDE8FF',
        textShadow: '0 1px 8px #000', pointerEvents: 'none' }}>
        {activity}{agent.status === 'Working' ? '' : '…'}
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 12, fontFamily: 'Share Tech Mono, monospace',
        fontSize: 7.5, color: '#5E587A', pointerEvents: 'none' }}>drag to orbit · scroll to zoom · art: Kenney (CC0)</div>
    </div>
  )
}

function labelFor(model) {
  const m = model.toLowerCase()
  if (m.includes('bed')) return 'Sleeping'
  if (m.includes('desk') || m.includes('computer') || m.includes('chair')) return 'At the computer'
  if (m.includes('book')) return 'Knowledge'
  if (m.includes('sofa') || m.includes('lounge')) return 'Relaxing'
  if (m.includes('plant')) return 'Watering the plant'
  if (m.includes('lamp')) return 'Cozy lighting'
  return 'Idle'
}
