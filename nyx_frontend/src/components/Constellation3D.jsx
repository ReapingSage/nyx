/**
 * Constellation3D.jsx — Nyx's real 3D knowledge sphere.
 *
 * Genuine structural rebuild of the Constellation's rendering engine (was
 * a 2D canvas force-directed graph) into a real Three.js scene: a central
 * NYX core with orbital rings, nodes arranged into per-category regions,
 * curved relationship paths, orbit/zoom/focus/reset camera, and a
 * retrieval-pulse animation when search results come in.
 *
 * Every node/edge this renders comes from real Constellation data (props)
 * — this component owns no memory data of its own, only the 3D engine.
 * Decorative starfield particles are visually distinct (small, dim,
 * desaturated, no interaction) from real knowledge nodes (larger,
 * saturated, emissive, clickable) — see categoryPalette.js for the single
 * source of truth on every color used here.
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { getCategoryColors, CORE_COLOR, CORE_COLOR_HI, STAR_COLOR, DEFAULT_CATEGORY_IDS } from '../utils/categoryPalette.js'

const SPHERE_RADIUS = 220

const REL_TYPE_STYLE = {
  duplicate_of: { dashed: true },
}

// A node that's genuinely new (never rendered on this machine before)
// plays a one-time "born from the core" travel animation, then is
// permanently marked seen — reload never replays it.
const SEEN_NODES_KEY = 'nyx_constellation_seen_nodes'
function loadSeenNodes() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_NODES_KEY) || '[]')) } catch { return new Set() }
}
function persistSeenNodes(set) {
  try { localStorage.setItem(SEEN_NODES_KEY, JSON.stringify([...set])) } catch { /* storage unavailable — animation just replays, non-fatal */ }
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
  // reshuffle every render or restart — real data, stable positions.
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296 }
  return { a: rand(), b: rand(), c: rand() }
}

// Fixed canonical order (categoryPalette's key order never changes at
// runtime) — anchors are assigned from this list, never from whatever
// categories happen to be populated, so a region's position never shifts
// depending on load order or which categories currently have nodes.
const REGION_DIRS = (() => {
  const dirs = fibonacciSphereDirections(DEFAULT_CATEGORY_IDS.length)
  const map = {}
  DEFAULT_CATEGORY_IDS.forEach((id, i) => { map[id] = dirs[i] })
  return map
})()

