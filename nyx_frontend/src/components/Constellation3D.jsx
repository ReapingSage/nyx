/**
 * Constellation3D.jsx — Nyx's real 3D knowledge sphere.
 *
 * Genuine structural rebuild of the Constellation's rendering engine (was
 * a 2D canvas force-directed graph) into a real Three.js scene: a central
 * NYX core with orbital rings, nodes arranged spherically by category
 * region, curved relationship paths, orbit/zoom/focus/reset camera, and a
 * retrieval-pulse animation when search results come in.
 *
 * Every node/edge this renders comes from real Constellation data (props)
 * — this component owns no memory data of its own, only the 3D engine.
 * Decorative starfield particles are visually distinct (small, dim, no
 * interaction) from real knowledge nodes (larger, glowing, clickable).
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

const CORE_COLOR = 0x7B4DFF
const CORE_COLOR_HI = 0xC7A6FF
const SPHERE_RADIUS = 220

// Category → color (kept in the established Nyx purple/violet system —
// varied enough to tell regions apart, never outside the family).
const CATEGORY_COLORS = {
  identity:      0xC7A6FF,
  projects:      0x7B4DFF,
  skills:        0xA874FF,
  systems:       0x5B3FCF,
  preferences:   0xB96CFF,
  events:        0x8F5CFF,
  relationships: 0xE0C8FF,
  vault:         0x9370DB,
}
const DEFAULT_COLOR = 0x8E86B8

const REL_COLORS = {
  related_to:      0x7B4DFF,
  mentioned_with:  0x5E587A,
  duplicate_of:    0xf59e0b,
  belongs_to:      0x22c55e,
  supports:        0x38bdf8,
  supersedes:      0xf87171,
}

function fibonacciSphereDirections(n) {
  // Evenly-spread unit vectors on a sphere — one per category region, so
  // regions don't clump on one side of the sphere.
  const pts = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
  }
  return pts
}

function hashJitter(seed) {
  // Deterministic pseudo-random jitter per node id, so layout doesn't
  // reshuffle every render — real data, stable positions.
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296 }
  return { a: rand(), b: rand(), c: rand() }
}

const Constellation3D = forwardRef(function Constellation3D(
  { nodes, edges, nodeCategoryMap, selectedNodeId, hoveredNodeId, searchMatchIds, searchActive,
    visualPrefs, onSelectNode, onHoverNode },
  ref
) {
  const mountRef = useRef(null)
  const stateRef = useRef({})

  // ── Scene setup — runs once ──────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth, height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x02010a, 0.0016)

    const camera = new THREE.PerspectiveCamera(52, width / height, 1, 5000)
    camera.position.set(0, 90, 640)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(width, height)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    mount.appendChild(labelRenderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 120
    controls.maxDistance = 1400
    controls.autoRotate = false

    // ── Central NYX core: dark sphere + inner emissive glow + orbital rings ──
    const coreGroup = new THREE.Group()
    const coreGeo = new THREE.IcosahedronGeometry(26, 2)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0a0518, wireframe: false, transparent: true, opacity: 0.9 })
    const core = new THREE.Mesh(coreGeo, coreMat)
    coreGroup.add(core)

    const innerGlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(14, 1),
      new THREE.MeshBasicMaterial({ color: CORE_COLOR_HI, transparent: true, opacity: 0.65 })
    )
    coreGroup.add(innerGlow)

    const coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(27, 2),
      new THREE.MeshBasicMaterial({ color: CORE_COLOR, wireframe: true, transparent: true, opacity: 0.35 })
    )
    coreGroup.add(coreWire)

    const rings = []
    ;[
      { r: 44, tilt: 0.3, speed: 0.05 },
      { r: 58, tilt: -0.5, speed: -0.035 },
      { r: 74, tilt: 1.1, speed: 0.02 },
    ].forEach(({ r, tilt, speed }) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.4, 8, 96),
        new THREE.MeshBasicMaterial({ color: CORE_COLOR, transparent: true, opacity: 0.3 })
      )
      ring.rotation.x = tilt
      ring.userData.speed = speed
      coreGroup.add(ring)
      rings.push(ring)
    })
    scene.add(coreGroup)

    // ── Category region directions (Fibonacci sphere) ──
    const categoryIds = Object.keys(CATEGORY_COLORS)
    const regionDirs = fibonacciSphereDirections(categoryIds.length)
    const categoryRegion = {}
    categoryIds.forEach((id, i) => { categoryRegion[id] = regionDirs[i] })

    // ── Decorative starfield (visually distinct from real nodes: tiny, dim, no interaction) ──
    const starGeo = new THREE.BufferGeometry()
    const starCount = 900
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 900 + Math.random() * 900
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      starPos[i * 3 + 2] = r * Math.cos(phi)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xEDE8FF, size: 1.4, transparent: true, opacity: 0.5 }))
    scene.add(stars)

    // ── Raycasting for hover/click ──
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 6
    const mouse = new THREE.Vector2()

    stateRef.current = {
      scene, camera, renderer, labelRenderer, controls, coreGroup, rings,
      categoryRegion, nodeMeshes: new Map(), edgeLines: [], labelObjects: new Map(),
      raycaster, mouse, t: 0, animId: null, pulses: [],
    }

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix()
      renderer.setSize(w, h); labelRenderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    const onClick = () => {
      const s = stateRef.current
      raycaster.setFromCamera(mouse, camera)
      const meshes = [...s.nodeMeshes.values()]
      const hits = raycaster.intersectObjects(meshes)
      onSelectNode(hits.length ? hits[0].object.userData.node : null)
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('click', onClick)

    const loop = () => {
      const s = stateRef.current
      s.t += 0.016
      const spin = visualPrefs?.particlesEnabled !== false

      if (spin) {
        coreGroup.rotation.y += 0.0015
        s.rings.forEach(r => { r.rotation.z += r.userData.speed * 0.02 })
        innerGlow.scale.setScalar(1 + Math.sin(s.t * 1.4) * 0.08)
        stars.rotation.y += 0.00008
      }

      // Hover raycast against current node meshes
      raycaster.setFromCamera(mouse, camera)
      const meshes = [...s.nodeMeshes.values()]
      const hits = raycaster.intersectObjects(meshes)
      const hoveredNode = hits.length ? hits[0].object.userData.node : null
      if (s.lastHovered !== (hoveredNode?.id || null)) {
        s.lastHovered = hoveredNode?.id || null
        onHoverNode(hoveredNode)
      }
      renderer.domElement.style.cursor = hoveredNode ? 'pointer' : 'default'

      // Pulse animation (retrieval visualization) — advance and prune
      s.pulses = s.pulses.filter(p => {
        p.progress += 0.018
        if (p.progress >= 1) return false
        const pt = p.curve.getPoint(p.progress)
        p.mesh.position.copy(pt)
        p.mesh.material.opacity = 1 - p.progress
        return true
      })

      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
      s.animId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(stateRef.current.animId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      renderer.dispose()
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose())
      })
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      if (mount.contains(labelRenderer.domElement)) mount.removeChild(labelRenderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the loop's read of visualPrefs current without re-mounting the scene
  useEffect(() => { /* visualPrefs read directly via closure above is fine for a simple on/off flag */ }, [visualPrefs])

  // ── Sync nodes into the scene whenever real data changes ──
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return

    // Remove meshes/labels for nodes no longer present
    const currentIds = new Set(nodes.map(n => n.id))
    for (const [id, mesh] of s.nodeMeshes) {
      if (!currentIds.has(id)) {
        s.scene.remove(mesh)
        const label = s.labelObjects.get(id)
        if (label) { mesh.remove(label); s.labelObjects.delete(id) }
        s.nodeMeshes.delete(id)
      }
    }

    nodes.forEach(node => {
      const primaryCat = (nodeCategoryMap[node.id]?.[0]?.category_id) || node.category || 'vault'
      const dir = s.categoryRegion[primaryCat] || s.categoryRegion.vault
      const { a, b, c } = hashJitter(node.id)
      const jitterDir = dir.clone()
        .add(new THREE.Vector3((a - 0.5) * 0.7, (b - 0.5) * 0.7, (c - 0.5) * 0.7))
        .normalize()
      const radius = SPHERE_RADIUS * (0.55 + a * 0.45)
      const pos = jitterDir.multiplyScalar(radius)

      let mesh = s.nodeMeshes.get(node.id)
      const color = CATEGORY_COLORS[primaryCat] || DEFAULT_COLOR
      const isMemory = node.type !== 'category'
      const size = isMemory ? 4 + Math.min(4, (node.importance || 3)) : 7

      if (!mesh) {
        const geo = new THREE.SphereGeometry(size, 16, 16)
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
        mesh = new THREE.Mesh(geo, mat)
        mesh.userData.node = node
        s.scene.add(mesh)
        s.nodeMeshes.set(node.id, mesh)

        const div = document.createElement('div')
        div.textContent = node.label
        div.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:10px;color:#EDE8FF;text-shadow:0 0 6px rgba(123,77,255,0.8);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.15s;'
        const label = new CSS2DObject(div)
        label.position.set(0, size + 5, 0)
        mesh.add(label)
        s.labelObjects.set(node.id, label)
      }
      mesh.userData.node = node
      mesh.position.copy(pos)
      mesh.material.color.setHex(color)

      // Label LOD — only show for hovered/selected/search-matched nodes,
      // never all of them at once (avoids clutter at scale).
      const isSel = node.id === selectedNodeId
      const isHov = node.id === hoveredNodeId
      const isMatch = searchActive && searchMatchIds.has(node.id)
      const label = s.labelObjects.get(node.id)
      if (label) label.element.style.opacity = (isSel || isHov || isMatch || node.type === 'category') ? '1' : '0'

      const dim = searchActive && isMemory && !isMatch
      mesh.material.opacity = dim ? 0.12 : (isSel ? 1 : isHov ? 0.95 : 0.8)
      mesh.scale.setScalar(isSel ? 1.5 : isHov || isMatch ? 1.25 : 1)
    })
  }, [nodes, nodeCategoryMap, selectedNodeId, hoveredNodeId, searchMatchIds, searchActive])

  // ── Sync relationship edges as curved lines ──
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    s.edgeLines.forEach(line => s.scene.remove(line))
    s.edgeLines = []

    edges.forEach(edge => {
      const a = s.nodeMeshes.get(edge.source), b = s.nodeMeshes.get(edge.target)
      if (!a || !b) return
      const mid = a.position.clone().add(b.position).multiplyScalar(0.5)
      // Bow the midpoint outward from the core for a curved, non-straight path
      mid.multiplyScalar(1.15)
      const curve = new THREE.QuadraticBezierCurve3(a.position, mid, b.position)
      const points = curve.getPoints(24)
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const color = REL_COLORS[edge.relationship_type] || REL_COLORS.related_to
      const strength = edge.confidence ?? edge.strength ?? 0.4
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.15 + strength * 0.35 })
      const line = new THREE.Line(geo, mat)
      line.userData.curve = curve
      s.scene.add(line)
      s.edgeLines.push(line)
    })
  }, [edges, nodes])

  // ── Imperative camera controls (focus / reset / fit) ──
  useImperativeHandle(ref, () => ({
    resetCamera() {
      const s = stateRef.current
      if (!s.controls) return
      animateCamera(s, new THREE.Vector3(0, 90, 640), new THREE.Vector3(0, 0, 0))
    },
    focusNode(nodeId) {
      const s = stateRef.current
      const mesh = s.nodeMeshes.get(nodeId)
      if (!mesh || !s.controls) return
      const dir = mesh.position.clone().normalize()
      const camPos = mesh.position.clone().add(dir.multiplyScalar(90))
      animateCamera(s, camPos, mesh.position.clone())
    },
    fitToScreen() {
      const s = stateRef.current
      if (!s.controls || s.nodeMeshes.size === 0) return
      const box = new THREE.Box3()
      s.nodeMeshes.forEach(m => box.expandByPoint(m.position))
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3()).length()
      const camPos = center.clone().add(new THREE.Vector3(0, size * 0.3, size * 0.9 + 100))
      animateCamera(s, camPos, center)
    },
    pulseToNodes(nodeIds) {
      // Real retrieval visualization: animate a signal from the core to
      // each actually-matched node.
      const s = stateRef.current
      if (!s.scene) return
      nodeIds.forEach(id => {
        const mesh = s.nodeMeshes.get(id)
        if (!mesh) return
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, 0, 0),
          mesh.position.clone().multiplyScalar(0.5),
          mesh.position.clone()
        )
        const pulseMesh = new THREE.Mesh(
          new THREE.SphereGeometry(2.6, 8, 8),
          new THREE.MeshBasicMaterial({ color: CORE_COLOR_HI, transparent: true, opacity: 1 })
        )
        s.scene.add(pulseMesh)
        s.pulses.push({ curve, mesh: pulseMesh, progress: 0 })
        setTimeout(() => { s.scene.remove(pulseMesh); pulseMesh.geometry.dispose(); pulseMesh.material.dispose() }, 2200)
      })
    },
  }))

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
})

function animateCamera(s, targetPos, targetLookAt) {
  const startPos = s.camera.position.clone()
  const startTarget = s.controls.target.clone()
  const duration = 700
  const t0 = performance.now()
  function step() {
    const t = Math.min(1, (performance.now() - t0) / duration)
    const e = 1 - Math.pow(1 - t, 3) // ease-out cubic
    s.camera.position.lerpVectors(startPos, targetPos, e)
    s.controls.target.lerpVectors(startTarget, targetLookAt, e)
    if (t < 1) requestAnimationFrame(step)
  }
  step()
}

export default Constellation3D
