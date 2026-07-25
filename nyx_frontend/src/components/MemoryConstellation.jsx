/**
 * MemoryConstellation.jsx — NYX Living Memory Map
 *
 * Real 3D knowledge sphere (Constellation3D.jsx) built from actual
 * Constellation nodes/edges, real multi-label categories, and real
 * evidence-backed relationships. Starts empty. Grows organically as NYX
 * learns the user. Every node is earned — nothing is fabricated.
 *
 * Structural note: the rendering engine (was a 2D canvas force-directed
 * graph) now lives entirely in Constellation3D.jsx, a Three.js scene this
 * component only feeds real data into and receives real
 * selection/hover/click events back from. Everything else here — CRUD,
 * filters, search, modals, sidebar — is the same working plumbing as
 * before, reused rather than rebuilt.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../utils/themeContext.jsx'
import {
  getConstellation, addMemory, deleteMemory, updateMemory,
  syncConstellation, exportConstellation, openVault, searchConstellation,
  getCategories, getAllNodeCategories, categorizeAll, discoverRelationships,
  getCategoryCounts, setPrimaryCategory, confirmNodeCategory, rejectNodeCategory,
} from '../services/api.js'
import Constellation3D from './Constellation3D.jsx'
import { categoryColorCss } from '../utils/categoryPalette.js'

// Real taxonomy comes from the backend (core/category_manager.py) — these
// helpers just look up name/color for a category id against whatever the
// server returned, falling back to categoryPalette's curated default (or
// the raw id) if the taxonomy hasn't loaded yet.
function catColor(categories, id) {
  const meta = categories.find(c => c.id === id)
  return categoryColorCss(id, meta?.custom_color || null)
}
function catName(categories, id) {
  const meta = categories.find(c => c.id === id)
  return meta?.name || id || 'Uncategorized'
}

function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function relTime(iso) {
  if (!iso) return 'unknown'
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60)   return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400)return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

// ── Main Component ────────────────────────────────────────────────────

export default function MemoryConstellation() {
  const wrapRef = useRef(null)
  const scene3DRef = useRef(null)
  const { visualPrefs } = useTheme()   // real Nyx performance toggles — Settings → Performance

  const [apiData,        setApiData]        = useState({ nodes: [], edges: [], stats: {} })
  const [stats,          setStats]          = useState({ total_memories: 0, total_edges: 0, categories: 0, last_synced: null })
  const [categories,     setCategories]     = useState([])
  const [categoryCounts, setCategoryCounts] = useState({})
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [nodeCategoryMap,setNodeCategoryMap]= useState({})
  const [hoveredNode,    setHoveredNode]    = useState(null)
  const [selectedNode,   setSelectedNode]   = useState(null)
  const [contextMenu,    setContextMenu]    = useState(null)
  const [showAddModal,   setShowAddModal]   = useState(false)
  const [showFilters,    setShowFilters]    = useState(false)
  const [syncing,        setSyncing]        = useState(false)
  const [syncResult,     setSyncResult]     = useState(null)
  const [categorizing,   setCategorizing]   = useState(false)
  const [discovering,    setDiscovering]    = useState(false)
  const [filters,        setFilters]        = useState({ categories: new Set(), sources: new Set(), minConfidence: 0, hideArchived: false })
  const [notification,   setNotification]   = useState(null)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [searchResults,  setSearchResults]  = useState(null)
  const [searching,      setSearching]      = useState(false)
  const [searchError,    setSearchError]    = useState(null)

  const notify = useCallback((msg, type = 'info') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }, [])

  // ── Real semantic search — matched node ids drive both the 3D
  // highlight/dim state and the "signal from the core" pulse animation.
  const searchMatchIds = useMemo(() => {
    return new Set((searchResults?.results || []).filter(r => r.source_type === 'constellation').map(r => r.source_id))
  }, [searchResults])
  const searchActive = !!searchResults && searchMatchIds.size > 0

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults(null); setSearchError(null); return }
    setSearching(true); setSearchError(null)
    try {
      const res = await searchConstellation(q.trim())
      if (res.mode === 'unavailable') { setSearchError(res.message); setSearchResults(null) }
      else setSearchResults(res)
    } catch (e) {
      setSearchError(e.message); setSearchResults(null)
    } finally {
      setSearching(false)
    }
  }, [])

  // Fire the real core→node pulse animation whenever a new set of search
  // matches lands — this is what makes retrieval activity visible.
  useEffect(() => {
    if (searchActive && scene3DRef.current) {
      scene3DRef.current.pulseToNodes([...searchMatchIds])
    }
  }, [searchResults]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load data ────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    try {
      const [data, catData, assignData, countData] = await Promise.all([
        getConstellation(), getCategories(), getAllNodeCategories(), getCategoryCounts(),
      ])
      setApiData(data)
      setStats(data.stats || {})
      setCategories(catData.categories || [])
      setNodeCategoryMap(assignData.assignments || {})
      setCategoryCounts(countData.counts || {})
    } catch {
      if (!silent) notify('NYX server offline — constellation shown from local state', 'error')
    }
  }, [notify])

  // ── Category management actions — real backend calls, reload after ──
  const handleSetPrimaryCategory = useCallback(async (nodeId, categoryId) => {
    try { await setPrimaryCategory(nodeId, categoryId); await loadData(true); notify('Primary category updated') }
    catch { notify('Could not update primary category', 'error') }
  }, [loadData, notify])

  const handleConfirmCategory = useCallback(async (nodeId, categoryId) => {
    try { await confirmNodeCategory(nodeId, categoryId); await loadData(true) }
    catch { notify('Could not confirm category', 'error') }
  }, [loadData, notify])

  const handleRejectCategory = useCallback(async (nodeId, categoryId) => {
    try { await rejectNodeCategory(nodeId, categoryId); await loadData(true) }
    catch { notify('Could not reject category', 'error') }
  }, [loadData, notify])

  const handleFocusCategory = useCallback((categoryId) => {
    setSelectedNode(null)
    setActiveCategoryId(prev => prev === categoryId ? null : categoryId)
    scene3DRef.current?.focusCategory(categoryId)
  }, [])

  useEffect(() => { loadData(true) }, [loadData])

  const filteredNodes = useMemo(() => {
    return (apiData.nodes || []).filter(n => {
      if (n.type === 'category') return true
      if (filters.hideArchived && n.archived) return false
      if (filters.categories.size > 0 && !filters.categories.has(n.category)) return false
      if (filters.sources.size > 0 && !filters.sources.has(n.source)) return false
      if ((n.confidence || 0) < filters.minConfidence) return false
      return true
    })
  }, [apiData.nodes, filters])

  // ── Actions ──────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const res = await syncConstellation()
      await loadData(true)
      setSyncResult(res.new_memories)
      notify(`Sync complete — ${res.new_memories} new memor${res.new_memories === 1 ? 'y' : 'ies'} found`)
    } catch { notify('Sync failed — is NYX server running?', 'error') } finally { setSyncing(false) }
  }, [loadData, notify])

  const handleCategorize = useCallback(async () => {
    setCategorizing(true)
    try {
      const res = await categorizeAll()
      await loadData(true)
      notify(`Categorized ${res.updated} node${res.updated === 1 ? '' : 's'}${res.skipped_no_embeddings ? ` (${res.skipped_no_embeddings} skipped — embeddings unavailable)` : ''}`)
    } catch { notify('Categorization failed', 'error') } finally { setCategorizing(false) }
  }, [loadData, notify])

  const handleDiscoverRelationships = useCallback(async () => {
    setDiscovering(true)
    try {
      const res = await discoverRelationships()
      if (res.status === 'unavailable') { notify(res.message, 'error') }
      else {
        await loadData(true)
        notify(`Found ${res.related_found} related pair${res.related_found === 1 ? '' : 's'}, ${res.duplicates_found} duplicate${res.duplicates_found === 1 ? '' : 's'}`)
      }
    } catch { notify('Relationship discovery failed', 'error') } finally { setDiscovering(false) }
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
      await loadData(true)
      setContextMenu(null)
      notify(`Memory ${node.pinned ? 'unpinned' : 'pinned'}`)
    } catch { notify('Pin failed', 'error') }
  }, [loadData, notify])

  const selectNodeById = useCallback((nodeId) => {
    const node = (apiData.nodes || []).find(n => n.id === nodeId)
    if (node) { setSelectedNode(node); setActiveCategoryId(null); scene3DRef.current?.focusNode(nodeId) }
  }, [apiData.nodes])

  const handleOpenVault = useCallback(async () => {
    try { await openVault(); notify('Opening Obsidian vault...') } catch { notify('Could not open vault', 'error') }
  }, [notify])

  const hasMemories = (apiData.nodes || []).length > 0

  // ── JSX ──────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
      onClick={() => setContextMenu(null)}>

      <TopBar
        onAddMemory={() => setShowAddModal(true)}
        onShowFilters={() => setShowFilters(s => !s)}
        filtersActive={filters.categories.size > 0 || filters.sources.size > 0 || filters.minConfidence > 0 || filters.hideArchived}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        <AnimatePresence>
          {showFilters && <FiltersPanel categories={categories} filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} />}
        </AnimatePresence>

        {/* 3D scene area */}
        <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Constellation3D
            ref={scene3DRef}
            nodes={filteredNodes}
            edges={apiData.edges || []}
            nodeCategoryMap={nodeCategoryMap}
            categories={categories}
            categoryCounts={categoryCounts}
            activeCategoryId={activeCategoryId}
            selectedNodeId={selectedNode?.id || null}
            hoveredNodeId={hoveredNode?.id || null}
            searchMatchIds={searchMatchIds}
            searchActive={searchActive}
            visualPrefs={visualPrefs}
            onSelectNode={(node) => { setSelectedNode(node); setActiveCategoryId(null); setContextMenu(null) }}
            onHoverNode={setHoveredNode}
          />

          <SearchPanel
            query={searchQuery} setQuery={setSearchQuery} onSearch={runSearch}
            searching={searching} results={searchResults} error={searchError}
            onSelectResult={(r) => { if (r.source_type === 'constellation') selectNodeById(r.source_id) }}
            onClear={() => { setSearchQuery(''); setSearchResults(null); setSearchError(null) }}
          />

          <CategoryLegend
            categories={categories} categoryCounts={categoryCounts}
            activeCategoryId={activeCategoryId} onFocusCategory={handleFocusCategory}
          />

          {searchActive && (
            <div style={{
              position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.4)',
              borderRadius: 8, padding: '5px 14px', fontFamily: 'Share Tech Mono, monospace',
              fontSize: 9.5, color: '#7dd3fc', letterSpacing: '0.08em', zIndex: 15,
            }}>
              CURRENT RETRIEVAL — {searchMatchIds.size} node{searchMatchIds.size === 1 ? '' : 's'} activated
            </div>
          )}

          <AnimatePresence>
            {!hasMemories && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', bottom: 68, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#3E3860', letterSpacing: '0.16em' }}>
                  NO MEMORIES YET — START A CONVERSATION OR ADD ONE MANUALLY
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {contextMenu && (
              <ContextMenu x={contextMenu.x} y={contextMenu.y} node={contextMenu.node}
                onPin={() => handlePinNode(contextMenu.node)}
                onDelete={() => handleDeleteNode(contextMenu.node)}
                onOpenVault={handleOpenVault}
                onClose={() => setContextMenu(null)}
              />
            )}
          </AnimatePresence>

          {/* Camera controls */}
          <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
            <button onClick={() => scene3DRef.current?.resetCamera()} style={controlBtnStyle}>Reset View</button>
            <button onClick={() => scene3DRef.current?.fitToScreen()} style={controlBtnStyle}>Fit to Screen</button>
          </div>
        </div>

        <RightSidebar
          stats={stats} categories={categories} categoryCounts={categoryCounts} nodeCategoryMap={nodeCategoryMap}
          selectedNode={selectedNode} apiData={apiData}
          syncing={syncing} syncResult={syncResult} onSync={handleSync}
          categorizing={categorizing} onCategorize={handleCategorize}
          discovering={discovering} onDiscoverRelationships={handleDiscoverRelationships}
          onExportJSON={handleExportJSON} onOpenVault={handleOpenVault}
          onFocusNode={(id) => { setActiveCategoryId(null); scene3DRef.current?.focusNode(id) }}
          notify={notify}
          onSetPrimaryCategory={handleSetPrimaryCategory}
          onConfirmCategory={handleConfirmCategory}
          onRejectCategory={handleRejectCategory}
          activeCategoryId={activeCategoryId}
          onClearCategoryFocus={() => setActiveCategoryId(null)}
        />
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AddMemoryModal
            categories={categories}
            onClose={() => setShowAddModal(false)}
            onSave={async (data) => {
              try {
                await addMemory(data); await loadData(); setShowAddModal(false)
                notify(`Memory Saved — "${data.label}"`, 'success')
              } catch { notify('Save failed — make sure NYX server is running', 'error') }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div key={notification.msg}
            initial={{ opacity: 0, y: 28, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            style={{
              position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
              background: notification.type === 'error' ? 'rgba(130,18,36,0.94)' : notification.type === 'success' ? 'rgba(14,90,55,0.94)' : 'rgba(35,18,80,0.94)',
              border: `1px solid ${notification.type === 'error' ? 'rgba(240,60,80,0.45)' : notification.type === 'success' ? 'rgba(52,211,130,0.50)' : 'rgba(130,80,255,0.40)'}`,
              backdropFilter: 'blur(18px)', borderRadius: 12, padding: '12px 24px',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 15, fontWeight: 600, letterSpacing: '0.06em', color: '#EDE8FF',
              zIndex: 1200, pointerEvents: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 10,
            }}>
            {notification.type === 'success' && <span style={{ fontSize: 16, color: '#34D399' }}>✓</span>}
            {notification.type === 'error' && <span style={{ fontSize: 14, color: '#F87171' }}>✕</span>}
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

const controlBtnStyle = { height: 32, padding: '0 14px', background: 'rgba(7,5,18,0.80)', backdropFilter: 'blur(14px)', border: '1px solid rgba(100,70,220,0.18)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#8E86B8' }

function SearchPanel({ query, setQuery, onSearch, searching, results, error, onSelectResult, onClear }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'absolute', top: 14, left: 14, width: 320, zIndex: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(7,5,18,0.85)', backdropFilter: 'blur(14px)', border: `1px solid rgba(150,110,255,${focused ? 0.4 : 0.18})`, borderRadius: 10, padding: '9px 12px' }}>
        <span style={{ color: '#8E86B8', fontSize: 13 }}>⌕</span>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSearch(query) }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder="Semantic search — e.g. dark mode preference"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#EDE8FF', fontFamily: 'Share Tech Mono, monospace', fontSize: 11.5 }} />
        {searching && <span style={{ color: '#8E86B8', fontSize: 10 }}>...</span>}
        {(query || results) && !searching && <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#8E86B8', cursor: 'pointer', fontSize: 13 }}>×</button>}
        <button onClick={() => onSearch(query)} style={{ background: 'rgba(123,77,255,0.18)', border: '1px solid rgba(123,77,255,0.35)', borderRadius: 6, color: '#C7A6FF', fontSize: 9.5, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 9px', cursor: 'pointer' }}>Search</button>
      </div>

      {error && <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontFamily: 'Share Tech Mono, monospace', fontSize: 10, lineHeight: 1.5 }}>{error}</div>}

      {results && !error && (
        <div style={{ marginTop: 6, maxHeight: 340, overflowY: 'auto', borderRadius: 10, background: 'rgba(7,5,18,0.92)', backdropFilter: 'blur(14px)', border: '1px solid rgba(150,110,255,0.18)' }}>
          {results.results.length === 0 ? (
            <div style={{ padding: '12px 14px', color: '#5E587A', fontFamily: 'Share Tech Mono, monospace', fontSize: 10.5 }}>No matches above the relevance threshold.</div>
          ) : results.results.map((r, i) => (
            <div key={`${r.source_type}-${r.source_id}-${i}`} onClick={() => onSelectResult(r)}
              style={{ padding: '9px 13px', cursor: r.source_type === 'constellation' ? 'pointer' : 'default', borderBottom: i < results.results.length - 1 ? '1px solid rgba(150,110,255,0.08)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,77,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: r.source_type === 'constellation' ? '#C7A6FF' : '#8E86B8' }}>
                  {r.source_type === 'constellation' ? 'CONSTELLATION NODE' : `VAULT · ${r.source_id}`}
                </span>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#5E587A' }}>{(r.score * 100).toFixed(0)}%</span>
              </div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10.5, color: '#C9C3E8', lineHeight: 1.4 }}>{r.text}</div>
              {r.supporting_count > 0 && (
                <div style={{ marginTop: 4, fontFamily: 'Share Tech Mono, monospace', fontSize: 8.5, color: '#f59e0b' }}>
                  + {r.supporting_count} supporting memor{r.supporting_count === 1 ? 'y' : 'ies'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact legend — only real, populated categories ever appear (a
// category with 0 nodes is real but has nothing to show yet, so it's
// left out rather than listed as a dead entry). Clicking one focuses the
// camera on that region and filters/dims the rest of the scene.
function CategoryLegend({ categories, categoryCounts, activeCategoryId, onFocusCategory }) {
  const [collapsed, setCollapsed] = useState(false)
  const populated = categories
    .filter(c => (categoryCounts?.[c.id] || 0) > 0)
    .sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0))

  if (populated.length === 0) return null

  return (
    <div style={{ position: 'absolute', top: 14, right: 14, width: collapsed ? 'auto' : 190, zIndex: 20 }}>
      <div style={{ background: 'rgba(7,5,18,0.85)', backdropFilter: 'blur(14px)', border: '1px solid rgba(150,110,255,0.18)', borderRadius: 10, padding: collapsed ? '7px 10px' : '9px 11px' }}>
        <div onClick={() => setCollapsed(c => !c)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsed ? 0 : 7 }}>
          <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: '#8E86B8' }}>CATEGORIES</span>
          <span style={{ color: '#5E587A', fontSize: 10 }}>{collapsed ? '▸' : '▾'}</span>
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 300, overflowY: 'auto' }}>
            {populated.map(c => {
              const color = catColor(categories, c.id)
              const active = activeCategoryId === c.id
              return (
                <div key={c.id} onClick={() => onFocusCategory(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 5px', borderRadius: 5, cursor: 'pointer', background: active ? hexA(color, 0.16) : 'transparent' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(150,110,255,0.06)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: 'Exo 2, sans-serif', fontSize: 10.5, color: active ? '#EDE8FF' : '#B9A6FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9.5, color: '#5E587A' }}>{categoryCounts[c.id]}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TopBar({ onAddMemory, onShowFilters, filtersActive }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 52, flexShrink: 0, borderBottom: '1px solid rgba(100,70,220,0.13)', background: 'rgba(5,3,14,0.70)', backdropFilter: 'blur(20px)', zIndex: 20, position: 'relative' }}>
      <div>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: '0.26em', color: '#C7A6FF', textShadow: '0 0 16px rgba(199,166,255,0.45)' }}>NYX MEMORY CONSTELLATION</div>
        <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: '#5E587A', letterSpacing: '0.14em' }}>Earned through conversation. Growing over time.</div>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onShowFilters} style={{ display: 'flex', alignItems: 'center', gap: 6, background: filtersActive ? 'rgba(80,40,180,0.25)' : 'rgba(8,6,20,0.65)', border: `1px solid ${filtersActive ? 'rgba(155,114,255,0.45)' : 'rgba(100,70,220,0.20)'}`, borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '0.10em', color: filtersActive ? '#C7A6FF' : '#8E86B8' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        Filters{filtersActive ? ' ●' : ''}
      </button>
      <button onClick={onAddMemory} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,rgba(100,55,220,0.55),rgba(70,30,180,0.45))', border: '1px solid rgba(155,114,255,0.48)', borderRadius: 8, padding: '7px 15px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#EDE8FF', boxShadow: '0 0 18px rgba(100,55,220,0.22)' }}>
        + Add Memory
      </button>
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

function RightSidebar({
  stats, categories, categoryCounts, nodeCategoryMap, selectedNode, apiData,
  syncing, syncResult, onSync, categorizing, onCategorize, discovering, onDiscoverRelationships,
  onExportJSON, onOpenVault, onFocusNode, notify,
  onSetPrimaryCategory, onConfirmCategory, onRejectCategory,
  activeCategoryId, onClearCategoryFocus,
}) {
  const selCats = selectedNode ? (nodeCategoryMap[selectedNode.id] || []) : []
  const connectedEdges = selectedNode
    ? (apiData.edges || []).filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
    : []
  const activeCategory = !selectedNode && activeCategoryId ? categories.find(c => c.id === activeCategoryId) : null
  const activeCategoryNodes = activeCategory
    ? (apiData.nodes || []).filter(n => {
        const cats = nodeCategoryMap[n.id] || []
        return cats.some(c => c.category_id === activeCategoryId) || n.category === activeCategoryId
      })
    : []

  return (
    <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 12px', overflowY: 'auto', background: 'rgba(4,3,12,0.60)', backdropFilter: 'blur(22px)', borderLeft: '1px solid rgba(100,70,220,0.13)' }}>

      {/* Node inspection panel — every field here is real, only shown if present.
          Real Constellation nodes never carry a `type` field (constellation_manager.py
          only ever creates memory nodes), so presence of `selectedNode` is itself
          the real signal — a `type === 'memory'` check here was always false. */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(7,5,18,0.65)', border: `1px solid ${catColor(categories, selectedNode.category)}33`, borderRadius: 11, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: catColor(categories, selectedNode.category), letterSpacing: '0.16em', marginBottom: 5 }}>SELECTED NODE</div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 700, color: '#EDE8FF', marginBottom: 4 }}>{selectedNode.label}</div>
            {selectedNode.description && (
              <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 11.5, color: '#9d96c0', lineHeight: 1.5, marginBottom: 8 }}>{selectedNode.description}</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: 'Share Tech Mono', fontSize: 9, color: '#6B6394', marginBottom: 8 }}>
              <span>conf {Math.round((selectedNode.confidence || 0) * 100)}%</span>
              <span>×{selectedNode.mention_count || 1} mentions</span>
              <span>source: {selectedNode.source}</span>
              {selectedNode.timestamp && <span>created {relTime(selectedNode.timestamp)}</span>}
              {selectedNode.last_referenced && <span>updated {relTime(selectedNode.last_referenced)}</span>}
            </div>

            {selCats.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: '#5E587A', letterSpacing: '0.1em', marginBottom: 4 }}>CATEGORIES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selCats.map(c => {
                    const color = catColor(categories, c.category_id)
                    const isPending = c.source === 'automatic'
                    return (
                      <span key={c.category_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: hexA(color, 0.14), border: `1px solid ${hexA(color, 0.35)}`, borderRadius: 4, padding: '2px 5px 2px 6px', fontSize: 9, color, fontFamily: 'Share Tech Mono' }}>
                        {c.is_primary && <span title="Primary — controls node color">●</span>}
                        {catName(categories, c.category_id)} · {Math.round(c.confidence * 100)}%
                        {!c.is_primary && (
                          <button onClick={() => onSetPrimaryCategory(selectedNode.id, c.category_id)} title="Make primary"
                            style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }}>↑</button>
                        )}
                        {isPending && (
                          <>
                            <button onClick={() => onConfirmCategory(selectedNode.id, c.category_id)} title="Confirm"
                              style={{ background: 'none', border: 'none', color: '#34D399', cursor: 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }}>✓</button>
                            <button onClick={() => onRejectCategory(selectedNode.id, c.category_id)} title="Reject"
                              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }}>✕</button>
                          </>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {connectedEdges.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: '#5E587A', letterSpacing: '0.1em', marginBottom: 4 }}>
                  CONNECTED NODES ({connectedEdges.length})
                </div>
                {connectedEdges.slice(0, 6).map(e => {
                  const otherId = e.source === selectedNode.id ? e.target : e.source
                  const other = (apiData.nodes || []).find(n => n.id === otherId)
                  if (!other) return null
                  return (
                    <div key={e.id} onClick={() => onFocusNode(otherId)} style={{ cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 10.5, color: '#8E86B8', padding: '2px 0' }}>
                      <span style={{ color: '#5E587A' }}>{e.relationship_type}</span> → {other.label} <span style={{ color: '#5E587A' }}>({Math.round((e.confidence || e.strength || 0) * 100)}%)</span>
                    </div>
                  )
                })}
              </div>
            )}

            {selectedNode.tags?.length > 0 && (
              <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {selectedNode.tags.map(t => {
                  const color = catColor(categories, selectedNode.category)
                  return <span key={t} style={{ background: hexA(color, 0.12), border: `1px solid ${hexA(color, 0.28)}`, borderRadius: 4, padding: '1px 5px', fontSize: 9, color, fontFamily: 'Share Tech Mono' }}>{t}</span>
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => { navigator.clipboard?.writeText(selectedNode.id); notify('Node ID copied') }} style={miniBtnStyle}>Copy ID</button>
              <button onClick={onOpenVault} style={miniBtnStyle}>Open Source</button>
              <button onClick={() => { navigator.clipboard?.writeText(`Ask Nyx: tell me about "${selectedNode.label}"`); notify('Question copied — paste it in chat') }} style={miniBtnStyle}>Ask Nyx</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category-details panel — real count + real member nodes, shown
          when a category is focused from the legend (never while a node
          is selected, so the two inspection modes don't overlap). */}
      <AnimatePresence>
        {activeCategory && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(7,5,18,0.65)', border: `1px solid ${catColor(categories, activeCategory.id)}40`, borderRadius: 11, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 8, color: catColor(categories, activeCategory.id), letterSpacing: '0.16em', marginBottom: 5 }}>CATEGORY</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 16, fontWeight: 700, color: '#EDE8FF' }}>{activeCategory.name}</div>
              </div>
              <button onClick={onClearCategoryFocus} style={{ background: 'none', border: 'none', color: '#5E587A', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            {activeCategory.description && (
              <div style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 11, color: '#9d96c0', lineHeight: 1.5, margin: '6px 0 8px' }}>{activeCategory.description}</div>
            )}
            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#6B6394', marginBottom: 8 }}>
              {categoryCounts?.[activeCategory.id] ?? activeCategoryNodes.length} real member{activeCategoryNodes.length === 1 ? '' : 's'}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {activeCategoryNodes.map(n => (
                <div key={n.id} onClick={() => onFocusNode(n.id)}
                  style={{ cursor: 'pointer', fontFamily: 'Exo 2, sans-serif', fontSize: 11, color: '#B9A6FF', padding: '4px 0', borderBottom: '1px solid rgba(100,70,220,0.08)' }}>
                  {n.label}
                </div>
              ))}
              {activeCategoryNodes.length === 0 && (
                <div style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#5E587A' }}>No member nodes.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SidePanel title="CONNECTIONS">
        {[
          { icon: '◈', label: 'Total Memories', val: stats.total_memories ?? 0 },
          { icon: '⬡', label: 'Relationships',  val: stats.total_edges ?? 0 },
          { icon: '◇', label: 'Categories',     val: categories.length },
          { icon: '◎', label: 'Last Synced',    val: stats.last_synced ? relTime(stats.last_synced) : '—' },
        ].map(({ icon, label, val }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(100,70,200,0.08)' }}>
            <span style={{ color: '#7B4DFF', fontSize: 11, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontFamily: 'Exo 2, sans-serif', fontSize: 11, color: '#8E86B8', flex: 1 }}>{label}</span>
            <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#C7A6FF' }}>{val}</span>
          </div>
        ))}
      </SidePanel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 'auto' }}>
        <motion.button onClick={onSync} whileTap={{ scale: 0.97 }} disabled={syncing} style={primaryBtnStyle}>
          <motion.span animate={syncing ? { rotate: 360 } : {}} transition={syncing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}>⟳</motion.span>
          {syncing ? 'Scanning...' : syncResult !== null ? `Synced (${syncResult} new)` : 'Sync Now'}
        </motion.button>

        <button onClick={onCategorize} disabled={categorizing} style={secondaryBtnStyle}>
          {categorizing ? 'Categorizing...' : 'Categorize Memories'}
        </button>

        <button onClick={onDiscoverRelationships} disabled={discovering} style={secondaryBtnStyle}>
          {discovering ? 'Analyzing...' : 'Discover Relationships'}
        </button>

        <button onClick={onExportJSON} style={secondaryBtnStyle}>↗ Export as JSON</button>
        <button onClick={onOpenVault} style={secondaryBtnStyle}>◫ Open Vault</button>
      </div>
    </div>
  )
}

const miniBtnStyle = { fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'none', border: '1px solid rgba(123,77,255,0.3)', borderRadius: 5, color: '#8E86B8', padding: '4px 8px', cursor: 'pointer' }
const primaryBtnStyle = { width: '100%', padding: '10px 0', background: 'linear-gradient(135deg,rgba(100,55,220,0.45),rgba(70,30,180,0.38))', border: '1px solid rgba(155,114,255,0.42)', borderRadius: 9, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#EDE8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 0 16px rgba(100,55,220,0.18)' }
const secondaryBtnStyle = { width: '100%', padding: '9px 0', background: 'rgba(7,5,18,0.65)', border: '1px solid rgba(100,70,220,0.20)', borderRadius: 9, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#8E86B8' }

function FiltersPanel({ categories, filters, setFilters, onClose }) {
  const toggle = (setKey, val) => setFilters(f => {
    const s = new Set(f[setKey]); s.has(val) ? s.delete(val) : s.add(val); return { ...f, [setKey]: s }
  })
  return (
    <motion.div initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{ width: 220, flexShrink: 0, background: 'rgba(6,4,16,0.94)', backdropFilter: 'blur(22px)', borderRight: '1px solid rgba(100,70,220,0.18)', padding: '16px 14px', overflowY: 'auto', zIndex: 50 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#C7A6FF' }}>FILTERS</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5E587A', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>
      <FilterSection title="CATEGORY">
        {categories.map(c => <FilterChip key={c.id} label={c.name.toUpperCase()} color={catColor(categories, c.id)} active={filters.categories.has(c.id)} onClick={() => toggle('categories', c.id)} />)}
      </FilterSection>
      <FilterSection title="SOURCE">
        {['chat', 'voice', 'vault', 'manual'].map(src => <FilterChip key={src} label={src.toUpperCase()} color="#7B4DFF" active={filters.sources.has(src)} onClick={() => toggle('sources', src)} />)}
      </FilterSection>
      <FilterSection title="MIN CONFIDENCE">
        <input type="range" min="0" max="0.9" step="0.1" value={filters.minConfidence} onChange={e => setFilters(f => ({ ...f, minConfidence: parseFloat(e.target.value) }))} style={{ width: '100%', accentColor: '#9B72FF' }} />
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
    { label: 'Open in Vault', icon: '◫', action: onOpenVault },
    { label: 'Delete Memory', icon: '✕', action: onDelete, danger: true },
  ]
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', left: x, top: y, zIndex: 500, background: 'rgba(8,6,22,0.97)', backdropFilter: 'blur(18px)', border: '1px solid rgba(100,70,220,0.25)', borderRadius: 10, overflow: 'hidden', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ padding: '8px 14px 6px', fontFamily: 'Share Tech Mono', fontSize: 9, color: '#5E587A', letterSpacing: '0.14em', borderBottom: '1px solid rgba(100,70,220,0.12)' }}>{node.label}</div>
      {items.map(({ label, icon, action, danger }) => (
        <button key={label} onClick={() => { action(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: danger ? '#f87171' : '#B9A6FF', textAlign: 'left' }}
          onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(200,50,70,0.12)' : 'rgba(100,55,220,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <span style={{ fontSize: 11 }}>{icon}</span> {label}
        </button>
      ))}
    </motion.div>
  )
}

function AddMemoryModal({ categories, onClose, onSave }) {
  const [form, setForm] = useState({ label: '', category: 'uncategorized', description: '', importance: 3, tags: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.label.trim()) return
    setSaving(true)
    try { await onSave({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), source: 'manual' }) } finally { setSaving(false) }
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
          { label: 'MEMORY TITLE *', key: 'label', placeholder: 'e.g. Want to build a voice AI system' },
          { label: 'DESCRIPTION', key: 'description', placeholder: 'Optional details...' },
          { label: 'TAGS (comma separated)', key: 'tags', placeholder: 'e.g. AI, voice, project' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#5E587A', marginBottom: 5 }}>{label}</div>
            <input value={form[key]} onChange={e => set(key, e.target.value)} onKeyDown={e => e.key === 'Enter' && key === 'label' && handleSave()} placeholder={placeholder}
              style={{ width: '100%', background: 'rgba(10,8,26,0.70)', border: '1px solid rgba(100,70,220,0.25)', borderRadius: 8, padding: '9px 14px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: '#EDE8FF', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}

        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#5E587A', marginBottom: 5 }}>CATEGORY</div>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={{ width: '100%', background: 'rgba(10,8,26,0.70)', border: '1px solid rgba(100,70,220,0.25)', borderRadius: 8, padding: '9px 14px', fontFamily: 'Exo 2, sans-serif', fontSize: 13, color: '#EDE8FF', outline: 'none' }}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: '#5E587A', marginBottom: 5 }}>IMPORTANCE</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => set('importance', n)} style={{ width: 32, height: 34, borderRadius: 7, background: form.importance >= n ? 'rgba(100,55,220,0.38)' : 'rgba(10,8,26,0.70)', border: `1px solid ${form.importance >= n ? 'rgba(155,114,255,0.5)' : 'rgba(100,70,220,0.22)'}`, cursor: 'pointer', color: form.importance >= n ? '#C7A6FF' : '#5E587A', fontSize: 14 }}>★</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'none', border: '1px solid rgba(100,70,220,0.20)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#6B6394' }}>Cancel</button>
          <button onClick={handleSave} disabled={!form.label.trim() || saving}
            style={{ padding: '9px 22px', background: form.label.trim() ? 'linear-gradient(135deg,rgba(100,55,220,0.6),rgba(70,30,180,0.5))' : 'rgba(30,20,60,0.5)', border: `1px solid ${form.label.trim() ? 'rgba(155,114,255,0.5)' : 'rgba(80,60,150,0.2)'}`, borderRadius: 8, cursor: form.label.trim() ? 'pointer' : 'default', fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: form.label.trim() ? '#EDE8FF' : '#5E587A' }}>
            {saving ? 'Saving...' : 'Save Memory'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