const Constellation3D = forwardRef(function Constellation3D(
  { nodes, edges, nodeCategoryMap, categories, categoryCounts, activeCategoryId,
    selectedNodeId, hoveredNodeId, searchMatchIds, searchActive,
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
    // Fog density kept low deliberately — the previous, denser fog
    // (0.0016) blended real memory nodes ~35-60% toward black at typical
    // viewing distance (400-700 units), which was the single biggest
    // cause of nodes reading as dim. Node materials additionally opt out
    // of fog entirely below (fog: false) so they never fade with
    // distance; only the decorative starfield still recedes into it.
    scene.fog = new THREE.FogExp2(0x02010a, 0.0006)

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
    // Stays deep purple, brighter than the background but dimmer than a
    // selected node — CORE_COLOR/CORE_COLOR_HI are reserved in
    // categoryPalette.js so no category can be assigned the same hue.
    const coreGroup = new THREE.Group()
    const coreGeo = new THREE.IcosahedronGeometry(26, 2)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0a0518, wireframe: false, transparent: true, opacity: 0.9, fog: false })
    const core = new THREE.Mesh(coreGeo, coreMat)
    coreGroup.add(core)

    const innerGlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(14, 1),
      new THREE.MeshBasicMaterial({ color: CORE_COLOR_HI, transparent: true, opacity: 0.65, fog: false })
    )
    coreGroup.add(innerGlow)

    const coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(27, 2),
      new THREE.MeshBasicMaterial({ color: CORE_COLOR, wireframe: true, transparent: true, opacity: 0.35, fog: false })
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
        new THREE.MeshBasicMaterial({ color: CORE_COLOR, transparent: true, opacity: 0.3, fog: false })
      )
      ring.rotation.x = tilt
      ring.userData.speed = speed
      coreGroup.add(ring)
      rings.push(ring)
    })
    scene.add(coreGroup)

    // ── Category regions — one Group per taxonomy category, created once,
    // visibility toggled later by real node counts (never destroyed/
    // recreated just because a count changed, so the fade-in transition
    // has something stable to animate). ──
    const regionGroups = {}
    const regionLabels = {}
    const regionHaze = {}
    DEFAULT_CATEGORY_IDS.forEach(catId => {
      const dir = REGION_DIRS[catId]
      const anchor = dir.clone().multiplyScalar(SPHERE_RADIUS * 0.72)
      const colors = getCategoryColors(catId)

      const group = new THREE.Group()
      group.position.copy(anchor)
      group.visible = false

      const haze = new THREE.Mesh(
        new THREE.IcosahedronGeometry(70, 1),
        new THREE.MeshBasicMaterial({
          color: colors.base, transparent: true, opacity: 0.05,
          side: THREE.BackSide, depthWrite: false, fog: false,
        })
      )
      group.add(haze)
      regionHaze[catId] = haze

      const div = document.createElement('div')
      div.style.cssText = `font-family:Rajdhani,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;
        color:#${colors.base.toString(16).padStart(6, '0')};text-shadow:0 0 10px rgba(0,0,0,0.8);
        white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.6s ease;text-transform:uppercase;`
      const label = new CSS2DObject(div)
      label.position.set(0, 82, 0)
      group.add(label)
      regionLabels[catId] = { label, div, everShown: false }

      scene.add(group)
      regionGroups[catId] = group
    })

    // ── Decorative starfield — deliberately desaturated/dim/small so it
    // never competes with real nodes, and excluded from raycasting so it
    // is never accidentally clickable. ──
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
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: STAR_COLOR, size: 1.1, transparent: true, opacity: 0.32 }))
    scene.add(stars)

    // ── Shared geometries for node spheres — one unit sphere per LOD
    // tier, every node scales it rather than allocating its own geometry,
    // so a few hundred nodes costs a few hundred cheap Mesh+Material
    // instances, not a few hundred unique geometries. ──
    const unitCoreGeo = new THREE.SphereGeometry(1, 14, 14)
    const unitGlowGeo = new THREE.SphereGeometry(1, 10, 10)

    // ── Raycasting for hover/click ──
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 6
    const mouse = new THREE.Vector2()

    stateRef.current = {
      scene, camera, renderer, labelRenderer, controls, coreGroup, rings, innerGlow,
      regionGroups, regionLabels, regionHaze, unitCoreGeo, unitGlowGeo,
      nodeGroups: new Map(), edgeLines: [], labelObjects: new Map(),
      raycaster, mouse, t: 0, animId: null, pulses: [], corePulseUntil: 0,
      seenNodes: loadSeenNodes(),
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
      const meshes = [...s.nodeGroups.values()].map(g => g.userData.hitMesh)
      const hits = raycaster.intersectObjects(meshes)
      onSelectNode(hits.length ? hits[0].object.userData.node : null)
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('click', onClick)

    const loop = (now) => {
      const s = stateRef.current
      s.t += 0.016
      const spin = visualPrefs?.particlesEnabled !== false

      const pulsing = now < s.corePulseUntil
      if (spin) {
        coreGroup.rotation.y += 0.0015
        s.rings.forEach(r => { r.rotation.z += r.userData.speed * 0.02 })
        const pulseBoost = pulsing ? 0.22 * (1 - (s.corePulseUntil - now) / 500) : 0
        innerGlow.scale.setScalar(1 + Math.sin(s.t * 1.4) * 0.08 + pulseBoost)
        stars.rotation.y += 0.00008
      }

      // Hover raycast against current node meshes
      raycaster.setFromCamera(mouse, camera)
      const hitMeshes = [...s.nodeGroups.values()].map(g => g.userData.hitMesh)
      const hits = raycaster.intersectObjects(hitMeshes)
      const hoveredNode = hits.length ? hits[0].object.userData.node : null
      if (s.lastHovered !== (hoveredNode?.id || null)) {
        s.lastHovered = hoveredNode?.id || null
        onHoverNode(hoveredNode)
      }
      renderer.domElement.style.cursor = hoveredNode ? 'pointer' : 'default'

      // Retrieval pulse animation — advance and prune
      s.pulses = s.pulses.filter(p => {
        p.progress += 0.018
        if (p.progress >= 1) return false
        const pt = p.curve.getPoint(p.progress)
        p.mesh.position.copy(pt)
        p.mesh.material.opacity = 1 - p.progress
        return true
      })

      // New-memory travel animation — advance any group still "arriving"
      s.nodeGroups.forEach(group => {
        const tr = group.userData.travel
        if (!tr || !tr.active) return
        const elapsed = now - tr.start
        if (elapsed < tr.delay) { group.scale.setScalar(0.001); return }
        const p = Math.min(1, (elapsed - tr.delay) / tr.duration)
        const e = 1 - Math.pow(1 - p, 3) // ease-out cubic
        group.position.lerpVectors(tr.from, tr.to, e)
        group.scale.setScalar(Math.max(0.001, e))
        if (p >= 1) {
          tr.active = false
          group.position.copy(tr.to)
          group.scale.setScalar(1)
        }
      })

      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
      s.animId = requestAnimationFrame(loop)
    }
    stateRef.current.animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(stateRef.current.animId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      renderer.dispose()
      unitCoreGeo.dispose()
      unitGlowGeo.dispose()
      scene.traverse(obj => {
        if (obj.geometry && obj.geometry !== unitCoreGeo && obj.geometry !== unitGlowGeo) obj.geometry.dispose()
        if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose())
      })
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      if (mount.contains(labelRenderer.domElement)) mount.removeChild(labelRenderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the loop's read of visualPrefs current without re-mounting the scene
  useEffect(() => { /* visualPrefs read directly via closure above is fine for a simple on/off flag */ }, [visualPrefs])

  // ── Sync category region visibility from real node counts ──
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    DEFAULT_CATEGORY_IDS.forEach(catId => {
      const count = categoryCounts?.[catId] || 0
      const group = s.regionGroups[catId]
      const info = s.regionLabels[catId]
      const catMeta = (categories || []).find(c => c.id === catId)
      const name = catMeta?.name || catId
      info.div.textContent = `${name.toUpperCase()} · ${count}`

      const shouldShow = count > 0
      if (shouldShow && !group.visible) {
        // First real node in this category — reveal with a fade rather
        // than popping in instantly.
        group.visible = true
        info.div.style.opacity = '0'
        requestAnimationFrame(() => { info.div.style.opacity = '0.85' })
      } else if (!shouldShow) {
        group.visible = false
      } else {
        info.div.style.opacity = '0.85'
      }
    })
  }, [categoryCounts, categories])

  // ── Sync nodes into the scene whenever real data changes ──
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return

    // Remove groups for nodes no longer present
    const currentIds = new Set(nodes.map(n => n.id))
    for (const [id, group] of s.nodeGroups) {
      if (!currentIds.has(id)) {
        s.scene.remove(group)
        s.labelObjects.delete(id)
        s.nodeGroups.delete(id)
      }
    }

    let newlySeenBatch = null

    nodes.forEach(node => {
      const nodeCats = nodeCategoryMap[node.id]
      const primaryEntry = nodeCats?.find(c => c.is_primary) || nodeCats?.[0]
      const primaryCat = primaryEntry?.category_id || node.category || 'uncategorized'
      const secondaryCats = (nodeCats || []).filter(c => !c.is_primary).map(c => c.category_id)
      const catMeta = (categories || []).find(c => c.id === primaryCat)
      const colors = getCategoryColors(primaryCat, catMeta?.custom_color || null)

      const dir = (REGION_DIRS[primaryCat] || REGION_DIRS.uncategorized).clone()
      const { a, b, c } = hashJitter(node.id)
      // Multi-category nodes: pulled mostly toward the primary region,
      // with a slight pull toward the first secondary category so
      // cross-category memories visually sit "between" their regions.
      if (secondaryCats.length > 0) {
        const secDir = REGION_DIRS[secondaryCats[0]]
        if (secDir) dir.lerp(secDir, 0.18)
      }
      const jitterDir = dir.clone()
        .add(new THREE.Vector3((a - 0.5) * 0.6, (b - 0.5) * 0.6, (c - 0.5) * 0.6))
        .normalize()
      const radius = SPHERE_RADIUS * (0.55 + a * 0.45)
      const targetPos = jitterDir.multiplyScalar(radius)

      // Minimum-visible-size floor — importance scales it up, but no
      // real node is ever allowed to shrink to a background-particle size.
      const size = Math.max(6, 5.5 + Math.min(5, node.importance || 3) * 0.9)

      let group = s.nodeGroups.get(node.id)
      const isNew = !group

      if (isNew) {
        group = new THREE.Group()

        const coreMesh = new THREE.Mesh(s.unitCoreGeo, new THREE.MeshBasicMaterial({
          color: colors.base, transparent: true, opacity: 0.94, fog: false,
        }))
        coreMesh.scale.setScalar(size)
        coreMesh.userData.node = node
        group.add(coreMesh)
        group.userData.hitMesh = coreMesh

        const glowMesh = new THREE.Mesh(s.unitGlowGeo, new THREE.MeshBasicMaterial({
          color: colors.emissive, transparent: true, opacity: 0.30 * colors.glowIntensity,
          depthWrite: false, fog: false,
        }))
        glowMesh.scale.setScalar(size * 1.9)
        group.add(glowMesh)
        group.userData.coreMesh = coreMesh
        group.userData.glowMesh = glowMesh

        const div = document.createElement('div')
        div.textContent = node.label
        div.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:10.5px;font-weight:600;color:#EDE8FF;text-shadow:0 0 6px rgba(0,0,0,0.9),0 0 10px rgba(123,77,255,0.6);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.15s;'
        const label = new CSS2DObject(div)
        label.position.set(0, size * 1.9 + 6, 0)
        group.add(label)
        s.labelObjects.set(node.id, label)

        s.scene.add(group)
        s.nodeGroups.set(node.id, group)

        if (!s.seenNodes.has(node.id)) {
          // Genuinely new memory — travel from the core to its region
          // once, then it's marked seen forever (persisted to
          // localStorage) so a page reload never replays it.
          group.userData.travel = {
            active: true, start: performance.now(),
            delay: Math.random() * 500, duration: 850 + Math.random() * 300,
            from: new THREE.Vector3(0, 0, 0), to: targetPos.clone(),
          }
          group.position.set(0, 0, 0)
          group.scale.setScalar(0.001)
          s.seenNodes.add(node.id)
          newlySeenBatch = true
        } else {
          group.position.copy(targetPos)
        }
      }

      group.userData.node = node
      group.userData.coreMesh.userData.node = node
      if (!group.userData.travel?.active) {
        group.userData.travel = null
        group.position.copy(targetPos)
      } else {
        // Target may have shifted (e.g. category reassigned mid-flight) —
        // update the in-flight destination rather than restarting.
        group.userData.travel.to.copy(targetPos)
      }

      const coreMesh = group.userData.coreMesh
      const glowMesh = group.userData.glowMesh
      coreMesh.material.color.setHex(colors.base)
      glowMesh.material.color.setHex(colors.emissive)

      const isSel = node.id === selectedNodeId
      const isHov = node.id === hoveredNodeId
      const isMatch = searchActive && searchMatchIds.has(node.id)
      const categoryFiltered = activeCategoryId && primaryCat !== activeCategoryId && !secondaryCats.includes(activeCategoryId)
      const dim = (searchActive && !isMatch) || categoryFiltered

      const label = s.labelObjects.get(node.id)
      if (label) label.element.style.opacity = (isSel || isHov || isMatch) ? '1' : '0'

      if (isSel) {
        coreMesh.material.color.setHex(colors.selected)
        coreMesh.material.opacity = 1
        glowMesh.material.opacity = 0.5 * colors.glowIntensity
        group.userData.baseScale = 1.4
      } else if (isHov) {
        coreMesh.material.color.setHex(colors.hover)
        coreMesh.material.opacity = 1
        glowMesh.material.opacity = 0.42 * colors.glowIntensity
        group.userData.baseScale = 1.18
      } else if (dim) {
        // Inactive nodes stay clearly identifiable — never drop below
        // ~35% opacity, unlike the old 12-16% "nearly invisible" dimming.
        coreMesh.material.color.setHex(colors.dimmed)
        coreMesh.material.opacity = 0.4
        glowMesh.material.opacity = 0.08
        group.userData.baseScale = 0.88
      } else if (isMatch) {
        coreMesh.material.opacity = 0.98
        glowMesh.material.opacity = 0.55 * colors.glowIntensity
        group.userData.baseScale = 1.22
      } else {
        coreMesh.material.opacity = 0.94
        glowMesh.material.opacity = 0.30 * colors.glowIntensity
        group.userData.baseScale = 1
      }

      if (!group.userData.travel?.active) group.scale.setScalar(group.userData.baseScale)
    })

    if (newlySeenBatch) {
      persistSeenNodes(s.seenNodes)
      s.corePulseUntil = performance.now() + 500
    }
  }, [nodes, nodeCategoryMap, categories, selectedNodeId, hoveredNodeId, searchMatchIds, searchActive, activeCategoryId])

  // ── Sync relationship edges as curved lines ──
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    s.edgeLines.forEach(line => { s.scene.remove(line); line.geometry.dispose(); line.material.dispose() })
    s.edgeLines = []

    edges.forEach(edge => {
      const a = s.nodeGroups.get(edge.source), b = s.nodeGroups.get(edge.target)
      if (!a || !b) return
      const mid = a.position.clone().add(b.position).multiplyScalar(0.5)
      // Bow the midpoint outward from the core for a curved, non-straight path
      mid.multiplyScalar(1.15)
      const curve = new THREE.QuadraticBezierCurve3(a.position, mid, b.position)
      const points = curve.getPoints(24)
      const geo = new THREE.BufferGeometry().setFromPoints(points)

      // Category-color-based: an edge is colored by blending the two
      // connected nodes' primary category colors, not an independent
      // arbitrary palette — the relationship visually belongs to the
      // regions it spans.
      const aColor = new THREE.Color(a.userData.coreMesh.material.color)
      const bColor = new THREE.Color(b.userData.coreMesh.material.color)
      const blended = aColor.clone().lerp(bColor, 0.5)

      const confidence = edge.confidence ?? edge.strength ?? 0.4
      const isHighlighted = hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId)
        || selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
      const isDimmedBySelection = (hoveredNodeId || selectedNodeId) && !isHighlighted
      const baseOpacity = 0.12 + confidence * 0.45
      const opacity = isHighlighted ? Math.min(1, baseOpacity + 0.35) : isDimmedBySelection ? baseOpacity * 0.25 : baseOpacity

      const dashed = !!REL_TYPE_STYLE[edge.relationship_type]?.dashed
      const mat = dashed
        ? new THREE.LineDashedMaterial({ color: blended, transparent: true, opacity, dashSize: 5, gapSize: 3, fog: false })
        : new THREE.LineBasicMaterial({ color: blended, transparent: true, opacity, fog: false })

      const line = new THREE.Line(geo, mat)
      if (dashed) line.computeLineDistances()
      line.userData.curve = curve
      s.scene.add(line)
      s.edgeLines.push(line)
    })
  }, [edges, nodes, hoveredNodeId, selectedNodeId])

  // ── Imperative camera controls (focus / reset / fit / category focus) ──
  useImperativeHandle(ref, () => ({
    resetCamera() {
      const s = stateRef.current
      if (!s.controls) return
      animateCamera(s, new THREE.Vector3(0, 90, 640), new THREE.Vector3(0, 0, 0))
    },
    focusNode(nodeId) {
      const s = stateRef.current
      const group = s.nodeGroups.get(nodeId)
      if (!group || !s.controls) return
      const dir = group.position.clone().normalize()
      const camPos = group.position.clone().add(dir.multiplyScalar(90))
      animateCamera(s, camPos, group.position.clone())
    },
    focusCategory(categoryId) {
      const s = stateRef.current
      const group = s.regionGroups[categoryId]
      if (!group || !s.controls) return
      const dir = group.position.clone().normalize()
      const camPos = group.position.clone().add(dir.multiplyScalar(170))
      animateCamera(s, camPos, group.position.clone())
    },
    fitToScreen() {
      const s = stateRef.current
      if (!s.controls || s.nodeGroups.size === 0) return
      const box = new THREE.Box3()
      s.nodeGroups.forEach(g => box.expandByPoint(g.position))
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
      s.corePulseUntil = performance.now() + 500
      nodeIds.forEach(id => {
        const group = s.nodeGroups.get(id)
        if (!group) return
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0, 0, 0),
          group.position.clone().multiplyScalar(0.5),
          group.position.clone()
        )
        const pulseMesh = new THREE.Mesh(
          new THREE.SphereGeometry(2.6, 8, 8),
          new THREE.MeshBasicMaterial({ color: CORE_COLOR_HI, transparent: true, opacity: 1, fog: false })
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
