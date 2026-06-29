/**
 * MemoryConstellation.jsx — NYX Living Memory Map
 *
 * Real force-directed graph built from actual conversation history.
 * Starts empty. Grows organically as NYX learns the user.
 * Every node is earned — nothing is fabricated.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getConstellation, addMemory, deleteMemory, updateMemory,
  syncConstellation, exportConstellation, openVault,
} from '../services/api.js'

// ── Category config ───────────────────────────────────────────────────────────

const CAT = {
  identity:      { label: 'IDENTITY',      icon: '◉', color: '#C77DFF' },  // bright violet — who you are
  projects:      { label: 'PROJECTS',      icon: '⟨/⟩', color: '#5B8FFF' }, // blue — active work
  skills:        { label: 'SKILLS',        icon: '⚡', color: '#4DC8FF' },  // cyan — capabilities
  systems:       { label: 'SYSTEMS',       icon: '◈', color: '#7B60FF' },  // indigo — structure
  preferences:   { label: 'PREFERENCES',   icon: '◆', color: '#A855F7' },  // purple — taste
  events:        { label: 'EVENTS',        icon: '★', color: '#FF9555' },  // orange — milestones
  relationships: { label: 'RELATIONSHIPS', icon: '♥', color: '#FF7BA5' },  // rose — people
  vault:         { label: 'VAULT NOTES',   icon: '◫', color: '#7BAFFF' },  // sky blue — saved thoughts
}

const CAT_KEYS = Object.keys(CAT)

// ── Force simulation ──────────────────────────────────────────────────────────

function applyForces(nodes, nmap, cx, cy) {
  const REPULSE   = 7000
  const SPRING_K  = 0.055
  const CENTER_K  = 0.0012
  const DAMP      = 0.86
  const LINK_DIST = { 'center-cat': 190, 'cat-mem': 100, 'mem-mem': 145 }

  nodes.forEach(a => {
    if (a.pinned || a.fixed) return
    let fx = 0, fy = 0

    nodes.forEach(b => {
      if (a.id === b.id) return
      const dx = a.x - b.x || 0.01
      const dy = a.y - b.y || 0.01
      const d2 = dx * dx + dy * dy || 1
      const d  = Math.sqrt(d2)
      const f  = REPULSE / d2
      fx += (dx / d) * f
      fy += (dy / d) * f
    })

    fx += (cx - a.x) * CENTER_K
    fy += (cy - a.y) * CENTER_K

    a.vx = ((a.vx || 0) + fx) * DAMP
    a.vy = ((a.vy || 0) + fy) * DAMP
    a.x += a.vx
    a.y += a.vy
  })

  // Link spring forces
  nodes.forEach(node => {
    if (!node.links) return
    node.links.forEach(lk => {
      const src = nmap[lk.source]
      const tgt = nmap[lk.target]
      if (!src || !tgt) return
      const dx   = tgt.x - src.x
      const dy   = tgt.y - src.y
      const dist = Math.hypot(dx, dy) || 1
      const tgt_d = LINK_DIST[lk.type] || 120
      const diff  = (dist - tgt_d) * SPRING_K
      if (!src.pinned && !src.fixed) { src.vx = (src.vx || 0) + (dx / dist) * diff; src.vy = (src.vy || 0) + (dy / dist) * diff }
      if (!tgt.pinned && !tgt.fixed) { tgt.vx = (tgt.vx || 0) - (dx / dist) * diff; tgt.vy = (tgt.vy || 0) - (dy / dist) * diff }
    })
  })
}

// ── Build graph nodes from API data ──────────────────────────────────────────

function buildGraphNodes(apiData, cx, cy, existingNodes) {
  const existing = {}
  existingNodes.forEach(n => { existing[n.id] = n })

  const memories = apiData.nodes || []
  // Always show ALL 8 root categories, regardless of whether memories exist for them
  const allCatIds = Object.keys(CAT)

  const graphNodes = []
  const graphLinks = []
  const nmap       = {}

  // Invisible center anchor for physics
  const center = existing['__center'] || { x: cx, y: cy, vx: 0, vy: 0 }
  const centerNode = { id: '__center', type: 'center', x: center.x, y: center.y, vx: 0, vy: 0, fixed: true, r: 0 }
  graphNodes.push(centerNode)
  nmap['__center'] = centerNode

  // All 8 root category nodes — always present
  allCatIds.forEach((catId, i) => {
    const cfg   = CAT[catId]
    const id    = `__cat_${catId}`
    const angle = (2 * Math.PI / allCatIds.length) * i - Math.PI / 2
    const ex    = existing[id]
    const catNode = {
      id, type: 'category', catId,
      label: cfg.label, icon: cfg.icon, color: cfg.color,
      x:  ex ? ex.x : cx + Math.cos(angle) * 200 + (Math.random() - 0.5) * 16,
      y:  ex ? ex.y : cy + Math.sin(angle) * 200 + (Math.random() - 0.5) * 16,
      vx: ex ? ex.vx : 0,
      vy: ex ? ex.vy : 0,
      r: 26, links: [],
    }
    graphNodes.push(catNode)
    nmap[id] = catNode
    const lk = { source: '__center', target: id, type: 'center-cat', color: cfg.color, strength: 1 }
    graphLinks.push(lk)
    centerNode.links = centerNode.links || []
    centerNode.links.push(lk)
    catNode.links.push(lk)
  })

  // Memory nodes
  memories.forEach(mem => {
    const catId = `__cat_${mem.category}`
    const catNode = nmap[catId]
    if (!catNode) return
    const cfg = CAT[mem.category] || { color: '#7B60FF' }
    const ex  = existing[mem.id]
    const ang = Math.random() * Math.PI * 2
    const memNode = {
      id:        mem.id,
      type:      'memory',
      label:     mem.label,
      category:  mem.category,
      color:     cfg.color,
      confidence:mem.confidence,
      importance:mem.importance,
      mention_count: mem.mention_count,
      source:    mem.source,
      timestamp: mem.timestamp,
      last_referenced: mem.last_referenced,
      days_ago:  mem.days_since_referenced || 0,
      archived:  mem.archived,
      pinned:    mem.pinned,
      tags:      mem.tags || [],
      x:   ex ? ex.x : (catNode.x + Math.cos(ang) * 90 + (Math.random() - 0.5) * 30),
      y:   ex ? ex.y : (catNode.y + Math.sin(ang) * 90 + (Math.random() - 0.5) * 30),
      vx:  ex ? ex.vx : 0,
      vy:  ex ? ex.vy : 0,
      r: 10 + Math.min(5, (mem.importance || 3) - 1) * 1.5,
      links: [],
    }
    graphNodes.push(memNode)
    nmap[mem.id] = memNode
    const lk = { source: catId, target: mem.id, type: 'cat-mem', color: cfg.color, strength: mem.confidence }
    graphLinks.push(lk)
    catNode.links.push(lk)
    memNode.links.push(lk)
  })

  // Cross-memory edges from API
  ;(apiData.edges || []).forEach(edge => {
    const src = nmap[edge.source]
    const tgt = nmap[edge.target]
    if (!src || !tgt) return
    const lk = { source: edge.source, target: edge.target, type: 'mem-mem', color: src.color || '#7B4DFF', strength: edge.strength || 0.3 }
    graphLinks.push(lk)
    src.links.push(lk)
    tgt.links.push(lk)
  })

  return { graphNodes, graphLinks, nmap }
}

// ── hex → rgba ────────────────────────────────────────────────────────────────
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ── Relative time ─────────────────────────────────────────────────────────────
function relTime(iso) {
  if (!iso) return 'unknown'
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60)   return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400)return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MemoryConstellation() {
  const canvasRef  = useRef(null)
  const wrapRef    = useRef(null)
  const stateRef   = useRef({
    nodes: [], links: [], nmap: {}, stars: [], particles: [],
    hoveredId: null, dragging: null,
    cx: 0, cy: 0, w: 0, h: 0, t: 0, animId: null,
    newNodeIds: new Set(), newNodeTimestamps: {},
    filters: { categories: new Set(), sources: new Set(), minConfidence: 0, hideArchived: false },
    scale: 1.0, panX: 0, panY: 0, panning: false, panStart: null,
  })

  const [apiData,       setApiData]       = useState({ nodes: [], edges: [], stats: {} })
  const [stats,         setStats]         = useState({ total_memories: 0, total_edges: 0, categories: 0, last_synced: null })
  const [hoveredNode,   setHoveredNode]   = useState(null)
  const [selectedNode,  setSelectedNode]  = useState(null)
  const [contextMenu,   setContextMenu]   = useState(null) // {x,y,node}
  const [viewMode,      setViewMode]      = useState('constellation')
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [showFilters,   setShowFilters]   = useState(false)
  const [showViewMenu,  setShowViewMenu]  = useState(false)
  const [syncing,       setSyncing]       = useState(false)
  const [syncResult,    setSyncResult]    = useState(null)
  const [filters,       setFilters]       = useState({ categories: new Set(), sources: new Set(), minConfidence: 0, hideArchived: false })
  const [zoom,          setZoom]          = useState(100)
  const [notification,  setNotification]  = useState(null)

  const notify = useCallback((msg, type = 'info') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }, [])

  // Keep filter ref in sync so animation loop can read current filters without re-mounting
  useEffect(() => { stateRef.current.filters = filters }, [filters])

  // Keep scale in sync with zoom slider / wheel events
  useEffect(() => { stateRef.current.scale = zoom / 100 }, [zoom])

  // ── Load data ────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    try {
      const data = await getConstellation()
      setApiData(data)
      setStats(data.stats || {})

      // Track new nodes for spawn animation
      const s = stateRef.current
      const existing = new Set(s.nodes.map(n => n.id))
      const incoming = new Set((data.nodes || []).map(n => n.id))
      const brandNew = [...incoming].filter(id => !existing.has(id))
      const now = Date.now()
      brandNew.forEach(id => {
        s.newNodeIds.add(id)
        s.newNodeTimestamps[id] = now
      })

      if (!silent && brandNew.length > 0)
        notify(`${brandNew.length} new memor${brandNew.length === 1 ? 'y' : 'ies'} added`)

    } catch {
      if (!silent) notify('NYX server offline — constellation shown from local state', 'error')
      // Do NOT clear apiData — keep the graph showing whatever was already loaded
    }
  }, [notify])

  useEffect(() => { loadData(true) }, [loadData])

  // ── Build / update graph whenever apiData changes ────────────────

  useEffect(() => {
    if (!apiData) return
    const s = stateRef.current
    if (s.w === 0) return
    const { graphNodes, graphLinks, nmap } = buildGraphNodes(apiData, s.cx, s.cy, s.nodes)
    s.nodes = graphNodes
    s.links = graphLinks
    s.nmap  = nmap
  }, [apiData])

  // ── Canvas init + resize ─────────────────────────────────────────

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return

    const w = wrap.offsetWidth
    const h = wrap.offsetHeight
    canvas.width  = w
    canvas.height = h
    const cx = w / 2, cy = h / 2

    const s = stateRef.current
    s.cx = cx; s.cy = cy; s.w = w; s.h = h

    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.3 + Math.random() * 1.3,
      base: 0.1 + Math.random() * 0.5,
      sp: 0.4 + Math.random() * 2.2,
      ph: Math.random() * 6.28,
    }))
    const particles = Array.from({ length: 40 }, () => ({
      x: cx + (Math.random() - 0.5) * w * 0.7,
      y: cy + (Math.random() - 0.5) * h * 0.7,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: 0.8 + Math.random() * 1.6,
      alpha: 0.06 + Math.random() * 0.22,
      color: Math.random() > 0.5 ? '#9B72FF' : '#5B7FFF',
    }))
    s.stars     = stars
    s.particles = particles

    // Rebuild graph at new dimensions
    if (apiData) {
      const { graphNodes, graphLinks, nmap } = buildGraphNodes(apiData, cx, cy, s.nodes)
      s.nodes = graphNodes; s.links = graphLinks; s.nmap = nmap
    }
  }, [apiData])

  useEffect(() => {
    initCanvas()
    const obs = new ResizeObserver(initCanvas)
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [initCanvas])

  // ── Animation loop ───────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const NOW = () => Date.now()

    const loop = () => {
      const s = stateRef.current
      const { nodes, nmap, stars, particles, cx, cy, w, h, hoveredId } = s
      if (!w) { s.animId = requestAnimationFrame(loop); return }

      const t = (s.t += 0.016)

      // Physics
      if (nodes.length > 1) applyForces(nodes, nmap, cx, cy)

      // Drift particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
      })

      // ── Background ──
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7)
      bg.addColorStop(0,   'rgba(13,6,30,1)')
      bg.addColorStop(0.5, 'rgba(5,3,15,1)')
      bg.addColorStop(1,   'rgba(2,2,8,1)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Stars
      stars.forEach(st => {
        ctx.save()
        ctx.globalAlpha = st.base * (0.6 + 0.4 * Math.sin(t * st.sp + st.ph))
        ctx.fillStyle   = '#EDE8FF'
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.28); ctx.fill()
        ctx.restore()
      })

      // Ambient fog
      const fog = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280 + Math.sin(t * 0.35) * 15)
      fog.addColorStop(0,   'rgba(80,35,180,0.08)')
      fog.addColorStop(0.5, 'rgba(60,25,140,0.04)')
      fog.addColorStop(1,   'rgba(35,12,80,0)')
      ctx.fillStyle = fog
      ctx.beginPath(); ctx.arc(cx, cy, 360, 0, 6.28); ctx.fill()

      // Particles
      particles.forEach(p => {
        ctx.save()
        ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(t * 1.4 + p.x * 0.02))
        ctx.shadowBlur = 5; ctx.shadowColor = p.color; ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill()
        ctx.restore()
      })

      // ── Filter helper (reads from stateRef so loop doesn't need to re-mount) ──
      const flt = s.filters
      const nodeVisible = (node) => {
        if (node.type !== 'memory') return true
        if (flt.hideArchived && node.archived) return false
        if (flt.categories.size > 0 && !flt.categories.has(node.category)) return false
        if (flt.sources.size > 0 && !flt.sources.has(node.source)) return false
        if ((node.confidence || 0) < flt.minConfidence) return false
        return true
      }

      // ── Apply zoom/pan transform for all graph elements ──
      ctx.save()
      ctx.translate(cx + (s.panX || 0), cy + (s.panY || 0))
      ctx.scale(s.scale || 1, s.scale || 1)
      ctx.translate(-cx, -cy)

      // ── Links ── (skip links that touch the invisible center anchor)
      s.links.forEach(lk => {
        const src = nmap[lk.source]; const tgt = nmap[lk.target]
        if (!src || !tgt) return
        if (src.type === 'center' || tgt.type === 'center') return
        if (!nodeVisible(src) || !nodeVisible(tgt)) return
        const hi    = hoveredId && (lk.source === hoveredId || lk.target === hoveredId ||
          (nmap[hoveredId]?.catId && `__cat_${nmap[hoveredId]?.catId}` === lk.source))
        const alpha = hi ? 0.70 : (lk.strength || 0.3) * 0.5 * (0.8 + 0.2 * Math.sin(t * 1.1 + src.x * 0.007))

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.shadowBlur  = hi ? 14 : 5
        ctx.shadowColor = lk.color
        ctx.strokeStyle = lk.color
        ctx.lineWidth   = hi ? (lk.type === 'mem-mem' ? 1.8 : 2.2) : (lk.type === 'cat-mem' ? 0.9 : 0.7)
        ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke()

        if (hi && lk.type !== 'mem-mem') {
          const prog = ((t * 0.7 + lk.source.charCodeAt(lk.source.length - 1) * 0.015) % 1 + 1) % 1
          ctx.globalAlpha = 0.85; ctx.shadowBlur = 10; ctx.fillStyle = lk.color
          ctx.beginPath()
          ctx.arc(src.x + (tgt.x - src.x) * prog, src.y + (tgt.y - src.y) * prog, 2, 0, 6.28)
          ctx.fill()
        }
        ctx.restore()
      })

      // ── Draw nodes ── (center renders as clean "NYX" label, not an orb)
      nodes.forEach(node => {
        if (node.type === 'center') { drawCenterLabel(ctx, node, t); return }
        if (!nodeVisible(node)) return
        const isHov  = node.id === hoveredId
        const isSel  = node.id === s.selectedId
        const spawnAge = s.newNodeTimestamps[node.id] ? (NOW() - s.newNodeTimestamps[node.id]) / 1000 : 999
        const isNew  = spawnAge < 2.5

        if (node.type === 'category') {
          drawCategory(ctx, node, t, isHov, isSel, isNew, spawnAge)
        } else {
          const decayed = node.days_ago > 60
          drawMemory(ctx, node, t, isHov, isSel, isNew, spawnAge, decayed)
        }
      })

      ctx.restore()
      s.animId = requestAnimationFrame(loop)
    }

    loop()
    return () => cancelAnimationFrame(stateRef.current.animId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mouse events ─────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return

    // Convert screen-canvas coords (relative to canvas rect) → canvas graph space
    const toCanvas = (mx, my) => {
      const s = stateRef.current
      const scale = s.scale || 1
      return [(mx - s.cx - (s.panX || 0)) / scale + s.cx,
              (my - s.cy - (s.panY || 0)) / scale + s.cy]
    }

    const findNode = (mx, my) => {
      const [gx, gy] = toCanvas(mx, my)
      const nodes = stateRef.current.nodes
      for (const n of [...nodes].reverse()) {
        if (n.type === 'center') continue
        if (Math.hypot(n.x - gx, n.y - gy) < (n.r || 14) + 10) return n
      }
      return null
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const s  = stateRef.current

      if (s.panning) {
        s.panX = e.clientX - s.panStart.x
        s.panY = e.clientY - s.panStart.y
        canvas.style.cursor = 'grabbing'
        return
      }

      if (s.dragging) {
        const [gx, gy] = toCanvas(mx, my)
        s.dragging.node.x = gx - s.dragging.ox
        s.dragging.node.y = gy - s.dragging.oy
        s.dragging.node.vx = 0; s.dragging.node.vy = 0
        return
      }

      const found = findNode(mx, my)
      s.hoveredId = found?.id ?? null
      setHoveredNode(found ?? null)
      canvas.style.cursor = found ? 'pointer' : 'default'
    }

    const onDown = (e) => {
      if (e.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const s   = stateRef.current
      const node = findNode(mx, my)
      if (node && node.type !== 'center') {
        const [gx, gy] = toCanvas(mx, my)
        s.dragging = { node, ox: gx - node.x, oy: gy - node.y }
        canvas.style.cursor = 'grabbing'
      } else {
        s.panning  = true
        s.panStart = { x: e.clientX - (s.panX || 0), y: e.clientY - (s.panY || 0) }
        canvas.style.cursor = 'grabbing'
      }
    }

    const onUp = () => {
      const s = stateRef.current
      s.dragging = null
      s.panning  = false
      canvas.style.cursor = s.hoveredId ? 'pointer' : 'default'
    }

    const onClick = (e) => {
      if (e.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const node = findNode(e.clientX - rect.left, e.clientY - rect.top)
      stateRef.current.selectedId = node?.id ?? null
      setSelectedNode(node ?? null)
      setContextMenu(null)
    }

    const onContext = (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const node = findNode(e.clientX - rect.left, e.clientY - rect.top)
      if (node && node.type === 'memory') {
        setContextMenu({ x: e.clientX, y: e.clientY, node })
      } else {
        setContextMenu(null)
      }
    }

    const onWheel = (e) => {
      e.preventDefault()
      const s = stateRef.current
      const delta = e.deltaY > 0 ? -0.10 : 0.10
      const newScale = Math.max(0.25, Math.min(3.5, (s.scale || 1) + delta))
      s.scale = newScale
      setZoom(Math.round(newScale * 100))
    }

    const onLeave = () => {
      const s = stateRef.current
      s.hoveredId = null; s.panning = false; s.dragging = null
      setHoveredNode(null)
    }

    canvas.addEventListener('mousemove',   onMove)
    canvas.addEventListener('mousedown',   onDown)
    canvas.addEventListener('mouseup',     onUp)
    canvas.addEventListener('click',       onClick)
    canvas.addEventListener('contextmenu', onContext)
    canvas.addEventListener('wheel',       onWheel, { passive: false })
    canvas.addEventListener('mouseleave',  onLeave)
    return () => {
      canvas.removeEventListener('mousemove',   onMove)
      canvas.removeEventListener('mousedown',   onDown)
      canvas.removeEventListener('mouseup',     onUp)
      canvas.removeEventListener('click',       onClick)
      canvas.removeEventListener('contextmenu', onContext)
      canvas.removeEventListener('wheel',       onWheel)
      canvas.removeEventListener('mouseleave',  onLeave)
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await syncConstellation()
      await loadData(true)
      setSyncResult(res.new_memories)
      notify(`Sync complete — ${res.new_memories} new memor${res.new_memories === 1 ? 'y' : 'ies'} found`)
    } catch {
      notify('Sync failed — is NYX server running?', 'error')
    } finally {
      setSyncing(false)
    }
  }, [loadData, notify])

  const handleExportJSON = useCallback(async () => {
    try {
      const data = await exportConstellation()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `nyx-memory-${new Date().toISOString().slice(0,10)}.json`
      a.click(); URL.revokeObjectURL(url)
      notify('Memory map exported as JSON')
    } catch { notify('Export failed', 'error') }
  }, [notify])

  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a   = document.createElement('a')
    a.href = url; a.download = `nyx-constellation-${new Date().toISOString().slice(0,10)}.png`
    a.click()
    notify('Constellation exported as PNG')
  }, [notify])

  const handleDeleteNode = useCallback(async (node) => {
    try {
      await deleteMemory(node.id)
      await loadData(true)
      setContextMenu(null); setSelectedNode(null)
      notify(`Memory "${node.label}" removed`)
    } catch { notify('Delete failed', 'error') }
  }, [loadData, notify])

  const handlePinNode = useCallback(async (node) => {
    try {
      await updateMemory(node.id, { pinned: !node.pinned })
      stateRef.current.nodes.forEach(n => { if (n.id === node.id) n.pinned = !node.pinned })
      await loadData(true)
      setContextMenu(null)
      notify(`Memory ${node.pinned ? 'unpinned' : 'pinned'}`)
    } catch { notify('Pin failed', 'error') }
  }, [loadData, notify])

  const handleOpenVault = useCallback(async () => {
    try {
      await openVault()
      notify('Opening Obsidian vault...')
    } catch { notify('Could not open vault', 'error') }
  }, [notify])

  const handleReCenter = useCallback(() => {
    const s = stateRef.current
    s.panX = 0; s.panY = 0; s.scale = 1.0
    setZoom(100)
    s.nodes.forEach(n => { n.vx = 0; n.vy = 0 })
    initCanvas()
  }, [initCanvas])

  // 8 root nodes always visible — graph never blocks on server state
  const hasMemories = (apiData.nodes || []).length > 0
  const isEmpty     = false

  // ── JSX ──────────────────────────────────────────────────────────

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
      onClick={() => setContextMenu(null)}
    >

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <TopBar
        onAddMemory={() => setShowAddModal(true)}
        onShowFilters={() => { setShowFilters(s => !s); setShowViewMenu(false) }}
        onToggleViewMenu={() => { setShowViewMenu(s => !s); setShowFilters(false) }}
        showViewMenu={showViewMenu}
        viewMode={viewMode}
        onSetViewMode={(v) => { setViewMode(v); setShowViewMenu(false) }}
        filtersActive={filters.categories.size > 0 || filters.sources.size > 0 || filters.minConfidence > 0 || filters.hideArchived}
      />

      {/* ── BODY ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Filters panel */}
        <AnimatePresence>
          {showFilters && (
            <FiltersPanel
              filters={filters}
              setFilters={setFilters}
              onClose={() => setShowFilters(false)}
            />
          )}
        </AnimatePresence>

        {/* Canvas area */}
        <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'default' }}
          />

          {/* No memories yet — subtle hint below NYX center, never blocks the graph */}
          <AnimatePresence>
            {!hasMemories && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                  position: 'absolute', bottom: 68, left: '50%', transform: 'translateX(-50%)',
                  pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap',
                }}
              >
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#3E3860', letterSpacing: '0.16em' }}>
                  NO MEMORIES YET — START A CONVERSATION OR ADD ONE MANUALLY
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend — always visible */}
          <div style={{
              position: 'absolute', top: 16, left: 16,
              background: 'rgba(7,5,18,0.78)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(100,70,220,0.16)', borderRadius: 10,
              padding: '12px 16px',
            }}>
              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', color: '#5E587A', marginBottom: 8 }}>LEGEND</div>
              {[
                { c: '#9B72FF', s: 8,  l: 'Category' },
                { c: '#7B5FFF', s: 5,  l: 'Memory node' },
              ].map(({ c, s, l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: s, height: s, borderRadius: '50%', background: c, boxShadow: `0 0 ${s * 2}px ${c}`, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 11, color: '#7E78A8' }}>{l}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <div style={{ width: 18, height: 1, background: 'linear-gradient(90deg,#7B4DFF,#5B7FFF)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 11, color: '#7E78A8' }}>Connected</span>
              </div>
          </div>

          {/* Node hover info card */}
          <AnimatePresence>
            {hoveredNode && hoveredNode.type === 'memory' && (
              <motion.div
                key={hoveredNode.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(8,5,20,0.90)', backdropFilter: 'blur(18px)',
                  border: `1px solid ${hoveredNode.color}44`, borderRadius: 10,
                  padding: '10px 16px', pointerEvents: 'none', minWidth: 180,
                  boxShadow: `0 0 20px ${hoveredNode.color}18`,
                }}
              >
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: hoveredNode.color, letterSpacing: '0.15em', marginBottom: 4 }}>
                  {CAT[hoveredNode.category]?.label ?? hoveredNode.category.toUpperCase()} · {hoveredNode.source}
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 15, fontWeight: 700, color: '#EDE8FF', marginBottom: 6 }}>
                  {hoveredNode.label}
                </div>
                <div style={{ display: 'flex', gap: 14, fontFamily: 'Share Tech Mono', fontSize: 9, color: '#6B6394' }}>
                  <span>conf {Math.round((hoveredNode.confidence || 0) * 100)}%</span>
                  <span>×{hoveredNode.mention_count || 1}</span>
                  <span>{relTime(hoveredNode.last_referenced)}</span>
                </div>
                {hoveredNode.tags?.length > 0 && (
                  <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {hoveredNode.tags.map(t => (
                      <span key={t} style={{ background: hexA(hoveredNode.color, 0.14), border: `1px solid ${hexA(hoveredNode.color, 0.3)}`, borderRadius: 4, padding: '1px 5px', fontSize: 9, color: hoveredNode.color, fontFamily: 'Share Tech Mono' }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 5, fontFamily: 'Share Tech Mono', fontSize: 8, color: '#4a4670' }}>Right-click for options</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Context menu */}
          <AnimatePresence>
            {contextMenu && (
              <ContextMenu
                x={contextMenu.x} y={contextMenu.y} node={contextMenu.node}
                onPin={() => handlePinNode(contextMenu.node)}
                onDelete={() => handleDeleteNode(contextMenu.node)}
                onOpenVault={handleOpenVault}
                onClose={() => setContextMenu(null)}
              />
            )}
          </AnimatePresence>

          {/* Bottom controls */}
          <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(7,5,18,0.80)', backdropFilter: 'blur(14px)', border: '1px solid rgba(100,70,220,0.18)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={{ ...zoomBtnStyle }}>−</button>
              <div style={{ padding: '0 10px', fontFamily: 'Share Tech Mono', fontSize: 11, color: '#C7A6FF', borderLeft: '1px solid rgba(100,70,220,0.18)', borderRight: '1px solid rgba(100,70,220,0.18)', lineHeight: '32px' }}>{zoom}%</div>
              <button onClick={() => setZoom(z => Math.min(200, z + 10))} style={{ ...zoomBtnStyle }}>+</button>
            </div>
            <button onClick={handleReCenter} style={{ ...controlBtnStyle }}>Re-Center</button>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────── */}
        <RightSidebar
          stats={stats}
          selectedNode={selectedNode}
          syncing={syncing}
          syncResult={syncResult}
          onSync={handleSync}
          onExportJSON={handleExportJSON}
          onExportPNG={handleExportPNG}
          onOpenVault={handleOpenVault}
          onAddMemory={() => setShowAddModal(true)}
        />
      </div>

      {/* ── MODALS ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemoryModal
            onClose={() => setShowAddModal(false)}
            onSave={async (data) => {
              try {
                await addMemory(data)
                await loadData()
                setShowAddModal(false)
                notify(`Memory Saved — "${data.label}"`, 'success')
              } catch {
                notify('Save failed — make sure NYX server is running', 'error')
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification.msg}
            initial={{ opacity: 0, y: 28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            style={{
              position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
              background: notification.type === 'error'
                ? 'rgba(130,18,36,0.94)'
                : notification.type === 'success'
                  ? 'rgba(14,90,55,0.94)'
                  : 'rgba(35,18,80,0.94)',
              border: `1px solid ${
                notification.type === 'error'   ? 'rgba(240,60,80,0.45)'  :
                notification.type === 'success' ? 'rgba(52,211,130,0.50)' :
                                                  'rgba(130,80,255,0.40)'
              }`,
              backdropFilter: 'blur(18px)', borderRadius: 12,
              padding: '12px 24px',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 15, fontWeight: 600,
              letterSpacing: '0.06em', color: '#EDE8FF',
              boxShadow: notification.type === 'success'
                ? '0 0 28px rgba(52,211,130,0.20), 0 6px 24px rgba(0,0,0,0.5)'
                : '0 6px 24px rgba(0,0,0,0.5)',
              zIndex: 1200, pointerEvents: 'none', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            {notification.type === 'success' && (
              <span style={{ fontSize: 16, color: '#34D399' }}>✓</span>
            )}
            {notification.type === 'error' && (
              <span style={{ fontSize: 14, color: '#F87171' }}>✕</span>
            )}
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Canvas draw functions ─────────────────────────────────────────────────────

function drawCenterLabel(ctx, node, t) {
  const pulse = 0.7 + 0.3 * Math.sin(t * 1.6)
  ctx.save()

  // Faint radial glow behind the text
  const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 42)
  glow.addColorStop(0, `rgba(160,90,255,${0.10 * pulse})`)
  glow.addColorStop(1, 'rgba(80,30,160,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(node.x, node.y, 42, 0, 6.28); ctx.fill()

  // Small center dot
  ctx.globalAlpha = 0.55 + 0.35 * pulse
  ctx.shadowBlur  = 10; ctx.shadowColor = '#C7A6FF'
  ctx.fillStyle   = '#C7A6FF'
  ctx.beginPath(); ctx.arc(node.x, node.y, 3, 0, 6.28); ctx.fill()

  // "NYX" label
  ctx.globalAlpha  = 0.60 + 0.25 * pulse
  ctx.shadowBlur   = 6; ctx.shadowColor = '#C7A6FF'
  ctx.fillStyle    = '#C7A6FF'
  ctx.font         = '700 13px Rajdhani, sans-serif'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('NYX', node.x, node.y + 14)

  ctx.restore()
}

function drawCategory(ctx, node, t, isHov, isSel, isNew, spawnAge) {
  const r   = isHov ? node.r + 4 : node.r
  const glw = isHov ? 28 : 14
  const newBoost = isNew ? Math.max(0, 1 - spawnAge / 2.5) : 0
  ctx.save()

  if (newBoost > 0) {
    ctx.globalAlpha = newBoost * 0.35
    ctx.shadowBlur = 40; ctx.shadowColor = node.color
    ctx.fillStyle = hexA(node.color, 0.22)
    ctx.beginPath(); ctx.arc(node.x, node.y, r * 3, 0, 6.28); ctx.fill()
    ctx.globalAlpha = 1
  }

  const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.5)
  halo.addColorStop(0, hexA(node.color, 0.12 + newBoost * 0.1))
  halo.addColorStop(1, hexA(node.color, 0))
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(node.x, node.y, r * 2.5, 0, 6.28); ctx.fill()

  ctx.shadowBlur = glw + newBoost * 20; ctx.shadowColor = node.color
  ctx.fillStyle  = 'rgba(8,5,20,0.90)'
  ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 6.28); ctx.fill()
  ctx.strokeStyle = isHov || isSel ? node.color : hexA(node.color, 0.65)
  ctx.lineWidth   = isHov ? 2 : 1.5; ctx.stroke()

  ctx.shadowBlur = 0
  ctx.fillStyle  = isHov ? '#F3EDFF' : node.color
  ctx.font       = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(node.icon, node.x, node.y - 4)

  ctx.fillStyle    = isHov ? '#F3EDFF' : '#C7A6FF'
  ctx.font         = '700 9px Rajdhani, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(node.label, node.x, node.y + r + 7)
  ctx.restore()
}

function drawMemory(ctx, node, t, isHov, isSel, isNew, spawnAge, decayed) {
  const r   = isHov ? node.r + 3 : node.r
  const conf = node.confidence || 0.7
  const baseAlpha = decayed ? 0.45 : conf
  const newBoost  = isNew ? Math.max(0, 1 - spawnAge / 2.5) : 0
  ctx.save()

  if (newBoost > 0) {
    ctx.globalAlpha = newBoost * 0.6
    ctx.shadowBlur = 30; ctx.shadowColor = node.color
    ctx.strokeStyle = node.color; ctx.lineWidth = 1
    for (let ring = 1; ring <= 3; ring++) {
      const rr = r * (1 + ring * 0.8 * (1 - spawnAge / 2.5))
      ctx.globalAlpha = newBoost * 0.4 / ring
      ctx.beginPath(); ctx.arc(node.x, node.y, rr, 0, 6.28); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  ctx.globalAlpha = 0.5 + baseAlpha * 0.5
  ctx.shadowBlur  = isHov ? 18 : 7; ctx.shadowColor = node.color
  ctx.fillStyle   = isHov ? hexA(node.color, 0.38) : 'rgba(8,5,20,0.80)'
  ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 6.28); ctx.fill()
  ctx.strokeStyle = hexA(node.color, isHov ? 0.88 : 0.45 + conf * 0.3); ctx.lineWidth = 1; ctx.stroke()

  ctx.shadowBlur   = isHov ? 8 : 0; ctx.shadowColor = node.color
  ctx.fillStyle    = decayed ? '#4a4670' : (isHov ? '#F3EDFF' : hexA(node.color, 0.85 + conf * 0.15))
  ctx.font         = `${isHov ? '600' : '400'} 10px Rajdhani, sans-serif`
  ctx.textAlign    = 'center'; ctx.textBaseline = 'top'
  ctx.globalAlpha  = decayed ? 0.5 : 1
  ctx.fillText(node.label, node.x, node.y + r + 4)
  ctx.restore()
}

// ── Sub-components ────────────────────────────────────────────────────────────

const zoomBtnStyle = { width: 32, height: 32, background: 'none', border: 'none', color: '#8E86B8', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const controlBtnStyle = { height: 32, padding: '0 14px', background: 'rgba(7,5,18,0.80)', backdropFilter: 'blur(14px)', border: '1px solid rgba(100,70,220,0.18)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#8E86B8' }

function GlassButton({ children, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
        background: primary ? 'linear-gradient(135deg,rgba(100,55,220,0.5),rgba(70,30,180,0.4))' : 'rgba(8,6,22,0.65)',
        border: `1px solid ${primary ? 'rgba(155,114,255,0.45)' : 'rgba(100,70,220,0.22)'}`,
        fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600,
        letterSpacing: '0.12em', color: primary ? '#EDE8FF' : '#8E86B8',
        boxShadow: primary ? '0 0 16px rgba(100,55,220,0.18)' : 'none',
      }}
    >{children}</button>
  )
}

const VIEW_MODES = [
  { id: 'constellation', label: 'Constellation', desc: 'Neural network view' },
  { id: 'cluster',       label: 'Cluster',        desc: 'Grouped by category' },
  { id: 'timeline',      label: 'Timeline',       desc: 'Sorted by date' },
]

function TopBar({ onAddMemory, onShowFilters, onToggleViewMenu, showViewMenu, viewMode, onSetViewMode, filtersActive }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 52, flexShrink: 0, borderBottom: '1px solid rgba(100,70,220,0.13)', background: 'rgba(5,3,14,0.70)', backdropFilter: 'blur(20px)', zIndex: 20, position: 'relative' }}>
      <div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: '0.26em', color: '#C7A6FF', textShadow: '0 0 16px rgba(199,166,255,0.45)' }}>NYX MEMORY CONSTELLATION</div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: '#5E587A', letterSpacing: '0.14em' }}>Earned through conversation. Growing over time.</div>
      </div>
      <div style={{ flex: 1 }} />

      {/* Filters */}
      <button onClick={onShowFilters} style={{ display: 'flex', alignItems: 'center', gap: 6, background: filtersActive ? 'rgba(80,40,180,0.25)' : 'rgba(8,6,20,0.65)', border: `1px solid ${filtersActive ? 'rgba(155,114,255,0.45)' : 'rgba(100,70,220,0.20)'}`, borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', color: filtersActive ? '#C7A6FF' : '#8E86B8' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        Filters{filtersActive ? ' ●' : ''}
      </button>

      {/* View mode */}
      <div style={{ position: 'relative' }}>
        <button onClick={onToggleViewMenu} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(8,6,20,0.65)', border: '1px solid rgba(100,70,220,0.20)', borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', color: '#C7A6FF' }}>
          View: {VIEW_MODES.find(v => v.id === viewMode)?.label}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <AnimatePresence>
          {showViewMenu && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: '110%', right: 0, minWidth: 180, background: 'rgba(8,6,22,0.96)', backdropFilter: 'blur(18px)', border: '1px solid rgba(100,70,220,0.25)', borderRadius: 10, overflow: 'hidden', zIndex: 200 }}>
              {VIEW_MODES.map(v => (
                <button key={v.id} onClick={() => onSetViewMode(v.id)} style={{ display: 'block', width: '100%', padding: '10px 16px', background: viewMode === v.id ? 'rgba(100,55,220,0.20)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderLeft: `2px solid ${viewMode === v.id ? '#C7A6FF' : 'transparent'}` }}>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.10em', color: viewMode === v.id ? '#C7A6FF' : '#8E86B8' }}>{v.label}</div>
                  <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 10, color: '#5E587A', marginTop: 1 }}>{v.desc}</div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Memory */}
      <button onClick={onAddMemory} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(100,55,220,0.55),rgba(70,30,180,0.45))', border: '1px solid rgba(155,114,255,0.48)', borderRadius: 8, padding: '7px 15px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#EDE8FF', boxShadow: '0 0 18px rgba(100,55,220,0.22)' }}>
        + Add Memory
      </button>
    </div>
  )
}

function RightSidebar({ stats, selectedNode, syncing, syncResult, onSync, onExportJSON, onExportPNG, onOpenVault, onAddMemory }) {
  const [showExport, setShowExport] = useState(false)

  return (
    <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 12px', overflowY: 'auto', background: 'rgba(4,3,12,0.60)', backdropFilter: 'blur(22px)', borderLeft: '1px solid rgba(100,70,220,0.13)' }}>

      {/* Selected node info */}
      <AnimatePresence>
        {selectedNode?.type === 'memory' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(7,5,18,0.65)', border: `1px solid ${selectedNode.color}33`, borderRadius: 11, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: selectedNode.color, letterSpacing: '0.16em', marginBottom: 5 }}>SELECTED</div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 700, color: '#EDE8FF', marginBottom: 8 }}>{selectedNode.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: 'Share Tech Mono', fontSize: 9, color: '#6B6394' }}>
              <span>conf {Math.round((selectedNode.confidence || 0) * 100)}%</span>
              <span>×{selectedNode.mention_count || 1} mentions</span>
              <span>{CAT[selectedNode.category]?.label}</span>
              <span>{selectedNode.source}</span>
            </div>
            {selectedNode.tags?.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {selectedNode.tags.map(t => <span key={t} style={{ background: hexA(selectedNode.color, 0.12), border: `1px solid ${hexA(selectedNode.color, 0.28)}`, borderRadius: 4, padding: '1px 5px', fontSize: 9, color: selectedNode.color, fontFamily: 'Share Tech Mono' }}>{t}</span>)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <SidePanel title="CONNECTIONS">
        {[
          { icon: '◈', label: 'Total Memories',  val: stats.total_memories  ?? 0 },
          { icon: '⬡', label: 'Connections',     val: stats.total_edges     ?? 0 },
          { icon: '◇', label: 'Categories',      val: stats.categories      ?? 0 },
          { icon: '◎', label: 'Last Synced',     val: stats.last_synced ? relTime(stats.last_synced) : '—' },
        ].map(({ icon, label, val }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(100,70,200,0.08)' }}>
            <span style={{ color: '#7B4DFF', fontSize: 11, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 11, color: '#8E86B8', flex: 1 }}>{label}</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#C7A6FF' }}>{val}</span>
          </div>
        ))}
      </SidePanel>

      {/* Category breakdown */}
      {stats.total_memories > 0 && (
        <SidePanel title="CATEGORIES">
          <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 11, color: '#6B6394', lineHeight: 1.6 }}>
            {Object.entries(CAT).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ color: v.color, fontSize: 10 }}>{v.icon}</span>
                <span style={{ color: '#8E86B8' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </SidePanel>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 'auto' }}>
        {/* Sync Now */}
        <motion.button
          onClick={onSync}
          whileTap={{ scale: 0.97 }}
          disabled={syncing}
          style={{ width: '100%', padding: '10px 0', background: 'linear-gradient(135deg,rgba(100,55,220,0.45),rgba(70,30,180,0.38))', border: '1px solid rgba(155,114,255,0.42)', borderRadius: 9, cursor: syncing ? 'default' : 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#EDE8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 0 16px rgba(100,55,220,0.18)' }}
        >
          <motion.span animate={syncing ? { rotate: 360 } : {}} transition={syncing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}>⟳</motion.span>
          {syncing ? 'Scanning...' : syncResult !== null ? `Synced (${syncResult} new)` : 'Sync Now'}
        </motion.button>

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExport(s => !s)} style={{ width: '100%', padding: '9px 0', background: 'rgba(7,5,18,0.65)', border: '1px solid rgba(100,70,220,0.20)', borderRadius: 9, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#8E86B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            ↗ Export Map
          </button>
          <AnimatePresence>
            {showExport && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', bottom: '110%', left: 0, right: 0, background: 'rgba(8,6,22,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(100,70,220,0.22)', borderRadius: 9, overflow: 'hidden', zIndex: 100 }}>
                {[
                  { label: 'Export as JSON', action: () => { onExportJSON(); setShowExport(false) } },
                  { label: 'Export as PNG',  action: () => { onExportPNG();  setShowExport(false) } },
                ].map(({ label, action }) => (
                  <button key={label} onClick={action} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.10em', color: '#B9A6FF', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,55,220,0.18)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >{label}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button onClick={onOpenVault} style={{ width: '100%', padding: '9px 0', background: 'rgba(7,5,18,0.65)', border: '1px solid rgba(100,70,220,0.20)', borderRadius: 9, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#8E86B8' }}>
          ◫ Open Vault
        </button>
      </div>
    </div>
  )
}

function SidePanel({ title, children }) {
  return (
    <div style={{ background: 'rgba(7,5,18,0.65)', border: '1px solid rgba(100,70,220,0.16)', borderRadius: 11, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.20em', color: '#5E587A', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function FiltersPanel({ filters, setFilters, onClose }) {
  const toggle = (setKey, val) => setFilters(f => {
    const s = new Set(f[setKey])
    s.has(val) ? s.delete(val) : s.add(val)
    return { ...f, [setKey]: s }
  })
  return (
    <motion.div initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{ width: 240, flexShrink: 0, background: 'rgba(6,4,16,0.94)', backdropFilter: 'blur(22px)', borderRight: '1px solid rgba(100,70,220,0.18)', padding: '16px 14px', overflowY: 'auto', zIndex: 50 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#C7A6FF' }}>FILTERS</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5E587A', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      <FilterSection title="CATEGORY">
        {Object.entries(CAT).map(([k, v]) => (
          <FilterChip key={k} label={v.label} color={v.color} active={filters.categories.has(k)} onClick={() => toggle('categories', k)} />
        ))}
      </FilterSection>

      <FilterSection title="SOURCE">
        {['chat', 'voice', 'vault', 'manual'].map(src => (
          <FilterChip key={src} label={src.toUpperCase()} color="#7B4DFF" active={filters.sources.has(src)} onClick={() => toggle('sources', src)} />
        ))}
      </FilterSection>

      <FilterSection title="MIN CONFIDENCE">
        <input type="range" min="0" max="0.9" step="0.1"
          value={filters.minConfidence}
          onChange={e => setFilters(f => ({ ...f, minConfidence: parseFloat(e.target.value) }))}
          style={{ width: '100%', accentColor: '#9B72FF' }}
        />
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#8E86B8', textAlign: 'right' }}>{Math.round(filters.minConfidence * 100)}%+</div>
      </FilterSection>

      <FilterSection title="VISIBILITY">
        <FilterChip label="HIDE ARCHIVED" color="#5B6DFF" active={filters.hideArchived} onClick={() => setFilters(f => ({ ...f, hideArchived: !f.hideArchived }))} />
      </FilterSection>

      <button onClick={() => setFilters({ categories: new Set(), sources: new Set(), minConfidence: 0, hideArchived: false })}
        style={{ width: '100%', marginTop: 10, padding: '8px 0', background: 'none', border: '1px solid rgba(100,70,220,0.18)', borderRadius: 7, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#5E587A' }}>
        Clear All Filters
      </button>
    </motion.div>
  )
}

function FilterSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#5E587A', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
    </div>
  )
}

function FilterChip({ label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '3px 9px', borderRadius: 5, background: active ? hexA(color, 0.22) : 'rgba(8,6,22,0.6)', border: `1px solid ${active ? hexA(color, 0.5) : 'rgba(100,70,220,0.18)'}`, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', color: active ? color : '#6B6394' }}>
      {label}
    </button>
  )
}

function ContextMenu({ x, y, node, onPin, onDelete, onOpenVault, onClose }) {
  const items = [
    { label: node.pinned ? 'Unpin Node' : 'Pin Node', icon: '📌', action: onPin },
    { label: 'Open in Vault',  icon: '◫', action: onOpenVault },
    { label: 'Delete Memory',  icon: '✕', action: onDelete, danger: true },
  ]
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', left: x, top: y, zIndex: 500, background: 'rgba(8,6,22,0.97)', backdropFilter: 'blur(18px)', border: '1px solid rgba(100,70,220,0.25)', borderRadius: 10, overflow: 'hidden', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ padding: '8px 14px 6px', fontFamily: 'Share Tech Mono', fontSize: 9, color: '#5E587A', letterSpacing: '0.14em', borderBottom: '1px solid rgba(100,70,220,0.12)' }}>{node.label}</div>
      {items.map(({ label, icon, action, danger }) => (
        <button key={label} onClick={() => { action(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: danger ? '#f87171' : '#B9A6FF', textAlign: 'left' }}
          onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(200,50,70,0.12)' : 'rgba(100,55,220,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: 11 }}>{icon}</span> {label}
        </button>
      ))}
    </motion.div>
  )
}

function AddMemoryModal({ onClose, onSave }) {
  const [form, setForm] = useState({ label: '', category: 'goals', description: '', importance: 3, tags: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.label.trim()) return
    setSaving(true)
    try {
      await onSave({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), source: 'manual' })
    } finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
        style={{ width: 440, background: 'rgba(8,5,22,0.97)', border: '1px solid rgba(120,80,240,0.28)', borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 18, fontWeight: 700, letterSpacing: '0.18em', color: '#C7A6FF' }}>ADD MEMORY</div>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#5E587A', marginTop: 2, letterSpacing: '0.12em' }}>Save a memory to NYX's constellation</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5E587A', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {[
          { label: 'MEMORY TITLE *', key: 'label', type: 'text', placeholder: 'e.g. Want to build a voice AI system' },
          { label: 'DESCRIPTION', key: 'description', type: 'text', placeholder: 'Optional details...' },
          { label: 'TAGS (comma separated)', key: 'tags', type: 'text', placeholder: 'e.g. AI, voice, project' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#5E587A', marginBottom: 5 }}>{label}</div>
            <input
              value={form[key]} onChange={e => set(key, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && key === 'label' && handleSave()}
              placeholder={placeholder}
              style={{ width: '100%', background: 'rgba(10,8,26,0.70)', border: '1px solid rgba(100,70,220,0.25)', borderRadius: 8, padding: '9px 14px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: '#EDE8FF', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        ))}

        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#5E587A', marginBottom: 5 }}>CATEGORY</div>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              style={{ width: '100%', background: 'rgba(10,8,26,0.70)', border: '1px solid rgba(100,70,220,0.25)', borderRadius: 8, padding: '9px 14px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: '#EDE8FF', outline: 'none' }}>
              {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#5E587A', marginBottom: 5 }}>IMPORTANCE</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => set('importance', n)}
                  style={{ width: 32, height: 34, borderRadius: 7, background: form.importance >= n ? 'rgba(100,55,220,0.38)' : 'rgba(10,8,26,0.70)', border: `1px solid ${form.importance >= n ? 'rgba(155,114,255,0.5)' : 'rgba(100,70,220,0.22)'}`, cursor: 'pointer', color: form.importance >= n ? '#C7A6FF' : '#5E587A', fontSize: 14 }}>
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'none', border: '1px solid rgba(100,70,220,0.20)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#6B6394' }}>Cancel</button>
          <button onClick={handleSave} disabled={!form.label.trim() || saving}
            style={{ padding: '9px 22px', background: form.label.trim() ? 'linear-gradient(135deg,rgba(100,55,220,0.6),rgba(70,30,180,0.5))' : 'rgba(30,20,60,0.5)', border: `1px solid ${form.label.trim() ? 'rgba(155,114,255,0.5)' : 'rgba(80,60,150,0.2)'}`, borderRadius: 8, cursor: form.label.trim() ? 'pointer' : 'default', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: form.label.trim() ? '#EDE8FF' : '#5E587A', boxShadow: form.label.trim() ? '0 0 16px rgba(100,55,220,0.20)' : 'none' }}>
            {saving ? 'Saving...' : 'Save Memory'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
